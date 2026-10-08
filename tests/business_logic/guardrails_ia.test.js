import { describe, it, expect } from 'vitest';
import { aplicarAjusteIA } from '../../services/inventory/guardrailsIA.js';

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
    // 200 * 1.1 da 220.00000000000003 en punto flotante de JS. Sin la corrección de
    // redondeo previa a Math.ceil, esto daba 221 (un entero de más). Debe dar 220 exacto.
    expect(r.finalTotal).toBe(220);
  });

  it('redondea finalTotal hacia arriba (Math.ceil)', () => {
    const r = aplicarAjusteIA(10, 3, 'A'); // 10 * 1.03 = 10.3
    expect(r.finalTotal).toBe(11);
  });

  it('no esconde una fracción genuina: un resultado real de 1000.00005 sigue redondeando hacia arriba a 1001', () => {
    const r = aplicarAjusteIA(1000.00005, 0, 'A'); // no es ruido de punto flotante, es una fracción real
    expect(r.finalTotal).toBe(1001);
  });
});
