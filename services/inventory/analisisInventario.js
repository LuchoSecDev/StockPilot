/**
 * @file analisisInventario.js
 * @description Snapshot analítico del inventario con fórmulas puras (ROP, ABC, velocidad): sin IA.
 * Usa el MISMO motor de reposición que el Consejero y Proveedores (plan 17, fase 0), así un
 * producto no puede verse «en riesgo» en una pantalla y «sano» en otra. Puro (sin BD): la lectura
 * está en `snapshotAnalitico.js`.
 *
 * @module services/inventory/analisisInventario
 */
const { calcularReposicion, costoUnitario } = require('./reposicion');

const DIAS_COBERTURA_MIN = 7;
const DIAS_COBERTURA_MAX = 90;

/**
 * Objetivo de cobertura pedido por el Simulador de Escenarios (plan 18). Solo se respeta entre
 * 7 y 90 días; cualquier otra cosa (ausente, texto, fuera de rango) se ignora y cada producto
 * sigue usando su cobertura normal por clase ABC (15/30/45 días).
 * @param {*} valor - Normalmente `req.query.dias`.
 * @returns {number|undefined}
 */
function normalizarDiasCobertura(valor) {
  const dias = parseInt(valor, 10);
  return Number.isFinite(dias) && dias >= DIAS_COBERTURA_MIN && dias <= DIAS_COBERTURA_MAX ? dias : undefined;
}

/**
 * @param {Array<Object>} entradas - Salida de `leerEntradasMotor`.
 * @param {number} [diasCoberturaOverride]
 * @returns {Array<Object>} Una fila por producto con riesgo, ROP, cantidad recomendada y días para agotar.
 */
function armarSnapshot(entradas, diasCoberturaOverride) {
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
    }, { diasCoberturaOverride });
    const costo = costoUnitario({ costoCompra: item.costo_compra, precio: item.precio });

    return {
      id_producto: item.id_producto,
      id_proveedor: item.id_proveedor,
      proveedor: item.proveedor,
      nombre: item.nombre_producto,
      categoria: item.categoria,
      category: item.claseABC,
      risk: rep.riesgo,
      urgencia: rep.urgencia,
      nivel: rep.nivel,
      precio: item.precio,
      costo_unitario: costo.costo,
      costo_estimado: costo.estimado,
      cantidad_recomendada: rep.cantidadBase,
      velocity: item.velocity_30d,
      stock_actual: item.stock_actual,
      stock_seguridad: item.stock_seguridad,
      lead_time: item.lead_time,
      // null sin ventas que medir; el frontend lo trata igual que «Estable» / sin días que contar.
      days_to_exhaust: rep.diasParaAgotar,
      revenue: Math.round(item.revenue),
      rop: rep.rop
    };
  });
}

module.exports = { normalizarDiasCobertura, armarSnapshot };
