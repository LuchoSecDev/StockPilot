import { describe, it, expect } from 'vitest';

// === ESPECIFICACIÓN DE LA FÓRMULA (no prueba código de producción) ===
// El margen promedio real NO se calcula en JS: se calcula en una sola consulta SQL
// (dashboardController.js línea 18: `AVG(((precio - costo_compra) / NULLIF(precio, 0)) * 100)`),
// y el controlador solo redondea el resultado agregado (línea 64: `Math.round(valorRecord.margen_avg || 0)`).
// No hay ninguna función de producción que importar aquí — extraerla significaría mover el
// cálculo de SQL a JS, un cambio de arquitectura fuera del alcance de esta tarea (plan 20).
//
// Esta copia documenta la fórmula esperada, así que replica el comportamiento exacto de
// NULLIF + AVG de Postgres: NULLIF(precio, 0) vuelve NULL el margen de un producto con precio 0,
// y AVG() ignora los NULL — ni cuenta ni divide entre ellos. La versión anterior de esta copia
// trataba precio=0 como margen 0 y SÍ lo incluía en el promedio, lo cual da un número distinto
// al de producción en cuanto hay más de un producto y alguno tiene precio 0 (con un solo
// producto ambas formas coinciden en 0, por eso el caso de prueba viejo no lo detectaba).
// La protección real de esta fórmula queda para el Nivel 2 (plan 20): una prueba de integración
// que ejecute la consulta SQL real, incluido el caso de precio 0, contra Postgres de prueba.
//
// Plan 17, Fase 5: se quitaron los grupos de "Proyección de Pérdida por Vencimiento",
// "Nivel de Servicio Estimado" y "Variación de Ventas" — probaban una reimplementación local
// de las fórmulas de `getAdvancedStats` (nunca importaban el controlador real), y ese método
// se eliminó por no tener ningún consumidor en el frontend (`GET /api/dashboard/stats/advanced`
// sin llamadores; verificado con una búsqueda en todo `frontend/src`).

describe('Especificación de la fórmula: Margen Promedio (no prueba código de producción)', () => {

  // ────────────────────────────────────────────────────
  //  Margen Promedio — espejo de NULLIF(precio, 0) + AVG() en SQL
  //  Ref: dashboardController.js líneas 18 y 64
  // ────────────────────────────────────────────────────

  function calcularMargenPromedio(productos) {
    // NULLIF(precio, 0): los productos con precio 0 quedan fuera del promedio, no entran como 0.
    const margenes = productos
      .filter(p => p.precio !== 0)
      .map(p => ((p.precio - p.costo_compra) / p.precio) * 100);
    if (margenes.length === 0) return 0; // AVG() de cero filas es NULL; el controlador lo vuelve 0 con `|| 0`.
    return Math.round(margenes.reduce((a, b) => a + b, 0) / margenes.length);
  }

  describe('Margen de Ganancia Promedio', () => {
    it('Debería calcular margen 50% cuando costo = mitad del precio', () => {
      const prods = [{ precio: 10000, costo_compra: 5000 }];
      expect(calcularMargenPromedio(prods)).toBe(50);
    });

    it('Debería calcular margen 0% cuando costo = precio', () => {
      const prods = [{ precio: 5000, costo_compra: 5000 }];
      expect(calcularMargenPromedio(prods)).toBe(0);
    });

    it('Debería promediar múltiples productos', () => {
      const prods = [
        { precio: 10000, costo_compra: 5000 },  // 50%
        { precio: 10000, costo_compra: 8000 },   // 20%
      ];
      expect(calcularMargenPromedio(prods)).toBe(35); // (50+20)/2
    });

    it('Debería retornar 0 si no hay productos', () => {
      expect(calcularMargenPromedio([])).toBe(0);
    });

    it('Debería manejar un único producto con precio = 0 sin error (división por cero)', () => {
      const prods = [{ precio: 0, costo_compra: 0 }];
      expect(calcularMargenPromedio(prods)).toBe(0);
    });

    it('Debería EXCLUIR del promedio los productos con precio = 0, igual que NULLIF+AVG en SQL', () => {
      const prods = [
        { precio: 10000, costo_compra: 5000 },  // 50%
        { precio: 0, costo_compra: 0 },         // NULLIF -> NULL, AVG lo ignora
      ];
      // Si se contara como margen 0, el promedio de negocio (50+0)/2 = 25 sería el resultado
      // de una implementación distinta a la de producción. AVG ignora la fila: (50)/1 = 50.
      expect(calcularMargenPromedio(prods)).toBe(50);
    });
  });
});
