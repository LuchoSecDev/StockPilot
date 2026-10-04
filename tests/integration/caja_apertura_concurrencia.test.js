/**
 * @file caja_apertura_concurrencia.test.js
 * @description Backend para la app nativa del Tendero (rama feat/backend-app-tendero, punto 4; plan 21,
 * punto 2.4 / P21-14): `openSession` hacía SELECT y luego INSERT sin transacción, así que dos aperturas
 * simultáneas del mismo vendedor (la app que reintenta, un doble toque) podían abrir DOS cajas y
 * descuadrar el arqueo. Ahora la comprobación y el INSERT van en una transacción con un bloqueo por
 * vendedor (pg_advisory_xact_lock): exactamente una gana, las demás reciben 400.
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

async function vendedor(overrides = {}) {
  const datos = await crearUsuario({ rol: 'Tendero', ...overrides });
  const agente = request.agent(app);
  await iniciarSesion(agente, datos);
  return { agente, csrfToken: await obtenerCsrfToken(agente), ...datos };
}
const abrir = (v, monto = 50000) => v.agente.post('/api/caja/abrir').set('X-CSRF-Token', v.csrfToken).send({ monto_apertura: monto });
const cajasAbiertas = async (id_vendedor) =>
  Number((await db.getAsync("SELECT COUNT(*) AS n FROM SesionCaja WHERE id_vendedor = ? AND LOWER(estado) = 'abierta'", [id_vendedor])).n);

describe('Apertura de caja: atómica por vendedor', () => {
  it('20 aperturas simultáneas del mismo vendedor: exactamente una gana (200) y las demás reciben 400', async () => {
    const v = await vendedor();
    const respuestas = await Promise.all(Array.from({ length: 20 }, () => abrir(v)));

    const estados = respuestas.map((r) => r.status);
    expect(estados.filter((s) => s === 200)).toHaveLength(1);
    expect(estados.filter((s) => s === 400)).toHaveLength(19);
    expect(estados.filter((s) => s === 500)).toHaveLength(0);
    expect(await cajasAbiertas(v.id_usuario)).toBe(1);
    respuestas.filter((r) => r.status === 400).forEach((r) => expect(r.body.error).toMatch(/ya tienes una sesión de caja abierta/i));
  });

  it('repetido 5 veces con lotes de 12 (para atrapar una carrera intermitente): nunca hay más de una caja abierta', async () => {
    for (let ronda = 0; ronda < 5; ronda++) {
      const v = await vendedor();
      await Promise.all(Array.from({ length: 12 }, () => abrir(v)));
      expect(await cajasAbiertas(v.id_usuario), `ronda ${ronda}`).toBe(1);
    }
  });

  it('dos vendedores de la MISMA tienda abren a la vez: las dos cajas se abren (el bloqueo es por vendedor)', async () => {
    const a = await vendedor();
    const b = await vendedor({ id_tienda: a.id_tienda });
    const [ra, rb] = await Promise.all([abrir(a), abrir(b)]);
    expect([ra.status, rb.status]).toEqual([200, 200]);
    expect(await cajasAbiertas(a.id_usuario)).toBe(1);
    expect(await cajasAbiertas(b.id_usuario)).toBe(1);
  });

  it('cerrar y volver a abrir sigue funcionando; la sesión nueva queda abierta', async () => {
    const v = await vendedor();
    expect((await abrir(v)).status).toBe(200);
    const cierre = await v.agente.post('/api/caja/cerrar').set('X-CSRF-Token', v.csrfToken).send({ monto_cierre_declarado: 50000 });
    expect(cierre.status).toBe(200);
    expect((await abrir(v, 20000)).status).toBe(200);
    expect(await cajasAbiertas(v.id_usuario)).toBe(1);
  });

  it('la respuesta de éxito trae el id_sesion de la caja realmente creada', async () => {
    const v = await vendedor();
    const r = await abrir(v, 12345);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true });
    const fila = await db.getAsync('SELECT monto_apertura, id_tienda, id_vendedor FROM SesionCaja WHERE id_sesion = ?', [r.body.id_sesion]);
    expect(Number(fila.monto_apertura)).toBe(12345);
    expect(fila).toMatchObject({ id_tienda: v.id_tienda, id_vendedor: v.id_usuario });
  });
});

describe('Apertura de caja: montos inválidos (contrato para la app)', () => {
  it('monto ausente, negativo o no numérico: 400, nunca 500, y no se abre ninguna caja', async () => {
    const v = await vendedor();
    for (const cuerpo of [{}, { monto_apertura: -1 }, { monto_apertura: 'abc' }, { monto_apertura: null }, { monto_apertura: {} }]) {
      const r = await v.agente.post('/api/caja/abrir').set('X-CSRF-Token', v.csrfToken).send(cuerpo);
      expect(r.status, JSON.stringify(cuerpo)).toBe(400);
    }
    expect(await cajasAbiertas(v.id_usuario)).toBe(0);
  });

  it('monto 0 es válido (caja que arranca vacía)', async () => {
    const v = await vendedor();
    expect((await abrir(v, 0)).status).toBe(200);
  });
});
