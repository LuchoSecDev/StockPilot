/**
 * @file candadoSesion.js
 * @description Candado de sesión única del Tendero: `Usuarios.session_id` (canal web) y `Usuarios.session_id_app`
 * (canal app) guardan el identificador de la sesión activa. Solo se libera al cerrar sesión, así que una sesión que
 * CADUCA (30 minutos sin actividad) sin haber cerrado sesión dejaba el candado puesto para siempre y todo login
 * siguiente recibía 409 SESSION_ACTIVE sin que existiera ninguna sesión real (hallazgo del 4-oct-2026).
 *
 * `sesionSigueViva` pregunta al almacén de sesiones si esa sesión todavía existe. El almacén (connect-pg-simple o
 * connect-redis) ya devuelve «nada» para una sesión caducada, así que sirve para cualquiera de los dos.
 *
 * @module utils/candadoSesion
 */

/** Tiempo máximo que se espera la respuesta del almacén antes de conservar el bloqueo. */
const ESPERA_POR_DEFECTO_MS = 3000;

/**
 * ¿La sesión `sid` sigue viva en el almacén de sesiones?
 *
 * Es una decisión de SEGURIDAD, así que ante la duda se conserva el bloqueo: si el almacén falla, lanza una
 * excepción o no responde a tiempo, devuelve `true` (el candado sigue en pie y el login recibe el 409 de siempre).
 * Solo devuelve `false` cuando el almacén responde con claridad que esa sesión no existe (o no hay sid).
 *
 * @param {{get: Function}} store - `req.sessionStore` (interfaz de express-session: get(sid, callback(err, sesion))).
 * @param {string|null|undefined} sid - El identificador guardado como candado.
 * @param {{esperaMs?: number}} [opciones]
 * @returns {Promise<boolean>}
 */
function sesionSigueViva(store, sid, { esperaMs = ESPERA_POR_DEFECTO_MS } = {}) {
    if (!sid) return Promise.resolve(false);
    return new Promise((resolve) => {
        const temporizador = setTimeout(() => resolve(true), esperaMs);
        const responder = (valor) => {
            clearTimeout(temporizador);
            resolve(valor);
        };
        try {
            store.get(sid, (err, sesion) => responder(err ? true : Boolean(sesion)));
        } catch (error) {
            responder(true);
        }
    });
}

module.exports = { sesionSigueViva, ESPERA_POR_DEFECTO_MS };
