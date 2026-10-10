const db = require('../config/database');
const { leerEntradasMotor } = require('../services/inventory/entradasMotor');
const { calcularReposicion, URGENCIA } = require('../services/inventory/reposicion');

// Tipos que este archivo genera/gestiona. Al regenerar una tienda solo se tocan (resuelven o
// actualizan) alertas de estos tipos — una alerta de otro tipo (ej. "reversion_precio", creada por
// schedulerService.js) nunca se toca aquí, aunque esté activa (plan 17, Fase 4).
const TIPOS_GESTIONADOS = ['stock_critico', 'stock_bajo', 'vencimiento_critico', 'vencimiento_proximo', 'sobrestock'];

class Alert {
  /**
   * Evalúa un producto según el motor unificado (mismo cálculo que Catálogo/Consejero/Proveedores/
   * Detalle) y devuelve las alertas de stock, vencimiento y sobrestock que le corresponden hoy.
   * Función pura, sin acceso a BD (plan 17, hallazgo O8): es la única copia de las reglas — tanto
   * `generate()` (que escribe) como `dryRun()` (que solo simula) llaman a esta misma función, así que
   * no hay riesgo de que una segunda copia se desincronice de la primera con el tiempo.
   *
   * @param {object} item - una fila de `leerEntradasMotor` (id_producto, velocity_7d/30d, stock_actual, etc.)
   * @param {{fecha_vencimiento?: string, stock_maximo?: number}} [extra] - del producto, fuera de `leerEntradasMotor`
   * @param {Date} [hoy] - fecha de referencia; inyectable para que las pruebas sean deterministas
   * @returns {Array<{tipo:string, severidad:string, mensaje:string, datos:object}>}
   */
  static evaluarProducto(item, extra = {}, hoy = new Date()) {
    const alertas = [];
    const leadTime = item.lead_time || 3;

    const rep = calcularReposicion({
      ventasDia7: item.velocity_7d,
      ventasDia30: item.velocity_30d,
      ventas30Total: item.qty_30d_total,
      claseABC: item.claseABC,
      stock: item.stock_actual,
      stockSeguridad: item.stock_seguridad,
      stockMinimo: item.stock_minimo,
      leadTime,
      frecuenciaCompraDias: item.frecuencia_compra_dias,
      factorIA: item.factor_ia,
    });

    const datosBase = { velocity_30d: item.velocity_30d, dias_agotamiento: rep.diasParaAgotar, stock: item.stock_actual, lead_time: leadTime, class_abc: item.claseABC, vencimiento: extra.fecha_vencimiento };

    // == STOCK (unificado con calcularReposicion; misma urgencia que ve el dueño en Catálogo/Consejero) ==
    if (rep.urgencia === URGENCIA.HOY) {
      const mensaje = rep.diasParaAgotar !== null
        ? `Stock agónico. Quedan ${rep.diasParaAgotar} días de inventario y el proveedor tarda ${leadTime} días en entregar.`
        : `Stock agónico. ${item.stock_actual <= 0 ? 'No queda stock' : 'No hay ventas recientes para calcular cuántos días quedan, pero el stock ya está en el mínimo de seguridad'}.`;
      alertas.push({ tipo: 'stock_critico', severidad: 'critico', mensaje, datos: datosBase });
    } else if (rep.urgencia === URGENCIA.SEMANA) {
      alertas.push({ tipo: 'stock_bajo', severidad: 'advertencia', mensaje: `Ventana de pedido abierta. Te quedan ${rep.diasParaAgotar} días de stock; ideal reabastecer ahora para mantener el ciclo sano.`, datos: datosBase });
    }

    // == VENCIMIENTO (sin cambios: cruce con velocidad de 7 días) ==
    if (extra.fecha_vencimiento) {
      const fVenc = new Date(extra.fecha_vencimiento);
      fVenc.setHours(0, 0, 0, 0);
      const diasParaVencer = Math.floor((fVenc - hoy) / (1000 * 60 * 60 * 24));

      const alertaVencimiento = Alert.determinarAlertaVencimiento(item.stock_actual, item.velocity_7d, diasParaVencer);
      if (alertaVencimiento) {
        const datos = { ...datosBase, dias_para_vencer: diasParaVencer, sobrantes: alertaVencimiento.sobrantes };
        if (alertaVencimiento.tipo === 'vencimiento_critico') {
          alertas.push({ tipo: 'vencimiento_critico', severidad: 'critico', mensaje: `Vence en ${diasParaVencer} días. Al ritmo actual, te sobrarán ~${alertaVencimiento.sobrantes} unidades invendibles.`, datos });
        } else {
          alertas.push({ tipo: 'vencimiento_proximo', severidad: 'advertencia', mensaje: `Vence en ${diasParaVencer} días. Podrían sobrarte ~${alertaVencimiento.sobrantes} unidades. Sugerencia: Aplicar promoción hoy.`, datos });
        }
      }
    }

    // == SOBRESTOCK (sin cambios; 999 conserva el sentido de "sin ventas para medir" que ya usaba) ==
    if (Alert.determinarSobrestock(item.stock_actual, extra.stock_maximo, item.claseABC, rep.diasParaAgotar ?? 999)) {
      alertas.push({ tipo: 'sobrestock', severidad: 'info', mensaje: `Capital estancado. Tienes ${item.stock_actual} unidades, históricamente es un producto Clase C y tienes inventario inmóvil para más de 2 meses.`, datos: datosBase });
    }

    return alertas;
  }

