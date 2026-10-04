/**
 * @file ventas_turno.test.js
 * @description Rama feat/backend-app-tendero: `GET /api/ventas` ahora devuelve el `canal` de cada venta
 * y admite `?turno=actual` (solo las ventas de la caja abierta del usuario), para la función opcional
 * «ventas del turno» de la app (plan 07, 6.2). Sin el parámetro, el comportamiento no cambia.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../app.js';
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
  const abrir = (s) => s.agente.post('/api/caja/abrir').set('X-CSRF-Token', s.csrfToken).send({ monto_apertura: 1000 });
  const cerrar = (s) => s.agente.post('/api/caja/cerrar').set('X-CSRF-Token', s.csrfToken).send({ monto_cierre_declarado: 1000 });
  const vender = (s, cantidad = 1) => s.agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', s.csrfToken).send({ items: [{ id_producto: producto, cantidad }] });
  const ventas = (s, query = '') => s.agente.get(`/api/ventas${query}`).set('Accept', 'application/json');
  return { ...t, producto, abrir, cerrar, vender, ventas };
}

describe('GET /api/ventas: canal y turno', () => {
  it('cada fila trae el canal de la venta; sin parámetros devuelve todas las de la tienda', async () => {
    const e = await escenario();
    await e.abrir(e.tenderoA);
    await e.vender(e.tenderoA);
    await e.abrir(e.adminA);
    await e.vender(e.adminA);
    await esperarTrabajoEnSegundoPlano();

    const r = await e.ventas(e.tenderoA);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(2);
    expect(r.body.data).toHaveLength(2);
    r.body.data.forEach((v) => expect(v.canal).toBe('web'));
  });

  it('?turno=actual devuelve SOLO las ventas de la caja abierta del usuario (no las de otros vendedores de la tienda)', async () => {
    const e = await escenario();
    await e.abrir(e.tenderoA);
    await e.abrir(e.adminA);
    await e.vender(e.tenderoA, 1);
    await e.vender(e.tenderoA, 2);
    await e.vender(e.adminA, 3);
    await esperarTrabajoEnSegundoPlano();

    const mias = await e.ventas(e.tenderoA, '?turno=actual');
    expect(mias.status).toBe(200);
    expect(mias.body).toMatchObject({ total: 2, hasMore: false });
    expect(mias.body.data.map((v) => v.cantidad).sort()).toEqual([1, 2]);

    const delAdmin = await e.ventas(e.adminA, '?turno=actual');
    expect(delAdmin.body.data.map((v) => v.cantidad)).toEqual([3]);
  });

  it('el turno es la caja ABIERTA: tras cerrarla la lista queda vacía, y al abrir otra solo cuenta lo nuevo', async () => {
    const e = await escenario();
    await e.abrir(e.tenderoA);
    await e.vender(e.tenderoA);
    await e.cerrar(e.tenderoA);
    await esperarTrabajoEnSegundoPlano();

    const cerrada = await e.ventas(e.tenderoA, '?turno=actual');
    expect(cerrada.body).toEqual({ data: [], total: 0, limit: 100, offset: 0, hasMore: false });

    await e.abrir(e.tenderoA);
    await e.vender(e.tenderoA, 4);
    await esperarTrabajoEnSegundoPlano();
    const nuevo = await e.ventas(e.tenderoA, '?turno=actual');
    expect(nuevo.body.data.map((v) => v.cantidad)).toEqual([4]);
    expect((await e.ventas(e.tenderoA)).body.total).toBe(2); // sin el filtro siguen viéndose las dos
  });

  it('la paginación respeta el filtro (limit, offset, hasMore y total)', async () => {
    const e = await escenario();
    await e.abrir(e.tenderoA);
    for (let i = 0; i < 3; i++) await e.vender(e.tenderoA);
    await esperarTrabajoEnSegundoPlano();
    const pagina = await e.ventas(e.tenderoA, '?turno=actual&limit=2&offset=0');
    expect(pagina.body).toMatchObject({ total: 3, limit: 2, offset: 0, hasMore: true });
    expect(pagina.body.data).toHaveLength(2);
    expect((await e.ventas(e.tenderoA, '?turno=actual&limit=2&offset=2')).body.data).toHaveLength(1);
  });

  it('un valor de turno distinto de «actual» es un error del cliente (400); no se interpreta como «sin filtro»', async () => {
    const e = await escenario();
    for (const turno of ['todos', '', '1', 'ACTUAL']) {
      const r = await e.ventas(e.tenderoA, `?turno=${turno}`);
      expect(r.status, turno).toBe(400);
      expect(r.body).toEqual({ success: false, error: expect.stringMatching(/turno/) });
    }
  });

  it('las ventas de otra tienda nunca aparecen, con o sin filtro', async () => {
    const e = await escenario();
    await e.abrir(e.tenderoA);
    await e.vender(e.tenderoA);
    await esperarTrabajoEnSegundoPlano();
    expect((await e.ventas(e.tenderoB)).body.total).toBe(0);
    expect((await e.ventas(e.tenderoB, '?turno=actual')).body.total).toBe(0);
  });
});
