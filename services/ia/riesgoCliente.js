/**
 * @file riesgoCliente.js
 * @description Evaluación de riesgo crediticio de un cliente con IA, a partir de su historial de
 * fiados y abonos. Recibe `tiendaId` e `idCliente`, nunca `req`/`res`. Si OpenAI no responde, no
 * se propaga un error: se devuelve un aviso de mantenimiento (`esFallback: true`) porque no
 * existe un motor de reglas para riesgo crediticio y no se inventa un cálculo sin aprobación.
 *
 * @module services/ia/riesgoCliente
 */
const db = require('../../config/database');
const { logger } = require('../../utils/logger');
const { RecursoNoEncontradoError } = require('../errores');
const { asegurarApiKey, pedirJSON } = require('./openaiClient');
const { registrarEnArchivo } = require('./auditoriaIA');
const { mensajesRiesgoCliente } = require('./prompts');
const { armarHistorialCredito } = require('./historialCredito');

const ANALISIS_DE_MANTENIMIENTO = {
  perfil: 'Evaluando',
  riesgo: 'Evaluando',
  razon: 'Motor IA en mantenimiento. No se pudo evaluar el riesgo automáticamente en este momento.',
  sugerencia: 'Revisa el historial de fiados y abonos de este cliente manualmente mientras se restablece el servicio.'
};

/**
 * @param {number} tiendaId
 * @param {number|string} idCliente
 * @returns {Promise<{esFallback: boolean, analisis: Object}>}
 * @throws {IANoConfiguradaError} Si falta la clave de OpenAI.
 * @throws {RecursoNoEncontradoError} Si el cliente no existe o es de otra tienda.
 */
async function evaluarRiesgoCliente(tiendaId, idCliente) {
  asegurarApiKey();

  const cliente = await db.getAsync('SELECT * FROM Clientes WHERE id_cliente = ? AND id_tienda = ?', [idCliente, tiendaId]);
  if (!cliente) throw new RecursoNoEncontradoError('Cliente no encontrado');

  const ventasFiadas = await db.allAsync('SELECT id_venta, fecha_salida, precio_total, estado_deuda FROM Ventas WHERE id_cliente = ? AND metodo_pago = ? ORDER BY fecha_salida DESC', [idCliente, 'Fiado']);
  const abonos = await db.allAsync('SELECT id_abono, fecha_abono, monto, metodo_pago FROM Abonos WHERE id_cliente = ? ORDER BY fecha_abono DESC', [idCliente]);

  const historial = armarHistorialCredito(cliente, ventasFiadas, abonos);
  const { messages, userPrompt } = mensajesRiesgoCliente(historial);

  let analisis;
  try {
    analisis = await pedirJSON({ messages, temperature: 0.1 });
  } catch (err) {
    logger.warn({ err: err.message, tiendaId }, 'IA no disponible para evaluar riesgo de cliente');
    return { esFallback: true, analisis: { ...ANALISIS_DE_MANTENIMIENTO } };
  }

  // Solo se audita un análisis real; un aviso de mantenimiento no aporta nada que auditar.
  await db.runAsync(
    `INSERT INTO Auditoria_IA (id_tienda, motor_ia, prompt_utilizado, datos_base_json, sugerencia_ia_json, impacto_decision, razon_ia)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tiendaId,
      'Evaluador Riesgo Fiados v1.0',
      userPrompt,
      JSON.stringify(historial),
      JSON.stringify(analisis),
      `Perfil: ${analisis.perfil}, Riesgo: ${analisis.riesgo}`,
      analisis.razon
    ]
  );
  registrarEnArchivo(tiendaId, null, `Evaluación de riesgo cliente ${cliente.nombre}`, `Riesgo: ${analisis.riesgo}`);

  return { esFallback: false, analisis };
}

module.exports = { evaluarRiesgoCliente };
