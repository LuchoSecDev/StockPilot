/**
 * @file requireEquipo.js
 * @description Puerta de las rutas `/api/interno/*` (panel del equipo). Exige una sesión INTERNA con el segundo factor ya
 * verificado (`req.session.interno`, que solo se crea después del código TOTP) y una cuenta que siga activa.
 *
 * Separación de mundos: una sesión de tienda (`userId`) NUNCA entra aquí (403), y una sesión del equipo no tiene `userId`
 * ni `tiendaId`, así que `requireLogin` y las rutas de tienda no le sirven (401). Responde siempre JSON, nunca redirige.
 *
 * @module middleware/requireEquipo
 */
const equipo = require('../services/interno/equipo');
const { logger } = require('../utils/logger');

async function requireEquipo(req, res, next) {
  const sesion = req.session;

  // Sesión de una tienda (o mixta): no es del equipo, aunque además traiga algo en `interno`.
  if (sesion?.userId) {
    return res.status(403).json({ success: false, error: 'No tienes acceso al panel interno.' });
  }

  const idEquipo = sesion?.interno?.idEquipo;
  if (!idEquipo) {
    return res.status(401).json({ success: false, error: 'Inicia sesión en el panel interno.' });
  }

  try {
    // En cada petición: si desactivan a alguien, pierde el acceso de inmediato.
    const miembro = await equipo.obtenerActivo(idEquipo);
    if (!miembro) {
      await new Promise(resolver => sesion.destroy(() => resolver()));
      return res.status(401).json({ success: false, error: 'Tu sesión del panel interno ya no es válida.' });
    }
    req.equipo = miembro;
    return next();
  } catch (err) {
    logger.error({ err }, 'No se pudo comprobar la sesión del equipo');
    return res.status(500).json({ success: false, error: 'No se pudo verificar tu sesión. Intenta de nuevo.' });
  }
}

module.exports = { requireEquipo };
