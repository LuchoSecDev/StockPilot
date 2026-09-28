/**
 * @file exports_por_tienda.test.js
 * @description Hallazgo C6 (rama fix/exports-por-tienda): las exportaciones de ventas y reportes se
 * guardaban en una carpeta COMPARTIDA por todas las tiendas, `GET /api/exportar/archivos` las listaba
 * todas y `GET /api/exportar/descargar/:filename` servía cualquiera a cualquier usuario con sesión
 * (confirmado: un Tendero de la tienda B descargó el export de ventas de la tienda A).
 * Ahora: el id de la tienda va en el nombre, se verifica al descargar (404 si no coincide), la ruta
 * de listado no existe y el archivo se borra en cuanto se descarga.
 */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearProducto } from './helpers/fixtures.js';
import { dosTiendas } from './helpers/tiendas.js';

const CARPETA = process.env.EXPORTS_DIR;

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

async function conVenta(tienda) {
  const idProducto = await crearProducto({ id_tienda: tienda.id_tienda, nombre_producto: 'VENTA SECRETA', precio: 1000 });
  const v = await db.runAsync('INSERT INTO Ventas (id_vendedor, id_tienda, fecha_salida, precio_total) VALUES (?, ?, CURRENT_TIMESTAMP, 5000) RETURNING id_venta', [tienda.id_usuario, tienda.id_tienda]);
  await db.runAsync('INSERT INTO VentasProductos (id_venta, id_producto, cantidad) VALUES (?, ?, 5)', [v.lastID, idProducto]);
}
async function exportarVentas(sesion) {
  const res = await sesion.agente.post('/api/exportar/ventas').set('X-CSRF-Token', sesion.csrfToken);
  expect(res.status).toBe(200);
  return res.body.filename;
}
const esperarBorrado = async (archivo) => {
  for (let i = 0; i < 20 && fs.existsSync(archivo); i++) await new Promise((r) => setTimeout(r, 50));
  return !fs.existsSync(archivo);
};

describe('C6. Exportaciones: aisladas por tienda y de un solo uso', () => {
  it('la carpeta de las pruebas es temporal, no la del proyecto', () => {
    expect(CARPETA).toBeTruthy();
    expect(path.resolve(CARPETA)).not.toBe(path.resolve('exports'));
  });

  it('el nombre del archivo lleva el id de la tienda', async () => {
    const { adminA } = await dosTiendas(app);
    await conVenta(adminA);
    const nombre = await exportarVentas(adminA);
    expect(nombre).toMatch(new RegExp(`^ventas_t${adminA.id_tienda}_[0-9A-Za-z_-]+\\.xlsx$`));
    expect(fs.existsSync(path.join(CARPETA, nombre))).toBe(true);
  });

  it('otra tienda no puede descargarlo (404) y el archivo sigue en su sitio', async () => {
    const { adminA, adminB, tenderoB } = await dosTiendas(app);
    await conVenta(adminA);
    const nombre = await exportarVentas(adminA);

    for (const intruso of [adminB, tenderoB]) {
      const res = await intruso.agente.get(`/api/exportar/descargar/${nombre}`);
      expect(res.status).toBe(404);
    }
    expect(fs.existsSync(path.join(CARPETA, nombre))).toBe(true);
  });

  it('la tienda dueña lo descarga y el archivo se borra al terminar; una segunda descarga da 404', async () => {
    const { adminA } = await dosTiendas(app);
    await conVenta(adminA);
    const nombre = await exportarVentas(adminA);

    const res = await adminA.agente.get(`/api/exportar/descargar/${nombre}`).buffer(true).parse((r, cb) => {
      const trozos = [];
      r.on('data', (t) => trozos.push(t));
      r.on('end', () => cb(null, Buffer.concat(trozos)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain(nombre);
    expect(res.body.length).toBeGreaterThan(1000); // un .xlsx real, no un error
    expect(await esperarBorrado(path.join(CARPETA, nombre))).toBe(true);

    const otra = await adminA.agente.get(`/api/exportar/descargar/${nombre}`);
    expect(otra.status).toBe(404);
  });

  it('los reportes exportados también llevan la tienda y se aíslan igual', async () => {
    const { adminA, adminB } = await dosTiendas(app);
    await db.runAsync("INSERT INTO reportes (titulo, descripcion, fecha_reporte, creador, tipo, id_tienda) VALUES ('R', 'd', '2026-01-01', 'x', 'Inventario', ?)", [adminA.id_tienda]);
    const exp = await adminA.agente.post('/api/exportar/reportes').set('X-CSRF-Token', adminA.csrfToken);
    expect(exp.status).toBe(200);
    expect(exp.body.filename).toMatch(new RegExp(`^reportes_t${adminA.id_tienda}_[0-9A-Za-z_-]+\\.csv$`));

    expect((await adminB.agente.get(`/api/exportar/descargar/${exp.body.filename}`)).status).toBe(404);
    expect((await adminA.agente.get(`/api/exportar/descargar/${exp.body.filename}`)).status).toBe(200);
  });

  it('GET /api/exportar/archivos ya no existe (listaba los archivos de todas las tiendas)', async () => {
    const { adminA } = await dosTiendas(app);
    const res = await adminA.agente.get('/api/exportar/archivos').set('Accept', 'application/json');
    expect(res.status).toBe(404);
  });

  it('nombres con formato antiguo, con recorrido de carpetas o inventados dan 404 y no leen nada', async () => {
    const { adminA } = await dosTiendas(app);
    // Un archivo con el formato ANTIGUO (sin tienda) que existe en la carpeta: ya no se sirve.
    fs.writeFileSync(path.join(CARPETA, 'ventas_2026-01-01_10-00-00_abc123.xlsx'), 'contenido antiguo');
    for (const nombre of [
      'ventas_2026-01-01_10-00-00_abc123.xlsx',
      '..%2F..%2Fpackage.json',
      '..%5C..%5Cpackage.json',
      `ventas_t${adminA.id_tienda}_../../package.json`,
      `ventas_t${adminA.id_tienda}_inexistente.xlsx`
    ]) {
      const res = await adminA.agente.get(`/api/exportar/descargar/${nombre}`);
      expect(res.status, nombre).toBe(404);
    }
  });

  it('al exportar se barren los archivos (formato nuevo) que nadie descargó en más de una hora; los demás no se tocan', async () => {
    const { adminA } = await dosTiendas(app);
    await conVenta(adminA);
    const viejo = path.join(CARPETA, 'ventas_t999_2026-01-01_10-00-00_zzzzzz.xlsx');
    const reciente = path.join(CARPETA, 'ventas_t999_2026-01-01_10-00-01_yyyyyy.xlsx');
    const ajeno = path.join(CARPETA, 'notas_del_equipo.txt');
    for (const f of [viejo, reciente, ajeno]) fs.writeFileSync(f, 'x');
    const hace2Horas = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(viejo, hace2Horas, hace2Horas);
    fs.utimesSync(ajeno, hace2Horas, hace2Horas);

    await exportarVentas(adminA);

    expect(fs.existsSync(viejo)).toBe(false);
    expect(fs.existsSync(reciente)).toBe(true);
    expect(fs.existsSync(ajeno)).toBe(true);
    for (const f of [reciente, ajeno]) fs.rmSync(f, { force: true });
  });
});
