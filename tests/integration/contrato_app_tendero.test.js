/**
 * @file contrato_app_tendero.test.js
 * @description Pruebas del contrato de la API que usa la app nativa del Tendero
 * (docs/contrato_api_app_tendero.md; plan 07, secciones 6.2 y 6.3). Cada `describe` lleva el ID del
 * endpoint tal como aparece en el documento ([S1], [K2]…). Lo que se fija aquí es lo que la app puede
 * esperar: método, ruta, cuerpo, forma de la respuesta y errores. Si una de estas pruebas cambia, el
 * contrato cambió: hay que acordarlo con quien construye la app y actualizar el documento.
 *
 * Los casos marcados «COMPORTAMIENTO ACTUAL» fijan hallazgos conocidos (se documentan tal cual
 * funcionan hoy y fallarán a propósito cuando se corrijan, para recordar actualizar el contrato).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
import { obtenerCsrfToken } from './helpers/sesion.js';
import { dosTiendas } from './helpers/tiendas.js';
import { esperarTrabajoEnSegundoPlano } from './helpers/tiempo.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores();
});

const JSON_ACCEPT = { Accept: 'application/json' };
const ERROR = expect.any(String);

/** Tienda A (admin + tendero ya logueados) y tienda B (admin + tendero), con un producto y la caja de A cerrada. */
async function escenario() {
  const t = await dosTiendas(app);
  const producto = await crearProducto({ id_tienda: t.adminA.id_tienda, nombre_producto: 'Arroz Diana 1Kg', codigo_barras: '7701234000011', precio: 4500, cantidad: 10 });
  const get = (s, url) => s.agente.get(url).set(JSON_ACCEPT);
  const post = (s, url, cuerpo = {}) => s.agente.post(url).set('X-CSRF-Token', s.csrfToken).send(cuerpo);
  const put = (s, url, cuerpo = {}) => s.agente.put(url).set('X-CSRF-Token', s.csrfToken).send(cuerpo);
  const patch = (s, url, cuerpo = {}) => s.agente.patch(url).set('X-CSRF-Token', s.csrfToken).send(cuerpo);
  const abrirCaja = (s, monto = 50000) => post(s, '/api/caja/abrir', { monto_apertura: monto });
  return { ...t, producto, get, post, put, patch, abrirCaja };
}

// ───────────────────────────── SESIÓN Y SEGURIDAD ─────────────────────────────

describe('[S1] GET /api/csrf-token', () => {
  it('sin sesión y con sesión devuelve { csrfToken } (cadena larga); es distinto en cada sesión', async () => {
    const anonimo = request.agent(app);
    const r1 = await anonimo.get('/api/csrf-token').set(JSON_ACCEPT);
    expect(r1.status).toBe(200);
    expect(r1.body).toEqual({ csrfToken: expect.stringMatching(/^[0-9a-f]{64,}$/) });

    const { tenderoA, tenderoB } = await dosTiendas(app);
    expect(tenderoA.csrfToken).not.toBe(tenderoB.csrfToken);
  });

  it('el token pertenece a la sesión: tras iniciar sesión hay que pedir uno nuevo (el de antes del login ya no sirve)', async () => {
    const u = await crearUsuario({ rol: 'Tendero' });
    const agente = request.agent(app);
    const antes = (await agente.get('/api/csrf-token').set(JSON_ACCEPT)).body.csrfToken;
    expect((await agente.post('/api/login').send({ login: u.usuario, password: u.password })).status).toBe(200);

    const conViejo = await agente.post('/api/caja/abrir').set('X-CSRF-Token', antes).send({ monto_apertura: 1000 });
    expect(conViejo.status).toBe(403);
    expect(conViejo.body.code).toBe('CSRF_INVALID');
    const nuevo = (await agente.get('/api/csrf-token').set(JSON_ACCEPT)).body.csrfToken;
    expect((await agente.post('/api/caja/abrir').set('X-CSRF-Token', nuevo).send({ monto_apertura: 1000 })).status).toBe(200);
  });
});

describe('[S2] POST /api/login', () => {
  it('200 (Tendero): { success, message, user: { nombres, rol, cambioClaveForzoso, needs2FASetup } } y cookie de sesión', async () => {
    const u = await crearUsuario({ rol: 'Tendero', nombres: 'Tomás Tendero' });
    const r = await request(app).post('/api/login').set('X-Canal', 'app').send({ login: u.usuario, password: u.password });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      success: true,
      message: 'Login exitoso',
      user: { nombres: 'Tomás Tendero', rol: 'Tendero', cambioClaveForzoso: false, needs2FASetup: false }
    });
    expect(r.headers['set-cookie'].join(';')).toMatch(/connect\.sid=/);
    expect(r.headers['set-cookie'].join(';')).toMatch(/HttpOnly/i);
  });

  it('se puede entrar con el usuario o con el correo', async () => {
    const u = await crearUsuario({ rol: 'Tendero' });
    expect((await request(app).post('/api/login').send({ login: u.correo, password: u.password })).status).toBe(200);
  });

  it('400 sin login o sin password; 401 con credenciales incorrectas (mismo mensaje para usuario inexistente y clave mala)', async () => {
    const u = await crearUsuario({ rol: 'Tendero' });
    expect((await request(app).post('/api/login').send({})).body).toEqual({ success: false, error: 'Faltan campos obligatorios' });
    expect((await request(app).post('/api/login').send({ login: u.usuario })).status).toBe(400);

    const mala = await request(app).post('/api/login').send({ login: u.usuario, password: 'incorrecta' });
    const inexistente = await request(app).post('/api/login').send({ login: 'no_existe_nadie', password: 'x' });
    expect(mala.status).toBe(401);
    expect(inexistente.status).toBe(401);
    expect(mala.body).toEqual({ success: false, error: 'Usuario/correo o contraseña incorrectos' });
    expect(inexistente.body).toEqual(mala.body);
  });

  it('409 { code: "SESSION_ACTIVE" } si ese canal ya tiene sesión; con force:true la reemplaza (la anterior recibe 401 CONCURRENT_SESSION)', async () => {
    const u = await crearUsuario({ rol: 'Tendero' });
    const vieja = request.agent(app);
    await vieja.post('/api/login').set('X-Canal', 'app').send({ login: u.usuario, password: u.password });

    const choque = await request(app).post('/api/login').set('X-Canal', 'app').send({ login: u.usuario, password: u.password });
    expect(choque.status).toBe(409);
    expect(choque.body).toEqual({ success: false, error: ERROR, code: 'SESSION_ACTIVE' });

    const forzado = await request(app).post('/api/login').set('X-Canal', 'app').send({ login: u.usuario, password: u.password, force: true });
    expect(forzado.status).toBe(200);
    const trasForce = await vieja.get('/api/caja/sesion').set(JSON_ACCEPT);
    expect(trasForce.status).toBe(401);
    expect(trasForce.body).toEqual({ error: 'Sesión cerrada', message: ERROR, code: 'CONCURRENT_SESSION' });
  });

  it('el límite de intentos fallidos (10 por IP cada 15 min) responde 429 con { success:false, error }', async () => {
    for (let i = 0; i < 10; i++) await request(app).post('/api/login').send({ login: 'nadie', password: 'x' });
    const r = await request(app).post('/api/login').send({ login: 'nadie', password: 'x' });
    expect(r.status).toBe(429);
    expect(r.body).toEqual({ success: false, error: ERROR });
    expect(r.headers['ratelimit-remaining']).toBe('0');
  });
});

