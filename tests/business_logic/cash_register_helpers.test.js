import { describe, it, expect } from 'vitest';
import { evaluarDescuadreCaja } from '../../utils/cashRegisterHelpers.js';

describe('evaluarDescuadreCaja', () => {
  it('faltante significativo (> umbral): esSignificativo true, esFaltante true, título y mensaje de faltante', () => {
    const r = evaluarDescuadreCaja(-6000);
    expect(r.esSignificativo).toBe(true);
    expect(r.esFaltante).toBe(true);
    expect(r.titulo).toBe('⚠️ Faltante en Caja');
    expect(r.mensaje).toMatch(/faltante/);
    expect(r.mensaje).toMatch(/\$6[.,]000/);
  });

  it('sobrante significativo (> umbral): esFaltante false, título y mensaje de sobrante', () => {
    const r = evaluarDescuadreCaja(7000);
    expect(r.esSignificativo).toBe(true);
    expect(r.esFaltante).toBe(false);
    expect(r.titulo).toBe('💰 Sobrante en Caja');
    expect(r.mensaje).toMatch(/sobrante/);
  });

  it('diferencia dentro del umbral (±5000, sin exceder): no es significativo', () => {
    expect(evaluarDescuadreCaja(5000).esSignificativo).toBe(false);
    expect(evaluarDescuadreCaja(-5000).esSignificativo).toBe(false);
    expect(evaluarDescuadreCaja(0).esSignificativo).toBe(false);
  });

  it('acepta un umbral distinto del default (5000)', () => {
    expect(evaluarDescuadreCaja(-1500, 1000).esSignificativo).toBe(true);
    expect(evaluarDescuadreCaja(-800, 1000).esSignificativo).toBe(false);
  });
});
