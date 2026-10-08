/**
 * @file panel_interno_acceso.test.js
 * @description Plan 22, I1: el acceso al panel interno del equipo. Cuentas aparte (`interno.equipo`), contraseña + segundo
 * factor OBLIGATORIO, sesión que no se mezcla con la de las tiendas, y bitácora de lo que ocurre.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { crearUsuario, crearMiembroEquipo } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { crearMiembro, generarSecreto } from '../../services/interno/equipo.js';

// bcrypt se carga con `require`: es la MISMA copia que usa el servicio (con `import`, Vitest crearía otra y el espía no la alcanzaría).
const bcrypt = createRequire(import.meta.url)('bcrypt');

beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Id de sesión (en la tabla `session`) del agente, leído de su cookie firmada `s:<sid>.<firma>`. */
function idDeSesion(agente) {
  const cookie = agente.jar.getCookies({ domain: '127.0.0.1', path: '/', secure: false, script: false }).find(c => c.name === 'connect.sid');
  return decodeURIComponent(cookie.value).slice(2).split('.')[0];
}

const JSON_ACCEPT = { Accept: 'application/json' };

/** Paso 1 (usuario y contraseña) con un agente nuevo. Devuelve el agente y el token CSRF vigente. */
async function paso1(miembro, { password = miembro.password } = {}) {
  const agente = request.agent(app);
  const csrf = await obtenerCsrfToken(agente);
  const res = await agente.post('/api/interno/login').set('X-CSRF-Token', csrf).send({ usuario: miembro.usuario, password });
  return { agente, res, csrf: await obtenerCsrfToken(agente) };
}

/** Entra completo (los dos pasos). */
async function entrar(miembro) {
  const { agente, csrf } = await paso1(miembro);
  const res = await agente.post('/api/interno/2fa').set('X-CSRF-Token', csrf).send({ token: authenticator.generate(miembro.secreto) });
  return { agente, res, csrf: await obtenerCsrfToken(agente) };
}

const bitacora = async () => db.allAsync('SELECT id_equipo, accion, id_tienda, detalle, ip::text AS ip FROM interno.bitacora ORDER BY id');
const acciones = async () => (await bitacora()).map(b => b.accion);

describe('POST /api/interno/login (paso 1)', () => {
  it('con credenciales correctas pide el segundo factor y NO da acceso todavía', async () => {
    const m = await crearMiembroEquipo();

    const { agente, res } = await paso1(m);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, requiere2FA: true });
    expect((await agente.get('/api/interno/tiendas').set(JSON_ACCEPT)).status).toBe(401);
    expect((await agente.get('/api/interno/sesion')).body).toEqual({ autenticado: false });
  });

  it('contraseña incorrecta, usuario inexistente y cuenta desactivada responden EXACTAMENTE lo mismo (no revela qué usuarios existen)', async () => {
    const activo = await crearMiembroEquipo();
    const inactivo = await crearMiembroEquipo({ activo: false });

    const malaClave = (await paso1(activo, { password: 'incorrecta-incorrecta' })).res;
    const noExiste = (await paso1({ usuario: 'nadie_existe', password: 'lo-que-sea-12345' })).res;
    const desactivada = (await paso1(inactivo)).res;

    for (const r of [malaClave, noExiste, desactivada]) {
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ success: false, error: 'Usuario o contraseña incorrectos.' });
    }
  });

  it('compara la contraseña SIEMPRE, aunque el usuario no exista: así el tiempo de respuesta no delata qué usuarios existen', async () => {
    const espia = vi.spyOn(bcrypt, 'compare');

    await paso1({ usuario: 'usuario_que_no_existe', password: 'lo-que-sea-12345' });

    expect(espia).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sin cuerpo', undefined],
    ['sin contraseña', { usuario: 'alguien' }],
    ['usuario que no es texto', { usuario: { $ne: '' }, password: 'abc' }],
    ['contraseña que no es texto', { usuario: 'alguien', password: 12345678 }],
    ['campos vacíos', { usuario: '', password: '' }],
    ['campos demasiado largos', { usuario: 'a'.repeat(500), password: 'b'.repeat(500) }]
  ])('rechaza con 400 una entrada inválida (%s)', async (_nombre, cuerpo) => {
    const agente = request.agent(app);
    const csrf = await obtenerCsrfToken(agente);
    const r = await agente.post('/api/interno/login').set('X-CSRF-Token', csrf).send(cuerpo);
    expect(r.status).toBe(400);
  });

  it('exige el token CSRF', async () => {
    const m = await crearMiembroEquipo();
    const r = await request.agent(app).post('/api/interno/login').send({ usuario: m.usuario, password: m.password });
    expect(r.status).toBe(403);
  });

  it('un intento fallido queda en la bitácora SIN guardar la contraseña', async () => {
    const m = await crearMiembroEquipo();
    await paso1(m, { password: 'una-clave-incorrecta-123' });

    const [fila] = await bitacora();

    expect(fila.accion).toBe('login_fallido');
    expect(fila.id_equipo).toBeNull();
    expect(fila.detalle).toEqual({ usuario: m.usuario });
    expect(JSON.stringify(fila)).not.toContain('una-clave-incorrecta-123');
  });

  it('tras 5 intentos fallidos, el siguiente responde 429 aunque la contraseña sea correcta', async () => {
    const m = await crearMiembroEquipo();
    for (let i = 0; i < 5; i++) expect((await paso1(m, { password: 'incorrecta-incorrecta' })).res.status).toBe(401);

    expect((await paso1(m)).res.status).toBe(429);
  });
});

