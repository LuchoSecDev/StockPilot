import { describe, it, expect } from 'vitest';
import {
  formatearPorcentaje, fraccion, formatearFechaHora, formatearFecha, formatearDia, haceCuanto,
  etiquetaActivacion, etiquetaAdopcion, etiquetaAccion, esAccionDeAlerta, resumirTiendas
} from '../../frontend/src/interno/formato.js';

describe('formatearPorcentaje', () => {
  it('redondea al entero y muestra el símbolo', () => {
    expect(formatearPorcentaje(0.857)).toBe('86 %');
    expect(formatearPorcentaje(1)).toBe('100 %');
    expect(formatearPorcentaje(0)).toBe('0 %');
  });

  it('sin base de cálculo muestra «—», NO un 0 % inventado', () => {
    expect(formatearPorcentaje(null)).toBe('—');
    expect(formatearPorcentaje(undefined)).toBe('—');
    expect(formatearPorcentaje(NaN)).toBe('—');
  });
});

describe('fecha y hora', () => {
  it('la hora se muestra en Bogotá (UTC-5), no en la del navegador', () => {
    // 2026-10-08 03:30 UTC = 2026-10-07 22:30 en Bogotá: el día cambia
    expect(formatearFechaHora('2026-10-08T03:30:00Z')).toMatch(/07\/10\/2026.*22:30/);
    expect(formatearFecha('2026-10-08T03:30:00Z')).toBe('07/10/2026');
  });

  it('valores vacíos o inválidos no rompen la pantalla', () => {
    for (const malo of [null, undefined, '', 'no-es-fecha']) {
      expect(formatearFechaHora(malo)).toBe('—');
      expect(formatearFecha(malo)).toBe('—');
    }
  });

  it('un día calendario YYYY-MM-DD se reordena SIN pasar por Date (no se corre un día por la zona)', () => {
    expect(formatearDia('2026-10-07')).toBe('07/10/2026');
    expect(formatearDia('basura')).toBe('—');
    expect(formatearDia(null)).toBe('—');
  });
});

describe('haceCuanto', () => {
  const ahora = new Date('2026-10-08T12:00:00Z').getTime();
  const antes = (ms) => new Date(ahora - ms).toISOString();

  it('escala de minutos a horas a días', () => {
    expect(haceCuanto(antes(30_000), ahora)).toBe('hace un momento');
    expect(haceCuanto(antes(10 * 60_000), ahora)).toBe('hace 10 min');
    expect(haceCuanto(antes(5 * 3_600_000), ahora)).toBe('hace 5 h');
    expect(haceCuanto(antes(24 * 3_600_000), ahora)).toBe('ayer');
    expect(haceCuanto(antes(3 * 24 * 3_600_000), ahora)).toBe('hace 3 días');
  });

  it('«Nunca» si no hay fecha (una tienda que nunca vendió o nunca entró)', () => {
    expect(haceCuanto(null, ahora)).toBe('Nunca');
    expect(haceCuanto(undefined, ahora)).toBe('Nunca');
  });

  it('una fecha futura (reloj desajustado) no da números negativos', () => {
    expect(haceCuanto(new Date(ahora + 3_600_000).toISOString(), ahora)).toBe('hace un momento');
  });
});

describe('etiquetas', () => {
  it('activación: cada estado con su tono; uno desconocido no rompe', () => {
    expect(etiquetaActivacion('activada')).toEqual({ texto: 'Activada', tono: 'exito' });
    expect(etiquetaActivacion('en_curso').tono).toBe('aviso');
    expect(etiquetaActivacion('no_activada').tono).toBe('peligro');
    expect(etiquetaActivacion('algo_nuevo')).toEqual({ texto: '—', tono: 'neutro' });
  });

  it('una semana EN CURSO no se califica: se muestra neutra aunque el porcentaje parcial sea bajo', () => {
    expect(etiquetaAdopcion('baja', false)).toEqual({ texto: 'En curso', tono: 'neutro' });
    expect(etiquetaAdopcion('meta', false)).toEqual({ texto: 'En curso', tono: 'neutro' });
    expect(etiquetaAdopcion('baja', true).tono).toBe('peligro');   // completa: sí se califica
    expect(etiquetaAdopcion('baja').tono).toBe('peligro');         // sin indicar: se asume completa
  });

  it('adopción: meta / regular / baja, y «sin datos»', () => {
    expect(etiquetaAdopcion('meta').tono).toBe('exito');
    expect(etiquetaAdopcion('regular').tono).toBe('aviso');
    expect(etiquetaAdopcion('baja').tono).toBe('peligro');
    expect(etiquetaAdopcion(undefined)).toEqual({ texto: 'Sin datos', tono: 'neutro' });
  });

  it('bitácora: texto legible, y una acción desconocida se muestra tal cual', () => {
    expect(etiquetaAccion('login_ok')).toBe('Inició sesión');
    expect(etiquetaAccion('accion_futura')).toBe('accion_futura');
  });

  it('marca como alerta solo los intentos fallidos de entrada', () => {
    expect(esAccionDeAlerta('login_fallido')).toBe(true);
    expect(esAccionDeAlerta('segundo_factor_fallido')).toBe(true);
    expect(esAccionDeAlerta('login_ok')).toBe(false);
  });

  it('fraccion junta el conteo: «n de N»', () => {
    expect(fraccion(1, 1)).toBe('1 de 1');
  });
});

describe('resumirTiendas (las tarjetas de arriba)', () => {
  const t = (over = {}) => ({
    es_prueba: false, ventas_7d: 5, dueno_acepto_politica: true,
    activacion: { estado: 'activada' }, adopcion: { completa: true, nivel: 'meta' }, ...over
  });

  it('con UNA sola tienda da conteos claros', () => {
    expect(resumirTiendas([t()])).toMatchObject({ total: 1, activadas: 1, adopcion_evaluadas: 1, adopcion_en_meta: 1, sin_ventas_7d: 0, politica_pendiente: 0 });
  });

  it('sin tiendas, todo en cero', () => {
    expect(resumirTiendas([])).toMatchObject({ total: 0, activadas: 0, en_curso: 0, no_activadas: 0, adopcion_evaluadas: 0, adopcion_en_meta: 0 });
  });

  it('NO cuenta las tiendas de prueba', () => {
    expect(resumirTiendas([t(), t({ es_prueba: true }), t({ es_prueba: true })]).total).toBe(1);
  });

  it('separa activadas, en curso y no activadas', () => {
    const r = resumirTiendas([
      t(), t({ activacion: { estado: 'en_curso' } }), t({ activacion: { estado: 'no_activada' } }), t({ activacion: { estado: 'no_activada' } })
    ]);
    expect(r).toMatchObject({ total: 4, activadas: 1, en_curso: 1, no_activadas: 2 });
  });

  it('la adopción solo evalúa las tiendas con una semana COMPLETA', () => {
    const r = resumirTiendas([
      t({ adopcion: { completa: true, nivel: 'meta' } }),
      t({ adopcion: { completa: true, nivel: 'baja' } }),
      t({ adopcion: { completa: false, nivel: 'meta' } }),
      t({ adopcion: null })
    ]);
    expect(r).toMatchObject({ adopcion_evaluadas: 2, adopcion_en_meta: 1 });
  });

  it('cuenta las que no vendieron en 7 días y las que no aceptaron la política', () => {
    const r = resumirTiendas([t({ ventas_7d: 0 }), t({ dueno_acepto_politica: false }), t()]);
    expect(r).toMatchObject({ sin_ventas_7d: 1, politica_pendiente: 1 });
  });
});
