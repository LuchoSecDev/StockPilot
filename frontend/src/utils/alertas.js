/**
 * Reglas de las alertas de inventario para la interfaz (campanita, Monitor de Alertas). Son la ÚNICA copia en el frontend y
 * siguen la misma regla que `Alert.getStats` del servidor (models/Alert.js): tres grupos por TIPO de alerta y conteo por
 * PRODUCTO distinto, no por fila.
 *
 *   critico      → stock_critico
 *   advertencia  → stock_bajo
 *   info         → todo lo demás (vencimiento_critico, vencimiento_proximo, sobrestock, reversion_precio…)
 *
 * Antes las tarjetas del Monitor contaban por tipo pero sus filtros filtraban por `severidad` (6 / 5 / 1 en vez de 4 / 3 / 5),
 * y la campanita pedía solo 5 alertas. Si se decide una regla por severidad (plan 25, pendiente), se cambia AQUÍ y en
 * `Alert.getStats` a la vez. Prueba: tests/business_logic/alertas_utils.test.js (y la de integración que compara con el servidor).
 */

/** @returns {'critico'|'advertencia'|'info'} */
export function grupoDeAlerta(tipo) {
  if (tipo === 'stock_critico') return 'critico';
  if (tipo === 'stock_bajo') return 'advertencia';
  return 'info';
}

/** Alertas de un grupo; `'todas'` (o cualquier otro valor) devuelve todas. */
export function alertasDelGrupo(alertas, grupo) {
  const lista = Array.isArray(alertas) ? alertas : [];
  if (grupo !== 'critico' && grupo !== 'advertencia' && grupo !== 'info') return lista;
  return lista.filter((a) => grupoDeAlerta(a.tipo) === grupo);
}

/**
 * Conteo por producto distinto (como el servidor): un producto cuenta una vez por grupo y una vez en el total.
 * @returns {{total:number, critico:number, advertencia:number, info:number}}
 */
export function contarAlertas(alertas) {
  const porGrupo = { critico: new Set(), advertencia: new Set(), info: new Set() };
  const todos = new Set();
  for (const a of Array.isArray(alertas) ? alertas : []) {
    porGrupo[grupoDeAlerta(a.tipo)].add(a.id_producto);
    todos.add(a.id_producto);
  }
  return { total: todos.size, critico: porGrupo.critico.size, advertencia: porGrupo.advertencia.size, info: porGrupo.info.size };
}

/** Texto de la insignia de la campanita: el número real, y «99+» solo cuando ya no cabe en el círculo. */
export function textoInsignia(total, tope = 99) {
  const n = Number(total);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return n > tope ? `${tope}+` : String(Math.trunc(n));
}
