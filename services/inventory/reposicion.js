/**
 * @file reposicion.js
 * @description Motor único de reposición (puro: sin BD ni OpenAI). El Dashboard (Consejero IA) y
 * Proveedores calculaban la cantidad a pedir con fórmulas distintas y un mismo producto salía con
 * cantidades diferentes en cada pantalla. Aquí vive la única fórmula, más la urgencia
 * ("Pide hoy" / "En esta compra" / "Puede esperar") calculada con el tiempo de entrega del proveedor,
 * y el nivel de stock (Catálogo, Alertas) — plan 17.
 *
 * @module services/inventory/reposicion
 */

const DIAS_COBERTURA = { A: 15, B: 30, C: 45 };
const TENDENCIA_MIN = 0.5;
const TENDENCIA_MAX = 2;
// Con menos unidades vendidas en 30 días la tendencia no es confiable (p. ej. 3,48x con 0,53 u/día).
const MIN_VENTAS_PARA_TENDENCIA = 5;
const MARGEN_MEDIO_POR_DEFECTO = 0.25;
const FRECUENCIA_COMPRA_POR_DEFECTO = 7;

// "Esta semana" pasó a llamarse "En esta compra" (plan 17, decisión 2): la ventana ya no es
// necesariamente de 7 días, depende de frecuencia_compra_dias de cada producto.
const URGENCIA = { HOY: 'Pide hoy', SEMANA: 'En esta compra', ESPERAR: 'Puede esperar' };

// Niveles de Catálogo/Alertas (plan 17, decisión 1). Nombres neutros a propósito: el "BAJO" de
// `riesgo` de aquí abajo significa "sano" (lo opuesto de crítico); si se llamara "bajo" también el
// nivel, alguien podría confundirlo con "hay que reponer", que es justo lo contrario.
const NIVEL = { AGOTADO: 'agotado', CRITICO: 'critico', REPONER: 'reponer', OK: 'ok' };

const { techoSeguro } = require('../../utils/redondeo');

const num = (v, def = 0) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : def);

/**
 * Tendencia = ventas/día de los últimos 7 días ÷ de los últimos 30, acotada y solo con muestra suficiente.
 * @returns {number} Multiplicador entre 0,5 y 2 (1 si no hay datos confiables).
 */
function calcularTendencia(ventasDia7, ventasDia30, ventas30Total) {
  const v30 = num(ventasDia30);
  if (v30 <= 0.01 || num(ventas30Total, v30 * 30) < MIN_VENTAS_PARA_TENDENCIA) return 1;
  const bruta = num(ventasDia7) / v30;
  return Math.min(TENDENCIA_MAX, Math.max(TENDENCIA_MIN, bruta));
}

/**
 * @param {Object} p
 * @param {number} p.ventasDia7 - Unidades/día de los últimos 7 días.
 * @param {number} p.ventasDia30 - Unidades/día de los últimos 30 días.
 * @param {number} [p.ventas30Total] - Unidades vendidas en 30 días (si falta, se deduce).
 * @param {'A'|'B'|'C'} p.claseABC
 * @param {number} p.stock
 * @param {number} p.stockSeguridad
 * @param {number} [p.stockMinimo=0] - Piso fijado a mano por el administrador (nunca decide "crítico"/"agotado";
 *   solo sirve de piso para "reponer" y para la cantidad sugerida de un producto sin historial de ventas).
 * @param {number} p.leadTime - Días que tarda el proveedor en entregar.
 * @param {number} [p.frecuenciaCompraDias=7] - Cada cuántos días se suele comprar este producto.
 * @param {number} [p.factorIA=1] - Factor de aprendizaje (Feedback_IA); solo afecta el punto de reorden.
 * @param {Object} [opciones]
 * @param {number} [opciones.diasCoberturaOverride] - Reemplaza el `DIAS_COBERTURA` fijo por ABC (plan 18,
 *   Simulador de Escenarios). No afecta el piso de `stock_minimo`/`stock_seguridad` de abajo: un producto
 *   sin ventas sigue mostrando ese piso sin importar este valor.
 * @returns {{cantidadBase:number, stockObjetivo:number, rop:number, tendencia:number,
 *   diasParaAgotar:(number|null), riesgo:string, urgencia:string, nivel:string}}
 */
