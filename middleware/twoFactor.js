/**
 * @file twoFactor.js
 * @description Política de 2FA del Administrador, aplicada en el SERVIDOR.
 *
 * Con `REQUIRE_ADMIN_2FA=true`, un Administrador que todavía no activó el 2FA no puede ESCRIBIR
 * (cualquier petición que no sea de lectura); leer sigue permitido y también sus flujos de cuenta
 * (activar el 2FA, entrar, salir, perfil). Por defecto la política está APAGADA: durante el piloto
 * el 2FA se recomienda pero no se exige (sin códigos de recuperación, exigirlo dejaría fuera a un
 * dueño que pierda el celular). Encenderla después es cambiar una variable de entorno, sin código.
 *
 * Está montada una sola vez sobre `/api/` y bloquea POR DEFECTO: una ruta nueva queda cubierta sin
 * que nadie se acuerde de marcarla (el commit ec4d48c solo escondía botones en dos pantallas, y la
 * API aceptaba cualquier operación). Las reglas puras (qué se exime) están en `utils/politica2FA.js`.
 *
 * @module middleware/twoFactor
 */
const User = require('../models/User');
const { logger } = require('../utils/logger');
const { debeComprobar2FA, MENSAJE_BLOQUEO } = require('../utils/politica2FA');

async function requireAdmin2FAConfigurado(req, res, next) {
  if (!debeComprobar2FA(req)) return next();

  try {
    if (await User.is2FAEnabled(req.session.userId)) return next();
  } catch (err) {
    // Si no se puede comprobar, NO se deja escribir (falla cerrado).
    logger.error({ err, userId: req.session.userId }, 'No se pudo comprobar el estado del 2FA del administrador');
    return res.status(500).json({ success: false, error: 'No se pudo verificar la seguridad de tu cuenta. Intenta de nuevo.' });
  }

  return res.status(403).json({ success: false, code: 'DOS_FACTORES_REQUERIDO', error: MENSAJE_BLOQUEO });
}

module.exports = { requireAdmin2FAConfigurado };
