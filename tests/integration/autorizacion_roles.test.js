/**
 * @file autorizacion_roles.test.js
 * @description Pruebas de caracterización (plan 21, R0, requisito 4 del usuario): fija lo que
 * responde HOY un Tendero (rol sin privilegios de administrador) contra endpoints que solo exigen
 * `requireLogin` — ninguno de estos tiene `requireAdmin`, aunque conceptualmente debería tenerlo.
 * Con esta tabla se arma la fase I0 del plan 22. No se corrige nada aquí, solo se registra el
 * comportamiento actual (casi siempre 200/éxito).
 *
 * Los egresos de caja (aprobar/rechazar) ya NO están aquí: se corrigieron en P22-09 y sus pruebas
 * (403 al Tendero, 404 entre tiendas) viven en el bloque «Egresos de caja» al final de este archivo.
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

describe('Egresos de caja: aprobar y rechazar (P22-09, corregido)', () => {
  // Un Administrador y un Tendero de la MISMA tienda; el Tendero registra dos egresos.
  async function tiendaConEgresos() {
    const admin = await agenteLogueado({ rol: 'Administrador' });
    const datosTendero = await crearUsuario({ rol: 'Tendero', id_tienda: admin.id_tienda });
    const tendero = request.agent(app);
    await iniciarSesion(tendero, datosTendero);
    const csrfTendero = await obtenerCsrfToken(tendero);
    await tendero.post('/api/caja/abrir').set('X-CSRF-Token', csrfTendero).send({ monto_apertura: 50000 });
    for (const motivo of ['Primer gasto de prueba', 'Segundo gasto de prueba']) {
      const r = await tendero.post('/api/caja/egreso').set('X-CSRF-Token', csrfTendero).send({ monto: 10000, motivo });
      expect(r.status).toBe(200);
    }
    const filas = await db.allAsync('SELECT id_egreso FROM EgresosCaja WHERE id_tienda = ? ORDER BY id_egreso', [admin.id_tienda]);
    return { admin, tendero, csrfTendero, idTendero: datosTendero.id_usuario, ids: filas.map(f => f.id_egreso) };
  }
  const estadoDe = async (id) => (await db.getAsync('SELECT estado, aprobado_por FROM EgresosCaja WHERE id_egreso = ?', [id]));

  it('un Tendero NO puede aprobar ni rechazar egresos, ni siquiera los de su propia tienda: 403 y la fila no cambia', async () => {
    const { tendero, csrfTendero, ids } = await tiendaConEgresos();

    const aprobar = await tendero.put(`/api/caja/egreso/${ids[0]}/aprobar`).set('X-CSRF-Token', csrfTendero);
    const rechazar = await tendero.put(`/api/caja/egreso/${ids[1]}/rechazar`).set('X-CSRF-Token', csrfTendero).send({ notas_admin: 'No aplica' });
    expect(aprobar.status).toBe(403);
    expect(rechazar.status).toBe(403);
    expect((await estadoDe(ids[0])).estado).toBe('Registrado');
    expect((await estadoDe(ids[1])).estado).toBe('Registrado');
  });

  it('el Administrador de la tienda aprueba y rechaza: 200, queda quién lo hizo y el Tendero recibe la notificación', async () => {
    const { admin, idTendero, ids } = await tiendaConEgresos();

    const aprobar = await admin.agente.put(`/api/caja/egreso/${ids[0]}/aprobar`).set('X-CSRF-Token', admin.csrfToken);
    const rechazar = await admin.agente.put(`/api/caja/egreso/${ids[1]}/rechazar`).set('X-CSRF-Token', admin.csrfToken).send({ notas_admin: 'No aplica' });
    expect(aprobar.status).toBe(200);
    expect(rechazar.status).toBe(200);
    expect(await estadoDe(ids[0])).toMatchObject({ estado: 'Aprobado', aprobado_por: admin.id_usuario });
    expect(await estadoDe(ids[1])).toMatchObject({ estado: 'Rechazado', aprobado_por: admin.id_usuario });

    const notificaciones = await db.allAsync('SELECT tipo FROM NotificacionesUsuario WHERE id_usuario = ? ORDER BY tipo', [idTendero]);
    expect(notificaciones.map(n => n.tipo)).toEqual(['egreso_aprobado', 'egreso_rechazado']);
  });

  it('un egreso de OTRA tienda no se puede tocar: 403 al Tendero, 404 al Administrador de la otra tienda, y la fila no cambia', async () => {
    const { ids } = await tiendaConEgresos();

    const tenderoAjeno = await agenteLogueado({ rol: 'Tendero' }); // otra tienda
    const adminAjeno = await agenteLogueado({ rol: 'Administrador' }); // otra tienda

    const t = await tenderoAjeno.agente.put(`/api/caja/egreso/${ids[0]}/aprobar`).set('X-CSRF-Token', tenderoAjeno.csrfToken);
    expect(t.status).toBe(403);

    const aprobar = await adminAjeno.agente.put(`/api/caja/egreso/${ids[0]}/aprobar`).set('X-CSRF-Token', adminAjeno.csrfToken);
    const rechazar = await adminAjeno.agente.put(`/api/caja/egreso/${ids[1]}/rechazar`).set('X-CSRF-Token', adminAjeno.csrfToken).send({ notas_admin: 'x' });
    expect(aprobar.status).toBe(404);
    expect(rechazar.status).toBe(404);
    expect(await estadoDe(ids[0])).toMatchObject({ estado: 'Registrado', aprobado_por: null });
    expect(await estadoDe(ids[1])).toMatchObject({ estado: 'Registrado', aprobado_por: null });
    const notificaciones = await db.allAsync('SELECT 1 FROM NotificacionesUsuario');
    expect(notificaciones).toHaveLength(0);
  });

  it('un id que no existe o no es numérico da 404, no 500', async () => {
    const { admin } = await tiendaConEgresos();
    const inexistente = await admin.agente.put('/api/caja/egreso/999999/aprobar').set('X-CSRF-Token', admin.csrfToken);
    const basura = await admin.agente.put('/api/caja/egreso/abc/rechazar').set('X-CSRF-Token', admin.csrfToken);
    expect(inexistente.status).toBe(404);
    expect(basura.status).toBe(404);
  });

  it('un egreso ya resuelto no se reabre: aprobar/rechazar de nuevo da 409, la fila y las notificaciones no cambian', async () => {
    const { admin, idTendero, ids } = await tiendaConEgresos();
    const put = (id, accion, cuerpo = {}) => admin.agente.put(`/api/caja/egreso/${id}/${accion}`).set('X-CSRF-Token', admin.csrfToken).send(cuerpo);

    expect((await put(ids[0], 'aprobar')).status).toBe(200);
    expect((await put(ids[1], 'rechazar', { notas_admin: 'No aplica' })).status).toBe(200);
    const antes = [await estadoDe(ids[0]), await estadoDe(ids[1])];

    expect((await put(ids[0], 'aprobar')).status).toBe(409);                 // aprobado → aprobar
    expect((await put(ids[0], 'rechazar', { notas_admin: 'x' })).status).toBe(409); // aprobado → rechazar
    expect((await put(ids[1], 'aprobar')).status).toBe(409);                 // rechazado → aprobar
    expect((await put(ids[1], 'rechazar', { notas_admin: 'x' })).status).toBe(409); // rechazado → rechazar

    expect([await estadoDe(ids[0]), await estadoDe(ids[1])]).toEqual(antes);
    const notificaciones = await db.allAsync('SELECT tipo FROM NotificacionesUsuario WHERE id_usuario = ?', [idTendero]);
    expect(notificaciones).toHaveLength(2); // solo las dos de la primera resolución
  });

  it('dos peticiones simultáneas sobre el mismo egreso: una gana (200) y la otra recibe 409', async () => {
    const { admin, ids } = await tiendaConEgresos();
    const [a, b] = await Promise.all([
      admin.agente.put(`/api/caja/egreso/${ids[0]}/aprobar`).set('X-CSRF-Token', admin.csrfToken),
      admin.agente.put(`/api/caja/egreso/${ids[0]}/rechazar`).set('X-CSRF-Token', admin.csrfToken).send({ notas_admin: 'x' })
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await estadoDe(ids[0])).estado).toBe(a.status === 200 ? 'Aprobado' : 'Rechazado');
  });
});
