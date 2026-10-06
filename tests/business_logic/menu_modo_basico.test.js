import { describe, it, expect } from 'vitest';
import { enlacesDelMenu, modoOpuesto, MODOS_INTERFAZ } from '../../frontend/src/utils/menu.js';

const rutas = (rol, modo) => enlacesDelMenu(rol, modo).map((e) => e.to);

describe('enlacesDelMenu en modo avanzado (el menú de siempre)', () => {
  it('el Administrador ve los 17 enlaces (los 16 de siempre más «¿Qué pido?»)', () => {
    expect(rutas('Administrador', 'avanzado')).toEqual([
      '/dashboard', '/ventas', '/productos', '/pedir', '/alertas', '/tiendas', '/cartera', '/movimientos', '/comunicados',
      '/proveedores', '/analitica-visual', '/simulador', '/reportes', '/auditoria', '/aprendizaje', '/registro-tendero', '/perfil',
    ]);
  });

  it('el Colaborador solo ve lo que no es del Administrador', () => {
    expect(rutas('Tendero', 'avanzado')).toEqual(['/dashboard', '/ventas', '/productos', '/alertas', '/tiendas', '/perfil']);
  });

  it('conserva los id que usan el tour y las pruebas, y el texto de «Mis Tiendas» solo para el Administrador', () => {
    const admin = enlacesDelMenu('Administrador', 'avanzado');
    expect(admin.find((e) => e.to === '/movimientos').id).toBe('nav-movimientos');
    expect(admin.find((e) => e.to === '/simulador').id).toBe('nav-simulador');
    expect(admin.find((e) => e.to === '/tiendas').text).toBe('Mis Tiendas');
    expect(enlacesDelMenu('Tendero', 'avanzado').find((e) => e.to === '/tiendas').text).toBe('Mi Tienda');
    expect(admin.find((e) => e.to === '/ventas')).not.toHaveProperty('id');
  });
});

describe('enlacesDelMenu en modo básico (menú reducido)', () => {
  it('el Administrador ve Vista general, Punto de Venta, Catálogo, «¿Qué pido?», Alertas y Mi Perfil', () => {
    expect(rutas('Administrador', 'basico')).toEqual(['/dashboard', '/ventas', '/productos', '/pedir', '/alertas', '/perfil']);
  });

  it('el Colaborador ve lo mismo salvo «¿Qué pido?», que mueve dinero y es solo del Administrador', () => {
    expect(rutas('Tendero', 'basico')).toEqual(['/dashboard', '/ventas', '/productos', '/alertas', '/perfil']);
  });

  it('oculta lo avanzado, pero ocultar no es conceder: un Colaborador nunca ve enlaces de Administrador', () => {
    const colaborador = rutas('Tendero', 'basico');
    for (const ruta of ['/pedir', '/cartera', '/reportes', '/proveedores', '/registro-tendero', '/tiendas']) {
      expect(colaborador).not.toContain(ruta);
    }
  });

  it('el modo básico siempre es un subconjunto del avanzado', () => {
    for (const rol of ['Administrador', 'Tendero']) {
      const completo = rutas(rol, 'avanzado');
      expect(rutas(rol, 'basico').every((r) => completo.includes(r))).toBe(true);
    }
  });
});

describe('ante un modo desconocido o ausente no se esconde nada', () => {
  it.each([undefined, null, '', 'experto', 'BASICO'])('modo %s enseña el menú completo', (modo) => {
    expect(rutas('Administrador', modo)).toEqual(rutas('Administrador', 'avanzado'));
    expect(rutas('Tendero', modo)).toEqual(rutas('Tendero', 'avanzado'));
  });
});

describe('modoOpuesto', () => {
  it('alterna entre los dos modos y cualquier otra cosa lleva a básico', () => {
    expect(modoOpuesto('basico')).toBe('avanzado');
    expect(modoOpuesto('avanzado')).toBe('basico');
    expect(modoOpuesto(undefined)).toBe('basico');
  });

  it('la lista de modos coincide con la que acepta el servidor', () => {
    expect(MODOS_INTERFAZ).toEqual(['basico', 'avanzado']);
  });
});
