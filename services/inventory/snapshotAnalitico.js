/**
 * @file snapshotAnalitico.js
 * @description Caso de uso «snapshot analítico del inventario»: lee las entradas del motor único
 * de la tienda y arma el análisis con `analisisInventario.js` (que es puro y se prueba aparte).
 *
 * @module services/inventory/snapshotAnalitico
 */
const db = require('../../config/database');
const { leerEntradasMotor } = require('./entradasMotor');
const { armarSnapshot } = require('./analisisInventario');

/**
 * @param {number} tiendaId
 * @param {number} [diasCoberturaOverride] - Ver `normalizarDiasCobertura`.
 * @returns {Promise<Array<Object>>}
 */
async function obtenerSnapshotAnalitico(tiendaId, diasCoberturaOverride) {
  const entradas = await leerEntradasMotor(db, tiendaId);
  return armarSnapshot(entradas, diasCoberturaOverride);
}

module.exports = { obtenerSnapshotAnalitico };
