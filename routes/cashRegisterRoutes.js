const express = require('express');
const router = express.Router();
const cashRegisterController = require('../controllers/cashRegisterController');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/validation');

router.get('/api/caja/sesion', requireLogin, cashRegisterController.getCurrentSession);
router.post('/api/caja/abrir', requireLogin, sanitizeBody, cashRegisterController.openSession);
router.post('/api/caja/arqueo-previo', requireLogin, sanitizeBody, cashRegisterController.previewClose);
router.post('/api/caja/cerrar', requireLogin, sanitizeBody, cashRegisterController.closeSession);
router.get('/api/caja/historial', requireLogin, cashRegisterController.getHistory);

// Rutas de Egresos / Gastos Menores
router.post('/api/caja/egreso', requireLogin, sanitizeBody, cashRegisterController.registerExpense);
router.get('/api/caja/egresos', requireLogin, cashRegisterController.getExpenses);
// Aprobar/rechazar: solo el Administrador (P22-09). El controlador además exige que el egreso sea de su tienda.
router.put('/api/caja/egreso/:id/aprobar', requireLogin, requireAdmin, cashRegisterController.approveExpense);
router.put('/api/caja/egreso/:id/rechazar', requireLogin, requireAdmin, cashRegisterController.rejectExpense);

module.exports = router;
