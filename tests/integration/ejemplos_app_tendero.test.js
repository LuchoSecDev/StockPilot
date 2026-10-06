/**
 * @file ejemplos_app_tendero.test.js
 * @description Genera y vigila los EJEMPLOS de petición y respuesta reales de la API de la app del Tendero
 * (docs/ejemplos_app_tendero/*.json). Sirven a quien construye la app para ver cómo es cada llamada, y para
 * simular el servidor en sus pruebas sin depender de que Render esté despierto.
 *
 * Cada ejemplo es un archivo de snapshot: la prueba ejecuta el flujo contra el servidor real (base `_test`) y
 * compara. Si la API cambia, esta prueba FALLA: hay que revisar el cambio (se acuerda en el contrato,
 * docs/contrato_api_app_tendero.md) y regenerar los ejemplos con
 *   npx vitest run --config vitest.integration.config.js tests/integration/ejemplos_app_tendero.test.js -u
 * Los valores que cambian en cada ejecución (token CSRF, fechas, cookie) se sustituyen por un marcador
 * legible; los datos de la tienda de ejemplo son inventados. Las contraseñas y códigos nunca se guardan.
 *
 * No incluye alertas ni notificaciones (A1, A2, O2): las genera el motor en segundo plano y su contenido no
 * es determinista.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { crearTienda, crearUsuario, crearProducto } from './helpers/fixtures.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores();
});
afterEach(esperarTrabajoEnSegundoPlano);

const CARPETA = '../../docs/ejemplos_app_tendero';
const FECHA_EJEMPLO = '2026-10-04T15:30:00.000Z';
const CSRF_EJEMPLO = '<valor de GET /api/csrf-token>';

/** Sustituye lo que cambia en cada ejecución por un marcador estable. */
function normalizar(texto) {
  return texto
    .replace(/"[0-9a-f]{64,}"/g, '"<token CSRF: 64 o más caracteres hexadecimales>"')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, FECHA_EJEMPLO);
}
function cookieDocumentada(cookie) {
  return cookie.replace(/connect\.sid=[^;]+/, 'connect.sid=<valor opaco>').replace(/Expires=[^;]+/, 'Expires=<30 minutos después de la última petición>');
}
/** El cuerpo tal como se documenta: sin contraseñas ni códigos reales. */
function cuerpoDocumentado(body) {
  if (!body || typeof body !== 'object') return body;
  const c = { ...body };
  if ('password' in c) c.password = '<contraseña>';
  if ('newPassword' in c) c.newPassword = '<contraseña nueva, mínimo 8 caracteres>';
  if ('token' in c) c.token = '123456';
  return c;
}

/**
 * Hace una petición, comprueba el estado esperado y compara el ejemplo (petición + respuesta) con su archivo.
 * @param {string} nombre - Nombre del archivo: «NN_ID_descripcion» (el ID es el del contrato).
 */
async function ejemplo(nombre, descripcion, agente, metodo, ruta, { body, csrf, canal, clave, esperado = 200 } = {}) {
  let p = agente[metodo](ruta).set('Accept', 'application/json');
  const headers = { Accept: 'application/json' };
  if (canal) { p = p.set('X-Canal', canal); headers['X-Canal'] = canal; }
  if (csrf) { p = p.set('X-CSRF-Token', csrf); headers['X-CSRF-Token'] = CSRF_EJEMPLO; }
  if (clave) { p = p.set('Idempotency-Key', clave); headers['Idempotency-Key'] = clave; }
  if (body !== undefined) { p = p.send(body); headers['Content-Type'] = 'application/json'; }
  const r = await p;
  expect(r.status, `${nombre}: estado inesperado (${JSON.stringify(r.body)})`).toBe(esperado);

  const respHeaders = {};
  const cookie = (r.headers['set-cookie'] || []).find((c) => c.startsWith('connect.sid='));
  if (cookie) respHeaders['Set-Cookie'] = cookieDocumentada(cookie);
  if (r.headers['idempotent-replayed']) respHeaders['Idempotent-Replayed'] = r.headers['idempotent-replayed'];

  const documento = {
    descripcion,
    peticion: { metodo: metodo.toUpperCase(), ruta, headers, ...(body !== undefined ? { body: cuerpoDocumentado(body) } : {}) },
    respuesta: { estado: r.status, ...(Object.keys(respHeaders).length ? { headers: respHeaders } : {}), body: r.body }
  };
  await expect(normalizar(JSON.stringify(documento, null, 2) + '\n')).toMatchFileSnapshot(`${CARPETA}/${nombre}.json`);
  return r;
}

