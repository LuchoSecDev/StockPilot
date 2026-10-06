/**
 * @file ia_privacidad.test.js
 * @description Lo que se le manda a OpenAI no debe identificar a una persona. La política de datos publicada dice
 * que a ese servicio va «un resumen numérico sin datos personales» y que no se envían nombres (Ley 1581). Estas pruebas
 * miran los argumentos REALES de la llamada (el mock de OpenAI los conserva) en vez de fiarse de lo que dice el texto.
 *
 * Cubre el análisis de riesgo de un cliente que fía (GET /api/ia/assess-risk/:id): antes mandaba el nombre del cliente.
 * Pendiente de decidir y cubrir: el nombre del proveedor en el Consejero y el «motivo del dueño» (texto libre) de las
 * promociones manuales.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { instalarMockOpenAI, restaurarMockOpenAI } from './helpers/mockOpenAI.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});
afterEach(() => {
  restaurarMockOpenAI(vi);
});

const NOMBRE = 'Marta Rodríguez Quintero';

async function clienteQueFia() {
  const admin = await crearUsuario({ rol: 'Administrador' });
  const agente = request.agent(app);
  await iniciarSesion(agente, admin);
  const csrf = await obtenerCsrfToken(agente);
  const creado = await agente.post('/api/clientes').set('X-CSRF-Token', csrf).send({ nombre: NOMBRE, celular: '3101234567' });
  return { agente, id_cliente: creado.body.cliente.id_cliente, id_tienda: admin.id_tienda };
}

describe('Análisis de riesgo de un cliente: no se envía quién es', () => {
  it('lo que se manda a OpenAI no contiene el nombre ni el celular del cliente', async () => {
    const { agente, id_cliente } = await clienteQueFia();
    const spy = instalarMockOpenAI(vi, { perfil: 'Cliente Nuevo', riesgo: 'Evaluando', razon: 'Sin historial.', sugerencia: 'Observar.' });

    const res = await agente.get(`/api/ia/assess-risk/${id_cliente}`);

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    const enviado = JSON.stringify(spy.mock.calls[0][0].messages);
    for (const dato of ['Marta', 'Rodríguez', 'Quintero', '3101234567']) {
      expect(enviado, `se envió «${dato}»`).not.toContain(dato);
    }
  });

  it('sigue mandando lo que la IA necesita para evaluar: saldo, número de compras y de abonos', async () => {
    const { agente, id_cliente } = await clienteQueFia();
    const spy = instalarMockOpenAI(vi, { perfil: 'Cliente Nuevo', riesgo: 'Evaluando', razon: 'Sin historial.', sugerencia: 'Observar.' });
    await agente.get(`/api/ia/assess-risk/${id_cliente}`);
    const enviado = JSON.stringify(spy.mock.calls[0][0].messages);
    for (const campo of ['limite_credito', 'total_compras_fiadas', 'total_pagado', 'saldo_pendiente_actual', 'num_compras_fiadas', 'num_abonos']) {
      expect(enviado).toContain(campo);
    }
  });

  it('la auditoría de IA guarda el id del cliente (para poder rastrear el análisis) y tampoco su nombre', async () => {
    const { agente, id_cliente, id_tienda } = await clienteQueFia();
    instalarMockOpenAI(vi, { perfil: 'Cliente Nuevo', riesgo: 'Evaluando', razon: 'Sin historial.', sugerencia: 'Observar.' });
    await agente.get(`/api/ia/assess-risk/${id_cliente}`);

    const fila = await db.getAsync("SELECT prompt_utilizado, datos_base_json FROM Auditoria_IA WHERE id_tienda = ? AND motor_ia = 'Evaluador Riesgo Fiados v1.0'", [id_tienda]);
    expect(fila).toBeTruthy();
    expect(`${fila.prompt_utilizado} ${fila.datos_base_json}`).not.toContain('Marta');
    expect(JSON.parse(fila.datos_base_json).id_cliente).toBe(id_cliente);
  });
});
