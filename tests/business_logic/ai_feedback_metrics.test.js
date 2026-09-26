import { describe, it, expect, vi } from 'vitest';

/**
 * Extracción directa de la lógica de feedbackController.js (líneas 71-94).
 * Probamos el cálculo de precisión de la IA sin tocar la base de datos.
 *
 * Plan 20, Nivel 1: feedbackController.js hace `require('../config/database')` en su primera
 * línea — importar este archivo, aunque solo se prueben sus helpers puros, disparaba una
 * conexión real. Se simula.
 */
vi.mock('../../config/database.js', () => {
  const db = { allAsync: vi.fn(), getAsync: vi.fn(), runAsync: vi.fn(), getClient: vi.fn(), pool: {} };
  return { default: db, ...db };
});

import feedbackController from '../../controllers/feedbackController.js';

const {
  calcularPeriodoObjetivo,
  proyectarVentas,
  calcularFactorPrecision,
  calcularErrorMetricas,
  determinarVeredicto
} = feedbackController;

// === PRUEBAS UNITARIAS ===

describe('Módulo de Feedback IA (feedbackController.js)', () => {

  describe('Periodo Objetivo Adaptativo', () => {
    it('Debería usar max(lead_time * 2, 14) → Lead time 7 → 14 días', () => {
      expect(calcularPeriodoObjetivo(7)).toBe(14);
    });

    it('Debería escalar con lead times largos → Lead time 10 → 20 días', () => {
      expect(calcularPeriodoObjetivo(10)).toBe(20);
    });

    it('Debería usar mínimo 14 días si lead time es muy corto', () => {
      expect(calcularPeriodoObjetivo(3)).toBe(14);
      expect(calcularPeriodoObjetivo(1)).toBe(14);
    });

    it('Debería usar fallback de 3 si lead time es null/undefined', () => {
      expect(calcularPeriodoObjetivo(null)).toBe(14); // max(3*2, 14) = 14
      expect(calcularPeriodoObjetivo(undefined)).toBe(14);
    });
  });

  describe('Proyección de Ventas con Ponderación Temporal', () => {
    it('Debería proyectar ventas con ponderación temporal si no ha pasado el periodo completo', () => {
      // Vendimos 50 en 7 días, periodo objetivo es 14
      // Cruda = (50/7)*14 = 100, confianza = 7/14 = 0.5 → 50 + (100 - 50)*0.5 = 75
      expect(proyectarVentas(50, 7, 14)).toBe(75);
    });

    it('Debería usar ventas reales si ya pasó el periodo completo', () => {
      expect(proyectarVentas(120, 20, 14)).toBe(120);
    });

    it('Debería proyectar de forma conservadora con 1 día transcurrido', () => {
      // 10 vendidos en 1 día, periodo 14 → Cruda = 140, confianza = 1/14 → 10 + 130*(1/14) ≈ 19.29
      expect(proyectarVentas(10, 1, 14)).toBeCloseTo(19.29, 1);
    });
  });

  describe('Factor de Precisión con Clamping', () => {
    it('Debería calcular factor correcto: IA sugirió 100, se vendieron 50 → 0.5', () => {
      const factor = calcularFactorPrecision(50, 100);
      expect(factor).toBe(0.5);
    });

    it('Debería calcular factor 1.0 cuando la IA acertó perfectamente', () => {
      const factor = calcularFactorPrecision(100, 100);
      expect(factor).toBe(1.0);
    });

    it('Debería aplicar clamping mínimo (0.2) si ventas son 0', () => {
      // 0 / 100 = 0 → clamp a 0.2
      const factor = calcularFactorPrecision(0, 100);
      expect(factor).toBe(0.2);
    });

    it('Debería aplicar clamping máximo (3.0) si la IA subestimó enormemente', () => {
      // 500 / 100 = 5.0 → clamp a 3.0
      const factor = calcularFactorPrecision(500, 100);
      expect(factor).toBe(3.0);
    });

    it('Debería manejar sugerido = 0 con ventas > 0 → factor fijo 2.0', () => {
      const factor = calcularFactorPrecision(50, 0);
      expect(factor).toBe(2.0);
    });

    it('Debería manejar ambos en 0 → factor por defecto 1.0', () => {
      const factor = calcularFactorPrecision(0, 0);
      // sugerido no es > 0, y ventasProyectadas no es > 0 → factor = 1.0
      expect(factor).toBe(1.0);
    });
  });

  describe('Veredicto de Precisión', () => {
    it('Factor 1.0 → Acertado', () => {
      expect(determinarVeredicto(1.0)).toBe('Acertado');
    });

    it('Factor 0.95 → Acertado (dentro del margen ±10%)', () => {
      expect(determinarVeredicto(0.95)).toBe('Acertado');
    });

    it('Factor 0.5 → Sugirió de más', () => {
      expect(determinarVeredicto(0.5)).toBe('Sugirió de más');
    });

    it('Factor 1.5 → Sugirió de menos', () => {
      expect(determinarVeredicto(1.5)).toBe('Sugirió de menos');
    });

    it('Factor 0.2 (mínimo) → Sugirió de más', () => {
      expect(determinarVeredicto(0.2)).toBe('Sugirió de más');
    });

    it('Factor 3.0 (máximo) → Sugirió de menos', () => {
      expect(determinarVeredicto(3.0)).toBe('Sugirió de menos');
    });
  });

  describe('Métricas de Error y Sesgo (Error Absoluto, Bias, Error Porcentual)', () => {
    it('Debería dar error 0 y bias 0 cuando sugerencia coincide con ventas', () => {
      const metricas = calcularErrorMetricas(50, 50);
      expect(metricas).toEqual({
        errorAbsoluto: 0,
        bias: 0,
        errorPorcentual: 0
      });
    });

    it('Debería calcular bias positivo cuando sugirió de más (sobre-predicción)', () => {
      const metricas = calcularErrorMetricas(40, 50);
      expect(metricas).toEqual({
        errorAbsoluto: 10,
        bias: 10,
        errorPorcentual: 25 // (10 / 40) * 100 = 25%
      });
    });

    it('Debería calcular bias negativo cuando sugirió de menos (sub-predicción)', () => {
      const metricas = calcularErrorMetricas(60, 50);
      expect(metricas.errorAbsoluto).toBe(10);
      expect(metricas.bias).toBe(-10);
      expect(metricas.errorPorcentual).toBeCloseTo(16.67, 1);
    });

    it('Debería manejar ventasReales = 0 sin división por cero ni NaN', () => {
      const metricas = calcularErrorMetricas(0, 20);
      expect(metricas).toEqual({
        errorAbsoluto: 20,
        bias: 20,
        errorPorcentual: 0
      });
    });
  });
});