/** Tienda de ejemplo con su dueño y un Tendero (usuario y datos inventados). */
async function tiendaDeEjemplo(extraTendero = {}) {
  const id_tienda = await crearTienda({ nombre_establecimiento: 'Tienda La Esperanza', direccion: 'Calle 10 # 5-20' });
  await crearUsuario({ rol: 'Administrador', id_tienda, usuario: 'dueno_ejemplo', correo: 'dueno@ejemplo.test', nombres: 'Marta Gómez' });
  const tendero = await crearUsuario({ rol: 'Tendero', id_tienda, usuario: 'tendero_ejemplo', correo: 'tendero@ejemplo.test', nombres: 'Carlos Pérez', password: 'ClaveEjemplo123!', ...extraTendero });
  return { id_tienda, tendero };
}

describe('Ejemplos de la API de la app del Tendero', () => {
  it('flujo completo de un turno: sesión, caja, catálogo, venta, egreso, recepción y cierre', async () => {
    const { id_tienda, tendero } = await tiendaDeEjemplo();
    const arroz = await crearProducto({ id_tienda, codigo: 'ARR-001', codigo_barras: '7701234000011', nombre_producto: 'Arroz Diana 1Kg', categoria: 'Granos', precio: 4500, cantidad: 10, costo_compra: 3200 });
    const aceite = await crearProducto({ id_tienda, codigo: 'ACE-001', nombre_producto: 'Aceite Gourmet 1L', categoria: 'Aceites', precio: 12000, cantidad: 5, costo_compra: 9000 });
    await db.runAsync("INSERT INTO Clientes (id_tienda, nombre, celular, limite_credito) VALUES (?, 'Doña Rosa', '3001234567', 5000)", [id_tienda]);

    const app1 = request.agent(app);
    const credenciales = { login: tendero.usuario, password: tendero.password };

    // ── Sesión ──
    await ejemplo('01_S2_login_clave_incorrecta', 'Credenciales incorrectas: el mismo mensaje para usuario inexistente y clave mala.', request.agent(app), 'post', '/api/login',
      { body: { login: tendero.usuario, password: 'otra-clave' }, canal: 'app', esperado: 401 });
    await ejemplo('02_S2_login_ok', 'Inicio de sesión de un Tendero con X-Canal: app. Deja la cookie de sesión (connect.sid), que la app debe guardar y reenviar siempre.', app1, 'post', '/api/login',
      { body: credenciales, canal: 'app' });
    await ejemplo('03_S2_login_sesion_activa_409', 'Un segundo inicio de sesión del mismo Tendero en el mismo canal. Se puede repetir con "force": true para cerrar la otra sesión.', request.agent(app), 'post', '/api/login',
      { body: credenciales, canal: 'app', esperado: 409 });
    const csrf = (await ejemplo('04_S1_csrf_token', 'Token CSRF de la sesión. Se pide DESPUÉS del login y va en X-CSRF-Token en toda escritura.', app1, 'get', '/api/csrf-token')).body.csrfToken;
    await ejemplo('05_S4_session_info', 'Datos de la sesión: tienda, rol y el tope de egresos del Tendero (no fijarlo en la app).', app1, 'get', '/api/session-info');
    await ejemplo('06_S6_escritura_sin_csrf_403', 'Una escritura sin el token CSRF. Se distingue del 403 de rol por el campo "code".', app1, 'post', '/api/caja/abrir', { body: { monto_apertura: 50000 }, esperado: 403 });

    // ── Caja ──
    await ejemplo('07_K1_caja_sin_abrir', 'Estado de la caja del vendedor: no hay ninguna abierta.', app1, 'get', '/api/caja/sesion');
    await ejemplo('08_V2_venta_sin_caja_403', 'No se puede vender sin caja abierta.', app1, 'post', '/api/registrar-venta-carrito',
      { body: { items: [{ id_producto: arroz, cantidad: 1 }] }, csrf, clave: '11111111-aaaa-4bbb-8ccc-000000000001', esperado: 403 });
    await ejemplo('09_K2_abrir_caja', 'Apertura de caja con el efectivo inicial.', app1, 'post', '/api/caja/abrir', { body: { monto_apertura: 50000 }, csrf });
    await ejemplo('10_K1_caja_abierta', 'Estado de la caja con una sesión abierta.', app1, 'get', '/api/caja/sesion');

    // ── Catálogo ──
    await ejemplo('11_C2_producto_por_codigo_de_barras', 'Consulta del escáner: producto por código de barras.', app1, 'get', '/api/productos/barcode/7701234000011');
    await ejemplo('12_C2_codigo_no_encontrado_404', 'Código de barras que no existe en la tienda.', app1, 'get', '/api/productos/barcode/0000000000000', { esperado: 404 });
    await ejemplo('13_C1_lista_de_productos', 'Todos los productos de la tienda. Un Tendero NO recibe costo_compra ni clasificacion_abc.', app1, 'get', '/api/productos');
    await ejemplo('14_C3_vincular_codigo_de_barras', 'Asocia un código de barras a un producto que no lo tenía.', app1, 'put', `/api/productos/${aceite}/link-barcode`, { body: { codigo_barras: '7701234000028' }, csrf });
    await ejemplo('15_C3_codigo_ya_vinculado_409', 'Intentar vincular un código que ya pertenece a otro producto de la tienda.', app1, 'put', `/api/productos/${aceite}/link-barcode`, { body: { codigo_barras: '7701234000011' }, csrf, esperado: 409 });

    // ── Vender ──
    await ejemplo('16_V1_clientes', 'Clientes de la tienda, para elegir a quién se le fía.', app1, 'get', '/api/clientes');
    const claveVenta = '4f9d2c1e-7a3b-4c58-9e10-5b6a8d0c1f22';
    await ejemplo('17_V2_venta_ok', 'Venta del carrito en efectivo, con Idempotency-Key (un UUID nuevo por venta).', app1, 'post', '/api/registrar-venta-carrito',
      { body: { items: [{ id_producto: arroz, cantidad: 2 }], metodo_pago: 'Efectivo', efectivo_recibido: 10000 }, csrf, clave: claveVenta });
    await ejemplo('18_V2_reintento_misma_clave_200', 'El reintento de la MISMA venta (misma clave): devuelve la misma respuesta con Idempotent-Replayed: true y no duplica nada.', app1, 'post', '/api/registrar-venta-carrito',
      { body: { items: [{ id_producto: arroz, cantidad: 2 }], metodo_pago: 'Efectivo', efectivo_recibido: 10000 }, csrf, clave: claveVenta });
    await ejemplo('19_V2_misma_clave_otra_carga_422', 'La misma clave con otra carga es un error de la app (reutilizó una clave): no se registra nada.', app1, 'post', '/api/registrar-venta-carrito',
      { body: { items: [{ id_producto: arroz, cantidad: 3 }], metodo_pago: 'Efectivo' }, csrf, clave: claveVenta, esperado: 422 });
    await ejemplo('20_V2_stock_insuficiente_400', 'Pedir más de lo que hay: no se descuenta nada.', app1, 'post', '/api/registrar-venta-carrito',
      { body: { items: [{ id_producto: arroz, cantidad: 999 }] }, csrf, clave: '22222222-aaaa-4bbb-8ccc-000000000002', esperado: 400 });
    await ejemplo('21_V2_metodo_de_pago_invalido_400', 'metodo_pago solo admite Efectivo, Tarjeta, Transferencia o Fiado, con esa escritura exacta.', app1, 'post', '/api/registrar-venta-carrito',
      { body: { items: [{ id_producto: arroz, cantidad: 1 }], metodo_pago: 'efectivo' }, csrf, clave: '33333333-aaaa-4bbb-8ccc-000000000003', esperado: 400 });
    await ejemplo('22_V2_fiado_supera_el_cupo_400', 'Venta fiada que deja al cliente por encima de su cupo de crédito.', app1, 'post', '/api/registrar-venta-carrito',
      { body: { items: [{ id_producto: arroz, cantidad: 3 }], metodo_pago: 'Fiado', id_cliente: 1 }, csrf, clave: '44444444-aaaa-4bbb-8ccc-000000000004', esperado: 400 });
    await ejemplo('23_V3_ventas_del_turno', 'Ventas de la caja abierta del usuario (?turno=actual). Una fila por producto vendido.', app1, 'get', '/api/ventas?turno=actual');

    // ── Egresos y mercancía ──
    await ejemplo('24_K4_egreso_ok', 'Gasto de caja chica. Queda "Registrado", pendiente de aprobación del Administrador.', app1, 'post', '/api/caja/egreso',
      { body: { monto: 10000, motivo: 'Bolsas y hielo', categoria: 'Otro' }, csrf });
    await ejemplo('25_K4_egreso_sobre_el_tope_400', 'Egreso mayor al tope del Tendero (limiteEgresoTendero de session-info).', app1, 'post', '/api/caja/egreso',
      { body: { monto: 150001, motivo: 'Gasto grande' }, csrf, esperado: 400 });
    await ejemplo('26_M1_entrada_de_mercancia', 'Recepción de mercancía: suma el stock y deja el movimiento en el Kardex.', app1, 'post', '/api/inventario/entrada',
      { body: { id_producto: arroz, cantidad: 6, observacion: 'Pedido del lunes' }, csrf });

    // ── Cierre y fin de sesión ──
    // Antes de cerrar: contar → declarar → ver la diferencia → confirmar o recontar. El arqueo previo no cierra nada.
    await ejemplo('30_K5_arqueo_previo', 'Vista previa del cierre: con el efectivo contado devuelve el arqueo (lo que debería haber y la diferencia) SIN cerrar la caja. Si se confirma con el mismo monto, [K3] devuelve este mismo arqueo.', app1, 'post', '/api/caja/arqueo-previo', { body: { monto_cierre_declarado: 57500 }, csrf });
    await ejemplo('31_K5_monto_invalido_400', 'El monto declarado debe ser un número finito mayor o igual a 0 (también un texto numérico). Con «abc», nulo o negativo: 400, y la caja sigue abierta.', app1, 'post', '/api/caja/arqueo-previo', { body: { monto_cierre_declarado: 'abc' }, csrf, esperado: 400 });
    await ejemplo('27_K3_cerrar_caja', 'Cierre de caja con el efectivo contado. Devuelve el arqueo: diferencia = declarado − calculado.', app1, 'post', '/api/caja/cerrar', { body: { monto_cierre_declarado: 57500 }, csrf });
    await ejemplo('28_S5_logout', 'Cierra la sesión y libera el candado de su canal.', app1, 'post', '/api/logout', { body: {}, csrf });
    await ejemplo('29_S6_sin_sesion_401', 'Cualquier ruta protegida sin sesión (o con la sesión caducada). Requiere Accept: application/json; sin esa cabecera sería un 302.', app1, 'get', '/api/productos', { esperado: 401 });
  });

  it('segundo factor del Administrador: login, código y sesión válida', async () => {
    const id_tienda = await crearTienda({ nombre_establecimiento: 'Tienda La Esperanza', direccion: 'Calle 10 # 5-20' });
    const admin = await crearUsuario({ rol: 'Administrador', id_tienda, usuario: 'dueno_ejemplo', correo: 'dueno@ejemplo.test', nombres: 'Marta Gómez', password: 'ClaveEjemplo123!' });
    // Se activa el 2FA de la cuenta (esto se hace en la web); luego se cierra esa sesión.
    const config = request.agent(app);
    await config.post('/api/login').send({ login: admin.usuario, password: admin.password });
    const csrfConfig = (await config.get('/api/csrf-token')).body.csrfToken;
    const gen = await config.post('/api/2fa/generate').set('X-CSRF-Token', csrfConfig);
    await config.post('/api/2fa/verify').set('X-CSRF-Token', csrfConfig).send({ token: authenticator.generate(gen.body.secret) });
    await config.post('/api/logout').set('X-CSRF-Token', csrfConfig);

    const s = request.agent(app);
    await ejemplo('40_S2_login_con_segundo_factor', 'Login de una cuenta con 2FA: todavía NO hay sesión; falta el código de 6 dígitos.', s, 'post', '/api/login',
      { body: { login: admin.usuario, password: admin.password }, canal: 'app' });
    const csrf = (await ejemplo('41_S1_csrf_token_tras_el_login', 'El CSRF se pide después del login (también con 2FA) y sigue valiendo después del código.', s, 'get', '/api/csrf-token')).body.csrfToken;
    await ejemplo('42_S3_codigo_incorrecto_401', 'Código incorrecto: la sesión sigue "a medias" y se puede reintentar.', s, 'post', '/api/2fa/verify', { body: { token: '000000' }, csrf, esperado: 401 });
    await ejemplo('43_S3_verificar_codigo_ok', 'Código correcto: desde aquí la sesión es válida.', s, 'post', '/api/2fa/verify', { body: { token: authenticator.generate(gen.body.secret) }, csrf });
    await ejemplo('44_S4_session_info_administrador', 'session-info de un Administrador con 2FA activo.', s, 'get', '/api/session-info');
  });

  it('primer inicio de sesión de un Tendero con contraseña temporal', async () => {
    const { tendero } = await tiendaDeEjemplo({ cambio_clave_forzoso: true });
    const s = request.agent(app);
    await ejemplo('50_S2_login_con_clave_temporal', 'Primer inicio de sesión: cambioClaveForzoso es true. La app debe mostrar «elige tu contraseña» antes de dejar operar.', s, 'post', '/api/login',
      { body: { login: tendero.usuario, password: tendero.password }, canal: 'app' });
    const csrf = (await s.get('/api/csrf-token')).body.csrfToken;
    await ejemplo('51_S7_primer_cambio_de_contrasena', 'Establece la contraseña definitiva. La sesión sigue abierta y cambioClaveForzoso pasa a false.', s, 'put', '/api/perfil/first-password', { body: { newPassword: 'NuevaClave2026!' }, csrf });
  });
});
