/**
 * @file caja_historial_autorizacion.test.js
 * @description Quién puede ver el historial de sesiones de caja de la tienda (`GET /api/caja/historial`).
 *
 * Antes la ruta solo exigía sesión: la web escondía la pestaña a los Tenderos, pero la API entregaba el historial de
 * toda la tienda (todos los vendedores y sus montos) a cualquier usuario con sesión. Ahora es solo del Administrador.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { dosTiendas } from './helpers/tiendas.js';

beforeEach(async () => { await limpiarBaseDePruebas(); await reiniciarLimitadores(); });

const JSON_ACCEPT = { Accept: 'application/json' };

describe('GET /api/caja/historial — quién puede verlo', () => {
  it('403 para un Tendero (aunque tenga sesión y caja abierta); 401 sin sesión; el Administrador entra', async () => {
    const t = await dosTiendas(app);
    await t.tenderoA.agente.post('/api/caja/abrir').set('X-CSRF-Token', t.tenderoA.csrfToken).send({ monto_apertura: 1000 });

    const tendero = await t.tenderoA.agente.get('/api/caja/historial').set(JSON_ACCEPT);
    expect(tendero.status).toBe(403);
    expect(tendero.body).toEqual({ error: 'Se requieren permisos de administrador' });

    const anonimo = await request(app).get('/api/caja/historial').set(JSON_ACCEPT);
    expect(anonimo.status).toBe(401);

    const admin = await t.adminA.agente.get('/api/caja/historial').set(JSON_ACCEPT);
    expect(admin.status).toBe(200);
    expect(admin.body.success).toBe(true);
  });

  it('el Administrador de OTRA tienda tampoco ve las sesiones de esta', async () => {
    const t = await dosTiendas(app);
    await t.tenderoA.agente.post('/api/caja/abrir').set('X-CSRF-Token', t.tenderoA.csrfToken).send({ monto_apertura: 1000 });
    const deB = await t.adminB.agente.get('/api/caja/historial').set(JSON_ACCEPT);
    expect(deB.status).toBe(200);
    expect(deB.body.history).toEqual([]);
  });
});
