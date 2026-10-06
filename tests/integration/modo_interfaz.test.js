/**
 * @file modo_interfaz.test.js
 * @description Modo básico web, fase A (plan 19, 3.4.3): `Usuarios.modo_interfaz` decide si la persona ve el menú
 * reducido ('basico') o el completo ('avanzado').
 *   - Migración: las cuentas que ya existían quedan en 'avanzado' (no se les reduce el menú de golpe el día del
 *     despliegue) y las cuentas nuevas nacen en 'basico'. Volver a correrla no cambia nada.
 *   - PATCH /api/perfil/modo-interfaz: cada quien cambia SOLO el suyo; valores fuera de la lista dan 400.
 *   - GET /api/session-info lo expone para que el frontend filtre el menú.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { crearUsuario } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { asegurarModoInterfaz } from '../../config/migraciones/modoInterfaz.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores();
});

const modoEnBase = async (id) => (await db.getAsync('SELECT modo_interfaz FROM Usuarios WHERE id_usuario = ?', [id])).modo_interfaz;

async function entrar(usuario) {
  const agente = request.agent(app);
  await iniciarSesion(agente, usuario);
  return { agente, csrf: await obtenerCsrfToken(agente) };
}

const cambiarModo = ({ agente, csrf }, cuerpo) =>
  agente.patch('/api/perfil/modo-interfaz').set('x-csrf-token', csrf).send(cuerpo);

describe('Migración de modo_interfaz', () => {
  it('las cuentas que ya existían quedan en avanzado y las nuevas nacen en basico', async () => {
    const vieja1 = await crearUsuario({ rol: 'Administrador' });
    const vieja2 = await crearUsuario({ rol: 'Tendero' });

    // Se deja la base como estaba ANTES de esta función: sin la columna ni su restricción.
    await db.pool.query('ALTER TABLE Usuarios DROP COLUMN modo_interfaz');
    await asegurarModoInterfaz(db.pool);

    expect(await modoEnBase(vieja1.id_usuario)).toBe('avanzado');
    expect(await modoEnBase(vieja2.id_usuario)).toBe('avanzado');

    const nueva = await crearUsuario({ rol: 'Administrador' });
    expect(await modoEnBase(nueva.id_usuario)).toBe('basico');
  });

  it('es idempotente: correrla otra vez no pisa lo que la persona ya eligió', async () => {
    const u = await crearUsuario({ rol: 'Administrador' }); // nace en basico
    const v = await crearUsuario({ rol: 'Administrador' });
    await db.runAsync("UPDATE Usuarios SET modo_interfaz = 'avanzado' WHERE id_usuario = ?", [v.id_usuario]);

    await asegurarModoInterfaz(db.pool);
    await asegurarModoInterfaz(db.pool);

    expect(await modoEnBase(u.id_usuario)).toBe('basico');
    expect(await modoEnBase(v.id_usuario)).toBe('avanzado');
  });

  it('la base rechaza un valor fuera de la lista (restricción CHECK)', async () => {
    const u = await crearUsuario({ rol: 'Administrador' });
    await expect(
      db.runAsync("UPDATE Usuarios SET modo_interfaz = 'experto' WHERE id_usuario = ?", [u.id_usuario])
    ).rejects.toThrow();
    expect(await modoEnBase(u.id_usuario)).toBe('basico');
  });

  it('una cuenta creada como colaborador por el Administrador también nace en basico', async () => {
    const admin = await crearUsuario({ rol: 'Administrador' });
    const colaborador = await crearUsuario({ rol: 'Tendero', id_tienda: admin.id_tienda });
    expect(await modoEnBase(colaborador.id_usuario)).toBe('basico');
  });
});

describe('PATCH /api/perfil/modo-interfaz', () => {
  it('cambia el modo de la propia cuenta, en los dos sentidos, y session-info lo refleja', async () => {
    const u = await crearUsuario({ rol: 'Administrador' });
    const sesion = await entrar(u);

    expect((await sesion.agente.get('/api/session-info')).body.modoInterfaz).toBe('basico');

    const res = await cambiarModo(sesion, { modo: 'avanzado' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, modoInterfaz: 'avanzado' });
    expect(await modoEnBase(u.id_usuario)).toBe('avanzado');
    expect((await sesion.agente.get('/api/session-info')).body.modoInterfaz).toBe('avanzado');

    expect((await cambiarModo(sesion, { modo: 'basico' })).status).toBe(200);
    expect(await modoEnBase(u.id_usuario)).toBe('basico');
  });

  it('el Colaborador (rol Tendero) también puede cambiar su propio modo', async () => {
    const u = await crearUsuario({ rol: 'Tendero' });
    const sesion = await entrar(u);
    expect((await cambiarModo(sesion, { modo: 'avanzado' })).status).toBe(200);
    expect(await modoEnBase(u.id_usuario)).toBe('avanzado');
  });

  it('solo cambia la cuenta de la sesión: un id_usuario en el cuerpo se ignora', async () => {
    const yo = await crearUsuario({ rol: 'Administrador' });
    const otro = await crearUsuario({ rol: 'Administrador' });
    const sesion = await entrar(yo);

    const res = await cambiarModo(sesion, { modo: 'avanzado', id_usuario: otro.id_usuario });
    expect(res.status).toBe(200);
    expect(await modoEnBase(yo.id_usuario)).toBe('avanzado');
    expect(await modoEnBase(otro.id_usuario)).toBe('basico');
  });

  it.each([
    ['un valor desconocido', { modo: 'experto' }],
    ['un texto con inyección SQL', { modo: "avanzado'; DROP TABLE Usuarios; --" }],
    ['un número', { modo: 1 }],
    ['una lista', { modo: ['avanzado'] }],
    ['null', { modo: null }],
    ['mayúsculas', { modo: 'AVANZADO' }],
    ['sin el campo', {}],
  ])('rechaza %s con 400 y no cambia nada', async (_nombre, cuerpo) => {
    const u = await crearUsuario({ rol: 'Administrador' });
    const sesion = await entrar(u);
    const res = await cambiarModo(sesion, cuerpo);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await modoEnBase(u.id_usuario)).toBe('basico');
  });

  it('sin sesión responde 401', async () => {
    const agente = request.agent(app);
    const csrf = await obtenerCsrfToken(agente);
    const res = await agente.patch('/api/perfil/modo-interfaz').set('x-csrf-token', csrf).send({ modo: 'avanzado' });
    expect(res.status).toBe(401);
  });

  it('sin token CSRF responde 403 CSRF_INVALID y no cambia nada', async () => {
    const u = await crearUsuario({ rol: 'Administrador' });
    const agente = request.agent(app);
    await iniciarSesion(agente, u);
    const res = await agente.patch('/api/perfil/modo-interfaz').send({ modo: 'avanzado' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
    expect(await modoEnBase(u.id_usuario)).toBe('basico');
  });

  it('GET /api/perfil incluye el modo (la pantalla de perfil lo muestra)', async () => {
    const u = await crearUsuario({ rol: 'Administrador' });
    const { agente } = await entrar(u);
    const res = await agente.get('/api/perfil');
    expect(res.status).toBe(200);
    expect(res.body.user.modo_interfaz).toBe('basico');
  });
});
