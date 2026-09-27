/**
 * @file ordenesBorrador.js
 * @description Reglas puras para armar borradores de orden de compra desde el Consejero IA:
 * agrupar por proveedor, separar productos sin proveedor y omitir los que ya no necesitan reposición.
 *
 * @module utils/ordenesBorrador
 */

/**
 * @param {Array<{id_producto:number, id_proveedor:(number|null), cantidad:number}>} items
 * @returns {{grupos: Array<{id_proveedor:number, items:Array}>, sinProveedor:number[], omitidos:number[]}}
 *   `omitidos`: cantidad que no es un entero > 0 (nada que pedir); `sinProveedor`: sin proveedor asignado.
 */
function agruparPorProveedor(items) {
  const grupos = new Map();
  const sinProveedor = [];
  const omitidos = [];
  const vistos = new Set();
  for (const it of items) {
    if (vistos.has(it.id_producto)) continue; // un producto una sola vez
    vistos.add(it.id_producto);
    const cantidad = Math.floor(Number(it.cantidad));
    if (!Number.isFinite(cantidad) || cantidad <= 0) { omitidos.push(it.id_producto); continue; }
    if (it.id_proveedor === null || it.id_proveedor === undefined) { sinProveedor.push(it.id_producto); continue; }
    if (!grupos.has(it.id_proveedor)) grupos.set(it.id_proveedor, []);
    grupos.get(it.id_proveedor).push({ ...it, cantidad });
  }
  return {
    grupos: [...grupos.entries()].map(([id_proveedor, lista]) => ({ id_proveedor, items: lista })),
    sinProveedor,
    omitidos,
  };
}

/** Total de una lista de líneas: Σ cantidad × costo. */
function totalOrden(lineas) {
  return lineas.reduce((acc, l) => acc + Number(l.cantidad) * Number(l.costo_unitario || 0), 0);
}

/**
 * Nivel de riesgo de una orden de compra generada por el Consejero IA: alto si excede el
 * presupuesto o si incluye productos en estado crítico de agotamiento; medio si incluye
 * productos en alerta (naranja); bajo en cualquier otro caso.
 *
 * @param {number} totalCost
 * @param {number} budgetLimit
 * @param {number} itemsCriticos - Cantidad de productos con nivel_riesgo 'critical'.
 * @param {number} itemsNaranja - Cantidad de productos con nivel_riesgo 'medium'.
 * @returns {{riskLevel: string, riskReason: string}}
 */
function evaluarRiesgoOrden(totalCost, budgetLimit, itemsCriticos, itemsNaranja) {
  let riskLevel = 'Bajo';
  let riskReason = 'Presupuesto holgado y riesgos de stock controlables.';

  if (totalCost > budgetLimit) {
    riskLevel = 'Alto';
    riskReason = 'El costo total excede el presupuesto máximo establecido.';
  } else if (itemsCriticos > 0) {
    riskLevel = 'Alto';
    riskReason = `Existen ${itemsCriticos} productos en estado crítico de agotamiento (Rojo). Requiere revisión urgente.`;
  } else if (itemsNaranja > 0) {
    riskLevel = 'Medio';
    riskReason = `Existen ${itemsNaranja} productos en alerta de agotamiento (Naranja). Requiere revisión manual antes de enviarse.`;
  }

  return { riskLevel, riskReason };
}

module.exports = { agruparPorProveedor, totalOrden, evaluarRiesgoOrden };
