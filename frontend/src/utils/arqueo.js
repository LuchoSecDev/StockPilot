// Reglas puras del cierre de caja en la web: cómo leer lo que escribe el vendedor, cómo describir la diferencia y
// cuándo el arqueo final ya no coincide con el que vio en la vista previa. Sin React, para poder probarlas
// (tests/business_logic/arqueo_cierre.test.js).

export const formatoPesos = (n) => `$${Number(n).toLocaleString('es-CO')}`;

// Los importes se redondean a centavos para que el ruido de los decimales (0,1 + 0,2) no se lea como una diferencia.
const aCentavos = (n) => Math.round(Number(n) * 100);

/**
 * El monto que el vendedor escribió en el cajón de «Efectivo total», como número; `null` si está vacío, no es un
 * número finito o es negativo (el servidor lo rechazaría igual: [K5] y [K3] validan lo mismo).
 */
export function montoContado(texto) {
  if (texto === '' || texto === null || texto === undefined) return null;
  const monto = Number(texto);
  return Number.isFinite(monto) && monto >= 0 ? monto : null;
}

/**
 * Cómo se llama y qué dice la diferencia (declarado − esperado) de un arqueo.
 * @returns {{tipo: 'cuadra'|'sobra'|'falta', titulo: string, detalle: string}}
 */
export function describirDiferencia(diferencia) {
  const centavos = aCentavos(diferencia);
  if (centavos === 0) {
    return { tipo: 'cuadra', titulo: 'Cuadra', detalle: 'Lo que contaste coincide con lo que debería haber.' };
  }
  if (centavos > 0) {
    return { tipo: 'sobra', titulo: 'Sobra', detalle: `Hay ${formatoPesos(centavos / 100)} de más en el cajón.` };
  }
  return { tipo: 'falta', titulo: 'Falta', detalle: `Faltan ${formatoPesos(Math.abs(centavos) / 100)} en el cajón.` };
}

/**
 * `true` si el arqueo del cierre real ([K3]) no coincide con el de la vista previa ([K5]): entre una y otra se
 * registró una venta, un egreso o un abono, y el vendedor debe saberlo.
 */
export function elArqueoCambio(previo, final) {
  if (!previo || !final) return false;
  return (
    aCentavos(previo.monto_cierre_calculado) !== aCentavos(final.monto_cierre_calculado) ||
    aCentavos(previo.diferencia) !== aCentavos(final.diferencia)
  );
}

/** Las líneas del desglose: de dónde sale lo que debería haber en el cajón. */
export function lineasDelArqueo(arqueo) {
  return [
    { clave: 'apertura', etiqueta: 'Fondo inicial', signo: '', monto: arqueo.monto_apertura },
    { clave: 'ventas', etiqueta: 'Ventas en efectivo', signo: '+', monto: arqueo.ventas_efectivo },
    { clave: 'abonos', etiqueta: 'Abonos en efectivo', signo: '+', monto: arqueo.abonos_efectivo },
    { clave: 'egresos', etiqueta: 'Egresos (gastos)', signo: '−', monto: arqueo.egresos },
  ];
}

const ORDEN_DE_METODOS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Fiado', 'Otro'];
const ETIQUETAS_DE_METODOS = {
  Efectivo: 'Efectivo',
  Tarjeta: 'Tarjeta',
  Transferencia: 'Transferencia',
  Fiado: 'Fiado (crédito)',
  Otro: 'Otro método',
};

/**
 * El desglose por método de pago de un turno ([K5], [K3] e historial de caja) como una lista ordenada para pintarla.
 * [porMetodo] es `{ Efectivo: {cantidad, total}, Tarjeta: {...}, ... }`.
 *
 * @param {{soloConMovimiento?: boolean}} opciones - `true` deja fuera los métodos sin ventas ni importe.
 * @returns {Array<{metodo: string, etiqueta: string, cantidad: number, total: number, entraAlCajon: boolean}>}
 *   `entraAlCajon` es verdadero solo para el efectivo: tarjeta, transferencia y fiado no son dinero en el cajón.
 */
export function lineasPorMetodo(porMetodo, { soloConMovimiento = false } = {}) {
  if (!porMetodo) return [];
  const posicion = (metodo) => {
    const i = ORDEN_DE_METODOS.indexOf(metodo);
    return i < 0 ? ORDEN_DE_METODOS.length : i;
  };
  return Object.keys(porMetodo)
    .sort((x, y) => posicion(x) - posicion(y))
    .map((metodo) => ({
      metodo,
      etiqueta: ETIQUETAS_DE_METODOS[metodo] ?? metodo,
      cantidad: Number(porMetodo[metodo]?.cantidad ?? 0),
      total: Number(porMetodo[metodo]?.total ?? 0),
      entraAlCajon: metodo === 'Efectivo',
    }))
    .filter((l) => !soloConMovimiento || l.cantidad > 0 || aCentavos(l.total) !== 0);
}

/** «2 ventas» / «1 venta», para el desglose. */
export const textoDeVentas = (cantidad) => `${cantidad} ${cantidad === 1 ? 'venta' : 'ventas'}`;
