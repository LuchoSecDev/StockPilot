/**
 * @file tiempo.js (helpers)
 * @description `SaleController.registerSale`/`registerCartSale` responden al cliente y DESPUÉS
 * disparan trabajo en segundo plano sin esperarlo (`Alert.generate`, `_checkSalesGoals` —
 * `.catch(e => console.error(...))`, nunca `await`ado). Una prueba que solo espera la respuesta
 * HTTP puede terminar (y el `beforeEach` de la prueba siguiente puede vaciar la base con
 * `TRUNCATE`) mientras ese trabajo todavía está corriendo contra las filas que acaban de
 * truncarse — encontrado en plan 20, Nivel 2 (sección 8.9): causaba fallas intermitentes en
 * archivos de prueba que ni siquiera tocaban ventas, porque el trabajo colgado de un archivo
 * anterior alcanzaba a ejecutarse en medio del siguiente.
 *
 * Cualquier prueba que dispare una venta debe esperar con esta función antes de terminar, para
 * darle tiempo a ese trabajo de segundo plano a completarse dentro de la prueba que lo originó.
 *
 * @module tests/integration/helpers/tiempo
 */

function esperarTrabajoEnSegundoPlano(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { esperarTrabajoEnSegundoPlano };
