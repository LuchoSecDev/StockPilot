/**
 * @file ia_analitica.test.js
 * @description Pruebas de caracterización (plan 21, R1) de los 3 endpoints de `/api/ia` que NO
 * llaman a OpenAI y que vivían con su SQL dentro de `aiController.js`: snapshot analítico,
 * tendencia de precios y sugerencia de umbrales de stock. Se escribieron ANTES de moverlos a
 * `services/inventory/` ("primero la prueba, luego el movimiento", plan 21 sección 3): fijan la
 * respuesta que ya daban, para que el traslado no pueda cambiarla sin que alguna falle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
import { iniciarSesion } from './helpers/sesion.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

async function agenteLogueado(overrides = {}) {
  const datosUsuario = await crearUsuario(overrides);
  const agente = request.agent(app);
  await iniciarSesion(agente, datosUsuario);
  return { agente, ...datosUsuario };
}

/** Registra una venta de `cantidad` unidades del producto, ocurrida hace `diasAtras` días. */
async function venderHaceDias({ id_usuario, id_tienda, id_producto, cantidad, diasAtras = 1 }) {
  const venta = await db.runAsync(
    "INSERT INTO Ventas (id_vendedor, id_tienda, fecha_salida, precio_total) VALUES (?, ?, CURRENT_TIMESTAMP - (? * INTERVAL '1 day'), ?) RETURNING id_venta",
    [id_usuario, id_tienda, diasAtras, cantidad * 1000]
  );
  await db.runAsync(
    'INSERT INTO VentasProductos (id_venta, id_producto, cantidad) VALUES (?, ?, ?)',
    [venta.lastID, id_producto, cantidad]
  );
}

describe('GET /api/ia/snapshot (getAnalyticalSnapshot)', () => {
  it('sin sesión redirige al login (302)', async () => {
    const res = await request(app).get('/api/ia/snapshot');
    expect(res.status).toBe(302);
  });

  it('tienda sin productos: success:true y data vacío', async () => {
    const { agente } = await agenteLogueado();
    const res = await agente.get('/api/ia/snapshot');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  it('devuelve por producto el contrato que consume el frontend (claves y valores del motor)', async () => {
    const { agente, id_tienda } = await agenteLogueado();
    const id_producto = await crearProducto({ id_tienda, nombre_producto: 'Arroz', cantidad: 0, stock_seguridad: 5, stock_minimo: 5, precio: 2000, costo_compra: 1200, lead_time: 4 });

    const res = await agente.get('/api/ia/snapshot');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    const item = res.body.data[0];
    expect(Object.keys(item).sort()).toEqual([
      'cantidad_recomendada', 'categoria', 'category', 'costo_estimado', 'costo_unitario', 'days_to_exhaust',
      'id_producto', 'id_proveedor', 'lead_time', 'nivel', 'nombre', 'precio', 'proveedor', 'revenue',
      'risk', 'rop', 'stock_actual', 'stock_seguridad', 'urgencia', 'velocity'
    ]);
    expect(item.id_producto).toBe(id_producto);
    expect(item.nombre).toBe('Arroz');
    expect(item.stock_actual).toBe(0);
    expect(item.lead_time).toBe(4);
    expect(item.stock_seguridad).toBe(5);
    expect(Number(item.costo_unitario)).toBe(1200);
    expect(item.nivel).not.toBe('ok'); // sin stock, el motor pide reponer
    expect(item.cantidad_recomendada).toBeGreaterThan(0);
  });

  it('el parámetro dias solo se respeta entre 7 y 90; fuera de rango se ignora (igual que sin parámetro)', async () => {
    const { agente, id_usuario, id_tienda } = await agenteLogueado();
    const id_producto = await crearProducto({ id_tienda, cantidad: 3, stock_seguridad: 1, stock_minimo: 1 });
    await venderHaceDias({ id_usuario, id_tienda, id_producto, cantidad: 30, diasAtras: 2 });

    const base = (await agente.get('/api/ia/snapshot')).body.data[0];
    const fueraDeRango = (await agente.get('/api/ia/snapshot?dias=3')).body.data[0];
    const enRango = (await agente.get('/api/ia/snapshot?dias=90')).body.data[0];

    expect(fueraDeRango).toEqual(base);
    expect(enRango.cantidad_recomendada).toBeGreaterThan(base.cantidad_recomendada);
  });

  it('no mezcla productos de otra tienda', async () => {
    const A = await agenteLogueado();
    const B = await agenteLogueado();
    await crearProducto({ id_tienda: A.id_tienda, nombre_producto: 'Solo de A' });

    const resB = await B.agente.get('/api/ia/snapshot');
    expect(resB.body.data).toEqual([]);
  });
});

describe('GET /api/ia/price-trend (getPriceTrend)', () => {
  it('sin sesión redirige al login (302)', async () => {
    const res = await request(app).get('/api/ia/price-trend');
    expect(res.status).toBe(302);
  });

  it('sin cambios de precio: success:true y trend vacío', async () => {
    const { agente } = await agenteLogueado();
    const res = await agente.get('/api/ia/price-trend');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, trend: [] });
  });

  it('devuelve cada cambio con fecha YYYY-MM-DD, precios numéricos y variación', async () => {
    const { agente, id_tienda } = await agenteLogueado();
    const id_producto = await crearProducto({ id_tienda, nombre_producto: 'Leche' });
    await db.runAsync(
      'INSERT INTO Historial_Precios (id_producto, precio_anterior, precio_nuevo, motivo) VALUES (?, ?, ?, ?)',
      [id_producto, 1000, 800, 'Promoción']
    );

    const res = await agente.get('/api/ia/price-trend');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trend).toHaveLength(1);
    expect(res.body.trend[0]).toEqual({
      fecha: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      producto: 'Leche',
      precioAnterior: 1000,
      precioNuevo: 800,
      variacion: -200
    });
  });

  it('no muestra los cambios de precio de otra tienda', async () => {
    const A = await agenteLogueado();
    const B = await agenteLogueado();
    const id_producto = await crearProducto({ id_tienda: A.id_tienda });
    await db.runAsync(
      'INSERT INTO Historial_Precios (id_producto, precio_anterior, precio_nuevo, motivo) VALUES (?, ?, ?, ?)',
      [id_producto, 1000, 900, 'x']
    );

    const resB = await B.agente.get('/api/ia/price-trend');
    expect(resB.body.trend).toEqual([]);
  });
});

