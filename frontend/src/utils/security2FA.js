/**
 * Reglas del navegador para el aviso del 2FA. El SERVIDOR decide si una operación se permite
 * (middleware/twoFactor.js, política REQUIRE_ADMIN_2FA): aquí solo se reacciona a su respuesta.
 * Antes el navegador intentaba adivinar qué acciones bloquear y la API aceptaba cualquier cosa.
 */

/** `code` que devuelve la API cuando la política está encendida y el Administrador no activó el 2FA. */
export const CODIGO_2FA_REQUERIDO = 'DOS_FACTORES_REQUERIDO';

/** Evento del navegador que abre el aviso de activación (lo emite el interceptor de AuthContext). */
export const EVENTO_2FA_REQUERIDO = 'require-2fa';

/**
 * @param {*} error - Error de axios.
 * @returns {boolean} true si el servidor rechazó la petición por falta de 2FA.
 */
export function esBloqueoPorDosFactores(error) {
  return error?.response?.status === 403 && error.response.data?.code === CODIGO_2FA_REQUERIDO;
}

/**
 * El aviso permanente del encabezado se muestra a quien puede activar el 2FA y aún no lo hizo
 * (hoy, el Administrador): informa que la función existe, sin obligar a usarla.
 * @param {Object|null} user - Datos del usuario en sesión.
 * @returns {boolean}
 */
export function debeMostrarAvisoDosFactores(user) {
  return Boolean(user?.needs2FASetup);
}
