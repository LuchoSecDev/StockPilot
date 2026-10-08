import { describe, it, expect, vi } from 'vitest';

/**
 * Extracción directa de la lógica matemática pura del modelo Alert.js que sigue viviendo ahí
 * (clasificación ABC, vencimiento y sobrestock). Probamos las fórmulas sin tocar la base de datos.
 *
 * Plan 20, Nivel 1: Alert.js hace `require('../config/database')` en su primera línea, así que
 * solo con importar este archivo (aunque ninguna prueba llame a generate()/dryRun(), que sí están
 * excluidas de cobertura y tocan BD de verdad) se disparaba una conexión real — incluida la
 * auto-migración de esquema — contra lo que fuera que dijera DATABASE_URL en ese momento. Se
 * simula el módulo para que importar Alert.js sea 100% local; ninguna de las funciones que se
 * prueban aquí (evaluarProducto y las demás helpers puras) llama a `db` en ningún punto.
 */
vi.mock('../../config/database.js', () => {
  const db = { allAsync: vi.fn(), getAsync: vi.fn(), runAsync: vi.fn(), getClient: vi.fn(), pool: {} };
  return { default: db, ...db };
});

import Alert from '../../models/Alert.js';

const {
  calcularClasificacionABC,
  determinarAlertaVencimiento,
  determinarSobrestock,
  evaluarProducto
} = Alert;

// === PRUEBAS UNITARIAS ===

