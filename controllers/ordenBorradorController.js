/**
 * @file ordenBorradorController.js
 * @description Del Consejero IA al borrador de orden de compra (plan 13).
 * Un solo borrador abierto por proveedor y tienda: las recomendaciones se agrupan por proveedor
 * y se suman al borrador existente (o lo crean). Nada se envía ni se aprueba solo.
 *
 * @module controllers/ordenBorradorController
 */
const db = require('../config/database');
const { agruparPorProveedor } = require('../utils/ordenesBorrador');
const { costoUnitario } = require('../services/inventory/reposicion');
const Notification = require('../models/Notification');

const MAX_ITEMS = 50;
const MAX_CANTIDAD = 100000;

const esEntero = (v) => Number.isInteger(Number(v)) && Number(v) > 0;

/** Recalcula el total del borrador con Σ cantidad_final × costo_unitario. */
async function recalcularTotal(client, idOrden) {
  const { rows } = await client.query(
    'SELECT COALESCE(SUM(cantidad_final * costo_unitario), 0) AS total, COUNT(*) AS lineas FROM Ordenes_Detalle WHERE id_orden = $1',
    [idOrden]
  );
  const total = Number(rows[0].total);
  await client.query('UPDATE Ordenes_Compra SET presupuesto_total = $1, total_estimado = $1 WHERE id_orden = $2', [total, idOrden]);
  return { total, lineas: Number(rows[0].lineas) };
}

