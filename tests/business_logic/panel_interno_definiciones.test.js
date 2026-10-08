import { describe, it, expect, vi } from 'vitest';
import {
  UMBRAL_PRODUCTOS, UMBRAL_DIAS_CON_VENTAS, META_ACTIVACION, META_ADOPCION,
  estaActivada, estadoActivacion, razonAdopcion, nivelAdopcion, armarSemanas, semanaRepresentativa, armarEmbudo
} from '../../services/interno/definiciones.js';
import { asegurarPanelInterno } from '../../config/migraciones/panelInterno.js';

const act = (overrides = {}) => ({ id_tienda: 1, productos_cargados: 0, dias_con_ventas_7d: 0, ventana_cerrada: false, ...overrides });
const sem = (id_tienda, semana, dias, { completa = true, apertura = 7 } = {}) =>
  ({ id_tienda, semana, desde: '2026-10-01', hasta: '2026-10-07', dias_con_ventas: dias, dias_apertura_semana: apertura, semana_completa: completa });

describe('definición de activación (decisión del 28-sep: ≥ 20 productos y ventas en ≥ 5 de los primeros 7 días)', () => {
  it('los umbrales son los decididos', () => {
    expect(UMBRAL_PRODUCTOS).toBe(20);
    expect(UMBRAL_DIAS_CON_VENTAS).toBe(5);
    expect(META_ACTIVACION).toBe(0.25);
    expect(META_ADOPCION).toBe(0.8);
  });

  it('exactamente en el umbral SÍ activa; uno menos en cualquiera de los dos NO', () => {
    expect(estaActivada(act({ productos_cargados: 20, dias_con_ventas_7d: 5 }))).toBe(true);
    expect(estaActivada(act({ productos_cargados: 19, dias_con_ventas_7d: 5 }))).toBe(false);
    expect(estaActivada(act({ productos_cargados: 20, dias_con_ventas_7d: 4 }))).toBe(false);
  });

  it('muchos productos sin ventas (o ventas con pocos productos) no activa', () => {
    expect(estaActivada(act({ productos_cargados: 500, dias_con_ventas_7d: 0 }))).toBe(false);
    expect(estaActivada(act({ productos_cargados: 3, dias_con_ventas_7d: 7 }))).toBe(false);
  });

  it('el estado distingue «en curso» (aún puede activarse) de «no activada» (la ventana cerró)', () => {
    expect(estadoActivacion(act({ productos_cargados: 20, dias_con_ventas_7d: 5, ventana_cerrada: false }))).toBe('activada');
    expect(estadoActivacion(act({ productos_cargados: 20, dias_con_ventas_7d: 5, ventana_cerrada: true }))).toBe('activada');
    expect(estadoActivacion(act({ productos_cargados: 5, dias_con_ventas_7d: 1, ventana_cerrada: false }))).toBe('en_curso');
    expect(estadoActivacion(act({ productos_cargados: 5, dias_con_ventas_7d: 1, ventana_cerrada: true }))).toBe('no_activada');
  });
});

describe('definición de adopción (días con ventas ÷ días de apertura, tope 100 %)', () => {
  it('calcula la razón y nunca pasa de 1', () => {
    expect(razonAdopcion(4, 5)).toBeCloseTo(0.8);
    expect(razonAdopcion(7, 7)).toBe(1);
    expect(razonAdopcion(7, 5)).toBe(1);   // vendió más días de los que dice abrir: tope de 100 %
    expect(razonAdopcion(0, 7)).toBe(0);
  });

  it('una tienda que abre menos días necesita menos días con ventas para llegar a la meta', () => {
    expect(nivelAdopcion(razonAdopcion(4, 5))).toBe('meta');     // 80 % de 5 días
    expect(nivelAdopcion(razonAdopcion(4, 7))).toBe('regular');  // 57 % de 7 días
  });

  it('protege contra días de apertura inválidos (0 o ausente) sin dividir entre cero', () => {
    expect(razonAdopcion(3, 0)).toBe(0);
    expect(razonAdopcion(3, undefined)).toBe(0);
    expect(Number.isFinite(razonAdopcion(3, null))).toBe(true);
  });

  it('niveles: 80 % o más = meta; de 50 % a menos de 80 % = regular; menos = baja', () => {
    expect(nivelAdopcion(1)).toBe('meta');
    expect(nivelAdopcion(0.8)).toBe('meta');
    expect(nivelAdopcion(0.79)).toBe('regular');
    expect(nivelAdopcion(0.5)).toBe('regular');
    expect(nivelAdopcion(0.49)).toBe('baja');
    expect(nivelAdopcion(0)).toBe('baja');
  });
});

