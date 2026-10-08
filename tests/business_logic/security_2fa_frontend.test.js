import { describe, it, expect } from 'vitest';
import {
  CODIGO_2FA_REQUERIDO, EVENTO_2FA_REQUERIDO, esBloqueoPorDosFactores, debeMostrarAvisoDosFactores
} from '../../frontend/src/utils/security2FA.js';

const errorAxios = (status, data) => ({ response: { status, data } });

describe('esBloqueoPorDosFactores (el servidor decidió; el navegador solo reacciona)', () => {
  it('reconoce el 403 con el code de la política de 2FA', () => {
    expect(esBloqueoPorDosFactores(errorAxios(403, { success: false, code: 'DOS_FACTORES_REQUERIDO', error: 'x' }))).toBe(true);
    expect(CODIGO_2FA_REQUERIDO).toBe('DOS_FACTORES_REQUERIDO');
  });

  it('no confunde otros 403 (sin permisos de administrador, CSRF…) con el bloqueo por 2FA', () => {
    expect(esBloqueoPorDosFactores(errorAxios(403, { error: 'Se requieren permisos de administrador' }))).toBe(false);
    expect(esBloqueoPorDosFactores(errorAxios(403, { code: 'OTRO_CODIGO' }))).toBe(false);
  });

  it('el code solo cuenta con status 403', () => {
    expect(esBloqueoPorDosFactores(errorAxios(401, { code: 'DOS_FACTORES_REQUERIDO' }))).toBe(false);
    expect(esBloqueoPorDosFactores(errorAxios(500, { code: 'DOS_FACTORES_REQUERIDO' }))).toBe(false);
  });

  it('tolera errores sin respuesta (red caída, cancelación) y valores vacíos', () => {
    expect(esBloqueoPorDosFactores(new Error('Network Error'))).toBe(false);
    expect(esBloqueoPorDosFactores(errorAxios(403, undefined))).toBe(false);
    expect(esBloqueoPorDosFactores(null)).toBe(false);
    expect(esBloqueoPorDosFactores(undefined)).toBe(false);
  });
});

describe('debeMostrarAvisoDosFactores (el aviso informa que la función existe)', () => {
  it('se muestra a quien tiene el 2FA pendiente de activar', () => {
    expect(debeMostrarAvisoDosFactores({ needs2FASetup: true })).toBe(true);
  });

  it('no se muestra si ya lo activó, si no aplica (Tendero) o sin sesión', () => {
    expect(debeMostrarAvisoDosFactores({ needs2FASetup: false })).toBe(false);
    expect(debeMostrarAvisoDosFactores({ rol: 'Tendero' })).toBe(false);
    expect(debeMostrarAvisoDosFactores(null)).toBe(false);
    expect(debeMostrarAvisoDosFactores(undefined)).toBe(false);
  });
});

describe('contrato del evento', () => {
  it('el nombre del evento es estable (lo emite AuthContext y lo escucha el layout)', () => {
    expect(EVENTO_2FA_REQUERIDO).toBe('require-2fa');
  });
});
