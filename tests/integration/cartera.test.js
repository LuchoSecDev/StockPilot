/**
 * @file cartera.test.js
 * @description Flujo prioritario 3/7 (plan 20, Nivel 2): clientes fiados (cartera), sus ventas
 * a crédito y sus abonos, contra Postgres real.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto, abrirCaja } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

// El caso "flujo completo" de abajo registra una venta (Fiado), que dispara Alert.generate() sin
// esperarlo — ver tests/integration/helpers/tiempo.js. Le damos tiempo a terminar en cada prueba
// de este archivo (aunque solo una la dispare) para no arrastrar el problema a otro archivo.
afterEach(async () => {
  await esperarTrabajoEnSegundoPlano();
});

async function agenteLogueado(overrides = {}) {
  const datosUsuario = await crearUsuario(overrides);
  const agente = request.agent(app);
  await iniciarSesion(agente, datosUsuario);
  const csrfToken = await obtenerCsrfToken(agente);
  return { agente, csrfToken, ...datosUsuario };
}

describe('Cartera (clientes fiados)', () => {
  it('crear cliente: éxito', async () => {
    const { agente, csrfToken } = await agenteLogueado();
    const res = await agente.post('/api/clientes').set('X-CSRF-Token', csrfToken)
      .send({ nombre: 'Doña Rosa', celular: '3001112233', limite_credito: 100000 });
    expect(res.status).toBe(200);
    expect(res.body.cliente.nombre).toBe('Doña Rosa');
  });

  it('crear cliente sin nombre: 400', async () => {
    const { agente, csrfToken } = await agenteLogueado();
    const res = await agente.post('/api/clientes').set('X-CSRF-Token', csrfToken).send({ celular: '3001112233' });
    expect(res.status).toBe(400);
  });

  it('listar clientes: saldo_pendiente = 0 para un cliente recién creado, sin fiados', async () => {
    const { agente, csrfToken } = await agenteLogueado();
    await agente.post('/api/clientes').set('X-CSRF-Token', csrfToken).send({ nombre: 'Don Pepe' });

    const res = await agente.get('/api/clientes');
    expect(res.status).toBe(200);
    expect(res.body.clientes.length).toBe(1);
    expect(res.body.clientes[0].saldo_pendiente).toBe(0);
  });

  it('flujo completo: venta fiada crea deuda, un abono parcial la reduce (saldo_pendiente correcto en todo momento)', async () => {
    const { agente, csrfToken, id_tienda, id_usuario } = await agenteLogueado({ rol: 'Tendero' });
    const id_producto = await crearProducto({ id_tienda, cantidad: 10, precio: 5000 });
    await abrirCaja(id_tienda, id_usuario);

    const cliente = await agente.post('/api/clientes').set('X-CSRF-Token', csrfToken).send({ nombre: 'Cliente Fiado', limite_credito: 50000 });
    const id_cliente = cliente.body.cliente.id_cliente;

    // Venta fiada de 2 unidades a $5.000 = $10.000 de deuda.
    const venta = await agente.post('/api/registrar-venta').set('X-CSRF-Token', csrfToken)
      .send({ id_producto, cantidad: 2, metodo_pago: 'Fiado', id_cliente });
    expect(venta.status).toBe(200);

    const detalleTrasVenta = await agente.get(`/api/clientes/${id_cliente}`);
    expect(detalleTrasVenta.body.cliente.saldo_pendiente).toBe(10000);
    expect(detalleTrasVenta.body.cliente.historial_ventas.length).toBe(1);

    // Abono parcial de $4.000.
    const abono = await agente.post(`/api/clientes/${id_cliente}/abonos`).set('X-CSRF-Token', csrfToken)
      .send({ monto: 4000, metodo_pago: 'Efectivo' });
    expect(abono.status).toBe(200);

    const detalleTrasAbono = await agente.get(`/api/clientes/${id_cliente}`);
    expect(detalleTrasAbono.body.cliente.saldo_pendiente).toBe(6000);
    expect(detalleTrasAbono.body.cliente.historial_abonos.length).toBe(1);

    const listado = await agente.get('/api/clientes');
    expect(listado.body.clientes[0].saldo_pendiente).toBe(6000);
  });

  it('registrar abono para un cliente inexistente: 404', async () => {
    const { agente, csrfToken } = await agenteLogueado();
    const res = await agente.post('/api/clientes/99999/abonos').set('X-CSRF-Token', csrfToken).send({ monto: 1000 });
    expect(res.status).toBe(404);
  });

  it('registrar abono con monto inválido (<=0): 400', async () => {
    const { agente, csrfToken } = await agenteLogueado();
    const cliente = await agente.post('/api/clientes').set('X-CSRF-Token', csrfToken).send({ nombre: 'Cliente X' });
    const id_cliente = cliente.body.cliente.id_cliente;

    const res = await agente.post(`/api/clientes/${id_cliente}/abonos`).set('X-CSRF-Token', csrfToken).send({ monto: 0 });
    expect(res.status).toBe(400);
  });

  it('venta Fiado sin id_cliente: 400 (el cliente es obligatorio para ventas fiadas)', async () => {
    const { agente, csrfToken, id_tienda, id_usuario } = await agenteLogueado({ rol: 'Tendero' });
    const id_producto = await crearProducto({ id_tienda, cantidad: 5, precio: 1000 });
    await abrirCaja(id_tienda, id_usuario);

    const venta = await agente.post('/api/registrar-venta').set('X-CSRF-Token', csrfToken)
      .send({ id_producto, cantidad: 1, metodo_pago: 'Fiado' });
    expect(venta.status).toBe(400);
    expect(venta.body.error).toMatch(/cliente es obligatorio/i);
  });

  it('aislamiento por tienda: no se puede ver ni abonar a un cliente de otra tienda', async () => {
    const tiendaA = await agenteLogueado();
    const tiendaB = await agenteLogueado();

    const clienteDeA = await tiendaA.agente.post('/api/clientes').set('X-CSRF-Token', tiendaA.csrfToken).send({ nombre: 'Cliente de A' });
    const id_cliente_de_A = clienteDeA.body.cliente.id_cliente;

    const verDesdeB = await tiendaB.agente.get(`/api/clientes/${id_cliente_de_A}`);
    expect(verDesdeB.status).toBe(404);

    const abonarDesdeB = await tiendaB.agente.post(`/api/clientes/${id_cliente_de_A}/abonos`).set('X-CSRF-Token', tiendaB.csrfToken).send({ monto: 1000 });
    expect(abonarDesdeB.status).toBe(404);

    const listadoDeB = await tiendaB.agente.get('/api/clientes');
    expect(listadoDeB.body.clientes.length).toBe(0);
  });
});
