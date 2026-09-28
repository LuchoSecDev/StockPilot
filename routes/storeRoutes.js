const express = require('express');
const StoreController = require('../controllers/storeController');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/api/tienda', requireLogin, StoreController.getStoreInfo);
// Plan 22, hallazgo 1.4: el controlador solo verificaba que la tienda fuera la del usuario, no
// su rol — un Tendero podía, desde la API (aunque la interfaz no le muestre el botón), cambiar
// los datos del negocio, subir su propio limite_egreso_tendero o desactivar la tienda.
router.put('/api/tienda/update/:id', requireLogin, requireAdmin, StoreController.updateStore);
router.put('/api/tienda/estado/:id', requireLogin, requireAdmin, StoreController.toggleStoreStatus);

// Multi-tienda
router.get('/api/tiendas', requireLogin, requireAdmin, StoreController.getAllStores);
router.post('/api/tiendas', requireLogin, requireAdmin, StoreController.createStore);
router.post('/api/tiendas/switch/:id', requireLogin, requireAdmin, StoreController.switchStore);

module.exports = router;