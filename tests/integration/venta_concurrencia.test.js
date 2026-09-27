/**
 * @file venta_concurrencia.test.js
 * @description Flujo prioritario 1/7 (plan 20, Nivel 2): ventas simultáneas del mismo producto
 * con stock limitado, contra Postgres real. registerSale usa `SELECT ... FOR UPDATE` para evitar
 * la condición de carrera; registerCartSale no.
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

// registerSale/registerCartSale disparan Alert.generate() y _checkSalesGoals() sin esperarlos
// (ver tests/integration/helpers/tiempo.js) — cada prueba de este archivo llama a una de las dos,
// así que les damos tiempo a terminar antes de que el beforeEach de la SIGUIENTE prueba (de este
// archivo o de otro) vacíe la base con TRUNCATE mientras ese trabajo sigue corriendo.
afterEach(async () => {
  await esperarTrabajoEnSegundoPlano();
});

describe('Venta con concurrencia', () => {
  it('POST /api/registrar-venta (un producto): con stock=1, dos ventas simultáneas de 1 unidad -> una sola gana', async () => {
    const { id_tienda, id_usuario, usuario, password } = await crearUsuario({ rol: 'Tendero' });
    const id_producto = await crearProducto({ id_tienda, cantidad: 1, precio: 1000 });
    await abrirCaja(id_tienda, id_usuario);

    const agente = request.agent(app);
    await iniciarSesion(agente, { usuario, password });
    const csrfToken = await obtenerCsrfToken(agente);

    const [r1, r2] = await Promise.all([
      agente.post('/api/registrar-venta').set('X-CSRF-Token', csrfToken).send({ id_producto, cantidad: 1 }),
      agente.post('/api/registrar-venta').set('X-CSRF-Token', csrfToken).send({ id_producto, cantidad: 1 })
    ]);

    const estados = [r1.status, r2.status].sort();
    expect(estados).toEqual([200, 400]);

    const fallida = r1.status === 400 ? r1 : r2;
    expect(fallida.body.error).toMatch(/Stock insuficiente/i);

    const producto = await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [id_producto]);
    expect(producto.cantidad).toBe(0);

    const ventas = await db.allAsync('SELECT * FROM Ventas WHERE id_tienda = ?', [id_tienda]);
    expect(ventas.length).toBe(1);
  });

  it('POST /api/registrar-venta-carrito (mismo producto): con stock=1, dos ventas simultáneas de 1 unidad -> nunca sobrevende (observado, ver hallazgo 8.7 sobre por qué no está garantizado por diseño)', async () => {
    const { id_tienda, id_usuario, usuario, password } = await crearUsuario({ rol: 'Tendero' });
    const id_producto = await crearProducto({ id_tienda, cantidad: 1, precio: 1000 });
    await abrirCaja(id_tienda, id_usuario);

    const agente = request.agent(app);
    await iniciarSesion(agente, { usuario, password });
    const csrfToken = await obtenerCsrfToken(agente);

    const [r1, r2] = await Promise.all([
      agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', csrfToken).send({ items: [{ id_producto, cantidad: 1 }] }),
      agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', csrfToken).send({ items: [{ id_producto, cantidad: 1 }] })
    ]);

    const estados = [r1.status, r2.status].sort();
    expect(estados).toEqual([200, 400]);

    const producto = await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [id_producto]);
    expect(producto.cantidad).toBe(0);

    const totalUnidadesVendidas = await db.getAsync(
      `SELECT COALESCE(SUM(vp.cantidad), 0) as total FROM VentasProductos vp
       JOIN Ventas v ON v.id_venta = vp.id_venta WHERE v.id_tienda = ? AND vp.id_producto = ?`,
      [id_tienda, id_producto]
    );
    expect(Number(totalUnidadesVendidas.total)).toBe(1);
  });

  it('POST /api/registrar-venta-carrito bajo más contención (5 pedidos simultáneos, stock=3): nunca vende más unidades de las que había en stock', async () => {
    const { id_tienda, id_usuario, usuario, password } = await crearUsuario({ rol: 'Tendero' });
    const id_producto = await crearProducto({ id_tienda, cantidad: 3, precio: 1000 });
    await abrirCaja(id_tienda, id_usuario);

    const agente = request.agent(app);
    await iniciarSesion(agente, { usuario, password });
    const csrfToken = await obtenerCsrfToken(agente);

    const pedidos = Array.from({ length: 5 }, () =>
      agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', csrfToken).send({ items: [{ id_producto, cantidad: 1 }] })
    );
    const resultados = await Promise.all(pedidos);

    const exitosas = resultados.filter(r => r.status === 200).length;
    const fallidas = resultados.filter(r => r.status === 400).length;
    expect(exitosas + fallidas).toBe(5);
    // La aserción que de verdad importa: nunca se venden más de las 3 unidades que había en stock.
    expect(exitosas).toBeLessThanOrEqual(3);

    const producto = await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [id_producto]);
    expect(producto.cantidad).toBeGreaterThanOrEqual(0); // nunca negativo

    const totalUnidadesVendidas = await db.getAsync(
      `SELECT COALESCE(SUM(vp.cantidad), 0) as total FROM VentasProductos vp
       JOIN Ventas v ON v.id_venta = vp.id_venta WHERE v.id_tienda = ? AND vp.id_producto = ?`,
      [id_tienda, id_producto]
    );
    expect(Number(totalUnidadesVendidas.total)).toBe(exitosas);
    expect(Number(totalUnidadesVendidas.total)).toBeLessThanOrEqual(3);
  });
});
