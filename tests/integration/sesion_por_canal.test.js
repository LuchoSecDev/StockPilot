/**
 * @file sesion_por_canal.test.js
 * @description Backend para la app nativa del Tendero (rama feat/backend-app-tendero, punto 1; plan 07,
 * sección 6.3): el candado de sesión única es POR CANAL. El login con `X-Canal: app` usa la columna
 * `Usuarios.session_id_app`; sin la cabecera todo sigue como siempre con `session_id` (canal web).
 * El 409 SESSION_ACTIVE y `force` valen solo dentro del mismo canal. El Administrador no tiene candado.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { crearUsuario } from './helpers/fixtures.js';
import { obtenerCsrfToken } from './helpers/sesion.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores(); // varios 409 seguidos gastarían el presupuesto del authLimiter
});

/** Login sin lanzar: devuelve {agente, res}. canal 'app' manda X-Canal: app; undefined no manda cabecera. */
async function entrar(usuario, { canal, force, cabecera } = {}) {
  const agente = request.agent(app);
  let peticion = agente.post('/api/login');
  const valorCabecera = cabecera ?? (canal === 'app' ? 'app' : undefined);
  if (valorCabecera !== undefined) peticion = peticion.set('X-Canal', valorCabecera);
  const res = await peticion.send({ login: usuario.usuario, password: usuario.password, ...(force ? { force: true } : {}) });
  return { agente, res };
}

/** Una petición protegida por requireLogin (no toca datos). */
const sesionValida = async (agente) => (await agente.get('/api/caja/sesion').set('Accept', 'application/json')).status;
const columnas = (id) => db.getAsync('SELECT session_id, session_id_app FROM Usuarios WHERE id_usuario = ?', [id]);

describe('Sesión por canal (Tendero): web y app a la vez', () => {
  it('web y app a la vez: las dos sesiones son válidas y cada una guarda su candado en su columna', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    const web = await entrar(t);
    const app_ = await entrar(t, { canal: 'app' });
    expect(web.res.status).toBe(200);
    expect(app_.res.status).toBe(200);

    expect(await sesionValida(web.agente)).toBe(200);
    expect(await sesionValida(app_.agente)).toBe(200);

    const fila = await columnas(t.id_usuario);
    expect(fila.session_id).toBeTruthy();
    expect(fila.session_id_app).toBeTruthy();
    expect(fila.session_id).not.toBe(fila.session_id_app);
  });

  it('solo la app: el candado queda en session_id_app y session_id sigue vacío (y viceversa)', async () => {
    const soloApp = await crearUsuario({ rol: 'Tendero' });
    await entrar(soloApp, { canal: 'app' });
    expect(await columnas(soloApp.id_usuario)).toMatchObject({ session_id: null });
    expect((await columnas(soloApp.id_usuario)).session_id_app).toBeTruthy();

    const soloWeb = await crearUsuario({ rol: 'Tendero' });
    await entrar(soloWeb);
    expect(await columnas(soloWeb.id_usuario)).toMatchObject({ session_id_app: null });
    expect((await columnas(soloWeb.id_usuario)).session_id).toBeTruthy();
  });

  it('un segundo login en el MISMO canal da 409 SESSION_ACTIVE, en web y en app, sin tocar la sesión vigente', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    const web1 = await entrar(t);
    const app1 = await entrar(t, { canal: 'app' });

    const web2 = await entrar(t);
    const app2 = await entrar(t, { canal: 'app' });
    for (const intento of [web2, app2]) {
      expect(intento.res.status).toBe(409);
      expect(intento.res.body.code).toBe('SESSION_ACTIVE');
    }
    // Las dos sesiones originales siguen vivas.
    expect(await sesionValida(web1.agente)).toBe(200);
    expect(await sesionValida(app1.agente)).toBe(200);
  });

  it('el candado de un canal no bloquea el otro: con web abierta, la app entra sin force (y al revés)', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    await entrar(t);
    expect((await entrar(t, { canal: 'app' })).res.status).toBe(200);

    const u = await crearUsuario({ rol: 'Tendero' });
    await entrar(u, { canal: 'app' });
    expect((await entrar(u)).res.status).toBe(200);
  });

  it('force en la app invalida SOLO la sesión app anterior; la web sigue válida', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    const web = await entrar(t);
    const appVieja = await entrar(t, { canal: 'app' });
    const appNueva = await entrar(t, { canal: 'app', force: true });
    expect(appNueva.res.status).toBe(200);

    expect(await sesionValida(appNueva.agente)).toBe(200);
    expect(await sesionValida(web.agente)).toBe(200);
    const vieja = await appVieja.agente.get('/api/caja/sesion').set('Accept', 'application/json');
    expect(vieja.status).toBe(401);
    expect(vieja.body.code).toBe('CONCURRENT_SESSION');
  });

  it('force en la web invalida SOLO la sesión web anterior; la app sigue válida', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    const webVieja = await entrar(t);
    const app_ = await entrar(t, { canal: 'app' });
    const webNueva = await entrar(t, { force: true });
    expect(webNueva.res.status).toBe(200);

    expect(await sesionValida(webNueva.agente)).toBe(200);
    expect(await sesionValida(app_.agente)).toBe(200);
    const vieja = await webVieja.agente.get('/api/caja/sesion').set('Accept', 'application/json');
    expect(vieja.status).toBe(401);
    expect(vieja.body.code).toBe('CONCURRENT_SESSION');
  });

  it('force sin sesión previa en ese canal no hace nada raro: entra normal', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    const web = await entrar(t);
    const appForzada = await entrar(t, { canal: 'app', force: true });
    expect(appForzada.res.status).toBe(200);
    expect(await sesionValida(web.agente)).toBe(200);
    expect(await sesionValida(appForzada.agente)).toBe(200);
  });
});

