// middleware/errorHandler.js
// Manejador global de errores de Express (se monta al final de app.js). Extraído de app.js para poder
// probar cada rama sin levantar el servidor.
const multer = require('multer');
const { logger } = require('../utils/logger');

// Errores HTTP «de cliente» (4xx) que lanzan las librerías con su propio código (http-errors):
// csrf-sync, body-parser (JSON mal formado, cuerpo demasiado grande), etc. Antes todos caían en el 500
// genérico, así que un cliente no podía distinguir «token CSRF vencido» de «el servidor falló» (C4).
function respuestaDeErrorHttp(err) {
    const status = Number(err.status || err.statusCode);
    if (!Number.isInteger(status) || status < 400 || status > 499) return null;

    // csrf-sync lanza ForbiddenError('invalid csrf token'). El `code` es estable para que la app
    // (web o nativa) pueda reaccionar: pedir un token nuevo en GET /api/csrf-token y reintentar una vez.
    if (status === 403 && /csrf/i.test(err.message || '')) {
        return { status: 403, code: 'CSRF_INVALID', error: 'Token CSRF inválido o ausente. Pide uno nuevo en GET /api/csrf-token y reintenta.' };
    }
    if (err.type === 'entity.parse.failed') return { status: 400, error: 'Solicitud inválida: el cuerpo no es un JSON válido.' };
    if (err.type === 'entity.too.large') return { status: 413, error: 'La petición es demasiado grande.' };
    return { status, error: 'Solicitud no válida.' };
}

// Express identifica los manejadores de error por aridad (4 args): `_next` debe quedarse aunque no se use.
function manejadorErrores(err, req, res, _next) {
    // 🛡️ Manejo de errores generalizado para subida de archivos (Multer)
    if (err instanceof multer.MulterError) {
        // LIMIT_FILE_SIZE amerita un 413, otros problemas (ej: LIMIT_FIELD_KEY) un 400
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        logger.warn({ err, url: req.originalUrl, method: req.method }, '⚠️ Rechazo por validación de subida de archivo (Multer)');

        return res.status(status).json({
            success: false,
            error: err.code === 'LIMIT_FILE_SIZE'
                ? 'El archivo subido supera el límite máximo permitido de 5MB.'
                : `Error en la subida del archivo: ${err.message}`
        });
    }

    // Errores 4xx de las librerías (CSRF, JSON mal formado, cuerpo demasiado grande…): no son fallos del servidor.
    const clienteError = respuestaDeErrorHttp(err);
    if (clienteError) {
        logger.warn({ err, url: req.originalUrl, method: req.method }, '⚠️ Petición rechazada (4xx)');
        const { status, ...cuerpo } = clienteError;
        return res.status(status).json({ success: false, ...cuerpo });
    }

    // Logging estructurado del error
    logger.error({ err, url: req.originalUrl, method: req.method }, '❌ ERROR GLOBAL');

    // Validación de tipo de archivo (fileFilter de Multer lanza Error normal)
    if (err.message && err.message.includes('Tipo de archivo no permitido')) {
        return res.status(400).json({ success: false, error: err.message });
    }

    // En producción, silenciamos detalles técnicos peligrosos
    const isProd = process.env.NODE_ENV === 'production';

    res.status(500).json({
        success: false,
        error: isProd
            ? 'Lo sentimos, ha ocurrido un error interno. Intenta de nuevo más tarde.'
            : `Error interno: ${err.message}`
    });
}

module.exports = { manejadorErrores, respuestaDeErrorHttp };
