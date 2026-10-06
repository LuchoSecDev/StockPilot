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
     * Abre una nueva sesión de caja de forma ATÓMICA por vendedor: la comprobación «¿ya tiene una abierta?»
     * y el INSERT van en una transacción protegida por un bloqueo asesor (pg_advisory_xact_lock) sobre el
     * vendedor. Antes eran un SELECT y un INSERT sueltos: doce aperturas simultáneas abrían doce cajas
     * (reproducido en caja_apertura_concurrencia.test.js) y el arqueo quedaba descuadrado.
     *
     * El bloqueo es por vendedor, no por tienda: dos vendedores de la misma tienda abren sin esperarse.
     * Su espacio de claves (hashtext('apertura_caja'), id_vendedor) no choca con el de los borradores de
     * orden, que usa (id_tienda, id_proveedor).
     *
     * @returns {Promise<{creada: boolean, id_sesion: number}>} Si ya había una abierta: creada=false y su id.
     */
    static async openSession(id_tienda, id_vendedor, monto_apertura) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            await client.query("SELECT pg_advisory_xact_lock(hashtext('apertura_caja'), $1)", [id_vendedor]);

            const existente = await client.query(
                `SELECT id_sesion FROM SesionCaja
                 WHERE id_tienda = ? AND id_vendedor = ? AND LOWER(estado) = 'abierta'
                 ORDER BY fecha_apertura DESC LIMIT 1`,
                [id_tienda, id_vendedor]
            );
            if (existente.rows.length) {
                await client.query('ROLLBACK');
                return { creada: false, id_sesion: existente.rows[0].id_sesion };
            }

            const nueva = await client.query(
                `INSERT INTO SesionCaja (id_tienda, id_vendedor, monto_apertura, estado)
                 VALUES (?, ?, ?, 'Abierta') RETURNING id_sesion`,
                [id_tienda, id_vendedor, monto_apertura]
            );
            await client.query('COMMIT');
            return { creada: true, id_sesion: nueva.rows[0].id_sesion };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
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
     * El arqueo de una sesión con lo que el vendedor contó: cuánto DEBERÍA haber en el cajón (apertura + ventas en
     * efectivo + abonos en efectivo − egresos no rechazados) y la diferencia con lo declarado. Solo lee: no cambia
     * nada. Lo usan el cierre (closeSession) y la vista previa del cierre, para que las dos hagan la MISMA cuenta.
     *
     * @param {{id_sesion: number, monto_apertura: string|number}} sesion - La fila de SesionCaja.
     * @param {number} monto_cierre_declarado - Ya validado (número finito >= 0).
     */
    static async calcularArqueo(sesion, monto_cierre_declarado) {
        const ventas_efectivo = await this.getSessionSalesAmount(sesion.id_sesion);
        const abonos_efectivo = await this.getSessionAbonosAmount(sesion.id_sesion);
        const egresos = await this.getSessionExpensesTotal(sesion.id_sesion);
        const monto_apertura = parseFloat(sesion.monto_apertura || 0);
        const monto_cierre_calculado = monto_apertura + ventas_efectivo + abonos_efectivo - egresos;
        const declarado = Number(monto_cierre_declarado);

        return {
            monto_apertura,
            ventas_efectivo,
            abonos_efectivo,
            egresos,
            monto_cierre_calculado,
            monto_cierre_declarado: declarado,
            diferencia: declarado - monto_cierre_calculado
        };
    }

    /**
     * Cierra la sesión de caja comparando lo declarado vs calculado
     */
    static async closeSession(id_sesion, monto_cierre_declarado) {
        // 1. Obtener la sesión
        const sesion = await db.getAsync(`SELECT * FROM SesionCaja WHERE id_sesion = ?`, [id_sesion]);
        if (!sesion) throw new Error("Sesión no encontrada");
        if (sesion.estado === 'Cerrada') throw new Error("La sesión ya está cerrada");

        // 2. Calcular el total esperado y la diferencia (la misma cuenta de la vista previa)
        const arqueo = await this.calcularArqueo(sesion, monto_cierre_declarado);

        // 3. Actualizar estado
        await db.runAsync(
            `UPDATE SesionCaja
             SET monto_cierre_declarado = ?,
                 monto_cierre_calculado = ?,
                 diferencia = ?,
                 fecha_cierre = CURRENT_TIMESTAMP,
                 estado = 'Cerrada'
             WHERE id_sesion = ?`,
            [arqueo.monto_cierre_declarado, arqueo.monto_cierre_calculado, arqueo.diferencia, id_sesion]
        );

        return arqueo;
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
    // Solo resuelven egresos en estado «Registrado» (una vez aprobado o rechazado no se reabre).
    // Devuelven { changes }: 0 si el egreso no existe en esa tienda o ya fue resuelto.
    static async approveExpense(id_egreso, admin_id, id_tienda) {
        return await db.runAsync(
            `UPDATE EgresosCaja
             SET estado = 'Aprobado', aprobado_por = ?, fecha_aprobacion = CURRENT_TIMESTAMP
             WHERE id_egreso = ? AND id_tienda = ? AND estado = 'Registrado'`,
            [admin_id, id_egreso, id_tienda]
        );
    }

    static async rejectExpense(id_egreso, admin_id, id_tienda, notas_admin = null) {
        return await db.runAsync(
            `UPDATE EgresosCaja
             SET estado = 'Rechazado', aprobado_por = ?, fecha_aprobacion = CURRENT_TIMESTAMP, notas_admin = ?
             WHERE id_egreso = ? AND id_tienda = ? AND estado = 'Registrado'`,
            [admin_id, notas_admin, id_egreso, id_tienda]
        );
    }
}

module.exports = CashRegister;
