/**
 * @file ia_caida.test.js
 * @description Flujo prioritario 7/7 (plan 20, Nivel 2): qué pasa cuando OpenAI no responde bien
 * (clave inválida/vencida) o no está configurada. `.env.test` deja `OPENAI_API_KEY` con un valor
 * presente pero inválido (`sk-test-dummy-key-no-valida`) a propósito — no incluye la palabra
 * "tuLlaveSecreta" que estos controladores usan para el chequeo de "no configurada", así que la
 * llamada real a OpenAI se intenta de verdad y falla por credenciales, simulando fielmente la IA
 * caída (no un mock: el fallo es real, contra el servicio real de OpenAI).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
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

describe('IA caída', () => {
  it('getDashboardRecommendations con OpenAI fallando: degrada con elegancia (200, error:true, sugerencia de reemplazo), no rompe', async () => {
    const { agente, id_tienda } = await agenteLogueado();
    // Sin stock: calcularReposicion pide reponer, así que sí llega a intentar llamar a OpenAI
    // (si no hay nada que reponer, el endpoint ni intenta la llamada y esta prueba no probaría nada).
    await crearProducto({ id_tienda, cantidad: 0, stock_seguridad: 5, stock_minimo: 5 });

    const res = await agente.get('/api/ia/recommendations');
    expect(res.status).toBe(200);
    expect(res.body.error).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);
    expect(res.body.recommendations[0].reason).toMatch(/mantenimiento/i);
  }, 20000);

  it('getDashboardRecommendations sin productos para reponer: ni siquiera llama a OpenAI, responde vacío de una', async () => {
    const { agente, id_tienda } = await agenteLogueado();
    // Sobrado de stock: calcularReposicion no pide nada.
    await crearProducto({ id_tienda, cantidad: 500, stock_seguridad: 2, stock_minimo: 2 });

    const res = await agente.get('/api/ia/recommendations');
    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    expect(res.body.recommendations).toEqual([]);
  });

  it('getDashboardRecommendations sin OPENAI_API_KEY configurada: 500 explícito, sin siquiera intentar la red', async () => {
    const { agente, id_tienda } = await agenteLogueado();
    await crearProducto({ id_tienda, cantidad: 0, stock_seguridad: 5, stock_minimo: 5 });

    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = '';
    try {
      const res = await agente.get('/api/ia/recommendations');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/no está configurada/i);
    } finally {
      process.env.OPENAI_API_KEY = original;
    }
  });

  it('assessClientRisk con OpenAI fallando: a diferencia de recommendations, este endpoint SÍ propaga un 500 (hallazgo: inconsistencia entre endpoints de IA, ver plan)', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado();
    const clienteRes = await agente.post('/api/clientes').set('X-CSRF-Token', csrfToken).send({ nombre: 'Cliente de Riesgo' });
    const id_cliente = clienteRes.body.cliente.id_cliente;

    const res = await agente.get(`/api/ia/assess-risk/${id_cliente}`);
    expect(res.status).toBe(500);
  }, 20000);
});
