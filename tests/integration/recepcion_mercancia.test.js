/**
 * @file recepcion_mercancia.test.js
 * @description Regla P21-10 (plan 21, decisión 5, decidida por Luis el 4-oct-2026) de
 * `POST /api/ordenes/:ordenId/completar`:
 *  - `cantidad_recibida` de cada línea es el TOTAL recibido hasta ahora (no «lo de hoy»): el servidor suma
 *    solo la diferencia contra lo ya recibido, así que reenviar el mismo total (doble clic, reintento) no
 *    vuelve a sumar stock.
 *  - Recibir MENOS de lo pedido deja la orden en «Parcial» con el faltante pendiente; se puede seguir recibiendo.
 *  - Recibir MÁS de lo pedido (en total) pide confirmación: 409 `RECEPCION_EXCEDE_PEDIDO` sin escribir nada,
 *    y solo se registra con `confirmar_exceso: true` y un `motivo` de 5 a 200 caracteres.
 *  - `cerrar_con_faltante: true` cierra la orden como «Completada» aunque falte algo (el administrador da el
 *    resto por perdido).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
afterEach(esperarTrabajoEnSegundoPlano); // completarRecepcion dispara Alert.generate sin esperarlo

/** Una tienda con un Administrador, un proveedor y una orden Aprobada con un producto por cada pedido de `pedidos`. */
async function escenario(pedidos = [10], stockInicial = 10, rol = 'Administrador') {
  const admin = await crearUsuario({ rol: 'Administrador' });
  const agente = request.agent(app);
  await iniciarSesion(agente, admin);
  const csrfToken = await obtenerCsrfToken(agente);
  const prov = await agente.post('/api/proveedores').set('X-CSRF-Token', csrfToken)
    .send({ nombre_empresa: 'Proveedor de Prueba', contacto_principal: 'Juan', email: 'prov@test.local', telefono: '3000000000', direccion: 'Calle 1' });
  const idProveedor = prov.body.id;
  const productos = [];
  for (const [i, pedido] of pedidos.entries()) {
    productos.push({ id: await crearProducto({ id_tienda: admin.id_tienda, id_proveedor: idProveedor, cantidad: stockInicial, nombre_producto: `Producto ${i + 1}` }), pedido });
  }
  const carrito_final = productos.map((p) => ({ id_producto: p.id, nombre: 'Prod', calculo_base: p.pedido, ajuste_ia: '+0%', sugerencia_final: p.pedido, presupuesto_estimado_final: p.pedido * 500 }));
  const crear = await agente.post(`/api/proveedores/${idProveedor}/ordenes`).set('X-CSRF-Token', csrfToken)
    .send({ carrito_final, evaluacion_riesgo: { nivel: 'Bajo', costo_total_estimado: 5000 } });
  const ordenId = crear.body.orden_id;
  await agente.patch(`/api/ordenes/${ordenId}/estado`).set('X-CSRF-Token', csrfToken).send({ estado: 'Aprobada' });

  let quien = { agente, csrfToken };
  if (rol === 'Tendero') {
    const t = await crearUsuario({ rol: 'Tendero', id_tienda: admin.id_tienda });
    const ag = request.agent(app);
    await iniciarSesion(ag, t);
    quien = { agente: ag, csrfToken: await obtenerCsrfToken(ag) };
  }
  const recibir = (cuerpo) => quien.agente.post(`/api/ordenes/${ordenId}/completar`).set('X-CSRF-Token', quien.csrfToken).send(cuerpo);
  const total = (...cantidades) => ({ items: productos.map((p, i) => ({ id_producto: p.id, cantidad_recibida: cantidades[i] })).filter((_, i) => cantidades[i] !== undefined) });
  return { ordenId, productos, recibir, total, id_tienda: admin.id_tienda };
}
const stock = async (id) => Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [id])).cantidad);
const estado = async (ordenId) => (await db.getAsync('SELECT estado FROM Ordenes_Compra WHERE id_orden = ?', [ordenId])).estado;
const recibidoEnDetalle = async (ordenId, id) => (await db.getAsync('SELECT cantidad_recibida FROM Ordenes_Detalle WHERE id_orden = ? AND id_producto = ?', [ordenId, id])).cantidad_recibida;
const entradasKardex = async (id) => db.allAsync("SELECT cantidad, observacion FROM MovimientosStock WHERE id_producto = ? AND tipo_movimiento = 'Entrada' ORDER BY id_movimiento", [id]);
/** Foto de todo lo que una recepción rechazada NO debe tocar. */
const foto = async (e) => ({
  estado: await estado(e.ordenId),
  stocks: await Promise.all(e.productos.map((p) => stock(p.id))),
  recibidos: await Promise.all(e.productos.map((p) => recibidoEnDetalle(e.ordenId, p.id))),
  kardex: Number((await db.getAsync("SELECT COUNT(*) AS n FROM MovimientosStock WHERE tipo_movimiento = 'Entrada'")).n)
});

