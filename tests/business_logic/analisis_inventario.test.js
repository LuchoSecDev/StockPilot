import { describe, it, expect } from 'vitest';
import { normalizarDiasCobertura, armarSnapshot } from '../../services/inventory/analisisInventario.js';

describe('normalizarDiasCobertura (parámetro ?dias= del Simulador de Escenarios)', () => {
  it('acepta de 7 a 90 días, también como texto (llega de la URL)', () => {
    expect(normalizarDiasCobertura(7)).toBe(7);
    expect(normalizarDiasCobertura('30')).toBe(30);
    expect(normalizarDiasCobertura('90')).toBe(90);
  });

  it('fuera de rango, vacío o basura se ignora (cada producto usa su cobertura normal)', () => {
    expect(normalizarDiasCobertura(6)).toBeUndefined();
    expect(normalizarDiasCobertura(91)).toBeUndefined();
    expect(normalizarDiasCobertura(undefined)).toBeUndefined();
    expect(normalizarDiasCobertura('abc')).toBeUndefined();
    expect(normalizarDiasCobertura('')).toBeUndefined();
  });
});

describe('armarSnapshot', () => {
  const entrada = (overrides = {}) => ({
    id_producto: 5, nombre_producto: 'Leche', categoria: 'Lácteos', claseABC: 'A',
    stock_actual: 0, stock_seguridad: 5, stock_minimo: 5, lead_time: 3, frecuencia_compra_dias: 7,
    velocity_7d: 2, velocity_30d: 2, qty_30d_total: 60, factor_ia: null,
    costo_compra: 800, precio: 1200, revenue: 72000.4, id_proveedor: 9, proveedor: 'Lácteos SA',
    ...overrides
  });

  it('sin productos, lista vacía', () => {
    expect(armarSnapshot([])).toEqual([]);
  });

  it('devuelve el contrato que consume el frontend', () => {
    const [fila] = armarSnapshot([entrada()]);
    expect(fila).toMatchObject({
      id_producto: 5, nombre: 'Leche', categoria: 'Lácteos', category: 'A',
      proveedor: 'Lácteos SA', id_proveedor: 9, stock_actual: 0, lead_time: 3,
      costo_unitario: 800, precio: 1200, revenue: 72000, velocity: 2
    });
    expect(Object.keys(fila)).toHaveLength(20);
  });

  it('un objetivo de cobertura mayor recomienda comprar más', () => {
    const [normal] = armarSnapshot([entrada()]);
    const [largo] = armarSnapshot([entrada()], 90);
    expect(largo.cantidad_recomendada).toBeGreaterThan(normal.cantidad_recomendada);
  });

  it('un producto con stock de sobra no recomienda comprar', () => {
    const [fila] = armarSnapshot([entrada({ stock_actual: 500 })]);
    expect(fila.cantidad_recomendada).toBe(0);
    expect(fila.nivel).toBe('ok');
  });
});
