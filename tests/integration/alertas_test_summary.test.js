/**
 * @file alertas_test_summary.test.js
 * @description Hallazgo C3 (rama fix/aislamiento-reportes-feedback): POST /api/alertas/test-summary envía correos a la tienda y no exigía Administrador aunque su comentario decía «solo admins». El camino de éxito NO se ejercita a propósito, porque enviaría correos.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { limpiarBaseDePruebas } from './helpers/db.js';
import app from '../../app.js';
import { dosTiendas } from './helpers/tiendas.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

describe('C3. POST /api/alertas/test-summary solo para el Administrador', () => {
  it('un Tendero recibe 403 (y por tanto no se envía ningún correo)', async () => {
    const { tenderoA } = await dosTiendas(app);
    const res = await tenderoA.agente.post('/api/alertas/test-summary').set('X-CSRF-Token', tenderoA.csrfToken);
    expect(res.status).toBe(403);
  });
});
