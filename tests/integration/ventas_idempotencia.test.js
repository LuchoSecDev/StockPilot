/**
 * @file ventas_idempotencia.test.js
 * @description `POST /api/registrar-venta-carrito` con la cabecera `Idempotency-Key` ([V2] del contrato de
 * la app del Tendero). Problema que resuelve: en el celular, si la señal se pierde justo al vender, la app
 * no sabe si la venta quedó registrada; reintentar a ciegas la duplicaba (venta, stock y Kardex dos veces).
 *
 * Regla: la misma clave del mismo vendedor con la misma carga devuelve la venta ya registrada (200, mismo
 * `id_venta`, cabecera `Idempotent-Replayed: true`) sin tocar stock, Kardex ni caja. Sin cabecera, todo
 * sigue como antes (la web no la manda). Una clave solo queda registrada si la venta se confirmó.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto, abrirCaja } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});
// Las alertas y metas posteriores a la venta corren sin esperar la respuesta: que terminen antes de limpiar.
afterEach(esperarTrabajoEnSegundoPlano);

const CLAVE = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

async function vendedor(overrides = {}) {
  const datos = await crearUsuario({ rol: 'Tendero', ...overrides });
  const agente = request.agent(app);
  await iniciarSesion(agente, datos, { canal: 'app' });
  const csrfToken = await obtenerCsrfToken(agente);
  await abrirCaja(datos.id_tienda, datos.id_usuario);
  const id_producto = overrides.id_producto ?? await crearProducto({ id_tienda: datos.id_tienda, cantidad: 20, precio: 1000 });
  const vender = (body, clave) => {
    const p = agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', csrfToken);
    return (clave === undefined ? p : p.set('Idempotency-Key', clave)).send(body);
  };
  return { agente, csrfToken, id_producto, vender, ...datos };
}
const carrito = (id_producto, cantidad = 2) => ({ items: [{ id_producto, cantidad }], metodo_pago: 'Efectivo' });
const cuentas = async (id_producto) => ({
  ventas: Number((await db.getAsync('SELECT COUNT(*) AS n FROM Ventas')).n),
  detalles: Number((await db.getAsync('SELECT COUNT(*) AS n FROM VentasProductos')).n),
  kardex: Number((await db.getAsync("SELECT COUNT(*) AS n FROM MovimientosStock WHERE tipo_movimiento = 'Salida'")).n),
  stock: Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [id_producto])).cantidad)
});

describe('Idempotency-Key en registrar-venta-carrito', () => {
  it('sin la cabecera nada cambia: dos peticiones iguales son dos ventas (compatibilidad con la web)', async () => {
    const v = await vendedor();
    const a = await v.vender(carrito(v.id_producto));
    const b = await v.vender(carrito(v.id_producto));
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.id_venta).not.toBe(b.body.id_venta);
    expect(await cuentas(v.id_producto)).toMatchObject({ ventas: 2, stock: 16 });
  });

  it('la primera venta con clave se registra normal y NO lleva la marca de repetición', async () => {
    const v = await vendedor();
    const r = await v.vender(carrito(v.id_producto), CLAVE);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, message: 'Venta registrada correctamente', id_venta: expect.any(Number) });
    expect(r.headers['idempotent-replayed']).toBeUndefined();
  });

  it('el reintento con la misma clave y la misma carga devuelve la MISMA venta sin duplicar nada', async () => {
    const v = await vendedor();
    const primera = await v.vender(carrito(v.id_producto), CLAVE);
    const antes = await cuentas(v.id_producto);

    const repetida = await v.vender(carrito(v.id_producto), CLAVE);
    expect(repetida.status).toBe(200);
    expect(repetida.body).toEqual(primera.body);
    expect(repetida.headers['idempotent-replayed']).toBe('true');

    expect(await cuentas(v.id_producto)).toEqual(antes);
    expect(antes).toEqual({ ventas: 1, detalles: 1, kardex: 1, stock: 18 });
  });

  it('CARRERA: dos peticiones con la misma clave DENTRO de la transacción a la vez registran una sola venta', async () => {
    // Las peticiones de una sesión no llegan de verdad en paralelo al controlador (la 2.ª entra cuando la 1.ª
    // ya confirmó y cae por el camino rápido), así que para ejercer el candado se fuerza la coincidencia:
    // esta transacción retiene el bloqueo del producto y las dos ventas quedan paradas en `FOR UPDATE`
    // DENTRO de su transacción. Sin el candado de asesoría, la segunda no encuentra la venta de la primera,
    // se despierta cuando esta confirma y choca con el índice único (400).
    const v = await vendedor();
    const retenedor = await db.getClient();
    await retenedor.query('BEGIN');
    await retenedor.query('SELECT id_producto FROM Productos WHERE id_producto = ? FOR UPDATE', [v.id_producto]);
    let liberado = false;
    try {
      const enVuelo = [v.vender(carrito(v.id_producto), CLAVE), v.vender(carrito(v.id_producto), CLAVE)].map((p) => p.then((r) => r));
      await new Promise((r) => setTimeout(r, 600)); // las dos ya están dentro del controlador, esperando el producto
      await retenedor.query('COMMIT');
      liberado = true;
      const [a, b] = await Promise.all(enVuelo);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.body.id_venta).toBe(b.body.id_venta);
      expect([a, b].filter((r) => r.headers['idempotent-replayed'] === 'true')).toHaveLength(1);
      expect(await cuentas(v.id_producto)).toEqual({ ventas: 1, detalles: 1, kardex: 1, stock: 18 });
    } finally {
      if (!liberado) await retenedor.query('ROLLBACK');
      retenedor.release();
    }
  });

  it('cinco peticiones casi simultáneas con la misma clave registran una sola venta y todas devuelven su id', async () => {
    const v = await vendedor();
    const respuestas = await Promise.all(Array.from({ length: 5 }, () => v.vender(carrito(v.id_producto), CLAVE)));
    expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(respuestas.map((r) => r.body.id_venta)).size).toBe(1);
    expect(respuestas.filter((r) => r.headers['idempotent-replayed'] === 'true')).toHaveLength(4);
    expect(await cuentas(v.id_producto)).toEqual({ ventas: 1, detalles: 1, kardex: 1, stock: 18 });
  });

  it('la repetición sigue valiendo aunque entre medias el stock ya no alcance para una venta nueva', async () => {
    const v = await vendedor();
    await db.runAsync('UPDATE Productos SET cantidad = 2 WHERE id_producto = ?', [v.id_producto]);
    const primera = await v.vender(carrito(v.id_producto, 2), CLAVE); // deja el stock en 0
    expect(primera.status).toBe(200);
    const repetida = await v.vender(carrito(v.id_producto, 2), CLAVE); // sin la clave sería «Stock insuficiente»
    expect(repetida.status).toBe(200);
    expect(repetida.body.id_venta).toBe(primera.body.id_venta);
    expect((await cuentas(v.id_producto)).stock).toBe(0);
  });

  it('la repetición sigue valiendo si la caja se cerró entre medias', async () => {
    const v = await vendedor();
    const primera = await v.vender(carrito(v.id_producto), CLAVE);
    await db.runAsync("UPDATE SesionCaja SET estado = 'Cerrada', fecha_cierre = CURRENT_TIMESTAMP WHERE id_vendedor = ?", [v.id_usuario]);
    const repetida = await v.vender(carrito(v.id_producto), CLAVE);
    expect(repetida.status).toBe(200);
    expect(repetida.body.id_venta).toBe(primera.body.id_venta);
    // Una venta NUEVA (otra clave) sin caja abierta sigue siendo 403.
    expect((await v.vender(carrito(v.id_producto), 'otra-clave-distinta-1')).status).toBe(403);
  });

  it('la misma clave con OTRA carga es un error (422) y no registra una segunda venta', async () => {
    const v = await vendedor();
    await v.vender(carrito(v.id_producto, 2), CLAVE);
    const antes = await cuentas(v.id_producto);
    for (const otra of [carrito(v.id_producto, 3), { ...carrito(v.id_producto, 2), metodo_pago: 'Tarjeta' }, { ...carrito(v.id_producto, 2), efectivo_recibido: 50000 }]) {
      const r = await v.vender(otra, CLAVE);
      expect(r.status).toBe(422);
      expect(r.body).toEqual({ success: false, code: 'IDEMPOTENCY_KEY_REUSED', error: 'Esa Idempotency-Key ya se usó con una venta distinta. Genera una clave nueva para cada venta.' });
    }
    expect(await cuentas(v.id_producto)).toEqual(antes);
  });

  it('dos vendedores pueden usar la misma clave: son ventas independientes', async () => {
    const a = await vendedor();
    const b = await vendedor();
    const [ra, rb] = await Promise.all([a.vender(carrito(a.id_producto), CLAVE), b.vender(carrito(b.id_producto), CLAVE)]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    expect(ra.body.id_venta).not.toBe(rb.body.id_venta);
    expect(ra.headers['idempotent-replayed']).toBeUndefined();
    expect(rb.headers['idempotent-replayed']).toBeUndefined();
    expect((await cuentas(a.id_producto)).ventas).toBe(2);
  });

  it('una venta que FALLA no consume la clave: tras corregir el problema, la misma clave funciona', async () => {
    const v = await vendedor();
    await db.runAsync('UPDATE Productos SET cantidad = 1 WHERE id_producto = ?', [v.id_producto]);
    const fallida = await v.vender(carrito(v.id_producto, 5), CLAVE);
    expect(fallida.status).toBe(400);
    expect(fallida.body.error).toMatch(/Stock insuficiente/);
    expect((await cuentas(v.id_producto)).ventas).toBe(0);

    await db.runAsync('UPDATE Productos SET cantidad = 10 WHERE id_producto = ?', [v.id_producto]);
    const ok = await v.vender(carrito(v.id_producto, 5), CLAVE);
    expect(ok.status).toBe(200);
    expect(ok.headers['idempotent-replayed']).toBeUndefined();
    expect(await cuentas(v.id_producto)).toMatchObject({ ventas: 1, stock: 5 });
  });

  it.each([
    ['muy corta', 'abc'],
    ['con caracteres no permitidos', 'clave con espacios y ñ!'],
    ['demasiado larga', 'a'.repeat(101)],
    ['vacía', '']
  ])('una clave %s da 400 y no registra nada', async (_nombre, clave) => {
    const v = await vendedor();
    const r = await v.vender(carrito(v.id_producto), clave);
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ success: false, error: 'La cabecera Idempotency-Key debe tener de 8 a 100 caracteres: letras, números, guion o guion bajo (por ejemplo, un UUID).' });
    expect((await cuentas(v.id_producto)).ventas).toBe(0);
  });

  it('las ventas anteriores (sin clave) no estorban: varias ventas sin clave y una con clave conviven', async () => {
    const v = await vendedor();
    await v.vender(carrito(v.id_producto, 1));
    await v.vender(carrito(v.id_producto, 1));
    const conClave = await v.vender(carrito(v.id_producto, 1), CLAVE);
    expect(conClave.status).toBe(200);
    expect((await cuentas(v.id_producto)).ventas).toBe(3);
  });
});