function calcularReposicion(p, opciones = {}) {
  const v30 = num(p.ventasDia30);
  const stock = num(p.stock);
  const seguridad = num(p.stockSeguridad);
  const stockMinimo = num(p.stockMinimo, 0);
  const leadTime = num(p.leadTime, 3);
  const frecuenciaCompraDias = num(p.frecuenciaCompraDias, FRECUENCIA_COMPRA_POR_DEFECTO) || FRECUENCIA_COMPRA_POR_DEFECTO;
  const factorIA = num(p.factorIA, 1) || 1;

  const tendencia = calcularTendencia(p.ventasDia7, v30, p.ventas30Total);
  const diasOverride = num(opciones.diasCoberturaOverride, null);
  const dias = diasOverride ?? (DIAS_COBERTURA[p.claseABC] ?? DIAS_COBERTURA.C);
  const stockObjetivo = v30 * tendencia * dias + seguridad;
  let cantidadBase = Math.max(0, techoSeguro(stockObjetivo - stock));

  // Sin ventas no hay señal para calcular cuánto pedir, y stockObjetivo puede salir en 0 si además
  // stock_seguridad tampoco está configurado (su valor por defecto). Un producto nuevo y agotado no
  // debe quedarse sin ninguna cantidad sugerida solo por falta de historial (plan 17, decisión 4).
  if (v30 <= 0.01) {
    const piso = Math.max(0, Math.max(seguridad, stockMinimo) - stock);
    cantidadBase = Math.max(cantidadBase, Math.ceil(piso));
  }

  const rop = techoSeguro((v30 * leadTime + seguridad) * factorIA);
  const riesgo = stock <= seguridad ? 'CRÍTICO' : (stock <= rop ? 'MEDIO' : 'BAJO');

  const diasParaAgotar = v30 > 0.01 ? Math.floor(stock / v30) : null;
  let urgencia = URGENCIA.ESPERAR;
  if (stock <= 0) {
    // Sin stock es "Pide hoy" siempre, incluso si stockSeguridad es 0 (el valor por defecto) y por
    // lo tanto cantidadBase podría salir en 0 sin el piso de arriba: antes esto quedaba fuera del
    // `if` de abajo y un producto agotado sin historial se veía "Puede esperar" (plan 17, hallazgo E1).
    urgencia = URGENCIA.HOY;
  } else if (cantidadBase > 0) {
    // Sin ventas registradas no hay días para agotar que calcular; si además el riesgo ya es CRÍTICO
    // (stock por debajo del mínimo de seguridad), es urgente igual, no hay que esperar a que se venda.
    // Con ventas registradas manda el cálculo real de días (así Papas Margarita, con 330 días de stock
    // aunque esté bajo su mínimo, no se trata igual que Leche Alquería, que no tiene ventas que medir).
    if ((diasParaAgotar === null && riesgo === 'CRÍTICO') || (diasParaAgotar !== null && diasParaAgotar <= leadTime)) urgencia = URGENCIA.HOY;
    // La ventana ya no es "la próxima semana" a secas: es "antes de la próxima compra habitual de
    // este producto" (lead time + cada cuánto se suele pedir). Alert.js ya usaba esta misma cuenta.
    else if (diasParaAgotar !== null && diasParaAgotar <= leadTime + frecuenciaCompraDias) urgencia = URGENCIA.SEMANA;
  }

  // Nivel de Catálogo/Alertas (plan 17, decisión 1): agotado > crítico > reponer > ok, en ese orden.
  const umbralReponer = Math.max(rop, stockMinimo);
  let nivel = NIVEL.OK;
  if (stock <= 0) nivel = NIVEL.AGOTADO;
  else if (urgencia === URGENCIA.HOY) nivel = NIVEL.CRITICO;
  else if (urgencia === URGENCIA.SEMANA || stock <= umbralReponer) nivel = NIVEL.REPONER;

  return { cantidadBase, stockObjetivo, rop, tendencia, diasParaAgotar, riesgo, urgencia, nivel };
}

/**
 * Costo unitario para valorar una orden: `costo_compra`; si falta, precio × (1 − margen medio) y se marca estimado.
 * @returns {{costo:number, estimado:boolean}}
 */
function costoUnitario({ costoCompra, precio, margenMedio = MARGEN_MEDIO_POR_DEFECTO }) {
  const c = num(costoCompra);
  if (c > 0) return { costo: c, estimado: false };
  return { costo: Math.round(num(precio) * (1 - margenMedio) * 100) / 100, estimado: true };
}

module.exports = { calcularReposicion, calcularTendencia, costoUnitario, URGENCIA, NIVEL, DIAS_COBERTURA };
