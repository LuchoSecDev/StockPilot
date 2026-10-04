/**
 * @file ventas_fiado_validaciones.test.js
 * @description Hallazgos de las ventas (rama feat/backend-app-tendero), encontrados al documentar el
 * contrato de la app:
 *  - Una venta aceptaba como `id_cliente` un cliente de OTRA tienda (la deuda quedaba ligada a él).
 *    Ahora el cliente tiene que ser de la tienda de la sesión (404 si no).
 *  - El `limite_credito` del cliente no se aplicaba nunca. Ahora una venta fiada que deja el saldo por
 *    encima del cupo se rechaza (400). Un cupo de 0 significa «sin tope» (es el valor por defecto al
 *    crear un cliente y la web no lo trata como «sin crédito»: decisión de negocio pendiente).
 *  - Un producto inexistente (o de otra tienda) en el carrito daba 400 «Error interno procesando la venta»;
 *    ahora 404 «Producto no encontrado o no pertenece a tu tienda», igual que la venta de un solo producto.
 * La validación y el saldo se calculan DENTRO de la transacción, con el cliente bloqueado (FOR UPDATE),
 * así que dos ventas fiadas simultáneas al mismo cliente no pueden pasarse del cupo juntas.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearProducto } from './helpers/fixtures.js';
import { dosTiendas } from './helpers/tiendas.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

async function escenario() {
  const t = await dosTiendas(app);
  const producto = await crearProducto({ id_tienda: t.adminA.id_tienda, nombre_producto: 'Arroz', precio: 1000, cantidad: 100 });
  const productoB = await crearProducto({ id_tienda: t.adminB.id_tienda, nombre_producto: 'De B', precio: 1000, cantidad: 100 });
  for (const s of [t.tenderoA, t.tenderoB]) {
    await s.agente.post('/api/caja/abrir').set('X-CSRF-Token', s.csrfToken).send({ monto_apertura: 1000 });
  }
  const cliente = async (id_tienda, limite, nombre = 'Cliente') =>
    (await db.runAsync('INSERT INTO Clientes (id_tienda, nombre, limite_credito) VALUES (?, ?, ?) RETURNING id_cliente', [id_tienda, nombre, limite])).lastID;
  const carrito = (s, body) => s.agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', s.csrfToken).send(body);
  const unica = (s, body) => s.agente.post('/api/registrar-venta').set('X-CSRF-Token', s.csrfToken).send(body);
  const stock = async (id) => Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [id])).cantidad);
  const ventas = async () => Number((await db.getAsync('SELECT COUNT(*) AS n FROM Ventas')).n);
  return { ...t, producto, productoB, cliente, carrito, unica, stock, ventas };
}
const fiado = (producto, cantidad, id_cliente) => ({ items: [{ id_producto: producto, cantidad }], metodo_pago: 'Fiado', id_cliente });

describe('El cliente de la venta tiene que ser de la tienda de la sesión', () => {
  it('carrito: un cliente de OTRA tienda da 404 «Cliente no encontrado»; no se registra la venta ni se descuenta stock', async () => {
    const e = await escenario();
    const ajeno = await e.cliente(e.adminB.id_tienda, 100000, 'Cliente de B');
    const r = await e.carrito(e.tenderoA, fiado(e.producto, 1, ajeno));
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ success: false, error: 'Cliente no encontrado' });
    expect(await e.ventas()).toBe(0);
    expect(await e.stock(e.producto)).toBe(100);
  });

  it('venta de un solo producto: igual', async () => {
    const e = await escenario();
    const ajeno = await e.cliente(e.adminB.id_tienda, 100000);
    const r = await e.unica(e.tenderoA, { id_producto: e.producto, cantidad: 1, metodo_pago: 'Fiado', id_cliente: ajeno });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ success: false, error: 'Cliente no encontrado' });
    expect(await e.ventas()).toBe(0);
    expect(await e.stock(e.producto)).toBe(100);
  });

  it('un id_cliente inexistente o no numérico también da 404 (antes, 400 «Error interno» o un 500)', async () => {
    const e = await escenario();
    for (const id of [999999, 'abc', '1; DROP TABLE Ventas', -1, 1.5]) {
      const c = await e.carrito(e.tenderoA, fiado(e.producto, 1, id));
      const u = await e.unica(e.tenderoA, { id_producto: e.producto, cantidad: 1, metodo_pago: 'Fiado', id_cliente: id });
      expect([c.status, u.status], String(id)).toEqual([404, 404]);
    }
    expect(await e.ventas()).toBe(0);
  });

  it('un cliente ajeno tampoco se puede ligar a una venta que NO es fiada (efectivo)', async () => {
    const e = await escenario();
    const ajeno = await e.cliente(e.adminB.id_tienda, 100000);
    const r = await e.carrito(e.tenderoA, { items: [{ id_producto: e.producto, cantidad: 1 }], metodo_pago: 'Efectivo', id_cliente: ajeno });
    expect(r.status).toBe(404);
    expect(await e.ventas()).toBe(0);
  });

  it('un cliente de la propia tienda sigue funcionando (carrito y venta de un solo producto)', async () => {
    const e = await escenario();
    const c = await e.cliente(e.adminA.id_tienda, 100000);
    expect((await e.carrito(e.tenderoA, fiado(e.producto, 2, c))).status).toBe(200);
    expect((await e.unica(e.tenderoA, { id_producto: e.producto, cantidad: 1, metodo_pago: 'Fiado', id_cliente: c })).status).toBe(200);
    await esperarTrabajoEnSegundoPlano();
    expect(await e.ventas()).toBe(2);
  });
});

describe('Límite de crédito del cliente', () => {
  it('una venta fiada que deja el saldo POR ENCIMA del cupo se rechaza con 400 y un mensaje claro; no se registra nada', async () => {
    const e = await escenario();
    const c = await e.cliente(e.adminA.id_tienda, 5000);
    const r = await e.carrito(e.tenderoA, fiado(e.producto, 6, c)); // 6.000 sobre un cupo de 5.000
    expect(r.status).toBe(400);
    expect(r.body.success).toBe(false);
    expect(r.body.error).toMatch(/supera el cupo de crédito/i);
    expect(r.body.error).toMatch(/5\.000/); // el cupo
    expect(await e.ventas()).toBe(0);
    expect(await e.stock(e.producto)).toBe(100);
  });

  it('justo en el cupo SÍ pasa; la siguiente venta (cualquier monto) ya no', async () => {
    const e = await escenario();
    const c = await e.cliente(e.adminA.id_tienda, 5000);
    expect((await e.carrito(e.tenderoA, fiado(e.producto, 5, c))).status).toBe(200); // 5.000 = cupo
    const siguiente = await e.carrito(e.tenderoA, fiado(e.producto, 1, c));
    expect(siguiente.status).toBe(400);
    expect(siguiente.body.error).toMatch(/supera el cupo/i);
  });

  it('cuenta lo que el cliente ya debe: las ventas fiadas anteriores suman y los abonos restan', async () => {
    const e = await escenario();
    const c = await e.cliente(e.adminA.id_tienda, 5000);
    expect((await e.carrito(e.tenderoA, fiado(e.producto, 4, c))).status).toBe(200); // debe 4.000
    expect((await e.carrito(e.tenderoA, fiado(e.producto, 2, c))).status).toBe(400); // 6.000 > 5.000

    await db.runAsync("INSERT INTO Abonos (id_cliente, id_tienda, monto, metodo_pago) VALUES (?, ?, 3000, 'Efectivo')", [c, e.adminA.id_tienda]); // debe 1.000
    expect((await e.carrito(e.tenderoA, fiado(e.producto, 4, c))).status).toBe(200); // 5.000 = cupo
    expect((await e.carrito(e.tenderoA, fiado(e.producto, 1, c))).status).toBe(400);
  });

  it('la venta de un solo producto aplica el mismo cupo', async () => {
    const e = await escenario();
    const c = await e.cliente(e.adminA.id_tienda, 1500);
    const r = await e.unica(e.tenderoA, { id_producto: e.producto, cantidad: 2, metodo_pago: 'Fiado', id_cliente: c });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/supera el cupo/i);
    expect(await e.ventas()).toBe(0);
  });

  it('un cupo de 0 (el valor por defecto al crear un cliente) significa «sin tope»: la venta pasa', async () => {
    const e = await escenario();
    const c = await e.cliente(e.adminA.id_tienda, 0);
    expect((await e.carrito(e.tenderoA, fiado(e.producto, 50, c))).status).toBe(200);
  });

  it('el cupo solo se aplica a ventas FIADAS: pagar en efectivo a un cliente sin cupo disponible no se bloquea', async () => {
    const e = await escenario();
    const c = await e.cliente(e.adminA.id_tienda, 500);
    const r = await e.carrito(e.tenderoA, { items: [{ id_producto: e.producto, cantidad: 10 }], metodo_pago: 'Efectivo', id_cliente: c });
    expect(r.status).toBe(200);
  });

  it('dos ventas fiadas SIMULTÁNEAS al mismo cliente no pueden pasarse del cupo juntas (se serializan por el bloqueo del cliente)', async () => {
    for (let ronda = 0; ronda < 3; ronda++) {
      await limpiarBaseDePruebas();
      const e = await escenario();
      const c = await e.cliente(e.adminA.id_tienda, 5000);
      const respuestas = await Promise.all(Array.from({ length: 6 }, () => e.carrito(e.tenderoA, fiado(e.producto, 2, c)))); // 2.000 c/u
      const estados = respuestas.map((r) => r.status).sort();
      expect(estados.filter((s) => s === 200), `ronda ${ronda}`).toHaveLength(2); // 4.000 ≤ 5.000; la tercera ya excede
      expect(estados.filter((s) => s === 400)).toHaveLength(4);
      await esperarTrabajoEnSegundoPlano();
      const deuda = Number((await db.getAsync("SELECT COALESCE(SUM(precio_total), 0) AS d FROM Ventas WHERE id_cliente = ? AND metodo_pago = 'Fiado'", [c])).d);
      expect(deuda).toBeLessThanOrEqual(5000);
    }
  });
});

describe('Producto inexistente o de otra tienda en el carrito', () => {
  it('404 «Producto no encontrado o no pertenece a tu tienda» (antes 400 «Error interno procesando la venta»); el resto del carrito no se vende', async () => {
    const e = await escenario();
    for (const id of [999999, e.productoB]) {
      const r = await e.carrito(e.tenderoA, { items: [{ id_producto: e.producto, cantidad: 1 }, { id_producto: id, cantidad: 1 }] });
      expect(r.status, String(id)).toBe(404);
      expect(r.body).toEqual({ success: false, error: 'Producto no encontrado o no pertenece a tu tienda' });
    }
    expect(await e.ventas()).toBe(0);
    expect(await e.stock(e.producto)).toBe(100);
    expect(await e.stock(e.productoB)).toBe(100);
  });

  it('el stock insuficiente sigue siendo 400 con el nombre del producto', async () => {
    const e = await escenario();
    const r = await e.carrito(e.tenderoA, { items: [{ id_producto: e.producto, cantidad: 999 }] });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ success: false, error: 'Stock insuficiente para el producto: Arroz' });
  });
});
