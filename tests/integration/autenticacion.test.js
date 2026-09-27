/**
 * @file autenticacion.test.js
 * @description Flujo prioritario 6/7 (plan 20, Nivel 2): login, sesión, logout y bloqueo de
 * sesión concurrente contra Postgres real (stockpilot_test). Usa supertest sobre la app real
 * (app.js) — mismo Express, mismas rutas, mismos middlewares (sesión, CSRF, rate limit) que en
 * producción; solo cambia la base de datos y las credenciales externas (ver .env.test).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario } from './helpers/fixtures.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

describe('Autenticación', () => {
  it('login con credenciales correctas: 200, éxito, y la sesión queda funcional para pedir datos protegidos', async () => {
    const { usuario, password, id_usuario, id_tienda } = await crearUsuario({ rol: 'Administrador' });
    const agente = request.agent(app);

    const login = await agente.post('/api/login').send({ login: usuario, password });
    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);

    const sesion = await agente.get('/api/session-info');
    expect(sesion.status).toBe(200);
    expect(sesion.body.userId).toBe(id_usuario);
    expect(sesion.body.tiendaId).toBe(id_tienda);
  });

  it('login con contraseña incorrecta: 401, sin crear sesión', async () => {
    const { usuario } = await crearUsuario();
    const res = await request(app).post('/api/login').send({ login: usuario, password: 'clave-equivocada' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('login con usuario inexistente: mismo 401 que contraseña incorrecta (no filtra si el usuario existe)', async () => {
    const noExiste = await request(app).post('/api/login').send({ login: 'no_existe_de_verdad', password: 'lo-que-sea' });
    const incorrecta = await (async () => {
      const { usuario } = await crearUsuario();
      return request(app).post('/api/login').send({ login: usuario, password: 'clave-equivocada' });
    })();
    expect(noExiste.status).toBe(incorrecta.status);
    expect(noExiste.body.error).toBe(incorrecta.body.error);
  });

  it('login sin campos obligatorios: 400 (rechazado por validación, ni siquiera consulta la base)', async () => {
    const res = await request(app).post('/api/login').send({ login: 'alguien' });
    expect(res.status).toBe(400);
  });

  it('sin sesión: un endpoint que requiere login da 401 (no redirige, porque se pide JSON)', async () => {
    const res = await request(app).get('/api/caja/sesion').set('Accept', 'application/json');
    expect(res.status).toBe(401);
  });

  it('con sesión: el mismo endpoint protegido responde 200', async () => {
    const { usuario, password } = await crearUsuario();
    const agente = request.agent(app);
    await agente.post('/api/login').send({ login: usuario, password });

    const res = await agente.get('/api/caja/sesion').set('Accept', 'application/json');
    expect(res.status).toBe(200);
  });

  it('logout: cierra la sesión y el endpoint protegido vuelve a dar 401', async () => {
    const { usuario, password } = await crearUsuario();
    const agente = request.agent(app);
    await agente.post('/api/login').send({ login: usuario, password });

    const csrf = await agente.get('/api/csrf-token');
    const logout = await agente.post('/api/logout').set('X-CSRF-Token', csrf.body.csrfToken);
    expect(logout.status).toBe(200);

    const sesion = await agente.get('/api/caja/sesion').set('Accept', 'application/json');
    expect(sesion.status).toBe(401);
  });

  it('Tendero: un segundo login sin "force" queda bloqueado con 409 SESSION_ACTIVE mientras la primera sesión sigue activa', async () => {
    const { usuario, password } = await crearUsuario({ rol: 'Tendero' });

    const dispositivo1 = request.agent(app);
    const primerLogin = await dispositivo1.post('/api/login').send({ login: usuario, password });
    expect(primerLogin.status).toBe(200);

    const dispositivo2 = request.agent(app);
    const segundoLogin = await dispositivo2.post('/api/login').send({ login: usuario, password });
    expect(segundoLogin.status).toBe(409);
    expect(segundoLogin.body.code).toBe('SESSION_ACTIVE');
  });

  it('Tendero: el segundo login SÍ pasa con force:true, y la primera sesión queda invalidada de verdad', async () => {
    const { usuario, password } = await crearUsuario({ rol: 'Tendero' });

    const dispositivo1 = request.agent(app);
    await dispositivo1.post('/api/login').send({ login: usuario, password });

    const dispositivo2 = request.agent(app);
    const segundoLogin = await dispositivo2.post('/api/login').send({ login: usuario, password, force: true });
    expect(segundoLogin.status).toBe(200);

    // La sesión del dispositivo 1 sigue teniendo la cookie local, pero requireLogin debe detectar
    // que ya no es la sesión "actual" del usuario (User.verifyCurrentSession) y rechazarla.
    const dispositivo1DespuesDeForzar = await dispositivo1.get('/api/caja/sesion').set('Accept', 'application/json');
    expect(dispositivo1DespuesDeForzar.status).toBe(401);
    expect(dispositivo1DespuesDeForzar.body.code).toBe('CONCURRENT_SESSION');

    // La sesión del dispositivo 2 (la que forzó) sí debe seguir funcionando.
    const dispositivo2FuncionaOk = await dispositivo2.get('/api/caja/sesion').set('Accept', 'application/json');
    expect(dispositivo2FuncionaOk.status).toBe(200);
  });

  it('Administrador: puede tener varias sesiones activas a la vez, sin bloqueo (a diferencia de Tendero)', async () => {
    const { usuario, password } = await crearUsuario({ rol: 'Administrador' });

    const dispositivo1 = request.agent(app);
    const primerLogin = await dispositivo1.post('/api/login').send({ login: usuario, password });
    expect(primerLogin.status).toBe(200);

    const dispositivo2 = request.agent(app);
    const segundoLogin = await dispositivo2.post('/api/login').send({ login: usuario, password });
    expect(segundoLogin.status).toBe(200);

    // Ambas sesiones deben seguir siendo válidas (evaluarAcceso: Administrador siempre pasa).
    const d1 = await dispositivo1.get('/api/caja/sesion').set('Accept', 'application/json');
    const d2 = await dispositivo2.get('/api/caja/sesion').set('Accept', 'application/json');
    expect(d1.status).toBe(200);
    expect(d2.status).toBe(200);
  });
});
