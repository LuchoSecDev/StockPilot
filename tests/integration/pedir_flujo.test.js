/**
 * @file pedir_flujo.test.js
 * @description La cadena que recorre la pantalla «¿Qué pido?» (/pedir, modo básico, plan 19, 3.4.3 fase C), con las
 * respuestas REALES del servidor pasando por las reglas del frontend (frontend/src/utils/pedir.js):
 *   sugerencias (GET /api/ia/snapshot) → armar el pedido (POST /api/ordenes/borrador/desde-consejero) →
 *   aprobarlo (PATCH /api/ordenes/:id/estado) → recibir la mercancía (POST /api/ordenes/:id/completar).
 * Todo es el motor matemático: ninguna de estas rutas llama a OpenAI. GET /api/ia/snapshot y GET /api/ordenes/historial
 * no tenían prueba propia.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';
import {
  sugerenciasDePedido, cuerpoParaArmar, ordenesPorAprobar, ordenesPorRecibir, pendienteDeLinea, cuerpoDeRecepcion,
} from '../../frontend/src/utils/pedir.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});
afterEach(esperarTrabajoEnSegundoPlano); // completarRecepcion dispara Alert.generate sin esperarlo

const stock = async (id) => Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [id])).cantidad);

/** Tienda con un proveedor y cuatro productos: dos por pedir, uno sano, uno sin proveedor y uno agotado sin datos. */
async function tiendaConFaltantes() {
  const admin = await crearUsuario({ rol: 'Administrador' });
  const agente = request.agent(app);
  await iniciarSesion(agente, admin);
  const csrf = await obtenerCsrfToken(agente);
  const prov = await agente.post('/api/proveedores').set('X-CSRF-Token', csrf)
    .send({ nombre_empresa: 'Distribuidora Sol', contacto_principal: 'Ana', email: 'sol@test.local', telefono: '3000000000', direccion: 'Calle 1' });
  const idProveedor = prov.body.id;
  const base = { id_tienda: admin.id_tienda };
  const agotado = await crearProducto({ ...base, id_proveedor: idProveedor, nombre_producto: 'Arroz agotado', cantidad: 0, stock_seguridad: 5 });
  const bajo = await crearProducto({ ...base, id_proveedor: idProveedor, nombre_producto: 'Aceite bajo', cantidad: 1, stock_seguridad: 6 });
  const sano = await crearProducto({ ...base, id_proveedor: idProveedor, nombre_producto: 'Sal sana', cantidad: 100, stock_seguridad: 2 });
  const sinProveedor = await crearProducto({ ...base, id_proveedor: null, nombre_producto: 'Café sin proveedor', cantidad: 0, stock_seguridad: 3 });
  const sinDatos = await crearProducto({ ...base, id_proveedor: idProveedor, nombre_producto: 'Pan sin datos', cantidad: 0, stock_seguridad: 0, stock_minimo: 0 });
  return { agente, csrf, idProveedor, admin, ids: { agotado, bajo, sano, sinProveedor, sinDatos } };
}

const verSnapshot = async (t) => (await t.agente.get('/api/ia/snapshot')).body.data;
const verBorradores = async (t) => (await t.agente.get('/api/ordenes/borradores/resumen')).body.data;
const verHistorial = async (t) => (await t.agente.get('/api/ordenes/historial')).body.data;

describe('/pedir: sugerencias con datos reales del motor', () => {
  it('el snapshot trae los campos que usa la pantalla y las reglas del frontend los clasifican bien', async () => {
    const t = await tiendaConFaltantes();
    const res = await t.agente.get('/api/ia/snapshot');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const arroz = res.body.data.find((p) => p.id_producto === t.ids.agotado);
    expect(arroz).toMatchObject({
      id_proveedor: t.idProveedor, proveedor: 'Distribuidora Sol', nombre: 'Arroz agotado', nivel: 'agotado', urgencia: 'Pide hoy',
      cantidad_recomendada: expect.any(Number), costo_unitario: expect.anything(), stock_actual: expect.anything(),
    });

    const r = sugerenciasDePedido(res.body.data, {});
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0]).toMatchObject({ id_proveedor: t.idProveedor, proveedor: 'Distribuidora Sol' });
    expect(r.grupos[0].items.map((i) => i.id_producto).sort()).toEqual([t.ids.agotado, t.ids.bajo].sort());
    expect(r.sinProveedor.map((i) => i.id_producto)).toEqual([t.ids.sinProveedor]);
    expect(r.sinCantidad.map((i) => i.id_producto)).toEqual([t.ids.sinDatos]);
    const todos = [...r.grupos.flatMap((g) => g.items), ...r.sinProveedor, ...r.sinCantidad].map((i) => i.id_producto);
    expect(todos).not.toContain(t.ids.sano);
  });

  it('un Colaborador (Tendero) no puede armar ni aprobar pedidos: /pedir es solo del Administrador', async () => {
    const t = await tiendaConFaltantes();
    const colab = await crearUsuario({ rol: 'Tendero', id_tienda: t.admin.id_tienda });
    const agente = request.agent(app);
    await iniciarSesion(agente, colab);
    const csrf = await obtenerCsrfToken(agente);
    const armar = await agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', csrf).send({ items: [{ id_producto: t.ids.agotado, cantidad: 5 }] });
    expect(armar.status).toBe(403);
    expect((await agente.get('/api/ordenes/historial')).status).toBe(403);
  });
});

