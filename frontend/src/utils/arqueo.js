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
