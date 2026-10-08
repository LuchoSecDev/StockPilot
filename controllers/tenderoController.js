// controllers/tenderoController.js
const User = require('../models/User');
const db = require('../config/database');

class TenderoController {
    static async getTenderos(req, res) {
        try {
            const tiendaId = req.session.tiendaId;

            if (!tiendaId) {
                return res.status(400).json({ success: false, error: "No se pudo identificar la tienda" });
            }

            const tenderos = await User.findTenderosByStore(tiendaId);
            res.json(tenderos);
        } catch (error) {
            console.error('Error obteniendo tenderos:', error);
            res.status(500).json({ success: false, error: "Error obteniendo tenderos" });
        }
    }

    static async createTendero(req, res) {
        try {
            const { nombres, genero, correo, celular, usuario, contrasena } = req.body;
            const id_tienda = req.session.tiendaId;

            if (!id_tienda) {
                return res.status(400).json({ success: false, error: "No se pudo obtener la tienda del usuario" });
            }

            if (!nombres || !usuario || !contrasena || !correo) {
                return res.status(400).json({ success: false, error: "Faltan campos obligatorios" });
            }

            // 🛡️ OWASP A04: Validar longitud mínima de contraseña
            if (contrasena.length < 8) {
                return res.status(400).json({ success: false, error: "La contraseña debe tener al menos 8 caracteres" });
            }

            const userData = {
                nombres,
                genero,
                correo,
                celular,
                usuario,
                contrasena, // bcrypt se aplica dentro de User.create()
                rol: 'Tendero',
                id_tienda,
                cambio_clave_forzoso: 1
            };

            const userId = await User.create(userData);
            res.json({ success: true, id_usuario: userId });
        } catch (error) {
            console.error('Error creando tendero:', error);
            
            if (error.code === '23505' || (error.message && (error.message.includes('UNIQUE constraint failed') || error.message.includes('duplicate key value') || error.message.includes('llave duplicada')))) {
                return res.status(400).json({ success: false, error: "El correo o usuario ya existe" });
            }
            
            res.status(500).json({ success: false, error: "Error registrando tendero" });
        }
    }

    static async updateTendero(req, res) {
        try {
            const tenderoId = req.params.id;
            const tiendaId = req.session.tiendaId;
            const { nombres, genero, correo, celular, usuario } = req.body;

            // 🛡️ IDOR: Verificar que el tendero pertenece a la tienda del admin
            const tendero = await db.getAsync(
                'SELECT id_usuario FROM Usuarios WHERE id_usuario = ? AND id_tienda = ? AND rol = ?',
                [tenderoId, tiendaId, 'Tendero']
            );
            if (!tendero) {
                return res.status(404).json({ success: false, error: "Tendero no encontrado" });
            }

            const success = await User.update(tenderoId, {
                nombres, genero, correo, celular, usuario
            });

            if (!success) {
                return res.status(404).json({ success: false, error: "Tendero no encontrado" });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error actualizando tendero:', error);
            res.status(500).json({ success: false, error: "Error actualizando tendero" });
        }
    }

    static async deleteTendero(req, res) {
        try {
            const tenderoId = req.params.id;
            const tiendaId = req.session.tiendaId;

            const success = await User.delete(tenderoId, tiendaId);

            if (!success) {
                return res.status(404).json({ success: false, error: "Tendero no encontrado" });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error eliminando tendero:', error);
            res.status(500).json({ success: false, error: "Error eliminando tendero" });
        }
    }
}

module.exports = TenderoController;
