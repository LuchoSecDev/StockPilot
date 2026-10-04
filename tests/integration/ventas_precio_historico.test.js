/**
 * @file ventas_precio_historico.test.js
 * @description Rama feat/backend-app-tendero: el historial de ventas (`GET /api/ventas`) y sus
 * estadísticas (`/api/ventas/stats`) calculaban los importes con el precio ACTUAL del producto, así que
 * al cambiar un precio cambiaba el historial. Ahora usan `VentasProductos.precio_unitario` (el precio
 * al que se vendió) y solo caen al precio actual en las filas antiguas que no lo guardaron.
 * La venta de un solo producto también guarda ahora su precio_unitario (antes solo lo hacía el carrito).
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
  await t.tenderoA.agente.post('/api/caja/abrir').set('X-CSRF-Token', t.tenderoA.csrfToken).send({ monto_apertura: 1000 });
  const carrito = (cantidad) => t.tenderoA.agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', t.tenderoA.csrfToken).send({ items: [{ id_producto: producto, cantidad }] });
  const unica = (cantidad) => t.tenderoA.agente.post('/api/registrar-venta').set('X-CSRF-Token', t.tenderoA.csrfToken).send({ id_producto: producto, cantidad });
  const cambiarPrecio = (precio) => db.runAsync('UPDATE Productos SET precio = ? WHERE id_producto = ?', [precio, producto]);
  const listado = async () => (await t.tenderoA.agente.get('/api/ventas').set('Accept', 'application/json')).body.data;
  const stats = async () => (await t.tenderoA.agente.get('/api/ventas/stats').set('Accept', 'application/json')).body;
  return { ...t, producto, carrito, unica, cambiarPrecio, listado, stats };
}

describe('Historial de ventas con el precio al que se vendió', () => {
  it('venta de carrito: si el precio del producto cambia después, el historial conserva el precio de la venta', async () => {
    const e = await escenario();
    expect((await e.carrito(3)).status).toBe(200); // 3 × 1.000
    await esperarTrabajoEnSegundoPlano();
    await e.cambiarPrecio(2500);

    const [fila] = await e.listado();
    expect(fila).toMatchObject({ cantidad: 3, precio_unitario: '1000.00', precio_total: '3000.00' });
    expect((await e.stats()).totalVentas).toBe(3000); // las estadísticas tampoco se mueven
  });

  it('venta de un solo producto: también guarda el precio unitario y conserva el historial', async () => {
    const e = await escenario();
    expect((await e.unica(2)).status).toBe(200);
    await esperarTrabajoEnSegundoPlano();
    expect((await db.getAsync('SELECT precio_unitario FROM VentasProductos'))).toMatchObject({ precio_unitario: '1000.00' });

    await e.cambiarPrecio(9000);
    const [fila] = await e.listado();
    expect(fila).toMatchObject({ cantidad: 2, precio_unitario: '1000.00', precio_total: '2000.00' });
  });

  it('ventas a precios distintos: cada fila y el total usan el suyo', async () => {
    const e = await escenario();
    await e.carrito(1); // 1.000
    await e.cambiarPrecio(1500);
    await e.carrito(2); // 3.000
    await esperarTrabajoEnSegundoPlano();
    const filas = await e.listado();
    expect(filas.map((f) => [f.cantidad, f.precio_unitario, f.precio_total]).sort()).toEqual([[1, '1000.00', '1000.00'], [2, '1500.00', '3000.00']]);
    expect((await e.stats()).totalVentas).toBe(4000);
  });

  it('una fila antigua sin precio_unitario (venta anterior a esta corrección) cae al precio actual del producto', async () => {
    const e = await escenario();
    const venta = await db.runAsync('INSERT INTO Ventas (id_vendedor, id_tienda, precio_total) VALUES (?, ?, 5000) RETURNING id_venta', [e.tenderoA.id_usuario, e.tenderoA.id_tienda]);
    await db.runAsync('INSERT INTO VentasProductos (id_venta, id_producto, cantidad) VALUES (?, ?, 5)', [venta.lastID, e.producto]);
    const [fila] = await e.listado();
    expect(fila).toMatchObject({ cantidad: 5, precio_unitario: '1000.00', precio_total: '5000.00' });
  });
});
