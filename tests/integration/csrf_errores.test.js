/**
 * @file csrf_errores.test.js
 * @description C4 (rama feat/backend-app-tendero): un token CSRF faltante o inválido respondía 500
 * («Error interno: invalid csrf token» en desarrollo y un texto genérico en producción), así que ni la
 * web ni la app podían distinguirlo de un fallo real del servidor. Ahora responde 403 con
 * `code: 'CSRF_INVALID'`. También: JSON mal formado → 400 y cuerpo demasiado grande → 413 (antes 500).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { crearUsuario } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores();
});

const cajasAbiertas = async () => Number((await db.getAsync('SELECT COUNT(*) AS n FROM SesionCaja')).n);
const FORMA_CSRF = { success: false, code: 'CSRF_INVALID', error: expect.stringMatching(/csrf-token/) };

describe('C4: CSRF inválido → 403 CSRF_INVALID', () => {
  async function sesion() {
    const u = await crearUsuario({ rol: 'Tendero' });
    const agente = request.agent(app);
    await iniciarSesion(agente, u);
    return { agente, csrf: await obtenerCsrfToken(agente), ...u };
  }

  it('sin token, con un token falso o vacío: 403 y la escritura no se ejecuta', async () => {
    const s = await sesion();
    const sinToken = await s.agente.post('/api/caja/abrir').send({ monto_apertura: 1000 });
    const falso = await s.agente.post('/api/caja/abrir').set('X-CSRF-Token', 'token-falso').send({ monto_apertura: 1000 });
    const vacio = await s.agente.post('/api/caja/abrir').set('X-CSRF-Token', '').send({ monto_apertura: 1000 });
    for (const r of [sinToken, falso, vacio]) {
      expect(r.status).toBe(403);
      expect(r.body).toEqual(FORMA_CSRF);
    }
    expect(await cajasAbiertas()).toBe(0);
  });

  it('el token de OTRA sesión no vale', async () => {
    const a = await sesion();
    const b = await sesion();
    const r = await a.agente.post('/api/caja/abrir').set('X-CSRF-Token', b.csrf).send({ monto_apertura: 1000 });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('CSRF_INVALID');
  });

  it('el token pedido antes del login deja de valer tras él (el login regenera la sesión); uno nuevo sí sirve', async () => {
    const u = await crearUsuario({ rol: 'Tendero' });
    const agente = request.agent(app);
    const antes = await obtenerCsrfToken(agente);
    await agente.post('/api/login').send({ login: u.usuario, password: u.password });

    const conViejo = await agente.post('/api/caja/abrir').set('X-CSRF-Token', antes).send({ monto_apertura: 1000 });
    expect(conViejo.status).toBe(403);
    expect(conViejo.body.code).toBe('CSRF_INVALID');

    const nuevo = await obtenerCsrfToken(agente);
    expect((await agente.post('/api/caja/abrir').set('X-CSRF-Token', nuevo).send({ monto_apertura: 1000 })).status).toBe(200);
  });

  it('PUT, PATCH y DELETE sin token también dan 403; un token válido sigue funcionando; los GET no lo exigen', async () => {
    const s = await sesion();
    const r = [
      await s.agente.put('/api/productos/1/link-barcode').send({ codigo_barras: '1' }),
      await s.agente.patch('/api/alertas/1/resolve').send({}),
      await s.agente.delete('/api/productos/1')
    ];
    expect(r.map((x) => x.status)).toEqual([403, 403, 403]);
    expect((await s.agente.get('/api/caja/sesion').set('Accept', 'application/json')).status).toBe(200);
    expect((await s.agente.post('/api/caja/abrir').set('X-CSRF-Token', s.csrf).send({ monto_apertura: 1 })).status).toBe(200);
  });

  it('un 403 de CSRF no se confunde con un 403 de rol: el de rol sigue siendo { error: "Se requieren permisos de administrador" }', async () => {
    const s = await sesion();
    const rol = await s.agente.post('/api/productos/admin').set('X-CSRF-Token', s.csrf).send({ codigo: 'X' });
    expect(rol.status).toBe(403);
    expect(rol.body).toEqual({ error: 'Se requieren permisos de administrador' });
  });
});

describe('Otros 4xx que antes caían en el 500 genérico', () => {
  it('JSON mal formado → 400 { success:false, error } (login no exige CSRF)', async () => {
    const r = await request(app).post('/api/login').set('Content-Type', 'application/json').send('{"login": "x", ');
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ success: false, error: expect.stringMatching(/JSON/) });
  });

  it('cuerpo de más de 1 MB → 413', async () => {
    const r = await request(app).post('/api/login').set('Content-Type', 'application/json')
      .send(JSON.stringify({ login: 'x'.repeat(1.2 * 1024 * 1024), password: 'y' }));
    expect(r.status).toBe(413);
    expect(r.body).toEqual({ success: false, error: expect.stringMatching(/demasiado grande/) });
  });
});
