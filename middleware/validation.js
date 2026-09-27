// middleware/validation.js

/**
 * Sanitiza un string: trim y escape de caracteres HTML básicos
 */
function sanitize(str) {
    if (typeof str !== 'string') return str;
    return str.trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Sanitiza todos los campos string del body
 */
// sanitizeBody y validateLogin: cubiertas por tests/integration/autenticacion.test.js y por
// prácticamente cualquier POST de los otros flujos del Nivel 2 (plan 20, sección 8) — ya no hace
// falta /* v8 ignore */ acá. La cobertura real viene de `npm run test:integration`, no de
// `npm test` (que excluye tests/integration/ a propósito).
function sanitizeBody(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        for (const key of Object.keys(req.body)) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitize(req.body[key]);
            }
        }
    }
    next();
}

/**
 * Valida campos de login
 */
function validateLogin(req, res, next) {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
    }

    next();
}

/* v8 ignore start -- sin pruebas todavía: ninguno de los 7 flujos de integración del Nivel 2
   (plan 20, sección 8) ejercita /api/registro. */
/**
 * Valida campos de registro
 */
function validateRegister(req, res, next) {
    const { name, email, username, password, store_name } = req.body;

    if (!name || !email || !username || !password || !store_name) {
        return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios' });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, error: 'Formato de correo electrónico inválido' });
    }

    // Validar longitud de contraseña (OWASP A04: mínimo 8 caracteres)
    if (password.length < 8) {
        return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    next();
}
/* v8 ignore stop */

// validateProduct y validateSale: cubiertas por tests/integration/aislamiento_multitienda.test.js
// y tests/integration/venta_concurrencia.test.js (plan 20, sección 8).
/**
 * Valida campos de producto
 */
function validateProduct(req, res, next) {
    let { codigo, codigo_barras, nombre_producto, precio, cantidad } = req.body;

    // El código de barras (EAN/UPC) es el principal y obligatorio
    if (!codigo_barras && !codigo) {
        return res.status(400).json({ success: false, error: 'El código de barras (EAN/UPC) es obligatorio' });
    }

    // Si solo viene código SKU (ej. importación legacy), se usa como código de barras
    if (!codigo_barras && codigo) {
        req.body.codigo_barras = codigo.toString().trim();
    }

    // Si el SKU interno está vacío, usar el código de barras como fallback
    if (!codigo && codigo_barras) {
        req.body.codigo = codigo_barras.toString().trim();
    }

    if (!nombre_producto || nombre_producto.toString().trim() === '') {
        return res.status(400).json({ success: false, error: 'El nombre del producto es obligatorio' });
    }

    if (precio !== undefined && (isNaN(parseFloat(precio)) || parseFloat(precio) < 0)) {
        return res.status(400).json({ success: false, error: 'El precio debe ser un número positivo' });
    }

    if (cantidad !== undefined && (isNaN(parseInt(cantidad)) || parseInt(cantidad) < 0)) {
        return res.status(400).json({ success: false, error: 'La cantidad debe ser un número entero positivo' });
    }

    next();
}

/**
 * Valida campos de venta
 */
function validateSale(req, res, next) {
    const { id_producto, cantidad } = req.body;

    if (!id_producto || !cantidad) {
        return res.status(400).json({ success: false, error: 'Producto y cantidad son obligatorios' });
    }

    if (isNaN(parseInt(cantidad)) || parseInt(cantidad) <= 0) {
        return res.status(400).json({ success: false, error: 'La cantidad debe ser un número entero mayor a 0' });
    }

    next();
}

/* v8 ignore start -- sin pruebas todavía: ningún flujo del Nivel 2 ejercita la creación de
   reportes manuales. */
/**
 * Valida campos de reporte
 */
function validateReport(req, res, next) {
    const { titulo, descripcion, fecha_reporte, creador, tipo } = req.body;

    if (!titulo || !descripcion || !fecha_reporte || !creador || !tipo) {
        return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios' });
    }

    next();
}
/* v8 ignore stop */

// validateCartSale: cubierta por tests/integration/venta_concurrencia.test.js.
/**
 * Valida campos de venta múltiple (Carrito)
 */
function validateCartSale(req, res, next) {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'El carrito debe contener al menos un producto' });
    }

    for (const item of items) {
        if (!item.id_producto || !item.cantidad) {
            return res.status(400).json({ success: false, error: 'Cada ítem debe tener producto y cantidad' });
        }
        if (isNaN(parseInt(item.cantidad)) || parseInt(item.cantidad) <= 0) {
            return res.status(400).json({ success: false, error: 'Las cantidades deben ser mayores a 0' });
        }
    }

    next();
}

module.exports = {
    sanitize,
    sanitizeBody,
    validateLogin,
    validateRegister,
    validateProduct,
    validateSale,
    validateCartSale,
    validateReport
};