describe('Sesión por canal: cabecera X-Canal', () => {
  it('«App» y « app » (mayúsculas, espacios) cuentan como app; cualquier otro valor cuenta como web', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    expect((await entrar(t, { cabecera: ' App ' })).res.status).toBe(200);
    expect((await columnas(t.id_usuario)).session_id_app).toBeTruthy();
    expect((await columnas(t.id_usuario)).session_id).toBeNull();

    // «xyz», «web» y la cabecera vacía caen en el canal web: la primera entra, la segunda choca con ella.
    expect((await entrar(t, { cabecera: 'xyz' })).res.status).toBe(200);
    const segunda = await entrar(t, { cabecera: 'web' });
    expect(segunda.res.status).toBe(409);
    expect((await entrar(t, { cabecera: '' })).res.status).toBe(409);
  });

  it('la cabecera solo se lee en el login: una petición posterior con otro X-Canal no cambia el canal de la sesión', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    const web = await entrar(t);
    const respuesta = await web.agente.get('/api/caja/sesion').set('Accept', 'application/json').set('X-Canal', 'app');
    expect(respuesta.status).toBe(200); // sigue validándose contra session_id (web), no contra session_id_app
  });
});

describe('Sesión por canal: logout', () => {
  it('el logout de la app libera solo session_id_app; la web sigue válida y la app puede volver a entrar sin force', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    const web = await entrar(t);
    const app_ = await entrar(t, { canal: 'app' });

    const csrf = await obtenerCsrfToken(app_.agente);
    const salida = await app_.agente.post('/api/logout').set('X-CSRF-Token', csrf);
    expect(salida.status).toBe(200);

    const fila = await columnas(t.id_usuario);
    expect(fila.session_id_app).toBeNull();
    expect(fila.session_id).toBeTruthy();
    expect(await sesionValida(web.agente)).toBe(200);
    expect((await entrar(t, { canal: 'app' })).res.status).toBe(200);
  });

  it('el logout de la web libera solo session_id; la app sigue válida', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    const web = await entrar(t);
    const app_ = await entrar(t, { canal: 'app' });

    const csrf = await obtenerCsrfToken(web.agente);
    expect((await web.agente.post('/api/logout').set('X-CSRF-Token', csrf)).status).toBe(200);

    const fila = await columnas(t.id_usuario);
    expect(fila.session_id).toBeNull();
    expect(fila.session_id_app).toBeTruthy();
    expect(await sesionValida(app_.agente)).toBe(200);
  });

  it('una sesión vieja invalidada por force que hace logout NO borra el candado de la sesión nueva', async () => {
    // Antes de este cambio el logout ponía el candado en NULL sin mirar de quién era: la sesión vieja
    // tumbaba a la nueva (que pasaba a recibir 401 CONCURRENT_SESSION en su siguiente petición).
    for (const canal of ['web', 'app']) {
      const t = await crearUsuario({ rol: 'Tendero' });
      const vieja = await entrar(t, { canal });
      const nueva = await entrar(t, { canal, force: true });

      const csrf = await obtenerCsrfToken(vieja.agente).catch(() => null);
      // La sesión vieja ya fue invalidada: el token puede no obtenerse. El logout no exige CSRF ni login.
      await vieja.agente.post('/api/logout').set('X-CSRF-Token', csrf || 'x');

      expect(await sesionValida(nueva.agente), `canal ${canal}`).toBe(200);
    }
  });
});

