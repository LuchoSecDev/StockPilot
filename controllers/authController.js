// controllers/authController.js
const User = require('../models/User');
const Store = require('../models/Store');
const crypto = require('crypto'); // Para generar tokens aleatorios
const Mailer = require('../utils/mailer'); // Servicio de envíos de correo
const { safeError } = require('../utils/securityUtils');
const { canalDesdeCabecera, canalDeSesion } = require('../utils/canal');
const { sesionSigueViva } = require('../utils/candadoSesion');
const { refrescarAlertasAlEntrar } = require('../services/alertas/refrescoAlEntrar');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');

class AuthController {
    static async login(req, res) {
        try {
            const { login, password } = req.body;
            console.log(`--- LOGIN ATTEMPT: ${login} ---`);

            if (!login || !password) {
                console.warn('Login fallido: Faltan campos');
                return res.status(400).json({ 
                    success: false, 
                    error: 'Faltan campos obligatorios' 
                });
            }

            // Canal de la sesión (web por defecto; la app nativa manda X-Canal: app). Se lee SOLO aquí.
            const canal = canalDesdeCabecera(req);

            console.log('Buscando usuario en BD...');
            const user = await User.findByCredentials(login, password);
            
            if (!user) {
                console.warn('Login fallido: Usuario no encontrado o clave incorrecta');
                return res.status(401).json({ 
                    success: false, 
                    error: 'Usuario/correo o contraseña incorrectos' 
                });
            }

            console.log('Login exitoso: Usuario encontrado. Regenerando ID de sesión...');
            
            // Regenerar Session ID para prevenir Session Fixation (OWASP A07)
            await new Promise((resolve, reject) => {
                req.session.regenerate((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });

            if (!user.id_tienda) {
                console.error('ERROR: Usuario sin tienda detectado en login exitoso');
                return res.status(401).json({ 
                    success: false, 
                    error: 'Usuario no tiene tienda asignada' 
                });
            }

            // Bloquear segundo login (solo para Tenderos), DENTRO del mismo canal: una sesión web y una
            // sesión app del mismo Tendero pueden convivir; `force` solo invalida la de este canal.
            const { force } = req.body;
            // El candado solo bloquea mientras su sesión siga VIVA: si caducó (30 min sin actividad) sin cerrar sesión,
            // ya no hay nada que proteger y el login lo reemplaza (utils/candadoSesion.js). Ante un fallo del almacén se
            // conserva el bloqueo.
            const sesionActivaDelCanal = canal === 'app' ? user.session_id_app : user.session_id;
            if (user.rol !== 'Administrador' && sesionActivaDelCanal && !force
                && await sesionSigueViva(req.sessionStore, sesionActivaDelCanal)) {
                return res.status(409).json({
                    success: false,
                    error: 'Ya hay una sesión activa para este usuario en otro dispositivo.',
                    code: 'SESSION_ACTIVE'
                });
            }

            // Obtener estado 2FA de la base de datos
            const twoFactorData = await User.get2FASecret(user.id_usuario);
            const is2FAEnabled = twoFactorData && twoFactorData.two_factor_enabled;
            const isAdmin = user.rol === 'Administrador';

            if (is2FAEnabled) {
                // Guardar en sesión que el usuario está pendiente de verificar 2FA
                req.session.pending2FA_userId = user.id_usuario;
                req.session.pending2FA_tiendaId = user.id_tienda;
                req.session.pending2FA_rol = user.rol;
                const isCambioForzoso = Boolean(user.cambio_clave_forzoso && user.cambio_clave_forzoso !== '0' && user.cambio_clave_forzoso !== 'false');
                req.session.pending2FA_nombres = user.nombres;
                req.session.pending2FA_cambio_clave = isCambioForzoso;
                req.session.pending2FA_canal = canal; // el canal se fija en el paso de contraseña, no en el del código

                return res.json({
                    success: true,
                    require2FA: true,
                    message: 'Se requiere código de verificación 2FA'
                });
            }

            // Si es administrador y NO tiene 2FA, debe configurarlo.
            // Lo dejamos pasar pero le avisamos al frontend.
            const needs2FASetup = isAdmin && !is2FAEnabled;
            const isCambioForzoso = Boolean(user.cambio_clave_forzoso && user.cambio_clave_forzoso !== '0' && user.cambio_clave_forzoso !== 'false');

            req.session.userId = user.id_usuario;
            req.session.tiendaId = user.id_tienda;
            req.session.rol = user.rol;
            req.session.nombres = user.nombres;
            req.session.cambio_clave_forzoso = isCambioForzoso;
            req.session.canal = canal;

            // Registrar la sesión activa en la BD (candado del canal correspondiente)
            await User.setCurrentSession(user.id_usuario, req.sessionID, canal);

            // Recalcular las alertas de la tienda ANTES de responder, para que el Dashboard que se abre ahora no diga
            // «Inventario Óptimo» con una foto vieja. Nunca hace fallar el login (services/alertas/refrescoAlEntrar.js).
            await refrescarAlertasAlEntrar(user.id_tienda);

            console.log('Sesión establecida correctamente. Enviando respuesta...');

            res.json({ 
                success: true, 
                message: 'Login exitoso',
                user: {
                    nombres: user.nombres,
                    rol: user.rol,
                    cambioClaveForzoso: isCambioForzoso,
                    needs2FASetup: needs2FASetup
                }
            });
        } catch (error) {
            console.error('❌ ERROR FATAL EN LOGIN:', error);
            res.status(500).json({ 
                success: false, 
                error: safeError(error, 'Error interno del servidor') 
            });
        }
    }

    static async register(req, res) {
        let storeId = null; // Fix #4: declarar fuera del try para el rollback

        try {
            const {
                name, gender, email, phone,
                store_name, store_address, username, password, acepta_politica_datos
            } = req.body;

            if (!name || !email || !username || !password || !store_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Todos los campos son obligatorios'
                });
            }

            if (!acepta_politica_datos) {
                return res.status(400).json({
                    success: false,
                    error: 'Debes aceptar la Política de Tratamiento de Datos para registrarte'
                });
            }

            // 🛡️ OWASP: Validación estricta de formato de correo (Mitigación Email Injection)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'El formato del correo electrónico no es válido' 
                });
            }

            if (password.length < 8) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'La contraseña debe tener al menos 8 caracteres por seguridad' 
                });
            }

            // Crear la tienda primero
            const storeData = {
                nombre_establecimiento: store_name,
                direccion: store_address,
                anio_creacion: new Date().getFullYear()
            };
            
            storeId = await Store.create(storeData);

            // Crear el usuario administrador
            const userData = {
                nombres: name,
                genero: gender,
                correo: email,
                celular: phone,
                usuario: username,
                contrasena: password, // bcrypt se aplica dentro de User.create()
                rol: 'Administrador',
                id_tienda: storeId,
                aceptaPoliticaDatos: true
            };

            const userId = await User.create(userData);

            // Actualizar la tienda para asignarle el propietario (el usuario recién creado)
            const db = require('../config/database');
            await db.runAsync(`UPDATE Tienda SET id_propietario = ? WHERE id_tienda = ?`, [userId, storeId]);

            // Establecer sesión
            req.session.userId = userId;
            req.session.tiendaId = storeId;
            req.session.rol = 'Administrador';
            req.session.nombres = name;

            res.json({ 
                success: true, 
                message: 'Registro exitoso. Redirigiendo...',
                redirect: '/ventana_tiendas.html'
            });

        } catch (error) {
            console.error('Error en registro:', error);
            
            // Rollback: eliminar la tienda creada si el usuario no se pudo crear
            if (storeId) {
                try {
                    await Store.delete(storeId);
                } catch (deleteError) {
                    console.error('Error eliminando tienda en rollback:', deleteError);
                }
            }

            if (error.message && (error.message.includes('UNIQUE constraint failed') || error.message.includes('duplicate key value'))) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'El correo o usuario ya existe' 
                });
            }

            res.status(500).json({ 
                success: false, 
                error: safeError(error, 'Error en el registro') 
            });
        }
    }

    static async getSessionInfo(req, res) {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, error: "Sesión no iniciada" });
        }

        try {
            const tienda = await Store.findById(req.session.tiendaId);
            const user = await User.findById(req.session.userId);
            const isAdmin = req.session.rol === 'Administrador';
            const is2FAEnabled = user && user.two_factor_enabled;
            
            res.json({
                success: true,
                userId: req.session.userId,
                tiendaId: req.session.tiendaId,
                tiendaNombre: tienda ? tienda.nombre_establecimiento : 'Sin tienda',
                limiteEgresoTendero: tienda ? (tienda.limite_egreso_tendero || 150000) : 150000,
                rol: req.session.rol,
                nombres: req.session.nombres,
                cambioClaveForzoso: Boolean(req.session.cambio_clave_forzoso),
                needs2FASetup: isAdmin && !is2FAEnabled,
                is2FAEnabled: is2FAEnabled,
                modoInterfaz: user ? user.modo_interfaz : 'avanzado'
            });
        } catch (error) {
            console.error('Error en getSessionInfo:', error);
            res.status(500).json({ success: false, error: 'Error al obtener sesión' });
        }
    }

    static async getProfile(req, res) {
        try {
            const userId = req.session.userId;
            if (!userId) return res.status(401).json({ success: false, error: 'No autorizado' });

            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

            res.json({ success: true, user });
        } catch (error) {
            console.error('Error obteniendo perfil:', error);
            res.status(500).json({ success: false, error: 'Error del servidor' });
        }
    }

    static async updateProfile(req, res) {
        try {
            const userId = req.session.userId;
            if (!userId) return res.status(401).json({ success: false, error: 'No autorizado' });

            const { nombres, genero, correo, celular, usuario, foto_url } = req.body;
            
            const success = await User.update(userId, { nombres, genero, correo, celular, usuario, foto_url });
            
            if (success) {
                // Actualizar nombres en sesión por si cambiaron
                req.session.nombres = nombres;
                res.json({ success: true, message: 'Perfil actualizado correctamente' });
            } else {
                res.status(400).json({ success: false, error: 'No se pudo actualizar el perfil' });
            }
        } catch (error) {
            console.error('Error actualizando perfil:', error);
            res.status(500).json({ success: false, error: 'Error del servidor' });
        }
    }

    // PATCH /api/perfil/modo-interfaz  { modo: 'basico' | 'avanzado' }
    // Solo la propia cuenta (el id sale de la sesión, nunca del cuerpo): cambia qué menú ve, no lo que puede hacer.
    // El modo no concede ni quita permisos; las rutas siguen protegidas por rol como siempre (plan 19, 3.4.3, fase B).
    static async setModoInterfaz(req, res) {
        try {
            const userId = req.session.userId;
            if (!userId) return res.status(401).json({ success: false, error: 'No autorizado' });

            const modo = req.body && req.body.modo;
            if (!User.MODOS_INTERFAZ.includes(modo)) {
                return res.status(400).json({ success: false, error: "El modo debe ser 'basico' o 'avanzado'" });
            }

            const actualizado = await User.setModoInterfaz(userId, modo);
            if (!actualizado) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

            res.json({ success: true, modoInterfaz: modo });
        } catch (error) {
            console.error('Error cambiando el modo de interfaz:', error);
            res.status(500).json({ success: false, error: 'Error del servidor' });
        }
    }

    static async changePassword(req, res) {
        try {
            const userId = req.session.userId;
            if (!userId) return res.status(401).json({ success: false, error: 'No autorizado' });

            const { currentPassword, newPassword } = req.body;

            if (currentPassword === newPassword) {
                return res.status(400).json({ success: false, error: 'La nueva contraseña no puede ser igual a la que tienes asignada actualmente.' });
            }

            // Verificar contraseña actual
            // findById no trae la contraseña por seguridad: se consulta el hash directamente.
            const query = `SELECT contrasena FROM Usuarios WHERE id_usuario = ?`;
            const db = require('../config/database');
            const row = await db.getAsync(query, [userId]);
            
            const isMatch = await require('bcrypt').compare(currentPassword, row.contrasena);
            if (!isMatch) {
                return res.status(400).json({ success: false, error: 'La contraseña actual es incorrecta' });
            }

            if (newPassword.length < 8) {
                return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' });
            }

            await User.updatePassword(userId, newPassword);
            res.json({ success: true, message: 'Contraseña cambiada exitosamente' });
        } catch (error) {
            console.error('Error cambiando contraseña:', error);
            res.status(500).json({ success: false, error: 'Error del servidor' });
        }
    }

    static async firstPasswordChange(req, res) {
        try {
            const userId = req.session.userId;
            if (!userId) return res.status(401).json({ success: false, error: 'No autorizado' });

            if (!req.session.cambio_clave_forzoso) {
                return res.status(400).json({ success: false, error: 'Acción no permitida' });
            }

            const { newPassword } = req.body;
            if (!newPassword || newPassword.length < 8) {
                return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' });
            }

            const query = `SELECT contrasena FROM Usuarios WHERE id_usuario = ?`;
            const db = require('../config/database');
            const row = await db.getAsync(query, [userId]);

            if (row && row.contrasena) {
                const isMatch = await require('bcrypt').compare(newPassword, row.contrasena);
                if (isMatch) {
                    return res.status(400).json({ success: false, error: 'La nueva contraseña no puede ser igual a la que tienes asignada actualmente.' });
                }
            }

            await User.updatePassword(userId, newPassword);
            req.session.cambio_clave_forzoso = false;

            res.json({ success: true, message: 'Contraseña establecida exitosamente' });
        } catch (error) {
            console.error('Error estableciendo primera contraseña:', error);
            res.status(500).json({ success: false, error: 'Error del servidor' });
        }
    }

    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email) return res.status(400).json({ success: false, error: 'Correo es requerido' });

            // 🛡️ OWASP: Validación estricta (Mitigación Email Injection / SMTP Abuse)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ success: false, error: 'Formato de correo inválido' });
            }

            const user = await User.findByEmail(email);
            if (!user) {
                // Por seguridad, no decimos si el correo existe o no
                return res.json({ success: true, message: 'Si el correo existe, se ha enviado un código' });
            }

            // 🛡️ OWASP A02: Generar código de 6 dígitos con CSPRNG (no Math.random)
            const code = crypto.randomInt(100000, 999999).toString();
            const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

            await User.setResetToken(user.id_usuario, code, expires);

            // ENVÍO DE CORREO MEDIANTE NODEMAILER
            const emailEnviado = await Mailer.sendPasswordResetCode(user.correo, code);

            if (!emailEnviado) {
                // 🛡️ Ocultamos el código en consola para evitar exposición en logs
                console.warn("⚠️ Aviso: El correo SMTP falló y no se pudo enviar el código de recuperación al usuario.");
            }

            // Respuesta segura (sin filtrar el código al cliente)
            res.json({ 
                success: true, 
                message: 'Se ha enviado un código de seguridad a su correo electrónico.' 
            });
        } catch (error) {
            console.error('Error en forgotPassword:', error);
            res.status(500).json({ success: false, error: 'Error del servidor' });
        }
    }

    static async verifyResetCode(req, res) {
        try {
            const { email, code } = req.body;
            const user = await User.verifyResetToken(email, code);
            
            if (!user) {
                return res.status(400).json({ success: false, error: 'Código inválido o expirado' });
            }

            res.json({ success: true, message: 'Código verificado' });
        } catch (error) {
            console.error('Error en verifyResetCode:', error);
            res.status(500).json({ success: false, error: 'Error del servidor' });
        }
    }

    static async resetPasswordWithCode(req, res) {
        try {
            const { email, code, newPassword } = req.body;

            // 🛡️ Validar longitud mínima de contraseña (OWASP A04)
            if (!newPassword || newPassword.length < 8) {
                return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' });
            }

            const user = await User.verifyResetToken(email, code);
            
            if (!user) {
                return res.status(400).json({ success: false, error: 'Código inválido o expirado' });
            }

            await User.updatePassword(user.id_usuario, newPassword);
            await User.clearResetToken(user.id_usuario);

            res.json({ success: true, message: 'Tu contraseña ha sido restablecida exitosamente' });
        } catch (error) {
            console.error('Error en resetPasswordWithCode:', error);
            res.status(500).json({ success: false, error: 'Error del servidor' });
        }
    }

    static async logout(req, res) {
        if (req.session && req.session.userId) {
            try {
                // Limpiar el candado del canal de ESTA sesión al salir voluntariamente (y solo si todavía
                // es el suyo: una sesión vieja invalidada por `force` no debe borrar el de la nueva).
                await User.releaseCurrentSession(req.session.userId, req.sessionID, canalDeSesion(req.session));
            } catch (error) {
                console.error('Error limpiando session_id en logout:', error);
            }
        }
        
        req.session.destroy(() => {
            res.status(200).json({ success: true, message: 'Sesión cerrada' });
        });
    }

    // ==========================================
    // MÉTODOS 2FA
    // ==========================================

    static async generate2FA(req, res) {
        try {
            const userId = req.session.userId;
            if (!userId) return res.status(401).json({ success: false, error: 'No autorizado' });

            // Con el 2FA ya activo NO se regenera: cambiaría el secreto con solo tener la sesión (sin contraseña
            // ni código) y dejaría fuera al dueño legítimo. Para cambiarlo hay que desactivarlo antes.
            if (await User.is2FAEnabled(userId)) {
                return res.status(409).json({ success: false, code: 'DOS_FACTORES_YA_ACTIVO', error: 'La verificación en dos pasos ya está activa en tu cuenta.' });
            }

            const secret = authenticator.generateSecret();
            const email = req.session.nombres; // o el correo
            const otpauthUrl = authenticator.keyuri(email, 'StockPilot', secret);

            // Guardar secreto temporalmente o permanentemente pero desactivado
            await User.set2FASecret(userId, secret);

            // Generar QR
            const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

            res.json({ success: true, qrCode: qrCodeDataUrl, secret });
        } catch (error) {
            console.error('Error generando 2FA:', error);
            res.status(500).json({ success: false, error: 'Error generando 2FA' });
        }
    }

    static async verify2FA(req, res) {
        try {
            // Este método sirve tanto para habilitar 2FA desde el perfil, como para completar un login.
            const isLoginAttempt = !!req.session.pending2FA_userId;
            const userId = isLoginAttempt ? req.session.pending2FA_userId : req.session.userId;

            if (!userId) {
                return res.status(401).json({ success: false, error: 'No autorizado o sesión expirada' });
            }

            const { token } = req.body;
            if (!token) return res.status(400).json({ success: false, error: 'Token es requerido' });

            const twoFactorData = await User.get2FASecret(userId);
            if (!twoFactorData || !twoFactorData.two_factor_secret) {
                return res.status(400).json({ success: false, error: 'El secreto 2FA no está configurado.' });
            }

            const isValid = authenticator.check(token, twoFactorData.two_factor_secret);

            if (!isValid) {
                return res.status(401).json({ success: false, error: 'Código inválido o ha expirado.' });
            }

            if (isLoginAttempt) {
                // Completar el login
                req.session.userId = req.session.pending2FA_userId;
                req.session.tiendaId = req.session.pending2FA_tiendaId;
                req.session.rol = req.session.pending2FA_rol;
                req.session.nombres = req.session.pending2FA_nombres;
                req.session.cambio_clave_forzoso = req.session.pending2FA_cambio_clave;
                req.session.canal = req.session.pending2FA_canal === 'app' ? 'app' : 'web';

                // Limpiar temporales
                delete req.session.pending2FA_userId;
                delete req.session.pending2FA_tiendaId;
                delete req.session.pending2FA_rol;
                delete req.session.pending2FA_nombres;
                delete req.session.pending2FA_cambio_clave;
                delete req.session.pending2FA_canal;

                await User.setCurrentSession(userId, req.sessionID, req.session.canal);

                // Igual que en el login sin 2FA: alertas al día antes de que la persona vea el Dashboard.
                await refrescarAlertasAlEntrar(req.session.tiendaId);

                return res.json({ 
                    success: true, 
                    message: 'Login completado exitosamente',
                    user: {
                        nombres: req.session.nombres,
                        rol: req.session.rol,
                        cambioClaveForzoso: req.session.cambio_clave_forzoso,
                        needs2FASetup: false
                    }
                });
            } else {
                // Habilitando desde el perfil
                await User.enable2FA(userId);
                return res.json({ success: true, message: 'Autenticación de dos factores activada.' });
            }
        } catch (error) {
            console.error('Error verificando 2FA:', error);
            res.status(500).json({ success: false, error: 'Error del servidor' });
        }
    }

    static async disable2FA(req, res) {
        try {
            const userId = req.session.userId;
            if (!userId) return res.status(401).json({ success: false, error: 'No autorizado' });

            // Extraer y validar contraseña para evitar bypass de seguridad
            const { password } = req.body;
            if (!password) {
                return res.status(400).json({ success: false, error: 'Debe proporcionar su contraseña para desactivar el 2FA.' });
            }

            const isPasswordValid = await User.verifyPasswordById(userId, password);
            if (!isPasswordValid) {
                return res.status(401).json({ success: false, error: 'Contraseña incorrecta. No se pudo desactivar el 2FA.' });
            }

            // Solo permitimos desactivarlo si el usuario no es admin (o si es admin, podríamos bloquearlo,
            // pero el requerimiento dice obligatorio para admin, así que lo bloqueamos para admin).
            if (req.session.rol === 'Administrador') {
                return res.status(403).json({ success: false, error: 'Los administradores no pueden desactivar el 2FA por políticas de seguridad.' });
            }

            await User.disable2FA(userId);
            res.json({ success: true, message: 'Autenticación de dos factores desactivada.' });
        } catch (error) {
            console.error('Error desactivando 2FA:', error);
            res.status(500).json({ success: false, error: 'Error del servidor' });
        }
    }
}

module.exports = AuthController;