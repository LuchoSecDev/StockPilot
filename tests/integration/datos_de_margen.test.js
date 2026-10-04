/**
 * @file datos_de_margen.test.js
 * @description Rama feat/backend-app-tendero: las respuestas de producto incluían `costo_compra` y
 * `clasificacion_abc` también para el Tendero, o sea, el precio de costo (y por tanto el margen) viajaba
 * al dispositivo de la app. Ahora solo el Administrador los recibe.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../app.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearProducto } from './helpers/fixtures.js';
import { dosTiendas } from './helpers/tiendas.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

const CAMPOS = ['costo_compra', 'clasificacion_abc'];
const get = (s, url) => s.agente.get(url).set('Accept', 'application/json');

async function escenario() {
  const t = await dosTiendas(app);
  const id = await crearProducto({ id_tienda: t.adminA.id_tienda, nombre_producto: 'Arroz', codigo_barras: '7701234000011', precio: 4500, costo_compra: 3200 });
  return { ...t, id };
}

describe('Datos de margen: solo para el Administrador', () => {
  it('GET /api/productos: el Tendero NO recibe costo_compra ni clasificacion_abc; el Administrador sí', async () => {
    const e = await escenario();
    const tendero = (await get(e.tenderoA, '/api/productos')).body[0];
    const admin = (await get(e.adminA, '/api/productos')).body[0];
    for (const campo of CAMPOS) {
      expect(tendero, campo).not.toHaveProperty(campo);
      expect(admin, campo).toHaveProperty(campo);
    }
    expect(Number(admin.costo_compra)).toBe(3200);
    expect(tendero).toMatchObject({ nombre_producto: 'Arroz', precio: '4500.00', nivel_stock: 'ok' }); // lo que sí usa la app
  });

  it('GET /api/productos/:id y GET /api/productos/barcode/:code: igual', async () => {
    const e = await escenario();
    const porId = await get(e.tenderoA, `/api/productos/${e.id}`);
    const porCodigo = await get(e.tenderoA, '/api/productos/barcode/7701234000011');
    expect(porId.status).toBe(200);
    expect(porCodigo.status).toBe(200);
    for (const campo of CAMPOS) {
      expect(porId.body, campo).not.toHaveProperty(campo);
      expect(porCodigo.body.data, campo).not.toHaveProperty(campo);
    }
    expect((await get(e.adminA, `/api/productos/${e.id}`)).body).toHaveProperty('costo_compra');
    expect((await get(e.adminA, '/api/productos/barcode/7701234000011')).body.data).toHaveProperty('costo_compra');
  });

  it('GET /api/inventario/productos (la misma lista de productos): igual', async () => {
    const e = await escenario();
    const tendero = (await get(e.tenderoA, '/api/inventario/productos')).body.data[0];
    const admin = (await get(e.adminA, '/api/inventario/productos')).body.data[0];
    for (const campo of CAMPOS) {
      expect(tendero, campo).not.toHaveProperty(campo);
      expect(admin, campo).toHaveProperty(campo);
    }
  });
});
