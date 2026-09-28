// models/Report.js
const db = require('../config/database');

class Report {
    static async create(reportData) {
        const { titulo, descripcion, fecha_reporte, creador, tipo, id_tienda, fecha_inicio, fecha_fin } = reportData;
        
        const query = `
            INSERT INTO reportes (titulo, descripcion, fecha_reporte, creador, tipo, id_tienda, fecha_inicio, fecha_fin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await db.runAsync(query, [
            titulo, descripcion, fecha_reporte, creador, tipo, id_tienda, 
            fecha_inicio || null, fecha_fin || null
        ]);
        return result.lastID;
    }

    static async findAll() {
        const query = `SELECT * FROM reportes ORDER BY fecha_reporte DESC`;
        return await db.allAsync(query);
    }

    static async findByStore(storeId) {
        const query = `SELECT * FROM reportes WHERE id_tienda = ? ORDER BY fecha_reporte DESC`;
        return await db.allAsync(query, [storeId]);
    }

    // findById/update/delete filtran por id_tienda (hallazgo C1): un reporte de otra tienda no se ve ni se toca
    // aunque se conozca su id. update/delete devuelven false si no existe en esa tienda.
    static async findById(id, id_tienda) {
        const query = `SELECT * FROM reportes WHERE id = ? AND id_tienda = ?`;
        return await db.getAsync(query, [id, id_tienda]);
    }

    static async update(id, id_tienda, reportData) {
        const { titulo, descripcion, fecha_reporte, creador, tipo, fecha_inicio, fecha_fin } = reportData;
        
        const query = `
            UPDATE reportes
            SET titulo = ?, descripcion = ?, fecha_reporte = ?, creador = ?, tipo = ?, fecha_inicio = ?, fecha_fin = ?
            WHERE id = ? AND id_tienda = ?
        `;
        const result = await db.runAsync(query, [
            titulo, descripcion, fecha_reporte, creador, tipo, 
            fecha_inicio || null, fecha_fin || null, id, id_tienda
        ]);
        return result.changes > 0;
    }

    static async delete(id, id_tienda) {
        const query = `DELETE FROM reportes WHERE id = ? AND id_tienda = ?`;
        const result = await db.runAsync(query, [id, id_tienda]);
        return result.changes > 0;
    }
}

module.exports = Report;