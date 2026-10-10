/**
 * Reglas de las alertas de inventario para la interfaz (campanita, Monitor de Alertas). Son la ÚNICA copia en el frontend y
 * siguen la misma regla que `Alert.getStats` del servidor (models/Alert.js), decidida por Luis el 9-oct-2026:
 * se agrupa por SEVERIDAD y se cuenta por PRODUCTO distinto, no por fila.
 *
 *   critico      → stock_critico + vencimiento_critico
 *   advertencia  → stock_bajo + vencimiento_proximo
 *   info         → sobrestock y avisos (reversion_precio…)
 *
 * Dentro de cada grupo la lista del Monitor lleva un separador por TIPO (`seccionesDeAlertas`) para distinguir las de
 * stock de las de vencimiento. Prueba: tests/business_logic/alertas_utils.test.js (y la de integración que compara con el
 * servidor).
 */

/** @returns {'critico'|'advertencia'|'info'} */
export function grupoDeAlerta(severidad) {
  if (severidad === 'critico' || severidad === 'advertencia') return severidad;
  return 'info';
}

/** Alertas de un grupo; `'todas'` (o cualquier otro valor) devuelve todas. */
export function alertasDelGrupo(alertas, grupo) {
  const lista = Array.isArray(alertas) ? alertas : [];
  if (grupo !== 'critico' && grupo !== 'advertencia' && grupo !== 'info') return lista;
  return lista.filter((a) => grupoDeAlerta(a.severidad) === grupo);
}

/**
 * Conteo por producto distinto (como el servidor): un producto cuenta una vez por grupo y una vez en el total.
 * @returns {{total:number, critico:number, advertencia:number, info:number}}
 */
export function contarAlertas(alertas) {
  const porGrupo = { critico: new Set(), advertencia: new Set(), info: new Set() };
  const todos = new Set();
  for (const a of Array.isArray(alertas) ? alertas : []) {
    porGrupo[grupoDeAlerta(a.severidad)].add(a.id_producto);
    todos.add(a.id_producto);
  }
  return { total: todos.size, critico: porGrupo.critico.size, advertencia: porGrupo.advertencia.size, info: porGrupo.info.size };
}

// Orden y títulos de los separadores. Los umbrales de vencimiento son los de Alert.determinarAlertaVencimiento.
const TITULOS_DE_SECCION = [
  ['stock_critico', 'Stock crítico'],
  ['vencimiento_critico', 'Por vencer (7 días o menos)'],
  ['stock_bajo', 'Stock bajo'],
  ['vencimiento_proximo', 'Próximas a vencer (8 a 30 días)'],
  ['sobrestock', 'Sobrestock'],
];

/**
 * Las alertas de un grupo, partidas por tipo en secciones con título (los separadores de la lista del Monitor). Solo
 * salen las secciones que tienen alertas. Un tipo que no conocemos va a «Otras alertas» de su grupo, al final.
 * Un producto con dos alertas (p. ej. stock crítico y vencimiento crítico) aparece en las dos secciones.
 * @returns {Array<{clave:string, grupo:string, titulo:string, alertas:Array<Object>}>}
 */
export function seccionesDeAlertas(alertas, grupo = 'todas') {
  const secciones = new Map();
  for (const a of alertasDelGrupo(alertas, grupo)) {
    const conocida = TITULOS_DE_SECCION.find(([tipo]) => tipo === a.tipo);
    const g = grupoDeAlerta(a.severidad);
    const clave = conocida ? a.tipo : `otras_${g}`;
    if (!secciones.has(clave)) {
      secciones.set(clave, { clave, grupo: g, titulo: conocida ? conocida[1] : 'Otras alertas', alertas: [] });
    }
    secciones.get(clave).alertas.push(a);
  }
  const posicion = (clave) => {
    const i = TITULOS_DE_SECCION.findIndex(([tipo]) => tipo === clave);
    return i === -1 ? TITULOS_DE_SECCION.length : i;
  };
  const orden = ['critico', 'advertencia', 'info'];
  return [...secciones.values()].sort((x, y) => posicion(x.clave) - posicion(y.clave) || orden.indexOf(x.grupo) - orden.indexOf(y.grupo));
}

/** Texto de la insignia de la campanita: el número real, y «99+» solo cuando ya no cabe en el círculo. */
export function textoInsignia(total, tope = 99) {
  const n = Number(total);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return n > tope ? `${tope}+` : String(Math.trunc(n));
}
