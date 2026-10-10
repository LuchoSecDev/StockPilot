/**
 * @file demo_sembrado.test.js
 * @description Plan 25, fase 1. Siembra la tienda de demostración (database/seed_demo.js → sembrarDemo) en
 * stockpilot_test y recorre, con la API REAL, lo que el guion de la visita le va a mostrar al dueño: alertas de
 * stock y vencimiento, pedido por aprobar / listo para enviar / por recibir, venta (que exige abrir caja), fiado y
 * abono, y el arqueo de la caja de ayer. También comprueba el aislamiento (otra tienda no ve nada de esta) y que la
 * tienda queda marcada como de prueba para el panel interno.
 *
 * La regla de las alertas es la REAL (Alert.generate, con la clase ABC calculada por el SQL): la prueba unitaria
 * tests/business_logic/demo_escenario.test.js comprueba lo mismo con la regla en memoria; esta confirma que la
 * base de datos coincide.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';
import escenarioModulo from '../../database/demoEscenario.js';
import seedModulo from '../../database/seed_demo.js';

const { armarEscenario } = escenarioModulo;
const { sembrarDemo } = seedModulo;

const CLAVE_DEMO = 'ClaveDeLaDemo123!'; // contraseña de prueba, solo para esta base de pruebas
const BUZON = 'buzon.del.equipo@ejemplo.test';
const JSON_ACCEPT = { Accept: 'application/json' };

afterEach(esperarTrabajoEnSegundoPlano); // vender y recibir disparan Alert.generate sin esperarlo

// Lo que se promete por producto (mismo contrato que la prueba unitaria; aquí solo los que tienen alerta).
const ALERTAS_ESPERADAS = {
  leche: ['stock_critico'], huevos: ['stock_critico'], arroz: ['stock_critico'], aceite: ['stock_critico'],
  cafe: ['stock_bajo'], pasta: ['stock_bajo'], gaseosa: ['stock_bajo'],
  yogur: ['vencimiento_critico'], queso: ['vencimiento_critico'],
  galletas: ['vencimiento_proximo'], mermelada: ['vencimiento_proximo'],
  jabon: ['sobrestock'],
};

let hoy;
let esc;
let demo; // resultado de sembrarDemo
let admin; // { agente, csrf }

async function sembrarYEntrar(opciones = {}) {
  hoy = db.getBogotaDate();
  esc = armarEscenario({ hoy, semilla: 25, correoProveedor: BUZON });
  demo = await sembrarDemo({ hoy, contrasena: CLAVE_DEMO, correoProveedor: BUZON, ...opciones });
  const agente = request.agent(app);
  await iniciarSesion(agente, { usuario: 'demo', password: CLAVE_DEMO });
  admin = { agente, csrf: await obtenerCsrfToken(agente) };
}

const get = (url) => admin.agente.get(url).set(JSON_ACCEPT);
const post = (url, cuerpo = {}) => admin.agente.post(url).set('X-CSRF-Token', admin.csrf).send(cuerpo);
const patch = (url, cuerpo = {}) => admin.agente.patch(url).set('X-CSRF-Token', admin.csrf).send(cuerpo);
const idProducto = async (clave) => (await db.getAsync('SELECT id_producto FROM Productos WHERE codigo = ?', [`DEMO-${clave.toUpperCase()}`])).id_producto;

describe('sembrarDemo: lo que queda en la base', () => {
  beforeAll(async () => { await limpiarBaseDePruebas(); await sembrarYEntrar(); });

  it('crea UNA tienda marcada como de prueba, con el Administrador como dueño y sin cuenta de Tendero', async () => {
    const tiendas = await db.allAsync('SELECT id_tienda, es_prueba, id_propietario, nombre_establecimiento FROM Tienda');
    expect(tiendas).toHaveLength(1);
    expect(tiendas[0].es_prueba).toBe(true);
    const usuarios = await db.allAsync('SELECT id_usuario, rol, correo, usuario, modo_interfaz, fecha_aceptacion_politica_datos FROM Usuarios');
    expect(usuarios).toHaveLength(1);
    expect(usuarios[0]).toMatchObject({ rol: 'Administrador', usuario: 'demo', modo_interfaz: 'basico' });
    expect(usuarios[0].correo).toMatch(/@example\.invalid$/);
    expect(usuarios[0].fecha_aceptacion_politica_datos).not.toBeNull();
    expect(tiendas[0].id_propietario).toBe(usuarios[0].id_usuario);
  });

  it('el panel interno no la cuenta como tienda real: sale en el resumen con su marca y fuera de activación y adopción', async () => {
    const resumen = await db.allAsync('SELECT id_tienda, es_prueba FROM interno.v_tiendas_resumen');
    expect(resumen).toEqual([{ id_tienda: demo.id_tienda, es_prueba: true }]);
    expect(await db.allAsync('SELECT 1 FROM interno.v_activacion')).toHaveLength(0);
    expect(await db.allAsync('SELECT 1 FROM interno.v_adopcion_semanal')).toHaveLength(0);
  });

  it('el proveedor A lleva el buzón configurado (email y correo) y el B no tiene correo; ningún otro correo es real', async () => {
    const provs = await db.allAsync('SELECT nombre_empresa, email, correo FROM Proveedores ORDER BY id_proveedor');
    expect(provs).toHaveLength(2);
    expect(provs[0]).toMatchObject({ email: BUZON, correo: BUZON });
    expect(provs[1].email).toBeNull();
  });

  it('carga los productos, las ventas y el Kardex del escenario, con el stock final exacto', async () => {
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM Productos')).n)).toBe(esc.productos.length);
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM Ventas')).n)).toBe(esc.ventas.length);
    const lineas = esc.ventas.reduce((s, v) => s + v.items.length, 0);
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM VentasProductos')).n)).toBe(lineas);
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM MovimientosStock')).n)).toBe(esc.productos.length + lineas);
    const leche = await db.getAsync('SELECT cantidad FROM Productos WHERE codigo = ?', ['DEMO-LECHE']);
    expect(Number(leche.cantidad)).toBe(esc.productos.find((p) => p.clave === 'leche').cantidad);
  });

  it('las ventas guardan el precio al que se vendieron y suman lo que dice el escenario', async () => {
    const sinPrecio = await db.getAsync('SELECT COUNT(*) AS n FROM VentasProductos WHERE precio_unitario IS NULL');
    expect(Number(sinPrecio.n)).toBe(0);
    const total = await db.getAsync('SELECT SUM(precio_total) AS t FROM Ventas');
    expect(Number(total.t)).toBe(esc.ventas.reduce((s, v) => s + v.total, 0));
  });
});

describe('alertas con la regla real (Alert.generate y la clase ABC del SQL)', () => {
  beforeAll(async () => { await limpiarBaseDePruebas(); await sembrarYEntrar(); });

  it('quedan activas exactamente las alertas prometidas, producto por producto', async () => {
    const filas = await db.allAsync(
      `SELECT p.codigo, a.tipo FROM Alertas a JOIN Productos p ON p.id_producto = a.id_producto
       WHERE a.id_tienda = ? AND a.resuelta = 0`, [demo.id_tienda]);
    const porProducto = {};
    for (const f of filas) (porProducto[f.codigo.replace('DEMO-', '').toLowerCase()] ??= []).push(f.tipo);
    const normalizado = Object.fromEntries(Object.entries(porProducto).map(([k, v]) => [k.toLowerCase(), v.sort()]));
    const esperado = Object.fromEntries(Object.entries(ALERTAS_ESPERADAS).map(([k, v]) => [k.toLowerCase(), v]));
    expect(normalizado).toEqual(esperado);
  });

  it('el Monitor de Alertas las muestra (GET /api/alertas) y el conteo por tipo es el de la tabla 2.1', async () => {
    const r = await get('/api/alertas');
    expect(r.status).toBe(200);
    const contar = (t) => r.body.alerts.filter((a) => a.tipo === t).length;
    expect(contar('stock_critico')).toBe(4);
    expect(contar('stock_bajo')).toBe(3);
    expect(contar('vencimiento_critico')).toBe(2);
    expect(contar('vencimiento_proximo')).toBe(2);
    expect(contar('sobrestock')).toBe(1);
  });
});

describe('pedidos: por aprobar, listo para enviar y por recibir', () => {
  beforeAll(async () => { await limpiarBaseDePruebas(); await sembrarYEntrar(); });

  it('/pedir ve el borrador del proveedor A por aprobar, y el historial trae las tres órdenes', async () => {
    // El resumen viene como un objeto por producto con lo que ya está en un borrador: { [id_producto]: { id_orden, cantidad, proveedor } }.
    const borradores = (await get('/api/ordenes/borradores/resumen')).body.data;
    const enBorrador = [await idProducto('cafe'), await idProducto('pasta'), await idProducto('gaseosa')];
    expect(Object.keys(borradores).map(Number).sort()).toEqual([...enBorrador].sort());
    expect(new Set(Object.values(borradores).map((b) => b.id_orden)).size).toBe(1); // un solo borrador abierto
    expect(Object.values(borradores).every((b) => b.proveedor === 'Distribuidora La Sabana')).toBe(true);
    const historial = (await get('/api/ordenes/historial')).body.data;
    expect(historial.map((o) => o.estado).sort()).toEqual(['Aprobada', 'Borrador', 'Enviada']);
  });

  it('aprobar el borrador funciona y no deja al proveedor B con borradores abiertos', async () => {
    const borrador = (await get('/api/ordenes/historial')).body.data.find((o) => o.estado === 'Borrador');
    const r = await patch(`/api/ordenes/${borrador.id_orden}/estado`, { estado: 'Aprobada' });
    expect(r.status).toBe(200);
    const aprobadas = (await get('/api/ordenes/historial')).body.data.filter((o) => o.estado === 'Aprobada');
    expect(aprobadas).toHaveLength(2);
  });

  it('el proveedor sin correo (B) no se puede enviar por correo: el camino es el PDF o «ya la envié»', async () => {
    const enviada = (await get('/api/ordenes/historial')).body.data.find((o) => o.estado === 'Enviada');
    const r = await post(`/api/ordenes/${enviada.id_orden}/enviar-proveedor`);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/email proveedor/i);
    const pdf = await admin.agente.get(`/api/ordenes/${enviada.id_orden}/pdf`);
    expect(pdf.status).toBe(200);
  });

  it('recibir la orden enviada con una línea incompleta la deja «Parcial», con el faltante pendiente', async () => {
    const enviada = (await get('/api/ordenes/historial')).body.data.find((o) => o.estado === 'Enviada');
    const mantequilla = await idProducto('mantequilla');
    const kumis = await idProducto('kumis');
    const antes = Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [mantequilla])).cantidad);
    // Pedidas: 18 de mantequilla y 12 de kumis. Llegan las 18 de mantequilla y solo 9 de kumis.
    const r = await post(`/api/ordenes/${enviada.id_orden}/completar`, {
      items: [{ id_producto: mantequilla, cantidad_recibida: 18 }, { id_producto: kumis, cantidad_recibida: 9 }],
    });
    expect(r.status).toBe(200);
    expect(r.body.estado).toBe('Parcial');
    expect(r.body.pendientes).toEqual([{ id_producto: kumis, nombre: 'Kumis Alpina 1L', pendiente: 3 }]);
    const despues = Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [mantequilla])).cantidad);
    expect(despues).toBe(antes + 18);
  });
});

describe('venta, fiado y caja', () => {
  beforeAll(async () => { await limpiarBaseDePruebas(); await sembrarYEntrar(); });

  it('no hay caja abierta: vender da 403 hasta que se abre (el guion abre la caja en vivo)', async () => {
    const gaseosa = await idProducto('gaseosa');
    const cuerpo = { items: [{ id_producto: gaseosa, cantidad: 1 }], metodo_pago: 'Efectivo' };
    const sin = await post('/api/registrar-venta-carrito', cuerpo);
    expect(sin.status).toBe(403);
    expect((await post('/api/caja/abrir', { monto_apertura: 40000 })).status).toBe(200);
    const antes = Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [gaseosa])).cantidad);
    const con = await post('/api/registrar-venta-carrito', cuerpo);
    expect(con.status).toBe(200);
    const despues = Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [gaseosa])).cantidad);
    expect(despues).toBe(antes - 1);
  });

  it('la cartera trae los saldos del escenario: dos clientes con deuda y uno sin deuda', async () => {
    const r = await get('/api/clientes');
    expect(r.status).toBe(200);
    const saldoPorNombre = Object.fromEntries(r.body.clientes.map((c) => [c.nombre, Number(c.saldo_pendiente)]));
    const esperado = (clave) => {
      const fiado = esc.ventas.filter((v) => v.metodo_pago === 'Fiado' && v.cliente === clave).reduce((s, v) => s + v.total, 0);
      return fiado - esc.abonos.filter((a) => a.cliente === clave).reduce((s, a) => s + a.monto, 0);
    };
    for (const c of esc.clientes) expect(saldoPorNombre[c.nombre]).toBe(esperado(c.clave));
    expect(Object.values(saldoPorNombre).filter((s) => s > 0)).toHaveLength(2);
    expect(Object.values(saldoPorNombre).filter((s) => s === 0)).toHaveLength(1);
  });

  it('un abono en vivo reduce la deuda de Marta', async () => {
    const lista = (await get('/api/clientes')).body.clientes;
    const marta = lista.find((c) => c.nombre === 'Marta Rodríguez');
    const antes = Number(marta.saldo_pendiente);
    const r = await post(`/api/clientes/${marta.id_cliente}/abonos`, { monto: 5000, metodo_pago: 'Efectivo' });
    expect(r.status).toBe(200);
    const despues = Number((await get('/api/clientes')).body.clientes.find((c) => c.nombre === 'Marta Rodríguez').saldo_pendiente);
    expect(despues).toBe(antes - 5000);
  });

  it('el historial de caja trae la sesión de ayer, cerrada, con la diferencia del arqueo y el desglose por método', async () => {
    const r = await get('/api/caja/historial');
    expect(r.status).toBe(200);
    const ayer = r.body.history.find((s) => s.estado === 'Cerrada');
    expect(ayer).toBeTruthy();
    const s = esc.sesiones[0];
    expect(Number(ayer.diferencia)).toBe(s.diferencia);
    expect(Number(ayer.monto_cierre_calculado)).toBe(s.monto_cierre_calculado);
    expect(ayer.ventas_por_metodo.Efectivo.total).toBe(esc.ventas.filter((v) => v.sesion === 'ayer' && v.metodo_pago === 'Efectivo').reduce((t, v) => t + v.total, 0));
    expect(ayer.ventas_por_metodo.Fiado.cantidad).toBeGreaterThanOrEqual(0);
  });
});

describe('aislamiento y reinicio', () => {
  beforeAll(async () => { await limpiarBaseDePruebas(); await sembrarYEntrar(); });

  it('el Administrador de OTRA tienda no ve alertas, pedidos, clientes ni productos de la demostración', async () => {
    const otra = await crearUsuario({ rol: 'Administrador' });
    const agente = request.agent(app);
    await iniciarSesion(agente, otra);
    const g = (url) => agente.get(url).set(JSON_ACCEPT);
    expect((await g('/api/alertas')).body.alerts).toHaveLength(0);
    expect(Object.keys((await g('/api/ordenes/borradores/resumen')).body.data)).toHaveLength(0);
    expect((await g('/api/ordenes/historial')).body.data).toHaveLength(0);
    expect((await g('/api/clientes')).body.clientes).toHaveLength(0);
    const productos = await g('/api/productos');
    expect(JSON.stringify(productos.body)).not.toMatch(/DEMO-/);
  });

  it('volver a sembrar deja la base equivalente: mismos ids y mismas alertas por tipo (RESTART IDENTITY)', async () => {
    const conteo = async () => {
      const filas = await db.allAsync(`SELECT tipo, COUNT(*) AS n FROM Alertas WHERE resuelta = 0 GROUP BY tipo ORDER BY tipo`);
      const ordenes = await db.allAsync(`SELECT estado, COUNT(*) AS n FROM Ordenes_Compra GROUP BY estado ORDER BY estado`);
      return { filas: filas.map((f) => [f.tipo, Number(f.n)]), ordenes: ordenes.map((o) => [o.estado, Number(o.n)]) };
    };
    const primera = await conteo();
    const idTiendaPrimera = demo.id_tienda;
    await sembrarYEntrar(); // «el reinicio es volver a sembrar»
    expect(demo.id_tienda).toBe(idTiendaPrimera);
    expect(await conteo()).toEqual(primera);
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM Tienda')).n)).toBe(1);
  });

  it('no toca el esquema del panel interno (las cuentas del equipo sobreviven al reinicio)', async () => {
    const { crearMiembroEquipo } = await import('./helpers/fixtures.js');
    const m = await crearMiembroEquipo();
    await sembrarYEntrar();
    const sigue = await db.getAsync('SELECT id_equipo FROM interno.equipo WHERE id_equipo = ?', [m.id_equipo]);
    expect(sigue).toBeTruthy();
  });

  it('rechaza una contraseña vacía o demasiado corta (no siembra una cuenta sin clave)', async () => {
    await expect(sembrarDemo({ hoy: db.getBogotaDate(), contrasena: '' })).rejects.toThrow(/contrase/i);
    await expect(sembrarDemo({ hoy: db.getBogotaDate(), contrasena: 'corta' })).rejects.toThrow(/contrase/i);
  });
});
