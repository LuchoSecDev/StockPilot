/**
 * @file recomendaciones.js
 * @description Consejero IA del dashboard: orquesta entradas del motor → caché → OpenAI →
 * guardrails → auditoría. Recibe `tiendaId`, nunca `req`/`res`. La lógica pura vive en
 * `contextoRecomendaciones.js` y los textos del modelo en `prompts.js`.
 *
 * @module services/ia/recomendaciones
 */
const db = require('../../config/database');
const { logger } = require('../../utils/logger');
const { seleccionarCandidatosReabastecimiento } = require('../../utils/recomendacionesDashboard');
const { leerEntradasMotor } = require('../inventory/entradasMotor');
const { asegurarApiKey, pedirJSON } = require('./openaiClient');
const cacheIA = require('./cacheIA');
const { calcularHash, claveRecomendaciones } = require('./hashIA');
const { registrarEnArchivo } = require('./auditoriaIA');
const { mensajesRecomendaciones } = require('./prompts');
const { armarContextoProductos, armarRecomendaciones } = require('./contextoRecomendaciones');

const MAX_PRODUCTOS_PARA_IA = 8;

/** Deja constancia de la recomendación. Si falla, no se interrumpe la respuesta (es solo bitácora). */
async function auditar(tiendaId, recomendaciones) {
  try {
    const datosBase = JSON.stringify(recomendaciones.map(r => ({ product: r.product, base: r.base })));
    const sugerencia = JSON.stringify(recomendaciones.map(r => ({ product: r.product, adjustment: r.adjustment, final: r.final, reason: r.reason })));
    await db.runAsync(
      'INSERT INTO Auditoria_IA (id_tienda, id_orden, prompt_utilizado, datos_base_json, sugerencia_ia_json, impacto_decision, razon_ia, fecha_auditoria) VALUES (?, NULL, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [tiendaId, 'Dashboard Auditor MBI v2.4', datosBase, sugerencia, 'Recomendaciones Dashboard', 'Análisis proactivo de inventario']
    );
    registrarEnArchivo(tiendaId, null, 'Análisis proactivo de inventario', 'Recomendaciones Dashboard');
  } catch (err) {
    logger.warn({ err, tiendaId }, 'Auditoría IA omitida');
  }
}

/**
 * Recomendaciones de reabastecimiento para el dashboard de una tienda.
 * @param {number} tiendaId
 * @returns {Promise<{cached: boolean, recomendaciones: Array<Object>}>} `cached` es true cuando
 *   el inventario no cambió desde la última vez y se reutilizó la respuesta guardada (sin llamar a OpenAI).
 * @throws {IANoConfiguradaError} Si falta la clave de OpenAI.
 * @throws {Error} Si OpenAI falla o no deja ninguna recomendación válida (el controlador degrada a un aviso).
 */
async function obtenerRecomendaciones(tiendaId) {
  asegurarApiKey();

  const entradas = await leerEntradasMotor(db, tiendaId);
  const hash = calcularHash(entradas);
  const clave = claveRecomendaciones(tiendaId);

  const guardadas = await cacheIA.get(clave, hash);
  if (guardadas) return { cached: true, recomendaciones: guardadas };

  logger.info({ tiendaId }, 'Auditor: cambió el inventario, se recalculan las recomendaciones de IA');

  const contexto = armarContextoProductos(entradas);

  // Solo los que realmente necesitan reposición (base_load > 0), los más urgentes primero.
  const candidatos = seleccionarCandidatosReabastecimiento(contexto, MAX_PRODUCTOS_PARA_IA);

  // Sin nada por reponer no hay qué sugerir: se responde vacío y se evita la llamada a OpenAI.
  if (candidatos.length === 0) {
    await cacheIA.set(clave, hash, []);
    return { cached: false, recomendaciones: [] };
  }

  const respuestaIA = await pedirJSON({ messages: mensajesRecomendaciones(candidatos) });
  const ajustes = Array.isArray(respuestaIA.adjustments) ? respuestaIA.adjustments : [];
  const recomendaciones = armarRecomendaciones(ajustes, contexto);

  if (recomendaciones.length === 0) throw new Error('No se generaron recomendaciones válidas');

  await auditar(tiendaId, recomendaciones);
  await cacheIA.set(clave, hash, recomendaciones);

  return { cached: false, recomendaciones };
}

module.exports = { obtenerRecomendaciones };