describe('[S3] POST /api/2fa/verify (completar el login con segundo factor)', () => {
  async function usuarioConDosFactores() {
    const u = await crearUsuario({ rol: 'Tendero' });
    const s = request.agent(app);
    await s.post('/api/login').send({ login: u.usuario, password: u.password });
    const csrf = await obtenerCsrfToken(s);
    const gen = await s.post('/api/2fa/generate').set('X-CSRF-Token', csrf);
    await s.post('/api/2fa/verify').set('X-CSRF-Token', csrf).send({ token: authenticator.generate(gen.body.secret) });
    await s.post('/api/logout').set('X-CSRF-Token', csrf);
    return { ...u, secreto: gen.body.secret };
  }

  it('flujo: login → { success, require2FA: true } (sin sesión todavía) → verify con el código → 200 con user; el CSRF se pide DESPUÉS del login', async () => {
    const u = await usuarioConDosFactores();
    const s = request.agent(app);
    const login = await s.post('/api/login').set('X-Canal', 'app').send({ login: u.usuario, password: u.password });
    expect(login.status).toBe(200);
    expect(login.body).toEqual({ success: true, require2FA: true, message: ERROR });

    const aMedias = await s.get('/api/caja/sesion').set(JSON_ACCEPT);
    expect(aMedias.status).toBe(401);

    const csrf = await obtenerCsrfToken(s);
    const verify = await s.post('/api/2fa/verify').set('X-CSRF-Token', csrf).send({ token: authenticator.generate(u.secreto) });
    expect(verify.status).toBe(200);
    expect(verify.body).toEqual({ success: true, message: ERROR, user: { nombres: ERROR, rol: 'Tendero', cambioClaveForzoso: false, needs2FASetup: false } });

    // Completado el 2FA la sesión es válida y el MISMO token CSRF sigue sirviendo (no se regenera la sesión).
    expect((await s.get('/api/caja/sesion').set(JSON_ACCEPT)).status).toBe(200);
    expect((await s.post('/api/caja/abrir').set('X-CSRF-Token', csrf).send({ monto_apertura: 1000 })).status).toBe(200);
  });

  it('400 sin token; 401 con un código incorrecto (y la sesión sigue a medias); 401 si no hay login previo', async () => {
    const u = await usuarioConDosFactores();
    const s = request.agent(app);
    await s.post('/api/login').send({ login: u.usuario, password: u.password });
    const csrf = await obtenerCsrfToken(s);

    const sinToken = await s.post('/api/2fa/verify').set('X-CSRF-Token', csrf).send({});
    expect(sinToken.status).toBe(400);
    expect(sinToken.body).toEqual({ success: false, error: 'Token es requerido' });

    const malo = await s.post('/api/2fa/verify').set('X-CSRF-Token', csrf).send({ token: '000000' });
    expect(malo.status).toBe(401);
    expect(malo.body).toEqual({ success: false, error: 'Código inválido o ha expirado.' });
    expect((await s.get('/api/caja/sesion').set(JSON_ACCEPT)).status).toBe(401);

    const sinLogin = await request(app).post('/api/2fa/verify').send({ token: '123456' });
    expect(sinLogin.status).toBe(401);
    expect(sinLogin.body).toEqual({ success: false, error: 'No autorizado o sesión expirada' });
  });

  it('a los 5 códigos incorrectos de la misma cuenta responde 429', async () => {
    const u = await usuarioConDosFactores();
    const s = request.agent(app);
    await s.post('/api/login').send({ login: u.usuario, password: u.password });
    const csrf = await obtenerCsrfToken(s);
    for (let i = 0; i < 5; i++) await s.post('/api/2fa/verify').set('X-CSRF-Token', csrf).send({ token: '000000' });
    const sexto = await s.post('/api/2fa/verify').set('X-CSRF-Token', csrf).send({ token: authenticator.generate(u.secreto) });
    expect(sexto.status).toBe(429);
  });
});

describe('[S4] GET /api/session-info', () => {
  it('200 con los datos de la sesión (userId, tiendaId, rol, límite de egreso…) y 401 sin sesión', async () => {
    const { tenderoA } = await dosTiendas(app);
    const r = await tenderoA.agente.get('/api/session-info').set(JSON_ACCEPT);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      success: true,
      userId: tenderoA.id_usuario,
      tiendaId: tenderoA.id_tienda,
      tiendaNombre: ERROR,
      limiteEgresoTendero: expect.anything(), // numérico como texto, p. ej. "150000.00"
      rol: 'Tendero',
      nombres: ERROR,
      cambioClaveForzoso: false,
      needs2FASetup: false,
      is2FAEnabled: false
    });
    expect(Number(r.body.limiteEgresoTendero)).toBe(150000);

    const sin = await request(app).get('/api/session-info').set(JSON_ACCEPT);
    expect(sin.status).toBe(401);
    expect(sin.body).toEqual({ success: false, error: 'Sesión no iniciada' });
  });
});

describe('[S5] POST /api/logout', () => {
  it('200 { success, message }, invalida la sesión y libera el candado de su canal; funciona aunque la sesión ya no sea válida', async () => {
    const u = await crearUsuario({ rol: 'Tendero' });
    const s = request.agent(app);
    await s.post('/api/login').set('X-Canal', 'app').send({ login: u.usuario, password: u.password });
    const csrf = await obtenerCsrfToken(s);

    const salida = await s.post('/api/logout').set('X-CSRF-Token', csrf);
    expect(salida.status).toBe(200);
    expect(salida.body).toEqual({ success: true, message: 'Sesión cerrada' });
    expect((await s.get('/api/caja/sesion').set(JSON_ACCEPT)).status).toBe(401);
    expect((await request(app).post('/api/login').set('X-Canal', 'app').send({ login: u.usuario, password: u.password })).status).toBe(200);
  });
});

