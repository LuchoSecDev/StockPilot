import { describe, it, expect } from 'vitest';
import { montoContado, describirDiferencia, elArqueoCambio, lineasDelArqueo, formatoPesos } from '../../frontend/src/utils/arqueo.js';

describe('montoContado (lo que el vendedor escribe en «Efectivo total en cajón»)', () => {
  it('acepta un número finito >= 0, también como texto, y el 0', () => {
    expect(montoContado('60000')).toBe(60000);
    expect(montoContado(60000)).toBe(60000);
    expect(montoContado('0')).toBe(0);
    expect(montoContado('50000.5')).toBe(50000.5);
  });

  it('rechaza (null) lo vacío, negativo, no numérico o infinito', () => {
    for (const malo of ['', null, undefined, '-1', 'abc', 'NaN', 'Infinity', '12abc']) {
      expect(montoContado(malo), String(malo)).toBeNull();
    }
  });
});

describe('describirDiferencia (declarado − esperado)', () => {
  it('0 cuadra', () => {
    expect(describirDiferencia(0).tipo).toBe('cuadra');
    expect(describirDiferencia(0).titulo).toBe('Cuadra');
  });

  it('positiva sobra y dice cuánto de más', () => {
    const r = describirDiferencia(8500);
    expect(r.tipo).toBe('sobra');
    expect(r.detalle).toMatch(/\$8[.,]500 de más/);
  });

  it('negativa falta y dice cuánto (sin signo menos)', () => {
    const r = describirDiferencia(-4500);
    expect(r.tipo).toBe('falta');
    expect(r.detalle).toMatch(/Faltan \$4[.,]500/);
    expect(r.detalle).not.toMatch(/-/);
  });

  it('el ruido de decimales no cuenta como diferencia (0,1 + 0,2 − 0,3)', () => {
    expect(describirDiferencia(0.1 + 0.2 - 0.3).tipo).toBe('cuadra');
  });

  it('50 centavos de más sí es un sobrante', () => {
    expect(describirDiferencia(0.5).tipo).toBe('sobra');
  });
});

describe('elArqueoCambio (vista previa [K5] vs cierre real [K3])', () => {
  const previo = { monto_apertura: 50000, ventas_efectivo: 9000, abonos_efectivo: 0, egresos: 10000, monto_cierre_calculado: 49000, monto_cierre_declarado: 57500, diferencia: 8500 };

  it('igual: no cambió', () => {
    expect(elArqueoCambio(previo, { ...previo })).toBe(false);
  });

  it('si se vendió algo en medio, cambió lo esperado y la diferencia', () => {
    expect(elArqueoCambio(previo, { ...previo, ventas_efectivo: 13500, monto_cierre_calculado: 53500, diferencia: 4000 })).toBe(true);
  });

  it('sin una de las dos, no se puede comparar: false', () => {
    expect(elArqueoCambio(null, previo)).toBe(false);
    expect(elArqueoCambio(previo, undefined)).toBe(false);
  });
});

describe('lineasDelArqueo', () => {
  it('muestra el desglose en el orden de la cuenta: fondo, ventas, abonos y egresos', () => {
    const lineas = lineasDelArqueo({ monto_apertura: 50000, ventas_efectivo: 9000, abonos_efectivo: 1000, egresos: 10000 });
    expect(lineas.map((l) => l.clave)).toEqual(['apertura', 'ventas', 'abonos', 'egresos']);
    expect(lineas.map((l) => l.signo)).toEqual(['', '+', '+', '−']);
    expect(lineas.map((l) => l.monto)).toEqual([50000, 9000, 1000, 10000]);
  });
});

describe('formatoPesos', () => {
  it('agrupa los miles al estilo colombiano', () => {
    expect(formatoPesos(1500)).toMatch(/^\$1[.,]500$/);
  });
});
