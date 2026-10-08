/**
 * @file cacheIA.js
 * @description Caché de respuestas de IA en la tabla `Cache_IA` (compartida entre réplicas del
 * API y sobreviviente a reinicios). Una respuesta solo se reutiliza si el hash de los datos de
 * entrada (ver `hashIA.js`) no cambió. La caché es opcional: si la BD falla, se recalcula y no se
 * interrumpe la respuesta. Ya no existe caché en memoria del proceso: con varias réplicas cada
 * una tendría su propia copia y podría llamar a OpenAI por separado (plan 21, sección 1, hallazgo 4).
 *
 * @module services/ia/cacheIA
 */
const db = require('../../config/database');
const { logger } = require('../../utils/logger');

/**
 * @param {string} clave
 * @param {string} hashActual - Hash de los datos de entrada de ahora.
 * @returns {Promise<*|null>} Lo guardado si el hash coincide; `null` si no hay o cambió.
 */
async function get(clave, hashActual) {
  try {
    const fila = await db.getAsync('SELECT datos_json, data_hash FROM Cache_IA WHERE clave = ?', [clave]);
    if (fila && fila.data_hash === hashActual) return JSON.parse(fila.datos_json);
  } catch (err) {
    logger.warn({ err, clave }, 'Cache_IA: no se pudo leer; se recalcula');
  }
  return null;
}

/** Guarda (o reemplaza) la respuesta de `clave`. Nunca lanza. */
async function set(clave, hashActual, datos) {
  try {
    await db.runAsync(
      `INSERT INTO Cache_IA (clave, data_hash, datos_json, actualizado_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (clave) DO UPDATE SET data_hash = EXCLUDED.data_hash, datos_json = EXCLUDED.datos_json, actualizado_at = CURRENT_TIMESTAMP`,
      [clave, hashActual, JSON.stringify(datos)]
    );
  } catch (err) {
    logger.warn({ err, clave }, 'Cache_IA: no se pudo guardar; se responde sin cachear');
  }
}

/** Elimina la entrada de `clave`. Nunca lanza. */
async function invalidar(clave) {
  try {
    await db.runAsync('DELETE FROM Cache_IA WHERE clave = ?', [clave]);
  } catch (err) {
    logger.warn({ err, clave }, 'Cache_IA: no se pudo invalidar');
  }
}

module.exports = { get, set, invalidar };
