/**
 * @file aislamiento_reportes.test.js
 * @description Hallazgo C1 (rama fix/aislamiento-reportes-feedback): PUT/DELETE /api/reportes/:id y GET /api/reportes/download/:id filtraban solo por `id`, así que cualquier usuario editaba, borraba o descargaba el reporte de CUALQUIER tienda (confirmado ejecutándolo). Ahora: 404 entre tiendas y PUT/DELETE solo para el Administrador.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import app from '../../app.js';
import { dosTiendas } from './helpers/tiendas.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

const cuerpoReporte = (titulo) => ({ titulo, descripcion: 'd', fecha_reporte: '2026-01-01', creador: 'x', tipo: 'Inventario' });

async function reporteDe(tienda, titulo = 'Reporte original') {
  const r = await db.runAsync(
    "INSERT INTO reportes (titulo, descripcion, fecha_reporte, creador, tipo, id_tienda) VALUES (?, 'd', '2026-01-01', 'x', 'Inventario', ?) RETURNING id",
    [titulo, tienda.id_tienda]
  );
  return r.lastID;
}
const filaReporte = (id) => db.getAsync('SELECT titulo FROM reportes WHERE id = ?', [id]);

describe('C1. Reportes: aislamiento entre tiendas y solo Administrador para editar/borrar', () => {
  it('el Administrador de la tienda edita y borra su propio reporte', async () => {
    const { adminA } = await dosTiendas(app);
    const id = await reporteDe(adminA);

    const put = await adminA.agente.put(`/api/reportes/${id}`).set('X-CSRF-Token', adminA.csrfToken).send(cuerpoReporte('Editado por su dueño'));
    expect(put.status).toBe(200);
    expect((await filaReporte(id)).titulo).toBe('Editado por su dueño');

    const del = await adminA.agente.delete(`/api/reportes/${id}`).set('X-CSRF-Token', adminA.csrfToken);
    expect(del.status).toBe(200);
    expect(await filaReporte(id)).toBeUndefined();
  });

  it('un Tendero, ni siquiera de la misma tienda, puede editar o borrar reportes: 403 y la fila no cambia', async () => {
    const { adminA, tenderoA } = await dosTiendas(app);
    const id = await reporteDe(adminA);

    const put = await tenderoA.agente.put(`/api/reportes/${id}`).set('X-CSRF-Token', tenderoA.csrfToken).send(cuerpoReporte('Pisado'));
    const del = await tenderoA.agente.delete(`/api/reportes/${id}`).set('X-CSRF-Token', tenderoA.csrfToken);
    expect(put.status).toBe(403);
    expect(del.status).toBe(403);
    expect((await filaReporte(id)).titulo).toBe('Reporte original');
  });

  it('el Administrador de OTRA tienda no puede editar, borrar ni descargar el reporte: 404 y la fila no cambia', async () => {
    const { adminA, adminB } = await dosTiendas(app);
    const id = await reporteDe(adminA);

    const put = await adminB.agente.put(`/api/reportes/${id}`).set('X-CSRF-Token', adminB.csrfToken).send(cuerpoReporte('Pisado por B'));
    const del = await adminB.agente.delete(`/api/reportes/${id}`).set('X-CSRF-Token', adminB.csrfToken);
    const descarga = await adminB.agente.get(`/api/reportes/download/${id}`);
    expect(put.status).toBe(404);
    expect(del.status).toBe(404);
    expect(descarga.status).toBe(404);
    expect((await filaReporte(id)).titulo).toBe('Reporte original');
  });

  it('la tienda dueña sí descarga su reporte', async () => {
    const { adminA } = await dosTiendas(app);
    const id = await reporteDe(adminA);
    const descarga = await adminA.agente.get(`/api/reportes/download/${id}`);
    expect(descarga.status).toBe(200);
  });

  it('un id que no existe o no es numérico da 404, no 500', async () => {
    const { adminA } = await dosTiendas(app);
    for (const id of ['999999', 'abc']) {
      const put = await adminA.agente.put(`/api/reportes/${id}`).set('X-CSRF-Token', adminA.csrfToken).send(cuerpoReporte('x'));
      const del = await adminA.agente.delete(`/api/reportes/${id}`).set('X-CSRF-Token', adminA.csrfToken);
      const descarga = await adminA.agente.get(`/api/reportes/download/${id}`);
      expect([put.status, del.status, descarga.status], id).toEqual([404, 404, 404]);
    }
  });
});