describe('semanas y semana representativa', () => {
  it('ordena por semana y calcula la razón de cada una', () => {
    const semanas = armarSemanas([sem(1, 2, 7), sem(1, 1, 3, { apertura: 6 })]);
    expect(semanas.map(s => s.semana)).toEqual([1, 2]);
    expect(semanas[0]).toMatchObject({ dias_con_ventas: 3, razon: 0.5, nivel: 'regular', completa: true });
    expect(semanas[1]).toMatchObject({ razon: 1, nivel: 'meta' });
  });

  it('la semana representativa es la última COMPLETA (una semana a medias no castiga a la tienda)', () => {
    const semanas = armarSemanas([sem(1, 1, 7), sem(1, 2, 1, { completa: false })]);
    expect(semanaRepresentativa(semanas).semana).toBe(1);
  });

  it('si aún no hay ninguna completa, usa la que va en curso (marcada como incompleta)', () => {
    const r = semanaRepresentativa(armarSemanas([sem(1, 1, 2, { completa: false })]));
    expect(r).toMatchObject({ semana: 1, completa: false });
  });

  it('sin semanas devuelve null', () => {
    expect(semanaRepresentativa([])).toBeNull();
  });
});

describe('embudo', () => {
  it('sin ninguna tienda no inventa porcentajes: devuelve ceros y null', () => {
    const e = armarEmbudo([], []);
    expect(e).toMatchObject({ registros: 0, activadas: 0, en_curso: 0, no_activadas: 0, tasa_activacion: null });
    expect(e.semana_4).toMatchObject({ alcanzaron: 0, con_uso: 0, tasa: null });
    expect(e.adopcion).toMatchObject({ evaluadas: 0, en_meta: 0, tasa_en_meta: null });
  });

  it('con UNA sola tienda (el caso del piloto mínimo) da conteos claros', () => {
    const e = armarEmbudo([act({ productos_cargados: 25, dias_con_ventas_7d: 6, ventana_cerrada: true })], [sem(1, 1, 6), sem(1, 2, 5)]);
    expect(e).toMatchObject({ registros: 1, activadas: 1, tasa_activacion: 1 });
    expect(e.semana_4.alcanzaron).toBe(0);   // aún no llega a su semana 4: no se le cuenta como «sin uso»
    expect(e.semana_4.tasa).toBeNull();
  });

  it('cuenta activadas, en curso y no activadas por separado', () => {
    const e = armarEmbudo([
      act({ id_tienda: 1, productos_cargados: 30, dias_con_ventas_7d: 7, ventana_cerrada: true }),
      act({ id_tienda: 2, productos_cargados: 3, dias_con_ventas_7d: 1, ventana_cerrada: false }),
      act({ id_tienda: 3, productos_cargados: 3, dias_con_ventas_7d: 1, ventana_cerrada: true }),
      act({ id_tienda: 4, productos_cargados: 3, dias_con_ventas_7d: 0, ventana_cerrada: true })
    ], []);
    expect(e).toMatchObject({ registros: 4, activadas: 1, en_curso: 1, no_activadas: 2 });
    expect(e.tasa_activacion).toBe(0.25);
  });

  it('semana 4: solo cuentan las tiendas que ya la alcanzaron; con uso = al menos un día con ventas', () => {
    const adopciones = [
      sem(1, 1, 5), sem(1, 2, 5), sem(1, 3, 5), sem(1, 4, 3),                    // llegó a la 4 y la usó
      sem(2, 1, 5), sem(2, 2, 2), sem(2, 3, 1), sem(2, 4, 0),                    // llegó a la 4 y no la usó
      sem(3, 1, 5), sem(3, 2, 5)                                                 // aún no llega: no cuenta
    ];
    const e = armarEmbudo([act({ id_tienda: 1 }), act({ id_tienda: 2 }), act({ id_tienda: 3 })], adopciones);
    expect(e.semana_4).toMatchObject({ semana: 4, alcanzaron: 2, con_uso: 1 });
    expect(e.semana_4.tasa).toBe(0.5);
  });

  it('adopción en la meta: usa la última semana completa de cada tienda', () => {
    const adopciones = [
      sem(1, 1, 7), sem(1, 2, 6),                              // 6/7 = 86 %: en meta
      sem(2, 1, 7), sem(2, 2, 2),                              // la última completa es 2/7: fuera de meta
      sem(3, 1, 7, { completa: false })                        // sin semana completa: no se evalúa
    ];
    const e = armarEmbudo([act({ id_tienda: 1 }), act({ id_tienda: 2 }), act({ id_tienda: 3 })], adopciones);
    expect(e.adopcion).toMatchObject({ evaluadas: 2, en_meta: 1, tasa_en_meta: 0.5, meta: 0.8 });
  });
});