describe('POST /api/interno/2fa (paso 2)', () => {
  it('con el código correcto abre la sesión del equipo y la bitácora lo registra', async () => {
    const m = await crearMiembroEquipo({ nombre: 'Ana Gómez' });

    const { agente, res } = await entrar(m);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, equipo: { nombre: 'Ana Gómez' } });
    expect((await agente.get('/api/interno/sesion')).body).toEqual({ autenticado: true, equipo: { nombre: 'Ana Gómez' } });
    expect((await agente.get('/api/interno/tiendas')).status).toBe(200);
    const fila = (await bitacora()).find(b => b.accion === 'login_ok');
    expect(fila.id_equipo).toBe(m.id_equipo);
    expect(fila.ip).toBeTruthy();
    expect((await db.getAsync('SELECT ultimo_acceso FROM interno.equipo WHERE id_equipo = ?', [m.id_equipo])).ultimo_acceso).toBeInstanceOf(Date);
  });

  it('sin haber pasado el paso 1 responde 401', async () => {
    const agente = request.agent(app);
    const csrf = await obtenerCsrfToken(agente);
    const r = await agente.post('/api/interno/2fa').set('X-CSRF-Token', csrf).send({ token: '123456' });
    expect(r.status).toBe(401);
  });

  it('un código incorrecto responde 401, no abre sesión y queda en la bitácora', async () => {
    const m = await crearMiembroEquipo();
    const { agente, csrf } = await paso1(m);

    const r = await agente.post('/api/interno/2fa').set('X-CSRF-Token', csrf).send({ token: '000000' });

    expect(r.status).toBe(401);
    expect(r.body).toEqual({ success: false, error: 'Código incorrecto.' });
    expect((await agente.get('/api/interno/tiendas').set(JSON_ACCEPT)).status).toBe(401);
    expect(await acciones()).toContain('segundo_factor_fallido');
  });

  it.each([['con letras', 'abcdef'], ['de 5 dígitos', '12345'], ['de 7 dígitos', '1234567'], ['vacío', '']])('un código %s no se acepta', async (_n, token) => {
    const m = await crearMiembroEquipo();
    const { agente, csrf } = await paso1(m);
    const r = await agente.post('/api/interno/2fa').set('X-CSRF-Token', csrf).send({ token });
    expect([400, 401]).toContain(r.status);
    expect((await agente.get('/api/interno/sesion')).body.autenticado).toBe(false);
  });

  it('el paso pendiente CADUCA a los 5 minutos: con el código correcto, pero tarde, responde 401', async () => {
    const m = await crearMiembroEquipo();
    const { agente, csrf } = await paso1(m);
    // Se envejece el intento pendiente directamente en la tabla de sesiones (pasaron 6 minutos).
    const r0 = await db.pool.query(
      `UPDATE session SET sess = jsonb_set(sess::jsonb, '{internoPendiente,hasta}', to_jsonb(?::bigint))::json WHERE sid = ?`.replace('?', '$1').replace('?', '$2'),
      [Date.now() - 6 * 60_000, idDeSesion(agente)]);
    expect(r0.rowCount).toBe(1);

    const r = await agente.post('/api/interno/2fa').set('X-CSRF-Token', csrf).send({ token: authenticator.generate(m.secreto) });

    expect(r.status).toBe(401);
    expect((await agente.get('/api/interno/sesion')).body.autenticado).toBe(false);
  });

  it('el mismo código NO sirve dos veces: repetir uno ya usado (aunque siga vigente) se rechaza', async () => {
    const m = await crearMiembroEquipo();
    const codigo = authenticator.generate(m.secreto);
    const a = await paso1(m);
    const b = await paso1(m);

    const primero = await a.agente.post('/api/interno/2fa').set('X-CSRF-Token', a.csrf).send({ token: codigo });
    const repetido = await b.agente.post('/api/interno/2fa').set('X-CSRF-Token', b.csrf).send({ token: codigo });

    expect(primero.status).toBe(200);
    expect(repetido.status).toBe(401);
  });

  it('el código de OTRA cuenta no sirve', async () => {
    const m = await crearMiembroEquipo();
    const otra = await crearMiembroEquipo();
    const { agente, csrf } = await paso1(m);
    const r = await agente.post('/api/interno/2fa').set('X-CSRF-Token', csrf).send({ token: authenticator.generate(otra.secreto) });
    expect(r.status).toBe(401);
  });

  it('tras 5 códigos incorrectos, el siguiente responde 429 aunque sea el correcto', async () => {
    const m = await crearMiembroEquipo();
    const { agente, csrf } = await paso1(m);
    for (let i = 0; i < 5; i++) {
      expect((await agente.post('/api/interno/2fa').set('X-CSRF-Token', csrf).send({ token: '000000' })).status).toBe(401);
    }

    const r = await agente.post('/api/interno/2fa').set('X-CSRF-Token', csrf).send({ token: authenticator.generate(m.secreto) });

    expect(r.status).toBe(429);
    expect((await agente.get('/api/interno/sesion')).body.autenticado).toBe(false);
  });
});

