/**
 * @file carga_masiva_alertas.test.js
 * @description 10-oct-2026. La carga masiva de productos (POST /api/productos/bulk) no recalculaba las alertas: el tendero
 * cargaba su catálogo de golpe y el Monitor quedaba vacío hasta la primera venta, aunque hubiera productos agotados. Crear
 * o editar UN producto sí las recalculaba (productController, post-creación y post-edición). Aquí se comprueba que la carga
 * masiva también lo hace, solo para la tienda que cargó, y que el archivo se procesa igual con el motor apagado.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

async function agenteLogueado() {
  const usuario = await crearUsuario({ rol: 'Administrador' });
  const agente = request.agent(app);
  await iniciarSesion(agente, usuario);
  return { agente, csrf: await obtenerCsrfToken(agente), ...usuario };
}

async function xlsx(filas) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Productos');
  hoja.addRow(['Código', 'Nombre', 'Precio', 'Costo', 'Cantidad', 'Categoría']);
  filas.forEach((f) => hoja.addRow(f));
  return Buffer.from(await libro.xlsx.writeBuffer());
}

const subir = (t, buffer) => t.agente.post('/api/productos/bulk').set('X-CSRF-Token', t.csrf).attach('file', buffer, 'productos.xlsx');
const alertasGuardadas = (id_tienda) => db.allAsync('SELECT tipo FROM Alertas WHERE id_tienda = ? AND resuelta = 0', [id_tienda]);

describe('carga masiva: recalcula las alertas de la tienda', () => {
  it('un producto agotado cargado en bloque genera su alerta de stock crítico (sin esperar una venta ni pulsar el botón)', async () => {
    const t = await agenteLogueado();
    expect(await alertasGuardadas(t.id_tienda)).toHaveLength(0);

    const res = await subir(t, await xlsx([
      ['SKU-1', 'Arroz agotado', 4500, 3200, 0, 'Abarrotes'],
      ['SKU-2', 'Sal con stock', 1500, 900, 80, 'Abarrotes'],
    ]));
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(2);

    await esperarTrabajoEnSegundoPlano(); // el recálculo va en segundo plano, como en crear o editar un producto
    const filas = await db.allAsync(
      `SELECT p.nombre_producto, a.tipo FROM Alertas a JOIN Productos p ON p.id_producto = a.id_producto WHERE a.id_tienda = ? AND a.resuelta = 0`, [t.id_tienda]);
    expect(filas).toEqual([{ nombre_producto: 'Arroz agotado', tipo: 'stock_critico' }]);
  });

  it('solo recalcula la tienda que cargó: la de otro dueño sigue como estaba', async () => {
    const t = await agenteLogueado();
    const ajena = await crearUsuario({ rol: 'Administrador' });
    await subir(t, await xlsx([['SKU-1', 'Arroz agotado', 4500, 3200, 0, 'Abarrotes']]));
    await esperarTrabajoEnSegundoPlano();
    expect(await alertasGuardadas(t.id_tienda)).toHaveLength(1);
    expect(await alertasGuardadas(ajena.id_tienda)).toHaveLength(0);
  });

  it('con el motor apagado (DISABLE_ALERT_ENGINE=true) el archivo se procesa igual y no se generan alertas', async () => {
    const t = await agenteLogueado();
    const anterior = process.env.DISABLE_ALERT_ENGINE;
    process.env.DISABLE_ALERT_ENGINE = 'true';
    try {
      const res = await subir(t, await xlsx([['SKU-1', 'Arroz agotado', 4500, 3200, 0, 'Abarrotes']]));
      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(1);
      await esperarTrabajoEnSegundoPlano();
    } finally {
      if (anterior === undefined) delete process.env.DISABLE_ALERT_ENGINE; else process.env.DISABLE_ALERT_ENGINE = anterior;
    }
    expect(await alertasGuardadas(t.id_tienda)).toHaveLength(0);
  });

  it('un archivo sin ninguna fila válida no recalcula nada (no hubo cambios)', async () => {
    const t = await agenteLogueado();
    // Una alerta vieja y «falsa» a mano: si el recálculo corriera, la resolvería (el producto ya no existe como crítico).
    const idProducto = (await db.runAsync(
      `INSERT INTO Productos (codigo, nombre_producto, precio, cantidad, id_tienda) VALUES ('X', 'Sano', 1000, 500, ?) RETURNING id_producto`, [t.id_tienda])).lastID;
    await db.runAsync(`INSERT INTO Alertas (id_producto, id_tienda, tipo, severidad, mensaje, resuelta) VALUES (?, ?, 'stock_critico', 'critico', 'vieja', 0)`, [idProducto, t.id_tienda]);

    const res = await subir(t, await xlsx([['', '', 0, 0, 0, '']])); // sin código ni nombre
    expect(res.body.processed).toBe(0);
    await esperarTrabajoEnSegundoPlano();
    expect((await alertasGuardadas(t.id_tienda)).map((a) => a.tipo)).toEqual(['stock_critico']); // la vieja sigue ahí
  });
});
