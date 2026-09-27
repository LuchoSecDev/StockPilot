// middleware/auth.js
const User = require('../models/User');

function evaluarAcceso(session, isSessionValid) {
  if (!session || !session.userId) return 'no_auth';
  // Permitir múltiples sesiones concurrentes para Administradores
  if (session.rol === 'Administrador') return 'pass';
  if (!isSessionValid) return 'concurrent';
  return 'pass';
}

function evaluarAdmin(session) {
  if (!session || session.rol !== 'Administrador') return 'forbidden';
  return 'pass';
}

// requireLogin: cubierta a fondo por tests/integration/autenticacion.test.js (sin sesión, con
// sesión, sesión concurrente invalidada) y por cualquier otro flujo que pegue a un endpoint
// protegido; requireAdmin: cubierta en su camino de éxito (crearProveedor en
// aislamiento_multitienda.test.js, con un usuario Administrador). Plan 20, sección 8 — ya no hace
// falta /* v8 ignore */ acá; la cobertura real viene de `npm run test:integration`.
async function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) {
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(401).json({ error: "No autenticado" });
        }
        return res.redirect('/');
    }

    // VALIDACIÓN DE SESIÓN CONCURRENTE
    try {
        const isSessionValid = await User.verifyCurrentSession(req.session.userId, req.sessionID);
        const status = evaluarAcceso(req.session, isSessionValid);
        
        if (status === 'concurrent') {
            console.warn(`🛡️ SESIÓN INVALIDADA: El usuario ${req.session.userId} intentó usar una sesión antigua.`);
            
            // Destruir la sesión local porque ya existe una más nueva en otro lugar
            req.session.destroy();
            
            return res.status(401).json({ 
                error: "Sesión cerrada", 
                message: "Has iniciado sesión en otro dispositivo. Por seguridad, esta sesión ha sido cerrada.",
                code: "CONCURRENT_SESSION"
            });
        }
    } catch (error) {
        console.error('Error validando sesión concurrente:', error);
    }

    next();
}

function requireAdmin(req, res, next) {
    const status = evaluarAdmin(req.session);
    if (status === 'forbidden') {
        return res.status(403).json({ error: "Se requieren permisos de administrador" });
    }
    next();
}

module.exports = { requireLogin, requireAdmin, evaluarAcceso, evaluarAdmin };