/**
 * @file autorizacion_roles.test.js
 * @description Pruebas de caracterización (plan 21, R0, requisito 4 del usuario): fija lo que
 * responde HOY un Tendero (rol sin privilegios de administrador) contra endpoints que solo exigen
 * `requireLogin` — ninguno de estos tiene `requireAdmin`, aunque conceptualmente debería tenerlo.
 * Con esta tabla se arma la fase I0 del plan 22. No se corrige nada aquí, solo se registra el
 * comportamiento actual (casi siempre 200/éxito, incluido cruzando de tienda en egresos).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto, abrirCaja } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';

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

describe('Autorización por rol: lo que un Tendero puede hacer hoy sin ser Administrador', () => {
  // I0: invertir a 403 según la matriz de roles
  it('COMPORTAMIENTO ACTUAL, posible bug: un Tendero aprueba y rechaza egresos de su PROPIA tienda', async () => {
    const { agente, csrfToken, id_usuario } = await agenteLogueado({ rol: 'Tendero' });
    await agente.post('/api/caja/abrir').set('X-CSRF-Token', csrfToken).send({ monto_apertura: 50000 });
    const egreso1 = await agente.post('/api/caja/egreso').set('X-CSRF-Token', csrfToken).send({ monto: 10000, motivo: 'Primer gasto de prueba' });
    expect(egreso1.status).toBe(200);
    const egreso2 = await agente.post('/api/caja/egreso').set('X-CSRF-Token', csrfToken).send({ monto: 10000, motivo: 'Segundo gasto de prueba' });
    expect(egreso2.status).toBe(200);
    const filas = await db.allAsync('SELECT id_egreso FROM EgresosCaja WHERE id_usuario = ? ORDER BY id_egreso', [id_usuario]);

    const aprobar = await agente.put(`/api/caja/egreso/${filas[0].id_egreso}/aprobar`).set('X-CSRF-Token', csrfToken);
    expect(aprobar.status).toBe(200);
    const rechazar = await agente.put(`/api/caja/egreso/${filas[1].id_egreso}/rechazar`).set('X-CSRF-Token', csrfToken).send({ notas_admin: 'No aplica' });
    expect(rechazar.status).toBe(200);

    const estados = await db.allAsync('SELECT estado FROM EgresosCaja WHERE id_usuario = ? ORDER BY id_egreso', [id_usuario]);
    expect(estados.map(e => e.estado)).toEqual(['Aprobado', 'Rechazado']);
  });

  // I0: invertir a 403 según la matriz de roles
  // (además del rol, falta filtrar por id_tienda: entre tiendas debe dar 404/403, ver P22-09)
  it('COMPORTAMIENTO ACTUAL, posible bug: un Tendero aprueba un egreso de OTRA tienda (CashRegister.approveExpense no filtra por id_tienda)', async () => {
    const tiendaA = await agenteLogueado({ rol: 'Administrador' });
    await tiendaA.agente.post('/api/caja/abrir').set('X-CSRF-Token', tiendaA.csrfToken).send({ monto_apertura: 50000 });
    const egreso = await tiendaA.agente.post('/api/caja/egreso').set('X-CSRF-Token', tiendaA.csrfToken).send({ monto: 20000, motivo: 'Gasto de la tienda A' });
    const filaEgreso = await db.getAsync('SELECT id_egreso FROM EgresosCaja WHERE id_usuario = ?', [tiendaA.id_usuario]);

    const tiendaB = await agenteLogueado({ rol: 'Tendero' }); // tienda distinta, sin relación con la A

    const res = await tiendaB.agente.put(`/api/caja/egreso/${filaEgreso.id_egreso}/aprobar`).set('X-CSRF-Token', tiendaB.csrfToken);
    expect(res.status).toBe(200); // hoy no hay ningún chequeo de tienda ni de rol en este endpoint

    const fila = await db.getAsync('SELECT estado, aprobado_por FROM EgresosCaja WHERE id_egreso = ?', [filaEgreso.id_egreso]);
    expect(fila.estado).toBe('Aprobado');
    expect(fila.aprobado_por).toBe(tiendaB.id_usuario); // aprobado por alguien de OTRA tienda
  });

  // I0: invertir a 403 según la matriz de roles
  it('un Tendero puede editar y eliminar un producto de su propia tienda (PUT/DELETE /api/productos/:id)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Tendero' });
    const idProducto = await crearProducto({ id_tienda });

    const editar = await agente.put(`/api/productos/${idProducto}`).set('X-CSRF-Token', csrfToken)
      .send({ codigo: 'X', nombre_producto: 'Editado por Tendero', categoria: 'X', precio: 1, cantidad: 1, stock_minimo: 1 });
    expect(editar.status).toBe(200);

    const eliminar = await agente.delete(`/api/productos/${idProducto}`).set('X-CSRF-Token', csrfToken);
    expect(eliminar.status).toBe(200);
  });

  // I0: invertir a 403 según la matriz de roles
  it('un Tendero puede aplicar una promoción manual (POST /api/promociones)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Tendero' });
    const idProducto = await crearProducto({ id_tienda, precio: 1000 });

    const res = await agente.post('/api/promociones').set('X-CSRF-Token', csrfToken)
      .send({ id_producto: idProducto, descuento_porcentaje: 10, motivo: 'Liquidación decidida por el Tendero' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // I0: invertir a 403 según la matriz de roles
  it('un Tendero puede aplicar una estrategia de precio sugerida por IA (POST /api/ia/apply-strategy)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Tendero' });
    const idProducto = await crearProducto({ id_tienda, precio: 1000 });

    const res = await agente.post('/api/ia/apply-strategy').set('X-CSRF-Token', csrfToken)
      .send({ id_producto: idProducto, nuevo_precio: 800, duration_days: 7, razon: 'Decidido por el Tendero' });
    expect(res.status).toBe(200);
  });

  // I0: invertir a 403 según la matriz de roles
  it('un Tendero puede disparar la regeneración de alertas y resolver una (POST /api/alertas/generate, PATCH /api/alertas/:id/resolve)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Tendero' });
    await crearProducto({ id_tienda, cantidad: 0, stock_minimo: 5, stock_seguridad: 5 });

    const generar = await agente.post('/api/alertas/generate').set('X-CSRF-Token', csrfToken);
    expect(generar.status).toBe(200);
    expect(generar.body.generadas).toBeGreaterThan(0);

    const alerta = await db.getAsync('SELECT id_alerta FROM Alertas WHERE id_tienda = ? LIMIT 1', [id_tienda]);
    const resolver = await agente.patch(`/api/alertas/${alerta.id_alerta}/resolve`).set('X-CSRF-Token', csrfToken);
    expect(resolver.status).toBe(200);
  });

  // I0: invertir a 403 según la matriz de roles
  it('un Tendero puede registrar un ajuste de inventario por conteo físico (POST /api/inventario/ajuste)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Tendero' });
    const idProducto = await crearProducto({ id_tienda, cantidad: 10 });

    const res = await agente.post('/api/inventario/ajuste').set('X-CSRF-Token', csrfToken)
      .send({ id_producto: idProducto, cantidad: -3, observacion: 'Conteo físico del Tendero' });
    expect(res.status).toBe(200);
    await esperarTrabajoEnSegundoPlano(); // registerAdjustment dispara Alert.generate sin esperarlo
  });

  // I0: invertir a 403 según la matriz de roles
  it('un Tendero puede crear y descargar un reporte (POST /api/reportes)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Tendero' });
    await crearProducto({ id_tienda });

    const res = await agente.post('/api/reportes').set('X-CSRF-Token', csrfToken)
      .send({ titulo: 'Reporte de Tendero', descripcion: 'x', fecha_reporte: '2026-01-01', creador: 'Tendero', tipo: 'Inventario' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // I0: invertir a 403 según la matriz de roles
  it('un Tendero puede exportar las ventas de la tienda (POST /api/exportar/ventas)', async () => {
    const { agente, csrfToken, id_tienda, id_usuario } = await agenteLogueado({ rol: 'Tendero' });
    const idProducto = await crearProducto({ id_tienda, cantidad: 5, precio: 1000 });
    await abrirCaja(id_tienda, id_usuario);
    await agente.post('/api/registrar-venta').set('X-CSRF-Token', csrfToken).send({ id_producto: idProducto, cantidad: 1 });
    await esperarTrabajoEnSegundoPlano(); // registerSale también dispara trabajo en segundo plano sin esperarlo

    const res = await agente.post('/api/exportar/ventas').set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