describe('Sesión por canal: el Administrador no tiene candado', () => {
  it('varios inicios de sesión en cada canal, sin 409 y sin invalidar las anteriores', async () => {
    const a = await crearUsuario({ rol: 'Administrador' });
    const web1 = await entrar(a);
    const web2 = await entrar(a);
    const app1 = await entrar(a, { canal: 'app' });
    const app2 = await entrar(a, { canal: 'app' });
    for (const s of [web1, web2, app1, app2]) expect(s.res.status).toBe(200);

    // Un Administrador nunca recibe CONCURRENT_SESSION (evaluarAcceso lo deja pasar).
    for (const s of [web1, web2, app1, app2]) expect(await sesionValida(s.agente)).toBe(200);
  });
});

describe('Sesión por canal: con 2FA', () => {
  it('el canal elegido en el paso de la contraseña se conserva al completar el 2FA (el del código no lo cambia)', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    // Activar 2FA en una sesión web normal.
    const { agente: setup } = await entrar(t);
    const csrfSetup = await obtenerCsrfToken(setup);
    const generar = await setup.post('/api/2fa/generate').set('X-CSRF-Token', csrfSetup);
    const secreto = generar.body.secret;
    await setup.post('/api/2fa/verify').set('X-CSRF-Token', csrfSetup).send({ token: authenticator.generate(secreto) });
    await setup.post('/api/logout').set('X-CSRF-Token', csrfSetup);
    expect(await columnas(t.id_usuario)).toMatchObject({ session_id: null, session_id_app: null });

    // Login por la app: pide 2FA y todavía no hay candado.
    const { agente, res } = await entrar(t, { canal: 'app' });
    expect(res.status).toBe(200);
    expect(res.body.require2FA).toBe(true);
    expect(await columnas(t.id_usuario)).toMatchObject({ session_id: null, session_id_app: null });

    // Se completa el 2FA mandando (a propósito) la cabecera contraria: debe ignorarse.
    const csrf = await obtenerCsrfToken(agente);
    const completar = await agente.post('/api/2fa/verify').set('X-CSRF-Token', csrf).set('X-Canal', 'web')
      .send({ token: authenticator.generate(secreto) });
    expect(completar.status).toBe(200);

    const fila = await columnas(t.id_usuario);
    expect(fila.session_id_app).toBeTruthy();
    expect(fila.session_id).toBeNull();
    expect(await sesionValida(agente)).toBe(200);
  });
});
