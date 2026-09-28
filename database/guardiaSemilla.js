// database/guardiaSemilla.js
// Guardia de la semilla (`npm run seed`). La semilla hace TRUNCATE ... Usuarios, Tienda CASCADE sobre
// toda la base y crea el usuario admin/admin123, así que NUNCA debe poder correr contra una base
// remota (producción en Neon/Render). Misma lógica que tests/integration/setupTestDb.js:
//   - El host tiene que ser local (localhost, 127.0.0.1 o ::1). Sin excepciones.
//   - El nombre de la base tiene que terminar en `_test`. Para sembrar una base local de desarrollo
//     (p. ej. `stockpilot`) hay que pedirlo explícitamente con `--base-local`.
// Es una función pura para poder probarla sin conectarse a nada.

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * @param {string|undefined} databaseUrl
 * @param {{permitirBaseLocal?: boolean}} [opciones]
 * @returns {{ok: boolean, motivo?: string}}
 */
function evaluarGuardiaSemilla(databaseUrl, { permitirBaseLocal = false } = {}) {
    let url;
    try {
        url = new URL(databaseUrl || '');
    } catch {
        return { ok: false, motivo: 'DATABASE_URL no está definida o no es una URL válida.' };
    }

    const host = url.hostname;
    const base = url.pathname.replace(/^\//, '');

    if (!HOSTS_LOCALES.has(host)) {
        return { ok: false, motivo: `el host "${host}" no es local. La semilla borra TODA la base y solo puede correr en localhost/127.0.0.1.` };
    }
    if (!base.endsWith('_test') && !permitirBaseLocal) {
        return { ok: false, motivo: `la base "${base}" no termina en "_test". Si de verdad quieres sembrar esta base local, ejecuta: npm run seed -- --base-local` };
    }
    return { ok: true };
}

module.exports = { evaluarGuardiaSemilla };