describe('[S7] PUT /api/perfil/first-password (primer cambio de contraseña)', () => {
  // Las cuentas de Tendero que crea el Administrador nacen con cambio_clave_forzoso = true.
  async function conClaveTemporal() {
    const u = await crearUsuario({ rol: 'Tendero', cambio_clave_forzoso: true });
    const agente = request.agent(app);
    const login = await agente.post('/api/login').set('X-Canal', 'app').send({ login: u.usuario, password: u.password });
    const csrf = await obtenerCsrfToken(agente);
    return { ...u, agente, csrf, login };
  }
  const cambiar = (s, newPassword) => s.agente.put('/api/perfil/first-password').set('X-CSRF-Token', s.csrf).send({ newPassword });

  it('el login avisa con user.cambioClaveForzoso = true; el cambio responde 200 { success, message } y la marca se apaga', async () => {
    const s = await conClaveTemporal();
    expect(s.login.body.user.cambioClaveForzoso).toBe(true);

    const r = await cambiar(s, 'ClaveNueva2026!');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, message: 'Contraseña establecida exitosamente' });
    expect((await s.agente.get('/api/session-info').set(JSON_ACCEPT)).body.cambioClaveForzoso).toBe(false);

    // La clave anterior deja de servir, la nueva sí, y ya no vuelve a pedir el cambio (force: la sesión de arriba sigue abierta).
    expect((await request(app).post('/api/login').set('X-Canal', 'app').send({ login: s.usuario, password: s.password, force: true })).status).toBe(401);
    const entrada = await request(app).post('/api/login').set('X-Canal', 'app').send({ login: s.usuario, password: 'ClaveNueva2026!', force: true });
    expect(entrada.status).toBe(200);
    expect(entrada.body.user.cambioClaveForzoso).toBe(false);
  });

  it('400 con menos de 8 caracteres, ausente, o igual a la contraseña temporal; la contraseña no cambia', async () => {
    const s = await conClaveTemporal();
    for (const [clave, mensaje] of [['corta', 'La contraseña debe tener al menos 8 caracteres'], [undefined, 'La contraseña debe tener al menos 8 caracteres'], [s.password, 'La nueva contraseña no puede ser igual a la que tienes asignada actualmente.']]) {
      const r = await cambiar(s, clave);
      expect(r.status, String(clave)).toBe(400);
      expect(r.body).toEqual({ success: false, error: mensaje });
    }
    expect((await s.agente.get('/api/session-info').set(JSON_ACCEPT)).body.cambioClaveForzoso).toBe(true);
  });

  it('400 «Acción no permitida» si la cuenta no tiene un cambio pendiente; 401 sin sesión; 403 sin token CSRF', async () => {
    const { tenderoA } = await dosTiendas(app);
    const noPendiente = await tenderoA.agente.put('/api/perfil/first-password').set('X-CSRF-Token', tenderoA.csrfToken).send({ newPassword: 'ClaveNueva2026!' });
    expect(noPendiente.status).toBe(400);
    expect(noPendiente.body).toEqual({ success: false, error: 'Acción no permitida' });

    const sinSesion = await request(app).put('/api/perfil/first-password').send({ newPassword: 'ClaveNueva2026!' });
    expect([401, 403]).toContain(sinSesion.status);

    const s = await conClaveTemporal();
    const sinToken = await s.agente.put('/api/perfil/first-password').send({ newPassword: 'ClaveNueva2026!' });
    expect(sinToken.status).toBe(403);
    expect(sinToken.body.code).toBe('CSRF_INVALID');
  });

  it('COMPORTAMIENTO ACTUAL: el servidor NO bloquea las demás rutas mientras el cambio está pendiente; es la app la que debe exigirlo antes de dejar operar', async () => {
    const s = await conClaveTemporal();
    expect((await s.agente.get('/api/caja/sesion').set(JSON_ACCEPT)).status).toBe(200);
    expect((await s.agente.get('/api/productos').set(JSON_ACCEPT)).status).toBe(200);
  });
});

describe('[S6] Errores transversales (valen para todos los endpoints protegidos)', () => {
  it('sin sesión: 401 { error: "No autenticado" } SI la app manda Accept: application/json; sin esa cabecera responde 302 a "/"', async () => {
    const conAccept = await request(app).get('/api/caja/sesion').set(JSON_ACCEPT);
    expect(conAccept.status).toBe(401);
    expect(conAccept.body).toEqual({ error: 'No autenticado' });

    const sinAccept = await request(app).get('/api/caja/sesion');
    expect(sinAccept.status).toBe(302);
    expect(sinAccept.headers.location).toBe('/');
  });

  it('403 { error: "Se requieren permisos de administrador" } cuando el Tendero llama a una ruta del Administrador', async () => {
    const { tenderoA } = await dosTiendas(app);
    const r = await tenderoA.agente.post('/api/productos/admin').set('X-CSRF-Token', tenderoA.csrfToken).send({ codigo: 'X' });
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ error: 'Se requieren permisos de administrador' });
  });

  it('una escritura sin token CSRF, o con uno inválido, responde 403 { success:false, code:"CSRF_INVALID", error } (C4, corregido)', async () => {
    const { tenderoA } = await dosTiendas(app);
    for (const cabecera of [undefined, 'token-falso']) {
      let p = tenderoA.agente.post('/api/caja/abrir');
      if (cabecera) p = p.set('X-CSRF-Token', cabecera);
      const r = await p.send({ monto_apertura: 1000 });
      expect(r.status).toBe(403);
      expect(r.body).toEqual({ success: false, code: 'CSRF_INVALID', error: expect.stringMatching(/csrf-token/) });
    }
  });

  it('las lecturas (GET) no exigen CSRF; las escrituras sí (se comprueba con POST, PUT y PATCH)', async () => {
    const e = await escenario();
    expect((await e.get(e.tenderoA, '/api/productos')).status).toBe(200);
    const sinToken = [
      await e.tenderoA.agente.post('/api/inventario/entrada').send({ id_producto: e.producto, cantidad: 1 }),
      await e.tenderoA.agente.put(`/api/productos/${e.producto}/link-barcode`).send({ codigo_barras: '1' }),
      await e.tenderoA.agente.patch('/api/alertas/1/resolve').send({})
    ];
    expect(sinToken.map((r) => r.status)).toEqual([403, 403, 403]);
    expect(Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [e.producto])).cantidad)).toBe(10);
  });
});

// ───────────────────────────── CATÁLOGO ─────────────────────────────

