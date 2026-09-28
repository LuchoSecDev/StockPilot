// routes/reportRoutes.js
const express = require('express');
const ReportController = require('../controllers/reportController');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { sanitizeBody, validateReport } = require('../middleware/validation');
const router = express.Router();

router.get('/api/reportes', requireLogin, ReportController.getReports);
router.get('/api/reportes/download/:id', requireLogin, ReportController.downloadReport);
router.post('/api/reportes', requireLogin, sanitizeBody, validateReport, ReportController.createReport);
router.put('/api/reportes/:id', requireLogin, requireAdmin, sanitizeBody, validateReport, ReportController.updateReport);
router.delete('/api/reportes/:id', requireLogin, requireAdmin, ReportController.deleteReport);
router.get('/api/reportes/merma/pdf', requireLogin, ReportController.generateMermaPDF);

module.exports = router;