/**
 * @file feedback_evaluar_orden.test.js
 * @description Caracterización de `feedbackController.evaluateOrder` (POST /api/feedback/evaluate/:orderId),
 * que estaba excluido de la cobertura y sin ninguna prueba (plan 20, sección 8). Fija el comportamiento
 * ACTUAL de la propia tienda antes de corregir el aislamiento entre tiendas (rama
 * fix/aislamiento-reportes-feedback, hallazgo C2). Las pruebas de aislamiento están en
 * `aislamiento_reportes_feedback.test.js`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

async function agenteLogueado(overrides = {}) {
  const datosUsuario = await crearUsuario(overrides);
  const agente = request.agent(app);
  await iniciarSesion(agente, datosUsuario);
  const csrfToken = await obtenerCsrfToken(agente);
  return { agente, csrfToken, ...datosUsuario };
}

/** Orden de compra con un producto, aprobada hace 3 días, y una venta de `vendidas` unidades ayer. */
async function ordenConVentas(tienda, { estado = 'Aprobada', vendidas = 5, sugerido = 10, conDetalle = true } = {}) {
  const prov = await db.runAsync("INSERT INTO Proveedores (id_tienda, nombre_empresa) VALUES (?, 'Proveedor de prueba') RETURNING id_proveedor", [tienda.id_tienda]);
  const idProducto = await crearProducto({ id_tienda: tienda.id_tienda, nombre_producto: 'Arroz de prueba', lead_time: 3 });
  const orden = await db.runAsync(
    `INSERT INTO Ordenes_Compra (id_tienda, id_proveedor, id_usuario, estado, fecha_aprobacion)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP - INTERVAL '3 days') RETURNING id_orden`,
    [tienda.id_tienda, prov.lastID, tienda.id_usuario, estado]
  );
  if (conDetalle) {
    await db.runAsync(
      'INSERT INTO Ordenes_Detalle (id_orden, id_producto, cantidad_sugerida, cantidad_final, sugerencia_ia) VALUES (?, ?, ?, ?, ?)',
      [orden.lastID, idProducto, sugerido, sugerido, sugerido]
    );
  }
  if (vendidas > 0) {
    const venta = await db.runAsync(
      "INSERT INTO Ventas (id_vendedor, id_tienda, fecha_salida, precio_total) VALUES (?, ?, CURRENT_TIMESTAMP - INTERVAL '1 day', ?) RETURNING id_venta",
      [tienda.id_usuario, tienda.id_tienda, vendidas * 1000]
    );
    await db.runAsync('INSERT INTO VentasProductos (id_venta, id_producto, cantidad) VALUES (?, ?, ?)', [venta.lastID, idProducto, vendidas]);
  }
  return { idOrden: orden.lastID, idProducto };
}

describe('POST /api/feedback/evaluate/:orderId: evaluar una orden de la propia tienda', () => {
  it('camino feliz: compara lo sugerido por la IA con lo vendido y guarda una fila de Feedback_IA', async () => {
    const admin = await agenteLogueado({ rol: 'Administrador' });
    const { idOrden, idProducto } = await ordenConVentas(admin, { vendidas: 5, sugerido: 10 });

    const res = await admin.agente.post(`/api/feedback/evaluate/${idOrden}`).set('X-CSRF-Token', admin.csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Evaluación de IA completada con éxito');
    // La orden se aprobó hace 3 días: el cálculo redondea hacia arriba los días transcurridos.
    expect(res.body.diasTranscurridos).toBeGreaterThanOrEqual(3);
    expect(res.body.diasTranscurridos).toBeLessThanOrEqual(4);
    expect(res.body.evaluaciones).toHaveLength(1);
    expect(res.body.evaluaciones[0]).toMatchObject({
      id_producto: idProducto,
      nombre_producto: 'Arroz de prueba',
      sugerido: 10,
      ventasReales: 5
    });
    expect(Number(res.body.evaluaciones[0].factor_precision)).toBeGreaterThanOrEqual(0.2);
    expect(Number(res.body.evaluaciones[0].factor_precision)).toBeLessThanOrEqual(3);

    const filas = await db.allAsync('SELECT * FROM Feedback_IA WHERE id_orden = ?', [idOrden]);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ id_producto: idProducto, cantidad_sugerida: 10 });
    expect(Number(filas[0].ventas_reales_periodo)).toBe(5);
    expect(Number(filas[0].error_absoluto)).toBe(5); // |5 vendidas - 10 sugeridas|
    expect(Number(filas[0].bias)).toBe(5); // sugirió 5 de más
    expect(Number(filas[0].error_porcentual)).toBe(100); // 5 / 5 vendidas
  });

  it('evaluar dos veces la misma orden actualiza la fila existente, no la duplica', async () => {
    const admin = await agenteLogueado({ rol: 'Administrador' });
    const { idOrden } = await ordenConVentas(admin);

    const primera = await admin.agente.post(`/api/feedback/evaluate/${idOrden}`).set('X-CSRF-Token', admin.csrfToken);
    const segunda = await admin.agente.post(`/api/feedback/evaluate/${idOrden}`).set('X-CSRF-Token', admin.csrfToken);
    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(await db.allAsync('SELECT id_feedback FROM Feedback_IA WHERE id_orden = ?', [idOrden])).toHaveLength(1);
  });

  it('una orden que no existe da 404', async () => {
    const admin = await agenteLogueado({ rol: 'Administrador' });
    const res = await admin.agente.post('/api/feedback/evaluate/999999').set('X-CSRF-Token', admin.csrfToken);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: 'Orden no encontrada' });
  });

  it('una orden que aún no está aprobada da 400 y no guarda nada', async () => {
    const admin = await agenteLogueado({ rol: 'Administrador' });
    const { idOrden } = await ordenConVentas(admin, { estado: 'Borrador' });
    const res = await admin.agente.post(`/api/feedback/evaluate/${idOrden}`).set('X-CSRF-Token', admin.csrfToken);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Solo se pueden evaluar órdenes aprobadas.');
    expect(await db.allAsync('SELECT id_feedback FROM Feedback_IA')).toHaveLength(0);
  });

  it('una orden aprobada sin detalle da 400', async () => {
    const admin = await agenteLogueado({ rol: 'Administrador' });
    const { idOrden } = await ordenConVentas(admin, { conDetalle: false });
    const res = await admin.agente.post(`/api/feedback/evaluate/${idOrden}`).set('X-CSRF-Token', admin.csrfToken);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('La orden no tiene detalles.');
  });

  it('un id que no es numérico da 404 (antes daba 500 por un error de Postgres sin controlar; corregido con C2)', async () => {
    const admin = await agenteLogueado({ rol: 'Administrador' });
    const res = await admin.agente.post('/api/feedback/evaluate/abc').set('X-CSRF-Token', admin.csrfToken);
    expect(res.status).toBe(404);
  });
});
