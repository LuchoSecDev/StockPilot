/**
 * @file candidatosPromocion.js
 * @description Decide QUÉ productos merecen una promoción: estancados (rotación baja con stock),
 * por vencer (< 30 días) o con sobrestock, y que además NO hagan falta reponer (nunca se sugiere
 * un descuento para algo agotado o crítico: sería contradictorio, plan 17 decisión 6). Los más
 * próximos a vencer van primero y se devuelven como máximo 10.
 *
 * Puro: recibe las filas y la hora actual, así se prueba sin BD ni reloj.
 *
 * @module services/ia/candidatosPromocion
 */
const { calcularReposicion } = require('../inventory/reposicion');

const MS_POR_DIA = 1000 * 60 * 60 * 24;
const MAX_CANDIDATOS = 10;

/**
 * Días que faltan para que venza, o `null` si el producto no tiene fecha de vencimiento.
 * @param {string|Date|null} fechaVencimiento
 * @param {Date} [ahora]
 * @returns {number|null}
 */
function diasParaVencer(fechaVencimiento, ahora = new Date()) {
  return fechaVencimiento ? (new Date(fechaVencimiento) - ahora) / MS_POR_DIA : null;
}

/**
 * @param {Array<Object>} filas - Productos elegibles (ver `datosPromociones.leerFilasElegibles`).
 * @param {Date} [ahora]
 * @returns {Array<Object>} Hasta 10 candidatos, los que vencen antes primero.
 */
function elegirCandidatos(filas, ahora = new Date()) {
  return filas
    .filter(r => {
      const tendencia = r.velocity_30d > 0.01 ? (r.velocity_7d / r.velocity_30d) : 0.5;
      const rotacionBaja = tendencia < 0.7 && r.stock > 10;
      const dias = diasParaVencer(r.fecha_vencimiento, ahora);
      const porVencer = dias !== null && dias < 30;
      const sobrestock = r.stock > 50 && r.velocity_30d < 1;
      if (!(rotacionBaja || porVencer || sobrestock)) return false;

      const { nivel } = calcularReposicion({
        ventasDia7: r.velocity_7d, ventasDia30: r.velocity_30d,
        stock: r.stock, stockSeguridad: r.stock_seguridad, stockMinimo: r.stock_minimo,
        leadTime: r.lead_time, frecuenciaCompraDias: r.frecuencia_compra_dias,
      });
      return nivel === 'ok';
    })
    .sort((a, b) => {
      // Sin fecha de vencimiento van al final.
      const diasA = diasParaVencer(a.fecha_vencimiento, ahora) ?? 9999;
      const diasB = diasParaVencer(b.fecha_vencimiento, ahora) ?? 9999;
      return diasA - diasB;
    })
    .slice(0, MAX_CANDIDATOS);
}

module.exports = { diasParaVencer, elegirCandidatos };
