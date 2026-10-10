/**
 * @file login_refresca_alertas.test.js
 * @description 10-oct-2026. Al ingresar a la app se recalculan las alertas de la tienda, para que el Dashboard no diga
 * «Inventario Óptimo» cuando el Catálogo ya muestra productos críticos (las alertas son una foto guardada y solo se
 * actualizaban con una venta, un movimiento de inventario, crear o editar un producto, recibir una orden o el botón).
 * Cubre los dos caminos de entrada (contraseña sola y contraseña + 2FA), los dos roles, el aislamiento entre tiendas,
 * que un intento fallido NO dispare nada, y que apagar el motor (DISABLE_ALERT_ENGINE) no impida entrar.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';

const JSON_ACCEPT = { Accept: 'application/json' };

beforeEach(async () => {
  await limpiarBaseDePruebas();
});
afterEach(esperarTrabajoEnSegundoPlano);

/** Una tienda con un producto agotado (debe generar «stock_critico») pero SIN ninguna alerta guardada todavía. */
async function tiendaConProductoCritico(rol = 'Administrador') {
  const usuario = await crearUsuario({ rol });
  const id_producto = await crearProducto({ id_tienda: usuario.id_tienda, nombre_producto: 'Arroz agotado', cantidad: 0, stock_seguridad: 5 });
  return { usuario, id_producto };
}

const alertasGuardadas = (id_tienda) => db.allAsync('SELECT tipo FROM Alertas WHERE id_tienda = ? AND resuelta = 0', [id_tienda]);

describe('ingresar a la app recalcula las alertas', () => {
  it('antes de entrar no hay alertas guardadas; al iniciar sesión ya está la de stock crítico (sin esperar ni pulsar nada)', async () => {
    const { usuario } = await tiendaConProductoCritico();
    expect(await alertasGuardadas(usuario.id_tienda)).toHaveLength(0);

    const agente = request.agent(app);
    await iniciarSesion(agente, usuario);

    // Justo después del login, sin esperar trabajo en segundo plano: el Dashboard ya ve la alerta.
    expect((await alertasGuardadas(usuario.id_tienda)).map((a) => a.tipo)).toEqual(['stock_critico']);
    const lista = (await agente.get('/api/alertas').set(JSON_ACCEPT)).body.alerts;
    expect(lista.map((a) => a.tipo)).toEqual(['stock_critico']);
    const stats = (await agente.get('/api/alertas/stats').set(JSON_ACCEPT)).body.stats;
    expect(stats).toEqual({ critico: 1, advertencia: 0, info: 0, total: 1 });
  });

  it('también al entrar como Tendero', async () => {
    const { usuario } = await tiendaConProductoCritico('Tendero');
    await iniciarSesion(request.agent(app), usuario);
    expect((await alertasGuardadas(usuario.id_tienda)).map((a) => a.tipo)).toEqual(['stock_critico']);
  });

  it('también con segundo factor: el recálculo ocurre al COMPLETAR el login con el código, no antes', async () => {
    const { usuario } = await tiendaConProductoCritico('Administrador');
    // Activar el 2FA (con una sesión normal), y volver a empezar con otro agente.
    const config = request.agent(app);
    await iniciarSesion(config, usuario);
    const csrf = await obtenerCsrfToken(config);
    const generar = await config.post('/api/2fa/generate').set('X-CSRF-Token', csrf);
    const secreto = generar.body.secret;
    await config.post('/api/2fa/verify').set('X-CSRF-Token', csrf).send({ token: authenticator.generate(secreto) });
    await db.runAsync('DELETE FROM Alertas WHERE id_tienda = ?', [usuario.id_tienda]); // volver al estado «sin foto»
    expect(await alertasGuardadas(usuario.id_tienda)).toHaveLength(0);

    const agente = request.agent(app);
    const paso1 = await agente.post('/api/login').send({ login: usuario.usuario, password: usuario.password });
    expect(paso1.body.require2FA).toBe(true);
    expect(await alertasGuardadas(usuario.id_tienda)).toHaveLength(0); // aún no entró: nada se recalcula

    const csrf2 = await obtenerCsrfToken(agente);
    const paso2 = await agente.post('/api/2fa/verify').set('X-CSRF-Token', csrf2).send({ token: authenticator.generate(secreto) });
    expect(paso2.status).toBe(200);
    expect((await alertasGuardadas(usuario.id_tienda)).map((a) => a.tipo)).toEqual(['stock_critico']);
  });

  it('un intento fallido (contraseña incorrecta) NO recalcula nada: no se puede disparar el motor sin autenticarse', async () => {
    const { usuario } = await tiendaConProductoCritico();
    const res = await request.agent(app).post('/api/login').send({ login: usuario.usuario, password: 'clave-incorrecta-123' });
    expect(res.status).toBe(401);
    await esperarTrabajoEnSegundoPlano();
    expect(await alertasGuardadas(usuario.id_tienda)).toHaveLength(0);
  });

  it('solo recalcula la tienda que entra: la de otro dueño sigue como estaba', async () => {
    const mia = await tiendaConProductoCritico();
    const ajena = await tiendaConProductoCritico();
    await iniciarSesion(request.agent(app), mia.usuario);
    expect(await alertasGuardadas(mia.usuario.id_tienda)).toHaveLength(1);
    expect(await alertasGuardadas(ajena.usuario.id_tienda)).toHaveLength(0);
  });

  it('con el motor apagado (DISABLE_ALERT_ENGINE=true) se entra igual y no se generan alertas', async () => {
    const { usuario } = await tiendaConProductoCritico();
    const anterior = process.env.DISABLE_ALERT_ENGINE;
    process.env.DISABLE_ALERT_ENGINE = 'true';
    try {
      const res = await request.agent(app).post('/api/login').send({ login: usuario.usuario, password: usuario.password });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    } finally {
      if (anterior === undefined) delete process.env.DISABLE_ALERT_ENGINE; else process.env.DISABLE_ALERT_ENGINE = anterior;
    }
    expect(await alertasGuardadas(usuario.id_tienda)).toHaveLength(0);
  });
});
