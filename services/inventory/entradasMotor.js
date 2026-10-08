/**
 * @file entradasMotor.js
 * @description Plan 17, Fase 0: una sola consulta con las entradas que necesita `reposicion.js`
 * (velocidad de venta a 7 y 30 días, clase ABC y factor de aprendizaje de la IA), para que el
 * Consejero, Proveedores y Detalle de Productos dejen de calcular cada uno lo suyo.
 *
 * La clase ABC se calcula siempre sobre **toda la tienda** (el ranking de ingresos no cambia según
 * quién pida los datos). Antes, Proveedores calculaba el ABC solo entre los productos de un
 * proveedor, así que un mismo producto podía salir clase A en el Consejero y clase C en Proveedores,
 * y terminaba recomendando cantidades muy distintas (plan 17, hallazgo E2). Quien necesite ver solo
 * los productos de un proveedor filtra el arreglo que devuelve esta función, no la consulta.
 *
 * @module services/inventory/entradasMotor
 */

/**
 * @param {import('../config/database')} database - El mismo objeto `db` del resto del proyecto.
 * @param {number} tiendaId
 * @returns {Promise<Array<{
 *   id_producto:number, nombre_producto:string, categoria:string, stock_actual:number, precio:number, costo_compra:number,
 *   id_proveedor:(number|null), proveedor:(string|null), stock_seguridad:number, stock_minimo:number,
 *   lead_time:number, frecuencia_compra_dias:number,
 *   velocity_7d:number, velocity_30d:number, qty_30d_total:number, factor_ia:number,
 *   claseABC:('A'|'B'|'C'), revenue:number
 * }>>}
 */
async function leerEntradasMotor(database, tiendaId) {
  const query = `
    WITH VentasRecientes AS (
      SELECT vp.id_producto,
        SUM(CASE WHEN v.fecha_salida >= (CURRENT_DATE - INTERVAL '7 days') THEN vp.cantidad ELSE 0 END) as qty_7d,
        SUM(CASE WHEN v.fecha_salida >= (CURRENT_DATE - INTERVAL '30 days') THEN vp.cantidad ELSE 0 END) as qty_30d
      FROM Ventas v
      JOIN VentasProductos vp ON v.id_venta = vp.id_venta
      WHERE v.id_tienda = ?
      GROUP BY vp.id_producto
    ),
    FactorIA AS (
      -- Promedio de las últimas 5 evaluaciones por producto (misma definición que ya usaba Proveedores)
      SELECT id_producto, AVG(factor_precision) as factor_ia
      FROM (
        SELECT id_producto, factor_precision,
          ROW_NUMBER() OVER (PARTITION BY id_producto ORDER BY fecha_evaluacion DESC) as rn
        FROM Feedback_IA
      ) recientes
      WHERE rn <= 5
      GROUP BY id_producto
    ),
    BaseData AS (
      SELECT
        p.id_producto, p.nombre_producto, p.categoria, p.cantidad as stock_actual, p.precio, p.costo_compra,
        p.id_proveedor, prov.nombre_empresa as proveedor,
        p.stock_seguridad, p.stock_minimo, p.lead_time, p.frecuencia_compra_dias,
        COALESCE(vr.qty_7d, 0) / 7.0 as velocity_7d,
        COALESCE(vr.qty_30d, 0) / 30.0 as velocity_30d,
        COALESCE(vr.qty_30d, 0) as qty_30d_total,
        fia.factor_ia,
        (COALESCE(vr.qty_30d, 0) / 30.0) * 30 * p.precio as revenue
      FROM Productos p
      LEFT JOIN VentasRecientes vr ON p.id_producto = vr.id_producto
      LEFT JOIN FactorIA fia ON p.id_producto = fia.id_producto
      LEFT JOIN Proveedores prov ON prov.id_proveedor = p.id_proveedor
      WHERE p.id_tienda = ? AND p.estado = 'Disponible'
    ),
    AccumData AS (
      SELECT *,
        SUM(revenue) OVER () as totalRevenue,
        SUM(revenue) OVER (ORDER BY revenue DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as accum
      FROM BaseData
    )
    SELECT *,
      CASE
        WHEN totalRevenue = 0 THEN 'A'
        WHEN (accum / totalRevenue) <= 0.8 THEN 'A'
        WHEN (accum / totalRevenue) <= 0.95 THEN 'B'
        ELSE 'C'
      END as "claseABC"
    FROM AccumData
    ORDER BY revenue DESC
  `;
  const rows = await database.allAsync(query, [tiendaId, tiendaId]);
  return rows.map((r) => ({
    id_producto: r.id_producto,
    nombre_producto: r.nombre_producto,
    categoria: r.categoria,
    stock_actual: Number(r.stock_actual),
    precio: Number(r.precio),
    costo_compra: Number(r.costo_compra) || 0,
    id_proveedor: r.id_proveedor,
    proveedor: r.proveedor,
    stock_seguridad: Number(r.stock_seguridad) || 0,
    stock_minimo: Number(r.stock_minimo) || 0,
    lead_time: Number(r.lead_time) || 3,
    frecuencia_compra_dias: Number(r.frecuencia_compra_dias) || 7,
    velocity_7d: Number(r.velocity_7d) || 0,
    velocity_30d: Number(r.velocity_30d) || 0,
    qty_30d_total: Number(r.qty_30d_total) || 0,
    // null cuando el producto no tiene evaluaciones en Feedback_IA todavía (a diferencia de
    // calcularReposicion, que si recibe null internamente lo trata como 1x sin ajuste, aquí se
    // deja explícito para que cada pantalla decida cómo mostrar "sin datos" — p. ej. una confianza
    // del 50% en vez de un optimista 100% si se asumiera 1 de una).
    factor_ia: r.factor_ia === null || r.factor_ia === undefined ? null : Number(r.factor_ia),
    claseABC: r.claseABC,
    revenue: Number(r.revenue) || 0,
  }));
}

module.exports = { leerEntradasMotor };
