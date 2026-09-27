/**
 * @file alert_generate_concurrencia.test.js
 * @description Flujo prioritario 4/7 (plan 20, Nivel 2): `Alert.generate()` bajo concurrencia,
 * contra Postgres real. A diferencia de `registrar-venta-carrito` (sin protección) o
 * `SesionCaja` (sin protección pero sin bug reproducido), `Alert.generate()` ya usa
 * `pg_advisory_xact_lock(tiendaId)` — puesto ahí en el plan 17 (hallazgo O3) para evitar
 * duplicados. Este archivo confirma que esa protección funciona de verdad.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import Alert from '../../models/Alert.js';
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

/** Producto sin stock: calcularReposicion da urgencia "Pide hoy" sin importar historial de ventas. */
async function crearProductoCritico(id_tienda) {
  return crearProducto({ id_tienda, cantidad: 0, stock_seguridad: 5, stock_minimo: 5 });
}

describe('Alert.generate() con concurrencia', () => {
  it('5 llamadas concurrentes a generar alertas de la misma tienda: nunca duplica la alerta del mismo producto', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado();
    const id_producto = await crearProductoCritico(id_tienda);

    const pedidos = Array.from({ length: 5 }, () =>
      agente.post('/api/alertas/generate').set('X-CSRF-Token', csrfToken).send({})
    );
    const resultados = await Promise.all(pedidos);

    for (const r of resultados) {
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    }

    const alertas = await db.allAsync(
      `SELECT * FROM Alertas WHERE id_tienda = ? AND id_producto = ? AND tipo = 'stock_critico'`,
      [id_tienda, id_producto]
    );
    expect(alertas.length).toBe(1);
    expect(alertas[0].resuelta).toBe(0);
  });

  it('dos tiendas distintas generando alertas al mismo tiempo: el lock es por tienda, ninguna bloquea a la otra ni se mezclan sus alertas', async () => {
    const tiendaA = await agenteLogueado();
    const tiendaB = await agenteLogueado();
    const productoA = await crearProductoCritico(tiendaA.id_tienda);
    const productoB = await crearProductoCritico(tiendaB.id_tienda);

    const [resA, resB] = await Promise.all([
      tiendaA.agente.post('/api/alertas/generate').set('X-CSRF-Token', tiendaA.csrfToken).send({}),
      tiendaB.agente.post('/api/alertas/generate').set('X-CSRF-Token', tiendaB.csrfToken).send({})
    ]);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const alertasA = await db.allAsync(`SELECT * FROM Alertas WHERE id_tienda = ?`, [tiendaA.id_tienda]);
    const alertasB = await db.allAsync(`SELECT * FROM Alertas WHERE id_tienda = ?`, [tiendaB.id_tienda]);
    expect(alertasA.length).toBe(1);
    expect(alertasA[0].id_producto).toBe(productoA);
    expect(alertasB.length).toBe(1);
    expect(alertasB[0].id_producto).toBe(productoB);
  });

  it('generar dos veces seguidas (secuencial): la alerta se actualiza en el mismo lugar, no se duplica ni cambia su fecha_creacion', async () => {
    const { id_tienda } = await agenteLogueado();
    const id_producto = await crearProductoCritico(id_tienda);

    await Alert.generate(id_tienda);
    const primera = await db.getAsync(`SELECT id_alerta, fecha_creacion FROM Alertas WHERE id_tienda = ? AND id_producto = ?`, [id_tienda, id_producto]);

    await Alert.generate(id_tienda);
    const segunda = await db.getAsync(`SELECT id_alerta, fecha_creacion FROM Alertas WHERE id_tienda = ? AND id_producto = ?`, [id_tienda, id_producto]);

    expect(segunda.id_alerta).toBe(primera.id_alerta);
    expect(new Date(segunda.fecha_creacion).getTime()).toBe(new Date(primera.fecha_creacion).getTime());

    const total = await db.allAsync(`SELECT * FROM Alertas WHERE id_tienda = ? AND id_producto = ?`, [id_tienda, id_producto]);
    expect(total.length).toBe(1);
  });

  it('producto que deja de estar crítico: la siguiente generación resuelve la alerta vieja (no queda activa)', async () => {
    const { id_tienda } = await agenteLogueado();
    const id_producto = await crearProductoCritico(id_tienda);

    await Alert.generate(id_tienda);
    const activasAntes = await Alert.findActive(id_tienda);
    expect(activasAntes.length).toBe(1);

    // Se reabastece por encima de cualquier umbral de riesgo.
    await db.runAsync('UPDATE Productos SET cantidad = 500 WHERE id_producto = ?', [id_producto]);

    await Alert.generate(id_tienda);
    const activasDespues = await Alert.findActive(id_tienda);
    expect(activasDespues.length).toBe(0);

    const resuelta = await db.getAsync(`SELECT resuelta FROM Alertas WHERE id_tienda = ? AND id_producto = ?`, [id_tienda, id_producto]);
    expect(resuelta.resuelta).toBe(1);
  });

  it('DISABLE_ALERT_ENGINE=true: generate() no crea nada y devuelve 0 (interruptor de emergencia, plan 17 O8)', async () => {
    const { id_tienda } = await agenteLogueado();
    await crearProductoCritico(id_tienda);

    process.env.DISABLE_ALERT_ENGINE = 'true';
    try {
      const generadas = await Alert.generate(id_tienda);
      expect(generadas).toBe(0);
    } finally {
      delete process.env.DISABLE_ALERT_ENGINE;
    }

    const alertas = await db.allAsync(`SELECT * FROM Alertas WHERE id_tienda = ?`, [id_tienda]);
    expect(alertas.length).toBe(0);
  });
});
