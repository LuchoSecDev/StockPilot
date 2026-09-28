/**
 * @file tienda_permisos.test.js
 * @description Plan 22, fase I0 (hallazgo 1.4): `PUT /api/tienda/update/:id` y
 * `PUT /api/tienda/estado/:id` solo pedían `requireLogin`, sin `requireAdmin`. Los controladores
 * verifican que la tienda sea la del usuario, pero no su rol — un Tendero de esa tienda podía,
 * desde la API (aunque la interfaz no le muestre el botón), cambiar los datos del negocio, subir
 * su propio `limite_egreso_tendero` o desactivar la tienda. Este archivo confirma que el arreglo
 * (`requireAdmin` agregado a las dos rutas) bloquea al Tendero y no rompe al Administrador.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
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

describe('Permisos de tienda (plan 22, fase I0)', () => {
  it('Tendero: PUT /api/tienda/update/:id da 403 y no modifica la tienda', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Tendero' });

    const original = await db.getAsync('SELECT nombre_establecimiento, limite_egreso_tendero FROM Tienda WHERE id_tienda = ?', [id_tienda]);

    const res = await agente.put(`/api/tienda/update/${id_tienda}`).set('X-CSRF-Token', csrfToken)
      .send({ nombre_establecimiento: 'Hackeado', limite_egreso_tendero: 99999999 });

    expect(res.status).toBe(403);
    // requireAdmin responde {error: "..."} (no {success:false, ...} como los controladores).
    expect(res.body.error).toMatch(/administrador/i);

    const tras = await db.getAsync('SELECT nombre_establecimiento, limite_egreso_tendero FROM Tienda WHERE id_tienda = ?', [id_tienda]);
    expect(tras.nombre_establecimiento).toBe(original.nombre_establecimiento);
    expect(Number(tras.limite_egreso_tendero)).toBe(Number(original.limite_egreso_tendero));
  });

  it('Tendero: PUT /api/tienda/estado/:id da 403 y no desactiva la tienda', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Tendero' });

    const res = await agente.put(`/api/tienda/estado/${id_tienda}`).set('X-CSRF-Token', csrfToken).send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/administrador/i);

    const tras = await db.getAsync('SELECT estado FROM Tienda WHERE id_tienda = ?', [id_tienda]);
    expect(tras.estado).toBe('Activo');
  });

  it('Administrador: PUT /api/tienda/update/:id sigue funcionando (200, cambio real)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });

    const res = await agente.put(`/api/tienda/update/${id_tienda}`).set('X-CSRF-Token', csrfToken)
      .send({ nombre_establecimiento: 'Tienda Renombrada' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const tras = await db.getAsync('SELECT nombre_establecimiento FROM Tienda WHERE id_tienda = ?', [id_tienda]);
    expect(tras.nombre_establecimiento).toBe('Tienda Renombrada');
  });

  it('Administrador: PUT /api/tienda/estado/:id sigue funcionando (200, la desactiva)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado({ rol: 'Administrador' });

    const res = await agente.put(`/api/tienda/estado/${id_tienda}`).set('X-CSRF-Token', csrfToken).send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const tras = await db.getAsync('SELECT estado FROM Tienda WHERE id_tienda = ?', [id_tienda]);
    expect(tras.estado).toBe('Inactivo');
  });
});
