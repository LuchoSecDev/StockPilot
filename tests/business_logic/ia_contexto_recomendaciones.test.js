import { describe, it, expect } from 'vitest';
import { armarContextoProductos, armarRecomendaciones } from '../../services/ia/contextoRecomendaciones.js';

/** Un producto del contexto, como lo deja `armarContextoProductos`. */
const producto = (overrides = {}) => ({
  id: 1, nombre: 'Arroz', base_load: 10, abc: 'A', avg_precision: 0.8, trend_label: 'alcista',
  urgencia: 'HOY', dias_para_agotar: 2, costo_unitario: 500, costo_estimado: false,
  id_proveedor: 7, proveedor: 'Distribuidora',
  ...overrides
});

describe('armarRecomendaciones: de lo que dice la IA a la recomendación final', () => {
  it('aplica el ajuste de la IA sobre la cantidad base', () => {
    const [r] = armarRecomendaciones([{ id: 1, adjustment: '+50%', reason: 'Se vende bien' }], [producto()]);
    expect(r).toMatchObject({
      id_producto: 1, product: 'Arroz', base: 10, adjustment: '+50%', final: 15,
      reason: 'Se vende bien', trend: 'alcista', id_proveedor: 7, proveedor: 'Distribuidora'
    });
  });

  it('guardrail: la IA no puede pasarse del tope de su clase (A +100%, B +50%, C +20%)', () => {
    const tope = (abc, pedido) => armarRecomendaciones([{ id: 1, adjustment: pedido }], [producto({ abc })])[0].adjustment;
    expect(tope('A', '+500%')).toBe('+100%');
    expect(tope('B', '+500%')).toBe('+50%');
    expect(tope('C', '+90%')).toBe('+20%');
  });

  it('guardrail: la reducción nunca baja de -50%', () => {
    const [r] = armarRecomendaciones([{ id: 1, adjustment: '-80%' }], [producto()]);
    expect(r.adjustment).toBe('-50%');
    expect(r.final).toBe(5);
  });

  it('tolera que la IA devuelva el id como texto', () => {
    expect(armarRecomendaciones([{ id: '1', adjustment: '+10%' }], [producto()])).toHaveLength(1);
  });

  it('tolera un ajuste ausente o con texto raro: se trata como 0%', () => {
    expect(armarRecomendaciones([{ id: 1 }], [producto()])[0].adjustment).toBe('0%');
    expect(armarRecomendaciones([{ id: 1, adjustment: 'sin cambio' }], [producto()])[0].adjustment).toBe('0%');
    expect(armarRecomendaciones([{ id: 1, adjustment: '+20 %' }], [producto()])[0].adjustment).toBe('+20%');
  });

  it('descarta ids que la IA inventó', () => {
    expect(armarRecomendaciones([{ id: 999, adjustment: '+10%' }], [producto()])).toEqual([]);
  });

  it('descarta las sugerencias de 0 unidades (no son accionables)', () => {
    expect(armarRecomendaciones([{ id: 1, adjustment: '+10%' }], [producto({ base_load: 0 })])).toEqual([]);
  });

  it('confianza: el promedio de aciertos en porcentaje; sin historial, 50% (incertidumbre)', () => {
    expect(armarRecomendaciones([{ id: 1 }], [producto({ avg_precision: 0.8 })])[0].confidence).toBe(80);
    expect(armarRecomendaciones([{ id: 1 }], [producto({ avg_precision: null })])[0].confidence).toBe(50);
    expect(armarRecomendaciones([{ id: 1 }], [producto({ avg_precision: undefined })])[0].confidence).toBe(50);
  });

  it('sin proveedor, devuelve null y no undefined', () => {
    const [r] = armarRecomendaciones([{ id: 1 }], [producto({ id_proveedor: undefined, proveedor: undefined })]);
    expect(r.id_proveedor).toBeNull();
    expect(r.proveedor).toBeNull();
  });
});

describe('armarContextoProductos: cruce con el motor único de reposición', () => {
  const entrada = (overrides = {}) => ({
    id_producto: 5, nombre_producto: 'Leche', stock_actual: 0, velocity_7d: 2, velocity_30d: 2,
    qty_30d_total: 60, claseABC: 'A', stock_seguridad: 5, stock_minimo: 5, lead_time: 3,
    frecuencia_compra_dias: 7, factor_ia: null, costo_compra: 800, precio: 1200,
    id_proveedor: 9, proveedor: 'Lácteos SA',
    ...overrides
  });

  it('un producto agotado con ventas pide reposición', () => {
    const [p] = armarContextoProductos([entrada()]);
    expect(p).toMatchObject({ id: 5, nombre: 'Leche', stock: 0, abc: 'A', nivel: 'agotado', id_proveedor: 9, proveedor: 'Lácteos SA' });
    expect(p.base_load).toBeGreaterThan(0);
    expect(p.costo_unitario).toBe(800);
  });

  it('un producto con stock de sobra no pide nada', () => {
    const [p] = armarContextoProductos([entrada({ stock_actual: 500 })]);
    expect(p.base_load).toBe(0);
    expect(p.nivel).toBe('ok');
  });

  it('etiqueta la tendencia: alcista si la última semana supera al mes, bajista si cae', () => {
    const etiqueta = (v7, v30) => armarContextoProductos([entrada({ velocity_7d: v7, velocity_30d: v30 })])[0].trend_label;
    expect(etiqueta(3, 1)).toBe('alcista');
    expect(etiqueta(0.2, 1)).toBe('bajista');
    expect(etiqueta(1, 1)).toBe('estable');
  });

  it('pasa la confianza (factor_ia) tal cual, null incluido', () => {
    expect(armarContextoProductos([entrada({ factor_ia: 0.75 })])[0].avg_precision).toBe(0.75);
    expect(armarContextoProductos([entrada({ factor_ia: null })])[0].avg_precision).toBeNull();
  });

  it('lista vacía → lista vacía', () => {
    expect(armarContextoProductos([])).toEqual([]);
  });
});