const ordenBorradorController = {
  /**
   * POST /api/ordenes/borrador/desde-consejero
   * Body: { items: [{ id_producto, cantidad, urgencia? }] }
   */
  crearDesdeConsejero: async (req, res) => {
    const tiendaId = req.session.tiendaId;
    const userId = req.session.userId;
    const items = req.body && req.body.items;
    if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
      return res.status(400).json({ success: false, error: `Envía entre 1 y ${MAX_ITEMS} productos.` });
    }
    const limpios = [];
    for (const it of items) {
      if (!it || !esEntero(it.id_producto) || !esEntero(it.cantidad) || Number(it.cantidad) > MAX_CANTIDAD) {
        return res.status(400).json({ success: false, error: 'Cada producto necesita id_producto y cantidad enteros mayores a 0.' });
      }
      // base = cantidad calculada antes del ajuste de la IA; ajuste_ia = porcentaje que la IA aplicó (puede ser negativo)
      const base = esEntero(it.base) && Number(it.base) <= MAX_CANTIDAD ? Number(it.base) : Number(it.cantidad);
      const ajuste = Number.isInteger(Number(it.ajuste_ia)) && Math.abs(Number(it.ajuste_ia)) <= 1000 ? Number(it.ajuste_ia) : 0;
      limpios.push({ id_producto: Number(it.id_producto), cantidad: Number(it.cantidad), base, ajuste_ia: ajuste, urgencia: typeof it.urgencia === 'string' ? it.urgencia.slice(0, 20) : null });
    }

    const client = await db.getClient();
    try {
      // Solo productos de la tienda de la sesión (nunca se confía en el body)
      const ids = limpios.map(i => i.id_producto);
      const { rows: productos } = await client.query(
        'SELECT id_producto, id_proveedor, costo_compra, precio FROM Productos WHERE id_tienda = $1 AND id_producto = ANY($2::int[])',
        [tiendaId, ids]
      );
      const porId = new Map(productos.map(p => [p.id_producto, p]));
      const propios = limpios.filter(i => porId.has(i.id_producto));
      const ajenos = limpios.filter(i => !porId.has(i.id_producto)).map(i => i.id_producto);
      const { grupos, sinProveedor, omitidos } = agruparPorProveedor(
        propios.map(i => ({ ...i, id_proveedor: porId.get(i.id_producto).id_proveedor }))
      );

      const borradores = [];
      await client.query('BEGIN');
      for (const grupo of grupos) {
        // El bloqueo evita que dos usuarios creen dos borradores del mismo proveedor a la vez
        await client.query('SELECT pg_advisory_xact_lock($1, $2)', [tiendaId, grupo.id_proveedor]);
        const { rows: prov } = await client.query(
          'SELECT nombre_empresa FROM Proveedores WHERE id_proveedor = $1 AND id_tienda = $2', [grupo.id_proveedor, tiendaId]
        );
        if (!prov.length) { sinProveedor.push(...grupo.items.map(i => i.id_producto)); continue; }

        const { rows: existente } = await client.query(
          "SELECT id_orden FROM Ordenes_Compra WHERE id_tienda = $1 AND id_proveedor = $2 AND estado = 'Borrador' ORDER BY id_orden LIMIT 1",
          [tiendaId, grupo.id_proveedor]
        );
        let idOrden;
        let creado = false;
        if (existente.length) idOrden = existente[0].id_orden;
        else {
          const ins = await client.query(
            "INSERT INTO Ordenes_Compra (id_tienda, id_proveedor, id_usuario, estado, origen, notas) VALUES ($1, $2, $3, 'Borrador', 'consejero', 'Sugerida por el Consejero IA') RETURNING id_orden",
            [tiendaId, grupo.id_proveedor, userId]
          );
          idOrden = ins.rows[0].id_orden;
          creado = true;
        }

        let agregados = 0;
        const yaEstaban = [];
        for (const it of grupo.items) {
          const p = porId.get(it.id_producto);
          const { rows: linea } = await client.query('SELECT 1 FROM Ordenes_Detalle WHERE id_orden = $1 AND id_producto = $2', [idOrden, it.id_producto]);
          if (linea.length) { yaEstaban.push(it.id_producto); continue; } // se conserva la cantidad ya editada
          const costo = costoUnitario({ costoCompra: p.costo_compra, precio: p.precio });
          await client.query(
            'INSERT INTO Ordenes_Detalle (id_orden, id_producto, cantidad_sugerida, sugerencia_ia, cantidad_final, costo_unitario, urgencia, costo_estimado) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [idOrden, it.id_producto, it.base, it.ajuste_ia, it.cantidad, costo.costo, it.urgencia, costo.estimado]
          );
          agregados++;
        }
        const { total, lineas } = await recalcularTotal(client, idOrden);
        borradores.push({ id_orden: idOrden, id_proveedor: grupo.id_proveedor, proveedor: prov[0].nombre_empresa, creado, agregados, ya_estaban: yaEstaban, lineas, total });
      }
      await client.query('COMMIT');

      if (borradores.length) {
        try {
          await db.runAsync(
            'INSERT INTO Auditoria_IA (id_tienda, id_orden, prompt_utilizado, datos_base_json, sugerencia_ia_json, impacto_decision, razon_ia, fecha_auditoria) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [tiendaId, borradores[0].id_orden, 'Borrador desde Consejero IA', JSON.stringify(limpios), JSON.stringify(borradores), `Borrador(es) #${borradores.map(b => b.id_orden).join(', #')}`, 'El administrador agregó recomendaciones del Consejero a un borrador']
          );
        } catch (auditErr) {
          console.error('⚠️ Auditoría del borrador omitida:', auditErr.message);
        }
      }
      res.json({ success: true, borradores, sin_proveedor: sinProveedor, omitidos, no_encontrados: ajenos });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('❌ crearDesdeConsejero:', e.message);
      res.status(500).json({ success: false, error: 'No se pudo armar el borrador.' });
    } finally {
      client.release();
    }
  },

  /** GET /api/ordenes/borradores/resumen → { [id_producto]: { id_orden, cantidad, proveedor } } */
  resumen: async (req, res) => {
    try {
      const rows = await db.allAsync(
        `SELECT d.id_producto, d.cantidad_final, o.id_orden, p.nombre_empresa AS proveedor
         FROM Ordenes_Detalle d
         JOIN Ordenes_Compra o ON o.id_orden = d.id_orden
         JOIN Proveedores p ON p.id_proveedor = o.id_proveedor
         WHERE o.id_tienda = ? AND o.estado = 'Borrador'`,
        [req.session.tiendaId]
      );
      const data = {};
      for (const r of rows) data[r.id_producto] = { id_orden: r.id_orden, cantidad: Number(r.cantidad_final), proveedor: r.proveedor };
      res.json({ success: true, data });
    } catch (e) {
      console.error('❌ resumen borradores:', e.message);
      res.status(500).json({ success: false, error: 'No se pudo consultar los borradores.' });
    }
  },

  /** PATCH /api/ordenes/:ordenId/items/:idProducto  Body: { cantidad } (solo en Borrador) */
  editarLinea: async (req, res) => {
    const { ordenId, idProducto } = req.params;
    const cantidad = req.body && req.body.cantidad;
    if (!esEntero(ordenId) || !esEntero(idProducto) || !esEntero(cantidad) || Number(cantidad) > MAX_CANTIDAD) {
      return res.status(400).json({ success: false, error: 'Cantidad inválida.' });
    }
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query("SELECT 1 FROM Ordenes_Compra WHERE id_orden = $1 AND id_tienda = $2 AND estado = 'Borrador' FOR UPDATE", [ordenId, req.session.tiendaId]);
      if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Borrador no encontrado (solo se editan órdenes en borrador).' }); }
      const upd = await client.query('UPDATE Ordenes_Detalle SET cantidad_final = $1 WHERE id_orden = $2 AND id_producto = $3', [cantidad, ordenId, idProducto]);
      if (!upd.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'La línea no existe.' }); }
      const totales = await recalcularTotal(client, ordenId);
      await client.query('COMMIT');
      res.json({ success: true, ...totales });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      res.status(500).json({ success: false, error: 'No se pudo editar la línea.' });
    } finally { client.release(); }
  },

  /** DELETE /api/ordenes/:ordenId/items/:idProducto (si el borrador queda vacío, se elimina) */
  quitarLinea: async (req, res) => {
    const { ordenId, idProducto } = req.params;
    if (!esEntero(ordenId) || !esEntero(idProducto)) return res.status(400).json({ success: false, error: 'Parámetros inválidos.' });
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query("SELECT 1 FROM Ordenes_Compra WHERE id_orden = $1 AND id_tienda = $2 AND estado = 'Borrador' FOR UPDATE", [ordenId, req.session.tiendaId]);
      if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Borrador no encontrado.' }); }
      await client.query('DELETE FROM Ordenes_Detalle WHERE id_orden = $1 AND id_producto = $2', [ordenId, idProducto]);
      const totales = await recalcularTotal(client, ordenId);
      let eliminada = false;
      if (totales.lineas === 0) { await client.query('DELETE FROM Ordenes_Compra WHERE id_orden = $1', [ordenId]); eliminada = true; }
      await client.query('COMMIT');
      res.json({ success: true, eliminada, ...totales });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      res.status(500).json({ success: false, error: 'No se pudo quitar la línea.' });
    } finally { client.release(); }
  },

  /** PATCH /api/productos/:id/proveedor  Body: { id_proveedor } (para productos sin proveedor) */
  asignarProveedor: async (req, res) => {
    const { id } = req.params;
    const idProveedor = req.body && req.body.id_proveedor;
    if (!esEntero(id) || !esEntero(idProveedor)) return res.status(400).json({ success: false, error: 'Parámetros inválidos.' });
    try {
      const prov = await db.getAsync('SELECT 1 AS ok FROM Proveedores WHERE id_proveedor = ? AND id_tienda = ?', [idProveedor, req.session.tiendaId]);
      if (!prov) return res.status(404).json({ success: false, error: 'Proveedor no encontrado.' });
      const r = await db.runAsync('UPDATE Productos SET id_proveedor = ? WHERE id_producto = ? AND id_tienda = ?', [idProveedor, id, req.session.tiendaId]);
      if (r && r.changes === 0) return res.status(404).json({ success: false, error: 'Producto no encontrado.' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, error: 'No se pudo asignar el proveedor.' });
    }
  },

  /**
   * POST /api/ordenes/borrador/solicitar (cualquier usuario con sesión, no solo administrador)
   * Plan 13, Fase E: un tendero pide un producto de su tarjeta del Consejero. La cantidad es la que
   * ya calculó el Consejero (no la decide el tendero); se suma al borrador del proveedor (uno igual
   * que si lo agregara el administrador) marcada con `solicitado_por`, y nunca duplica una línea:
   * si el producto ya está en el borrador, se le pide que hable con el administrador en vez de crear
   * una segunda línea o pisar la cantidad que el administrador ya pudo haber ajustado.
   */
  solicitarProducto: async (req, res) => {
    const tiendaId = req.session.tiendaId;
    const userId = req.session.userId;
    const { id_producto, cantidad, urgencia } = req.body || {};
    if (!esEntero(id_producto) || !esEntero(cantidad) || Number(cantidad) > MAX_CANTIDAD) {
      return res.status(400).json({ success: false, error: 'Indica un producto y una cantidad válida.' });
    }
    const client = await db.getClient();
    try {
      const { rows: prodRows } = await client.query(
        'SELECT id_proveedor, costo_compra, precio, nombre_producto FROM Productos WHERE id_producto = $1 AND id_tienda = $2',
        [id_producto, tiendaId]
      );
      if (!prodRows.length) return res.status(404).json({ success: false, error: 'Producto no encontrado.' });
      const producto = prodRows[0];
      if (!producto.id_proveedor) {
        return res.status(400).json({ success: false, error: 'Este producto no tiene proveedor asignado; pide al administrador que lo asigne primero.' });
      }

      await client.query('BEGIN');
      // Mismo bloqueo que usa el administrador: evita dos borradores del mismo proveedor a la vez
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [tiendaId, producto.id_proveedor]);
      const { rows: prov } = await client.query(
        'SELECT nombre_empresa FROM Proveedores WHERE id_proveedor = $1 AND id_tienda = $2', [producto.id_proveedor, tiendaId]
      );
      if (!prov.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Proveedor no encontrado.' }); }

      const { rows: existente } = await client.query(
        "SELECT id_orden FROM Ordenes_Compra WHERE id_tienda = $1 AND id_proveedor = $2 AND estado = 'Borrador' ORDER BY id_orden LIMIT 1",
        [tiendaId, producto.id_proveedor]
      );
      let idOrden;
      if (existente.length) {
        idOrden = existente[0].id_orden;
        const { rows: linea } = await client.query('SELECT 1 FROM Ordenes_Detalle WHERE id_orden = $1 AND id_producto = $2', [idOrden, id_producto]);
        if (linea.length) {
          await client.query('ROLLBACK');
          return res.status(409).json({ success: false, error: 'Ese producto ya está en un pedido en borrador; pide al administrador que revise las cantidades en Proveedores.' });
        }
      } else {
        const ins = await client.query(
          "INSERT INTO Ordenes_Compra (id_tienda, id_proveedor, id_usuario, estado, origen, notas) VALUES ($1, $2, $3, 'Borrador', 'consejero', 'Incluye solicitudes de empleados') RETURNING id_orden",
          [tiendaId, producto.id_proveedor, userId]
        );
        idOrden = ins.rows[0].id_orden;
      }

      const costo = costoUnitario({ costoCompra: producto.costo_compra, precio: producto.precio });
      await client.query(
        'INSERT INTO Ordenes_Detalle (id_orden, id_producto, cantidad_sugerida, sugerencia_ia, cantidad_final, costo_unitario, urgencia, costo_estimado, solicitado_por) VALUES ($1, $2, $3, 0, $3, $4, $5, $6, $7)',
        [idOrden, id_producto, cantidad, costo.costo, typeof urgencia === 'string' ? urgencia.slice(0, 20) : null, costo.estimado, userId]
      );
      const { rows: totalRows } = await client.query(
        'SELECT COALESCE(SUM(cantidad_final * costo_unitario), 0) AS total FROM Ordenes_Detalle WHERE id_orden = $1', [idOrden]
      );
      await client.query('UPDATE Ordenes_Compra SET presupuesto_total = $1, total_estimado = $1 WHERE id_orden = $2', [totalRows[0].total, idOrden]);
      await client.query('COMMIT');

      try {
        await Notification.notifyAdmins({
          id_tienda: tiendaId,
          tipo: 'solicitud_producto',
          titulo: '🙋 Solicitud de reabastecimiento',
          mensaje: `${req.session.nombres || 'Un tendero'} solicitó ${cantidad} u. de ${producto.nombre_producto} (${prov[0].nombre_empresa}).`,
          datos_json: { id_orden: idOrden, id_producto },
        });
      } catch (notifErr) {
        console.error('⚠️ Aviso de solicitud omitido:', notifErr.message);
      }

      res.json({ success: true, id_orden: idOrden, proveedor: prov[0].nombre_empresa });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('❌ solicitarProducto:', e.message);
      res.status(500).json({ success: false, error: 'No se pudo enviar la solicitud.' });
    } finally {
      client.release();
    }
  },
};

module.exports = ordenBorradorController;
