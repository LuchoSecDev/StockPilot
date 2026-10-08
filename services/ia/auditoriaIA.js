/**
 * @file auditoriaIA.js
 * @description Bitácora en archivo de las decisiones de IA (RF-026). Es el registro legado que
 * acompaña a la tabla `Auditoria_IA`: cada servicio inserta su fila en la BD (las columnas
 * difieren según el caso de uso) y llama a `registrarEnArchivo` para dejar la línea de texto.
 * Escribir en el archivo nunca debe tumbar la operación que se está auditando.
 *
 * @module services/ia/auditoriaIA
 */
const fs = require('fs');
const path = require('path');
const { logger } = require('../../utils/logger');

// En la raíz del proyecto (ignorado por git con `*.log`); misma ruta que usaba aiController.
const RUTA_ARCHIVO_AUDITORIA = path.join(__dirname, '..', '..', 'ai_audit.log');

/**
 * @param {number} tiendaId
 * @param {number|null} ordenId
 * @param {string} razon
 * @param {string} impacto
 */
function registrarEnArchivo(tiendaId, ordenId, razon, impacto) {
  try {
    const marcaDeTiempo = new Date().toISOString();
    const linea = `[${marcaDeTiempo}] Tienda: ${tiendaId} | Orden: ${ordenId || 'N/A'} | Razón: ${razon} | Impacto: ${impacto}\n`;
    fs.appendFileSync(RUTA_ARCHIVO_AUDITORIA, linea);
  } catch (err) {
    logger.error({ err }, 'Error escribiendo en ai_audit.log');
  }
}

module.exports = { registrarEnArchivo };
