/**
 * @file autorizacion_roles.test.js
 * @description Matriz de roles (plan 22, P22-10, fase I0). En R0 estas pruebas fijaban lo que un
 * Tendero podía hacer «hoy» (casi todo respondía 200); con las decisiones D1 a D4 de Luis se
 * invirtieron:
 *  - RUTAS SOLO DEL ADMINISTRADOR (tabla `SOLO_ADMIN`): el Tendero recibe 403 y no cambia nada en la
 *    base; el Administrador NO recibe 403 (puede recibir 400/404 por datos incompletos).
 *  - LO QUE EL TENDERO SÍ HACE: vincular código de barras, entrada de mercancía, resolver alertas y
 *    solicitar un producto al administrador.
 *  - EGRESOS DE CAJA (P22-09): aprobar/rechazar solo Administrador y solo de su tienda.
 * Las rutas de tienda tienen su propia prueba (tienda_permisos.test.js), y reportes PUT/DELETE,
 * feedback y test-summary están en aislamiento_reportes/feedback y alertas_test_summary.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
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

/** Un Administrador y un Tendero de la MISMA tienda, con un producto. */
async function tienda() {
  const admin = await agenteLogueado({ rol: 'Administrador' });
  const tendero = await agenteLogueado({ rol: 'Tendero', id_tienda: admin.id_tienda });
  const idProducto = await crearProducto({ id_tienda: admin.id_tienda, precio: 1000, cantidad: 10 });
  return { admin, tendero, idProducto };
}

// Foto de las tablas que estas rutas podrían tocar: si un 403 es real, no cambia nada.
async function foto() {
  const cuenta = async (t) => Number((await db.getAsync(`SELECT COUNT(*) AS n FROM ${t}`)).n);
  return {
    productos: await db.allAsync('SELECT id_producto, nombre_producto, precio, cantidad, estado FROM Productos ORDER BY id_producto'),
    promociones: await cuenta('promociones_manuales'),
    reportes: await cuenta('reportes'),
    movimientos: await cuenta('movimientosstock'),
    clientes: await cuenta('clientes'),
    abonos: await cuenta('abonos'),
    alertas: await cuenta('alertas')
  };
}

// Rutas que la matriz reserva al Administrador (D1 a D4 de Luis, 28-sep-2026).
const cuerpoProducto = { codigo: 'NUEVO-1', nombre_producto: 'Producto nuevo', categoria: 'General', precio: 1000, cantidad: 5, stock_minimo: 1 };
const SOLO_ADMIN = [
  { etiqueta: 'POST /api/productos/bulk (carga masiva)', ruta: () => ['post', '/api/productos/bulk'] },
  { etiqueta: 'POST /api/productos/admin (crear producto)', ruta: () => ['post', '/api/productos/admin', cuerpoProducto] },
  { etiqueta: 'PUT /api/productos/:id (editar)', ruta: (c) => ['put', `/api/productos/${c.idProducto}`, { ...cuerpoProducto, codigo: 'EDIT-1', nombre_producto: 'Editado por Tendero', precio: 1 }] },
  { etiqueta: 'PUT /api/productos/inhabilitar/:id', ruta: (c) => ['put', `/api/productos/inhabilitar/${c.idProducto}`] },
  { etiqueta: 'PUT /api/productos/habilitar/:id', ruta: (c) => ['put', `/api/productos/habilitar/${c.idProducto}`] },
  { etiqueta: 'DELETE /api/productos/:id', ruta: (c) => ['delete', `/api/productos/${c.idProducto}`] },
  { etiqueta: 'POST /api/promociones', ruta: (c) => ['post', '/api/promociones', { id_producto: c.idProducto, descuento_porcentaje: 10, motivo: 'Liquidación decidida por el Tendero' }] },
  { etiqueta: 'POST /api/inventario/salida', ruta: (c) => ['post', '/api/inventario/salida', { id_producto: c.idProducto, cantidad: 2, observacion: 'Salida manual' }] },
  { etiqueta: 'POST /api/inventario/ajuste', ruta: (c) => ['post', '/api/inventario/ajuste', { id_producto: c.idProducto, cantidad: -3, observacion: 'Conteo físico' }] },
  { etiqueta: 'POST /api/alertas/generate', ruta: () => ['post', '/api/alertas/generate'] },
  { etiqueta: 'POST /api/reportes', ruta: () => ['post', '/api/reportes', { titulo: 'Reporte de Tendero', descripcion: 'x', fecha_reporte: '2026-01-01', creador: 'Tendero', tipo: 'Inventario' }] },
  { etiqueta: 'POST /api/exportar/ventas', ruta: () => ['post', '/api/exportar/ventas'] },
  { etiqueta: 'POST /api/exportar/reportes', ruta: () => ['post', '/api/exportar/reportes'] },
  { etiqueta: 'POST /api/ia/apply-strategy', ruta: (c) => ['post', '/api/ia/apply-strategy', { id_producto: c.idProducto, nuevo_precio: 800, duration_days: 7, razon: 'Decidido por el Tendero' }] },
  { etiqueta: 'POST /api/clientes', ruta: () => ['post', '/api/clientes', { nombre: 'Cliente de prueba', telefono: '3000000000' }] },
  { etiqueta: 'POST /api/clientes/:id/abonos', ruta: () => ['post', '/api/clientes/999999/abonos', { monto: 1000 }] }
];

