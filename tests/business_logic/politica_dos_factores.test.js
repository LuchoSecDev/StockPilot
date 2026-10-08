import { describe, it, expect, vi, afterEach } from 'vitest';
import { rutaExentaDe2FA, debeComprobar2FA, politicaActiva, RUTAS_EXENTAS } from '../../utils/politica2FA.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

const admin = { userId: 1, rol: 'Administrador' };
const peticion = (overrides = {}) => ({ method: 'POST', path: '/productos/admin', session: admin, ...overrides });

describe('politicaActiva', () => {
  it('está apagada por defecto y solo se enciende con el texto exacto «true»', () => {
    vi.stubEnv('REQUIRE_ADMIN_2FA', '');
    expect(politicaActiva()).toBe(false);
    for (const valor of ['false', '1', 'TRUE', 'yes', ' true']) {
      vi.stubEnv('REQUIRE_ADMIN_2FA', valor);
      expect(politicaActiva()).toBe(false);
    }
    vi.stubEnv('REQUIRE_ADMIN_2FA', 'true');
    expect(politicaActiva()).toBe(true);
  });
});

describe('rutaExentaDe2FA', () => {
  it('exime las rutas de acceso, de la propia cuenta y de notificaciones', () => {
    for (const ruta of ['/login', '/registro', '/logout', '/forgot-password', '/verify-reset-code', '/reset-password',
      '/2fa/generate', '/2fa/verify', '/2fa/disable', '/perfil', '/perfil/password', '/perfil/modo-interfaz', '/notificaciones', '/notificaciones/7/leer']) {
      expect(rutaExentaDe2FA(ruta), ruta).toBe(true);
    }
  });

  it('NO exime ninguna ruta de negocio', () => {
    for (const ruta of ['/productos/admin', '/productos/5', '/proveedores', '/clientes', '/inventario/ajuste', '/registrar-venta-carrito',
      '/ia/apply-strategy', '/tiendas/switch/2', '/caja/abrir', '/']) {
      expect(rutaExentaDe2FA(ruta), ruta).toBe(false);
    }
  });

  it('exige el límite de segmento: «/2fax» o «/perfiles» no cuelgan de «/2fa» ni de «/perfil»', () => {
    expect(rutaExentaDe2FA('/2fax')).toBe(false);
    expect(rutaExentaDe2FA('/perfiles')).toBe(false);
    expect(rutaExentaDe2FA('/loginx')).toBe(false);
  });

  it('la lista de exentas es corta (cada ruta nueva exenta debe justificarse)', () => {
    expect(RUTAS_EXENTAS.length).toBeLessThanOrEqual(10);
  });
});

describe('debeComprobar2FA', () => {
  it('con la política apagada nunca comprueba', () => {
    vi.stubEnv('REQUIRE_ADMIN_2FA', 'false');
    expect(debeComprobar2FA(peticion())).toBe(false);
  });

  describe('con la política encendida', () => {
    const encender = () => vi.stubEnv('REQUIRE_ADMIN_2FA', 'true');

    it('comprueba las escrituras de un Administrador', () => {
      encender();
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        expect(debeComprobar2FA(peticion({ method })), method).toBe(true);
      }
    });

    it('no comprueba las lecturas', () => {
      encender();
      for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        expect(debeComprobar2FA(peticion({ method })), method).toBe(false);
      }
    });

    it('no comprueba rutas exentas aunque sea una escritura', () => {
      encender();
      expect(debeComprobar2FA(peticion({ path: '/2fa/generate' }))).toBe(false);
      expect(debeComprobar2FA(peticion({ path: '/logout' }))).toBe(false);
    });

    it('no es asunto de esta política quien no es Administrador o no tiene sesión', () => {
      encender();
      expect(debeComprobar2FA(peticion({ session: { userId: 2, rol: 'Tendero' } }))).toBe(false);
      expect(debeComprobar2FA(peticion({ session: {} }))).toBe(false);
      expect(debeComprobar2FA(peticion({ session: undefined }))).toBe(false);
      expect(debeComprobar2FA(peticion({ session: { rol: 'Administrador' } }))).toBe(false);
    });
  });
});
