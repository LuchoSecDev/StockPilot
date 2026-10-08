/**
 * @file ia_recomendaciones.test.js
 * @description Pruebas de caracterización (plan 21, R0): camino FELIZ de los 3 endpoints de IA
 * que ya tenían cubierto el camino de falla en `ia_caida.test.js` (getDashboardRecommendations,
 * getPromotionSuggestions, assessClientRisk), simulando el cliente de OpenAI (ver
 * `helpers/mockOpenAI.js` para el porqué de la técnica y por qué es segura bajo `isolate:false`).
 * No se toca código de producción: se fija el comportamiento actual, incluyendo el de caché.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { instalarMockOpenAI, restaurarMockOpenAI } from './helpers/mockOpenAI.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

afterEach(() => {
  restaurarMockOpenAI(vi);
});

async function agenteLogueado(overrides = {}) {
  const datosUsuario = await crearUsuario(overrides);
  const agente = request.agent(app);
  await iniciarSesion(agente, datosUsuario);
  const csrfToken = await obtenerCsrfToken(agente);
  return { agente, csrfToken, ...datosUsuario };
}

describe('IA: camino feliz con OpenAI simulado', () => {
  it('getDashboardRecommendations sin caché: llama a OpenAI una vez y devuelve cached:false con el ajuste de la IA', async () => {
    const { agente, id_tienda } = await agenteLogueado();
    const idProducto = await crearProducto({ id_tienda, cantidad: 0, stock_seguridad: 5, stock_minimo: 5 });
    const spy = instalarMockOpenAI(vi, { adjustments: [{ id: idProducto, adjustment: '+20%', reason: 'Se mueve bien, conviene reponer con margen.' }] });

    const res = await agente.get('/api/ia/recommendations');

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.error).toBeUndefined();
    expect(res.body.recommendations.length).toBe(1);
    expect(res.body.recommendations[0].adjustment).toBe('+20%');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('getDashboardRecommendations con caché: la segunda llamada con el mismo inventario NO vuelve a llamar a OpenAI (cached:true)', async () => {
    const { agente, id_tienda } = await agenteLogueado();
    const idProducto = await crearProducto({ id_tienda, cantidad: 0, stock_seguridad: 5, stock_minimo: 5 });
    const spy = instalarMockOpenAI(vi, { adjustments: [{ id: idProducto, adjustment: '+20%', reason: 'Se mueve bien, conviene reponer con margen.' }] });

    const primera = await agente.get('/api/ia/recommendations');
    expect(primera.body.cached).toBe(false);

    const segunda = await agente.get('/api/ia/recommendations');
    expect(segunda.status).toBe(200);
    expect(segunda.body.cached).toBe(true);
    expect(segunda.body.recommendations).toEqual(primera.body.recommendations);
    // La caché es la tabla Cache_IA (compartida entre réplicas): la 2a petición ni siquiera llega a OpenAI.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('getPromotionSuggestions con OpenAI simulada: toma el tipo y el descuento que responde la IA (no el motor de reglas)', async () => {
    const { agente, id_tienda } = await agenteLogueado();
    const idProducto = await crearProducto({ id_tienda, cantidad: 100, precio: 1000, stock_seguridad: 2, stock_minimo: 2 });
    const spy = instalarMockOpenAI(vi, {
      promotions: [{ id: idProducto, type: 'descuento', title: 'Liquidación', reason: 'Sobrestock persistente, conviene liberar capital con un descuento moderado y estratégico.', duration_days: 10, complementary_name: null, discount: 15 }]
    });

    const res = await agente.get('/api/ia/promotions');

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(res.body.promotions.length).toBe(1);
    expect(res.body.promotions[0].type).toBe('descuento');
    expect(res.body.promotions[0].discount).toBe(15);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('assessClientRisk con OpenAI simulada: usa el perfil/riesgo de la IA, no el aviso de mantenimiento', async () => {
    const { agente, csrfToken } = await agenteLogueado();
    const clienteRes = await agente.post('/api/clientes').set('X-CSRF-Token', csrfToken).send({ nombre: 'Cliente Cumplido' });
    const id_cliente = clienteRes.body.cliente.id_cliente;
    const spy = instalarMockOpenAI(vi, { perfil: 'Buen Pagador', riesgo: 'Bajo', razon: 'Paga siempre a tiempo.', sugerencia: 'Puede aumentar su límite de crédito.' });

    const res = await agente.get(`/api/ia/assess-risk/${id_cliente}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBe(false);
    expect(res.body.analisis.perfil).toBe('Buen Pagador');
    expect(res.body.analisis.riesgo).toBe('Bajo');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