describe('Motor Matemático de Alertas (Alert.js)', () => {

  describe('Clasificación ABC Pareto', () => {
    it('Debería asignar A al producto con mayor ingreso (top 80%)', () => {
      const productos = [
        { id_producto: 1, precio: 100, velocity_30d: 20 },  // Rev: 60,000
        { id_producto: 2, precio: 100, velocity_30d: 10 },  // Rev: 30,000
        { id_producto: 3, precio: 100, velocity_30d: 5 },   // Rev: 15,000
        { id_producto: 4, precio: 100, velocity_30d: 1 },   // Rev: 3,000
      ];

      const resultado = calcularClasificacionABC(productos);

      // Total = 108,000
      // Prod 1: 60k/108k = 55.6% → A (≤ 80%)
      // Prod 2: 90k/108k = 83.3% → B (> 80%, ≤ 95%)
      // Prod 3: 105k/108k = 97.2% → C (> 95%)
      // Prod 4: 108k/108k = 100% → C
      expect(resultado[0].clasificacion_abc).toBe('A');
      expect(resultado[1].clasificacion_abc).toBe('B');
      expect(resultado[2].clasificacion_abc).toBe('C');
      expect(resultado[3].clasificacion_abc).toBe('C');
    });

    it('Debería ordenar productos de mayor a menor ingreso', () => {
      const productos = [
        { id_producto: 3, precio: 10, velocity_30d: 1 },    // Rev: 300 (menor)
        { id_producto: 1, precio: 1000, velocity_30d: 5 },  // Rev: 150,000 (mayor)
      ];

      const resultado = calcularClasificacionABC(productos);

      expect(resultado[0].id_producto).toBe(1); // Mayor primero
      expect(resultado[1].id_producto).toBe(3);
    });

    it('Debería manejar productos sin ventas (velocity = 0)', () => {
      const productos = [
        { id_producto: 1, precio: 1000, velocity_30d: 0 },
        { id_producto: 2, precio: 500, velocity_30d: 0 },
      ];

      const resultado = calcularClasificacionABC(productos);

      // Sin ingresos, totalRevenue = 0, pct sería 0 → todos clasificados como 'A' por la condición pct <= 0.8
      // Pero rev30 = 0 para todos, así que accum/totalRevenue = 0/0 → la condición totalRevenue > 0 es false → pct = 0
      resultado.forEach(p => {
        expect(p.rev30).toBe(0);
      });
    });

    it('Debería manejar productos con propiedades indefinidas (fallbacks a 0)', () => {
      const productos = [
        { id_producto: 1 } // Sin precio ni velocity_30d
      ];
      const resultado = calcularClasificacionABC(productos);
      expect(resultado[0].rev30).toBe(0);
      expect(resultado[0].clasificacion_abc).toBe('A');
    });

    it('Debería clasificar correctamente con distribución equilibrada', () => {
      // 5 productos con ingresos similares - la distribución debe ser más equitativa
      const productos = [
        { id_producto: 1, precio: 100, velocity_30d: 10 }, // 30,000
        { id_producto: 2, precio: 100, velocity_30d: 9 },  // 27,000
        { id_producto: 3, precio: 100, velocity_30d: 8 },  // 24,000
        { id_producto: 4, precio: 100, velocity_30d: 5 },  // 15,000
        { id_producto: 5, precio: 100, velocity_30d: 1 },  // 3,000
      ];

      const resultado = calcularClasificacionABC(productos);
      // Total = 30000 + 27000 + 24000 + 15000 + 3000 = 99,000

      // Prod 1: 30k/99k = 30.3% → A
      // Prod 2: 57k/99k = 57.6% → A
      // Prod 3: 81k/99k = 81.8% → B (supera 80%)
      // Prod 4: 96k/99k = 97.0% → C (supera 95%)
      // Prod 5: 99k/99k = 100% → C
      expect(resultado[0].clasificacion_abc).toBe('A');
      expect(resultado[1].clasificacion_abc).toBe('A');
      expect(resultado[2].clasificacion_abc).toBe('B');
      expect(resultado[3].clasificacion_abc).toBe('C');
      expect(resultado[4].clasificacion_abc).toBe('C');
    });
  });

  // "Días de Agotamiento" y "Alertas de Stock Logístico" (calcularDiasAgotamiento/determinarAlertaStock)
  // se quitaron en el plan 17, Fase 4: Alert.js dejó de tener su propio cálculo de cuándo alertar por
  // stock y ahora usa calcularReposicion (services/inventory/reposicion.js), que ya tiene su propia batería de
  // pruebas — incluyendo el caso que este archivo no cubría (producto agotado sin ventas registradas,
  // que con la fórmula vieja nunca generaba alerta: ver "sin stock, sin ventas y stockSeguridad en 0"
  // en reposicion.test.js). Reimplementar los mismos casos aquí sería probar la misma fórmula dos veces.

  describe('Alertas de Vencimiento (Cruce con Velocidad)', () => {
    it('Debería generar vencimiento_critico si vence en ≤7 días y quedarán sobrantes', () => {
      // 50 unidades, se vende 1/día, vence en 5 días → venderemos 5, sobran 45
      const resultado = determinarAlertaVencimiento(50, 1, 5);
      expect(resultado).not.toBeNull();
      expect(resultado.tipo).toBe('vencimiento_critico');
      expect(resultado.severidad).toBe('critico');
      expect(resultado.sobrantes).toBe(45);
    });

    it('Debería generar vencimiento_proximo si vence en ≤30 días con sobrantes', () => {
      // 100 unidades, se vende 2/día, vence en 20 días → venderemos 40, sobran 60
      const resultado = determinarAlertaVencimiento(100, 2, 20);
      expect(resultado).not.toBeNull();
      expect(resultado.tipo).toBe('vencimiento_proximo');
      expect(resultado.severidad).toBe('advertencia');
      expect(resultado.sobrantes).toBe(60);
    });

    it('No debería generar alerta si alcanzamos a vender todo', () => {
      // 10 unidades, se vende 5/día, vence en 5 días → venderemos 25, sobran -15 → OK
      const resultado = determinarAlertaVencimiento(10, 5, 5);
      expect(resultado).toBeNull();
    });

    it('No debería generar alerta si vence en más de 30 días', () => {
      const resultado = determinarAlertaVencimiento(100, 1, 60);
      expect(resultado).toBeNull();
    });
  });

  describe('Sobrestock (Capital Estancado)', () => {
    it('Debería detectar sobrestock: clase C, sobre máximo, +60 días de stock', () => {
      expect(determinarSobrestock(200, 100, 'C', 90)).toBe(true);
    });

    it('No debería marcar sobrestock si es clase A (producto importante)', () => {
      expect(determinarSobrestock(200, 100, 'A', 90)).toBe(false);
    });

    it('No debería marcar sobrestock si no supera el máximo', () => {
      expect(determinarSobrestock(50, 100, 'C', 90)).toBe(false);
    });

    it('No debería marcar sobrestock si se agota en menos de 60 días', () => {
      expect(determinarSobrestock(200, 100, 'C', 30)).toBe(false);
    });
  });

  // Plan 17, O8: `evaluarProducto` es la función pura que reemplaza la lógica que antes vivía inline
  // dentro de `Alert.generate` — la usan tanto `generate()` (escribe en BD) como `dryRun()` (solo
  // simula). Estas pruebas cubren la combinación de las tres reglas (stock/vencimiento/sobrestock) en
  // un solo producto, algo que antes no se podía probar sin una base de datos real.
  describe('evaluarProducto (motor unificado, plan 17 O8)', () => {
    const hoy = new Date('2026-01-01T00:00:00');

    it('Regresión E1: producto agotado, sin ventas y stockSeguridad en 0 SÍ genera stock_critico', () => {
      const item = {
        id_producto: 1, velocity_7d: 0, velocity_30d: 0, qty_30d_total: 0, claseABC: 'C',
        stock_actual: 0, stock_seguridad: 0, stock_minimo: 0, lead_time: 3,
        frecuencia_compra_dias: 7, factor_ia: 1,
      };
      const alertas = evaluarProducto(item, {}, hoy);
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatchObject({ tipo: 'stock_critico', severidad: 'critico' });
      expect(alertas[0].mensaje).toBe('Stock agónico. No queda stock.');
    });

    it('Genera stock_bajo cuando el agotamiento cae dentro de la ventana de reorden', () => {
      const item = {
        id_producto: 2, velocity_7d: 1, velocity_30d: 1, qty_30d_total: 30, claseABC: 'C',
        stock_actual: 10, stock_seguridad: 5, stock_minimo: 0, lead_time: 3,
        frecuencia_compra_dias: 7, factor_ia: 1,
      };
      const alertas = evaluarProducto(item, {}, hoy);
      expect(alertas).toHaveLength(1);
      expect(alertas[0].tipo).toBe('stock_bajo');
      expect(alertas[0].severidad).toBe('advertencia');
      expect(alertas[0].mensaje).toContain('10 días de stock');
    });

    it('No genera ninguna alerta para un producto sano', () => {
      const item = {
        id_producto: 3, velocity_7d: 1, velocity_30d: 1, qty_30d_total: 30, claseABC: 'C',
        stock_actual: 100, stock_seguridad: 5, stock_minimo: 0, lead_time: 3,
        frecuencia_compra_dias: 7, factor_ia: 1,
      };
      const alertas = evaluarProducto(item, { stock_maximo: 500 }, hoy);
      expect(alertas).toEqual([]);
    });

    it('Genera vencimiento_critico cuando aplica, incluso con el stock sano', () => {
      const item = {
        id_producto: 4, velocity_7d: 1, velocity_30d: 1, qty_30d_total: 30, claseABC: 'C',
        stock_actual: 100, stock_seguridad: 5, stock_minimo: 0, lead_time: 3,
        frecuencia_compra_dias: 7, factor_ia: 1,
      };
      const alertas = evaluarProducto(item, { fecha_vencimiento: '2026-01-06', stock_maximo: 500 }, hoy);
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatchObject({ tipo: 'vencimiento_critico', severidad: 'critico' });
      expect(alertas[0].mensaje).toContain('~96 unidades');
    });

    it('Genera vencimiento_proximo (8-30 días) en vez de crítico', () => {
      const item = {
        id_producto: 7, velocity_7d: 1, velocity_30d: 1, qty_30d_total: 30, claseABC: 'C',
        stock_actual: 100, stock_seguridad: 5, stock_minimo: 0, lead_time: 3,
        frecuencia_compra_dias: 7, factor_ia: 1,
      };
      const alertas = evaluarProducto(item, { fecha_vencimiento: '2026-01-20', stock_maximo: 500 }, hoy);
      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatchObject({ tipo: 'vencimiento_proximo', severidad: 'advertencia' });
      expect(alertas[0].mensaje).toContain('Sugerencia: Aplicar promoción hoy.');
    });

    it('Genera sobrestock cuando aplica, sin ventas para medir agotamiento', () => {
      const item = {
        id_producto: 5, velocity_7d: 0, velocity_30d: 0, qty_30d_total: 0, claseABC: 'C',
        stock_actual: 300, stock_seguridad: 5, stock_minimo: 0, lead_time: 3,
        frecuencia_compra_dias: 7, factor_ia: 1,
      };
      const alertas = evaluarProducto(item, { stock_maximo: 100 }, hoy);
      expect(alertas).toHaveLength(1);
      expect(alertas[0].tipo).toBe('sobrestock');
      expect(alertas[0].severidad).toBe('info');
    });

    it('Puede devolver más de una alerta a la vez para el mismo producto', () => {
      const item = {
        id_producto: 6, velocity_7d: 5, velocity_30d: 5, qty_30d_total: 150, claseABC: 'C',
        stock_actual: 40, stock_seguridad: 5, stock_minimo: 0, lead_time: 3,
        frecuencia_compra_dias: 7, factor_ia: 1,
      };
      const alertas = evaluarProducto(item, { fecha_vencimiento: '2026-01-07', stock_maximo: 1000 }, hoy);
      const tipos = alertas.map((a) => a.tipo).sort();
      expect(tipos).toEqual(['stock_bajo', 'vencimiento_critico']);
    });

    it('Usa 3 días de lead time por defecto cuando el producto no tiene lead_time configurado', () => {
      const item = {
        id_producto: 8, velocity_7d: 5, velocity_30d: 5, qty_30d_total: 150, claseABC: 'C',
        stock_actual: 10, stock_seguridad: 5, stock_minimo: 0, lead_time: undefined,
        frecuencia_compra_dias: 7, factor_ia: 1,
      };
      const alertas = evaluarProducto(item, {}, hoy);
      expect(alertas).toHaveLength(1);
      // diasParaAgotar = floor(10/5) = 2 <= leadTime por defecto (3) -> "Pide hoy", y el mensaje
      // solo puede decir "3 días" si el fallback `item.lead_time || 3` de verdad se aplicó.
      expect(alertas[0].mensaje).toContain('el proveedor tarda 3 días en entregar');
    });

    it('Crítico por debajo de stock de seguridad, sin ventas y con stock > 0: mensaje distinto al de "sin stock"', () => {
      const item = {
        id_producto: 9, velocity_7d: 0, velocity_30d: 0, qty_30d_total: 0, claseABC: 'C',
        stock_actual: 3, stock_seguridad: 5, stock_minimo: 0, lead_time: 3,
        frecuencia_compra_dias: 7, factor_ia: 1,
      };
      const alertas = evaluarProducto(item, {}, hoy);
      expect(alertas).toHaveLength(1);
      expect(alertas[0].tipo).toBe('stock_critico');
      expect(alertas[0].mensaje).toBe('Stock agónico. No hay ventas recientes para calcular cuántos días quedan, pero el stock ya está en el mínimo de seguridad.');
    });

    it('No genera alerta de vencimiento si la fecha está a más de 30 días, aunque venga informada', () => {
      const item = {
        id_producto: 10, velocity_7d: 1, velocity_30d: 1, qty_30d_total: 30, claseABC: 'C',
        stock_actual: 100, stock_seguridad: 5, stock_minimo: 0, lead_time: 3,
        frecuencia_compra_dias: 7, factor_ia: 1,
      };
      const alertas = evaluarProducto(item, { fecha_vencimiento: '2026-03-01', stock_maximo: 500 }, hoy);
      expect(alertas).toEqual([]);
    });
  });
});
