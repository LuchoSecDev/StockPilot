// routes/inventoryRoutes.js
const express = require('express');
const InventoryController = require('../controllers/inventoryController');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { sanitizeBody } = require('../middleware/validation');
const router = express.Router();

// Registrar movimientos
router.post('/api/inventario/entrada', requireLogin, sanitizeBody, InventoryController.registerEntry);
// Matriz de roles (P22-10, I0): la entrada de mercancía la puede hacer el Tendero; salida y ajuste, solo el Administrador.
router.post('/api/inventario/salida', requireLogin, requireAdmin, sanitizeBody, InventoryController.registerExit);
router.post('/api/inventario/ajuste', requireLogin, requireAdmin, sanitizeBody, InventoryController.registerAdjustment);

// Consultar movimientos
router.get('/api/inventario/movimientos', requireLogin, InventoryController.getMovements);
router.get('/api/inventario/producto/:id/historial', requireLogin, InventoryController.getProductHistory);
router.get('/api/inventario/resumen', requireLogin, InventoryController.getSummary);
router.get('/api/inventario/productos', requireLogin, InventoryController.getProductList);

module.exports = router;