describe('GET /api/ia/suggest-alerts (suggestStockAlerts)', () => {
  const SIN_HISTORIAL = 'Sin historial de ventas suficiente. Se sugieren valores base predeterminados.';

  it('sin sesión redirige al login (302)', async () => {
    const res = await request(app).get('/api/ia/suggest-alerts');
    expect(res.status).toBe(302);
  });

  it('sin producto ni categoría: valores base (mínimo 5, seguridad 2, entrega 3 días)', async () => {
    const { agente } = await agenteLogueado();
    const res = await agente.get('/api/ia/suggest-alerts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      suggestions: { stock_minimo: 5, stock_seguridad: 2, lead_time: 3, nota: SIN_HISTORIAL }
    });
  });

  it('producto sin ventas: valores base, pero conserva el lead_time propio del producto', async () => {
    const { agente, id_tienda } = await agenteLogueado();
    const id_producto = await crearProducto({ id_tienda, lead_time: 6 });

    const res = await agente.get(`/api/ia/suggest-alerts?id_producto=${id_producto}`);

    expect(res.body.suggestions).toEqual({ stock_minimo: 5, stock_seguridad: 2, lead_time: 6, nota: SIN_HISTORIAL });
  });

  it('producto con ventas: umbrales a partir de las ventas reales de los últimos 30 días', async () => {
    const { agente, id_usuario, id_tienda } = await agenteLogueado();
    const id_producto = await crearProducto({ id_tienda, lead_time: 3 });
    await venderHaceDias({ id_usuario, id_tienda, id_producto, cantidad: 60 }); // 2 por día

    const res = await agente.get(`/api/ia/suggest-alerts?id_producto=${id_producto}`);

    // seguridad = 2 días de venta = 4; mínimo = 2/día * 3 días + 4 = 10
    expect(res.body.suggestions).toEqual({
      stock_minimo: 10,
      stock_seguridad: 4,
      lead_time: 3,
      nota: 'Sugerencia basada en las ventas reales de los últimos 30 días.'
    });
  });

  it('ventas anteriores a 30 días no cuentan', async () => {
    const { agente, id_usuario, id_tienda } = await agenteLogueado();
    const id_producto = await crearProducto({ id_tienda });
    await venderHaceDias({ id_usuario, id_tienda, id_producto, cantidad: 600, diasAtras: 45 });

    const res = await agente.get(`/api/ia/suggest-alerts?id_producto=${id_producto}`);
    expect(res.body.suggestions.nota).toBe(SIN_HISTORIAL);
  });

  it('producto nuevo con categoría: promedio de la categoría repartido entre sus productos', async () => {
    const { agente, id_usuario, id_tienda } = await agenteLogueado();
    const vendido = await crearProducto({ id_tienda, categoria: 'Bebidas' });
    await crearProducto({ id_tienda, categoria: 'Bebidas' });
    await venderHaceDias({ id_usuario, id_tienda, id_producto: vendido, cantidad: 60 }); // 2/día entre 2 productos = 1/día

    const res = await agente.get('/api/ia/suggest-alerts?categoria=Bebidas');

    // seguridad = ceil(1*2)=2; mínimo = ceil(1*3 + 2)=5
    expect(res.body.suggestions).toEqual({
      stock_minimo: 5,
      stock_seguridad: 2,
      lead_time: 3,
      nota: 'Sugerencia basada en el promedio de ventas de la categoría.'
    });
  });
});
