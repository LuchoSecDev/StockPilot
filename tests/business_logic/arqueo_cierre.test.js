import { describe, it, expect } from 'vitest';
import { montoContado, describirDiferencia, elArqueoCambio, lineasDelArqueo, formatoPesos, lineasPorMetodo, textoDeVentas } from '../../frontend/src/utils/arqueo.js';

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

describe('lineasPorMetodo (desglose por método de pago)', () => {
  const desglose = {
    Otro: { cantidad: 0, total: 0 },
    Fiado: { cantidad: 1, total: 4500 },
    Tarjeta: { cantidad: 1, total: 4500 },
    Efectivo: { cantidad: 2, total: 13500 },
    Transferencia: { cantidad: 0, total: 0 },
  };

  it('las ordena siempre igual (efectivo, tarjeta, transferencia, fiado, otro) aunque lleguen desordenadas', () => {
    expect(lineasPorMetodo(desglose).map((l) => l.metodo)).toEqual(['Efectivo', 'Tarjeta', 'Transferencia', 'Fiado', 'Otro']);
  });

  it('con soloConMovimiento deja fuera los métodos sin ventas ni importe', () => {
    expect(lineasPorMetodo(desglose, { soloConMovimiento: true }).map((l) => l.metodo)).toEqual(['Efectivo', 'Tarjeta', 'Fiado']);
  });

  it('solo el efectivo entra al cajón: tarjeta, transferencia y fiado no', () => {
    const porMetodo = Object.fromEntries(lineasPorMetodo(desglose).map((l) => [l.metodo, l.entraAlCajon]));
    expect(porMetodo).toEqual({ Efectivo: true, Tarjeta: false, Transferencia: false, Fiado: false, Otro: false });
  });

  it('el fiado lleva una etiqueta que aclara que es crédito', () => {
    expect(lineasPorMetodo(desglose).find((l) => l.metodo === 'Fiado').etiqueta).toBe('Fiado (crédito)');
  });

  it('un método nuevo que el servidor agregue se muestra al final con su propio nombre (no se pierde)', () => {
    const l = lineasPorMetodo({ ...desglose, Cripto: { cantidad: 1, total: 10 } }).at(-1);
    expect(l.metodo).toBe('Cripto');
    expect(l.etiqueta).toBe('Cripto');
  });

  it('un importe sin cantidad se sigue mostrando (no se oculta dinero)', () => {
    expect(lineasPorMetodo({ Tarjeta: { cantidad: 0, total: 500 } }, { soloConMovimiento: true })).toHaveLength(1);
  });

  it('sin desglose (un servidor viejo) devuelve una lista vacía en vez de romper', () => {
    expect(lineasPorMetodo(undefined)).toEqual([]);
    expect(lineasPorMetodo(null, { soloConMovimiento: true })).toEqual([]);
  });
});

describe('textoDeVentas', () => {
  it('singular y plural', () => {
    expect(textoDeVentas(1)).toBe('1 venta');
    expect(textoDeVentas(0)).toBe('0 ventas');
    expect(textoDeVentas(3)).toBe('3 ventas');
  });
});
