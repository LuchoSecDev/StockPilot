/**
 * @file aislamiento_feedback.test.js
 * @description Hallazgo C2 (rama fix/aislamiento-reportes-feedback): POST /api/feedback/evaluate/:orderId evaluaba órdenes de OTRA tienda, devolvía sus productos y ventas y escribía en Feedback_IA (confirmado ejecutándolo). Ahora: 404 entre tiendas y solo Administrador. La caracterización de la propia tienda está en feedback_evaluar_orden.test.js.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearProducto } from './helpers/fixtures.js';
import app from '../../app.js';
import { dosTiendas } from './helpers/tiendas.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

describe('C2. Evaluación de IA de una orden: aislamiento entre tiendas y solo Administrador', () => {
  async function ordenDe(tienda) {
    const prov = await db.runAsync("INSERT INTO Proveedores (id_tienda, nombre_empresa) VALUES (?, 'Proveedor') RETURNING id_proveedor", [tienda.id_tienda]);
    const idProducto = await crearProducto({ id_tienda: tienda.id_tienda, nombre_producto: 'PRODUCTO SECRETO DE A' });
    const orden = await db.runAsync(
      `INSERT INTO Ordenes_Compra (id_tienda, id_proveedor, id_usuario, estado, fecha_aprobacion)
       VALUES (?, ?, ?, 'Aprobada', CURRENT_TIMESTAMP - INTERVAL '3 days') RETURNING id_orden`,
      [tienda.id_tienda, prov.lastID, tienda.id_usuario]
    );
    await db.runAsync('INSERT INTO Ordenes_Detalle (id_orden, id_producto, cantidad_sugerida, cantidad_final, sugerencia_ia) VALUES (?, ?, 10, 10, 10)', [orden.lastID, idProducto]);
    return orden.lastID;
  }
  const filasFeedback = async () => (await db.allAsync('SELECT id_feedback FROM Feedback_IA')).length;

  it('el Administrador de OTRA tienda recibe 404, sin datos de la orden y sin escribir en Feedback_IA', async () => {
    const { adminA, adminB } = await dosTiendas(app);
    const idOrden = await ordenDe(adminA);

    const res = await adminB.agente.post(`/api/feedback/evaluate/${idOrden}`).set('X-CSRF-Token', adminB.csrfToken);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/SECRETO/);
    expect(await filasFeedback()).toBe(0);
  });

  it('un Tendero (de la misma tienda o de otra) recibe 403 y no se escribe nada', async () => {
    const { adminA, tenderoA, tenderoB } = await dosTiendas(app);
    const idOrden = await ordenDe(adminA);

    for (const t of [tenderoA, tenderoB]) {
      const res = await t.agente.post(`/api/feedback/evaluate/${idOrden}`).set('X-CSRF-Token', t.csrfToken);
      expect(res.status).toBe(403);
    }
    expect(await filasFeedback()).toBe(0);
  });

  it('el Administrador de la tienda dueña sí la evalúa', async () => {
    const { adminA } = await dosTiendas(app);
    const idOrden = await ordenDe(adminA);
    const res = await adminA.agente.post(`/api/feedback/evaluate/${idOrden}`).set('X-CSRF-Token', adminA.csrfToken);
    expect(res.status).toBe(200);
    expect(await filasFeedback()).toBe(1);
  });
});
