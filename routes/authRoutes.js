// routes/authRoutes.js
const express = require('express');
const AuthController = require('../controllers/authController');
const { sanitizeBody, validateLogin, validateRegister } = require('../middleware/validation');
const router = express.Router();

router.post('/api/login', sanitizeBody, validateLogin, AuthController.login);
router.post('/api/registro', sanitizeBody, validateRegister, AuthController.register);
router.get('/api/session-info', AuthController.getSessionInfo);
router.post('/api/logout', AuthController.logout);

// Rutas de Perfil
router.get('/api/perfil', AuthController.getProfile);
router.put('/api/perfil', AuthController.updateProfile);
router.patch('/api/perfil/modo-interfaz', sanitizeBody, AuthController.setModoInterfaz);
router.put('/api/perfil/password', AuthController.changePassword);
router.put('/api/perfil/first-password', AuthController.firstPasswordChange);

// Rutas 2FA
router.post('/api/2fa/generate', AuthController.generate2FA);
router.post('/api/2fa/verify', AuthController.verify2FA);
router.post('/api/2fa/disable', AuthController.disable2FA);

// Rutas de Recuperación
router.post('/api/forgot-password', AuthController.forgotPassword);
router.post('/api/verify-reset-code', AuthController.verifyResetCode);
router.post('/api/reset-password', AuthController.resetPasswordWithCode);

module.exports = router;