describe('Matriz de roles (P22-10, I0): rutas solo del Administrador', () => {
  it.each(SOLO_ADMIN)('Tendero → $etiqueta: 403 y no cambia nada', async ({ ruta }) => {
    const ctx = await tienda();
    const [metodo, url, cuerpo] = ruta(ctx);
    const antes = await foto();

    const res = await ctx.tendero.agente[metodo](url).set('X-CSRF-Token', ctx.tendero.csrfToken).send(cuerpo);
    expect(res.status).toBe(403);
    expect(await foto()).toEqual(antes);
  });

  it.each(SOLO_ADMIN)('Administrador → $etiqueta: la ruta le responde (no 401/403)', async ({ ruta }) => {
    const ctx = await tienda();
    const [metodo, url, cuerpo] = ruta(ctx);

    const res = await ctx.admin.agente[metodo](url).set('X-CSRF-Token', ctx.admin.csrfToken).send(cuerpo);
    expect([401, 403]).not.toContain(res.status);
    await esperarTrabajoEnSegundoPlano(); // varias rutas regeneran alertas sin esperarlas
  });
});

describe('Matriz de roles (P22-10, I0): lo que el Tendero SÍ puede hacer', () => {
  it('vincular un código de barras a un producto (PUT /api/productos/:id/link-barcode)', async () => {
    const { tendero, idProducto } = await tienda();
    const res = await tendero.agente.put(`/api/productos/${idProducto}/link-barcode`).set('X-CSRF-Token', tendero.csrfToken)
      .send({ codigo_barras: '7701234567890' });
    expect(res.status).toBe(200);
    expect((await db.getAsync('SELECT codigo_barras FROM Productos WHERE id_producto = ?', [idProducto])).codigo_barras).toBe('7701234567890');
  });

  it('registrar una entrada de mercancía (POST /api/inventario/entrada): suma stock y deja el movimiento', async () => {
    const { tendero, idProducto } = await tienda();
    const res = await tendero.agente.post('/api/inventario/entrada').set('X-CSRF-Token', tendero.csrfToken)
      .send({ id_producto: idProducto, cantidad: 4, observacion: 'Recepción de mercancía' });
    expect(res.status).toBe(200);
    await esperarTrabajoEnSegundoPlano(); // registerEntry dispara Alert.generate sin esperarlo
    expect(Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [idProducto])).cantidad)).toBe(14);
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM MovimientosStock')).n)).toBeGreaterThan(0);
  });

  it('resolver una alerta (PATCH /api/alertas/:id/resolve), generada por el Administrador', async () => {
    const { admin, tendero } = await tienda();
    await crearProducto({ id_tienda: admin.id_tienda, cantidad: 0, stock_minimo: 5, stock_seguridad: 5 });
    const generar = await admin.agente.post('/api/alertas/generate').set('X-CSRF-Token', admin.csrfToken);
    expect(generar.status).toBe(200);

    const alerta = await db.getAsync('SELECT id_alerta FROM Alertas WHERE id_tienda = ? LIMIT 1', [admin.id_tienda]);
    const resolver = await tendero.agente.patch(`/api/alertas/${alerta.id_alerta}/resolve`).set('X-CSRF-Token', tendero.csrfToken);
    expect(resolver.status).toBe(200);
    expect(Number((await db.getAsync('SELECT resuelta FROM Alertas WHERE id_alerta = ?', [alerta.id_alerta])).resuelta)).toBe(1);
  });

  it('solicitar un producto al administrador (POST /api/ordenes/borrador/solicitar)', async () => {
    const { admin, tendero } = await tienda();
    const prov = await db.runAsync("INSERT INTO Proveedores (id_tienda, nombre_empresa) VALUES (?, 'Proveedor de prueba') RETURNING id_proveedor", [admin.id_tienda]);
    const idProducto = await crearProducto({ id_tienda: admin.id_tienda, id_proveedor: prov.lastID });

    const res = await tendero.agente.post('/api/ordenes/borrador/solicitar').set('X-CSRF-Token', tendero.csrfToken)
      .send({ id_producto: idProducto, cantidad: 5 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const detalle = await db.getAsync('SELECT solicitado_por FROM Ordenes_Detalle WHERE id_producto = ?', [idProducto]);
    expect(detalle.solicitado_por).toBe(tendero.id_usuario);
  });
});

describe('Rutas eliminadas', () => {
  it('PUT /api/productos/agregar/:id ya no existe (sumaba stock sin dejar movimiento y sin validar el signo)', async () => {
    const { admin, idProducto } = await tienda();
    const res = await admin.agente.put(`/api/productos/agregar/${idProducto}`).set('X-CSRF-Token', admin.csrfToken).send({ cantidad: 5 });
    expect(res.status).toBe(404);
    expect(Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [idProducto])).cantidad)).toBe(10);
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
