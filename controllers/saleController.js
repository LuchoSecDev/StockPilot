/**
 * @file saleController.js
 * @description Controlador para la gestión de ventas y movimientos de inventario.
 * Implementa lógica de transacciones atómicas para garantizar la integridad del stock
 * y la trazabilidad completa mediante MovimientosStock.
 * 
 * @module controllers/saleController
 */

const Sale = require('../models/Sale');
const Product = require('../models/Product');
const db = require('../config/database');
const Alert = require('../models/Alert');
const Notification = require('../models/Notification');
const { canalDeSesion } = require('../utils/canal');

/** Error de validación de negocio dentro de una transacción de venta: lleva su código HTTP. */
class ErrorVenta extends Error {
    constructor(status, mensaje) {
        super(mensaje);
        this.status = status;
    }
}

const formatoPesos = (n) => `$${Math.round(Number(n)).toLocaleString('es-CO')}`;

/**
 * Valida, DENTRO de la transacción de la venta, el cliente al que se le asocia (o fía):
 *  - Tiene que ser un cliente de la tienda de la sesión (antes se aceptaba el de cualquier tienda).
 *  - Si la venta es fiada y el cliente tiene un cupo (limite_credito > 0), el saldo que ya debe más esta
 *    venta no puede superarlo. Un cupo de 0 es el valor por defecto al crear un cliente y significa
 *    «sin tope» (decisión de negocio pendiente: la web nunca lo trató como «sin crédito»).
 * Bloquea la fila del cliente (FOR UPDATE): dos ventas fiadas simultáneas al mismo cliente se serializan,
 * así que no pueden pasarse del cupo entre las dos. El saldo se calcula igual que en la cartera
 * (clienteController.getClientes): ventas fiadas menos abonos.
 * @throws {ErrorVenta} 404 si el cliente no existe o es de otra tienda; 400 si supera el cupo.
 */
async function validarClienteDeVenta(client, { id_cliente, id_tienda, esFiado, totalVenta }) {
    if (!id_cliente) return;
    const idNumerico = Number(id_cliente);
    if (!Number.isInteger(idNumerico) || idNumerico <= 0) throw new ErrorVenta(404, 'Cliente no encontrado');

    const { rows } = await client.query(
        'SELECT limite_credito FROM Clientes WHERE id_cliente = ? AND id_tienda = ? FOR UPDATE',
        [idNumerico, id_tienda]
    );
    if (!rows.length) throw new ErrorVenta(404, 'Cliente no encontrado');

    const cupo = Number(rows[0].limite_credito) || 0;
    if (!esFiado || cupo <= 0) return;

    const { rows: saldoRows } = await client.query(
        `SELECT COALESCE((SELECT SUM(precio_total) FROM Ventas WHERE id_cliente = ? AND metodo_pago = 'Fiado'), 0)
              - COALESCE((SELECT SUM(monto) FROM Abonos WHERE id_cliente = ?), 0) AS saldo`,
        [idNumerico, idNumerico]
    );
    const saldo = Number(saldoRows[0].saldo);
    if (saldo + totalVenta > cupo) {
        throw new ErrorVenta(400,
            `Esta venta supera el cupo de crédito del cliente (cupo ${formatoPesos(cupo)}, ya debe ${formatoPesos(saldo)}, esta venta ${formatoPesos(totalVenta)}).`);
    }
}

/**
 * Sale Controller
 * Gestiona el ciclo de vida de una venta: validación, registro y actualización de inventario.
 */
