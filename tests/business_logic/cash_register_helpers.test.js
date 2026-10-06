import { describe, it, expect } from 'vitest';
import { evaluarDescuadreCaja, normalizarMontoDeclarado, desglosePorMetodo, METODOS_VENTA, METODOS_ABONO } from '../../utils/cashRegisterHelpers.js';

describe('evaluarDescuadreCaja', () => {
  it('faltante significativo (> umbral): esSignificativo true, esFaltante true, título y mensaje de faltante', () => {
    const r = evaluarDescuadreCaja(-6000);
    expect(r.esSignificativo).toBe(true);
    expect(r.esFaltante).toBe(true);
    expect(r.titulo).toBe('⚠️ Faltante en Caja');
    expect(r.mensaje).toMatch(/faltante/);
    expect(r.mensaje).toMatch(/\$6[.,]000/);
  });

  it('sobrante significativo (> umbral): esFaltante false, título y mensaje de sobrante', () => {
    const r = evaluarDescuadreCaja(7000);
    expect(r.esSignificativo).toBe(true);
    expect(r.esFaltante).toBe(false);
    expect(r.titulo).toBe('💰 Sobrante en Caja');
    expect(r.mensaje).toMatch(/sobrante/);
  });

  it('diferencia dentro del umbral (±5000, sin exceder): no es significativo', () => {
    expect(evaluarDescuadreCaja(5000).esSignificativo).toBe(false);
    expect(evaluarDescuadreCaja(-5000).esSignificativo).toBe(false);
    expect(evaluarDescuadreCaja(0).esSignificativo).toBe(false);
  });

  it('acepta un umbral distinto del default (5000)', () => {
    expect(evaluarDescuadreCaja(-1500, 1000).esSignificativo).toBe(true);
    expect(evaluarDescuadreCaja(-800, 1000).esSignificativo).toBe(false);
  });
});

describe('normalizarMontoDeclarado', () => {
  it('acepta un número finito >= 0, incluido el 0 y los decimales', () => {
    expect(normalizarMontoDeclarado(60000)).toBe(60000);
    expect(normalizarMontoDeclarado(0)).toBe(0);
    expect(normalizarMontoDeclarado(50000.5)).toBe(50000.5);
  });

  it('acepta un texto numérico (con espacios alrededor) y lo devuelve como NÚMERO', () => {
    expect(normalizarMontoDeclarado('60000')).toBe(60000);
    expect(normalizarMontoDeclarado(' 60000.50 ')).toBe(60000.5);
    expect(normalizarMontoDeclarado('0')).toBe(0);
  });

  it('rechaza (null) lo ausente, negativo, no finito, vacío, de texto o de otro tipo', () => {
    for (const malo of [undefined, null, -1, -0.01, NaN, Infinity, -Infinity, '', ' ', 'abc', '12abc', '-5', '1e3', '1,5', '.5', [], [5], {}, true, false]) {
      expect(normalizarMontoDeclarado(malo), String(malo)).toBeNull();
    }
  });
});

describe('desglosePorMetodo (desglose de auditoría del cierre de caja)', () => {
  const CERO = { cantidad: 0, total: 0 };

  it('sin movimientos: todas las claves conocidas y «Otro», en cero', () => {
    expect(desglosePorMetodo([], METODOS_VENTA)).toEqual({ Efectivo: CERO, Tarjeta: CERO, Transferencia: CERO, Fiado: CERO, Otro: CERO });
    expect(desglosePorMetodo([], METODOS_ABONO)).toEqual({ Efectivo: CERO, Tarjeta: CERO, Transferencia: CERO, Otro: CERO });
  });

  it('separa cada método y entiende las cifras que llegan de PostgreSQL como texto', () => {
    const r = desglosePorMetodo([
      { metodo_pago: 'Efectivo', cantidad: '2', total: '13500.00' },
      { metodo_pago: 'Tarjeta', cantidad: '1', total: '4500.00' }
    ], METODOS_VENTA);
    expect(r.Efectivo).toEqual({ cantidad: 2, total: 13500 });
    expect(r.Tarjeta).toEqual({ cantidad: 1, total: 4500 });
    expect(r.Transferencia).toEqual(CERO);
  });

  it('un método desconocido (o con otra escritura) NO se pierde: cae en «Otro»', () => {
    const r = desglosePorMetodo([
      { metodo_pago: 'Cheque', cantidad: 1, total: 1000 },
      { metodo_pago: 'efectivo', cantidad: 2, total: 500 },
      { metodo_pago: null, cantidad: 1, total: 250 }
    ], METODOS_VENTA);
    expect(r.Otro).toEqual({ cantidad: 4, total: 1750 });
    expect(r.Efectivo).toEqual(CERO);
  });

  it('en los abonos, «Fiado» no es un método de pago: cae en «Otro»', () => {
    const r = desglosePorMetodo([{ metodo_pago: 'Fiado', cantidad: 1, total: 100 }], METODOS_ABONO);
    expect(r.Otro).toEqual({ cantidad: 1, total: 100 });
    expect(r).not.toHaveProperty('Fiado');
  });

  it('los importes se redondean a centavos (sin restos de decimales)', () => {
    const r = desglosePorMetodo([
      { metodo_pago: 'Efectivo', cantidad: 1, total: 0.1 },
      { metodo_pago: 'Efectivo', cantidad: 1, total: 0.2 }
    ], METODOS_VENTA);
    expect(r.Efectivo.total).toBe(0.3);
  });

  it('la suma de todos los métodos es el total de las filas (nada se pierde ni se duplica)', () => {
    const filas = [
      { metodo_pago: 'Efectivo', cantidad: 2, total: 9000 },
      { metodo_pago: 'Tarjeta', cantidad: 1, total: 4500 },
      { metodo_pago: 'Fiado', cantidad: 1, total: 4500 },
      { metodo_pago: 'Cheque', cantidad: 1, total: 4500 }
    ];
    const r = desglosePorMetodo(filas, METODOS_VENTA);
    expect(Object.values(r).reduce((a, m) => a + m.total, 0)).toBe(22500);
    expect(Object.values(r).reduce((a, m) => a + m.cantidad, 0)).toBe(5);
  });
});
