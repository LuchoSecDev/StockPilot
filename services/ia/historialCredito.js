/**
 * @file historialCredito.js
 * @description Resume el historial de fiados y abonos de un cliente en lo que se le envía a la IA.
 * Puro (sin BD): se prueba con datos sueltos.
 *
 * Privacidad (Ley 1581): NO incluye quién es el cliente (nombre ni celular), solo su
 * comportamiento de pago; el id deja rastro en la auditoría sin identificar a nadie fuera de la
 * tienda. Lo cubre también `tests/integration/ia_privacidad.test.js`.
 *
 * @module services/ia/historialCredito
 */

/**
 * @param {{id_cliente: number, limite_credito: number}} cliente
 * @param {Array<{precio_total: number|string, fecha_salida: *}>} ventasFiadas
 * @param {Array<{monto: number|string, fecha_abono: *}>} abonos
 * @returns {Object} Totales, saldo pendiente y fechas.
 */
function armarHistorialCredito(cliente, ventasFiadas, abonos) {
  const totalFiado = ventasFiadas.reduce((suma, v) => suma + Number(v.precio_total), 0);
  const totalAbonado = abonos.reduce((suma, a) => suma + Number(a.monto), 0);

  return {
    id_cliente: cliente.id_cliente,
    limite_credito: cliente.limite_credito,
    total_compras_fiadas: totalFiado,
    total_pagado: totalAbonado,
    saldo_pendiente_actual: totalFiado - totalAbonado,
    num_compras_fiadas: ventasFiadas.length,
    num_abonos: abonos.length,
    fechas_compras: ventasFiadas.map(v => v.fecha_salida),
    fechas_abonos: abonos.map(a => a.fecha_abono)
  };
}

module.exports = { armarHistorialCredito };
