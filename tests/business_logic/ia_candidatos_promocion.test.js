import { describe, it, expect } from 'vitest';
import { diasParaVencer, elegirCandidatos } from '../../services/ia/candidatosPromocion.js';

const AHORA = new Date('2026-10-08T12:00:00Z');
const enDias = (n) => new Date(AHORA.getTime() + n * 86400000).toISOString();

/** Producto sano y sin ninguna señal de promoción: ni rotación baja, ni vencimiento, ni sobrestock. */
const base = (overrides = {}) => ({
  id: 1, nombre: 'Producto', stock: 20, precio: 1000, categoria: 'General',
  fecha_vencimiento: null, stock_seguridad: 2, stock_minimo: 2, lead_time: 3,
  frecuencia_compra_dias: 7, velocity_30d: 1, velocity_7d: 1,
  ...overrides
});

describe('diasParaVencer', () => {
  it('sin fecha de vencimiento devuelve null (no es lo mismo que 0 días)', () => {
    expect(diasParaVencer(null, AHORA)).toBeNull();
    expect(diasParaVencer(undefined, AHORA)).toBeNull();
  });

  it('cuenta los días que faltan, con decimales', () => {
    expect(diasParaVencer(enDias(10), AHORA)).toBeCloseTo(10, 5);
    expect(diasParaVencer(enDias(-2), AHORA)).toBeCloseTo(-2, 5);
  });
});

describe('elegirCandidatos: qué productos merecen una promoción', () => {
  it('un producto sin ninguna señal no es candidato', () => {
    expect(elegirCandidatos([base()], AHORA)).toEqual([]);
  });

  it('rotación baja: la última semana vende mucho menos que el mes y hay stock (> 10)', () => {
    const r = elegirCandidatos([base({ velocity_30d: 1, velocity_7d: 0.3, stock: 20 })], AHORA);
    expect(r).toHaveLength(1);
  });

  it('rotación baja pero con poco stock (≤ 10) no cuenta', () => {
    expect(elegirCandidatos([base({ velocity_30d: 1, velocity_7d: 0.3, stock: 10 })], AHORA)).toEqual([]);
  });

  it('por vencer: faltan menos de 30 días', () => {
    expect(elegirCandidatos([base({ fecha_vencimiento: enDias(29) })], AHORA)).toHaveLength(1);
    expect(elegirCandidatos([base({ fecha_vencimiento: enDias(31) })], AHORA)).toEqual([]);
  });

  it('sobrestock: más de 50 unidades y se vende menos de 1 por día', () => {
    expect(elegirCandidatos([base({ stock: 80, velocity_30d: 0.5, velocity_7d: 0.5 })], AHORA)).toHaveLength(1);
    expect(elegirCandidatos([base({ stock: 80, velocity_30d: 3, velocity_7d: 3 })], AHORA)).toEqual([]);
  });

  it('nunca promociona algo que además hay que reponer (aunque venza pronto)', () => {
    const agotado = base({ stock: 0, fecha_vencimiento: enDias(5) });
    expect(elegirCandidatos([agotado], AHORA)).toEqual([]);
  });

  it('ordena por vencimiento: el que vence antes va primero y los que no vencen, al final', () => {
    const sinFecha = base({ id: 1, stock: 80, velocity_30d: 0.5, velocity_7d: 0.5 });
    const venceEn20 = base({ id: 2, fecha_vencimiento: enDias(20) });
    const venceEn5 = base({ id: 3, fecha_vencimiento: enDias(5) });

    const ids = elegirCandidatos([sinFecha, venceEn20, venceEn5], AHORA).map(c => c.id);

    expect(ids).toEqual([3, 2, 1]);
  });

  it('devuelve como máximo 10', () => {
    const muchos = Array.from({ length: 15 }, (_, i) => base({ id: i + 1, stock: 80, velocity_30d: 0.5, velocity_7d: 0.5 }));
    expect(elegirCandidatos(muchos, AHORA)).toHaveLength(10);
  });

  it('no modifica la lista que recibe', () => {
    const filas = [base({ id: 2, fecha_vencimiento: enDias(20) }), base({ id: 3, fecha_vencimiento: enDias(5) })];
    const copia = JSON.parse(JSON.stringify(filas));
    elegirCandidatos(filas, AHORA);
    expect(filas).toEqual(copia);
  });
});