describe('[C1] GET /api/productos', () => {
  it('200 con un ARREGLO (sin paginación) de los productos de la tienda de la sesión, con los campos que usa la app', async () => {
    const e = await escenario();
    await crearProducto({ id_tienda: e.adminB.id_tienda, nombre_producto: 'De otra tienda' });
    const r = await e.get(e.tenderoA, '/api/productos');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).toMatchObject({
      id_producto: e.producto,
      codigo_barras: '7701234000011',
      nombre_producto: 'Arroz Diana 1Kg',
      categoria: 'General',
      precio: '4500.00', // los importes llegan como TEXTO con dos decimales
      cantidad: 10, // las cantidades, como número
      estado: 'Disponible',
      nivel_stock: 'ok' // agotado | critico | reponer | ok
    });
  });

  it('la respuesta al Tendero NO incluye costo_compra ni clasificacion_abc (datos de margen: solo el Administrador); detalle en datos_de_margen.test.js', async () => {
    const e = await escenario();
    const r = await e.get(e.tenderoA, '/api/productos');
    expect(r.body[0]).not.toHaveProperty('costo_compra');
    expect(r.body[0]).not.toHaveProperty('clasificacion_abc');
  });
});

describe('[C2] GET /api/productos/barcode/:code', () => {
  it('200 { success, data: producto } si existe en la tienda; 404 { success:false, error } si no; 404 también si es de otra tienda', async () => {
    const e = await escenario();
    const ok = await e.get(e.tenderoA, '/api/productos/barcode/7701234000011');
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ success: true, data: expect.objectContaining({ id_producto: e.producto, nombre_producto: 'Arroz Diana 1Kg', cantidad: 10 }) });

    const no = await e.get(e.tenderoA, '/api/productos/barcode/0000000000000');
    expect(no.status).toBe(404);
    expect(no.body).toEqual({ success: false, error: 'Producto no encontrado' });

    const ajeno = await e.get(e.tenderoB, '/api/productos/barcode/7701234000011');
    expect(ajeno.status).toBe(404);
  });
});

describe('[C3] PUT /api/productos/:id/link-barcode', () => {
  it('200 { success, message } y el producto queda con ese código; el Tendero SÍ puede (matriz de roles I0)', async () => {
    const e = await escenario();
    const sinCodigo = await crearProducto({ id_tienda: e.adminA.id_tienda, nombre_producto: 'Leche' });
    const r = await e.put(e.tenderoA, `/api/productos/${sinCodigo}/link-barcode`, { codigo_barras: '7701234000099' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, message: 'Código vinculado correctamente' });
    expect((await e.get(e.tenderoA, '/api/productos/barcode/7701234000099')).body.data.id_producto).toBe(sinCodigo);
  });

  it('400 sin código; 404 si el producto no existe o es de otra tienda', async () => {
    const e = await escenario();
    expect((await e.put(e.tenderoA, `/api/productos/${e.producto}/link-barcode`, {})).body).toEqual({ success: false, error: 'Código de barras es requerido' });
    expect((await e.put(e.tenderoA, '/api/productos/99999/link-barcode', { codigo_barras: '1' })).status).toBe(404);
    const ajeno = await e.put(e.tenderoB, `/api/productos/${e.producto}/link-barcode`, { codigo_barras: '1' });
    expect(ajeno.status).toBe(404);
  });

  it('409 { success:false, code:"BARCODE_DUPLICADO", error } si el código ya lo tiene OTRO producto de la tienda (también contra su SKU); el mismo producto puede repetirlo; detalle en link_barcode.test.js', async () => {
    const e = await escenario();
    const otro = await crearProducto({ id_tienda: e.adminA.id_tienda, nombre_producto: 'Leche' });
    const r = await e.put(e.tenderoA, `/api/productos/${otro}/link-barcode`, { codigo_barras: '7701234000011' }); // el del Arroz
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ success: false, code: 'BARCODE_DUPLICADO', error: 'Ese código ya pertenece a «Arroz Diana 1Kg».' });
    expect(await db.allAsync("SELECT id_producto FROM Productos WHERE codigo_barras = '7701234000011'")).toHaveLength(1);
    expect((await e.put(e.tenderoA, `/api/productos/${e.producto}/link-barcode`, { codigo_barras: '7701234000011' })).status).toBe(200);
  });
});

// ───────────────────────────── CAJA ─────────────────────────────

describe('[K1] GET /api/caja/sesion', () => {
  it('{ active:false } sin caja abierta; { active:true, session } con ella (importes como texto, fechas ISO)', async () => {
    const e = await escenario();
    expect((await e.get(e.tenderoA, '/api/caja/sesion')).body).toEqual({ active: false });

    const abierta = await e.abrirCaja(e.tenderoA, 50000);
    const r = await e.get(e.tenderoA, '/api/caja/sesion');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      active: true,
      session: {
        id_sesion: abierta.body.id_sesion,
        id_tienda: e.tenderoA.id_tienda,
        id_vendedor: e.tenderoA.id_usuario,
        monto_apertura: '50000.00',
        monto_cierre_declarado: null,
        monto_cierre_calculado: null,
        diferencia: null,
        fecha_apertura: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        fecha_cierre: null,
        estado: 'Abierta'
      }
    });
  });

  it('la caja es POR VENDEDOR: la del Administrador de la misma tienda no cuenta como la del Tendero', async () => {
    const e = await escenario();
    await e.abrirCaja(e.adminA);
    expect((await e.get(e.tenderoA, '/api/caja/sesion')).body).toEqual({ active: false });
  });
});

describe('[K2] POST /api/caja/abrir', () => {
  it('200 { success, message, id_sesion }; 400 { error } si ya hay una abierta; 400 con monto ausente, negativo o no numérico', async () => {
    const e = await escenario();
    const ok = await e.abrirCaja(e.tenderoA, 50000);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ success: true, message: 'Caja abierta exitosamente', id_sesion: expect.any(Number) });

    const otra = await e.abrirCaja(e.tenderoA);
    expect(otra.status).toBe(400);
    expect(otra.body).toEqual({ error: 'Ya tienes una sesión de caja abierta.' });

    const t2 = await crearUsuario({ rol: 'Tendero', id_tienda: e.adminB.id_tienda });
    const s2 = request.agent(app);
    await s2.post('/api/login').send({ login: t2.usuario, password: t2.password });
    const sesion2 = { agente: s2, csrfToken: await obtenerCsrfToken(s2) };
    for (const cuerpo of [{}, { monto_apertura: -1 }, { monto_apertura: 'abc' }]) {
      const r = await e.post(sesion2, '/api/caja/abrir', cuerpo);
      expect(r.status, JSON.stringify(cuerpo)).toBe(400);
      expect(r.body).toEqual({ error: 'El monto de apertura no es válido.' });
    }
  });
  // La atomicidad (20 aperturas simultáneas → una sola caja) está en caja_apertura_concurrencia.test.js.
});

