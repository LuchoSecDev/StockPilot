import { describe, it, expect } from 'vitest';
import { calcularImpactoPromocion } from '../../utils/promociones.js';

describe('calcularImpactoPromocion (ex-duplicado dentro de aiController.js)', () => {
  it('calcula precio con descuento y capital liberado', () => {
    const r = calcularImpactoPromocion(1000, 10, 20); // 20% off
    expect(r.discountedPrice).toBe(800);
    expect(r.capitalLiberado).toBe(8000);
  });

  it('sin descuento (0%): el precio no cambia', () => {
    const r = calcularImpactoPromocion(500, 4, 0);
    expect(r.discountedPrice).toBe(500);
    expect(r.capitalLiberado).toBe(2000);
  });

  it('descuento del 50% (equivalente al caso 2x1)', () => {
    const r = calcularImpactoPromocion(1000, 3, 50);
    expect(r.discountedPrice).toBe(500);
    expect(r.capitalLiberado).toBe(1500);
  });

  it('redondea discountedPrice y capitalLiberado al peso más cercano', () => {
    const r = calcularImpactoPromocion(999, 3, 15); // 999*0.85 = 849.15
    expect(r.discountedPrice).toBe(849);
    expect(r.capitalLiberado).toBe(2547);
  });
});
