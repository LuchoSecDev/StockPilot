/**
 * @file caja_historial.test.js
 * @description Historial de sesiones de caja del Administrador (`GET /api/caja/historial`): que no mezcle tiendas ni
 * turnos y que cada sesión traiga su desglose por método de pago (auditoría). Quién puede verlo está en
 * caja_historial_autorizacion.test.js.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../app.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { crearProducto } from './helpers/fixtures.js';
import { dosTiendas } from './helpers/tiendas.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';

beforeEach(async () => { await limpiarBaseDePruebas(); await reiniciarLimitadores(); });

const JSON_ACCEPT = { Accept: 'application/json' };

async function escenario() {
  const t = await dosTiendas(app);
  const productoA = await crearProducto({ id_tienda: t.adminA.id_tienda, nombre_producto: 'Arroz Diana 1Kg', precio: 4500, cantidad: 50 });
  const productoB = await crearProducto({ id_tienda: t.adminB.id_tienda, nombre_producto: 'Arroz Diana 1Kg', precio: 4500, cantidad: 50 });
  const get = (s, url) => s.agente.get(url).set(JSON_ACCEPT);
  const post = (s, url, cuerpo = {}) => s.agente.post(url).set('X-CSRF-Token', s.csrfToken).send(cuerpo);
  const vender = (s, id_producto, cantidad, metodo_pago) => post(s, '/api/registrar-venta-carrito', { items: [{ id_producto, cantidad }], metodo_pago });
  return { ...t, productoA, productoB, get, post, vender };
}

const CERO = { cantidad: 0, total: 0 };

describe('GET /api/caja/historial — contenido', () => {
  it('cada sesión trae lo vendido por método: efectivo, tarjeta, transferencia y fiado quedan separados y no se mezclan con otros turnos ni tiendas', async () => {
    const e = await escenario();

    // Turno 1 de la tienda A (cerrado): 2 en efectivo, 1 con tarjeta.
    await e.post(e.tenderoA, '/api/caja/abrir', { monto_apertura: 50000 });
    await e.vender(e.tenderoA, e.productoA, 1, 'Efectivo');
    await e.vender(e.tenderoA, e.productoA, 1, 'Efectivo');
    await e.vender(e.tenderoA, e.productoA, 1, 'Tarjeta');
    expect((await e.post(e.tenderoA, '/api/caja/cerrar', { monto_cierre_declarado: 59000 })).status).toBe(200);

    // Turno 2 (abierto): 1 transferencia.
    await e.post(e.tenderoA, '/api/caja/abrir', { monto_apertura: 20000 });
    await e.vender(e.tenderoA, e.productoA, 2, 'Transferencia');

    // La tienda B tiene su propia caja y sus ventas: no deben aparecer en el historial de A.
    await e.post(e.tenderoB, '/api/caja/abrir', { monto_apertura: 99000 });
    await e.vender(e.tenderoB, e.productoB, 3, 'Efectivo');
    await esperarTrabajoEnSegundoPlano();

    const r = await e.get(e.adminA, '/api/caja/historial');
    expect(r.status).toBe(200);
    expect(r.body.history).toHaveLength(2); // solo las dos sesiones de la tienda A
    const [abierta, cerrada] = r.body.history; // más reciente primero
    expect(abierta.estado).toBe('Abierta');
    expect(cerrada.estado).toBe('Cerrada');

    expect(cerrada.ventas_por_metodo).toEqual({
      Efectivo: { cantidad: 2, total: 9000 },
      Tarjeta: { cantidad: 1, total: 4500 },
      Transferencia: CERO,
      Fiado: CERO,
      Otro: CERO
    });
    expect(abierta.ventas_por_metodo).toEqual({
      Efectivo: CERO,
      Tarjeta: CERO,
      Transferencia: { cantidad: 1, total: 9000 },
      Fiado: CERO,
      Otro: CERO
    });
    // Sin abonos: todas las claves en cero.
    expect(cerrada.abonos_por_metodo).toEqual({ Efectivo: CERO, Tarjeta: CERO, Transferencia: CERO, Otro: CERO });

    // Lo que ya traía el historial sigue ahí.
    expect(cerrada.vendedor_nombre).toBeTruthy();
    expect(Number(cerrada.monto_cierre_calculado)).toBe(50000 + 9000);
    expect(Number(cerrada.diferencia)).toBe(0);
  });

  it('los abonos de clientes quedan separados por método en la sesión del Administrador que los recibió', async () => {
    const e = await escenario();
    await e.post(e.adminA, '/api/caja/abrir', { monto_apertura: 20000 });
    const cliente = await e.post(e.adminA, '/api/clientes', { nombre: 'Cliente Abono', limite_credito: 0 });
    const id = cliente.body.cliente.id_cliente;
    expect((await e.post(e.adminA, `/api/clientes/${id}/abonos`, { monto: 2000, metodo_pago: 'Efectivo' })).status).toBe(200);
    expect((await e.post(e.adminA, `/api/clientes/${id}/abonos`, { monto: 3000, metodo_pago: 'Transferencia' })).status).toBe(200);
    expect((await e.post(e.adminA, `/api/clientes/${id}/abonos`, { monto: 1500, metodo_pago: 'Efectivo' })).status).toBe(200);

    const r = await e.get(e.adminA, '/api/caja/historial');
    expect(r.body.history).toHaveLength(1);
    expect(r.body.history[0].abonos_por_metodo).toEqual({
      Efectivo: { cantidad: 2, total: 3500 },
      Tarjeta: CERO,
      Transferencia: { cantidad: 1, total: 3000 },
      Otro: CERO
    });
    expect(r.body.history[0].ventas_por_metodo.Efectivo).toEqual(CERO);
  });

  it('una sesión sin ventas tiene el desglose en cero (no falta ninguna clave)', async () => {
    const e = await escenario();
    await e.post(e.tenderoA, '/api/caja/abrir', { monto_apertura: 1000 });
    const r = await e.get(e.adminA, '/api/caja/historial');
    expect(r.body.history).toHaveLength(1);
    expect(r.body.history[0].ventas_por_metodo).toEqual({ Efectivo: CERO, Tarjeta: CERO, Transferencia: CERO, Fiado: CERO, Otro: CERO });
  });
});