describe('[K3] POST /api/caja/cerrar', () => {
  it('200 { success, message, arqueo } con apertura, ventas en efectivo, abonos, egresos, calculado, declarado y diferencia; la caja queda cerrada', async () => {
    const e = await escenario();
    await e.abrirCaja(e.tenderoA, 50000);
    await e.post(e.tenderoA, '/api/registrar-venta-carrito', { items: [{ id_producto: e.producto, cantidad: 2 }] }); // 9.000 en efectivo
    await e.post(e.tenderoA, '/api/caja/egreso', { monto: 10000, motivo: 'Bolsas y hielo' });

    const r = await e.post(e.tenderoA, '/api/caja/cerrar', { monto_cierre_declarado: 60000 });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      success: true,
      message: 'Caja cerrada exitosamente (Arqueo completo)',
      arqueo: { monto_apertura: 50000, ventas_efectivo: 9000, abonos_efectivo: 0, egresos: 10000, monto_cierre_calculado: 49000, monto_cierre_declarado: 60000, diferencia: 11000 }
    });
    expect((await e.get(e.tenderoA, '/api/caja/sesion')).body).toEqual({ active: false });
    await esperarTrabajoEnSegundoPlano();
  });

  it('400 { error } sin caja abierta; 400 con monto declarado ausente o negativo (la caja sigue abierta)', async () => {
    const e = await escenario();
    const sinCaja = await e.post(e.tenderoA, '/api/caja/cerrar', { monto_cierre_declarado: 0 });
    expect(sinCaja.status).toBe(400);
    expect(sinCaja.body).toEqual({ error: 'No hay ninguna caja abierta para cerrar.' });

    await e.abrirCaja(e.tenderoA);
    for (const cuerpo of [{}, { monto_cierre_declarado: -5 }]) {
      const r = await e.post(e.tenderoA, '/api/caja/cerrar', cuerpo);
      expect(r.status).toBe(400);
      expect(r.body).toEqual({ error: 'El monto de cierre declarado no es válido.' });
    }
    expect((await e.get(e.tenderoA, '/api/caja/sesion')).body.active).toBe(true);
  });
});

describe('[K4] POST /api/caja/egreso', () => {
  it('200 { success, message, id_egreso } con caja abierta; queda en estado «Registrado»', async () => {
    const e = await escenario();
    await e.abrirCaja(e.tenderoA);
    const r = await e.post(e.tenderoA, '/api/caja/egreso', { monto: 10000, motivo: 'Bolsas y hielo', categoria: 'Otro' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, message: 'Egreso registrado correctamente.', id_egreso: expect.any(Number) });
    expect((await db.getAsync('SELECT estado FROM EgresosCaja WHERE id_egreso = ?', [r.body.id_egreso])).estado).toBe('Registrado');
  });

  it('400 { error } sin caja abierta, monto <= 0, motivo de menos de 5 caracteres, o monto sobre el tope del Tendero (150.000 por defecto)', async () => {
    const e = await escenario();
    const sinCaja = await e.post(e.tenderoA, '/api/caja/egreso', { monto: 1000, motivo: 'Gasto de prueba' });
    expect(sinCaja.body).toEqual({ error: 'No hay ninguna caja abierta. No puedes registrar gastos.' });

    await e.abrirCaja(e.tenderoA);
    expect((await e.post(e.tenderoA, '/api/caja/egreso', { monto: 0, motivo: 'Gasto de prueba' })).body).toEqual({ error: 'El monto debe ser mayor a 0.' });
    expect((await e.post(e.tenderoA, '/api/caja/egreso', { monto: 1000, motivo: 'x' })).body).toEqual({ error: 'Debes proporcionar un motivo válido (mínimo 5 caracteres).' });
    const tope = await e.post(e.tenderoA, '/api/caja/egreso', { monto: 150001, motivo: 'Gasto grande' });
    expect(tope.status).toBe(400);
    expect(tope.body.error).toMatch(/no permite registrar gastos mayores a \$150\.000/);
    expect((await e.post(e.tenderoA, '/api/caja/egreso', { monto: 150000, motivo: 'Justo en el tope' })).status).toBe(200);
  });

  it('el Tendero NO aprueba ni rechaza egresos (PUT /api/caja/egreso/:id/aprobar|rechazar → 403): eso es del Administrador', async () => {
    const e = await escenario();
    await e.abrirCaja(e.tenderoA);
    const eg = await e.post(e.tenderoA, '/api/caja/egreso', { monto: 1000, motivo: 'Gasto de prueba' });
    expect((await e.put(e.tenderoA, `/api/caja/egreso/${eg.body.id_egreso}/aprobar`)).status).toBe(403);
  });
});

// ───────────────────────────── VENDER ─────────────────────────────

describe('[V1] GET /api/clientes', () => {
  it('200 { success, clientes: [{ id_cliente, nombre, celular, limite_credito, total_fiado, total_abonado, saldo_pendiente }] } solo de la tienda', async () => {
    const e = await escenario();
    await db.runAsync("INSERT INTO Clientes (id_tienda, nombre, limite_credito) VALUES (?, 'Doña Rosa', 100000)", [e.adminA.id_tienda]);
    await db.runAsync("INSERT INTO Clientes (id_tienda, nombre, limite_credito) VALUES (?, 'De otra tienda', 1)", [e.adminB.id_tienda]);
    const r = await e.get(e.tenderoA, '/api/clientes');
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.clientes).toHaveLength(1);
    expect(r.body.clientes[0]).toMatchObject({ nombre: 'Doña Rosa', celular: null, limite_credito: '100000.00', saldo_pendiente: 0 });
    expect(r.body.clientes[0]).toHaveProperty('id_cliente');
  });

  it('el Tendero NO puede crear clientes ni registrar abonos (403): D4 de la matriz de roles', async () => {
    const e = await escenario();
    expect((await e.post(e.tenderoA, '/api/clientes', { nombre: 'X' })).status).toBe(403);
    expect((await e.post(e.tenderoA, '/api/clientes/1/abonos', { monto: 1000 })).status).toBe(403);
  });
});