describe('sesión del equipo', () => {
  it('cerrar sesión la invalida y deja constancia', async () => {
    const m = await crearMiembroEquipo();
    const { agente, csrf } = await entrar(m);

    const salir = await agente.post('/api/interno/logout').set('X-CSRF-Token', csrf);

    expect(salir.status).toBe(200);
    expect((await agente.get('/api/interno/tiendas').set(JSON_ACCEPT)).status).toBe(401);
    expect(await acciones()).toContain('logout');
  });

  it('si desactivan la cuenta, pierde el acceso en la SIGUIENTE petición (no espera a que caduque)', async () => {
    const m = await crearMiembroEquipo();
    const { agente } = await entrar(m);
    expect((await agente.get('/api/interno/tiendas')).status).toBe(200);

    await db.runAsync('UPDATE interno.equipo SET activo = false WHERE id_equipo = ?', [m.id_equipo]);

    expect((await agente.get('/api/interno/tiendas')).status).toBe(401);
    expect((await agente.get('/api/interno/sesion')).body.autenticado).toBe(false);
  });

  it('sin sesión, /sesion responde 200 {autenticado:false} y las demás rutas 401 en JSON (nunca redirigen)', async () => {
    const agente = request.agent(app);
    expect((await agente.get('/api/interno/sesion')).body).toEqual({ autenticado: false });
    for (const ruta of ['/api/interno/tiendas', '/api/interno/embudo', '/api/interno/bitacora', '/api/interno/tiendas/1']) {
      const r = await agente.get(ruta);
      expect(r.status, ruta).toBe(401);
      expect(r.headers.location, ruta).toBeUndefined();
    }
  });
});

