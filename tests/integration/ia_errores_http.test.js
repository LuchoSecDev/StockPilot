/**
 * @file ia_errores_http.test.js
 * @description Contrato de las respuestas de ERROR y de los bordes de `/api/ia` (plan 21, R1).
 * El análisis de cobertura posterior al refactor mostró que ninguna prueba cubría estas ramas:
 * justo las que un primer intento de R1 había cambiado sin que nada fallara (404 de producto
 * inexistente → 500, 500 sin clave → 200). `apply-strategy` además CAMBIA PRECIOS, así que su
 * camino feliz y su aislamiento entre tiendas se fijan aquí.
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

async function agenteLogueado(overrides = {}) {
  const datosUsuario = await crearUsuario(overrides);
  const agente = request.agent(app);
  await iniciarSesion(agente, datosUsuario);
  const csrfToken = await obtenerCsrfToken(agente);
  return { agente, csrfToken, ...datosUsuario };
}

const aplicar = (agente, csrfToken, cuerpo) =>
  agente.post('/api/ia/apply-strategy').set('X-CSRF-Token', csrfToken).send(cuerpo);

describe('POST /api/ia/apply-strategy', () => {
  it('sin id_producto o sin nuevo_precio responde 400 y no toca nada', async () => {
    const { agente, csrfToken } = await agenteLogueado();

    const sinPrecio = await aplicar(agente, csrfToken, { id_producto: 1 });
    const sinProducto = await aplicar(agente, csrfToken, { nuevo_precio: 900 });

    expect(sinPrecio.status).toBe(400);
    expect(sinPrecio.body).toEqual({ error: 'Datos incompletos' });
    expect(sinProducto.status).toBe(400);
  });

  it('producto inexistente: 404 «Producto no encontrado» (no un 500)', async () => {
    const { agente, csrfToken } = await agenteLogueado();

    const res = await aplicar(agente, csrfToken, { id_producto: 999999, nuevo_precio: 900 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Producto no encontrado' });
  });

  it('AISLAMIENTO: un producto de OTRA tienda responde 404 y su precio no cambia', async () => {
    const A = await agenteLogueado();
    const B = await agenteLogueado();
    const idDeB = await crearProducto({ id_tienda: B.id_tienda, precio: 1000 });

    const res = await aplicar(A.agente, A.csrfToken, { id_producto: idDeB, nuevo_precio: 1 });

    expect(res.status).toBe(404);
    const fila = await db.getAsync('SELECT precio, precio_original FROM Productos WHERE id_producto = ?', [idDeB]);
    expect(Number(fila.precio)).toBe(1000);
    expect(fila.precio_original).toBeNull();
  });

  it('camino feliz: baja el precio, guarda el original, deja historial y auditoría', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado();
    const id_producto = await crearProducto({ id_tienda, precio: 1000 });

    const res = await aplicar(agente, csrfToken, {
      id_producto, nuevo_precio: 800, duration_days: 10, razon: 'Sobrestock', tipo: 'descuento'
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const producto = await db.getAsync('SELECT precio, precio_original, fecha_fin_promocion FROM Productos WHERE id_producto = ?', [id_producto]);
    expect(Number(producto.precio)).toBe(800);
    expect(Number(producto.precio_original)).toBe(1000);
    expect(producto.fecha_fin_promocion).not.toBeNull();

    const historial = await db.allAsync('SELECT precio_anterior, precio_nuevo, motivo FROM Historial_Precios WHERE id_producto = ?', [id_producto]);
    expect(historial).toHaveLength(1);
    expect(Number(historial[0].precio_anterior)).toBe(1000);
    expect(Number(historial[0].precio_nuevo)).toBe(800);
    expect(historial[0].motivo).toBe('Estrategia IA: descuento - Sobrestock');

    const auditoria = await db.allAsync("SELECT impacto_decision FROM Auditoria_IA WHERE id_tienda = ? AND prompt_utilizado = 'Ejecución Estrategia Directa'", [id_tienda]);
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0].impacto_decision).toBe('ESTRATEGIA APLICADA');
  });

  it('promociones encadenadas: el precio original que se guarda es el primero, no el de la promoción anterior', async () => {
    const { agente, csrfToken, id_tienda } = await agenteLogueado();
    const id_producto = await crearProducto({ id_tienda, precio: 1000 });

    await aplicar(agente, csrfToken, { id_producto, nuevo_precio: 800, razon: 'a', tipo: 'descuento' });
    await aplicar(agente, csrfToken, { id_producto, nuevo_precio: 600, razon: 'b', tipo: 'descuento' });

    const producto = await db.getAsync('SELECT precio, precio_original FROM Productos WHERE id_producto = ?', [id_producto]);
    expect(Number(producto.precio)).toBe(600);
    expect(Number(producto.precio_original)).toBe(1000);
  });
});

describe('GET /api/ia/assess-risk/:id_cliente (errores)', () => {
  it('cliente inexistente: 404 «Cliente no encontrado»', async () => {
    const { agente } = await agenteLogueado();
    const res = await agente.get('/api/ia/assess-risk/999999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Cliente no encontrado' });
  });

  it('AISLAMIENTO: un cliente de OTRA tienda responde 404', async () => {
    const A = await agenteLogueado();
    const B = await agenteLogueado();
    const creado = await B.agente.post('/api/clientes').set('X-CSRF-Token', B.csrfToken).send({ nombre: 'Cliente de B' });

    const res = await A.agente.get(`/api/ia/assess-risk/${creado.body.cliente.id_cliente}`);

    expect(res.status).toBe(404);
  });

  it('sin OPENAI_API_KEY configurada: 500 explícito, antes de consultar al cliente', async () => {
    const { agente } = await agenteLogueado();
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = '';
    try {
      // Ni siquiera hace falta que el cliente exista: la clave se valida primero.
      const res = await agente.get('/api/ia/assess-risk/999999');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/no está configurada/i);
    } finally {
      process.env.OPENAI_API_KEY = original;
    }
  });
});

describe('GET /api/ia/promotions (bordes)', () => {
  it('sin ningún producto candidato: {success:true, promotions:[]} (sin campo cached) y sin llamar a OpenAI', async () => {
    const { agente, id_tienda } = await agenteLogueado();
    // Stock moderado, sin vencimiento y sin ventas: ni rotación baja, ni por vencer, ni sobrestock.
    await crearProducto({ id_tienda, cantidad: 10 });

    const res = await agente.get('/api/ia/promotions');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, promotions: [] });
  });
});