describe('[V2] POST /api/registrar-venta-carrito', () => {
  it('200 { success, message, id_venta }; descuenta el stock, deja el movimiento en el Kardex y registra el canal de la sesión', async () => {
    const e = await escenario();
    await e.abrirCaja(e.tenderoA);
    const r = await e.post(e.tenderoA, '/api/registrar-venta-carrito', { items: [{ id_producto: e.producto, cantidad: 2 }], metodo_pago: 'Efectivo', efectivo_recibido: 10000 });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, message: 'Venta registrada correctamente', id_venta: expect.any(Number) });
    await esperarTrabajoEnSegundoPlano();

    expect(Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [e.producto])).cantidad)).toBe(8);
    const venta = await db.getAsync('SELECT precio_total, metodo_pago, efectivo_recibido, cambio_devuelto, estado_deuda, canal FROM Ventas WHERE id_venta = ?', [r.body.id_venta]);
    expect(venta).toMatchObject({ precio_total: '9000.00', metodo_pago: 'Efectivo', efectivo_recibido: '10000.00', cambio_devuelto: '1000.00', estado_deuda: 'Pagado', canal: 'web' });
    expect(Number((await db.getAsync("SELECT COUNT(*) AS n FROM MovimientosStock WHERE tipo_movimiento = 'Salida'")).n)).toBe(1);
  });

  it('Idempotency-Key: reintentar la misma venta devuelve el mismo id_venta (200, cabecera Idempotent-Replayed) sin duplicar; otra carga con la misma clave da 422; una clave mal formada, 400', async () => {
    const e = await escenario();
    await e.abrirCaja(e.tenderoA);
    const clave = 'a1b2c3d4-0000-4000-8000-123456789abc';
    const vender = (cuerpo, k = clave) => e.tenderoA.agente.post('/api/registrar-venta-carrito').set('X-CSRF-Token', e.tenderoA.csrfToken).set('Idempotency-Key', k).send(cuerpo);
    const cuerpo = { items: [{ id_producto: e.producto, cantidad: 2 }], metodo_pago: 'Efectivo' };

    const primera = await vender(cuerpo);
    expect(primera.status).toBe(200);
    expect(primera.headers['idempotent-replayed']).toBeUndefined();
    const repetida = await vender(cuerpo);
    expect(repetida.status).toBe(200);
    expect(repetida.body).toEqual(primera.body);
    expect(repetida.headers['idempotent-replayed']).toBe('true');
    await esperarTrabajoEnSegundoPlano();
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM Ventas')).n)).toBe(1);
    expect(Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [e.producto])).cantidad)).toBe(8);

    const otra = await vender({ ...cuerpo, items: [{ id_producto: e.producto, cantidad: 3 }] });
    expect(otra.status).toBe(422);
    expect(otra.body).toEqual({ success: false, code: 'IDEMPOTENCY_KEY_REUSED', error: 'Esa Idempotency-Key ya se usó con una venta distinta. Genera una clave nueva para cada venta.' });

    const mala = await vender(cuerpo, 'corta');
    expect(mala.status).toBe(400);
    expect(mala.body).toEqual({ success: false, error: 'La cabecera Idempotency-Key debe tener de 8 a 100 caracteres: letras, números, guion o guion bajo (por ejemplo, un UUID).' });
  });

  it('fiado: con id_cliente de un cliente de la tienda queda en estado_deuda «Pendiente» y suma al saldo del cliente', async () => {
    const e = await escenario();
    await e.abrirCaja(e.tenderoA);
    const cli = await db.runAsync("INSERT INTO Clientes (id_tienda, nombre, limite_credito) VALUES (?, 'Doña Rosa', 100000) RETURNING id_cliente", [e.adminA.id_tienda]);
    const r = await e.post(e.tenderoA, '/api/registrar-venta-carrito', { items: [{ id_producto: e.producto, cantidad: 2 }], metodo_pago: 'Fiado', id_cliente: cli.lastID });
    expect(r.status).toBe(200);
    await esperarTrabajoEnSegundoPlano();
    const lista = await e.get(e.tenderoA, '/api/clientes');
    expect(lista.body.clientes[0].saldo_pendiente).toBe(9000);
  });

  it('403 { success:false, error } sin caja abierta; 400 con carrito vacío, cantidad inválida, fiado sin cliente o stock insuficiente', async () => {
    const e = await escenario();
    const sinCaja = await e.post(e.tenderoA, '/api/registrar-venta-carrito', { items: [{ id_producto: e.producto, cantidad: 1 }] });
    expect(sinCaja.status).toBe(403);
    expect(sinCaja.body).toEqual({ success: false, error: 'Debes abrir tu caja antes de realizar ventas.' });

    await e.abrirCaja(e.tenderoA);
    const casos = [
      [{ items: [] }, 'El carrito debe contener al menos un producto'],
      [{ items: [{ id_producto: e.producto, cantidad: -1 }] }, 'Las cantidades deben ser mayores a 0'],
      [{ items: [{ id_producto: e.producto }] }, 'Cada ítem debe tener producto y cantidad'],
      [{ items: [{ id_producto: e.producto, cantidad: 1 }], metodo_pago: 'Fiado' }, 'El cliente es obligatorio para ventas fiadas.'],
      [{ items: [{ id_producto: e.producto, cantidad: 1 }], metodo_pago: 'efectivo' }, 'Método de pago no válido. Usa Efectivo, Tarjeta, Transferencia o Fiado.'],
      [{ items: [{ id_producto: e.producto, cantidad: 999 }] }, 'Stock insuficiente para el producto: Arroz Diana 1Kg']
    ];
    for (const [cuerpo, mensaje] of casos) {
      const r = await e.post(e.tenderoA, '/api/registrar-venta-carrito', cuerpo);
      expect(r.status, mensaje).toBe(400);
      expect(r.body).toEqual({ success: false, error: mensaje });
    }
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM Ventas')).n)).toBe(0);
    expect(Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [e.producto])).cantidad)).toBe(10);
  });

  it('404 { success:false, error } si un producto del carrito no existe o es de otra tienda (no se vende nada)', async () => {
    const e = await escenario();
    await e.abrirCaja(e.tenderoA);
    const ajeno = await crearProducto({ id_tienda: e.adminB.id_tienda, nombre_producto: 'De B' });
    for (const id of [99999, ajeno]) {
      const r = await e.post(e.tenderoA, '/api/registrar-venta-carrito', { items: [{ id_producto: e.producto, cantidad: 1 }, { id_producto: id, cantidad: 1 }] });
      expect(r.status).toBe(404);
      expect(r.body).toEqual({ success: false, error: 'Producto no encontrado o no pertenece a tu tienda' });
    }
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM Ventas')).n)).toBe(0);
  });

  it('fiado: 404 «Cliente no encontrado» si el cliente no existe o es de OTRA tienda; 400 si la venta supera el cupo de crédito (limite_credito > 0)', async () => {
    const e = await escenario();
    await e.abrirCaja(e.tenderoA);
    const ajeno = await db.runAsync("INSERT INTO Clientes (id_tienda, nombre, limite_credito) VALUES (?, 'Cliente de B', 100000) RETURNING id_cliente", [e.adminB.id_tienda]);
    const propio = await db.runAsync("INSERT INTO Clientes (id_tienda, nombre, limite_credito) VALUES (?, 'Con cupo', 1000) RETURNING id_cliente", [e.adminA.id_tienda]);
    const fiar = (id_cliente, cantidad = 1) => e.post(e.tenderoA, '/api/registrar-venta-carrito', { items: [{ id_producto: e.producto, cantidad }], metodo_pago: 'Fiado', id_cliente });

    for (const id of [ajeno.lastID, 99999, 'abc']) {
      const r = await fiar(id);
      expect(r.status, String(id)).toBe(404);
      expect(r.body).toEqual({ success: false, error: 'Cliente no encontrado' });
    }
    const sobreCupo = await fiar(propio.lastID, 5); // 22.500 sobre un cupo de 1.000
    expect(sobreCupo.status).toBe(400);
    expect(sobreCupo.body).toEqual({ success: false, error: expect.stringMatching(/^Esta venta supera el cupo de crédito del cliente \(cupo \$1\.000, ya debe \$0, esta venta \$22\.500\)\.$/) });
    expect(Number((await db.getAsync('SELECT COUNT(*) AS n FROM Ventas')).n)).toBe(0);
  });
});

