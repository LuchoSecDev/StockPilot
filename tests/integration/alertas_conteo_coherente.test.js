/**
 * @file alertas_conteo_coherente.test.js
 * @description 9-oct-2026. El conteo de alertas del frontend (frontend/src/utils/alertas.js: campanita y Monitor de
 * Alertas) tiene que dar lo MISMO que `GET /api/alertas/stats` del servidor (Alert.getStats), que sigue siendo la fuente
 * de la insignia del menú y del Dashboard. Si alguien cambia una de las dos reglas sin la otra, esta prueba falla.
 * También comprueba que `GET /api/alertas` SIN límite devuelve todas las alertas activas (la campanita ya no pide solo 5).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
import { iniciarSesion } from './helpers/sesion.js';
import { contarAlertas, alertasDelGrupo } from '../../frontend/src/utils/alertas.js';

const JSON_ACCEPT = { Accept: 'application/json' };

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

async function tiendaConAlertas() {
  const admin = await crearUsuario({ rol: 'Administrador' });
  const agente = request.agent(app);
  await iniciarSesion(agente, admin);
  const alerta = async (id_producto, tipo, severidad, resuelta = 0) => db.runAsync(
    'INSERT INTO Alertas (id_producto, id_tienda, tipo, severidad, mensaje, resuelta) VALUES (?, ?, ?, ?, ?, ?)',
    [id_producto, admin.id_tienda, tipo, severidad, `Alerta ${tipo}`, resuelta]
  );
  const producto = (n) => crearProducto({ id_tienda: admin.id_tienda, nombre_producto: `Producto ${n}`, cantidad: 100 });

  // 12 productos con la distribución de la demostración (4 / 3 / 5), más casos de borde.
  const ids = [];
  for (let i = 1; i <= 12; i++) ids.push(await producto(i));
  for (const id of ids.slice(0, 4)) await alerta(id, 'stock_critico', 'critico');
  for (const id of ids.slice(4, 6)) await alerta(id, 'vencimiento_critico', 'critico'); // severidad crítica, pero del grupo «info»
  for (const id of ids.slice(6, 9)) await alerta(id, 'stock_bajo', 'advertencia');
  for (const id of ids.slice(9, 11)) await alerta(id, 'vencimiento_proximo', 'advertencia'); // severidad advertencia, grupo «info»
  await alerta(ids[11], 'sobrestock', 'info');
  // Borde 1: un producto con alertas de dos grupos (cuenta en cada grupo y una vez en el total).
  await alerta(ids[0], 'vencimiento_proximo', 'advertencia');
  // Borde 2: una alerta ya resuelta no cuenta.
  await alerta(ids[1], 'stock_bajo', 'advertencia', 1);
  return { agente, ids };
}

describe('conteo de alertas: servidor y frontend dicen lo mismo', () => {
  it('contarAlertas(GET /api/alertas) coincide con GET /api/alertas/stats, grupo por grupo', async () => {
    const { agente } = await tiendaConAlertas();
    const lista = (await agente.get('/api/alertas').set(JSON_ACCEPT)).body.alerts;
    const stats = (await agente.get('/api/alertas/stats').set(JSON_ACCEPT)).body.stats;
    expect(stats).toEqual({ critico: 4, advertencia: 3, info: 6, total: 12 });
    expect(contarAlertas(lista)).toEqual(stats);
  });

  it('GET /api/alertas sin límite trae TODAS las activas (13 filas: la campanita ya no se queda en 5)', async () => {
    const { agente } = await tiendaConAlertas();
    const lista = (await agente.get('/api/alertas').set(JSON_ACCEPT)).body.alerts;
    expect(lista).toHaveLength(13); // 12 + la de segundo grupo; la resuelta no entra
    const solo5 = (await agente.get('/api/alertas?limit=5').set(JSON_ACCEPT)).body.alerts;
    expect(solo5).toHaveLength(5); // lo que hacía la campanita: solo críticas, las advertencias nunca salían
    expect(new Set(solo5.map((a) => a.severidad))).toEqual(new Set(['critico']));
  });

  it('los filtros del Monitor muestran las filas de cada tarjeta (por producto, como cuenta el servidor)', async () => {
    const { agente } = await tiendaConAlertas();
    const lista = (await agente.get('/api/alertas').set(JSON_ACCEPT)).body.alerts;
    const stats = (await agente.get('/api/alertas/stats').set(JSON_ACCEPT)).body.stats;
    for (const grupo of ['critico', 'advertencia', 'info']) {
      const productos = new Set(alertasDelGrupo(lista, grupo).map((a) => a.id_producto));
      expect(productos.size).toBe(stats[grupo]);
    }
  });
});