describe('Recepción de mercancía: lo recibido frente a lo pedido', () => {
  it('recibir exactamente lo pedido cierra la orden como «Completada»', async () => {
    const e = await escenario([10]);
    const r = await e.recibir(e.total(10));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, estado: 'Completada', pendientes: [], presupuesto_total: expect.any(Number) });
    expect(await estado(e.ordenId)).toBe('Completada');
    expect(await stock(e.productos[0].id)).toBe(20);
    expect(await recibidoEnDetalle(e.ordenId, e.productos[0].id)).toBe(10);
  });

  it('recibir MENOS deja la orden «Parcial» con el faltante pendiente, y el total es lo realmente recibido', async () => {
    const e = await escenario([10]);
    const r = await e.recibir(e.total(4));
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('Parcial');
    expect(r.body.pendientes).toEqual([{ id_producto: e.productos[0].id, nombre: 'Producto 1', pendiente: 6 }]);
    expect(await estado(e.ordenId)).toBe('Parcial');
    expect(await stock(e.productos[0].id)).toBe(14);
    const costo = Number((await db.getAsync('SELECT costo_unitario FROM Ordenes_Detalle WHERE id_orden = ?', [e.ordenId])).costo_unitario);
    expect(r.body.presupuesto_total).toBe(4 * costo);
  });

  it('una orden «Parcial» se sigue recibiendo: el total acumulado suma solo la diferencia y al llegar a lo pedido se completa', async () => {
    const e = await escenario([10]);
    await e.recibir(e.total(4));
    const r = await e.recibir(e.total(10)); // total acumulado, no «6 más»
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('Completada');
    expect(await stock(e.productos[0].id)).toBe(20); // 10 + 4 + 6
    expect((await entradasKardex(e.productos[0].id)).map((m) => m.cantidad)).toEqual([4, 6]);
  });

  it('reenviar el MISMO total (doble clic, reintento) no vuelve a sumar stock ni al Kardex', async () => {
    const e = await escenario([10]);
    await e.recibir(e.total(4));
    const antes = await foto(e);
    const r = await e.recibir(e.total(4));
    expect(r.status).toBe(200);
    expect(await foto(e)).toEqual(antes);
  });

  it('dos recepciones idénticas simultáneas suman el stock una sola vez', async () => {
    const e = await escenario([10]);
    const [a, b] = await Promise.all([e.recibir(e.total(4)), e.recibir(e.total(4))]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await stock(e.productos[0].id)).toBe(14);
    expect(await entradasKardex(e.productos[0].id)).toHaveLength(1);
  });

  it('un total MENOR que lo ya recibido da 400 y no cambia nada', async () => {
    const e = await escenario([10]);
    await e.recibir(e.total(6));
    const antes = await foto(e);
    const r = await e.recibir(e.total(3));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/menos de lo que ya registraste/i);
    expect(await foto(e)).toEqual(antes);
  });

  it('con varias líneas, la orden sigue «Parcial» mientras alguna no esté completa', async () => {
    const e = await escenario([10, 5]);
    expect((await e.recibir(e.total(10, 2))).body).toMatchObject({ estado: 'Parcial', pendientes: [{ id_producto: e.productos[1].id, nombre: 'Producto 2', pendiente: 3 }] });
    expect((await e.recibir(e.total(10, 5))).body.estado).toBe('Completada');
  });

  it('una línea que no se envía cuenta como no recibida: la orden queda «Parcial»', async () => {
    const e = await escenario([10, 5]);
    expect((await e.recibir(e.total(10))).body.estado).toBe('Parcial');
  });
});