describe('[V3] GET /api/ventas', () => {
  it('200 { data, total, limit, offset, hasMore } con las ventas de la tienda (paginadas con ?limit y ?offset)', async () => {
    const e = await escenario();
    await e.abrirCaja(e.tenderoA);
    for (let i = 0; i < 3; i++) await e.post(e.tenderoA, '/api/registrar-venta-carrito', { items: [{ id_producto: e.producto, cantidad: 1 }] });
    await esperarTrabajoEnSegundoPlano();

    const r = await e.get(e.tenderoA, '/api/ventas?limit=2&offset=0');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total: 3, limit: 2, offset: 0, hasMore: true });
    expect(r.body.data).toHaveLength(2);
    expect(r.body.data[0]).toMatchObject({ nombre_producto: 'Arroz Diana 1Kg', cantidad: 1, precio_total: '4500.00', nombre_vendedor: ERROR });
    expect(r.body.data[0]).toMatchObject({ canal: 'web' });
  });

  it('?turno=actual devuelve solo las ventas de la caja abierta del usuario; un valor distinto de «actual» es 400; detalle en ventas_turno.test.js', async () => {
    const e = await escenario();
    expect((await e.get(e.tenderoA, '/api/ventas?turno=actual')).body).toEqual({ data: [], total: 0, limit: 100, offset: 0, hasMore: false });
    await e.abrirCaja(e.tenderoA);
    await e.post(e.tenderoA, '/api/registrar-venta-carrito', { items: [{ id_producto: e.producto, cantidad: 1 }] });
    await esperarTrabajoEnSegundoPlano();
    expect((await e.get(e.tenderoA, '/api/ventas?turno=actual')).body.total).toBe(1);
    expect((await e.get(e.tenderoA, '/api/ventas?turno=todos')).status).toBe(400);
  });
});

// ───────────────────────────── MERCANCÍA ─────────────────────────────

describe('[M1] POST /api/inventario/entrada', () => {
  it('200 { success, message, data: { id, producto, tipo, cantidad, stockAnterior, stockNuevo } }; suma stock y deja el movimiento; el Tendero puede', async () => {
    const e = await escenario();
    const r = await e.post(e.tenderoA, '/api/inventario/entrada', { id_producto: e.producto, cantidad: 6, observacion: 'Pedido del lunes' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, message: 'Entrada registrada', data: { id: expect.any(Number), producto: 'Arroz Diana 1Kg', tipo: 'Entrada', cantidad: 6, stockAnterior: 10, stockNuevo: 16 } });
    await esperarTrabajoEnSegundoPlano();
    const mov = await db.getAsync("SELECT tipo_movimiento, cantidad, stock_final, id_usuario FROM MovimientosStock WHERE tipo_movimiento = 'Entrada'");
    expect(mov).toMatchObject({ tipo_movimiento: 'Entrada', cantidad: 6, stock_final: 16, id_usuario: e.tenderoA.id_usuario });
  });

  it('400 { success:false, error } con producto o cantidad ausentes o no positivos; 404 si el producto no existe o es de otra tienda', async () => {
    const e = await escenario();
    for (const cuerpo of [{ cantidad: 1 }, { id_producto: e.producto }, { id_producto: e.producto, cantidad: 0 }, { id_producto: e.producto, cantidad: -3 }]) {
      const r = await e.post(e.tenderoA, '/api/inventario/entrada', cuerpo);
      expect(r.status, JSON.stringify(cuerpo)).toBe(400);
      expect(r.body).toEqual({ success: false, error: 'Producto y cantidad (positiva) son requeridos' });
    }
    expect((await e.post(e.tenderoA, '/api/inventario/entrada', { id_producto: 99999, cantidad: 1 })).body).toEqual({ success: false, error: 'Producto no encontrado' });
    expect((await e.post(e.tenderoB, '/api/inventario/entrada', { id_producto: e.producto, cantidad: 1 })).status).toBe(404);
    expect(Number((await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [e.producto])).cantidad)).toBe(10);
  });
});

// ───────────────────────────── ALERTAS ─────────────────────────────

describe('[A1] GET /api/alertas', () => {
  it('200 { success, alerts, data } (las dos con la MISMA lista de alertas activas de la tienda); vacío si no hay', async () => {
    const e = await vacioConAlerta();
    expect((await e.get(e.tenderoB, '/api/alertas')).body).toMatchObject({ success: true, alerts: [], data: [] });

    const r = await e.get(e.tenderoA, '/api/alertas?limit=5');
    expect(r.status).toBe(200);
    expect(r.body.alerts).toEqual(r.body.data);
    expect(r.body.alerts).toHaveLength(1);
    expect(r.body.alerts[0]).toMatchObject({
      id_alerta: expect.any(Number),
      id_producto: e.agotado,
      tipo: 'stock_critico',
      severidad: 'critico', // critico | advertencia | info
      mensaje: ERROR,
      resuelta: 0,
      nombre_producto: 'Leche',
      codigo: ERROR
    });
  });

  async function vacioConAlerta() {
    const e = await escenario();
    e.agotado = await crearProducto({ id_tienda: e.adminA.id_tienda, nombre_producto: 'Leche', cantidad: 0, stock_minimo: 5, stock_seguridad: 5 });
    const Alert = (await import('../../models/Alert.js')).default;
    await Alert.generate(e.adminA.id_tienda);
    return e;
  }
});

