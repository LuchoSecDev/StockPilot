// routes/saleRoutes.js
const express = require('express');
const SaleController = require('../controllers/saleController');
const { requireLogin } = require('../middleware/auth');
const { sanitizeBody, validateSale, validateCartSale, validateMetodoPago } = require('../middleware/validation');
const router = express.Router();

router.get('/api/ventas', requireLogin, SaleController.getSales);
router.get('/api/ventas/stats', requireLogin, SaleController.getSalesStats);
router.post('/api/registrar-venta', requireLogin, sanitizeBody, validateSale, validateMetodoPago, SaleController.registerSale);
router.post('/api/registrar-venta-carrito', requireLogin, sanitizeBody, validateCartSale, validateMetodoPago, SaleController.registerCartSale);

module.exports = router;