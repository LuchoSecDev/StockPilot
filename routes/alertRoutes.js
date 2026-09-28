const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// Todas estas rutas caen bajo el prefijo /api/alertas

const { requireLogin, requireAdmin } = require('../middleware/auth');

router.post('/generate', requireLogin, alertController.generateAlerts);
router.get('/dry-run', requireLogin, requireAdmin, alertController.dryRun);
router.get('/', requireLogin, alertController.getActiveAlerts);
router.get('/stats', requireLogin, alertController.getStats);
router.patch('/:id/resolve', requireLogin, alertController.resolveAlert);

// Ruta para disparo manual del resumen semanal (solo admins)
const { runWeeklySummary } = require('../services/schedulerService');
router.post('/test-summary', requireLogin, requireAdmin, async (req, res) => {
    try {
        const tiendaId = req.session.tiendaId;
        if (!tiendaId) return res.status(400).json({ error: 'No se encontró la tienda en la sesión' });
        
        const result = await runWeeklySummary(tiendaId);
        res.json({ ok: true, mensaje: `Resumen enviado correctamente (${result.enviados} correos)` });
    } catch (error) {
        console.error('Error en test-summary:', error);
        res.status(500).json({ error: error.message || 'Error al enviar el resumen de prueba' });
    }
});

module.exports = router;
