/**
 * @file link_barcode.test.js
 * @description Rama feat/backend-app-tendero: `PUT /api/productos/:id/link-barcode` dejaba asignar a un
 * producto un código que ya tenía OTRO de la tienda (quedaba duplicado y `GET /productos/barcode/:code`
 * devolvía uno cualquiera). Ahora: 409 BARCODE_DUPLICADO. Un código identifica a un solo producto por
 * tienda, y se comprueban las dos columnas que usa la búsqueda (codigo_barras y codigo/SKU).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearProducto } from './helpers/fixtures.js';
import { dosTiendas } from './helpers/tiendas.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

async function escenario() {
  const t = await dosTiendas(app);
  const arroz = await crearProducto({ id_tienda: t.adminA.id_tienda, nombre_producto: 'Arroz', codigo: 'SKU-ARROZ', codigo_barras: '7701234000011' });
  const leche = await crearProducto({ id_tienda: t.adminA.id_tienda, nombre_producto: 'Leche', codigo: 'SKU-LECHE' });
  const vincular = (s, id, codigo_barras) => s.agente.put(`/api/productos/${id}/link-barcode`).set('X-CSRF-Token', s.csrfToken).send({ codigo_barras });
  const codigoDe = async (id) => (await db.getAsync('SELECT codigo_barras FROM Productos WHERE id_producto = ?', [id])).codigo_barras;
  return { ...t, arroz, leche, vincular, codigoDe };
}

describe('link-barcode: un código identifica a un solo producto por tienda', () => {
  it('un código nuevo se vincula (200) y el producto queda con él', async () => {
    const e = await escenario();
    const r = await e.vincular(e.tenderoA, e.leche, '7701234000099');
    expect(r.status).toBe(200);
    expect(await e.codigoDe(e.leche)).toBe('7701234000099');
  });

  it('un código que ya tiene OTRO producto de la tienda da 409 con el nombre del dueño, y no cambia nada', async () => {
    const e = await escenario();
    const r = await e.vincular(e.tenderoA, e.leche, '7701234000011'); // el del Arroz
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ success: false, code: 'BARCODE_DUPLICADO', error: 'Ese código ya pertenece a «Arroz».' });
    expect(await e.codigoDe(e.leche)).toBeNull();
    expect(await e.codigoDe(e.arroz)).toBe('7701234000011');
  });

  it('también choca con el SKU (columna codigo) de otro producto, porque la búsqueda por código mira las dos columnas', async () => {
    const e = await escenario();
    const r = await e.vincular(e.tenderoA, e.leche, 'SKU-ARROZ');
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/«Arroz»/);
  });

  it('vincular de nuevo el MISMO código al MISMO producto es válido (idempotente: un reintento de la app no falla)', async () => {
    const e = await escenario();
    expect((await e.vincular(e.tenderoA, e.arroz, '7701234000011')).status).toBe(200);
    expect((await e.vincular(e.tenderoA, e.arroz, '7701234000011')).status).toBe(200);
  });

  it('el mismo código en OTRA tienda es válido (la unicidad es por tienda)', async () => {
    const e = await escenario();
    const deB = await crearProducto({ id_tienda: e.adminB.id_tienda, nombre_producto: 'De B' });
    expect((await e.vincular(e.tenderoB, deB, '7701234000011')).status).toBe(200);
    expect(await e.codigoDe(e.arroz)).toBe('7701234000011');
  });

  it('el código se recorta (espacios) y acepta un número; el recortado también cuenta para el duplicado', async () => {
    const e = await escenario();
    expect((await e.vincular(e.tenderoA, e.leche, '  7701234000099  ')).status).toBe(200);
    expect(await e.codigoDe(e.leche)).toBe('7701234000099');
    const conNumero = await crearProducto({ id_tienda: e.adminA.id_tienda, nombre_producto: 'Pan' });
    expect((await e.vincular(e.tenderoA, conNumero, 7701234000123)).status).toBe(200);
    expect(await e.codigoDe(conNumero)).toBe('7701234000123');
    expect((await e.vincular(e.tenderoA, e.arroz, ' 7701234000099 ')).status).toBe(409);
  });

  it('400 con código ausente, vacío, solo espacios, de otro tipo o de más de 50 caracteres (antes, el largo daba 500)', async () => {
    const e = await escenario();
    for (const codigo of [undefined, '', '   ', null, {}, ['1']]) {
      const r = await e.vincular(e.tenderoA, e.leche, codigo);
      expect(r.status, JSON.stringify(codigo)).toBe(400);
      expect(r.body).toEqual({ success: false, error: 'Código de barras es requerido' });
    }
    const largo = await e.vincular(e.tenderoA, e.leche, '1'.repeat(51));
    expect(largo.status).toBe(400);
    expect(largo.body.error).toMatch(/50 caracteres/);
    expect((await e.vincular(e.tenderoA, e.leche, '1'.repeat(50))).status).toBe(200);
  });

  it('404 si el producto no existe o es de otra tienda (y no se toca)', async () => {
    const e = await escenario();
    expect((await e.vincular(e.tenderoA, 99999, '123')).status).toBe(404);
    expect((await e.vincular(e.tenderoB, e.leche, '123')).status).toBe(404);
    expect(await e.codigoDe(e.leche)).toBeNull();
  });

  it('dos productos que piden el MISMO código a la vez: uno gana (200) y el otro recibe 409 (no quedan duplicados)', async () => {
    for (let ronda = 0; ronda < 3; ronda++) {
      await limpiarBaseDePruebas();
      const e = await escenario();
      const otro = await crearProducto({ id_tienda: e.adminA.id_tienda, nombre_producto: 'Otro' });
      const [a, b] = await Promise.all([e.vincular(e.tenderoA, e.leche, '7709999999999'), e.vincular(e.tenderoA, otro, '7709999999999')]);
      expect([a.status, b.status].sort(), `ronda ${ronda}`).toEqual([200, 409]);
      const filas = await db.allAsync("SELECT id_producto FROM Productos WHERE codigo_barras = '7709999999999'");
      expect(filas).toHaveLength(1);
    }
  });
});
