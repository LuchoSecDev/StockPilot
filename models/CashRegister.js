const db = require('../config/database');

class CashRegister {
    /**
     * Verifica si hay una sesión abierta para el vendedor actual en la tienda actual
     */
    static async getCurrentSession(id_tienda, id_vendedor) {
        return await db.getAsync(
            `SELECT * FROM SesionCaja 
             WHERE id_tienda = ? AND id_vendedor = ? AND LOWER(estado) = 'abierta' 
             ORDER BY fecha_apertura DESC LIMIT 1`,
            [id_tienda, id_vendedor]
        );
    }

    /**
     * Abre una nueva sesión de caja
     */
    static async openSession(id_tienda, id_vendedor, monto_apertura) {
        return await db.runAsync(
            `INSERT INTO SesionCaja (id_tienda, id_vendedor, monto_apertura, estado) 
             VALUES (?, ?, ?, 'Abierta') RETURNING id_sesion`,
            [id_tienda, id_vendedor, monto_apertura]
        );
    }

    /**
     * Calcula las ventas en efectivo realizadas durante la sesión actual
     */
    static async getSessionSalesAmount(id_sesion) {
        const result = await db.getAsync(
            `SELECT COALESCE(SUM(precio_total), 0) as total_ventas 
             FROM Ventas 
             WHERE id_sesion_caja = ? AND metodo_pago = 'Efectivo'`,
            [id_sesion]
        );
        return parseFloat(result.total_ventas || 0);
    }

    /**
     * Calcula los egresos realizados durante la sesión actual
     */
    static async getSessionExpensesTotal(id_sesion) {
        const result = await db.getAsync(
            `SELECT COALESCE(SUM(monto), 0) as total_egresos 
             FROM EgresosCaja 
             WHERE id_sesion_caja = ? AND estado != 'Rechazado'`,
            [id_sesion]
        );
        return parseFloat(result.total_egresos || 0);
    }

    /**
     * Calcula los abonos en efectivo recibidos durante la sesión actual
     */
    static async getSessionAbonosAmount(id_sesion) {
        const result = await db.getAsync(
            `SELECT COALESCE(SUM(monto), 0) as total_abonos 
             FROM Abonos 
             WHERE id_sesion_caja = ? AND metodo_pago = 'Efectivo'`,
            [id_sesion]
        );
        return parseFloat(result.total_abonos || 0);
    }

    /**
     * Cierra la sesión de caja comparando lo declarado vs calculado
     */
    static async closeSession(id_sesion, monto_cierre_declarado) {
        // 1. Obtener la sesión
        const sesion = await db.getAsync(`SELECT * FROM SesionCaja WHERE id_sesion = ?`, [id_sesion]);
        if (!sesion) throw new Error("Sesión no encontrada");
        if (sesion.estado === 'Cerrada') throw new Error("La sesión ya está cerrada");

        // 2. Calcular total esperado (Apertura + Ventas en efectivo + Abonos en efectivo - Egresos)
        const ventas_efectivo = await this.getSessionSalesAmount(id_sesion);
        const abonos_efectivo = await this.getSessionAbonosAmount(id_sesion);
        const egresos = await this.getSessionExpensesTotal(id_sesion);
        const monto_apertura = parseFloat(sesion.monto_apertura || 0);
        const monto_cierre_calculado = monto_apertura + ventas_efectivo + abonos_efectivo - egresos;
        
        // 3. Diferencia
        const diferencia = parseFloat(monto_cierre_declarado) - monto_cierre_calculado;

        // 4. Actualizar estado
        await db.runAsync(
            `UPDATE SesionCaja 
             SET monto_cierre_declarado = ?, 
                 monto_cierre_calculado = ?, 
                 diferencia = ?, 
                 fecha_cierre = CURRENT_TIMESTAMP, 
                 estado = 'Cerrada'
             WHERE id_sesion = ?`,
            [monto_cierre_declarado, monto_cierre_calculado, diferencia, id_sesion]
        );

        return {
            monto_apertura,
            ventas_efectivo,
            abonos_efectivo,
            egresos,
            monto_cierre_calculado,
            monto_cierre_declarado,
            diferencia
        };
    }

    /**
     * Obtiene el historial de sesiones de caja de una tienda
     */
    static async getSessionsHistory(id_tienda) {
        return await db.allAsync(
            `SELECT s.*, u.nombres as vendedor_nombre 
             FROM SesionCaja s
             LEFT JOIN Usuarios u ON s.id_vendedor = u.id_usuario
             WHERE s.id_tienda = ? 
             ORDER BY s.fecha_apertura DESC`,
            [id_tienda]
        );
    }

    // ==========================================
    // MÉTODOS DE EGRESOS / GASTOS DE CAJA CHICA
    // ==========================================

    static async createExpense(data) {
        return await db.runAsync(
            `INSERT INTO EgresosCaja (id_sesion_caja, id_tienda, id_usuario, monto, motivo, categoria, foto_soporte) 
             VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id_egreso`,
            [data.id_sesion_caja, data.id_tienda, data.id_usuario, data.monto, data.motivo, data.categoria || 'Otro', data.foto_soporte || null]
        );
    }

    static async getExpensesBySession(id_sesion) {
        return await db.allAsync(
            `SELECT e.*, u.nombres as usuario_nombre 
             FROM EgresosCaja e
             LEFT JOIN Usuarios u ON e.id_usuario = u.id_usuario
             WHERE e.id_sesion_caja = ? 
             ORDER BY e.fecha_registro DESC`,
            [id_sesion]
        );
    }

    static async getExpensesByStore(id_tienda) {
        return await db.allAsync(
            `SELECT e.*, u.nombres as usuario_nombre, a.nombres as admin_nombre 
             FROM EgresosCaja e
             LEFT JOIN Usuarios u ON e.id_usuario = u.id_usuario
             LEFT JOIN Usuarios a ON e.aprobado_por = a.id_usuario
             WHERE e.id_tienda = ? 
             ORDER BY e.fecha_registro DESC`,
            [id_tienda]
        );
    }

    // Ambos filtran por id_tienda (P22-09): un egreso de otra tienda no se toca aunque se conozca su id.
    // Devuelven { changes }: 0 si el egreso no existe en esa tienda.
    static async approveExpense(id_egreso, admin_id, id_tienda) {
        return await db.runAsync(
            `UPDATE EgresosCaja
             SET estado = 'Aprobado', aprobado_por = ?, fecha_aprobacion = CURRENT_TIMESTAMP
             WHERE id_egreso = ? AND id_tienda = ?`,
            [admin_id, id_egreso, id_tienda]
        );
    }

    static async rejectExpense(id_egreso, admin_id, id_tienda, notas_admin = null) {
        return await db.runAsync(
            `UPDATE EgresosCaja
             SET estado = 'Rechazado', aprobado_por = ?, fecha_aprobacion = CURRENT_TIMESTAMP, notas_admin = ?
             WHERE id_egreso = ? AND id_tienda = ?`,
            [admin_id, notas_admin, id_egreso, id_tienda]
        );
    }
}

module.exports = CashRegister;
