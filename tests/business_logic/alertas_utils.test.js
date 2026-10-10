import { describe, it, expect } from 'vitest';
import { grupoDeAlerta, alertasDelGrupo, contarAlertas, textoInsignia } from '../../frontend/src/utils/alertas.js';

/**
 * 9-oct-2026. Los números de alertas no cuadraban entre pantallas: las tarjetas del Monitor contaban por TIPO
 * (stock crítico 4, stock bajo 3, el resto 5) pero sus filtros filtraban por SEVERIDAD (6 / 5 / 1); la campanita pedía solo
 * 5 alertas (críticas primero, así que las advertencias nunca salían) y mostraba un «+9» como tope. Estas funciones son
 * la ÚNICA regla del frontend: la misma que Alert.getStats usa en el servidor (stock_critico / stock_bajo / el resto, y por
 * producto distinto, no por fila). tests/integration/alertas_conteo_coherente.test.js comprueba que coinciden.
 */
let siguienteId = 0; // id_alerta único por fila: dos alertas del mismo producto son filas distintas
const alerta = (id_producto, tipo, severidad = 'critico') => ({ id_alerta: ++siguienteId, id_producto, tipo, severidad });

// Las 12 alertas de la tienda de demostración.
const DEMO = [
  alerta(1, 'stock_critico'), alerta(2, 'stock_critico'), alerta(3, 'stock_critico'), alerta(4, 'stock_critico'),
  alerta(5, 'vencimiento_critico'), alerta(6, 'vencimiento_critico'),
  alerta(7, 'stock_bajo', 'advertencia'), alerta(8, 'stock_bajo', 'advertencia'), alerta(9, 'stock_bajo', 'advertencia'),
  alerta(10, 'vencimiento_proximo', 'advertencia'), alerta(11, 'vencimiento_proximo', 'advertencia'),
  alerta(12, 'sobrestock', 'info'),
];

describe('grupoDeAlerta', () => {
  it('stock crítico y stock bajo tienen su grupo; todo lo demás (vencimientos, sobrestock, reversión de precio) es «info»', () => {
    expect(grupoDeAlerta('stock_critico')).toBe('critico');
    expect(grupoDeAlerta('stock_bajo')).toBe('advertencia');
    for (const t of ['vencimiento_critico', 'vencimiento_proximo', 'sobrestock', 'reversion_precio', 'algo_nuevo', undefined, null]) {
      expect(grupoDeAlerta(t)).toBe('info');
    }
  });
});

describe('contarAlertas (misma regla que Alert.getStats)', () => {
  it('con las 12 alertas de la demostración: 4 críticas de stock, 3 de stock bajo, 5 de vencimiento y sobrestock, 12 en total', () => {
    expect(contarAlertas(DEMO)).toEqual({ total: 12, critico: 4, advertencia: 3, info: 5 });
  });

  it('cuenta PRODUCTOS distintos, no filas: un producto con dos alertas del mismo grupo cuenta una vez', () => {
    const dosDelMismoGrupo = [alerta(1, 'vencimiento_critico'), alerta(1, 'sobrestock', 'info')];
    expect(contarAlertas(dosDelMismoGrupo)).toEqual({ total: 1, critico: 0, advertencia: 0, info: 1 });
  });

  it('un producto con alertas de grupos distintos cuenta en cada grupo y una sola vez en el total', () => {
    const mixto = [alerta(1, 'stock_critico'), alerta(1, 'vencimiento_proximo', 'advertencia')];
    expect(contarAlertas(mixto)).toEqual({ total: 1, critico: 1, advertencia: 0, info: 1 });
  });

  it('tolera listas vacías o ausentes', () => {
    const cero = { total: 0, critico: 0, advertencia: 0, info: 0 };
    expect(contarAlertas([])).toEqual(cero);
    expect(contarAlertas(undefined)).toEqual(cero);
    expect(contarAlertas(null)).toEqual(cero);
  });
});

describe('alertasDelGrupo (los filtros del Monitor)', () => {
  it('cada filtro muestra exactamente tantas filas como dice su tarjeta', () => {
    const c = contarAlertas(DEMO);
    expect(alertasDelGrupo(DEMO, 'critico')).toHaveLength(c.critico);
    expect(alertasDelGrupo(DEMO, 'advertencia')).toHaveLength(c.advertencia);
    expect(alertasDelGrupo(DEMO, 'info')).toHaveLength(c.info);
    expect(alertasDelGrupo(DEMO, 'todas')).toHaveLength(c.total);
  });

  it('los vencimientos críticos NO aparecen en «críticas» (son del grupo vencimiento y sobrestock), como cuenta la tarjeta', () => {
    const tipos = alertasDelGrupo(DEMO, 'critico').map((a) => a.tipo);
    expect(new Set(tipos)).toEqual(new Set(['stock_critico']));
    expect(alertasDelGrupo(DEMO, 'info').map((a) => a.tipo).sort()).toEqual(
      ['sobrestock', 'vencimiento_critico', 'vencimiento_critico', 'vencimiento_proximo', 'vencimiento_proximo']
    );
  });

  it('los tres grupos reparten todas las alertas sin repetir ni dejar ninguna fuera', () => {
    const ids = ['critico', 'advertencia', 'info'].flatMap((g) => alertasDelGrupo(DEMO, g).map((a) => a.id_alerta));
    expect(ids.sort((a, b) => a - b)).toEqual(DEMO.map((a) => a.id_alerta).sort((a, b) => a - b));
  });

  it('un filtro desconocido (o «todas») devuelve todas, y una lista ausente devuelve una lista vacía', () => {
    expect(alertasDelGrupo(DEMO, 'todas')).toHaveLength(12);
    expect(alertasDelGrupo(DEMO, 'otro')).toHaveLength(12);
    expect(alertasDelGrupo(undefined, 'critico')).toEqual([]);
  });
});

describe('textoInsignia (el número de la campanita)', () => {
  it('muestra el número real, sin el tope de 9 que escondía cuántas alertas había', () => {
    expect(textoInsignia(0)).toBe('0');
    expect(textoInsignia(9)).toBe('9');
    expect(textoInsignia(10)).toBe('10');
    expect(textoInsignia(12)).toBe('12');
    expect(textoInsignia(99)).toBe('99');
  });

  it('solo desde 100 usa «99+» (para que el círculo no se desborde)', () => {
    expect(textoInsignia(100)).toBe('99+');
    expect(textoInsignia(1500)).toBe('99+');
  });

  it('tolera valores inválidos', () => {
    expect(textoInsignia(undefined)).toBe('0');
    expect(textoInsignia(NaN)).toBe('0');
    expect(textoInsignia(-3)).toBe('0');
  });
});
