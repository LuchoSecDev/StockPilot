import { describe, it, expect } from 'vitest';
import { sugerirUmbralesStock } from '../../utils/sugerenciasStock.js';

describe('sugerirUmbralesStock (umbrales de reorder point sin historial propio)', () => {
  it('calcula stock de seguridad como colchón de 2 días de venta', () => {
    const r = sugerirUmbralesStock(10, 3);
    expect(r.stockSeguridad).toBe(20);
  });

  it('calcula stock mínimo como ventas durante el lead time + el colchón', () => {
    const r = sugerirUmbralesStock(10, 3); // 10*3 + 20 = 50
    expect(r.stockMinimo).toBe(50);
  });

  it('redondea hacia arriba (Math.ceil) cuando las ventas diarias no son enteras', () => {
    const r = sugerirUmbralesStock(2.5, 3); // seguridad: ceil(5)=5; mínimo: ceil(7.5+5)=13
    expect(r.stockSeguridad).toBe(5);
    expect(r.stockMinimo).toBe(13);
  });

  it('aplica el piso mínimo de stockSeguridad=2 cuando las ventas son casi nulas', () => {
    const r = sugerirUmbralesStock(0.1, 1);
    expect(r.stockSeguridad).toBe(2);
  });

  it('aplica el piso mínimo de stockMinimo=5 cuando el cálculo da menos', () => {
    const r = sugerirUmbralesStock(0, 1);
    expect(r.stockMinimo).toBe(5);
    expect(r.stockSeguridad).toBe(2);
  });
});
