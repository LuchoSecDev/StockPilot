/**
 * @file ultimo_acceso.test.js
 * @description `Usuarios.ultimo_acceso` alimenta la columna «último acceso» del panel interno (plan 22). Se anota al
 * COMPLETAR un inicio de sesión —directo, o tras el segundo factor—, nunca por petición ni con un intento fallido.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { authenticator } from 'otplib';
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

const acceso = async (id) => (await db.getAsync('SELECT ultimo_acceso FROM Usuarios WHERE id_usuario = ?', [id])).ultimo_acceso;

describe('Usuarios.ultimo_acceso', () => {
  it('una cuenta que nunca entró lo tiene vacío', async () => {
    const u = await crearUsuario();
    expect(await acceso(u.id_usuario)).toBeNull();
  });

  it('el inicio de sesión directo lo anota (con la hora actual)', async () => {
    const u = await crearUsuario();
    const agente = request.agent(app);

    await iniciarSesion(agente, u);

    const cuando = await acceso(u.id_usuario);
    expect(cuando).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - cuando.getTime())).toBeLessThan(60_000);
  });

  it('una contraseña incorrecta NO lo anota', async () => {
    const u = await crearUsuario();

    const r = await request.agent(app).post('/api/login').send({ login: u.usuario, password: 'incorrecta' });

    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(await acceso(u.id_usuario)).toBeNull();
  });

  it('con 2FA activo: la contraseña sola NO lo anota; se anota al completar el segundo factor', async () => {
    const u = await crearUsuario();
    const secreto = authenticator.generateSecret();
    await db.runAsync('UPDATE Usuarios SET two_factor_enabled = true, two_factor_secret = ? WHERE id_usuario = ?', [secreto, u.id_usuario]);
    const agente = request.agent(app);

    const login = await agente.post('/api/login').send({ login: u.usuario, password: u.password });
    expect(login.body.require2FA).toBe(true);
    expect(await acceso(u.id_usuario)).toBeNull();

    const csrf = await obtenerCsrfToken(agente);
    const completar = await agente.post('/api/2fa/verify').set('X-CSRF-Token', csrf).send({ token: authenticator.generate(secreto) });
    expect(completar.status).toBe(200);

    expect(await acceso(u.id_usuario)).toBeInstanceOf(Date);
  });

  it('las peticiones posteriores NO lo mueven (no multiplica las escrituras)', async () => {
    const u = await crearUsuario();
    const agente = request.agent(app);
    await iniciarSesion(agente, u);
    const primero = await acceso(u.id_usuario);

    await agente.get('/api/session-info');
    await agente.get('/api/productos');

    expect((await acceso(u.id_usuario)).getTime()).toBe(primero.getTime());
  });
});
