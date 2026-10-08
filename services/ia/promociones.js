/**
 * @file promociones.js
 * @description Sugerencias de promoción con IA: orquesta candidatos → caché → OpenAI →
 * composición (con el motor determinista de respaldo) → auditoría. Recibe `tiendaId`, nunca
 * `req`/`res`. Si OpenAI no responde NO es un error: las reglas deterministas cubren todo.
 *
 * @module services/ia/promociones
 */
const db = require('../../config/database');
const { logger } = require('../../utils/logger');
const { pedirJSON } = require('./openaiClient');
const cacheIA = require('./cacheIA');
const { calcularHash, clavePromociones } = require('./hashIA');
const { registrarEnArchivo } = require('./auditoriaIA');
const { mensajesPromociones, contextoPromocionesDelDueno } = require('./prompts');
const { leerFilasElegibles, leerPromocionesManuales } = require('./datosPromociones');
const { elegirCandidatos } = require('./candidatosPromocion');
const { componerPromociones } = require('./composicionPromociones');

/** Promociones manuales previas del dueño, para que la IA aprenda su estilo. Si falla, se sigue sin ellas. */
async function leerContextoDelDueno(tiendaId) {
  try {
    return contextoPromocionesDelDueno(await leerPromocionesManuales(tiendaId));
  } catch (err) {
    logger.error({ err, tiendaId }, 'Error obteniendo promociones manuales para IA');
    return '';
  }
}

/** Deja constancia de las sugerencias. Si falla, no se interrumpe la respuesta (es solo bitácora). */
async function auditar(tiendaId, candidatos, promociones) {
  try {
    await db.runAsync(
      'INSERT INTO Auditoria_IA (id_tienda, id_orden, prompt_utilizado, datos_base_json, sugerencia_ia_json, impacto_decision, razon_ia) VALUES (?, NULL, ?, ?, ?, ?, ?)',
      [tiendaId, 'Estratega Comercial v1.2', JSON.stringify(candidatos), JSON.stringify(promociones), 'Sugerencias de Promoción', 'Optimización de flujo de caja']
    );
    registrarEnArchivo(tiendaId, null, 'Optimización de flujo de caja', 'Sugerencias de Promoción');
  } catch (err) {
    logger.error({ err, tiendaId }, 'Error auditoría promo');
  }
}

/**
 * Sugerencias de promoción para productos estancados o próximos a vencer.
 * @param {number} tiendaId
 * @returns {Promise<{cached: boolean, promociones: Array<Object>, sinCandidatos?: boolean}>}
 *   `sinCandidatos` es true cuando ningún producto cumple las condiciones (no se consulta ni caché ni IA).
 */
async function obtenerSugerenciasPromociones(tiendaId) {
  const candidatos = elegirCandidatos(await leerFilasElegibles(tiendaId));
  if (candidatos.length === 0) return { cached: false, promociones: [], sinCandidatos: true };

  const hash = calcularHash('PROMO_' + JSON.stringify(candidatos));
  const clave = clavePromociones(tiendaId);
  const guardadas = await cacheIA.get(clave, hash);
  if (guardadas) return { cached: true, promociones: guardadas };

  const contextoDelDueno = await leerContextoDelDueno(tiendaId);

  // Si OpenAI no responde (caída, clave inválida, timeout) se trata como si la IA no hubiera
  // cubierto ningún candidato y las reglas deterministas hacen todo el trabajo (plan 20, 8.13).
  let promocionesIA = [];
  try {
    const respuesta = await pedirJSON({ messages: mensajesPromociones(candidatos, contextoDelDueno) });
    promocionesIA = respuesta.promotions || [];
  } catch (err) {
    logger.warn({ err: err.message, tiendaId }, 'IA no disponible para promociones, se usa el motor de reglas deterministas');
  }

  const promociones = componerPromociones(candidatos, promocionesIA);

  await cacheIA.set(clave, hash, promociones);
  await auditar(tiendaId, candidatos, promociones);

  return { cached: false, promociones };
}

module.exports = { obtenerSugerenciasPromociones };
