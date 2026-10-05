/**
 * @file candado_sesion.test.js
 * @description `sesionSigueViva(store, sid)`: decide si el candado de sesión de un usuario sigue en pie, es decir, si la
 * sesión guardada en `Usuarios.session_id`/`session_id_app` todavía existe (y no caducó) en el almacén de sesiones.
 * Con almacenes simulados, porque lo que importa aquí es la REGLA, incluido qué hacer cuando el almacén falla.
 */
import { describe, it, expect } from 'vitest';
import { sesionSigueViva } from '../../utils/candadoSesion.js';

/** Un almacén falso con la misma interfaz de express-session: get(sid, callback(err, sesion)). */
const almacen = (sesiones) => ({ get: (sid, cb) => setImmediate(() => cb(null, sesiones[sid])) });

describe('sesionSigueViva', () => {
  it('la sesión existe en el almacén: el candado sigue en pie', async () => {
    expect(await sesionSigueViva(almacen({ abc: { userId: 1 } }), 'abc')).toBe(true);
  });

  it('la sesión ya NO existe (caducó o se borró): el candado está huérfano', async () => {
    expect(await sesionSigueViva(almacen({}), 'abc')).toBe(false);
    expect(await sesionSigueViva(almacen({ abc: null }), 'abc')).toBe(false);
    expect(await sesionSigueViva(almacen({ abc: undefined }), 'abc')).toBe(false);
  });

  it('sin identificador de sesión guardado no hay candado', async () => {
    expect(await sesionSigueViva(almacen({}), null)).toBe(false);
    expect(await sesionSigueViva(almacen({}), undefined)).toBe(false);
    expect(await sesionSigueViva(almacen({}), '')).toBe(false);
  });

  it('SI EL ALMACÉN FALLA no se libera el candado (se conserva el bloqueo por seguridad)', async () => {
    const roto = { get: (sid, cb) => setImmediate(() => cb(new Error('almacén caído'))) };
    expect(await sesionSigueViva(roto, 'abc')).toBe(true);
  });

  it('si el almacén lanza una excepción al consultar, también se conserva el bloqueo', async () => {
    const quePeta = { get: () => { throw new Error('boom'); } };
    expect(await sesionSigueViva(quePeta, 'abc')).toBe(true);
  });

  it('un almacén que nunca responde no deja el login colgado: se conserva el bloqueo tras el tiempo de espera', async () => {
    const mudo = { get: () => {} };
    expect(await sesionSigueViva(mudo, 'abc', { esperaMs: 30 })).toBe(true);
  });
});
