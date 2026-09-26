import { describe, it, expect, vi } from 'vitest';

// Plan 20, Nivel 1: auth.js hace `require('../models/User')`, y User.js hace
// `require('../config/database')` en su primera línea — importar este archivo, aunque solo se
// prueben evaluarAcceso/evaluarAdmin (puras, sin BD), disparaba una conexión real. Se simula.
vi.mock('../../config/database.js', () => {
  const db = { allAsync: vi.fn(), getAsync: vi.fn(), runAsync: vi.fn(), getClient: vi.fn(), pool: {} };
  return { default: db, ...db };
});

import { evaluarAcceso, evaluarAdmin } from '../../middleware/auth.js';

// === PRUEBAS UNITARIAS ===

describe('Middleware de Seguridad - Lógica auth.js', () => {

  describe('requireLogin', () => {
    it('Debería permitir el paso si hay userId y la sesión es válida', () => {
      const session = { userId: 1 };
      expect(evaluarAcceso(session, true)).toBe('pass');
    });

    it('Debería denegar acceso si no hay sesión', () => {
      expect(evaluarAcceso(null, true)).toBe('no_auth');
    });

    it('Debería denegar acceso si la sesión no tiene userId', () => {
      const session = {};
      expect(evaluarAcceso(session, true)).toBe('no_auth');
    });

    it('Debería detectar sesión concurrente si isSessionValid es false', () => {
      const session = { userId: 1 };
      expect(evaluarAcceso(session, false)).toBe('concurrent');
    });

    it('Debería priorizar no_auth sobre concurrent si no hay userId', () => {
      // Si no hay userId, ni siquiera debería llegar a verificar la concurrencia
      expect(evaluarAcceso({}, false)).toBe('no_auth');
    });

    it('Debería permitir múltiples sesiones concurrentes para el rol Administrador', () => {
      // A diferencia de un Colaborador, un Administrador con sesión "no válida" (ya hay otra más
      // nueva) igual pasa: es la excepción explícita de la línea 7 de auth.js.
      const session = { userId: 1, rol: 'Administrador' };
      expect(evaluarAcceso(session, false)).toBe('pass');
    });
  });

  describe('requireAdmin', () => {
    it('Debería permitir el paso si el rol es Administrador', () => {
      const session = { userId: 1, rol: 'Administrador' };
      expect(evaluarAdmin(session)).toBe('pass');
    });

    it('Debería denegar acceso si el rol es Colaborador', () => {
      const session = { userId: 2, rol: 'Colaborador' };
      expect(evaluarAdmin(session)).toBe('forbidden');
    });

    it('Debería denegar acceso si no hay sesión', () => {
      expect(evaluarAdmin(null)).toBe('forbidden');
    });

    it('Debería denegar acceso si el rol no está definido', () => {
      const session = { userId: 1 };
      expect(evaluarAdmin(session)).toBe('forbidden');
    });
  });
});