describe('migración del panel: reintento por deadlock', () => {
  /** Un pool falso: cada `connect()` entrega un cliente cuyo `query` falla con la primera cantidad de errores indicada. */
  const poolFalso = (errores) => {
    const consultas = [];
    let intento = 0;
    return {
      consultas,
      connect: async () => {
        intento += 1;
        const esteIntento = intento;
        return {
          release: () => {},
          query: async (sql) => {
            consultas.push({ intento: esteIntento, sql: String(sql).trim().split('\n')[0].slice(0, 40) });
            if (esteIntento <= errores && /^SELECT pg_advisory_xact_lock/.test(String(sql).trim())) {
              throw Object.assign(new Error('se ha detectado un deadlock'), { code: '40P01', detail: 'proceso A espera a B' });
            }
            return { rows: [] };
          }
        };
      }
    };
  };

  it('si PostgreSQL elige esta transacción como víctima de un deadlock, la repite y termina bien', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pool = poolFalso(2);

    await expect(asegurarPanelInterno(pool)).resolves.toBeUndefined();

    expect(Math.max(...pool.consultas.map(c => c.intento))).toBe(3);
    expect(aviso).toHaveBeenCalledTimes(2);
    expect(aviso.mock.calls[0][0]).toContain('proceso A espera a B');
    // Cada intento fallido se revirtió antes de reintentar
    expect(pool.consultas.filter(c => c.sql === 'ROLLBACK')).toHaveLength(2);
    aviso.mockRestore();
  });

  it('no reintenta para siempre: tras el máximo de intentos propaga el deadlock', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(asegurarPanelInterno(poolFalso(99))).rejects.toMatchObject({ code: '40P01' });
    aviso.mockRestore();
  });

  it('un error que NO es deadlock se propaga de inmediato, sin reintentos', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pool = {
      connect: async () => ({
        release: () => {},
        query: async (sql) => {
          if (/pg_advisory_xact_lock/.test(String(sql))) throw Object.assign(new Error('permiso denegado'), { code: '42501' });
          return { rows: [] };
        }
      })
    };
    await expect(asegurarPanelInterno(pool)).rejects.toMatchObject({ code: '42501' });
    expect(aviso).not.toHaveBeenCalled();
    aviso.mockRestore();
  });
});