describe('[A2] PATCH /api/alertas/:id/resolve', () => {
  it('200 { success, message } y la alerta deja de aparecer; el Tendero puede (matriz de roles I0)', async () => {
    const e = await escenario();
    await crearProducto({ id_tienda: e.adminA.id_tienda, nombre_producto: 'Leche', cantidad: 0, stock_minimo: 5, stock_seguridad: 5 });
    await (await import('../../models/Alert.js')).default.generate(e.adminA.id_tienda);
    const [alerta] = (await e.get(e.tenderoA, '/api/alertas')).body.alerts;

    const r = await e.patch(e.tenderoA, `/api/alertas/${alerta.id_alerta}/resolve`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, message: 'Alerta archivada.' });
    expect((await e.get(e.tenderoA, '/api/alertas')).body.alerts).toEqual([]);
  });

  it('404 { success:false, error:"Alerta no encontrada" } si el id no existe, no es numérico o es de otra tienda (y no toca la alerta ajena); volver a archivar una real sigue dando 200', async () => {
    const e = await escenario();
    await crearProducto({ id_tienda: e.adminA.id_tienda, nombre_producto: 'Leche', cantidad: 0, stock_minimo: 5, stock_seguridad: 5 });
    await (await import('../../models/Alert.js')).default.generate(e.adminA.id_tienda);
    const [alerta] = (await e.get(e.tenderoA, '/api/alertas')).body.alerts;

    for (const id of ['99999', 'abc']) {
      const r = await e.patch(e.tenderoA, `/api/alertas/${id}/resolve`);
      expect(r.status, id).toBe(404);
      expect(r.body).toEqual({ success: false, error: 'Alerta no encontrada' });
    }
    expect((await e.patch(e.tenderoB, `/api/alertas/${alerta.id_alerta}/resolve`)).status).toBe(404);
    expect((await e.get(e.tenderoA, '/api/alertas')).body.alerts).toHaveLength(1);
    expect((await e.patch(e.tenderoA, `/api/alertas/${alerta.id_alerta}/resolve`)).status).toBe(200);
    expect((await e.patch(e.tenderoA, `/api/alertas/${alerta.id_alerta}/resolve`)).status).toBe(200);
  });
});

// ───────────────────────────── OPCIONALES ─────────────────────────────

describe('[O1] POST /api/ordenes/borrador/solicitar (el Tendero pide un producto al Administrador)', () => {
  async function conProveedor(e) {
    const prov = await db.runAsync("INSERT INTO Proveedores (id_tienda, nombre_empresa) VALUES (?, 'Distribuidora') RETURNING id_proveedor", [e.adminA.id_tienda]);
    await db.runAsync('UPDATE Productos SET id_proveedor = ? WHERE id_producto = ?', [prov.lastID, e.producto]);
  }

  it('200 { success, id_orden, proveedor }; crea (o amplía) el borrador y avisa a los administradores', async () => {
    const e = await escenario();
    await conProveedor(e);
    const r = await e.post(e.tenderoA, '/api/ordenes/borrador/solicitar', { id_producto: e.producto, cantidad: 5, urgencia: 'alta' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, id_orden: expect.any(Number), proveedor: 'Distribuidora' });
    const avisos = await db.allAsync("SELECT id_usuario FROM NotificacionesUsuario WHERE tipo = 'solicitud_producto'");
    expect(avisos.map((a) => a.id_usuario)).toContain(e.adminA.id_usuario);
  });

  it('400 con producto/cantidad inválidos o producto sin proveedor; 404 si no es de la tienda; 409 si ya está en un borrador', async () => {
    const e = await escenario();
    expect((await e.post(e.tenderoA, '/api/ordenes/borrador/solicitar', { id_producto: e.producto, cantidad: 0 })).body).toEqual({ success: false, error: 'Indica un producto y una cantidad válida.' });
    const sinProv = await e.post(e.tenderoA, '/api/ordenes/borrador/solicitar', { id_producto: e.producto, cantidad: 1 });
    expect(sinProv.status).toBe(400);
    expect(sinProv.body.error).toMatch(/no tiene proveedor asignado/);

    await conProveedor(e);
    expect((await e.post(e.tenderoB, '/api/ordenes/borrador/solicitar', { id_producto: e.producto, cantidad: 1 })).status).toBe(404);
    expect((await e.post(e.tenderoA, '/api/ordenes/borrador/solicitar', { id_producto: e.producto, cantidad: 1 })).status).toBe(200);
    const repetido = await e.post(e.tenderoA, '/api/ordenes/borrador/solicitar', { id_producto: e.producto, cantidad: 1 });
    expect(repetido.status).toBe(409);
    expect(repetido.body).toEqual({ success: false, error: expect.stringMatching(/ya está en un pedido en borrador/) });
  });
});

describe('[O2] /api/notificaciones', () => {
  it('GET → { success, notifications }, GET /count → { success, count }, PATCH /read-all y PATCH /:id/read → { success }; solo las del propio usuario', async () => {
    const e = await escenario();
    await db.runAsync("INSERT INTO NotificacionesUsuario (id_usuario, id_tienda, tipo, titulo, mensaje) VALUES (?, ?, 'prueba', 'Hola', 'Mensaje')", [e.tenderoA.id_usuario, e.tenderoA.id_tienda]);
    await db.runAsync("INSERT INTO NotificacionesUsuario (id_usuario, id_tienda, tipo, titulo, mensaje) VALUES (?, ?, 'prueba', 'Ajena', 'x')", [e.adminA.id_usuario, e.adminA.id_tienda]);

    const lista = await e.get(e.tenderoA, '/api/notificaciones?limit=5');
    expect(lista.status).toBe(200);
    expect(lista.body.success).toBe(true);
    expect(lista.body.notifications).toHaveLength(1);
    expect(lista.body.notifications[0]).toMatchObject({ titulo: 'Hola', tipo: 'prueba' });
    expect((await e.get(e.tenderoA, '/api/notificaciones/count')).body).toEqual({ success: true, count: 1 });

    const id = lista.body.notifications[0].id_notificacion;
    expect((await e.patch(e.tenderoA, `/api/notificaciones/${id}/read`)).body).toEqual({ success: true });
    expect((await e.get(e.tenderoA, '/api/notificaciones/count')).body.count).toBe(0);
    expect((await e.patch(e.tenderoA, '/api/notificaciones/read-all')).body).toEqual({ success: true });
  });
});
