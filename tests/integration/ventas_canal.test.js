/**
 * @file ventas_canal.test.js
 * @description Backend para la app nativa del Tendero (rama feat/backend-app-tendero, punto 2):
 * `Ventas.canal` ('web' o 'app', por defecto 'web') se toma de la SESIÓN, nunca del cuerpo ni de una
 * cabecera de la propia venta, en `registrar-venta` y `registrar-venta-carrito`. Sirve para medir la
 * adopción por canal durante el piloto (plan 07, sección 6.3).
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

async function vendedor(canal, overrides = {}) {
  const datos = await crearUsuario({ rol: 'Tendero', ...overrides });
  const agente = request.agent(app);
  await iniciarSesion(agente, datos, { canal });
  const csrfToken = await obtenerCsrfToken(agente);
  await abrirCaja(datos.id_tienda, datos.id_usuario);
  const id_producto = await crearProducto({ id_tienda: datos.id_tienda, cantidad: 20, precio: 1000 });
  return { agente, csrfToken, id_producto, ...datos };
}
const canalDeVentas = async () => (await db.allAsync('SELECT canal FROM Ventas ORDER BY id_venta')).map((v) => v.canal);

describe('Ventas.canal', () => {
  it('registrar-venta: una sesión web registra canal «web» y una sesión app, «app»', async () => {
    const web = await vendedor(undefined);
    const r1 = await web.agente.post('/api/registrar-venta').set('X-CSRF-Token', web.csrfToken).send({ id_producto: web.id_producto, cantidad: 1 });
    expect(r1.status).toBe(200);

    const movil = await vendedor('app');
    const r2 = await movil.agente.post('/api/registrar-venta').set('X-CSRF-Token', movil.csrfToken).send({ id_producto: movil.id_producto, cantidad: 1 });
    expect(r2.status).toBe(200);

    await esperarTrabajoEnSegundoPlano();
    expect(await canalDeVentas()).toEqual(['web', 'app']);
  });

  it('registrar-venta-carrito: igual, para web y para app', async () => {
    const web = await vendedor(undefined);
    const r1 = await web.agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', web.csrfToken).send({ items: [{ id_producto: web.id_producto, cantidad: 2 }] });
    expect(r1.status).toBe(200);

    const movil = await vendedor('app');
    const r2 = await movil.agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', movil.csrfToken)
      .send({ items: [{ id_producto: movil.id_producto, cantidad: 1 }, { id_producto: movil.id_producto, cantidad: 1 }] });
    expect(r2.status).toBe(200);

    await esperarTrabajoEnSegundoPlano();
    expect(await canalDeVentas()).toEqual(['web', 'app']);
  });

  it('la venta fiada desde la app también queda como «app»', async () => {
    const movil = await vendedor('app');
    const cliente = await db.runAsync("INSERT INTO Clientes (id_tienda, nombre, limite_credito) VALUES (?, 'Cliente fiado', 100000) RETURNING id_cliente", [movil.id_tienda]);
    const r = await movil.agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', movil.csrfToken)
      .send({ items: [{ id_producto: movil.id_producto, cantidad: 2 }], metodo_pago: 'Fiado', id_cliente: cliente.lastID });
    expect(r.status).toBe(200);
    await esperarTrabajoEnSegundoPlano();
    expect(await db.getAsync("SELECT canal, estado_deuda FROM Ventas")).toMatchObject({ canal: 'app', estado_deuda: 'Pendiente' });
  });

  it('el canal sale de la sesión: un `canal` en el cuerpo o una cabecera X-Canal en la propia venta se ignoran', async () => {
    const web = await vendedor(undefined);
    const r = await web.agente.post('/api/registrar-venta').set('X-CSRF-Token', web.csrfToken).set('X-Canal', 'app')
      .send({ id_producto: web.id_producto, cantidad: 1, canal: 'app' });
    expect(r.status).toBe(200);

    const movil = await vendedor('app');
    const r2 = await movil.agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', movil.csrfToken).set('X-Canal', 'web')
      .send({ items: [{ id_producto: movil.id_producto, cantidad: 1 }], canal: 'web' });
    expect(r2.status).toBe(200);

    await esperarTrabajoEnSegundoPlano();
    expect(await canalDeVentas()).toEqual(['web', 'app']);
  });

  it('las ventas anteriores a la columna (o insertadas sin canal) quedan como «web»', async () => {
    const { id_usuario, id_tienda } = await crearUsuario({ rol: 'Tendero' });
    await db.runAsync('INSERT INTO Ventas (id_vendedor, id_tienda, precio_total) VALUES (?, ?, 5000)', [id_usuario, id_tienda]);
    expect(await canalDeVentas()).toEqual(['web']);
  });

  it('la base rechaza un canal que no sea «web» o «app»', async () => {
    const { id_usuario, id_tienda } = await crearUsuario({ rol: 'Tendero' });
    await expect(
      db.runAsync("INSERT INTO Ventas (id_vendedor, id_tienda, precio_total, canal) VALUES (?, ?, 5000, 'movil')", [id_usuario, id_tienda])
    ).rejects.toThrow(/canal/i);
  });
});