class SaleController {
  /**
   * Obtiene la lista de ventas de una tienda con paginación.
   * 
   * @async
   * @function getSales
   * @param {import('express').Request} req - Objeto de petición Express.
   * @param {import('express').Response} res - Objeto de respuesta Express.
   */
  static async getSales(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;

            // ?turno=actual: solo las ventas de la caja abierta del usuario (para la app del Tendero).
            // Sin caja abierta, la lista queda vacía. Cualquier otro valor es un error del cliente.
            const filtros = {};
            if (req.query.turno !== undefined) {
                if (req.query.turno !== 'actual') {
                    return res.status(400).json({ success: false, error: 'El parámetro turno solo admite el valor «actual».' });
                }
                const CashRegister = require('../models/CashRegister');
                const caja = await CashRegister.getCurrentSession(id_tienda, req.session.userId);
                if (!caja) {
                    return res.json({ data: [], total: 0, limit, offset, hasMore: false });
                }
                filtros.idSesionCaja = caja.id_sesion;
            }

            const [ventas, total] = await Promise.all([
                Sale.findByStore(id_tienda, limit, offset, filtros),
                Sale.countByStore(id_tienda, filtros)
            ]);

            res.json({
                data: ventas,
                total: total,
                limit: limit,
                offset: offset,
                hasMore: offset + limit < total
            });
        } catch (error) {
            console.error('Error obteniendo ventas:', error);
            res.status(500).json({ success: false, error: "Error consultando ventas" });
        }
    }

    /**
     * Obtiene estadísticas agregadas de ventas para la tienda actual.
     * 
     * @async
     * @function getSalesStats
     * @param {import('express').Request} req - Objeto de petición Express.
     * @param {import('express').Response} res - Objeto de respuesta Express.
     */
    static async getSalesStats(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const stats = await Sale.getSalesStats(id_tienda);
            res.json(stats);
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            res.status(500).json({ success: false, error: "Error obteniendo estadísticas" });
        }
    }

    /**
     * Registra una nueva venta de forma atómica.
     * Realiza validación de stock, creación de registro de venta, detalle de productos
     * y actualización de inventario dentro de una sola transacción de base de datos.
     * 
     * @async
     * @function registerSale
     * @param {import('express').Request} req - Objeto de petición Express. Debe contener id_producto y cantidad.
     * @param {import('express').Response} res - Objeto de respuesta Express.
     * @returns {Promise<void>}
     */
    static async registerSale(req, res) {
        try {
            const { id_producto, cantidad, metodo_pago, efectivo_recibido, id_cliente } = req.body;
            const id_vendedor = req.session.userId;
            const id_tienda = req.session.tiendaId;

            if (!id_vendedor || !id_tienda) {
                return res.status(401).json({ success: false, error: "Sesión no válida" });
            }

            if (metodo_pago === 'Fiado' && !id_cliente) {
                return res.status(400).json({ success: false, error: "El cliente es obligatorio para ventas fiadas." });
            }

            const CashRegister = require('../models/CashRegister');
            const activeSession = await CashRegister.getCurrentSession(id_tienda, id_vendedor);
            if (!activeSession) {
                return res.status(403).json({ success: false, error: "Debes abrir tu caja antes de realizar ventas." });
            }

            // Iniciar transacción de BD (Patrón Postgres Client)
            const client = await db.getClient();

            try {
                await client.query('BEGIN');

                // 1. Obtener información del producto DENTRO de la transacción y bloquear la fila para evitar Race Conditions (SELECT ... FOR UPDATE)
                const prodResult = await client.query('SELECT cantidad, precio FROM Productos WHERE id_producto = ? AND id_tienda = ? FOR UPDATE', [id_producto, id_tienda]);
                const producto = prodResult.rows[0];
                
                if (!producto) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ success: false, error: "Producto no encontrado o no pertenece a tu tienda" });
                }

                if (producto.cantidad < cantidad) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ success: false, error: "Stock insuficiente para la venta" });
                }

                const total = producto.precio * cantidad;
                const metodo = metodo_pago || 'Efectivo';
                const recibido = efectivo_recibido || total;
                const cambio = recibido >= total ? recibido - total : 0;

                try {
                    await validarClienteDeVenta(client, { id_cliente, id_tienda, esFiado: metodo === 'Fiado', totalVenta: total });
                } catch (errorCliente) {
                    if (!(errorCliente instanceof ErrorVenta)) throw errorCliente;
                    await client.query('ROLLBACK');
                    return res.status(errorCliente.status).json({ success: false, error: errorCliente.message });
                }

                // 2. Registrar la venta principal
                const estado_deuda = metodo === 'Fiado' ? 'Pendiente' : 'Pagado';
                const id_cliente_val = id_cliente || null;

                const saleInsert = await client.query(
                    `INSERT INTO Ventas (id_vendedor, id_tienda, precio_total, fecha_salida, id_sesion_caja, metodo_pago, efectivo_recibido, cambio_devuelto, id_cliente, estado_deuda, canal) 
                     VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?) RETURNING id_venta`,
                    [id_vendedor, id_tienda, total, activeSession.id_sesion, metodo, recibido, cambio, id_cliente_val, estado_deuda, canalDeSesion(req.session)]
                );
                const id_venta = saleInsert.rows[0].id_venta;

                // 3. Registrar detalle de venta
                await client.query(
                    `INSERT INTO VentasProductos (id_venta, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`,
                    [id_venta, id_producto, cantidad, producto.precio]
                );

                // 4. Descontar stock Y registrar movimiento
                const stockFinalResult = producto.cantidad - cantidad;

                // Descontar del producto
                await client.query('UPDATE Productos SET cantidad = ? WHERE id_producto = ?', [stockFinalResult, id_producto]);

                // Registrar movimiento con saldo final
                // printf -> LPAD en Postgres
                await client.query(
                    `INSERT INTO MovimientosStock (id_producto, tipo_movimiento, cantidad, stock_final, fecha_movimiento, observacion, id_usuario, id_tienda)
                     VALUES (?, 'Salida', ?, ?, CURRENT_TIMESTAMP, 'Venta #' || LPAD(?::text, 6, '0'), ?, ?)`,
                    [id_producto, cantidad, stockFinalResult, id_venta, id_vendedor, id_tienda]
                );

                await client.query('COMMIT');
                res.json({ success: true, message: "Venta procesada y stock actualizado" });

                // Evaluamos las metas diarias de forma asíncrona
                SaleController._checkSalesGoals(id_tienda, id_vendedor).catch(e => console.error('Error metas:', e));

                // Regenerar alertas en background sin bloquear la respuesta
                Alert.generate(id_tienda).catch(e => console.error('Error regenerando alertas post-venta:', e));

            } catch (txError) {
                await client.query('ROLLBACK');
                throw txError;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Error en proceso de venta:', error);
            res.status(500).json({ success: false, error: "Error interno procesando la transacción" });
        }
    }

    /**
     * Registra una venta de múltiples productos (Carrito de compras).
     * @async
     * @function registerCartSale
     * @param {import('express').Request} req - Debe contener un array 'items' con {id_producto, cantidad}.
     * @param {import('express').Response} res
     */
    static async registerCartSale(req, res) {
        try {
            const { items, metodo_pago, efectivo_recibido, id_cliente } = req.body;
            console.log("PAYLOAD RECEIVED FOR CART SALE:", req.body);
            const id_vendedor = req.session.userId;
            const id_tienda = req.session.tiendaId;

            if (!id_vendedor || !id_tienda) {
                return res.status(401).json({ success: false, error: "Sesión no válida" });
            }
            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, error: "El carrito está vacío" });
            }
            
            if (metodo_pago === 'Fiado' && !id_cliente) {
                console.log("ERROR: Cliente no recibido para venta fiada. Payload era:", req.body);
                return res.status(400).json({ success: false, error: "El cliente es obligatorio para ventas fiadas." });
            }

            const CashRegister = require('../models/CashRegister');
            const activeSession = await CashRegister.getCurrentSession(id_tienda, id_vendedor);
            if (!activeSession) {
                return res.status(403).json({ success: false, error: "Debes abrir tu caja antes de realizar ventas." });
            }

            const client = await db.getClient();

            try {
                await client.query('BEGIN');

                let totalVenta = 0;
                const productosProcesados = [];

                // 1. Validar todos los productos y calcular el total
                // FOR UPDATE (igual que registerSale): sin esto, dos carritos concurrentes del mismo
                // producto leen el mismo stock "viejo" antes de que ninguno lo actualice y pueden
                // sobrevender (plan 20, Nivel 2 — confirmado con 5 pedidos simultáneos contra stock=3:
                // los 5 se registraban como exitosos).
                for (const item of items) {
                    const prodResult = await client.query('SELECT id_producto, cantidad, precio, nombre_producto FROM Productos WHERE id_producto = ? AND id_tienda = ? FOR UPDATE', [item.id_producto, id_tienda]);
                    const producto = prodResult.rows[0];

                    if (!producto) {
                        // 🛡️ Ocultamos el ID en el error para no permitir escaneo. Mismo mensaje y código (404)
                        // que la venta de un solo producto.
                        throw new ErrorVenta(404, 'Producto no encontrado o no pertenece a tu tienda');
                    }
                    if (producto.cantidad < item.cantidad) {
                        // Exponemos el nombre (que es público para el tendero) pero no su ID
                        throw new Error(`Stock insuficiente para el producto: ${producto.nombre_producto}`);
                    }

                    const subtotal = producto.precio * item.cantidad;
                    totalVenta += subtotal;

                    productosProcesados.push({
                        ...producto,
                        cantidadVendida: item.cantidad,
                        precio_unitario: producto.precio
                    });
                }

                // 2. Registrar Venta principal
                const metodo = metodo_pago || 'Efectivo';
                await validarClienteDeVenta(client, { id_cliente, id_tienda, esFiado: metodo === 'Fiado', totalVenta });
                const recibido = efectivo_recibido || totalVenta;
                const cambio = recibido >= totalVenta ? recibido - totalVenta : 0;
                const estado_deuda = metodo === 'Fiado' ? 'Pendiente' : 'Pagado';
                const id_cliente_val = id_cliente || null;

                const saleInsert = await client.query(
                    `INSERT INTO Ventas (id_vendedor, id_tienda, precio_total, fecha_salida, id_sesion_caja, metodo_pago, efectivo_recibido, cambio_devuelto, id_cliente, estado_deuda, canal) 
                     VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?) RETURNING id_venta`,
                    [id_vendedor, id_tienda, totalVenta, activeSession.id_sesion, metodo, recibido, cambio, id_cliente_val, estado_deuda, canalDeSesion(req.session)]
                );
                const id_venta = saleInsert.rows[0].id_venta;

                // 3. Registrar detalles y descontar stock
                for (const prod of productosProcesados) {
                    // Detalle de venta
                    await client.query(
                        `INSERT INTO VentasProductos (id_venta, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`,
                        [id_venta, prod.id_producto, prod.cantidadVendida, prod.precio_unitario]
                    );

                    // Descontar stock
                    const stockFinalResult = prod.cantidad - prod.cantidadVendida;
                    await client.query('UPDATE Productos SET cantidad = ? WHERE id_producto = ?', [stockFinalResult, prod.id_producto]);

                    // Movimiento de stock
                    await client.query(
                        `INSERT INTO MovimientosStock (id_producto, tipo_movimiento, cantidad, stock_final, fecha_movimiento, observacion, id_usuario, id_tienda)
                         VALUES (?, 'Salida', ?, ?, CURRENT_TIMESTAMP, 'Venta POS #' || LPAD(?::text, 6, '0'), ?, ?)`,
                        [prod.id_producto, prod.cantidadVendida, stockFinalResult, id_venta, id_vendedor, id_tienda]
                    );
                }

                await client.query('COMMIT');
                res.json({ success: true, message: "Venta registrada correctamente", id_venta });

                // Evaluamos las metas diarias de forma asíncrona
                SaleController._checkSalesGoals(id_tienda, id_vendedor).catch(e => console.error('Error metas POS:', e));

                // Alertas asíncronas
                Alert.generate(id_tienda).catch(e => console.error('Error regenerando alertas post-venta POS:', e));

            } catch (txError) {
                await client.query('ROLLBACK');
                // Errores de validación de negocio (producto/cliente no encontrado, cupo): llevan su código.
                if (txError instanceof ErrorVenta) {
                    return res.status(txError.status).json({ success: false, error: txError.message });
                }
                console.error('TX ERROR EN REGISTRAR VENTA:', txError);
                // Errores de validación controlados vs errores SQL
                const msg = txError.message.includes('Stock') || txError.message.includes('Producto') 
                    ? txError.message 
                    : "Error interno procesando la venta";
                return res.status(400).json({ success: false, error: msg });
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Error en proceso de venta de carrito:', error);
            res.status(500).json({ success: false, error: "Error interno" });
        }
    }

    /**
     * Evalúa las metas de venta diarias y notifica al tendero si aplica.
     * @private
     */
    static async _checkSalesGoals(id_tienda, id_vendedor) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const result = await db.getAsync(`
                SELECT SUM(precio_total) as total 
                FROM Ventas 
                WHERE id_tienda = ? AND DATE(fecha_salida) = ?
            `, [id_tienda, today]);
            
            const totalVentas = parseFloat(result.total) || 0;
            
            // Metas predefinidas (podrían venir de la BD después)
            const goals = [
                { limit: 300000, msg: "¡Vas por buen camino! Superaste los $300,000 en ventas hoy. Sigue así. 🚀" },
                { limit: 500000, msg: "¡Felicidades! Acabas de superar los $500,000 en ventas. ¡Excelente trabajo! 🏆" },
                { limit: 1000000, msg: "¡Increíble! Rompiste la barrera del $1,000,000. Eres imparable. 🔥" }
            ];

            for (const goal of goals) {
                if (totalVentas >= goal.limit) {
                    // Verificar si ya se notificó esta meta hoy
                    const alreadyNotified = await db.getAsync(`
                        SELECT 1 FROM NotificacionesUsuario 
                        WHERE id_usuario = ? AND tipo = 'meta_ventas' AND datos_json LIKE ? AND DATE(fecha_creacion) = ?
                    `, [id_vendedor, `%"limit":${goal.limit}%`, today]);

                    if (!alreadyNotified) {
                        await Notification.create({
                            id_usuario: id_vendedor,
                            id_tienda,
                            tipo: 'meta_ventas',
                            titulo: '🎯 ¡Meta de Ventas Alcanzada!',
                            mensaje: goal.msg,
                            datos_json: { limit: goal.limit, prioridad: 'normal' }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error evaluando metas de ventas:', error);
        }
    }
}

module.exports = SaleController;