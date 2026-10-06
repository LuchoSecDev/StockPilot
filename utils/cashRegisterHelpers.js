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

/** Los métodos de pago de una venta (contrato [V2]). Cualquier otro texto cae en «Otro». */
const METODOS_VENTA = ['Efectivo', 'Tarjeta', 'Transferencia', 'Fiado'];

/** Los métodos con que se puede abonar a la cuenta de un cliente. «Fiado» no es una forma de pagar un abono. */
const METODOS_ABONO = ['Efectivo', 'Tarjeta', 'Transferencia'];

/**
 * Agrupa por método de pago lo que ya viene sumado por la base de datos (una fila por método) para el desglose de
 * auditoría del cierre de caja: cuánto se movió por cada método en un turno.
 *
 * Todas las claves de [metodosConocidos] aparecen siempre (en cero si no hubo movimiento) y se agrega «Otro», que
 * recoge cualquier método fuera de los conocidos (datos viejos, de cuando el servidor guardaba cualquier texto) para
 * que ningún importe quede fuera de la cuenta.
 *
 * @param {Array<{metodo_pago: string, cantidad: number|string, total: number|string}>} filas
 * @param {string[]} metodosConocidos
 * @returns {Object<string, {cantidad: number, total: number}>}
 */
function desglosePorMetodo(filas, metodosConocidos) {
  const desglose = {};
  for (const metodo of [...metodosConocidos, 'Otro']) {
    desglose[metodo] = { cantidad: 0, total: 0 };
  }
  for (const fila of filas) {
    const clave = metodosConocidos.includes(fila.metodo_pago) ? fila.metodo_pago : 'Otro';
    desglose[clave].cantidad += Number(fila.cantidad);
    desglose[clave].total += parseFloat(fila.total || 0);
  }
  // Dinero: se redondea a centavos para que sumar decimales no deje restos como 0.30000000000000004.
  for (const metodo of Object.keys(desglose)) {
    desglose[metodo].total = Math.round(desglose[metodo].total * 100) / 100;
  }
  return desglose;
}

module.exports = { evaluarDescuadreCaja, normalizarMontoDeclarado, desglosePorMetodo, METODOS_VENTA, METODOS_ABONO };