  /**
   * Ejecuta el motor de reglas y deja la tabla Alertas en el estado correcto para la tienda.
   *
   * Plan 17, Fase 4: antes esto marcaba TODO como resuelto y volvía a insertar cada alerta como si
   * fuera nueva en cada corrida (perdía la fecha de creación real y, sin bloqueo, dos corridas
   * concurrentes —dos ventas casi simultáneas— podían duplicar alertas para el mismo producto). Ahora:
   * (1) todo corre dentro de una transacción con `pg_advisory_xact_lock` por tienda, así que dos
   *     corridas para la misma tienda quedan en fila en vez de pisarse (corrige el hallazgo O3);
   * (2) las alertas que ya estaban activas se actualizan en su lugar (mismo `id_alerta`, misma
   *     `fecha_creacion`) en vez de cerrarse y reabrirse — así se sabe desde cuándo lleva activa;
   * (3) el stock usa `calcularReposicion` (mismo motor que Catálogo/Consejero/Proveedores/Detalle) en
   *     vez de su propio cálculo, lo que de paso corrige que un producto agotado y sin ventas
   *     registradas (stock_seguridad en 0, el valor por defecto) no generaba ninguna alerta —el mismo
   *     hallazgo E1 que ya se había corregido en el resto de pantallas.
   * Las reglas de vencimiento y sobrestock no cambian.
   */
  // Cubierta por tests/integration/alert_generate_concurrencia.test.js (plan 20, Nivel 2) — ya
  // no hace falta /* v8 ignore */ aquí. La cobertura de `npm test` (solo unitarias) no lo refleja
  // porque esa suite excluye tests/integration/ a propósito (sección 4 del plan); la cobertura
  // real de esta función viene de correr `npm run test:integration`.
  static async generate(tiendaId) {
    // Plan 17, O8: interruptor de emergencia. Pensado para un problema descubierto ya en producción
    // (no para "volver" a la lógica vieja de determinarAlertaStock/calcularDiasAgotamiento, que tenía
    // el hueco E1 y ya no existe en el código) — apaga generate() por completo, manual y automático,
    // hasta que se investigue, sin necesidad de un nuevo despliegue.
    if (process.env.DISABLE_ALERT_ENGINE === 'true') {
      console.warn('⚠️ Alert.generate() omitido: DISABLE_ALERT_ENGINE=true');
      return 0;
    }

    // Lecturas: no necesitan estar dentro de la transacción/lock, son solo consulta.
    const entradas = await leerEntradasMotor(db, tiendaId);
    const extras = await db.allAsync(
      `SELECT id_producto, fecha_vencimiento, stock_maximo FROM Productos WHERE id_tienda = ?`,
      [tiendaId]
    );
    const extraPorProducto = new Map(extras.map((r) => [r.id_producto, r]));

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const client = await db.getClient();
    let generadas = 0;
    try {
      await client.query('BEGIN');
      // Serializa regeneraciones concurrentes de esta misma tienda. Se libera solo al hacer
      // COMMIT/ROLLBACK (xact_lock), así que ninguna otra corrida para esta tienda puede leer el
      // estado de Alertas hasta que esta termine.
      await client.query('SELECT pg_advisory_xact_lock(?)', [tiendaId]);

      const activasRes = await client.query(
        `SELECT id_alerta, id_producto, tipo FROM Alertas WHERE id_tienda = ? AND resuelta = 0 AND tipo = ANY(?)`,
        [tiendaId, TIPOS_GESTIONADOS]
      );
      const activaPorClave = new Map(activasRes.rows.map((r) => [`${r.id_producto}:${r.tipo}`, r.id_alerta]));
      const clavesVigentes = new Set();

      const upsert = async (idProducto, alerta) => {
        const clave = `${idProducto}:${alerta.tipo}`;
        clavesVigentes.add(clave);
        const datosJson = JSON.stringify({ motor: 'v2', ...alerta.datos });
        const idExistente = activaPorClave.get(clave);
        if (idExistente) {
          // Ya estaba activa: se actualiza en su lugar (no se toca fecha_creacion ni se duplica).
          await client.query(
            `UPDATE Alertas SET severidad = ?, mensaje = ?, datos_json = ? WHERE id_alerta = ?`,
            [alerta.severidad, alerta.mensaje, datosJson, idExistente]
          );
        } else {
          await client.query(
            `INSERT INTO Alertas (id_producto, id_tienda, tipo, severidad, mensaje, datos_json, resuelta) VALUES (?, ?, ?, ?, ?, ?, 0)`,
            [idProducto, tiendaId, alerta.tipo, alerta.severidad, alerta.mensaje, datosJson]
          );
          generadas++;
        }
      };

      for (const item of entradas) {
        const extra = extraPorProducto.get(item.id_producto) || {};
        const alertas = Alert.evaluarProducto(item, extra, hoy);
        for (const alerta of alertas) {
          await upsert(item.id_producto, alerta);
        }
      }

      // Lo que seguía activo y ya no aplica, se resuelve. Cualquier tipo NO gestionado aquí (ver
      // TIPOS_GESTIONADOS) queda intacto porque nunca entró a `activaPorClave`.
      for (const [clave, idAlerta] of activaPorClave) {
        if (!clavesVigentes.has(clave)) {
          await client.query(`UPDATE Alertas SET resuelta = 1, fecha_resolucion = CURRENT_TIMESTAMP WHERE id_alerta = ?`, [idAlerta]);
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return generadas;
  }

  /* v8 ignore start -- sin pruebas todavía (ni unitarias ni de integración): dryRun() es una
     herramienta manual de auditoría (GET /api/alertas/dry-run, solo administradores), no parte
     del flujo normal; resolve() y getStats() son consulta/update de una línea que ninguno de los
     7 flujos del Nivel 2 ejercitó. Plan 20, sección 8 — a diferencia de generate()/findActive()
     de arriba, estas tres siguen sin ningún test real. */
  /**
   * Calcula qué alertas generaría `generate()` para la tienda AHORA MISMO y las compara contra las
   * que ya están activas, sin escribir nada en la base de datos. Plan 17, O8: pensado para correr
   * antes de confiar en un cambio al motor (o para auditar a mano), no es parte del flujo normal de
   * la aplicación — expuesto en `GET /api/alertas/dry-run` (solo administradores).
   *
   * @returns {Promise<{nuevas:Array, actualizadas:Array, resueltas:Array, sinCambios:number}>}
   */
  static async dryRun(tiendaId) {
    const entradas = await leerEntradasMotor(db, tiendaId);
    const extras = await db.allAsync(
      `SELECT id_producto, fecha_vencimiento, stock_maximo FROM Productos WHERE id_tienda = ?`,
      [tiendaId]
    );
    const extraPorProducto = new Map(extras.map((r) => [r.id_producto, r]));

    const activas = await db.allAsync(
      `SELECT id_alerta, id_producto, tipo, severidad, mensaje FROM Alertas WHERE id_tienda = ? AND resuelta = 0 AND tipo = ANY(?)`,
      [tiendaId, TIPOS_GESTIONADOS]
    );
    const activaPorClave = new Map(activas.map((r) => [`${r.id_producto}:${r.tipo}`, r]));
    const clavesVigentes = new Set();

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const nuevas = [];
    const actualizadas = [];
    let sinCambios = 0;

    for (const item of entradas) {
      const extra = extraPorProducto.get(item.id_producto) || {};
      const alertas = Alert.evaluarProducto(item, extra, hoy);
      for (const alerta of alertas) {
        const clave = `${item.id_producto}:${alerta.tipo}`;
        clavesVigentes.add(clave);
        const existente = activaPorClave.get(clave);
        if (!existente) {
          nuevas.push({ id_producto: item.id_producto, tipo: alerta.tipo, severidad: alerta.severidad, mensaje: alerta.mensaje });
        } else if (existente.severidad !== alerta.severidad || existente.mensaje !== alerta.mensaje) {
          actualizadas.push({
            id_producto: item.id_producto,
            tipo: alerta.tipo,
            severidad_anterior: existente.severidad,
            severidad_nueva: alerta.severidad,
            mensaje_anterior: existente.mensaje,
            mensaje_nuevo: alerta.mensaje,
          });
        } else {
          sinCambios++;
        }
      }
    }

    const resueltas = [];
    for (const [clave, row] of activaPorClave) {
      if (!clavesVigentes.has(clave)) {
        resueltas.push({ id_producto: row.id_producto, tipo: row.tipo, id_alerta: row.id_alerta });
      }
    }

    return { nuevas, actualizadas, resueltas, sinCambios };
  }
  /* v8 ignore stop */

  // Cubierta por tests/integration/alert_generate_concurrencia.test.js (llamada directamente para
  // verificar que generate() resuelve alertas viejas correctamente) — igual que generate(), la
  // cobertura real de esta función viene de `npm run test:integration`, no de `npm test`.
  /**
   * Obtiene las alertas activas, ordenadas por severidad
   */
  static async findActive(tiendaId, filters = {}, limit = null) {
    let sql = `
      SELECT a.*, p.nombre_producto, p.codigo
      FROM Alertas a
      JOIN Productos p ON a.id_producto = p.id_producto
      WHERE a.id_tienda = ? AND a.resuelta = 0
    `;
    const params = [tiendaId];

    if (filters.tipo) {
        sql += ` AND a.tipo = ?`;
        params.push(filters.tipo);
    }
    if (filters.severidad) {
        sql += ` AND a.severidad = ?`;
        params.push(filters.severidad);
    }

    // Orden críco -> advertencia -> info
    sql += ` ORDER BY CASE a.severidad WHEN 'critico' THEN 1 WHEN 'advertencia' THEN 2 ELSE 3 END, a.fecha_creacion DESC`;

    if (limit) {
        sql += ` LIMIT ?`;
        params.push(parseInt(limit, 10));
    }

    return await db.allAsync(sql, params);
  }

  /* v8 ignore start -- sin pruebas todavía: resolve() (resolución manual de una alerta desde la
     UI) y getStats() (conteos para Dashboard/Sidebar) son consulta/update de una línea que ninguno
     de los 7 flujos de integración del Nivel 2 ejercitó (plan 20, sección 8). */
  /**
   * Resuelve (oculta) una alerta manualmente
   */
  static async resolve(idAlerta, tiendaId) {
    return await db.runAsync(`UPDATE Alertas SET resuelta = 1, fecha_resolucion = CURRENT_TIMESTAMP WHERE id_alerta = ? AND id_tienda = ?`, [idAlerta, tiendaId]);
  }

  /**
   * Retorna conteos para la UI (Dashboard / Sidebar / campanita / Monitor) y para la app (contrato [A1]).
   * Se agrupa por `severidad` y se cuenta por PRODUCTO distinto, no por fila (un producto con dos alertas
   * del mismo grupo cuenta una vez). Regla decidida por Luis el 9-oct-2026:
   *   critico     = stock_critico + vencimiento_critico
   *   advertencia = stock_bajo + vencimiento_proximo
   *   info        = sobrestock y avisos (p. ej. reversion_precio)
   *   total       = productos distintos con cualquier alerta activa
   * Antes (plan 17, Fase 4, hallazgo O4) critico/advertencia eran solo de STOCK y los vencimientos críticos
   * caían en `info`, para no inflar el rótulo «Productos Agotados» del Dashboard; ese rótulo ya cambió.
   * Debe coincidir con frontend/src/utils/alertas.js (prueba: tests/integration/alertas_conteo_coherente.test.js).
   */
  static async getStats(tiendaId) {
    const row = await db.getAsync(`
        SELECT
          COUNT(DISTINCT a.id_producto) FILTER (WHERE a.severidad = 'critico') as critico,
          COUNT(DISTINCT a.id_producto) FILTER (WHERE a.severidad = 'advertencia') as advertencia,
          COUNT(DISTINCT a.id_producto) FILTER (WHERE a.severidad IS DISTINCT FROM 'critico' AND a.severidad IS DISTINCT FROM 'advertencia') as info,
          COUNT(DISTINCT a.id_producto) as total
        FROM Alertas a
        WHERE a.id_tienda = ? AND a.resuelta = 0
    `, [tiendaId]);

    return {
        critico: Number(row?.critico) || 0,
        advertencia: Number(row?.advertencia) || 0,
        info: Number(row?.info) || 0,
        total: Number(row?.total) || 0,
    };
  }
  /* v8 ignore stop */
  static calcularClasificacionABC(productos) {
    let totalRevenue = 0;
    productos.forEach(p => {
        p.rev30 = (p.velocity_30d || 0) * 30 * (p.precio || 0);
        totalRevenue += p.rev30;
    });

    productos.sort((a,b) => b.rev30 - a.rev30);
    let accum = 0;
    productos.forEach(p => {
        accum += p.rev30;
        const pct = totalRevenue > 0 ? (accum / totalRevenue) : 0;
        if (pct <= 0.8) p.clasificacion_abc = 'A';
        else if (pct <= 0.95) p.clasificacion_abc = 'B';
        else p.clasificacion_abc = 'C';
    });
    return productos;
  }

  static determinarAlertaVencimiento(cantidad, velocity7d, diasParaVencer) {
    if (diasParaVencer < 0 || diasParaVencer > 30) return null;
    const ventasEstimadas = Math.floor(velocity7d * diasParaVencer);
    const quedaranSinVender = cantidad - ventasEstimadas;
    if (diasParaVencer <= 7 && quedaranSinVender > 0) return { tipo: 'vencimiento_critico', severidad: 'critico', sobrantes: quedaranSinVender };
    if (diasParaVencer <= 30 && quedaranSinVender > 0) return { tipo: 'vencimiento_proximo', severidad: 'advertencia', sobrantes: quedaranSinVender };
    return null;
  }

  static determinarSobrestock(cantidad, stockMaximo, clasificacionAbc, diasAgotamiento) {
    return cantidad > stockMaximo && clasificacionAbc === 'C' && diasAgotamiento > 60;
  }
}

module.exports = Alert;
