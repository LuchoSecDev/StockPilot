/**
 * @file cashRegisterHelpers.js
 * @description Reglas puras del cierre de caja: cuándo un descuadre es lo bastante grande
 * para notificar al vendedor, y el título/mensaje de esa notificación.
 *
 * @module utils/cashRegisterHelpers
 */

/**
 * @param {number} diferencia - Diferencia entre lo declarado y lo esperado al cerrar caja
 *   (negativa = faltante, positiva = sobrante).
 * @param {number} [umbral=5000] - Monto absoluto a partir del cual se considera significativo.
 * @returns {{esSignificativo: boolean, esFaltante: boolean, titulo: string, mensaje: string}}
 */
function evaluarDescuadreCaja(diferencia, umbral = 5000) {
  const esSignificativo = Math.abs(diferencia) > umbral;
  const esFaltante = diferencia < 0;
  const titulo = esFaltante ? '⚠️ Faltante en Caja' : '💰 Sobrante en Caja';
  const mensaje = `Tu cierre de caja tuvo un ${esFaltante ? 'faltante' : 'sobrante'} de $${Math.abs(diferencia).toLocaleString('es-CO')}. Revisa tus comprobantes.`;

  return { esSignificativo, esFaltante, titulo, mensaje };
}

module.exports = { evaluarDescuadreCaja };
