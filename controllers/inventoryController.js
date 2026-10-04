// controllers/inventoryController.js
const InventoryMovement = require('../models/InventoryMovement');
const Product = require('../models/Product');
const Alert = require('../models/Alert');
const { safeError, verifyProductOwnership } = require('../utils/securityUtils');
const { ocultarDatosDeMargen } = require('../utils/datosDeMargen');

class InventoryController {
    /**
     * Registrar entrada de mercancía
     */
    static async registerEntry(req, res) {
        try {
            const { id_producto, cantidad, observacion } = req.body;
            const tiendaId = req.session.tiendaId;

            if (!id_producto || !cantidad || cantidad <= 0) {
                return res.status(400).json({ success: false, error: 'Producto y cantidad (positiva) son requeridos' });
            }

            // 🛡️ IDOR: Verificar que el producto pertenece a la tienda del usuario
            const ownership = await verifyProductOwnership(id_producto, tiendaId);
            if (!ownership) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            const result = await InventoryMovement.create({
                id_producto,
                tipo_movimiento: 'Entrada',
                cantidad: parseInt(cantidad),
                observacion: observacion || 'Entrada de mercancía',
                id_usuario: req.session.userId,
                id_tienda: tiendaId,
            });

            // Plan 17, Fase 4 (hallazgo O2): recibir mercancía cambia el nivel de stock sin que medie
            // ninguna venta. Fire-and-forget, igual que tras una venta.
            Alert.generate(tiendaId).catch(e => console.error('Error regenerando alertas post-entrada:', e));

            res.json({ success: true, message: 'Entrada registrada', data: result });
        } catch (error) {
            console.error('Error registrando entrada:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error registrando entrada') });
        }
    }

    /**
     * Registrar salida manual (fuera del módulo de ventas)
     */
    static async registerExit(req, res) {
        try {
            const { id_producto, cantidad, observacion } = req.body;
            const tiendaId = req.session.tiendaId;

            if (!id_producto || !cantidad || cantidad <= 0) {
                return res.status(400).json({ success: false, error: 'Producto y cantidad (positiva) son requeridos' });
            }

            // 🛡️ IDOR: Verificar que el producto pertenece a la tienda del usuario
            const ownership = await verifyProductOwnership(id_producto, tiendaId);
            if (!ownership) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            const result = await InventoryMovement.create({
                id_producto,
                tipo_movimiento: 'Salida',
                cantidad: parseInt(cantidad),
                observacion: observacion || 'Salida manual',
                id_usuario: req.session.userId,
                id_tienda: tiendaId,
            });

            // Plan 17, Fase 4 (hallazgo O2): una salida manual también cambia el nivel de stock.
            Alert.generate(tiendaId).catch(e => console.error('Error regenerando alertas post-salida:', e));

            res.json({ success: true, message: 'Salida registrada', data: result });
        } catch (error) {
            console.error('Error registrando salida:', error);
            res.status(400).json({ success: false, error: safeError(error, 'Error registrando salida') });
        }
    }

    /**
     * Registrar ajuste de inventario (conteo físico)
     */
    static async registerAdjustment(req, res) {
        try {
            const { id_producto, cantidad, observacion } = req.body;
            const tiendaId = req.session.tiendaId;

            if (!id_producto || cantidad === undefined || cantidad === null) {
                return res.status(400).json({ success: false, error: 'Producto y cantidad son requeridos' });
            }

            // 🛡️ IDOR: Verificar que el producto pertenece a la tienda del usuario
            const ownership = await verifyProductOwnership(id_producto, tiendaId);
            if (!ownership) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            const result = await InventoryMovement.create({
                id_producto,
                tipo_movimiento: 'Ajuste',
                cantidad: parseInt(cantidad),
                observacion: observacion || 'Ajuste por conteo físico',
                id_usuario: req.session.userId,
                id_tienda: tiendaId,
            });

            // Plan 17, Fase 4 (hallazgo O2): un ajuste por conteo físico también cambia el nivel de stock.
            Alert.generate(tiendaId).catch(e => console.error('Error regenerando alertas post-ajuste:', e));

            res.json({ success: true, message: 'Ajuste registrado', data: result });
        } catch (error) {
            console.error('Error registrando ajuste:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error registrando ajuste') });
        }
    }

    /**
     * Obtener historial de movimientos de la tienda
     */
    static async getMovements(req, res) {
        try {
            const tiendaId = req.session.tiendaId;
            const filters = {
                tipo: req.query.tipo || null,
                fechaDesde: req.query.fechaDesde || null,
                fechaHasta: req.query.fechaHasta || null,
                productoId: req.query.productoId || null,
            };

            const movimientos = await InventoryMovement.findByStore(tiendaId, filters);
            res.json({ success: true, data: movimientos });
        } catch (error) {
            console.error('Error obteniendo movimientos:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo movimientos' });
        }
    }

    /**
     * Obtener historial de un producto específico
     */
    static async getProductHistory(req, res) {
        try {
            const productId = req.params.id;
            const tiendaId = req.session.tiendaId;

            // 🛡️ IDOR: Verificar que el producto pertenece a la tienda del usuario
            const ownership = await verifyProductOwnership(productId, tiendaId);
            if (!ownership) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            const movimientos = await InventoryMovement.findByProduct(productId);
            res.json({ success: true, data: movimientos });
        } catch (error) {
            console.error('Error obteniendo historial:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo historial del producto' });
        }
    }

    /**
     * Obtener resumen de movimientos de la tienda
     */
    static async getSummary(req, res) {
        try {
            const tiendaId = req.session.tiendaId;
            const resumen = await InventoryMovement.getStoreSummary(tiendaId);
            res.json({ success: true, data: resumen });
        } catch (error) {
            console.error('Error obteniendo resumen:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo resumen' });
        }
    }

    /**
     * Obtener lista de productos para el selector del formulario
     */
    static async getProductList(req, res) {
        try {
            const tiendaId = req.session.tiendaId;
            const productos = await Product.findByStore(tiendaId);
            res.json({ success: true, data: ocultarDatosDeMargen(productos, req.session.rol) });
        } catch (error) {
            console.error('Error obteniendo productos:', error);
            res.status(500).json({ success: false, error: 'Error obteniendo productos' });
        }
    }
}

module.exports = InventoryController;
