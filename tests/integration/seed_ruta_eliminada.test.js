/**
 * @file seed_ruta_eliminada.test.js
 * @description Hallazgo crítico (rama fix/seed-produccion): `POST /api/admin/seed` ejecutaba la
 * semilla, que hace TRUNCATE de toda la base (Usuarios y Tienda incluidas) y crea admin/admin123.
 * `requireAdmin` no protegía nada: el registro público crea Administradores. La ruta HTTP se eliminó;
 * la semilla solo existe como comando (`npm run seed`) con guardia (ver guardia_semilla.test.js).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

describe('POST /api/admin/seed', () => {
  it('con un Administrador responde 404 y no toca ni Tienda ni Usuarios ni Productos', async () => {
    const datos = await crearUsuario({ rol: 'Administrador' });
    await crearProducto({ id_tienda: datos.id_tienda });
    const agente = request.agent(app);
    await iniciarSesion(agente, datos);
    const csrfToken = await obtenerCsrfToken(agente);

    const contar = async () => ({
      tiendas: (await db.allAsync('SELECT id_tienda FROM Tienda ORDER BY id_tienda')).map(t => t.id_tienda),
      usuarios: (await db.allAsync('SELECT id_usuario, usuario FROM Usuarios ORDER BY id_usuario')),
      productos: (await db.allAsync('SELECT id_producto FROM Productos')).length
    });
    const antes = await contar();

    const res = await agente.post('/api/admin/seed').set('X-CSRF-Token', csrfToken);
    expect(res.status).toBe(404);

    expect(await contar()).toEqual(antes);
    expect(antes.tiendas).toEqual([datos.id_tienda]);
    // Y sigue siendo la misma cuenta: no apareció ningún admin/admin123 del seeder.
    expect(antes.usuarios.map(u => u.usuario)).not.toContain('admin');
  });

  it('sin sesión (con un token CSRF válido, que se obtiene sin iniciar sesión) no ejecuta nada', async () => {
    const tienda = await crearUsuario({ rol: 'Administrador' }); // datos que NO deben desaparecer
    const agente = request.agent(app);
    const csrfToken = await obtenerCsrfToken(agente);
    const res = await agente.post('/api/admin/seed').set('X-CSRF-Token', csrfToken);
    // Sin sesión, un filtro global de requireLogin redirige (302) antes de llegar al 404.
    expect([302, 401, 404]).toContain(res.status);
    const tiendas = await db.allAsync('SELECT id_tienda FROM Tienda');
    expect(tiendas.map(t => t.id_tienda)).toEqual([tienda.id_tienda]);
  });
});
