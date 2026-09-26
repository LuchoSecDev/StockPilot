import { describe, it, expect } from 'vitest';
import { aplicarAjusteIA } from '../../utils/guardrailsIA.js';

describe('aplicarAjusteIA (guardrail de ajuste de IA, ex-duplicado en aiController.js y suppliersController.js)', () => {
  it('clase A: permite hasta +100%', () => {
    const r = aplicarAjusteIA(100, 150, 'A');
    expect(r.clampedAdj).toBe(100);
    expect(r.finalTotal).toBe(200);
  });

  it('clase B: recorta a +50% aunque la IA sugiera más', () => {
    const r = aplicarAjusteIA(100, 90, 'B');
    expect(r.clampedAdj).toBe(50);
    expect(r.finalTotal).toBe(150);
  });

  it('clase C (o cualquier otra): recorta a +20%', () => {
    const r = aplicarAjusteIA(100, 80, 'C');
    expect(r.clampedAdj).toBe(20);
    expect(r.finalTotal).toBe(120);
  });

  it('piso de -50% para cualquier clase, incluso si la IA sugiere bajar más', () => {
    const r = aplicarAjusteIA(100, -90, 'A');
    expect(r.clampedAdj).toBe(-50);
    expect(r.finalTotal).toBe(50);
  });

  it('un ajuste dentro de rango no se recorta', () => {
    const r = aplicarAjusteIA(200, 10, 'B');
    expect(r.clampedAdj).toBe(10);
    // 200 * 1.1 = 220.00000000000003 en punto flotante de JS -> Math.ceil da 221.
    // Es el comportamiento real de la fórmula original (Math.ceil(base * (1 + %/100))),
    // no algo introducido por esta extracción.
    expect(r.finalTotal).toBe(221);
  });

  it('redondea finalTotal hacia arriba (Math.ceil)', () => {
    const r = aplicarAjusteIA(10, 3, 'A'); // 10 * 1.03 = 10.3
    expect(r.finalTotal).toBe(11);
  });
});
