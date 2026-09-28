const express = require('express');
const router = express.Router();
const { requireLogin, requireAdmin } = require('../middleware/auth');
const clienteController = require('../controllers/clienteController');

// Todas las rutas requieren estar autenticado
router.use(requireLogin);

// Matriz de roles (P22-10, D4): crear clientes y registrar abonos, solo el Administrador (como ya hace la interfaz).
router.post('/clientes', requireAdmin, clienteController.createCliente);
router.get('/clientes', clienteController.getClientes);
router.get('/clientes/:id', clienteController.getClienteDetalle);
router.post('/clientes/:id_cliente/abonos', requireAdmin, clienteController.registrarAbono);

module.exports = router;
