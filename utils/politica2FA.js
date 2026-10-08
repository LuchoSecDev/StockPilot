/**
 * @file politica2FA.js
 * @description Reglas PURAS de la política de 2FA del Administrador (sin base de datos), para
 * probarlas en milisegundos. El middleware que las aplica es `middleware/twoFactor.js`.
 *
 * @module utils/politica2FA
 */

// Rutas (relativas a /api) que deben seguir abiertas aunque la política esté encendida: acceso, la
// propia cuenta —incluido el alta del 2FA, que es justo lo que se le pide al administrador— y las
// notificaciones (marcar una como leída no es una operación de negocio).
const RUTAS_EXENTAS = [
  '/login', '/registro', '/logout',
  '/forgot-password', '/verify-reset-code', '/reset-password',
  '/2fa', '/perfil',
  '/notificaciones'
];

const METODOS_DE_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

const MENSAJE_BLOQUEO = 'Para modificar datos, los administradores deben activar la verificación en dos pasos. ' +
  'Actívala desde el aviso del encabezado o desde Mi perfil.';

/** Se lee en cada petición (no al arrancar) para poder cambiarla con un reinicio en producción y en las pruebas. */
const politicaActiva = () => process.env.REQUIRE_ADMIN_2FA === 'true';

/**
 * @param {string} ruta - `req.path` dentro de un middleware montado en `/api/` (sin el prefijo `/api`).
 * @returns {boolean} true si la ruta es exacta o cuelga de una exenta (`/2fa/generate` sí; `/2fax` no).
 */
function rutaExentaDe2FA(ruta) {
  return RUTAS_EXENTAS.some(exenta => ruta === exenta || ruta.startsWith(`${exenta}/`));
}

/**
 * Decide si la petición debe pasar por la comprobación del 2FA del administrador. No consulta la base:
 * solo descarta lo que la política nunca bloquea (apagada, lecturas, rutas exentas, no-administradores).
 * @param {{method: string, path: string, session?: {userId?: number, rol?: string}}} req
 * @returns {boolean}
 */
function debeComprobar2FA(req) {
  if (!politicaActiva()) return false;
  if (METODOS_DE_LECTURA.has(req.method)) return false;
  if (rutaExentaDe2FA(req.path)) return false;
  return Boolean(req.session?.userId) && req.session.rol === 'Administrador';
}

module.exports = { RUTAS_EXENTAS, MENSAJE_BLOQUEO, politicaActiva, rutaExentaDe2FA, debeComprobar2FA };
