// models/User.js
const db = require('../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

class User {
    static async findByCredentials(login, password) {
        // Buscar usuario sin comparar contraseña en SQL y sin requerir rol del cliente
        const query = `
            SELECT * FROM Usuarios 
            WHERE (usuario = ? OR correo = ?) 
        `;
        const user = await db.getAsync(query, [login, login]);

        if (!user) return null;

        // Comparar contraseña con bcrypt
        const match = await bcrypt.compare(password, user.contrasena);
        return match ? user : null;
    }

    static async verifyPasswordById(userId, password) {
        const query = `SELECT contrasena FROM Usuarios WHERE id_usuario = ?`;
        const user = await db.getAsync(query, [userId]);
        if (!user) return false;
        return await bcrypt.compare(password, user.contrasena);
    }

    static async create(userData) {
        // Hashear la contraseña antes de guardar
        const hashedPassword = await bcrypt.hash(userData.contrasena, SALT_ROUNDS);

        const query = `
            INSERT INTO Usuarios (
                nombres, genero, correo, celular,
                usuario, contrasena, rol, id_tienda, cambio_clave_forzoso, fecha_aceptacion_politica_datos
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await db.runAsync(query, [
            userData.nombres,
            userData.genero,
            userData.correo,
            userData.celular,
            userData.usuario,
            hashedPassword,
            userData.rol,
            userData.id_tienda,
            userData.cambio_clave_forzoso ? true : false,
            // Solo se registra en el flujo de registro propio (Ley 1581): quien acepta es el dueño de
            // la cuenta, no el administrador que da de alta a un colaborador desde tenderoController.
            userData.aceptaPoliticaDatos ? new Date() : null
        ]);
        return result.lastID;
    }

    static async findById(userId) {
        const query = `
            SELECT id_usuario, nombres, genero, correo, celular, usuario, rol, id_tienda, foto_url, cambio_clave_forzoso, two_factor_enabled
            FROM Usuarios WHERE id_usuario = ?
        `;
        return await db.getAsync(query, [userId]);
    }

    static async findByStore(storeId) {
        const query = `
            SELECT id_usuario, nombres, genero, correo, celular, usuario, rol
            FROM Usuarios 
            WHERE id_tienda = ?
            ORDER BY id_usuario
        `;
        return await db.allAsync(query, [storeId]);
    }

    static async findTenderosByStore(storeId) {
        const query = `
            SELECT id_usuario, nombres, genero, correo, celular, usuario
            FROM Usuarios
            WHERE rol = 'Tendero' AND id_tienda = ?
            ORDER BY id_usuario
        `;
        return await db.allAsync(query, [storeId]);
    }

    static async update(userId, userData) {
        const query = `
            UPDATE Usuarios SET
            nombres = ?, genero = ?, correo = ?, celular = ?, usuario = ?, foto_url = ?
            WHERE id_usuario = ?
        `;
        const result = await db.runAsync(query, [
            userData.nombres,
            userData.genero,
            userData.correo,
            userData.celular,
            userData.usuario,
            userData.foto_url || null,
            userId
        ]);
        return result.changes > 0;
    }

    static async updatePassword(userId, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        const query = `UPDATE Usuarios SET contrasena = ?, cambio_clave_forzoso = ? WHERE id_usuario = ?`;
        const result = await db.runAsync(query, [hashedPassword, false, userId]);
        return result.changes > 0;
    }

    static async delete(userId, storeId) {
        const query = `
            DELETE FROM Usuarios 
            WHERE id_usuario = ? AND id_tienda = ? AND rol = 'Tendero'
        `;
        const result = await db.runAsync(query, [userId, storeId]);
        return result.changes > 0;
    }

    static async findByEmail(email) {
        const query = `SELECT id_usuario, nombres, correo FROM Usuarios WHERE correo = ?`;
        return await db.getAsync(query, [email]);
    }

    static async setResetToken(userId, token, expires) {
        const query = `UPDATE Usuarios SET reset_token = ?, reset_expires = ? WHERE id_usuario = ?`;
        await db.runAsync(query, [token, expires.getTime(), userId]);
    }

    static async verifyResetToken(email, token) {
        const query = `
            SELECT id_usuario FROM Usuarios 
            WHERE correo = ? AND reset_token = ? AND reset_expires > ?
        `;
        return await db.getAsync(query, [email, token, Date.now()]);
    }

    static async clearResetToken(userId) {
        const query = `UPDATE Usuarios SET reset_token = NULL, reset_expires = NULL WHERE id_usuario = ?`;
        await db.runAsync(query, [userId]);
    }

    // Candado de sesión concurrente por canal: 'web' usa Usuarios.session_id (como siempre) y 'app'
    // usa Usuarios.session_id_app. Cualquier otro valor cuenta como 'web'. El nombre de la columna sale
    // de esta lista fija, nunca de la entrada del usuario.
    static columnaSesion(canal) {
        return canal === 'app' ? 'session_id_app' : 'session_id';
    }

    static async setCurrentSession(userId, sessionId, canal = 'web') {
        const query = `UPDATE Usuarios SET ${User.columnaSesion(canal)} = ? WHERE id_usuario = ?`;
        await db.runAsync(query, [sessionId, userId]);
    }

    static async verifyCurrentSession(userId, sessionId, canal = 'web') {
        const columna = User.columnaSesion(canal);
        const user = await db.getAsync(`SELECT ${columna} AS sesion FROM Usuarios WHERE id_usuario = ?`, [userId]);
        return !!user && user.sesion === sessionId;
    }

    // Libera el candado SOLO si todavía pertenece a esta sesión. Una sesión vieja (invalidada por un
    // login con force) que hace logout no debe borrar el candado de la sesión nueva.
    static async releaseCurrentSession(userId, sessionId, canal = 'web') {
        const columna = User.columnaSesion(canal);
        await db.runAsync(`UPDATE Usuarios SET ${columna} = NULL WHERE id_usuario = ? AND ${columna} = ?`, [userId, sessionId]);
    }

    static async get2FASecret(userId) {
        const query = `SELECT two_factor_secret, two_factor_enabled FROM Usuarios WHERE id_usuario = ?`;
        return await db.getAsync(query, [userId]);
    }

    static async set2FASecret(userId, secret) {
        const query = `UPDATE Usuarios SET two_factor_secret = ? WHERE id_usuario = ?`;
        await db.runAsync(query, [secret, userId]);
    }

    static async enable2FA(userId) {
        const query = `UPDATE Usuarios SET two_factor_enabled = true WHERE id_usuario = ?`;
        await db.runAsync(query, [userId]);
    }

    static async disable2FA(userId) {
        const query = `UPDATE Usuarios SET two_factor_enabled = false, two_factor_secret = NULL WHERE id_usuario = ?`;
        await db.runAsync(query, [userId]);
    }
}

module.exports = User;