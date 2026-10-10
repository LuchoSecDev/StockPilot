import { describe, it, expect } from 'vitest';
import {
  grupoDeAlerta, alertasDelGrupo, contarAlertas, seccionesDeAlertas, textoInsignia
} from '../../frontend/src/utils/alertas.js';

/**
 * 9-oct-2026. Regla ÚNICA de las alertas para la interfaz (campanita, Monitor de Alertas, Dashboard e insignia del menú),
 * decidida por Luis: se agrupan por SEVERIDAD, no por tipo. Críticas = stock crítico + vencimiento crítico; Advertencias =
 * stock bajo + próximas a vencer; Informativas = sobrestock (y avisos como la reversión de precio). Se cuenta por PRODUCTO
 * distinto, no por fila. Es la misma regla que Alert.getStats usa en el servidor;
 * tests/integration/alertas_conteo_coherente.test.js comprueba que las dos coinciden.
 *
 * Antes las tarjetas del Monitor contaban por tipo (4 / 3 / 5) y sus filtros por severidad (6 / 5 / 1), y la campanita pedía
 * solo 5 alertas y mostraba «+9».
 */
let siguienteId = 0; // id_alerta único por fila: dos alertas del mismo producto son filas distintas
const alerta = (id_producto, tipo, severidad) => ({ id_alerta: ++siguienteId, id_producto, tipo, severidad });
const critica = (p, tipo = 'stock_critico') => alerta(p, tipo, 'critico');
const amarilla = (p, tipo = 'stock_bajo') => alerta(p, tipo, 'advertencia');

// Las 12 alertas de la tienda de demostración.
const DEMO = [
  critica(1), critica(2), critica(3), critica(4),
  critica(5, 'vencimiento_critico'), critica(6, 'vencimiento_critico'),
  amarilla(7), amarilla(8), amarilla(9),
  amarilla(10, 'vencimiento_proximo'), amarilla(11, 'vencimiento_proximo'),
  alerta(12, 'sobrestock', 'info'),
];

describe('grupoDeAlerta (por severidad)', () => {
  it('«critico» y «advertencia» son sus grupos; cualquier otra cosa es «info»', () => {
    expect(grupoDeAlerta('critico')).toBe('critico');
    expect(grupoDeAlerta('advertencia')).toBe('advertencia');
    for (const s of ['info', 'otra', '', undefined, null]) expect(grupoDeAlerta(s)).toBe('info');
  });
});

