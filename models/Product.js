// models/Product.js
const db = require('../config/database');

class Product {
    static async findByStore(storeId) {
        // Mejorado: Ahora incluye la velocidad de venta de los últimos 30 días
        const query = `
            SELECT
                p.*,
                COALESCE(
                  (SELECT SUM(vp2.cantidad)
                   FROM VentasProductos vp2
                   JOIN Ventas v2 ON vp2.id_venta = v2.id_venta
                   WHERE vp2.id_producto = p.id_producto
                   AND v2.fecha_salida >= CURRENT_DATE - INTERVAL '30 days'
                  ), 0) / 30.0 as velocity,
                COALESCE(
                  (SELECT SUM(vp3.cantidad)
                   FROM VentasProductos vp3
                   JOIN Ventas v3 ON vp3.id_venta = v3.id_venta
                   WHERE vp3.id_producto = p.id_producto
                   AND v3.fecha_salida >= CURRENT_DATE - INTERVAL '7 days'
                  ), 0) / 7.0 as velocity_7d
            FROM Productos p
            WHERE p.id_tienda = ?
            ORDER BY nombre_producto
        `;
        return await db.allAsync(query, [storeId]);
    }

    static async findById(productId) {
        const query = `SELECT * FROM Productos WHERE id_producto = ?`;
        return await db.getAsync(query, [productId]);
    }

    static async create(productData) {
        const query = `
            INSERT INTO Productos (
                codigo, codigo_barras, nombre_producto, categoria, subcategoria, tipo_producto,
                precio, cantidad, fecha_entrada, estado, id_tienda,
                stock_minimo, stock_maximo, fecha_vencimiento, frecuencia_compra_dias, costo_compra,
                stock_seguridad, lead_time, id_proveedor
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, 'Disponible', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await db.runAsync(query, [
            productData.codigo,
            productData.codigo_barras || null,
            productData.nombre_producto,
            productData.categoria,
            productData.subcategoria,
            productData.tipo_producto,
            productData.precio,
            productData.cantidad,
            productData.id_tienda,
            productData.stock_minimo,
            productData.stock_maximo || 200,
            productData.fecha_vencimiento || null,
            productData.frecuencia_compra_dias,
            productData.costo_compra || 0,
            productData.stock_seguridad,
            productData.lead_time,
            productData.id_proveedor || null
        ]);
        return result.lastID;
    }

    static async update(productId, productData) {
        const query = `
            UPDATE Productos SET
            codigo = ?, codigo_barras = ?, nombre_producto = ?, categoria = ?, subcategoria = ?,
            tipo_producto = ?, precio = ?, cantidad = ?,
            stock_minimo = ?, stock_maximo = ?, fecha_vencimiento = ?,
            frecuencia_compra_dias = ?, costo_compra = ?,
            stock_seguridad = ?, lead_time = ?, id_proveedor = ?
            WHERE id_producto = ?
        `;
        const result = await db.runAsync(query, [
            productData.codigo,
            productData.codigo_barras || null,
            productData.nombre_producto,
            productData.categoria,
            productData.subcategoria,
            productData.tipo_producto,
            productData.precio,
            productData.cantidad,
            productData.stock_minimo || 5,
            productData.stock_maximo || 200,
            productData.fecha_vencimiento || null,
            productData.frecuencia_compra_dias || 7,
            productData.costo_compra || 0,
            productData.stock_seguridad || 0,
            productData.lead_time || 3,
            productData.id_proveedor || null,
            productId
        ]);
        return result.changes > 0;
    }

    static async updatePrice(productId, newPrice) {
        const query = `UPDATE Productos SET precio = ? WHERE id_producto = ?`;
        const result = await db.runAsync(query, [newPrice, productId]);
        return result.changes > 0;
    }

    static async toggleStatus(productId, estado) {
        const query = `UPDATE Productos SET estado = ? WHERE id_producto = ?`;
        const result = await db.runAsync(query, [estado, productId]);
        return result.changes > 0;
    }

    static async delete(productId) {
        const query = `DELETE FROM Productos WHERE id_producto = ?`;
        const result = await db.runAsync(query, [productId]);
        return result.changes > 0;
    }

    static async findByBarcode(storeId, barcode) {
        const query = `
            SELECT * FROM Productos 
            WHERE id_tienda = ? AND (codigo_barras = ? OR codigo = ?)
            LIMIT 1
        `;
        return await db.getAsync(query, [storeId, barcode, barcode]);
    }

    /**
     * Asigna un código de barras a un producto, sin duplicar: en una tienda un código identifica a UN
     * solo producto (findByBarcode busca por codigo_barras o por codigo/SKU, así que se comprueban las
     * dos columnas). La comprobación y el UPDATE van en una transacción con un bloqueo por tienda
     * (pg_advisory_xact_lock): dos vínculos simultáneos del mismo código no pueden ganar los dos.
     * Vincular de nuevo el mismo código al mismo producto es válido (idempotente).
     * @returns {Promise<{estado: 'ok'|'no_encontrado'|'duplicado', conflicto?: {id_producto:number, nombre_producto:string}}>}
     */
    static async linkBarcode(productId, storeId, barcode) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            await client.query("SELECT pg_advisory_xact_lock(hashtext('codigo_barras'), $1)", [storeId]);

            const otro = await client.query(
                `SELECT id_producto, nombre_producto FROM Productos
                 WHERE id_tienda = ? AND id_producto <> ? AND (codigo_barras = ? OR codigo = ?)
                 LIMIT 1`,
                [storeId, productId, barcode, barcode]
            );
            if (otro.rows.length) {
                await client.query('ROLLBACK');
                return { estado: 'duplicado', conflicto: otro.rows[0] };
            }

            const res = await client.query(
                'UPDATE Productos SET codigo_barras = ? WHERE id_producto = ? AND id_tienda = ?',
                [barcode, productId, storeId]
            );
            await client.query('COMMIT');
            return { estado: res.rowCount > 0 ? 'ok' : 'no_encontrado' };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Productos próximos a vencer en N días
     */
    static async findExpiringByStore(storeId, days = 7) {
        const query = `
            SELECT *, 
                (fecha_vencimiento::date - CURRENT_DATE) AS dias_para_vencer
            FROM Productos 
            WHERE id_tienda = ? 
              AND fecha_vencimiento IS NOT NULL
              AND (fecha_vencimiento::date - CURRENT_DATE) <= ?
              AND (fecha_vencimiento::date - CURRENT_DATE) >= 0
              AND estado = 'Disponible'
            ORDER BY fecha_vencimiento ASC
        `;
        return await db.allAsync(query, [storeId, days]);
    }

}

module.exports = Product;