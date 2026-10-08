/**
 * @file contextoRecomendaciones.js
 * @description Parte PURA del Consejero IA (sin BD, sin red, sin reloj): arma lo que se le
 * muestra al modelo a partir de las entradas del motor de reposición, y convierte los ajustes
 * que propone la IA en recomendaciones finales aplicando los guardrails. Está separada de
 * `recomendaciones.js` para poder probarla con datos sueltos.
 *
 * @module services/ia/contextoRecomendaciones
 */
const { esRecomendacionAccionable } = require('../../utils/recomendacionesDashboard');
const { calcularReposicion, costoUnitario } = require('../inventory/reposicion');
const { aplicarAjusteIA } = require('../inventory/guardrailsIA');

/**
 * Cruza cada producto con el motor único de reposición (misma fórmula que Proveedores y
 * Detalle de Productos).
 * @param {Array<Object>} entradas - Salida de `leerEntradasMotor`.
 * @returns {Array<Object>} Un elemento por producto, con cantidad base, urgencia, costo y tendencia.
 */
function armarContextoProductos(entradas) {
  return entradas.map(item => {
    const rep = calcularReposicion({
      ventasDia7: item.velocity_7d,
      ventasDia30: item.velocity_30d,
      ventas30Total: item.qty_30d_total,
      claseABC: item.claseABC,
      stock: item.stock_actual,
      stockSeguridad: item.stock_seguridad,
      stockMinimo: item.stock_minimo,
      leadTime: item.lead_time,
      frecuenciaCompraDias: item.frecuencia_compra_dias,
      factorIA: item.factor_ia,
    });
    const costo = costoUnitario({ costoCompra: item.costo_compra, precio: item.precio });

    return {
      id: item.id_producto,
      nombre: item.nombre_producto,
      stock: item.stock_actual,
      base_load: rep.cantidadBase,
      abc: item.claseABC,
      trend_val: rep.tendencia,
      trend_label: rep.tendencia > 1.2 ? 'alcista' : (rep.tendencia < 0.8 ? 'bajista' : 'estable'),
      urgencia: rep.urgencia,
      nivel: rep.nivel,
      dias_para_agotar: rep.diasParaAgotar,
      id_proveedor: item.id_proveedor,
      proveedor: item.proveedor,
      costo_unitario: costo.costo,
      costo_estimado: costo.estimado,
      risk: rep.riesgo,
      // Misma definición de «confianza» que Proveedores (últimas 5 evaluaciones). Sin evaluaciones, null.
      avg_precision: item.factor_ia
    };
  });
}

/**
 * Convierte los ajustes de la IA en recomendaciones finales. El ajuste se recorta con
 * `aplicarAjusteIA` (límites por clase ABC), así la IA nunca puede pasarse del tope.
 * @param {Array<{id: *, adjustment?: string, reason?: string}>} ajustesIA
 * @param {Array<Object>} contextoProductos - Salida de `armarContextoProductos`.
 * @returns {Array<Object>} Solo las accionables (descarta ids desconocidos y sugerencias de 0 unidades).
 */
function armarRecomendaciones(ajustesIA, contextoProductos) {
  return ajustesIA.map(adj => {
    // La IA a veces devuelve el id como texto ("12") o omite el ajuste: se compara como texto y se tolera un ajuste ausente.
    const original = contextoProductos.find(i => String(i.id) === String(adj.id));
    if (!original) return null;

    const ajusteNumerico = parseInt(String(adj.adjustment ?? '').replace(/[^0-9-]/g, '')) || 0;
    const { clampedAdj, finalTotal } = aplicarAjusteIA(original.base_load, ajusteNumerico, original.abc);

    return {
      id_producto: original.id,
      id_proveedor: original.id_proveedor ?? null,
      proveedor: original.proveedor ?? null,
      costo_unitario: original.costo_unitario,
      costo_estimado: original.costo_estimado,
      urgencia: original.urgencia,
      dias_para_agotar: original.dias_para_agotar,
      product: original.nombre,
      base: original.base_load,
      adjustment: clampedAdj > 0 ? `+${clampedAdj}%` : `${clampedAdj}%`,
      final: finalTotal,
      reason: adj.reason,
      // 50% por defecto si no hay historial de evaluaciones, para reflejar incertidumbre.
      confidence: original.avg_precision !== null && original.avg_precision !== undefined
        ? Math.round(original.avg_precision * 100)
        : 50,
      trend: original.trend_label
    };
  }).filter(esRecomendacionAccionable);
}

module.exports = { armarContextoProductos, armarRecomendaciones };
