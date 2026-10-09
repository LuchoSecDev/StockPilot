// routes/internoRoutes.js — panel interno del equipo (plan 22). Se monta en /api/interno (ver app.js).
// Todo lo que muestra datos pasa por requireEquipo; solo el acceso (login y segundo factor) y la consulta de sesión quedan fuera.
const express = require('express');
const internoController = require('../controllers/internoController');
const { requireEquipo } = require('../middleware/requireEquipo');

const router = express.Router();

// Acceso (con limitadores propios, montados en app.js)
router.post('/login', internoController.login);
router.post('/2fa', internoController.segundoFactor);
router.post('/logout', internoController.logout);
router.get('/sesion', internoController.sesion);

// Métricas (solo lectura, salvo marcar una tienda como de prueba)
router.get('/tiendas', requireEquipo, internoController.tiendas);
router.get('/tiendas/:id', requireEquipo, internoController.tienda);
router.put('/tiendas/:id/es-prueba', requireEquipo, internoController.marcarPrueba);
router.get('/embudo', requireEquipo, internoController.embudo);
router.get('/bitacora', requireEquipo, internoController.bitacora);

module.exports = router;
