import { describe, it, expect } from 'vitest';
import { techoSeguro } from '../../utils/redondeo.js';

describe('techoSeguro (Math.ceil sin el ruido de punto flotante de JS)', () => {
  it('absorbe el ruido cuando el resultado real es un entero exacto (2.2 * 25 = 55.00000000000001)', () => {
    expect(techoSeguro(2.2 * 25)).toBe(55);
  });

  it('absorbe el ruido cuando el resultado real es un entero exacto (200 * 1.1 = 220.00000000000003)', () => {
    expect(techoSeguro(200 * 1.1)).toBe(220);
  });

  it('no esconde una fracción genuina: sigue redondeando hacia arriba', () => {
    expect(techoSeguro(10.3)).toBe(11);
    expect(techoSeguro(1000.00005)).toBe(1001);
  });

  it('un entero exacto (sin ruido) se mantiene igual', () => {
    expect(techoSeguro(10)).toBe(10);
  });

  it('funciona igual con valores negativos', () => {
    expect(techoSeguro(-6.5)).toBe(-6);
  });
});