describe('Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo', () => {
  it('sin confirmar: 409 RECEPCION_EXCEDE_PEDIDO con el detalle del exceso, y no escribe NADA', async () => {
    const e = await escenario([5]);
    const antes = await foto(e);
    const r = await e.recibir(e.total(500));
    expect(r.status).toBe(409);
    expect(r.body).toEqual({
      success: false,
      code: 'RECEPCION_EXCEDE_PEDIDO',
      requiere_confirmacion: true,
      error: 'Recibiste más de lo pedido en 1 producto. Confirma e indica el motivo para registrarlo.',
      excesos: [{ id_producto: e.productos[0].id, nombre: 'Producto 1', pedido: 5, recibido: 500, exceso: 495 }]
    });
    expect(await foto(e)).toEqual(antes);
    expect(antes.stocks).toEqual([10]);
  });

  it.each([
    ['sin motivo', {}],
    ['con motivo vacío', { motivo: '   ' }],
    ['con motivo demasiado corto', { motivo: 'ok' }],
    ['con motivo demasiado largo', { motivo: 'x'.repeat(201) }],
    ['con motivo que no es texto', { motivo: 12345 }]
  ])('confirmar el exceso %s da 400 y no escribe nada', async (_nombre, extra) => {
    const e = await escenario([5]);
    const antes = await foto(e);
    const r = await e.recibir({ ...e.total(8), confirmar_exceso: true, ...extra });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ success: false, code: 'MOTIVO_REQUERIDO' });
    expect(await foto(e)).toEqual(antes);
  });

  it('confirmado con motivo: se registra todo, el motivo queda en el Kardex y la orden se completa', async () => {
    const e = await escenario([5]);
    const r = await e.recibir({ ...e.total(8), confirmar_exceso: true, motivo: '  El proveedor mandó una caja extra  ' });
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('Completada');
    expect(await stock(e.productos[0].id)).toBe(18);
    expect(await recibidoEnDetalle(e.ordenId, e.productos[0].id)).toBe(8);
    const [mov] = await entradasKardex(e.productos[0].id);
    expect(mov.cantidad).toBe(8);
    expect(mov.observacion).toContain(`Orden de Compra #${e.ordenId}`);
    expect(mov.observacion).toContain('exceso confirmado');
    expect(mov.observacion).toContain('El proveedor mandó una caja extra');
  });

  it('el exceso se mide sobre el TOTAL acumulado: una orden «Parcial» que pasa de lo pedido también pide confirmación', async () => {
    const e = await escenario([10]);
    await e.recibir(e.total(4));
    const antes = await foto(e);
    const r = await e.recibir(e.total(12));
    expect(r.status).toBe(409);
    expect(r.body.excesos).toEqual([{ id_producto: e.productos[0].id, nombre: 'Producto 1', pedido: 10, recibido: 12, exceso: 2 }]);
    expect(await foto(e)).toEqual(antes);
  });

  it('con dos líneas, el exceso de una bloquea toda la recepción (no se guarda la otra a medias)', async () => {
    const e = await escenario([10, 5]);
    const antes = await foto(e);
    const r = await e.recibir(e.total(10, 9));
    expect(r.status).toBe(409);
    expect(r.body.excesos).toHaveLength(1);
    expect(await foto(e)).toEqual(antes);
  });

  it('confirmar_exceso sin que haya exceso no exige motivo ni cambia nada', async () => {
    const e = await escenario([10]);
    const r = await e.recibir({ ...e.total(10), confirmar_exceso: true });
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('Completada');
    expect((await entradasKardex(e.productos[0].id))[0].observacion).not.toContain('exceso');
  });
});

describe('Recepción de mercancía: cerrar con faltante, estados y permisos', () => {
  it('cerrar_con_faltante: true completa la orden aunque falte, y ya no admite más recepciones', async () => {
    const e = await escenario([10]);
    const r = await e.recibir({ ...e.total(4), cerrar_con_faltante: true });
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('Completada');
    expect(await stock(e.productos[0].id)).toBe(14);
    const otra = await e.recibir(e.total(10));
    expect(otra.status).toBe(400);
    expect(otra.body.error).toBe('Solo se puede recibir una orden Aprobada, Enviada o Parcial.');
    expect(await stock(e.productos[0].id)).toBe(14);
  });

  it('una orden «Completada» no admite otra recepción (ni siquiera con el mismo total)', async () => {
    const e = await escenario([10]);
    await e.recibir(e.total(10));
    const r = await e.recibir(e.total(10));
    expect(r.status).toBe(400);
    expect(await stock(e.productos[0].id)).toBe(20);
  });

  it('un producto repetido en la misma recepción da 400 y no escribe nada', async () => {
    const e = await escenario([10]);
    const antes = await foto(e);
    const id = e.productos[0].id;
    const r = await e.recibir({ items: [{ id_producto: id, cantidad_recibida: 2 }, { id_producto: id, cantidad_recibida: 3 }] });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/repetido/i);
    expect(await foto(e)).toEqual(antes);
  });

  it('un Tendero recibe 403 y no cambia nada (la recepción es del Administrador)', async () => {
    const e = await escenario([10], 10, 'Tendero');
    const antes = await foto(e);
    const r = await e.recibir(e.total(10));
    expect(r.status).toBe(403);
    expect(await foto(e)).toEqual(antes);
  });
});
