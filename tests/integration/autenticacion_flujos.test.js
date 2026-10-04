/**
 * @file autenticacion_flujos.test.js
 * @description Pruebas de caracterización (plan 21, R0): 2FA, restablecer contraseña por correo
 * y cambiar contraseña. `autenticacion.test.js` ya cubre login/sesión (10 pruebas); este archivo
 * no las repite.
 *
 * Presupuesto de limitadores (requisito explícito del usuario, ver plan 21 R0):
 * - `/api/reset-password` cae bajo `authLimiter` (10/15min, compartido con /login, /registro,
 *   /forgot-password). Este archivo solo le agrega 1 intento fallido (código incorrecto). Sumado
 *   a los 5 que ya consume `autenticacion.test.js`, quedan 6/10: sin riesgo de 429.
 * - `/api/2fa/verify` cae bajo `twoFactorLimiter` (5/15min), pero se llevó la cuenta por
 *   `user_<id>` cuando hay sesión (que es como se prueba aquí) — cada prueba usa un usuario nuevo,
 *   así que ni siquiera comparten presupuesto entre sí.
 * - `/api/verify-reset-code` y `/api/reset-password` comparten `resetCodeLimiter` (5 fallos por correo
 *   cada 15 min; P21-09, corregido en feat/backend-app-tendero y probado a fondo en
 *   limitadores_recuperacion.test.js). Aquí cada prueba usa un correo nuevo y falla como mucho una vez.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { authenticator } from 'otplib';
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

describe('2FA', () => {
  it('generate2FA: devuelve un secreto y un QR (data URL)', async () => {
    const { agente, csrfToken } = await agenteLogueado();
    const res = await agente.post('/api/2fa/generate').set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.secret).toBeTruthy();
    expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
  });

  it('verify2FA (habilitar desde el perfil): un token TOTP válido activa el 2FA', async () => {
    const { agente, csrfToken, id_usuario } = await agenteLogueado();
    const generar = await agente.post('/api/2fa/generate').set('X-CSRF-Token', csrfToken);
    const token = authenticator.generate(generar.body.secret);

    const res = await agente.post('/api/2fa/verify').set('X-CSRF-Token', csrfToken).send({ token });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const fila = await db.getAsync('SELECT two_factor_enabled FROM Usuarios WHERE id_usuario = ?', [id_usuario]);
    expect(fila.two_factor_enabled).toBe(true);
  });

  it('verify2FA: un token inválido da 401 y no activa el 2FA', async () => {
    const { agente, csrfToken, id_usuario } = await agenteLogueado();
    await agente.post('/api/2fa/generate').set('X-CSRF-Token', csrfToken);

    const res = await agente.post('/api/2fa/verify').set('X-CSRF-Token', csrfToken).send({ token: '000000' });
    expect(res.status).toBe(401);

    const fila = await db.getAsync('SELECT two_factor_enabled FROM Usuarios WHERE id_usuario = ?', [id_usuario]);
    expect(fila.two_factor_enabled).toBe(false);
  });

  it('login con 2FA ya activado: el login no abre sesión de una, exige verify2FA para completarla', async () => {
    const setup = await agenteLogueado();
    const generar = await setup.agente.post('/api/2fa/generate').set('X-CSRF-Token', setup.csrfToken);
    await setup.agente.post('/api/2fa/verify').set('X-CSRF-Token', setup.csrfToken).send({ token: authenticator.generate(generar.body.secret) });

    // Sesión nueva, sin las cookies de arriba: simula un segundo intento de login normal.
    const nuevaSesion = request.agent(app);
    const login = await nuevaSesion.post('/api/login').send({ login: setup.usuario, password: setup.password });
    expect(login.status).toBe(200);
    expect(login.body.require2FA).toBe(true);

    // Sin completar el 2FA, la sesión NO puede ver el perfil todavía.
    const perfilSinCompletar = await nuevaSesion.get('/api/perfil');
    expect(perfilSinCompletar.status).toBe(401);

    const csrfToken = await obtenerCsrfToken(nuevaSesion);
    const completar = await nuevaSesion.post('/api/2fa/verify').set('X-CSRF-Token', csrfToken)
      .send({ token: authenticator.generate(generar.body.secret) });
    expect(completar.status).toBe(200);
    expect(completar.body.success).toBe(true);

    const perfilCompletado = await nuevaSesion.get('/api/perfil');
    expect(perfilCompletado.status).toBe(200);
  });

  it('disable2FA: bloqueado para Administrador (403), aunque la contraseña sea correcta', async () => {
    const { agente, csrfToken, password } = await agenteLogueado({ rol: 'Administrador' });
    const generar = await agente.post('/api/2fa/generate').set('X-CSRF-Token', csrfToken);
    await agente.post('/api/2fa/verify').set('X-CSRF-Token', csrfToken).send({ token: authenticator.generate(generar.body.secret) });

    const res = await agente.post('/api/2fa/disable').set('X-CSRF-Token', csrfToken).send({ password });
    expect(res.status).toBe(403);
  });

  it('disable2FA: un Tendero con la contraseña correcta sí puede desactivarlo', async () => {
    const { agente, csrfToken, password, id_usuario } = await agenteLogueado({ rol: 'Tendero' });
    const generar = await agente.post('/api/2fa/generate').set('X-CSRF-Token', csrfToken);
    await agente.post('/api/2fa/verify').set('X-CSRF-Token', csrfToken).send({ token: authenticator.generate(generar.body.secret) });

    const res = await agente.post('/api/2fa/disable').set('X-CSRF-Token', csrfToken).send({ password });
    expect(res.status).toBe(200);

    const fila = await db.getAsync('SELECT two_factor_enabled FROM Usuarios WHERE id_usuario = ?', [id_usuario]);
    expect(fila.two_factor_enabled).toBe(false);
  });
});

describe('Restablecer contraseña por correo', () => {
  // /api/forgot-password, /api/verify-reset-code y /api/reset-password exigen CSRF igual que
  // cualquier otra ruta de estado (no están en la lista de excepciones de app.js), así que hace
  // falta un agente con cookie de sesión (aunque no haya login) para poder pedir el token.
  async function agenteAnonimo() {
    const agente = request.agent(app);
    const csrfToken = await obtenerCsrfToken(agente);
    return { agente, csrfToken };
  }

  it('flujo completo: forgot-password → verify-reset-code → reset-password, y la contraseña vieja deja de servir', async () => {
    const datos = await crearUsuario();
    const { agente, csrfToken } = await agenteAnonimo();

    const olvido = await agente.post('/api/forgot-password').set('X-CSRF-Token', csrfToken).send({ email: datos.correo });
    expect(olvido.status).toBe(200);

    const fila = await db.getAsync('SELECT reset_token FROM Usuarios WHERE id_usuario = ?', [datos.id_usuario]);
    const codigo = fila.reset_token;
    expect(codigo).toMatch(/^\d{6}$/);

    const verificar = await agente.post('/api/verify-reset-code').set('X-CSRF-Token', csrfToken).send({ email: datos.correo, code: codigo });
    expect(verificar.status).toBe(200);

    const restablecer = await agente.post('/api/reset-password').set('X-CSRF-Token', csrfToken).send({ email: datos.correo, code: codigo, newPassword: 'NuevaClave456!' });
    expect(restablecer.status).toBe(200);

    const loginViejo = await request(app).post('/api/login').send({ login: datos.usuario, password: datos.password });
    expect(loginViejo.status).toBe(401);

    const loginNuevo = await request(app).post('/api/login').send({ login: datos.usuario, password: 'NuevaClave456!' });
    expect(loginNuevo.status).toBe(200);
  });

  it('verify-reset-code con un código incorrecto: 400 (el limitador por correo se prueba en limitadores_recuperacion.test.js)', async () => {
    const datos = await crearUsuario();
    const { agente, csrfToken } = await agenteAnonimo();
    await agente.post('/api/forgot-password').set('X-CSRF-Token', csrfToken).send({ email: datos.correo });

    const res = await agente.post('/api/verify-reset-code').set('X-CSRF-Token', csrfToken).send({ email: datos.correo, code: '000000' });
    expect(res.status).toBe(400);
  });

  it('reset-password con un código incorrecto: 400 y la contraseña original sigue funcionando', async () => {
    const datos = await crearUsuario();
    const { agente, csrfToken } = await agenteAnonimo();
    await agente.post('/api/forgot-password').set('X-CSRF-Token', csrfToken).send({ email: datos.correo });

    const res = await agente.post('/api/reset-password').set('X-CSRF-Token', csrfToken).send({ email: datos.correo, code: '000000', newPassword: 'OtraClave789!' });
    expect(res.status).toBe(400);

    const login = await request(app).post('/api/login').send({ login: datos.usuario, password: datos.password });
    expect(login.status).toBe(200);
  });

  it('forgot-password con un correo que no existe: responde success:true igual (no filtra si el correo está registrado)', async () => {
    const { agente, csrfToken } = await agenteAnonimo();
    const res = await agente.post('/api/forgot-password').set('X-CSRF-Token', csrfToken).send({ email: 'no-existe-de-verdad@test.local' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Cambiar contraseña', () => {
  it('changePassword: contraseña actual correcta, cambia y la nueva sirve para loguear', async () => {
    const { agente, csrfToken, usuario, password } = await agenteLogueado();
    const res = await agente.put('/api/perfil/password').set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: password, newPassword: 'ClaveDistinta999!' });
    expect(res.status).toBe(200);

    const login = await request(app).post('/api/login').send({ login: usuario, password: 'ClaveDistinta999!' });
    expect(login.status).toBe(200);
  });

  it('changePassword: contraseña actual incorrecta da 400 y no cambia nada', async () => {
    const { agente, csrfToken, usuario, password } = await agenteLogueado();
    const res = await agente.put('/api/perfil/password').set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: 'clave-equivocada', newPassword: 'ClaveDistinta999!' });
    expect(res.status).toBe(400);

    const login = await request(app).post('/api/login').send({ login: usuario, password });
    expect(login.status).toBe(200);
  });

  it('changePassword: la nueva contraseña igual a la actual da 400', async () => {
    const { agente, csrfToken, password } = await agenteLogueado();
    const res = await agente.put('/api/perfil/password').set('X-CSRF-Token', csrfToken)
      .send({ currentPassword: password, newPassword: password });
    expect(res.status).toBe(400);
  });

  it('firstPasswordChange: sin cambio_clave_forzoso en la sesión, da 400 (no se puede usar como atajo)', async () => {
    const { agente, csrfToken } = await agenteLogueado({ cambio_clave_forzoso: false });
    const res = await agente.put('/api/perfil/first-password').set('X-CSRF-Token', csrfToken).send({ newPassword: 'ClaveDistinta999!' });
    expect(res.status).toBe(400);
  });

  it('firstPasswordChange: con cambio_clave_forzoso activo, establece la contraseña y apaga la bandera', async () => {
    const datos = await crearUsuario({ cambio_clave_forzoso: true });
    const agente = request.agent(app);
    const login = await agente.post('/api/login').send({ login: datos.usuario, password: datos.password });
    expect(login.body.user.cambioClaveForzoso).toBe(true);
    const csrfToken = await obtenerCsrfToken(agente);

    const res = await agente.put('/api/perfil/first-password').set('X-CSRF-Token', csrfToken).send({ newPassword: 'ClaveDistinta999!' });
    expect(res.status).toBe(200);

    const sesion = await agente.get('/api/session-info');
    expect(sesion.body.cambioClaveForzoso).toBe(false);
  });
});
