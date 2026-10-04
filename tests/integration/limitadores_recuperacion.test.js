/**
 * @file limitadores_recuperacion.test.js
 * @description Backend para la app nativa del Tendero (rama feat/backend-app-tendero, punto 3):
 *  - P21-09: `/api/verify-reset-code` no tenía ningún limitador: el código de 6 dígitos (un millón de
 *    combinaciones, válido 15 min) se podía adivinar sin límite. Ahora `resetCodeLimiter` permite 5
 *    intentos FALLIDOS por correo cada 15 min, compartidos con `/api/reset-password` (que comprueba el
 *    mismo código).
 *  - P21-13: el `skip` de `globalLimiter` era inerte (comparaba `req.path` con '/api/login', pero bajo
 *    el montaje en '/api/' Express entrega '/login'): /login, /registro y /2fa gastaban también el
 *    presupuesto global. Ahora no.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { contadoresActuales, reiniciarLimitadores } from './helpers/limitadores.js';
import { crearUsuario } from './helpers/fixtures.js';
import { obtenerCsrfToken } from './helpers/sesion.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores();
});

const CODIGO = '123456';

/** Usuario con un código de recuperación vigente (fijado directo en la base: no pasa por el correo). */
async function usuarioConCodigo(overrides = {}) {
  const datos = await crearUsuario(overrides);
  await db.runAsync('UPDATE Usuarios SET reset_token = ?, reset_expires = ? WHERE id_usuario = ?', [CODIGO, Date.now() + 15 * 60 * 1000, datos.id_usuario]);
  return datos;
}
async function anonimo() {
  const agente = request.agent(app);
  return { agente, csrf: await obtenerCsrfToken(agente) };
}
const verificar = (s, email, code) => s.agente.post('/api/verify-reset-code').set('X-CSRF-Token', s.csrf).send({ email, code });
const restablecer = (s, email, code, newPassword = 'NuevaClave456!') =>
  s.agente.post('/api/reset-password').set('X-CSRF-Token', s.csrf).send({ email, code, newPassword });

describe('P21-09: limitador del código de recuperación', () => {
  it('a los 5 intentos fallidos de un correo, el sexto recibe 429 aunque el código sea el correcto, y la contraseña no cambia', async () => {
    const u = await usuarioConCodigo();
    const s = await anonimo();
    for (let i = 0; i < 5; i++) expect((await verificar(s, u.correo, '000000')).status).toBe(400);

    const sexto = await verificar(s, u.correo, CODIGO);
    expect(sexto.status).toBe(429);
    expect(sexto.body).toMatchObject({ success: false });
    expect(sexto.body.error).toMatch(/15 minutos/);

    // El código sigue vigente en la base, pero nadie puede ya usarlo desde este canal: tampoco por reset-password.
    expect((await restablecer(s, u.correo, CODIGO)).status).toBe(429);
    const login = await request(app).post('/api/login').send({ login: u.usuario, password: u.password });
    expect(login.status).toBe(200); // la contraseña original sigue sirviendo
  });

  it('el límite es por correo, no por IP: otro correo desde la misma IP tiene su propio presupuesto', async () => {
    const a = await usuarioConCodigo();
    const b = await usuarioConCodigo();
    const s = await anonimo();
    for (let i = 0; i < 5; i++) await verificar(s, a.correo, '000000');
    expect((await verificar(s, a.correo, CODIGO)).status).toBe(429);

    expect((await verificar(s, b.correo, '000000')).status).toBe(400); // no 429
    expect((await verificar(s, b.correo, CODIGO)).status).toBe(200);
  });

  it('verify-reset-code y reset-password comparten el contador: no se puede adivinar el código por el segundo', async () => {
    const u = await usuarioConCodigo();
    const s = await anonimo();
    for (let i = 0; i < 3; i++) expect((await verificar(s, u.correo, '000000')).status).toBe(400);
    for (let i = 0; i < 2; i++) expect((await restablecer(s, u.correo, '000000')).status).toBe(400);

    expect((await verificar(s, u.correo, CODIGO)).status).toBe(429);
    expect((await restablecer(s, u.correo, CODIGO)).status).toBe(429);
  });

  it('los intentos que aciertan no gastan el presupuesto (flujo normal: verificar y restablecer)', async () => {
    const u = await usuarioConCodigo();
    const s = await anonimo();
    expect((await verificar(s, u.correo, '000000')).status).toBe(400); // un error de dedo
    expect((await verificar(s, u.correo, CODIGO)).status).toBe(200);
    expect((await restablecer(s, u.correo, CODIGO)).status).toBe(200);
    const login = await request(app).post('/api/login').send({ login: u.usuario, password: 'NuevaClave456!' });
    expect(login.status).toBe(200);
  });

  it('el correo se normaliza (mayúsculas y espacios) para el contador, y sin correo cae a la IP', async () => {
    const u = await usuarioConCodigo();
    const s = await anonimo();
    const variantes = [u.correo, u.correo.toUpperCase(), `  ${u.correo}  `, u.correo, u.correo];
    for (const v of variantes) expect((await verificar(s, v, '000000')).status).toBe(400);
    expect((await verificar(s, u.correo, CODIGO)).status).toBe(429); // las 5 variantes contaron como un solo correo

    await reiniciarLimitadores();
    for (let i = 0; i < 5; i++) await s.agente.post('/api/verify-reset-code').set('X-CSRF-Token', s.csrf).send({ code: '000000' });
    expect((await s.agente.post('/api/verify-reset-code').set('X-CSRF-Token', s.csrf).send({ code: '000000' })).status).toBe(429);
  });

  it('un intento fallido deja las cabeceras RateLimit-* para que la app muestre cuántos le quedan', async () => {
    const u = await usuarioConCodigo();
    const s = await anonimo();
    const res = await verificar(s, u.correo, '000000');
    expect(res.status).toBe(400);
    expect(res.headers['ratelimit-limit']).toBe('5');
    expect(res.headers['ratelimit-remaining']).toBe('4');
  });
});

describe('P21-13: el skip del limitador global ya funciona', () => {
  const claveIp = 'ip_127.0.0.1';

  it('POST /api/login y POST /api/2fa/verify NO suman al contador global (siguen contando en el suyo)', async () => {
    await request(app).post('/api/login').send({ login: 'nadie', password: 'x' });
    await request(app).post('/api/2fa/verify').send({ token: '000000' });

    const c = contadoresActuales();
    expect(c.global[claveIp]).toBeUndefined();
    expect(c.auth['127.0.0.1']).toBe(1); // el login fallido sí cuenta en authLimiter
    expect(c['2fa'][claveIp]).toBe(1); // y el 2FA sin sesión, en twoFactorLimiter
  });

  it('POST /api/registro tampoco suma al global, ni una ruta bajo /api/2fa con query', async () => {
    await request(app).post('/api/registro').send({});
    await request(app).post('/api/2fa/verify?x=1').send({ token: '000000' });
    expect(contadoresActuales().global[claveIp]).toBeUndefined();
  });

  it('control: una ruta normal de /api/ SÍ suma al global, y /api/login-falso (prefijo parecido) también', async () => {
    await request(app).get('/api/csrf-token');
    expect(contadoresActuales().global[claveIp]).toBe(1);
    await request(app).get('/api/loginfalso');
    expect(contadoresActuales().global[claveIp]).toBe(2); // solo /api/login exacto o /api/login/... se excluye
  });
});
