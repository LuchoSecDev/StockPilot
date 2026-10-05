/**
 * @file sesion_candado_caducada.test.js
 * @description Hallazgo (4-oct-2026, probando la app nativa): el candado de sesión única del Tendero
 * (`Usuarios.session_id` en la web, `session_id_app` en la app) solo se liberaba al CERRAR sesión. Si la sesión
 * caducaba (30 minutos sin actividad) sin pulsar «Cerrar sesión», el candado quedaba puesto y TODO login siguiente
 * recibía 409 SESSION_ACTIVE sin que existiera ninguna sesión real.
 *
 * Regla ahora: el candado solo bloquea mientras su sesión siga VIVA en el almacén de sesiones. Si caducó o ya no
 * existe, el login lo reemplaza. Una sesión viva sigue bloqueando (409), y `force` sigue funcionando.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { crearUsuario } from './helpers/fixtures.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores();
});

async function entrar(usuario, { canal, force } = {}) {
  const agente = request.agent(app);
  let peticion = agente.post('/api/login');
  if (canal === 'app') peticion = peticion.set('X-Canal', 'app');
  const res = await peticion.send({ login: usuario.usuario, password: usuario.password, ...(force ? { force: true } : {}) });
  return { agente, res };
}
const candados = (id) => db.getAsync('SELECT session_id, session_id_app FROM Usuarios WHERE id_usuario = ?', [id]);
const sesionVive = async (agente) => (await agente.get('/api/caja/sesion').set('Accept', 'application/json')).status === 200;

/** Hace caducar la sesión guardada como candado (como si hubieran pasado los 30 minutos sin actividad). */
async function caducarSesion(sid) {
  await db.runAsync("UPDATE session SET expire = NOW() - INTERVAL '1 minute' WHERE sid = ?", [sid]);
}

describe.each([
  ['app', 'session_id_app', 'app'],
  ['web', 'session_id', undefined]
])('Candado de sesión caducada: canal %s', (_nombre, columna, canal) => {
  it('sesión VIVA: el segundo login sigue recibiendo 409 SESSION_ACTIVE (el candado funciona)', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    await entrar(t, { canal });
    const segundo = await entrar(t, { canal });
    expect(segundo.res.status).toBe(409);
    expect(segundo.res.body.code).toBe('SESSION_ACTIVE');
  });

  it('sesión CADUCADA sin haber cerrado sesión: el siguiente login entra (200) y el candado pasa a la sesión nueva', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    const primero = await entrar(t, { canal });
    expect(primero.res.status).toBe(200);
    const sidViejo = (await candados(t.id_usuario))[columna];
    expect(sidViejo).toBeTruthy();

    await caducarSesion(sidViejo);

    const segundo = await entrar(t, { canal });
    expect(segundo.res.status).toBe(200);
    const sidNuevo = (await candados(t.id_usuario))[columna];
    expect(sidNuevo).toBeTruthy();
    expect(sidNuevo).not.toBe(sidViejo);
    expect(await sesionVive(segundo.agente)).toBe(true);
  });

  it('sesión BORRADA del almacén (no solo caducada): también se libera', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    await entrar(t, { canal });
    const sidViejo = (await candados(t.id_usuario))[columna];
    await db.runAsync('DELETE FROM session WHERE sid = ?', [sidViejo]);

    const segundo = await entrar(t, { canal });
    expect(segundo.res.status).toBe(200);
  });

  it('`force` sigue funcionando con una sesión viva: entra y la anterior queda invalidada', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    const primero = await entrar(t, { canal });
    const segundo = await entrar(t, { canal, force: true });
    expect(segundo.res.status).toBe(200);
    expect(await sesionVive(segundo.agente)).toBe(true);
    const r = await primero.agente.get('/api/caja/sesion').set('Accept', 'application/json');
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('CONCURRENT_SESSION');
  });
});

describe('Candado de sesión caducada: no afecta a lo que no debe', () => {
  it('la sesión caducada de un canal NO libera el candado VIVO del otro canal', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    await entrar(t); // web (viva)
    const app1 = await entrar(t, { canal: 'app' });
    expect(app1.res.status).toBe(200);
    await caducarSesion((await candados(t.id_usuario)).session_id_app);

    // El canal app queda libre; el web sigue bloqueado.
    expect((await entrar(t, { canal: 'app' })).res.status).toBe(200);
    expect((await entrar(t)).res.status).toBe(409);
  });

  it('la clave incorrecta sigue siendo 401 (no se llega a consultar el candado)', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    await entrar(t, { canal: 'app' });
    const r = await request(app).post('/api/login').set('X-Canal', 'app').send({ login: t.usuario, password: 'incorrecta' });
    expect(r.status).toBe(401);
  });

  it('un candado con el identificador de una sesión que NO existe (basura en la columna) se trata como huérfano', async () => {
    const t = await crearUsuario({ rol: 'Tendero' });
    await db.runAsync("UPDATE Usuarios SET session_id_app = 'sesion-que-nunca-existio' WHERE id_usuario = ?", [t.id_usuario]);
    expect((await entrar(t, { canal: 'app' })).res.status).toBe(200);
  });
});
