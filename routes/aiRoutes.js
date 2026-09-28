const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { requireLogin, requireAdmin } = require('../middleware/auth');

// --- MOTOR ANALÍTICO (MATEMÁTICAS) ---
// Snapshot analítico: Velocidad de Venta y Clasificación Pareto
router.get('/snapshot', requireLogin, aiController.getAnalyticalSnapshot);

// --- MOTOR DE DECISIÓN ESTRATÉGICA (IA) ---
// Recomendaciones de abastecimiento y gestión de riesgos
router.get('/recommendations', requireLogin, aiController.getDashboardRecommendations);

// Sugerencias de promociones y liberación de capital
router.get('/promotions', requireLogin, aiController.getPromotionSuggestions);

// Aplicar estrategia sugerida (Actualización de Inventario)
router.post('/apply-strategy', requireLogin, requireAdmin, aiController.applyPromotionStrategy);

// --- AUDITORÍA Y TENDENCIAS ---
// Sugerencia dinámica de stock mínimo y de seguridad (Asistente IA)
router.get('/suggest-alerts', requireLogin, aiController.suggestStockAlerts);

// Tendencia de precios histórica (Gráfica de Variaciones IA)
router.get('/price-trend', requireLogin, aiController.getPriceTrend);

// Evaluación de Riesgo de Clientes (Fiados)
router.get('/assess-risk/:id_cliente', requireLogin, aiController.assessClientRisk);

// --- UTILIDADES ---
router.get('/ping', (req, res) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

module.exports = router;
