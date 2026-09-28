/**
 * @file proveedores_flujo.test.js
 * @description Pruebas de caracterización (plan 21, R0): flujo de compras a proveedores —
 * orden inteligente (IA simulada), aprobar, recibir (igual/menor/mayor cantidad, producto ajeno
 * a la orden), y el flujo de borrador del Consejero IA (`/api/ordenes/borrador/*`, agregado por
 * el usuario tras aprobar la propuesta de R0). Se fija el comportamiento ACTUAL; los hallazgos
 * se anotan con "COMPORTAMIENTO ACTUAL, posible bug" y quedan también en el plan 21, sin corregirse.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { instalarMockOpenAI, restaurarMockOpenAI } from './helpers/mockOpenAI.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

afterEach(() => {
  restaurarMockOpenAI(vi);
});

async function agenteLogueado(overrides = {}) {
  const datosUsuario = await crearUsuario(overrides);
  const agente = request.agent(app);
  await iniciarSesion(agente, datosUsuario);
  const csrfToken = await obtenerCsrfToken(agente);
  return { agente, csrfToken, ...datosUsuario };
}

async function crearProveedor(agente, csrfToken) {
  const res = await agente.post('/api/proveedores').set('X-CSRF-Token', csrfToken)
    .send({ nombre_empresa: 'Proveedor de Prueba', contacto_principal: 'Juan', email: 'prov@test.local', telefono: '3000000000', direccion: 'Calle 1' });
  return res.body.id;
}

describe('Proveedores: orden inteligente (copiloto IA, aprobar, recibir)', () => {
  it('ai-copilot: ajusta la cantidad matemática con el porcentaje que responde la IA simulada', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProducto = await crearProducto({ id_tienda, id_proveedor: idProveedor });
    const spy = instalarMockOpenAI(vi, { ajustes: [{ id: idProducto, porcentaje: '+15%', razon: 'Se vende bien, conviene pedir un poco más.' }] });

    const recomendaciones_matematicas = [{ id_producto: idProducto, nombre: 'Prod', clasificacion_abc: 'A', cantidad_sugerida: 20, nivel_riesgo: 'low', presupuesto_estimado: 20000 }];
    const res = await agente.post(`/api/proveedores/${idProveedor}/ai-copilot`).set('X-CSRF-Token', csrfToken)
      .send({ recomendaciones_matematicas, presupuesto_maximo: 1000000 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.carrito_inteligente[0].sugerencia_final).toBe(23); // 20 + 15% redondeado
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('submitSmartOrder → updateOrderStatus(Aprobada) → completarRecepcion: recibir EXACTAMENTE lo pedido', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProducto = await crearProducto({ id_tienda, id_proveedor: idProveedor, cantidad: 10 });

    const carrito_final = [{ id_producto: idProducto, nombre: 'Prod', calculo_base: 10, ajuste_ia: '+0%', sugerencia_final: 10, presupuesto_estimado_final: 5000 }];
    const crear = await agente.post(`/api/proveedores/${idProveedor}/ordenes`).set('X-CSRF-Token', csrfToken)
      .send({ carrito_final, evaluacion_riesgo: { nivel: 'Bajo', costo_total_estimado: 5000 } });
    expect(crear.status).toBe(200);
    const ordenId = crear.body.orden_id;

    const aprobar = await agente.patch(`/api/ordenes/${ordenId}/estado`).set('X-CSRF-Token', csrfToken).send({ estado: 'Aprobada' });
    expect(aprobar.status).toBe(200);

    const recibir = await agente.post(`/api/ordenes/${ordenId}/completar`).set('X-CSRF-Token', csrfToken)
      .send({ items: [{ id_producto: idProducto, cantidad_recibida: 10 }] });
    expect(recibir.status).toBe(200);
    await esperarTrabajoEnSegundoPlano(); // completarRecepcion dispara Alert.generate sin esperarlo

    const producto = await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [idProducto]);
    expect(producto.cantidad).toBe(20); // 10 iniciales + 10 recibidas
  });

  it('completarRecepcion: recibir MENOS de lo pedido se acepta sin objeción (cierre total, lo faltante no queda "pendiente")', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProducto = await crearProducto({ id_tienda, id_proveedor: idProveedor, cantidad: 10 });
    const carrito_final = [{ id_producto: idProducto, nombre: 'Prod', calculo_base: 10, ajuste_ia: '+0%', sugerencia_final: 10, presupuesto_estimado_final: 5000 }];
    const crear = await agente.post(`/api/proveedores/${idProveedor}/ordenes`).set('X-CSRF-Token', csrfToken)
      .send({ carrito_final, evaluacion_riesgo: { nivel: 'Bajo', costo_total_estimado: 5000 } });
    const ordenId = crear.body.orden_id;
    await agente.patch(`/api/ordenes/${ordenId}/estado`).set('X-CSRF-Token', csrfToken).send({ estado: 'Aprobada' });

    const recibir = await agente.post(`/api/ordenes/${ordenId}/completar`).set('X-CSRF-Token', csrfToken)
      .send({ items: [{ id_producto: idProducto, cantidad_recibida: 4 }] });
    expect(recibir.status).toBe(200);
    await esperarTrabajoEnSegundoPlano();

    const orden = await db.getAsync('SELECT estado FROM Ordenes_Compra WHERE id_orden = ?', [ordenId]);
    expect(orden.estado).toBe('Completada');
    const producto = await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [idProducto]);
    expect(producto.cantidad).toBe(14); // 10 + 4, no vuelve a sugerir "6 pendientes" aquí
  });

  it('COMPORTAMIENTO ACTUAL, posible bug: recibir MÁS de lo pedido se acepta sin tope (recepción sin validar contra lo pedido)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProducto = await crearProducto({ id_tienda, id_proveedor: idProveedor, cantidad: 10 });
    const carrito_final = [{ id_producto: idProducto, nombre: 'Prod', calculo_base: 5, ajuste_ia: '+0%', sugerencia_final: 5, presupuesto_estimado_final: 2500 }];
    const crear = await agente.post(`/api/proveedores/${idProveedor}/ordenes`).set('X-CSRF-Token', csrfToken)
      .send({ carrito_final, evaluacion_riesgo: { nivel: 'Bajo', costo_total_estimado: 2500 } });
    const ordenId = crear.body.orden_id;
    await agente.patch(`/api/ordenes/${ordenId}/estado`).set('X-CSRF-Token', csrfToken).send({ estado: 'Aprobada' });

    // Se pidieron 5, pero se registran 500 recibidas: hoy no hay ningún tope contra lo pedido
    // (completarRecepcion solo valida 0 <= cantidad_recibida <= 100000). Ver plan 21, R0.
    const recibir = await agente.post(`/api/ordenes/${ordenId}/completar`).set('X-CSRF-Token', csrfToken)
      .send({ items: [{ id_producto: idProducto, cantidad_recibida: 500 }] });
    expect(recibir.status).toBe(200);
    await esperarTrabajoEnSegundoPlano();

    const producto = await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [idProducto]);
    expect(producto.cantidad).toBe(510); // 10 + 500, sin ninguna objeción
  });

  it('completarRecepcion: un producto que no pertenece a la orden da 400 y no toca nada', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProductoEnOrden = await crearProducto({ id_tienda, id_proveedor: idProveedor, cantidad: 10 });
    const idProductoAjeno = await crearProducto({ id_tienda, id_proveedor: idProveedor, cantidad: 3 });
    const carrito_final = [{ id_producto: idProductoEnOrden, nombre: 'Prod', calculo_base: 5, ajuste_ia: '+0%', sugerencia_final: 5, presupuesto_estimado_final: 2500 }];
    const crear = await agente.post(`/api/proveedores/${idProveedor}/ordenes`).set('X-CSRF-Token', csrfToken)
      .send({ carrito_final, evaluacion_riesgo: { nivel: 'Bajo', costo_total_estimado: 2500 } });
    const ordenId = crear.body.orden_id;
    await agente.patch(`/api/ordenes/${ordenId}/estado`).set('X-CSRF-Token', csrfToken).send({ estado: 'Aprobada' });

    const recibir = await agente.post(`/api/ordenes/${ordenId}/completar`).set('X-CSRF-Token', csrfToken)
      .send({ items: [{ id_producto: idProductoAjeno, cantidad_recibida: 1 }] });
    expect(recibir.status).toBe(400);
    expect(recibir.body.error).toMatch(/no pertenece a esta orden/i);

    const producto = await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [idProductoAjeno]);
    expect(producto.cantidad).toBe(3); // intacto
  });

  it('updateOrderStatus: no permite marcar "Completada" directamente, exige pasar por completarRecepcion', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProducto = await crearProducto({ id_tienda, id_proveedor: idProveedor });
    const carrito_final = [{ id_producto: idProducto, nombre: 'Prod', calculo_base: 5, ajuste_ia: '+0%', sugerencia_final: 5, presupuesto_estimado_final: 2500 }];
    const crear = await agente.post(`/api/proveedores/${idProveedor}/ordenes`).set('X-CSRF-Token', csrfToken)
      .send({ carrito_final, evaluacion_riesgo: { nivel: 'Bajo', costo_total_estimado: 2500 } });
    const ordenId = crear.body.orden_id;

    const res = await agente.patch(`/api/ordenes/${ordenId}/estado`).set('X-CSRF-Token', csrfToken).send({ estado: 'Completada' });
    expect(res.status).toBe(400);
  });
});

describe('Proveedores: borrador de orden desde el Consejero IA (/api/ordenes/borrador/*)', () => {
  it('crearDesdeConsejero: agrupa por proveedor y crea un borrador nuevo', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProducto = await crearProducto({ id_tienda, id_proveedor: idProveedor, precio: 2000, costo_compra: 1000 });

    const res = await agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', csrfToken)
      .send({ items: [{ id_producto: idProducto, cantidad: 8, base: 8, ajuste_ia: 0, urgencia: 'media' }] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.borradores.length).toBe(1);
    expect(res.body.borradores[0].creado).toBe(true);
    expect(res.body.borradores[0].agregados).toBe(1);

    const orden = await db.getAsync('SELECT estado FROM Ordenes_Compra WHERE id_orden = ?', [res.body.borradores[0].id_orden]);
    expect(orden.estado).toBe('Borrador');
  });

  it('crearDesdeConsejero dos veces seguidas para el mismo proveedor: suma al MISMO borrador, no crea uno nuevo', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProducto1 = await crearProducto({ id_tienda, id_proveedor: idProveedor });
    const idProducto2 = await crearProducto({ id_tienda, id_proveedor: idProveedor });

    const primera = await agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', csrfToken)
      .send({ items: [{ id_producto: idProducto1, cantidad: 5 }] });
    const segunda = await agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', csrfToken)
      .send({ items: [{ id_producto: idProducto2, cantidad: 3 }] });

    expect(segunda.body.borradores[0].id_orden).toBe(primera.body.borradores[0].id_orden);
    expect(segunda.body.borradores[0].creado).toBe(false);
    expect(segunda.body.borradores[0].lineas).toBe(2);
  });

  it('editarLinea (PATCH): cambia la cantidad final y recalcula el total del borrador', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProducto = await crearProducto({ id_tienda, id_proveedor: idProveedor, precio: 2000, costo_compra: 1000 });
    const crear = await agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', csrfToken)
      .send({ items: [{ id_producto: idProducto, cantidad: 5 }] });
    const ordenId = crear.body.borradores[0].id_orden;

    const res = await agente.patch(`/api/ordenes/${ordenId}/items/${idProducto}`).set('X-CSRF-Token', csrfToken).send({ cantidad: 12 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const linea = await db.getAsync('SELECT cantidad_final FROM Ordenes_Detalle WHERE id_orden = ? AND id_producto = ?', [ordenId, idProducto]);
    expect(Number(linea.cantidad_final)).toBe(12);
  });

  it('quitarLinea (DELETE): si era la única línea, elimina también el borrador completo', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProducto = await crearProducto({ id_tienda, id_proveedor: idProveedor });
    const crear = await agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', csrfToken)
      .send({ items: [{ id_producto: idProducto, cantidad: 5 }] });
    const ordenId = crear.body.borradores[0].id_orden;

    const res = await agente.delete(`/api/ordenes/${ordenId}/items/${idProducto}`).set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.eliminada).toBe(true);

    const orden = await db.getAsync('SELECT id_orden FROM Ordenes_Compra WHERE id_orden = ?', [ordenId]);
    expect(orden).toBeUndefined();
  });

  it('solicitarProducto (Tendero): agrega su línea al borrador del proveedor y notifica a los administradores', async () => {
    const admin = await crearUsuario({ rol: 'Administrador' });
    const tendero = await agenteLogueado({ id_tienda: admin.id_tienda, rol: 'Tendero' });
    const adminAgente = request.agent(app);
    await iniciarSesion(adminAgente, admin);
    const adminCsrf = await obtenerCsrfToken(adminAgente);
    const idProveedor = await crearProveedor(adminAgente, adminCsrf);
    const idProducto = await crearProducto({ id_tienda: admin.id_tienda, id_proveedor: idProveedor });

    const res = await tendero.agente.post('/api/ordenes/borrador/solicitar').set('X-CSRF-Token', tendero.csrfToken)
      .send({ id_producto: idProducto, cantidad: 6, urgencia: 'alta' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const ordenId = res.body.id_orden;
    const linea = await db.getAsync('SELECT cantidad_final, solicitado_por FROM Ordenes_Detalle WHERE id_orden = ? AND id_producto = ?', [ordenId, idProducto]);
    expect(Number(linea.cantidad_final)).toBe(6);
    expect(linea.solicitado_por).toBe(tendero.id_usuario);

    const notif = await db.allAsync('SELECT * FROM NotificacionesUsuario WHERE id_usuario = ? AND tipo = ?', [admin.id_usuario, 'solicitud_producto']);
    expect(notif.length).toBe(1);
  });

  it('solicitarProducto: si el producto YA está en un borrador de ese proveedor, da 409 y no duplica la línea', async () => {
    const { agente, csrfToken, id_tienda, id_usuario } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);
    const idProducto = await crearProducto({ id_tienda, id_proveedor: idProveedor });
    await agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', csrfToken)
      .send({ items: [{ id_producto: idProducto, cantidad: 5 }] });

    // El mismo administrador logueado también puede "solicitar" (el endpoint acepta cualquier rol).
    const res = await agente.post('/api/ordenes/borrador/solicitar').set('X-CSRF-Token', csrfToken)
      .send({ id_producto: idProducto, cantidad: 2 });

    expect(res.status).toBe(409);
    const lineas = await db.allAsync('SELECT id_producto FROM Ordenes_Detalle WHERE id_producto = ?', [idProducto]);
    expect(lineas.length).toBe(1); // no se duplicó
  });
});
