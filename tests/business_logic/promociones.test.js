import { describe, it, expect } from 'vitest';
import { normalizarDescuento, calcularImpactoPromocion, determinarPromocionFallback } from '../../utils/promociones.js';

describe('normalizarDescuento (corrección de descuento efectivo de la IA)', () => {
  it('2x1 sin porcentaje explícito (0) se corrige a 50%', () => {
    expect(normalizarDescuento('2x1', 0)).toBe(50);
  });
  it('2x1 con porcentaje explícito no se toca (la IA ya lo puso)', () => {
    expect(normalizarDescuento('2x1', 30)).toBe(30);
  });
  it('otros tipos de promoción no se corrigen', () => {
    expect(normalizarDescuento('descuento', 0)).toBe(0);
    expect(normalizarDescuento('combo', 15)).toBe(15);
  });
  it('discount undefined/null se trata como 0', () => {
    expect(normalizarDescuento('descuento', undefined)).toBe(0);
    expect(normalizarDescuento('2x1', null)).toBe(50);
  });
});

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

describe('determinarPromocionFallback (reglas deterministas cuando la IA no cubre un candidato)', () => {
  it('vence en 10 días o menos: liquidación al 25%, duración = días restantes (mínimo 3)', () => {
    const r = determinarPromocionFallback(7, 20);
    expect(r.type).toBe('liquidacion');
    expect(r.discount).toBe(25);
    expect(r.duration_days).toBe(7);
    expect(r.reason).toMatch(/Vence en 7 días/);
  });

  it('vence en 10 días o menos: duration_days nunca baja de 3', () => {
    const r = determinarPromocionFallback(1, 20);
    expect(r.duration_days).toBe(3);
  });

  it('vence entre 11 y 30 días: descuento moderado del 15% por 7 días', () => {
    const r = determinarPromocionFallback(20, 20);
    expect(r.type).toBe('descuento');
    expect(r.discount).toBe(15);
    expect(r.duration_days).toBe(7);
    expect(r.reason).toMatch(/Con vencimiento próximo en 20 días/);
  });

  it('no vence (null) pero hay sobrestock (>50): combo al 10% por 14 días', () => {
    const r = determinarPromocionFallback(null, 80);
    expect(r.type).toBe('combo');
    expect(r.discount).toBe(10);
    expect(r.duration_days).toBe(14);
  });

  it('no vence y sin sobrestock: descuento genérico del 15% por 10 días (baja rotación)', () => {
    const r = determinarPromocionFallback(null, 10);
    expect(r.type).toBe('descuento');
    expect(r.discount).toBe(15);
    expect(r.duration_days).toBe(10);
  });
});
