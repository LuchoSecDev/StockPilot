/**
 * @file umbralesProducto.js
 * @description Sugiere stock mínimo, stock de seguridad y lead time al crear o editar un
 * producto, a partir de las ventas reales: las del propio producto (si existe) o el promedio de
 * su categoría (si es nuevo). Sin historial devuelve valores base. La matemática del punto de
 * reorden está en `sugerenciasStock.js` (pura); aquí solo se leen los datos.
 *
 * @module services/inventory/umbralesProducto
 */
const db = require('../../config/database');
const { sugerirUmbralesStock } = require('./sugerenciasStock');

const LEAD_TIME_POR_DEFECTO = 3;
const UMBRALES_BASE = { stock_minimo: 5, stock_seguridad: 2 };
const NOTA_SIN_HISTORIAL = 'Sin historial de ventas suficiente. Se sugieren valores base predeterminados.';

/** Ventas diarias promedio del producto en los últimos 30 días (0 si no vendió). */
async function ventasDiariasDelProducto(idProducto) {
  const filas = await db.allAsync(`
    SELECT COALESCE(SUM(vp.cantidad), 0) / 30.0 AS avg_daily
    FROM VentasProductos vp
    JOIN Ventas v ON vp.id_venta = v.id_venta
    WHERE vp.id_producto = ? AND v.fecha_salida >= CURRENT_DATE - INTERVAL '30 days'
  `, [idProducto]);
  return filas.length > 0 && filas[0].avg_daily > 0 ? parseFloat(filas[0].avg_daily) : 0;
}

/** Ventas diarias promedio de un producto «típico» de la categoría (ventas de la categoría ÷ sus productos). */
async function ventasDiariasDeLaCategoria(tiendaId, categoria) {
  const filas = await db.allAsync(`
    SELECT COALESCE(SUM(vp.cantidad), 0) / 30.0 AS cat_avg_daily
    FROM VentasProductos vp
    JOIN Ventas v ON vp.id_venta = v.id_venta
    JOIN Productos p ON vp.id_producto = p.id_producto
    WHERE p.id_tienda = ? AND p.categoria = ?
    AND v.fecha_salida >= CURRENT_DATE - INTERVAL '30 days'
  `, [tiendaId, categoria]);
  if (!(filas.length > 0 && filas[0].cat_avg_daily > 0)) return 0;

  const conteo = await db.getAsync('SELECT COUNT(*) as count FROM Productos WHERE id_tienda = ? AND categoria = ?', [tiendaId, categoria]);
  const productosEnCategoria = (conteo && conteo.count > 0) ? conteo.count : 1;
  return parseFloat(filas[0].cat_avg_daily) / productosEnCategoria;
}

/**
 * @param {number} tiendaId
 * @param {Object} consulta
 * @param {number|string} [consulta.idProducto] - Producto existente (tiene prioridad sobre la categoría).
 * @param {string} [consulta.categoria] - Para un producto nuevo.
 * @param {number|string} [consulta.idProveedor] - Para un producto nuevo: promedia el lead time de ese proveedor.
 * @returns {Promise<{stock_minimo: number, stock_seguridad: number, lead_time: number, nota: string}>}
 */
async function sugerirUmbralesProducto(tiendaId, { idProducto, categoria, idProveedor }) {
  let ventasDiarias = 0;
  let leadTime = LEAD_TIME_POR_DEFECTO;

  if (idProducto) {
    ventasDiarias = await ventasDiariasDelProducto(idProducto);
    const producto = await db.getAsync('SELECT lead_time FROM Productos WHERE id_producto = ?', [idProducto]);
    if (producto && producto.lead_time > 0) leadTime = producto.lead_time;
  } else if (categoria) {
    ventasDiarias = await ventasDiariasDeLaCategoria(tiendaId, categoria);
  }

  // Sin historial (ni propio ni de categoría): valores base.
  if (!ventasDiarias || ventasDiarias <= 0) {
    return { ...UMBRALES_BASE, lead_time: leadTime, nota: NOTA_SIN_HISTORIAL };
  }

  // Producto nuevo con proveedor: el lead time es el promedio de los productos de ese proveedor.
  if (!idProducto && idProveedor) {
    const promedio = await db.getAsync(`
      SELECT AVG(lead_time) as avg_lead
      FROM Productos
      WHERE id_tienda = ? AND id_proveedor = ? AND lead_time > 0
    `, [tiendaId, idProveedor]);
    if (promedio && promedio.avg_lead) leadTime = Math.ceil(promedio.avg_lead);
  }

  const { stockSeguridad, stockMinimo } = sugerirUmbralesStock(ventasDiarias, leadTime);
  return {
    stock_minimo: stockMinimo,
    stock_seguridad: stockSeguridad,
    lead_time: leadTime,
    nota: idProducto
      ? 'Sugerencia basada en las ventas reales de los últimos 30 días.'
      : 'Sugerencia basada en el promedio de ventas de la categoría.'
  };
}

module.exports = { sugerirUmbralesProducto };
