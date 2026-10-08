/**
 * @file politica_dos_factores.test.js
 * @description Política de 2FA del Administrador, aplicada EN EL SERVIDOR (hallazgo de la revisión
 * del commit ec4d48c: ese commit solo bloqueaba en el navegador, y la API aceptaba la operación
 * igual). Durante el piloto la política está APAGADA (el 2FA es una recomendación); se enciende
 * con REQUIRE_ADMIN_2FA=true y entonces un Administrador sin 2FA activo no puede escribir.
 * También cubre dos endurecimientos de /api/2fa: no se puede regenerar el secreto de un 2FA ya
 * activo, y generate/disable tienen limitador de intentos.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto, abrirCaja } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';

// El modelo se carga con `require` (la misma copia que usa el middleware): con `import`, Vitest crearía otra y el espía no la alcanzaría.
const User = createRequire(import.meta.url)('../../models/User.js');

beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const cuerpoProducto = { codigo: 'NUEVO-1', nombre_producto: 'Producto nuevo', categoria: 'General', precio: 1000, cantidad: 5, stock_minimo: 1 };
const cuerpoProveedor = { nombre_empresa: 'Proveedor de Prueba', contacto_principal: 'Juan', email: 'prov@test.local', telefono: '3000000000', direccion: 'Calle 1' };

const exigirDosFactores = () => vi.stubEnv('REQUIRE_ADMIN_2FA', 'true');

async function sesion({ rol = 'Administrador', conDosFactores = false } = {}) {
  const datos = await crearUsuario({ rol });
  const agente = request.agent(app);
  await iniciarSesion(agente, datos);
  const csrfToken = await obtenerCsrfToken(agente);
  // Se activa DESPUÉS de iniciar sesión: con el 2FA activo el login pediría el código y no es lo que se prueba aquí.
  if (conDosFactores) {
    await db.runAsync('UPDATE Usuarios SET two_factor_enabled = true, two_factor_secret = ? WHERE id_usuario = ?', ['JBSWY3DPEHPK3PXP', datos.id_usuario]);
  }
  const enviar = (metodo, url, cuerpo) => {
    const r = agente[metodo](url).set('X-CSRF-Token', csrfToken);
    return cuerpo ? r.send(cuerpo) : r;
  };
  return { ...datos, agente, csrfToken, enviar };
}

const cuantosProductos = async () => Number((await db.getAsync('SELECT COUNT(*) AS n FROM Productos')).n);

describe('política APAGADA (por defecto, durante el piloto)', () => {
  it('un Administrador SIN 2FA puede crear productos y proveedores', async () => {
    const a = await sesion();

    const producto = await a.enviar('post', '/api/productos/admin', cuerpoProducto);
    const proveedor = await a.enviar('post', '/api/proveedores', cuerpoProveedor);

    expect(producto.status).toBeLessThan(300);
    expect(proveedor.status).toBeLessThan(300);
    expect(await cuantosProductos()).toBe(1);
  });

  it('un valor distinto de «true» tampoco la enciende', async () => {
    vi.stubEnv('REQUIRE_ADMIN_2FA', 'false');
    const a = await sesion();
    const r = await a.enviar('post', '/api/productos/admin', cuerpoProducto);
    expect(r.status).toBeLessThan(300);
  });
});

describe('política ENCENDIDA (REQUIRE_ADMIN_2FA=true)', () => {
  it('un Administrador SIN 2FA recibe 403 con code DOS_FACTORES_REQUERIDO y NO se crea nada', async () => {
    exigirDosFactores();
    const a = await sesion();

    const r = await a.enviar('post', '/api/productos/admin', cuerpoProducto);

    expect(r.status).toBe(403);
    expect(r.body.success).toBe(false);
    expect(r.body.code).toBe('DOS_FACTORES_REQUERIDO');
    expect(r.body.error).toMatch(/dos pasos/i);
    expect(await cuantosProductos()).toBe(0);
  });

  it.each([
    ['POST /api/proveedores', 'post', '/api/proveedores', cuerpoProveedor],
    ['PUT /api/productos/:id', 'put', '/api/productos/1', cuerpoProducto],
    ['DELETE /api/productos/:id', 'delete', '/api/productos/1', undefined],
    ['POST /api/clientes', 'post', '/api/clientes', { nombre: 'Cliente' }],
    ['POST /api/inventario/ajuste', 'post', '/api/inventario/ajuste', { id_producto: 1, cantidad: -1, observacion: 'x' }],
    ['POST /api/ia/apply-strategy', 'post', '/api/ia/apply-strategy', { id_producto: 1, nuevo_precio: 1 }],
  ])('es por defecto: %s también se bloquea (no depende de rutas marcadas a mano)', async (_etiqueta, metodo, url, cuerpo) => {
    exigirDosFactores();
    const a = await sesion();

    const r = await a.enviar(metodo, url, cuerpo);

    expect(r.status).toBe(403);
    expect(r.body.code).toBe('DOS_FACTORES_REQUERIDO');
  });

  it('un Administrador CON 2FA activo opera con normalidad', async () => {
    exigirDosFactores();
    const a = await sesion({ conDosFactores: true });

    const r = await a.enviar('post', '/api/productos/admin', cuerpoProducto);

    expect(r.status).toBeLessThan(300);
    expect(await cuantosProductos()).toBe(1);
  });

  it('leer sigue permitido: un Administrador SIN 2FA puede consultar', async () => {
    exigirDosFactores();
    const a = await sesion();
    await crearProducto({ id_tienda: a.id_tienda });

    const r = await a.agente.get('/api/productos');

    expect(r.status).toBe(200);
  });

  it('los flujos de la propia cuenta siguen abiertos: activar el 2FA, cerrar sesión y el modo de interfaz', async () => {
    exigirDosFactores();
    const a = await sesion();

    const generar = await a.enviar('post', '/api/2fa/generate');
    const modo = await a.enviar('patch', '/api/perfil/modo-interfaz', { modo: 'basico' });
    const salir = await a.enviar('post', '/api/logout');

    expect(generar.status).toBe(200);
    expect(generar.body.secret).toBeTruthy();
    expect(modo.status).toBe(200);
    expect(salir.status).toBe(200);
  });

  it('el Tendero no se ve afectado (la política es solo del Administrador)', async () => {
    exigirDosFactores();
    const t = await sesion({ rol: 'Tendero' });
    await abrirCaja(t.id_tienda, t.id_usuario);
    const id_producto = await crearProducto({ id_tienda: t.id_tienda, cantidad: 10, precio: 1000 });

    const r = await t.enviar('post', '/api/registrar-venta-carrito', { items: [{ id_producto, cantidad: 1 }], metodo_pago: 'Efectivo' });

    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });

  it('FALLA CERRADO: si no se puede consultar el estado del 2FA, responde 500 y NO deja escribir', async () => {
    exigirDosFactores();
    const a = await sesion();
    vi.spyOn(User, 'is2FAEnabled').mockRejectedValue(new Error('BD no disponible'));

    const r = await a.enviar('post', '/api/productos/admin', cuerpoProducto);

    expect(r.status).toBe(500);
    expect(r.body.success).toBe(false);
    expect(await cuantosProductos()).toBe(0);
  });

  it('si el Administrador activa el 2FA en plena sesión, la siguiente escritura ya pasa (se lee de la BD, no de la sesión)', async () => {
    exigirDosFactores();
    const a = await sesion();
    expect((await a.enviar('post', '/api/productos/admin', cuerpoProducto)).status).toBe(403);

    await db.runAsync('UPDATE Usuarios SET two_factor_enabled = true WHERE id_usuario = ?', [a.id_usuario]);

    expect((await a.enviar('post', '/api/productos/admin', cuerpoProducto)).status).toBeLessThan(300);
  });
});

describe('POST /api/2fa/generate no permite reemplazar un 2FA ya activo', () => {
  it('con el 2FA activo responde 409 DOS_FACTORES_YA_ACTIVO y el secreto NO cambia', async () => {
    const a = await sesion({ conDosFactores: true });

    const r = await a.enviar('post', '/api/2fa/generate');

    expect(r.status).toBe(409);
    expect(r.body.code).toBe('DOS_FACTORES_YA_ACTIVO');
    const fila = await db.getAsync('SELECT two_factor_secret FROM Usuarios WHERE id_usuario = ?', [a.id_usuario]);
    expect(fila.two_factor_secret).toBe('JBSWY3DPEHPK3PXP');
  });

  it('sin 2FA activo sigue generando (activación inicial y reintentos de activación)', async () => {
    const a = await sesion();
    const primera = await a.enviar('post', '/api/2fa/generate');
    const segunda = await a.enviar('post', '/api/2fa/generate');
    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
  });
});

describe('limitador de /api/2fa/disable', () => {
  it('tras 5 contraseñas incorrectas, el sexto intento responde 429 aunque la contraseña sea correcta', async () => {
    const t = await sesion({ rol: 'Tendero', conDosFactores: true });

    for (let i = 0; i < 5; i++) {
      const mala = await t.enviar('post', '/api/2fa/disable', { password: 'incorrecta' });
      expect(mala.status).toBe(401);
    }
    const bloqueada = await t.enviar('post', '/api/2fa/disable', { password: t.password });

    expect(bloqueada.status).toBe(429);
    const fila = await db.getAsync('SELECT two_factor_enabled FROM Usuarios WHERE id_usuario = ?', [t.id_usuario]);
    expect(fila.two_factor_enabled).toBe(true);
  });
});
