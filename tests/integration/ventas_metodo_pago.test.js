/**
 * @file ventas_metodo_pago.test.js
 * @description Contrato de la app del Tendero ([V2]): `metodo_pago` solo admite «Efectivo» (por defecto),
 * «Tarjeta», «Transferencia» o «Fiado», con esa escritura exacta, en `registrar-venta-carrito` y
 * `registrar-venta`. Antes el servidor guardaba cualquier texto, y el arqueo de caja solo suma las ventas
 * cuyo método es exactamente «Efectivo»: un «efectivo» en minúscula dejaba la venta fuera del cuadre en silencio.
 */
import { describe, it, expect, beforeEach } from 'vitest';
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

async function vendedor() {
  const datos = await crearUsuario({ rol: 'Tendero' });
  const agente = request.agent(app);
  await iniciarSesion(agente, datos, { canal: 'app' });
  const csrfToken = await obtenerCsrfToken(agente);
  await abrirCaja(datos.id_tienda, datos.id_usuario);
  const id_producto = await crearProducto({ id_tienda: datos.id_tienda, cantidad: 50, precio: 1000 });
  const cliente = await db.runAsync("INSERT INTO Clientes (id_tienda, nombre, limite_credito) VALUES (?, 'Cliente', 0)", [datos.id_tienda]);
  const post = (url, body) => agente.post(url).set('X-CSRF-Token', csrfToken).send(body);
  return { post, id_producto, id_cliente: cliente.lastID };
}
const estado = async (id_producto) => ({
  ventas: Number((await db.getAsync('SELECT COUNT(*) AS n FROM Ventas')).n),
  stock: Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [id_producto])).cantidad)
});

describe('metodo_pago de una venta', () => {
  const invalidos = ['efectivo', 'EFECTIVO', 'Nequi', 'Mixto', 123, true, { a: 1 }];

  it.each(invalidos)('registrar-venta-carrito rechaza %j con 400 y no registra nada', async (metodo_pago) => {
    const v = await vendedor();
    const antes = await estado(v.id_producto);
    const r = await v.post('/api/registrar-venta-carrito', { items: [{ id_producto: v.id_producto, cantidad: 2 }], metodo_pago });
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ success: false, error: 'Método de pago no válido. Usa Efectivo, Tarjeta, Transferencia o Fiado.' });
    expect(await estado(v.id_producto)).toEqual(antes);
  });

  it('registrar-venta (un producto) también lo rechaza y no registra nada', async () => {
    const v = await vendedor();
    const antes = await estado(v.id_producto);
    const r = await v.post('/api/registrar-venta', { id_producto: v.id_producto, cantidad: 1, metodo_pago: 'efectivo' });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/Método de pago no válido/);
    expect(await estado(v.id_producto)).toEqual(antes);
  });

  it.each(['Efectivo', 'Tarjeta', 'Transferencia', 'Fiado'])('«%s» se acepta tal cual y se guarda así', async (metodo_pago) => {
    const v = await vendedor();
    const r = await v.post('/api/registrar-venta-carrito', {
      items: [{ id_producto: v.id_producto, cantidad: 1 }], metodo_pago, id_cliente: v.id_cliente
    });
    expect(r.status).toBe(200);
    const venta = await db.getAsync('SELECT metodo_pago FROM Ventas WHERE id_venta = ?', [r.body.id_venta]);
    expect(venta.metodo_pago).toBe(metodo_pago);
    await esperarTrabajoEnSegundoPlano();
  });

  it('los espacios alrededor se recortan (sanitizeBody) y se guarda el texto exacto', async () => {
    const v = await vendedor();
    const r = await v.post('/api/registrar-venta-carrito', { items: [{ id_producto: v.id_producto, cantidad: 1 }], metodo_pago: '  Efectivo ' });
    expect(r.status).toBe(200);
    expect((await db.getAsync('SELECT metodo_pago FROM Ventas WHERE id_venta = ?', [r.body.id_venta])).metodo_pago).toBe('Efectivo');
    await esperarTrabajoEnSegundoPlano();
  });

  it('sin metodo_pago (o null, o vacío) sigue valiendo «Efectivo» por defecto', async () => {
    const v = await vendedor();
    for (const extra of [{}, { metodo_pago: null }, { metodo_pago: '' }]) {
      const r = await v.post('/api/registrar-venta-carrito', { items: [{ id_producto: v.id_producto, cantidad: 1 }], ...extra });
      expect(r.status).toBe(200);
      expect((await db.getAsync('SELECT metodo_pago FROM Ventas WHERE id_venta = ?', [r.body.id_venta])).metodo_pago).toBe('Efectivo');
    }
    await esperarTrabajoEnSegundoPlano();
  });
});
