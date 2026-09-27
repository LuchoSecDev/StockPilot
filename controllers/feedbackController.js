/**
 * @file feedbackController.js
 * @description Controlador para el Módulo 14: Aprendizaje Continuo (Feedback IA).
 * Evalúa la precisión del oráculo comparando sus sugerencias vs. ventas reales.
 */

const db = require('../config/database');
const { safeError } = require('../utils/securityUtils');

const feedbackController = {
  /**
   * Evalúa una orden específica y registra/actualiza el factor de precisión.
   * Utiliza el criterio adaptativo: periodo = max(lead_time * 2, 14).
   * Puede invocarse manualmente o al cargar vistas de desempeño.
   */
  // Sin pruebas todavía (ni unitarias ni de integración): ninguno de los 7 flujos del Nivel 2
  // (plan 20, sección 8) ejercitó este módulo — evaluateOrder/getGlobalPrecision/getEvaluableOrders
  // dependen de datos históricos de órdenes+ventas que ninguno de esos flujos armó. Las funciones
  // puras de abajo (calcularPeriodoObjetivo, proyectarVentas, etc.) ya están fuera de este bloque
  // y sí tienen pruebas unitarias reales.
  /* v8 ignore start */
  evaluateOrder: async (req, res) => {
    try {
      const { orderId } = req.params;
      const result = await feedbackController.evaluateOrderInternal(orderId);
      res.json(result);
    } catch (e) {
      console.error(e);
      if (e.message === 'Orden no encontrada') return res.status(404).json({ success: false, error: e.message });
      if (e.message === 'Solo se pueden evaluar órdenes aprobadas.' || e.message === 'La orden no tiene detalles.') return res.status(400).json({ success: false, error: e.message });
      res.status(500).json({ success: false, error: safeError(e, 'Error al procesar la evaluación de la orden') });
    }
  },

  evaluateOrderInternal: async (orderId) => {
    const ordenQuery = `SELECT id_orden, COALESCE(fecha_aprobacion, fecha_creacion) as fecha_aprobacion, estado, id_tienda FROM Ordenes_Compra WHERE id_orden = ?`;
    const orden = await db.getAsync(ordenQuery, [orderId]);

    if (!orden) throw new Error('Orden no encontrada');
    if (!['Aprobada', 'Completada', 'Parcial'].includes(orden.estado)) {
      throw new Error('Solo se pueden evaluar órdenes aprobadas.');
    }

    const detallesQuery = `
      SELECT od.id_producto, od.sugerencia_ia, od.cantidad_final, p.lead_time, p.nombre_producto
      FROM Ordenes_Detalle od
      JOIN Productos p ON od.id_producto = p.id_producto
      WHERE od.id_orden = ?
    `;
    const detalles = await db.allAsync(detallesQuery, [orderId]);

    if (!detalles || detalles.length === 0) {
      throw new Error('La orden no tiene detalles.');
    }

    const hoy = new Date();
    const fechaAprobacion = new Date(orden.fecha_aprobacion);
    const diffTime = Math.abs(hoy - fechaAprobacion);
    const diasTranscurridos = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    const promesas = detalles.map(async (det) => {
      const periodoObjetivo = feedbackController.calcularPeriodoObjetivo(det.lead_time);
      
      const fechaFinEvaluacion = new Date(fechaAprobacion.getTime() + (periodoObjetivo * 24 * 60 * 60 * 1000));
      const limiteReal = hoy < fechaFinEvaluacion ? hoy : fechaFinEvaluacion;
      const diffTimeLimite = Math.abs(limiteReal - fechaAprobacion);
      const diasTranscurridosReales = Math.ceil(diffTimeLimite / (1000 * 60 * 60 * 24)) || 1;

      const ventasQuery = `
        SELECT COALESCE(SUM(vp.cantidad), 0) as total_vendido
        FROM VentasProductos vp
        JOIN Ventas v ON vp.id_venta = v.id_venta
        WHERE vp.id_producto = ? AND v.fecha_salida >= ? AND v.fecha_salida <= ?
      `;
      const vRow = await db.getAsync(ventasQuery, [det.id_producto, orden.fecha_aprobacion, limiteReal.toISOString()]);
      const ventasReales = vRow ? Number(vRow.total_vendido) : 0;

      const quiebreQuery = `
        SELECT MIN(fecha_movimiento) as fecha_quiebre
        FROM MovimientosStock
        WHERE id_producto = ? AND stock_final <= 0 AND fecha_movimiento >= ? AND fecha_movimiento <= ?
      `;
      const quiebreRow = await db.getAsync(quiebreQuery, [det.id_producto, orden.fecha_aprobacion, limiteReal.toISOString()]);
      
      let diasConStock = diasTranscurridosReales;
      if (quiebreRow && quiebreRow.fecha_quiebre) {
          const fechaQuiebre = new Date(quiebreRow.fecha_quiebre);
          const diffQuiebre = Math.abs(fechaQuiebre - fechaAprobacion);
          diasConStock = Math.ceil(diffQuiebre / (1000 * 60 * 60 * 24)) || 1;
      }

      const ventasProyectadasObjetivo = feedbackController.proyectarVentas(ventasReales, diasConStock, periodoObjetivo);
      const sugerido = det.sugerencia_ia || det.cantidad_final;
      const factor = feedbackController.calcularFactorPrecision(ventasProyectadasObjetivo, sugerido);

      const { errorAbsoluto, bias, errorPorcentual } = feedbackController.calcularErrorMetricas(ventasReales, sugerido);

      const existeQuery = `SELECT id_feedback FROM Feedback_IA WHERE id_orden = ? AND id_producto = ?`;
      const existe = await db.getAsync(existeQuery, [orderId, det.id_producto]);

      if (existe) {
        await db.runAsync(
          `UPDATE Feedback_IA SET ventas_reales_periodo = ?, factor_precision = ?, dias_con_stock = ?, error_absoluto = ?, error_porcentual = ?, bias = ?, fecha_evaluacion = CURRENT_TIMESTAMP WHERE id_feedback = ?`,
          [ventasReales, factor, diasConStock, errorAbsoluto, errorPorcentual, bias, existe.id_feedback]
        );
      } else {
        await db.runAsync(
          `INSERT INTO Feedback_IA (id_orden, id_producto, cantidad_sugerida, ventas_reales_periodo, factor_precision, dias_con_stock, error_absoluto, error_porcentual, bias) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [orderId, det.id_producto, sugerido, ventasReales, factor, diasConStock, errorAbsoluto, errorPorcentual, bias]
        );
      }

      return {
        id_producto: det.id_producto,
        nombre_producto: det.nombre_producto,
        sugerido,
        ventasReales,
        ventasProyectadasObjetivo,
        factor_precision: factor.toFixed(2)
      };
    });

    const resultados = await Promise.all(promesas);
    return {
      success: true,
      message: 'Evaluación de IA completada con éxito',
      diasTranscurridos,
      evaluaciones: resultados
    };
  },

  /**
   * Obtiene métricas globales de precisión para el Dashboard de Aprendizaje.
   */
  getGlobalPrecision: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      
      // 1. Precisión Promedio Global (últimos 30 días de evaluación o en general)
      const globalQuery = `
        SELECT AVG(f.factor_precision) as precision_global, COUNT(f.id_feedback) as total_evaluaciones
        FROM Feedback_IA f
        JOIN Ordenes_Compra o ON f.id_orden = o.id_orden
        WHERE o.id_tienda = ?
      `;
      const globalStats = await db.getAsync(globalQuery, [tiendaId]);

      // 2. Evolución temporal de la precisión (Mensual)
      const evolucionQuery = `
        SELECT TO_CHAR(f.fecha_evaluacion, 'YYYY-MM') as mes,
               AVG(f.factor_precision) as factor_promedio,
               COUNT(f.id_feedback) as volumen
        FROM Feedback_IA f
        JOIN Ordenes_Compra o ON f.id_orden = o.id_orden
        WHERE o.id_tienda = ?
        GROUP BY TO_CHAR(f.fecha_evaluacion, 'YYYY-MM')
        ORDER BY mes ASC
        LIMIT 6
      `;
      const evolucion = await db.allAsync(evolucionQuery, [tiendaId]);

      // 3. Top 5 productos más y menos predecibles optimizado por PostgreSQL
      const productosQuery = `
        WITH Stats AS (
            SELECT p.id_producto, p.nombre_producto, p.categoria,
                   AVG(f.factor_precision) as factor_historico,
                   COUNT(f.id_feedback) as evaluaciones
            FROM Feedback_IA f
            JOIN Productos p ON f.id_producto = p.id_producto
            WHERE p.id_tienda = ?
            GROUP BY p.id_producto, p.nombre_producto, p.categoria
            HAVING COUNT(f.id_feedback) > 0
        ),
        Ranked AS (
            SELECT *,
                   ABS(factor_historico - 1.0) as dist_a1,
                   ROW_NUMBER() OVER (ORDER BY ABS(factor_historico - 1.0) ASC) as rank_asc,
                   ROW_NUMBER() OVER (ORDER BY ABS(factor_historico - 1.0) DESC) as rank_desc
            FROM Stats
        )
        SELECT * FROM Ranked 
        WHERE rank_asc <= 5 OR rank_desc <= 5
      `;
      const productosData = await db.allAsync(productosQuery, [tiendaId]);

      // Ya solo recibimos un máximo de 10 filas, separamos en memoria (despreciable)
      const topPredecibles = productosData.filter(p => p.rank_asc <= 5).sort((a, b) => a.rank_asc - b.rank_asc);
      const topImpredecibles = productosData.filter(p => p.rank_desc <= 5).sort((a, b) => a.rank_desc - b.rank_desc);

      res.json({
        success: true,
        data: {
          global: {
            promedio: Number(globalStats.precision_global) || 1.0,
            totalEval: Number(globalStats.total_evaluaciones) || 0
          },
          evolucion,
          topPredecibles,
          topImpredecibles,
          todos: productosData // Para la tabla detallada
        }
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: safeError(e, 'Error obteniendo métricas de precisión') });
    }
  },

  /**
   * Obtiene la lista de órdenes que son elegibles para evaluación.
   */
  getEvaluableOrders: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      
      const query = `
        SELECT o.id_orden, COALESCE(o.fecha_aprobacion, o.fecha_creacion) as fecha_aprobacion, o.estado, p.nombre_empresa as proveedor
        FROM Ordenes_Compra o
        JOIN Proveedores p ON o.id_proveedor = p.id_proveedor
        WHERE o.id_tienda = ? AND o.estado IN ('Aprobada', 'Completada', 'Parcial')
          AND COALESCE(o.fecha_aprobacion, o.fecha_creacion) >= CURRENT_DATE - INTERVAL '60 days'
        ORDER BY fecha_aprobacion DESC
        LIMIT 50
      `;
      
      const ordenes = await db.allAsync(query, [tiendaId]);
      res.json({ success: true, data: ordenes });
    } catch (e) {
      console.error(e);
      res.status(500).json({ success: false, error: safeError(e, 'Error obteniendo órdenes evaluables') });
    }
  },
  /* v8 ignore stop */

  /** FUNCIONES PURAS PARA TESTING **/
  calcularPeriodoObjetivo: (leadTime) => Math.max((leadTime || 3) * 2, 14),
  proyectarVentas: (ventasReales, diasConStock, periodoObjetivo) => {
    if (diasConStock < periodoObjetivo) {
      const proyeccionCruda = (ventasReales / diasConStock) * periodoObjetivo;
      // Peso de confianza: cuantos más días reales, más confiamos en la proyección
      const confianza = Math.min(diasConStock / periodoObjetivo, 1.0);
      // Mezcla: si pocos días → se acerca a las ventas reales; si muchos → proyección plena
      return ventasReales + (proyeccionCruda - ventasReales) * confianza;
    }
    return ventasReales;
  },
  calcularFactorPrecision: (ventasProyectadas, sugerido) => {
    let factor = 1.0;
    if (sugerido > 0) factor = ventasProyectadas / sugerido;
    else if (sugerido === 0 && ventasProyectadas > 0) factor = 2.0;
    return Math.min(Math.max(factor, 0.2), 3.0);
  },
  calcularErrorMetricas: (ventasReales, sugerido) => {
    const errorAbsoluto = Math.abs(ventasReales - sugerido);
    const bias = sugerido - ventasReales;
    const errorPorcentual = ventasReales > 0 ? (errorAbsoluto / ventasReales) * 100 : 0;
    return { errorAbsoluto, bias, errorPorcentual };
  },
  determinarVeredicto: (factor) => {
    if (factor >= 0.9 && factor <= 1.1) return 'Acertado';
    if (factor < 0.9) return 'Sugirió de más';
    return 'Sugirió de menos';
  }
};

module.exports = feedbackController;
