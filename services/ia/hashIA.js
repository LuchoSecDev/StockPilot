/**
 * @file hashIA.js
 * @description Hash de los datos de entrada y claves de la caché de IA. Puro (sin BD): el hash
 * decide si una respuesta guardada sigue siendo válida, así que se prueba aparte
 * (`ia_hash.test.js`). Si cambia el algoritmo o el formato de una clave, todas las respuestas
 * guardadas dejan de coincidir y se vuelve a pagar a OpenAI una vez por tienda.
 *
 * @module services/ia/hashIA
 */
const crypto = require('crypto');

/** Clave de las recomendaciones del Consejero para una tienda. */
const claveRecomendaciones = (tiendaId) => `RECS_V4_${tiendaId}`;

/** Clave de las sugerencias de promoción para una tienda. */
const clavePromociones = (tiendaId) => `PROMO_${tiendaId}`;

/**
 * MD5 (la columna `data_hash` es VARCHAR(32)). Un texto se hashea tal cual; cualquier otra
 * cosa, serializada a JSON.
 * @param {*} datos
 * @returns {string} hash hexadecimal de 32 caracteres
 */
function calcularHash(datos) {
  const texto = typeof datos === 'string' ? datos : JSON.stringify(datos);
  return crypto.createHash('md5').update(texto).digest('hex');
}

module.exports = { claveRecomendaciones, clavePromociones, calcularHash };
