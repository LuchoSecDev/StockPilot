/**
 * @file limitador_olvido_contrasena.test.js
 * @description Rama feat/backend-app-tendero: `POST /api/forgot-password` no tenía límite efectivo (responde
 * 200 siempre y el authLimiter solo cuenta fallos): se podían enviar correos sin tope a un tercero, y cada
 * petición pisaba su código vigente. Ahora: 3 por correo y 10 por IP cada 15 min, contando TODAS las
 * peticiones, existan o no los correos (sin abrir una vía para enumerarlos).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { crearUsuario } from './helpers/fixtures.js';
import { obtenerCsrfToken } from './helpers/sesion.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores();
});

async function anonimo() {
  const agente = request.agent(app);
  return { agente, csrf: await obtenerCsrfToken(agente) };
}
const olvido = (s, email) => s.agente.post('/api/forgot-password').set('X-CSRF-Token', s.csrf).send({ email });

describe('forgot-password: límite por correo (3 cada 15 min)', () => {
  it('la 4.ª petición del mismo correo recibe 429, también si el correo NO existe (misma respuesta: no se enumera)', async () => {
    const s = await anonimo();
    for (let i = 0; i < 3; i++) expect((await olvido(s, 'nadie@ejemplo.com')).status).toBe(200);
    const cuarta = await olvido(s, 'nadie@ejemplo.com');
    expect(cuarta.status).toBe(429);
    expect(cuarta.body).toEqual({ success: false, error: expect.stringMatching(/15 minutos/) });
    expect(cuarta.headers['ratelimit-remaining']).toBe('0');
  });

  it('con un usuario real: las peticiones 4.ª en adelante no vuelven a pisar su código ni a enviar correo', async () => {
    const u = await crearUsuario({ rol: 'Tendero' });
    const s = await anonimo();
    for (let i = 0; i < 3; i++) await olvido(s, u.correo);
    const antes = (await db.getAsync('SELECT reset_token FROM Usuarios WHERE id_usuario = ?', [u.id_usuario])).reset_token;
    expect(antes).toMatch(/^\d{6}$/);

    for (let i = 0; i < 4; i++) expect((await olvido(s, u.correo)).status).toBe(429);
    const despues = (await db.getAsync('SELECT reset_token FROM Usuarios WHERE id_usuario = ?', [u.id_usuario])).reset_token;
    expect(despues).toBe(antes); // el código del usuario no se invalidó
  });

  it('el correo se normaliza (mayúsculas y espacios) para el contador; otro correo tiene su propio presupuesto', async () => {
    const s = await anonimo();
    // Las tres variantes cuentan como el MISMO correo (la de espacios el validador la rechaza con 400, pero gasta presupuesto igual).
    const estados = [];
    for (const v of ['A@ejemplo.com', 'a@ejemplo.com', '  A@EJEMPLO.COM  ']) estados.push((await olvido(s, v)).status);
    expect(estados).toEqual([200, 200, 400]);
    expect((await olvido(s, 'a@ejemplo.com')).status).toBe(429);
    expect((await olvido(s, 'b@ejemplo.com')).status).toBe(200);
  });

  it('un formato de correo inválido también gasta presupuesto (no es una vía libre para probar sin límite)', async () => {
    const s = await anonimo();
    for (let i = 0; i < 3; i++) expect((await olvido(s, 'no-es-correo')).status).toBe(400);
    expect((await olvido(s, 'no-es-correo')).status).toBe(429);
  });
});

describe('forgot-password: límite por IP (10 cada 15 min)', () => {
  it('la 11.ª petición desde la misma IP recibe 429 aunque cada una use un correo distinto', async () => {
    const s = await anonimo();
    for (let i = 0; i < 10; i++) expect((await olvido(s, `persona${i}@ejemplo.com`)).status, `petición ${i + 1}`).toBe(200);
    const undecima = await olvido(s, 'otra@ejemplo.com');
    expect(undecima.status).toBe(429);
    expect(undecima.body.success).toBe(false);
  });
});

describe('forgot-password: no afecta al resto del flujo de recuperación', () => {
  it('pedir el código una vez, verificarlo y restablecer funciona como antes', async () => {
    const u = await crearUsuario({ rol: 'Tendero' });
    const s = await anonimo();
    expect((await olvido(s, u.correo)).status).toBe(200);
    const { reset_token: codigo } = await db.getAsync('SELECT reset_token FROM Usuarios WHERE id_usuario = ?', [u.id_usuario]);
    const verificar = await s.agente.post('/api/verify-reset-code').set('X-CSRF-Token', s.csrf).send({ email: u.correo, code: codigo });
    expect(verificar.status).toBe(200);
    const restablecer = await s.agente.post('/api/reset-password').set('X-CSRF-Token', s.csrf).send({ email: u.correo, code: codigo, newPassword: 'NuevaClave456!' });
    expect(restablecer.status).toBe(200);
  });
});
