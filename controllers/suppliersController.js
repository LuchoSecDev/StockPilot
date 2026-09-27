const { calcularReposicion, costoUnitario } = require('../utils/reposicion');
const { totalOrden, evaluarRiesgoOrden } = require('../utils/ordenesBorrador');
const { aplicarAjusteIA } = require('../utils/guardrailsIA');
const { leerEntradasMotor } = require('../utils/entradasMotor');
const db = require('../config/database');
const { OpenAI } = require('openai');
const transporter = require('../config/mailer');
const Notification = require('../models/Notification');
const Alert = require('../models/Alert');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key_to_prevent_crash_on_startup'
});

const suppliersController = {
  // Obtener todos los proveedores de la tienda
  getAll: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      const query = `
        SELECT p.*, 
               (SELECT COUNT(id_producto) FROM Productos WHERE id_proveedor = p.id_proveedor AND estado='Disponible') as productos_vinculados,
               (SELECT COALESCE(SUM(presupuesto_total - monto_pagado), 0) FROM Ordenes_Compra WHERE id_proveedor = p.id_proveedor) as total_deuda
        FROM Proveedores p
        WHERE p.id_tienda = ? AND (p.estado = 'Activo' OR p.estado IS NULL)
        ORDER BY p.nombre_empresa ASC
      `;
      const rows = await db.allAsync(query, [tiendaId]);
      
      const data = rows.map(r => ({
        ...r,
        productos_vinculados: Number(r.productos_vinculados),
        total_deuda: Number(r.total_deuda)
      }));

      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  // Crear un proveedor
  create: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      const { nombre_empresa, contacto_principal, email, telefono, direccion } = req.body;
      const query = `
        INSERT INTO Proveedores (id_tienda, nombre_empresa, contacto_principal, email, correo, telefono, direccion, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Activo')
      `;
      const st = await db.runAsync(query, [tiendaId, nombre_empresa, contacto_principal, email, email, telefono, direccion]);
      res.json({ success: true, message: 'Proveedor creado', id: st.lastID });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  // Actualizar un proveedor
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const tiendaId = req.session.tiendaId;
      const { nombre_empresa, contacto_principal, email, telefono, direccion } = req.body;
      const query = `
        UPDATE Proveedores 
        SET nombre_empresa = ?, contacto_principal = ?, email = ?, correo = ?, telefono = ?, direccion = ?
        WHERE id_proveedor = ? AND id_tienda = ?
      `;
      await db.runAsync(query, [nombre_empresa, contacto_principal, email, email, telefono, direccion, id, tiendaId]);
      res.json({ success: true, message: 'Proveedor actualizado' });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  // Borrado lógico de un proveedor
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const tiendaId = req.session.tiendaId;
      const query = `UPDATE Proveedores SET estado = 'Inactivo' WHERE id_proveedor = ? AND id_tienda = ?`;
      await db.runAsync(query, [id, tiendaId]);
      res.json({ success: true, message: 'Proveedor eliminado del sistema' });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  // Forecast Matemático
  getSupplierForecast: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      const { proveedorId } = req.params;
      // Plan 17, Fase 0: la clase ABC se calcula siempre sobre toda la tienda (mismo ranking de
      // ingresos que usan el Consejero y Detalle de Productos) y luego se filtra por proveedor aquí,
      // no al revés. Antes se calculaba el ABC solo entre los productos de este proveedor, así que
      // un mismo producto podía salir clase A en el Consejero y clase C aquí, y pedir cantidades muy
      // distintas para lo mismo (hallazgo E2).
      const todasLasEntradas = await leerEntradasMotor(db, tiendaId);
      const rows = todasLasEntradas.filter((item) => String(item.id_proveedor) === String(proveedorId));

      const smartList = rows.map(item => {
        // Motor único de reposición (utils/reposicion.js): misma cantidad que el Consejero del Dashboard.
        const rep = calcularReposicion({
          ventasDia7: item.velocity_7d, ventasDia30: item.velocity_30d, ventas30Total: item.qty_30d_total,
          claseABC: item.claseABC, stock: item.stock_actual, stockSeguridad: item.stock_seguridad,
          stockMinimo: item.stock_minimo, leadTime: item.lead_time,
          frecuenciaCompraDias: item.frecuencia_compra_dias, factorIA: item.factor_ia,
        });
        const risk = rep.riesgo === 'CRÍTICO' ? 'critical' : (rep.riesgo === 'MEDIO' ? 'medium' : 'low');
        // Producto sano: se sugiere una semana de ventas (mínimo 1), como antes.
        const qtySugerida = rep.cantidadBase > 0 ? rep.cantidadBase : Math.max(1, Math.ceil(item.velocity_30d * 7 * (item.factor_ia ?? 1)));
        const costo = costoUnitario({ costoCompra: item.costo_compra, precio: item.precio });
        return {
          id_producto: item.id_producto,
          nombre: item.nombre_producto,
          clasificacion_abc: item.claseABC,
          nivel_riesgo: risk,
          nivel: rep.nivel,
          stock: item.stock_actual,
          dias_inventario: rep.diasParaAgotar,
          factor_aprendizaje_ia: (item.factor_ia ?? 1).toFixed(2),
          cantidad_sugerida: qtySugerida,
          urgencia: rep.urgencia,
          costo_unitario: costo.costo,
          costo_estimado: costo.estimado,
          // Se valora con el costo de compra (antes: precio de venta, que inflaba el total con el margen)
          presupuesto_estimado: qtySugerida * costo.costo
        };
      });
      res.json({ success: true, proveedor_id: proveedorId, recomendaciones_matematicas: smartList, total_presupuesto_base: smartList.reduce((acc, curr) => acc + curr.presupuesto_estimado, 0) });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  // Generar Orden Inteligente (IA)
  generateSmartOrder: async (req, res) => {
    try {
      const { recomendaciones_matematicas, presupuesto_maximo } = req.body;
      if (!recomendaciones_matematicas || recomendaciones_matematicas.length === 0) return res.status(400).json({ success: false, error: 'No hay productos para analizar.' });
      const totalCost = recomendaciones_matematicas.reduce((acc, curr) => acc + curr.presupuesto_estimado, 0);
      const itemsCriticos = recomendaciones_matematicas.filter(r => r.nivel_riesgo === 'critical').length;
      const itemsNaranja = recomendaciones_matematicas.filter(r => r.nivel_riesgo === 'medium').length;
      const budgetLimit = presupuesto_maximo || 1000000;
      const { riskLevel, riskReason } = evaluarRiesgoOrden(totalCost, budgetLimit, itemsCriticos, itemsNaranja);
      const promptData = recomendaciones_matematicas.map(r => ({ id: r.id_producto, producto: r.nombre, abc: r.clasificacion_abc, sugerencia_matematica: r.cantidad_sugerida }));
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "Asesor Comercial Pyme. Ajusta sugerencias: A (max +100%), B (+50%), C (+20%). Responde JSON: { \"ajustes\": [ { \"id\": ID, \"porcentaje\": \"+15%\", \"razon\": \"...\" } ] }" }, { role: "user", content: JSON.stringify(promptData) }],
        response_format: { type: "json_object" }
      });
      const iaResponse = JSON.parse(completion.choices[0].message.content);
      const adjustments = iaResponse.ajustes || [];
      const finalCart = recomendaciones_matematicas.map(item => {
        const aiMemory = adjustments.find(a => a.id === item.id_producto);
        const adjNum = aiMemory ? parseInt(aiMemory.porcentaje.replace(/[^0-9-]/g, '')) || 0 : 0;
        const { clampedAdj, finalTotal: finalQty } = aplicarAjusteIA(item.cantidad_sugerida, adjNum, item.clasificacion_abc);
        return { ...item, calculo_base: item.cantidad_sugerida, ajuste_ia: clampedAdj > 0 ? ('+' + clampedAdj + '%') : (clampedAdj + '%'), sugerencia_final: finalQty, razon_ia: aiMemory ? aiMemory.razon : 'Sin ajuste inteligente aplicable.', presupuesto_estimado_final: Math.round(finalQty * (item.presupuesto_estimado / item.cantidad_sugerida || 0)) };
      });
      res.json({ success: true, evaluacion_riesgo: { nivel: riskLevel, justificacion: riskReason, costo_total_estimado: finalCart.reduce((acc, curr) => acc + curr.presupuesto_estimado_final, 0) }, carrito_inteligente: finalCart });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  // Registrar Orden Inteligente (Sincronizado con PG)
  submitSmartOrder: async (req, res) => {
    const client = await db.getClient();
    try {
      const { proveedorId } = req.params;
      const tiendaId = req.session.tiendaId;
      const userId = req.session.userId || 1;
      const { carrito_final, evaluacion_riesgo, estado_deseado, notas_humanas } = req.body;

      await client.query('BEGIN');

      // IMPORTANTE: Usar RETURNING para obtener el ID en Postgres
      const insertOrdenQuery = `
        INSERT INTO Ordenes_Compra (id_tienda, id_proveedor, id_usuario, estado, riesgo, presupuesto_total, notas) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id_orden
      `;
      const ordenRes = await client.query(insertOrdenQuery, [
        tiendaId, proveedorId, userId, 
        estado_deseado || 'Borrador', 
        evaluacion_riesgo.nivel, 
        evaluacion_riesgo.costo_total_estimado, 
        notas_humanas || 'Sin notas.'
      ]);
      
      const ordenId = ordenRes.rows[0].id_orden;

      for (const item of carrito_final) {
        const iaPorcentaje = item.ajuste_ia ? parseInt(item.ajuste_ia.replace(/[^0-9-]/g, '')) : 0;
        const costoUnit = item.presupuesto_estimado_final / item.sugerencia_final || 0;
        await client.query(
          "INSERT INTO Ordenes_Detalle (id_orden, id_producto, cantidad_sugerida, sugerencia_ia, cantidad_final, costo_unitario) VALUES ($1, $2, $3, $4, $5, $6)",
          [ordenId, item.id_producto, item.calculo_base, iaPorcentaje, item.sugerencia_final, costoUnit]
        );
      }

      await client.query('COMMIT');

      // Auditoría IA: registrar consulta de proveedor (id_orden != NULL → filtro "desde_proveedores")
      try {
        const datosBase = JSON.stringify(carrito_final.map(i => ({ product: i.nombre, base: i.calculo_base })));
        const sugerenciaJson = JSON.stringify(carrito_final.map(i => ({ product: i.nombre, adjustment: i.ajuste_ia, final: i.sugerencia_final, reason: i.razon_ia })));
        await db.runAsync(
          'INSERT INTO Auditoria_IA (id_tienda, id_orden, prompt_utilizado, datos_base_json, sugerencia_ia_json, impacto_decision, razon_ia, fecha_auditoria) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [tiendaId, ordenId, 'Orden Inteligente Proveedor v1.0', datosBase, sugerenciaJson, `Orden #${ordenId} — Riesgo: ${evaluacion_riesgo?.nivel || 'N/A'}`, 'Generación de orden de compra inteligente']
        );
      } catch (auditErr) {
        console.error('⚠️ Auditoría IA proveedor omitida:', auditErr.message);
      }

      res.json({ success: true, message: 'Orden Inteligente creada', orden_id: ordenId });

    } catch (e) {
      await client.query('ROLLBACK');
      res.status(500).json({ success: false, error: e.message });
    } finally {
      client.release();
    }
  },

  getOrdersHistory: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      const query = `
        SELECT o.*, p.nombre_empresa as proveedor_nombre, p.email as proveedor_email, u.nombres as usuario_nombre,
               (SELECT COUNT(*) FROM Ordenes_Detalle WHERE id_orden = o.id_orden) as items_count,
               (o.presupuesto_total - o.monto_pagado) as saldo_pendiente
        FROM Ordenes_Compra o
        JOIN Proveedores p ON o.id_proveedor = p.id_proveedor
        JOIN Usuarios u ON o.id_usuario = u.id_usuario
        WHERE o.id_tienda = ?
        ORDER BY o.fecha_creacion DESC
      `;
      const rows = await db.allAsync(query, [tiendaId]);
      res.json({ success: true, data: rows.map(r => ({ ...r, items_count: Number(r.items_count), presupuesto_total: Number(r.presupuesto_total), monto_pagado: Number(r.monto_pagado), saldo_pendiente: Number(r.saldo_pendiente) })) });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  getOrderDetail: async (req, res) => {
    try {
      const { ordenId } = req.params;
      const rows = await db.allAsync(
        `SELECT d.*, p.nombre_producto, u.nombres as solicitado_por_nombre
         FROM Ordenes_Detalle d
         JOIN Productos p ON d.id_producto = p.id_producto
         JOIN Ordenes_Compra o ON o.id_orden = d.id_orden
         LEFT JOIN Usuarios u ON d.solicitado_por = u.id_usuario
         WHERE d.id_orden = ? AND o.id_tienda = ?`,
        [ordenId, req.session.tiendaId]
      );
      res.json({ success: true, data: rows.map(r => ({ ...r, cantidad_final: Number(r.cantidad_final), costo_unitario: Number(r.costo_unitario) })) });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  // --- FUNCIONES FALTANTES RESTAURADAS ---
  updateOrderStatus: async (req, res) => {
    try {
      const { ordenId } = req.params;
      const tiendaId = req.session.tiendaId;
      const { estado, notas } = req.body;
      // Completar una orden exige registrar lo que realmente llegó (ver completarRecepcion):
      // por aquí no se toca el inventario, así que no se permite saltarse ese paso.
      if (estado === 'Completada') {
        return res.status(400).json({ success: false, error: 'Para completar una orden, confirma la recepción de mercancía (registra lo que realmente llegó).' });
      }
      // Al aprobar se guarda la fecha: de ella parte la evaluación diaria de precisión de la IA
      // (feedbackController.evaluateOrderInternal), que hasta ahora dependía del respaldo por fecha de creación.
      const query = estado === 'Aprobada'
        ? 'UPDATE Ordenes_Compra SET estado = ?, notas = COALESCE(?, notas), fecha_aprobacion = CURRENT_TIMESTAMP WHERE id_orden = ? AND id_tienda = ?'
        : 'UPDATE Ordenes_Compra SET estado = ?, notas = COALESCE(?, notas) WHERE id_orden = ? AND id_tienda = ?';
      await db.runAsync(query, [estado, notas || null, ordenId, tiendaId]);
      res.json({ success: true, message: `Orden #${ordenId} actualizada.` });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /**
   * POST /api/ordenes/:ordenId/completar — Fase E del plan 13 (recepción de mercancía).
   * Body: { items: [{ id_producto, cantidad_recibida }] }.
   * Se puede completar desde 'Aprobada' o 'Enviada' (una orden puede pagarse/recogerse en persona
   * sin pasar por el envío formal de correo). Cierre total y de una sola vez: lo que no llegó
   * no se marca "pendiente", el Consejero lo volverá a sugerir si sigue haciendo falta.
   * El total de la orden se recalcula con lo realmente recibido (no con lo pedido), para que el
   * saldo pendiente de Pagos refleje la realidad.
   */
  completarRecepcion: async (req, res) => {
    const client = await db.getClient();
    try {
      const { ordenId } = req.params;
      const tiendaId = req.session.tiendaId;
      const userId = req.session.userId;
      const items = req.body && req.body.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Indica la cantidad recibida de cada producto.' });
      }
      const limpios = [];
      for (const it of items) {
        const idProducto = Number(it && it.id_producto);
        const cantidad = Number(it && it.cantidad_recibida);
        if (!Number.isInteger(idProducto) || !Number.isInteger(cantidad) || cantidad < 0 || cantidad > 100000) {
          return res.status(400).json({ success: false, error: 'Cada línea necesita un producto y una cantidad recibida entera (0 o más).' });
        }
        limpios.push({ id_producto: idProducto, cantidad_recibida: cantidad });
      }

      await client.query('BEGIN');
      const { rows: ordenRows } = await client.query(
        'SELECT estado FROM Ordenes_Compra WHERE id_orden = $1 AND id_tienda = $2 FOR UPDATE', [ordenId, tiendaId]
      );
      if (!ordenRows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: 'Orden no encontrada.' }); }
      if (!['Aprobada', 'Enviada'].includes(ordenRows[0].estado)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'Solo se puede recibir una orden Aprobada o Enviada.' });
      }

      const { rows: lineas } = await client.query('SELECT id_producto, costo_unitario FROM Ordenes_Detalle WHERE id_orden = $1', [ordenId]);
      const costoPorProducto = new Map(lineas.map((l) => [l.id_producto, Number(l.costo_unitario) || 0]));
      for (const it of limpios) {
        if (!costoPorProducto.has(it.id_producto)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: 'Uno de los productos no pertenece a esta orden.' });
        }
      }

      const totalReal = totalOrden(limpios.map((it) => ({ cantidad: it.cantidad_recibida, costo_unitario: costoPorProducto.get(it.id_producto) })));
      for (const it of limpios) {
        await client.query('UPDATE Ordenes_Detalle SET cantidad_recibida = $1 WHERE id_orden = $2 AND id_producto = $3', [it.cantidad_recibida, ordenId, it.id_producto]);
        if (it.cantidad_recibida > 0) {
          const { rows: prodRows } = await client.query('SELECT cantidad FROM Productos WHERE id_producto = $1 AND id_tienda = $2 FOR UPDATE', [it.id_producto, tiendaId]);
          if (!prodRows.length) continue; // producto borrado mientras tanto: no hay dónde sumar el stock
          const nuevoStock = Number(prodRows[0].cantidad) + it.cantidad_recibida;
          await client.query('UPDATE Productos SET cantidad = $1 WHERE id_producto = $2', [nuevoStock, it.id_producto]);
          await client.query(
            `INSERT INTO MovimientosStock (id_producto, tipo_movimiento, cantidad, stock_final, fecha_movimiento, observacion, id_usuario, id_tienda)
             VALUES ($1, 'Entrada', $2, $3, CURRENT_TIMESTAMP, $4, $5, $6)`,
            [it.id_producto, it.cantidad_recibida, nuevoStock, `Orden de Compra #${ordenId}`, userId, tiendaId]
          );
        }
      }

      await client.query(
        "UPDATE Ordenes_Compra SET estado = 'Completada', presupuesto_total = $1, total_estimado = $1 WHERE id_orden = $2",
        [totalReal, ordenId]
      );
      await client.query('COMMIT');

      // Plan 17, hallazgo O2: recibir mercancía cambia `Productos.cantidad` directamente por fuera de
      // InventoryMovement/productController, así que sin este disparador las alertas solo se
      // actualizaban tras la próxima venta — Catálogo (en vivo) y Monitor Alertas podían decir cosas
      // distintas justo después de recibir una orden.
      Alert.generate(tiendaId).catch((e) => console.error('Error regenerando alertas post-recepción:', e));

      try {
        await db.runAsync(
          'INSERT INTO Auditoria_IA (id_tienda, id_orden, prompt_utilizado, datos_base_json, sugerencia_ia_json, impacto_decision, razon_ia, fecha_auditoria) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
          [tiendaId, ordenId, 'Recepción de mercancía', JSON.stringify(lineas), JSON.stringify(limpios), `Orden #${ordenId} recibida — total real $${totalReal.toLocaleString('es-CO')}`, 'El administrador confirmó qué llegó realmente']
        );
      } catch (auditErr) {
        console.error('⚠️ Auditoría de recepción omitida:', auditErr.message);
      }

      res.json({ success: true, presupuesto_total: totalReal });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('❌ completarRecepcion:', e.message);
      res.status(500).json({ success: false, error: 'No se pudo confirmar la recepción.' });
    } finally {
      client.release();
    }
  },

  registerPayment: async (req, res) => {
    try {
      const { ordenId } = req.params;
      const { monto } = req.body;
      const tiendaId = req.session.tiendaId;
      const orden = await db.getAsync('SELECT presupuesto_total, monto_pagado FROM Ordenes_Compra WHERE id_orden = ? AND id_tienda = ?', [ordenId, tiendaId]);
      if (!orden) return res.status(404).json({ error: 'No existe' });
      const nuevoPagado = Number(orden.monto_pagado) + Number(monto);
      const estado = nuevoPagado >= Number(orden.presupuesto_total) ? 'Pagado' : 'Abonado';
      await db.runAsync('UPDATE Ordenes_Compra SET monto_pagado = ?, estado_pago = ? WHERE id_orden = ?', [nuevoPagado, estado, ordenId]);
      res.json({ success: true, saldo: Math.max(0, Number(orden.presupuesto_total) - nuevoPagado) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  sendOrderToSupplier: async (req, res) => {
    try {
      const { ordenId } = req.params;
      const tiendaId = req.session.tiendaId;
      const orden = await db.getAsync(`SELECT o.*, p.nombre_empresa, p.email as proveedor_email FROM Ordenes_Compra o JOIN Proveedores p ON o.id_proveedor = p.id_proveedor WHERE o.id_orden = ?`, [ordenId]);
      if (!orden || !orden.proveedor_email) return res.status(400).json({ error: 'Falta email proveedor' });
      const items = await db.allAsync(`SELECT d.*, p.nombre_producto FROM Ordenes_Detalle d JOIN Productos p ON d.id_producto = p.id_producto WHERE d.id_orden = ?`, [ordenId]);
      
      const nombreTienda = req.session.nombreTienda || 'StockPilot';
      const fechaEmision = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
      const itemsRows = items.map(i => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px;">${i.nombre_producto}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px; text-align: center;">${i.cantidad_final}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 13px; text-align: right;">${i.costo_unitario != null ? '$' + Number(i.costo_unitario).toLocaleString('es-CO') : '—'}</td>
        </tr>
      `).join('');

      const mailOptions = {
        from: `"${nombreTienda} via StockPilot" <${process.env.EMAIL_USER}>`,
        to: orden.proveedor_email,
        subject: `Orden de Compra #${ordenId} — ${nombreTienda}`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; max-width: 620px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #252C93; padding: 28px 32px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; letter-spacing: -0.025em;">StockPilot</h1>
                    <p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.75); font-size: 12px;">Control de Inventario Inteligente</p>
                  </td>
                  <td style="text-align: right;">
                    <div style="display: inline-block; background: rgba(255,255,255,0.15); border-radius: 8px; padding: 8px 16px;">
                      <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">Orden #${ordenId}</p>
                      <p style="margin: 2px 0 0 0; color: rgba(255,255,255,0.8); font-size: 11px;">${fechaEmision}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </div>

            <div style="padding: 28px 32px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; font-weight: 600;">Dirigido a</p>
              <h2 style="margin: 0 0 18px 0; font-size: 20px; color: #1e293b;">${orden.nombre_empresa}</h2>

              <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                Por medio del presente, <strong>${nombreTienda}</strong> emite la siguiente orden de compra. Por favor confirmar disponibilidad y tiempo de entrega estimado.
              </p>

              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0;">Producto</th>
                    <th style="padding: 10px 12px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0;">Cantidad</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0;">Costo Unit.</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>
            </div>

            <div style="background-color: #f8fafc; padding: 18px 32px; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Orden generada automáticamente por <strong>StockPilot AI Core</strong> · ${nombreTienda}
              </p>
            </div>
          </div>
        `
      };
      await transporter.sendMail(mailOptions);
      await db.runAsync('UPDATE Ordenes_Compra SET estado = ? WHERE id_orden = ?', ['Enviada', ordenId]);
      
      // Notificar a los tenderos
      await Notification.broadcast({
        id_tienda: tiendaId,
        tipo: 'orden_enviada',
        titulo: '📦 Pedido Enviado',
        mensaje: `Se ha enviado la orden de compra a ${orden.nombre_empresa}. Por favor, estar pendientes de la entrega.`,
        datos_json: { id_orden: ordenId }
      });

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },

  /**
   * Descarga la orden en PDF. Para proveedores sin correo (plan 13, Fase D): el administrador
   * la envía por su cuenta (WhatsApp, impresa) y luego puede marcarla como enviada a mano.
   */
  downloadOrderPdf: async (req, res) => {
    try {
      const { ordenId } = req.params;
      const tiendaId = req.session.tiendaId;
      const orden = await db.getAsync(
        `SELECT o.*, p.nombre_empresa, p.email as proveedor_email, p.telefono as proveedor_telefono
         FROM Ordenes_Compra o JOIN Proveedores p ON o.id_proveedor = p.id_proveedor
         WHERE o.id_orden = ? AND o.id_tienda = ?`,
        [ordenId, tiendaId]
      );
      if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
      const items = await db.allAsync(
        'SELECT d.*, p.nombre_producto FROM Ordenes_Detalle d JOIN Productos p ON d.id_producto = p.id_producto WHERE d.id_orden = ?',
        [ordenId]
      );

      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Orden_Compra_${ordenId}.pdf`);
      doc.pipe(res);

      const azul = '#252C93';
      const tinta = '#14173F';
      const gris = '#94a3b8';
      const nombreTienda = req.session.nombreTienda || 'StockPilot';

      doc.fillColor(azul).fontSize(24).text('StockPilot', { align: 'right' });
      doc.fillColor(gris).fontSize(10).text('Control de Inventario Inteligente', { align: 'right' });
      doc.moveDown(1.5);

      doc.fillColor(tinta).fontSize(18).text(`ORDEN DE COMPRA #${ordenId}`, { align: 'left' });
      doc.fontSize(10).fillColor(gris).text(`Emitida por ${nombreTienda} el ${new Date(orden.fecha_creacion).toLocaleDateString('es-CO')}`);
      doc.moveDown();
      doc.fontSize(11).fillColor(tinta).text(`Proveedor: ${orden.nombre_empresa}`);
      if (orden.proveedor_telefono) doc.fontSize(10).fillColor(gris).text(`Teléfono: ${orden.proveedor_telefono}`);
      doc.moveDown(1.5);

      const tableTop = doc.y;
      const cols = { item: 40, qty: 320, cost: 390, total: 470 };
      doc.fontSize(10).fillColor(azul);
      doc.text('Producto', cols.item, tableTop);
      doc.text('Cant.', cols.qty, tableTop);
      doc.text('Costo Un.', cols.cost, tableTop);
      doc.text('Subtotal', cols.total, tableTop);
      doc.moveTo(40, tableTop + 15).lineTo(555, tableTop + 15).strokeColor('#E5E7EB').stroke();

      let y = tableTop + 24;
      let total = 0;
      doc.fontSize(9).fillColor(tinta);
      items.forEach((it) => {
        const cantidad = Number(it.cantidad_final) || 0;
        const costo = Number(it.costo_unitario) || 0;
        const subtotal = cantidad * costo;
        total += subtotal;
        doc.text(it.nombre_producto?.substring(0, 45) || 'Sin nombre', cols.item, y, { width: 270 });
        doc.text(String(cantidad), cols.qty, y);
        doc.text(`$${costo.toLocaleString('es-CO')}`, cols.cost, y);
        doc.text(`$${subtotal.toLocaleString('es-CO')}`, cols.total, y);
        y += 20;
      });

      doc.moveTo(40, y + 4).lineTo(555, y + 4).strokeColor('#E5E7EB').stroke();
      doc.fontSize(11).fillColor(azul).text(`Total estimado: $${total.toLocaleString('es-CO')}`, cols.cost, y + 14);

      doc.end();
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
};

module.exports = suppliersController;
