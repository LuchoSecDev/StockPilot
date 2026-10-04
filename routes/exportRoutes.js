// routes/exportRoutes.js
const express = require('express');
const ExportController = require('../controllers/exportController');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Exportar ventas a CSV (guarda en exports/)
router.post('/api/exportar/ventas', requireLogin, requireAdmin, ExportController.exportSales);

// Exportar reportes a CSV (guarda en exports/)
router.post('/api/exportar/reportes', requireLogin, requireAdmin, ExportController.exportReports);

// Descargar un archivo exportado: solo los de la propia tienda, y se borran al terminar de enviarse.
// (Se eliminó GET /api/exportar/archivos: listaba los archivos de TODAS las tiendas — hallazgo C6.)
router.get('/api/exportar/descargar/:filename', requireLogin, ExportController.downloadExport);

module.exports = router;
