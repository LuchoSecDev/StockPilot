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

/**
 * Valida el monto que el vendedor declara al cerrar la caja (y al pedir la vista previa del cierre).
 * Antes solo se rechazaba el monto ausente o negativo: un `null` (lo que llega cuando el cliente manda NaN) o un
 * texto como «abc» pasaba la validación y se guardaba un arqueo sin sentido.
 *
 * @param {unknown} valor - Lo recibido en `monto_cierre_declarado`.
 * @returns {number|null} El monto como número, o `null` si no es un número finito >= 0 (se acepta un número o un
 *   texto numérico como «60000» o «60000.50»).
 */
function normalizarMontoDeclarado(valor) {
  let monto;
  if (typeof valor === 'number') {
    monto = valor;
  } else if (typeof valor === 'string' && /^\d+(\.\d+)?$/.test(valor.trim())) {
    monto = Number(valor.trim());
  } else {
    return null;
  }
  return Number.isFinite(monto) && monto >= 0 ? monto : null;
}

module.exports = { evaluarDescuadreCaja, normalizarMontoDeclarado };
