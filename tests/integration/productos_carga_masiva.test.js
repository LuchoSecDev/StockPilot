/**
 * @file productos_carga_masiva.test.js
 * @description Pruebas de caracterización (plan 21, R0): carga masiva de productos por archivo
 * (.csv y .xlsx), incluida la importación real desde un .xlsx generado en memoria con ExcelJS
 * (mismo paquete que usa `productController.bulkUpload`), vía `supertest .attach()`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';

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

/** Construye un .xlsx real en memoria con ExcelJS (mismo formato que produciría Excel/Sheets). */
async function construirXlsx(filas, headers = ['Código', 'Nombre', 'Precio', 'Costo', 'Cantidad', 'Categoría']) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Productos');
  sheet.addRow(headers);
  filas.forEach((f) => sheet.addRow(f));
  return await workbook.xlsx.writeBuffer();
}

describe('Productos: carga masiva (.xlsx y .csv)', () => {
  it('.xlsx: crea productos nuevos con las columnas mínimas (Código y Nombre)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado();
    const buffer = await construirXlsx([
      ['SKU-001', 'Arroz Diana 500g', 3500, 2800, 40, 'Abarrotes'],
      ['SKU-002', 'Aceite Girasol 1L', 9000, 7200, 15, 'Abarrotes'],
    ]);

    const res = await agente.post('/api/productos/bulk').set('X-CSRF-Token', csrfToken)
      .attach('file', Buffer.from(buffer), 'productos.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processed).toBe(2);
    expect(res.body.warnings).toEqual([]);

    const filas = await db.allAsync('SELECT codigo, nombre_producto, cantidad FROM Productos WHERE id_tienda = ? ORDER BY codigo', [id_tienda]);
    expect(filas.length).toBe(2);
    expect(filas[0].nombre_producto).toBe('Arroz Diana 500g');
  });

  it('.xlsx: una fila con el mismo código que un producto existente lo ACTUALIZA (upsert), no crea un duplicado', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado();
    const primero = await construirXlsx([['SKU-100', 'Producto Original', 1000, 700, 5, 'General']]);
    await agente.post('/api/productos/bulk').set('X-CSRF-Token', csrfToken).attach('file', Buffer.from(primero), 'p1.xlsx');

    const segundo = await construirXlsx([['SKU-100', 'Producto Renombrado', 1200, 800, 9, 'General']]);
    const res = await agente.post('/api/productos/bulk').set('X-CSRF-Token', csrfToken).attach('file', Buffer.from(segundo), 'p2.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    const filas = await db.allAsync('SELECT codigo, nombre_producto, cantidad FROM Productos WHERE id_tienda = ?', [id_tienda]);
    expect(filas.length).toBe(1); // no duplicó
    expect(filas[0].nombre_producto).toBe('Producto Renombrado');
    expect(filas[0].cantidad).toBe(9);
  });

  it('.csv: mismo comportamiento que .xlsx (crea productos nuevos)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado();
    const csv = 'Codigo,Nombre,Precio,Costo,Cantidad,Categoria\nSKU-200,Gaseosa 1.5L,4500,3200,20,Bebidas\n';

    const res = await agente.post('/api/productos/bulk').set('X-CSRF-Token', csrfToken)
      .attach('file', Buffer.from(csv, 'utf8'), 'productos.csv');

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    const filas = await db.allAsync('SELECT nombre_producto FROM Productos WHERE id_tienda = ?', [id_tienda]);
    expect(filas.length).toBe(1);
    expect(filas[0].nombre_producto).toBe('Gaseosa 1.5L');
  });

  it('.xlsx: una fila sin Código o sin Nombre se OMITE con una advertencia, no rompe el resto del archivo', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado();
    const buffer = await construirXlsx([
      ['SKU-300', 'Producto Válido', 1000, 700, 5, 'General'],
      ['', 'Sin Código', 1000, 700, 5, 'General'],
    ]);

    const res = await agente.post('/api/productos/bulk').set('X-CSRF-Token', csrfToken).attach('file', Buffer.from(buffer), 'productos.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
    expect(res.body.warnings.length).toBe(1);
    expect(res.body.warnings[0]).toMatch(/Falta Código o Nombre/i);

    const filas = await db.allAsync('SELECT codigo FROM Productos WHERE id_tienda = ?', [id_tienda]);
    expect(filas.length).toBe(1);
  });

  it('.xlsx: una fila con precio o cantidad negativos se OMITE con una advertencia', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado();
    const buffer = await construirXlsx([['SKU-400', 'Producto Con Precio Negativo', -100, 50, 5, 'General']]);

    const res = await agente.post('/api/productos/bulk').set('X-CSRF-Token', csrfToken).attach('file', Buffer.from(buffer), 'productos.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(0);
    expect(res.body.warnings.length).toBe(1);
    expect(res.body.warnings[0]).toMatch(/negativos/i);

    const filas = await db.allAsync('SELECT codigo FROM Productos WHERE id_tienda = ?', [id_tienda]);
    expect(filas.length).toBe(0);
  });

  it('un formato no soportado (.txt) da 400 sin llegar a leer el contenido', async () => {
    const { agente, csrfToken } = await agenteLogueado();
    const res = await agente.post('/api/productos/bulk').set('X-CSRF-Token', csrfToken)
      .attach('file', Buffer.from('cualquier cosa'), 'productos.txt');
    expect(res.status).toBe(400);
  });

  it('sin ninguna columna de Código/Nombre en el encabezado: 400 explícito', async () => {
    const { agente, csrfToken } = await agenteLogueado();
    const buffer = await construirXlsx([[100, 5]], ['Precio', 'Cantidad']);
    const res = await agente.post('/api/productos/bulk').set('X-CSRF-Token', csrfToken).attach('file', Buffer.from(buffer), 'productos.xlsx');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Código.*Nombre/i);
  });

  it('sin ningún archivo adjunto: 400 (el mensaje viene de validateFileType, no del chequeo propio de bulkUpload — ese queda inalcanzable por esta ruta)', async () => {
    const { agente, csrfToken } = await agenteLogueado();
    const res = await agente.post('/api/productos/bulk').set('X-CSRF-Token', csrfToken).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/debe subir un archivo/i);
  });
});