describe('separación entre el panel del equipo y las tiendas', () => {
  it('un Administrador de tienda no entra al panel: 403', async () => {
    const admin = await crearUsuario({ rol: 'Administrador' });
    const agente = request.agent(app);
    await iniciarSesion(agente, admin);

    for (const ruta of ['/api/interno/tiendas', '/api/interno/embudo', '/api/interno/bitacora']) {
      expect((await agente.get(ruta)).status, ruta).toBe(403);
    }
  });

  it('un Tendero tampoco: 403', async () => {
    const tendero = await crearUsuario({ rol: 'Tendero' });
    const agente = request.agent(app);
    await iniciarSesion(agente, tendero);
    expect((await agente.get('/api/interno/tiendas')).status).toBe(403);
  });

  it('una sesión del equipo NO sirve en las rutas de tienda (no tiene userId ni tiendaId)', async () => {
    const m = await crearMiembroEquipo();
    const { agente, csrf } = await entrar(m);

    const lectura = await agente.get('/api/productos').set(JSON_ACCEPT);
    const escritura = await agente.post('/api/productos/admin').set(JSON_ACCEPT).set('X-CSRF-Token', csrf).send({ codigo: 'X', nombre_producto: 'X' });
    const perfil = await agente.get('/api/perfil').set(JSON_ACCEPT);

    expect(lectura.status).toBe(401);
    expect([401, 403]).toContain(escritura.status);
    expect(perfil.status).toBe(401);
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM Productos')).n)).toBe(0);
  });

  it('entrar al panel desde un navegador con sesión de tienda abierta EXPULSA la sesión de la tienda (no se mezclan)', async () => {
    const admin = await crearUsuario({ rol: 'Administrador' });
    const m = await crearMiembroEquipo();
    const agente = request.agent(app);
    await iniciarSesion(agente, admin);
    expect((await agente.get('/api/perfil')).status).toBe(200);

    const csrf = await obtenerCsrfToken(agente);
    await agente.post('/api/interno/login').set('X-CSRF-Token', csrf).send({ usuario: m.usuario, password: m.password });

    expect((await agente.get('/api/perfil').set(JSON_ACCEPT)).status).toBe(401);
  });

  it('el login de tienda tampoco hereda la sesión del equipo', async () => {
    const admin = await crearUsuario({ rol: 'Administrador' });
    const m = await crearMiembroEquipo();
    const { agente } = await entrar(m);
    expect((await agente.get('/api/interno/sesion')).body.autenticado).toBe(true);

    await iniciarSesion(agente, admin);

    expect((await agente.get('/api/interno/sesion')).body.autenticado).toBe(false);
    expect((await agente.get('/api/interno/tiendas')).status).toBe(403);   // ahora es una sesión de tienda
  });

  it('con la política de 2FA de tienda encendida, el panel del equipo no se ve afectado', async () => {
    process.env.REQUIRE_ADMIN_2FA = 'true';
    try {
      const m = await crearMiembroEquipo();
      const { agente, csrf } = await entrar(m);
      expect((await agente.put('/api/interno/tiendas/1/es-prueba').set('X-CSRF-Token', csrf).send({ esPrueba: true })).status).not.toBe(403);
    } finally {
      delete process.env.REQUIRE_ADMIN_2FA;
    }
  });
});

describe('cuentas del equipo: servicio de alta', () => {
  it('guarda la contraseña con hash (nunca en claro) y el secreto del 2FA', async () => {
    const m = await crearMiembroEquipo();
    const fila = await db.getAsync('SELECT contrasena, two_factor_secret FROM interno.equipo WHERE id_equipo = ?', [m.id_equipo]);
    expect(fila.contrasena).not.toBe(m.password);
    expect(fila.contrasena).toMatch(/^\$2[aby]\$/);
    expect(fila.two_factor_secret).toBe(m.secreto);
  });

  it('no permite una contraseña corta, un correo inválido, ni repetir usuario o correo', async () => {
    const m = await crearMiembroEquipo();
    const base = { nombre: 'X', correo: 'x@test.local', usuario: 'usuario_x', password: 'ClaveLarga12345', secreto: generarSecreto() };

    await expect(crearMiembro({ ...base, password: 'corta' })).rejects.toThrow(/al menos 12/);
    await expect(crearMiembro({ ...base, correo: 'no-es-correo' })).rejects.toThrow(/correo/);
    await expect(crearMiembro({ ...base, secreto: '' })).rejects.toThrow(/segundo factor/i);
    await expect(crearMiembro({ ...base, usuario: m.usuario })).rejects.toThrow(/ya existe/i);
    await expect(crearMiembro({ ...base, correo: m.correo })).rejects.toThrow(/ya existe/i);
  });
});