describe('contarAlertas (misma regla que Alert.getStats)', () => {
  it('con las 12 alertas de la demostración: 6 críticas, 5 advertencias, 1 informativa, 12 en total', () => {
    expect(contarAlertas(DEMO)).toEqual({ total: 12, critico: 6, advertencia: 5, info: 1 });
  });

  it('los vencimientos críticos cuentan como críticas, igual que el stock crítico', () => {
    expect(contarAlertas([critica(1, 'vencimiento_critico')])).toEqual({ total: 1, critico: 1, advertencia: 0, info: 0 });
    expect(contarAlertas([amarilla(1, 'vencimiento_proximo')])).toEqual({ total: 1, critico: 0, advertencia: 1, info: 0 });
  });

  it('un producto con dos alertas críticas (stock y vencimiento) cuenta UNA vez', () => {
    const dos = [critica(1), critica(1, 'vencimiento_critico')];
    expect(contarAlertas(dos)).toEqual({ total: 1, critico: 1, advertencia: 0, info: 0 });
  });

  it('un producto con alertas de grupos distintos cuenta en cada grupo y una sola vez en el total', () => {
    const mixto = [critica(1), amarilla(1, 'vencimiento_proximo')];
    expect(contarAlertas(mixto)).toEqual({ total: 1, critico: 1, advertencia: 1, info: 0 });
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

  it('«críticas» trae el stock crítico Y el vencimiento crítico; «advertencias», el stock bajo Y las próximas a vencer', () => {
    expect(new Set(alertasDelGrupo(DEMO, 'critico').map((a) => a.tipo))).toEqual(new Set(['stock_critico', 'vencimiento_critico']));
    expect(new Set(alertasDelGrupo(DEMO, 'advertencia').map((a) => a.tipo))).toEqual(new Set(['stock_bajo', 'vencimiento_proximo']));
    expect(alertasDelGrupo(DEMO, 'info').map((a) => a.tipo)).toEqual(['sobrestock']);
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

describe('seccionesDeAlertas (los separadores de la lista del Monitor)', () => {
  const resumen = (secciones) => secciones.map((s) => [s.clave, s.grupo, s.alertas.length]);

  it('en «todas» salen las 5 secciones en orden: críticas (stock, vencimiento), advertencias (stock, vencimiento), sobrestock', () => {
    expect(resumen(seccionesDeAlertas(DEMO, 'todas'))).toEqual([
      ['stock_critico', 'critico', 4],
      ['vencimiento_critico', 'critico', 2],
      ['stock_bajo', 'advertencia', 3],
      ['vencimiento_proximo', 'advertencia', 2],
      ['sobrestock', 'info', 1],
    ]);
  });

  it('cada sección lleva un título que dice de qué es (stock o vencimiento) y cuántas son', () => {
    const titulos = seccionesDeAlertas(DEMO, 'todas').map((s) => s.titulo);
    expect(titulos).toEqual([
      'Stock crítico', 'Por vencer (7 días o menos)', 'Stock bajo', 'Próximas a vencer (8 a 30 días)', 'Sobrestock',
    ]);
  });

  it('al filtrar por una tarjeta solo salen las secciones de ese grupo', () => {
    expect(resumen(seccionesDeAlertas(DEMO, 'critico')).map((s) => s[0])).toEqual(['stock_critico', 'vencimiento_critico']);
    expect(resumen(seccionesDeAlertas(DEMO, 'advertencia')).map((s) => s[0])).toEqual(['stock_bajo', 'vencimiento_proximo']);
    expect(resumen(seccionesDeAlertas(DEMO, 'info')).map((s) => s[0])).toEqual(['sobrestock']);
  });

  it('las secciones vacías no se muestran', () => {
    expect(seccionesDeAlertas([critica(1)], 'todas').map((s) => s.clave)).toEqual(['stock_critico']);
    expect(seccionesDeAlertas([], 'todas')).toEqual([]);
    expect(seccionesDeAlertas(undefined, 'critico')).toEqual([]);
  });

  it('un producto con stock crítico y vencimiento crítico sale en LAS DOS secciones (y cuenta una vez en la tarjeta)', () => {
    const lista = [critica(1), critica(1, 'vencimiento_critico')];
    expect(resumen(seccionesDeAlertas(lista, 'critico'))).toEqual([['stock_critico', 'critico', 1], ['vencimiento_critico', 'critico', 1]]);
    expect(contarAlertas(lista).critico).toBe(1);
  });

  it('un tipo que no conocemos va a «Otras alertas» de su grupo, al final, y no se pierde', () => {
    const lista = [critica(1), alerta(2, 'reversion_precio', 'info'), alerta(3, 'tipo_nuevo', 'critico')];
    const s = seccionesDeAlertas(lista, 'todas');
    expect(s.map((x) => [x.clave, x.titulo])).toEqual([
      ['stock_critico', 'Stock crítico'], ['otras_critico', 'Otras alertas'], ['otras_info', 'Otras alertas'],
    ]);
    expect(s.flatMap((x) => x.alertas)).toHaveLength(3);
  });

  it('las filas de todas las secciones suman las de las tarjetas (nada se pierde ni se repite)', () => {
    const filas = seccionesDeAlertas(DEMO, 'todas').flatMap((s) => s.alertas.map((a) => a.id_alerta));
    expect(filas.sort((a, b) => a - b)).toEqual(DEMO.map((a) => a.id_alerta).sort((a, b) => a - b));
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