describe('/pedir: armar, aprobar y recibir', () => {
  it('recorre el flujo completo y el stock sube con lo que llegó', async () => {
    const t = await tiendaConFaltantes();

    // 1. Armar el pedido con lo que sugiere el motor
    const sugerido = sugerenciasDePedido(await verSnapshot(t), await verBorradores(t));
    const grupo = sugerido.grupos[0];
    const armar = await t.agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', t.csrf).send(cuerpoParaArmar(grupo.items));
    expect(armar.status).toBe(200);
    expect(armar.body.borradores).toHaveLength(1);
    const idOrden = armar.body.borradores[0].id_orden;
    expect(armar.body.borradores[0]).toMatchObject({ id_proveedor: t.idProveedor, creado: true, agregados: grupo.items.length });

    // 2. Queda por aprobar, y lo ya pedido deja de ofrecerse
    const porAprobar = ordenesPorAprobar(await verHistorial(t));
    expect(porAprobar.map((o) => o.id_orden)).toEqual([idOrden]);
    expect(porAprobar[0]).toMatchObject({ estado: 'Borrador', proveedor_nombre: 'Distribuidora Sol', items_count: grupo.items.length });
    const despues = sugerenciasDePedido(await verSnapshot(t), await verBorradores(t));
    expect(despues.grupos).toHaveLength(0);
    expect(despues.yaEnBorrador).toBe(grupo.items.length);

    // 3. Aprobarlo: pasa a «por recibir»
    const aprobar = await t.agente.patch(`/api/ordenes/${idOrden}/estado`).set('X-CSRF-Token', t.csrf).send({ estado: 'Aprobada' });
    expect(aprobar.status).toBe(200);
    expect(ordenesPorAprobar(await verHistorial(t))).toHaveLength(0);
    const porRecibir = ordenesPorRecibir(await verHistorial(t));
    expect(porRecibir.map((o) => o.id_orden)).toEqual([idOrden]);
    expect(porRecibir[0].fecha_aprobacion).toBeTruthy();

    // 4. Recibir TODO lo pendiente (el valor por defecto de la pantalla)
    const detalle = (await t.agente.get(`/api/ordenes/${idOrden}`)).body.data;
    expect(detalle).toHaveLength(grupo.items.length);
    for (const l of detalle) expect(l).toMatchObject({ nombre_producto: expect.any(String), cantidad_final: expect.any(Number) });
    const llegadas = Object.fromEntries(detalle.map((l) => [l.id_producto, String(pendienteDeLinea(l))]));
    const antes = Object.fromEntries(await Promise.all(detalle.map(async (l) => [l.id_producto, await stock(l.id_producto)])));
    const cuerpo = cuerpoDeRecepcion(detalle, llegadas);
    expect(cuerpo.ok).toBe(true);
    const recibir = await t.agente.post(`/api/ordenes/${idOrden}/completar`).set('X-CSRF-Token', t.csrf).send(cuerpo.cuerpo);
    expect(recibir.status).toBe(200);
    expect(recibir.body).toMatchObject({ success: true, estado: 'Completada', pendientes: [] });
    for (const l of detalle) expect(await stock(l.id_producto)).toBe(antes[l.id_producto] + l.cantidad_final);
    expect(ordenesPorRecibir(await verHistorial(t))).toHaveLength(0);
  });

  it('una recepción parcial deja la orden «por recibir» y la siguiente suma sin duplicar stock', async () => {
    const t = await tiendaConFaltantes();
    const grupo = sugerenciasDePedido(await verSnapshot(t), {}).grupos[0];
    const idOrden = (await t.agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', t.csrf).send(cuerpoParaArmar(grupo.items))).body.borradores[0].id_orden;
    await t.agente.patch(`/api/ordenes/${idOrden}/estado`).set('X-CSRF-Token', t.csrf).send({ estado: 'Aprobada' });
    const detalle1 = (await t.agente.get(`/api/ordenes/${idOrden}`)).body.data;
    const primera = detalle1[0];
    const stockAntes = await stock(primera.id_producto);

    // Llega solo 1 unidad de la primera línea y nada de las demás
    const r1 = await t.agente.post(`/api/ordenes/${idOrden}/completar`).set('X-CSRF-Token', t.csrf)
      .send(cuerpoDeRecepcion(detalle1, { [primera.id_producto]: '1' }).cuerpo);
    expect(r1.status).toBe(200);
    expect(r1.body.estado).toBe('Parcial');
    expect(ordenesPorRecibir(await verHistorial(t)).map((o) => o.estado)).toEqual(['Parcial']);

    // La pantalla vuelve a leer el detalle: ya ve lo recibido y calcula lo que falta a partir de ahí
    const detalle2 = (await t.agente.get(`/api/ordenes/${idOrden}`)).body.data;
    expect(Number(detalle2.find((l) => l.id_producto === primera.id_producto).cantidad_recibida)).toBe(1);
    const llegadas = Object.fromEntries(detalle2.map((l) => [l.id_producto, String(pendienteDeLinea(l))]));
    const r2 = await t.agente.post(`/api/ordenes/${idOrden}/completar`).set('X-CSRF-Token', t.csrf).send(cuerpoDeRecepcion(detalle2, llegadas).cuerpo);
    expect(r2.status).toBe(200);
    expect(r2.body.estado).toBe('Completada');
    expect(await stock(primera.id_producto)).toBe(stockAntes + primera.cantidad_final); // 1 + lo que faltaba, sin duplicar
  });

  it('recibir de más pide confirmación con motivo (409) y la pantalla lo reenvía con confirmar_exceso', async () => {
    const t = await tiendaConFaltantes();
    const grupo = sugerenciasDePedido(await verSnapshot(t), {}).grupos[0];
    const idOrden = (await t.agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', t.csrf).send(cuerpoParaArmar(grupo.items))).body.borradores[0].id_orden;
    await t.agente.patch(`/api/ordenes/${idOrden}/estado`).set('X-CSRF-Token', t.csrf).send({ estado: 'Aprobada' });
    const detalle = (await t.agente.get(`/api/ordenes/${idOrden}`)).body.data;
    const llegadas = Object.fromEntries(detalle.map((l) => [l.id_producto, String(pendienteDeLinea(l) + 3)]));

    const sin = await t.agente.post(`/api/ordenes/${idOrden}/completar`).set('X-CSRF-Token', t.csrf).send(cuerpoDeRecepcion(detalle, llegadas).cuerpo);
    expect(sin.status).toBe(409);
    expect(sin.body).toMatchObject({ code: 'RECEPCION_EXCEDE_PEDIDO', requiere_confirmacion: true });
    expect(sin.body.excesos).toHaveLength(detalle.length);

    const con = await t.agente.post(`/api/ordenes/${idOrden}/completar`).set('X-CSRF-Token', t.csrf)
      .send(cuerpoDeRecepcion(detalle, llegadas, { confirmarExceso: true, motivo: 'El proveedor mandó 3 de más' }).cuerpo);
    expect(con.status).toBe(200);
    expect(con.body.estado).toBe('Completada');
  });

  it('descartar un pedido (Rechazada) lo saca de la lista por aprobar', async () => {
    const t = await tiendaConFaltantes();
    const grupo = sugerenciasDePedido(await verSnapshot(t), {}).grupos[0];
    const idOrden = (await t.agente.post('/api/ordenes/borrador/desde-consejero').set('X-CSRF-Token', t.csrf).send(cuerpoParaArmar(grupo.items))).body.borradores[0].id_orden;
    const rechazar = await t.agente.patch(`/api/ordenes/${idOrden}/estado`).set('X-CSRF-Token', t.csrf).send({ estado: 'Rechazada' });
    expect(rechazar.status).toBe(200);
    const historial = await verHistorial(t);
    expect(ordenesPorAprobar(historial)).toHaveLength(0);
    expect(ordenesPorRecibir(historial)).toHaveLength(0);
    // Y el motor vuelve a ofrecer esos productos
    expect(sugerenciasDePedido(await verSnapshot(t), await verBorradores(t)).grupos).toHaveLength(1);
  });
});
