/**
 * @file caja.test.js
 * @description Flujo prioritario 2/7 (plan 20, Nivel 2): apertura/cierre de caja, egresos y
 * descuadre, contra Postgres real.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

async function agenteLogueado(overrides = {}) {
  const datosUsuario = await crearUsuario(overrides);
  const agente = request.agent(app);
  await iniciarSesion(agente, datosUsuario);
  const csrfToken = await obtenerCsrfToken(agente);
  return { agente, csrfToken, ...datosUsuario };
}

describe('Caja', () => {
  it('abrir caja: éxito, y /api/caja/sesion refleja active:true', async () => {
    const { agente, csrfToken } = await agenteLogueado({ rol: 'Tendero' });

    const abrir = await agente.post('/api/caja/abrir').set('X-CSRF-Token', csrfToken).send({ monto_apertura: 50000 });
    expect(abrir.status).toBe(200);
    expect(abrir.body.success).toBe(true);

    const sesion = await agente.get('/api/caja/sesion').set('Accept', 'application/json');
    expect(sesion.body.active).toBe(true);
  });

  it('abrir caja dos veces seguidas: la segunda da 400 (ya hay una abierta)', async () => {
    const { agente, csrfToken } = await agenteLogueado({ rol: 'Tendero' });

    const primera = await agente.post('/api/caja/abrir').set('X-CSRF-Token', csrfToken).send({ monto_apertura: 50000 });
    expect(primera.status).toBe(200);

    const segunda = await agente.post('/api/caja/abrir').set('X-CSRF-Token', csrfToken).send({ monto_apertura: 30000 });
    expect(segunda.status).toBe(400);
  });

  it('5 aperturas de caja simultáneas del mismo vendedor: nunca deben quedar 2+ sesiones abiertas a la vez', async () => {
    const { agente, csrfToken, id_tienda, id_usuario } = await agenteLogueado({ rol: 'Tendero' });

    const pedidos = Array.from({ length: 5 }, () =>
      agente.post('/api/caja/abrir').set('X-CSRF-Token', csrfToken).send({ monto_apertura: 50000 })
    );
    const resultados = await Promise.all(pedidos);

    const sesionesAbiertas = await db.allAsync(
      `SELECT id_sesion FROM SesionCaja WHERE id_tienda = ? AND id_vendedor = ? AND estado = 'Abierta'`,
      [id_tienda, id_usuario]
    );

    console.log('DIAGNÓSTICO apertura concurrente de caja (5x):', {
      estados: resultados.map(r => r.status),
      sesiones_abiertas_en_bd: sesionesAbiertas.length
    });

    expect(sesionesAbiertas.length).toBe(1);
  });

  it('cerrar caja sin haberla abierto: 400', async () => {
    const { agente, csrfToken } = await agenteLogueado({ rol: 'Tendero' });
    const res = await agente.post('/api/caja/cerrar').set('X-CSRF-Token', csrfToken).send({ monto_cierre_declarado: 50000 });
    expect(res.status).toBe(400);
  });

  it('cerrar caja sin descuadre (declarado = apertura, sin ventas/egresos): no genera notificación', async () => {
    const { agente, csrfToken, id_usuario } = await agenteLogueado({ rol: 'Tendero' });
    await agente.post('/api/caja/abrir').set('X-CSRF-Token', csrfToken).send({ monto_apertura: 50000 });

    const cerrar = await agente.post('/api/caja/cerrar').set('X-CSRF-Token', csrfToken).send({ monto_cierre_declarado: 50000 });
    expect(cerrar.status).toBe(200);
    expect(cerrar.body.arqueo.diferencia).toBe(0);

    const notifs = await db.allAsync(
      `SELECT * FROM NotificacionesUsuario WHERE id_usuario = ? AND tipo = 'descuadre_caja'`,
      [id_usuario]
    );
    expect(notifs.length).toBe(0);
  });

  it('cerrar caja con descuadre significativo (>$5.000): genera notificación de faltante', async () => {
    const { agente, csrfToken, id_usuario } = await agenteLogueado({ rol: 'Tendero' });
    await agente.post('/api/caja/abrir').set('X-CSRF-Token', csrfToken).send({ monto_apertura: 50000 });

    // Declara 10.000 menos de lo que debería haber (50.000 de apertura, nada más se movió).
    const cerrar = await agente.post('/api/caja/cerrar').set('X-CSRF-Token', csrfToken).send({ monto_cierre_declarado: 40000 });
    expect(cerrar.status).toBe(200);
    expect(cerrar.body.arqueo.diferencia).toBe(-10000);

    const notifs = await db.allAsync(
      `SELECT * FROM NotificacionesUsuario WHERE id_usuario = ? AND tipo = 'descuadre_caja'`,
      [id_usuario]
    );
    expect(notifs.length).toBe(1);
    expect(notifs[0].titulo).toMatch(/Faltante/);
  });

  it('Tendero: registrar un egreso dentro del límite de la tienda, éxito', async () => {
    const { agente, csrfToken } = await agenteLogueado({ rol: 'Tendero' });
    await agente.post('/api/caja/abrir').set('X-CSRF-Token', csrfToken).send({ monto_apertura: 50000 });

    const egreso = await agente.post('/api/caja/egreso').set('X-CSRF-Token', csrfToken)
      .send({ monto: 20000, motivo: 'Compra de bolsas para empacar' });
    expect(egreso.status).toBe(200);
    expect(egreso.body.success).toBe(true);
  });

  it('Tendero: un egreso por encima del límite de la tienda (default $150.000) se rechaza', async () => {
    const { agente, csrfToken } = await agenteLogueado({ rol: 'Tendero' });
    await agente.post('/api/caja/abrir').set('X-CSRF-Token', csrfToken).send({ monto_apertura: 200000 });

    const egreso = await agente.post('/api/caja/egreso').set('X-CSRF-Token', csrfToken)
      .send({ monto: 160000, motivo: 'Un gasto sospechosamente grande' });
    expect(egreso.status).toBe(400);
    expect(egreso.body.error).toMatch(/no permite registrar gastos/i);
  });

  it('Administrador: no tiene límite de egreso (puede registrar más del tope de Tendero)', async () => {
    const { agente, csrfToken } = await agenteLogueado({ rol: 'Administrador' });
    await agente.post('/api/caja/abrir').set('X-CSRF-Token', csrfToken).send({ monto_apertura: 500000 });

    const egreso = await agente.post('/api/caja/egreso').set('X-CSRF-Token', csrfToken)
      .send({ monto: 300000, motivo: 'Pago a proveedor grande' });
    expect(egreso.status).toBe(200);
  });

  it('egreso sin caja abierta: 400', async () => {
    const { agente, csrfToken } = await agenteLogueado({ rol: 'Tendero' });
    const egreso = await agente.post('/api/caja/egreso').set('X-CSRF-Token', csrfToken)
      .send({ monto: 5000, motivo: 'Sin caja abierta' });
    expect(egreso.status).toBe(400);
  });
});
