// routes/productRoutes.js
const express = require('express');
const multer = require('multer');
const ProductController = require('../controllers/productController');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { sanitizeBody, validateProduct } = require('../middleware/validation');
const router = express.Router();

// Configurar multer para guardar el archivo en memoria (Buffer) y con límite de 5MB
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'text/csv', 
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo se aceptan .csv y .xlsx'), false);
        }
    }
});

// file-type >=17 es ESM puro (sin build CommonJS) — este proyecto es CommonJS ("type": "commonjs"
// en package.json), así que no se puede hacer `require('file-type')`. `import()` dinámico sí
// funciona desde código CommonJS y es la forma soportada de consumir un paquete ESM-only.
let fileTypeFromBufferPromise;
const getFileTypeFromBuffer = () => {
    if (!fileTypeFromBufferPromise) {
        fileTypeFromBufferPromise = import('file-type').then((mod) => mod.fileTypeFromBuffer);
    }
    return fileTypeFromBufferPromise;
};

// Middleware para validar Magic Numbers (primeros bytes reales del archivo)
const validateFileType = async (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'Debe subir un archivo Excel o CSV válido.' });

    // Si es un CSV, file-type a menudo no lo detecta porque CSV es texto plano.
    // Solo validaremos magic numbers estrictos para archivos binarios (Excel).
    if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || req.file.mimetype === 'application/vnd.ms-excel') {
        const fileTypeFromBuffer = await getFileTypeFromBuffer();
        const type = await fileTypeFromBuffer(req.file.buffer);
        // xlsx suele detectarse como zip, xls como cfb. Pero fileType detecta xlsx como 'zip' u 'office' internamente.
        // Mientras no sea un ejecutable o formato peligroso, está bien, pero idealmente comprobamos que la extensión detectada sea zip/cfb/xlsx
        if (!type || (type.ext !== 'zip' && type.ext !== 'cfb' && type.ext !== 'xlsx')) {
            return res.status(400).json({ error: 'El archivo Excel parece estar corrompido o es un archivo malicioso disfrazado.' });
        }
    }
    
    next();
};

router.get('/api/productos', requireLogin, ProductController.getProducts);
router.get('/api/productos/:id', requireLogin, ProductController.getProduct);
router.get('/api/productos/barcode/:code', requireLogin, ProductController.getByBarcode);
// Matriz de roles (P22-10, I0): link-barcode lo puede usar el Tendero (recibir mercancía);
// crear, editar, borrar, pausar, promociones y carga masiva son solo del Administrador.
router.put('/api/productos/:id/link-barcode', requireLogin, sanitizeBody, ProductController.linkBarcode);
router.post('/api/productos/bulk', requireLogin, requireAdmin, upload.single('file'), validateFileType, ProductController.bulkUpload);
router.post('/api/productos/admin', requireLogin, requireAdmin, sanitizeBody, validateProduct, ProductController.createProduct);
router.put('/api/productos/:id', requireLogin, requireAdmin, sanitizeBody, validateProduct, ProductController.updateProduct);
router.put('/api/productos/inhabilitar/:id', requireLogin, requireAdmin, ProductController.toggleProductStatus);
router.put('/api/productos/habilitar/:id', requireLogin, requireAdmin, ProductController.toggleProductStatus);
router.post('/api/promociones', requireLogin, requireAdmin, sanitizeBody, ProductController.applyManualPromotion);
router.delete('/api/productos/:id', requireLogin, requireAdmin, ProductController.deleteProduct);

module.exports = router;