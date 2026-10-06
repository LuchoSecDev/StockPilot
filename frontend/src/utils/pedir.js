// Reglas puras de la pantalla «¿Qué pido?» (/pedir, modo básico, plan 19, 3.4.3 fase C). Sin React, para poder
// probarlas (tests/business_logic/pedir_modo_basico.test.js). Todo sale del motor matemático (utils/reposicion.js,
// vía GET /api/ia/snapshot): aquí no interviene ningún modelo de lenguaje.

/** Niveles del motor que merecen un pedido. 'ok' no se pide aunque haya cantidad calculada. */
export const NIVELES_A_PEDIR = ['agotado', 'critico', 'reponer'];

const RANGO_URGENCIA = { 'Pide hoy': 0, 'En esta compra': 1, 'Puede esperar': 2 };
const rango = (urgencia) => RANGO_URGENCIA[urgencia] ?? 3;

/** El servidor acepta de 1 a 50 productos por pedido (POST /api/ordenes/borrador/desde-consejero). */
export const MAX_PRODUCTOS_POR_PEDIDO = 50;

const aNumero = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Qué conviene pedir ahora, agrupado por proveedor.
 * @param {Array} snapshot  `data` de GET /api/ia/snapshot (una fila por producto disponible).
 * @param {Object} borradores  `data` de GET /api/ordenes/borradores/resumen ({ [id_producto]: {...} }): lo que ya
 *   está en un pedido en borrador no se vuelve a ofrecer.
 * @returns {{grupos: Array, sinProveedor: Array, sinCantidad: Array, yaEnBorrador: number}}
 *   - grupos: un pedido posible por proveedor, los más urgentes primero.
 *   - sinProveedor: hay que asignarles proveedor en el Catálogo antes de poder pedirlos.
 *   - sinCantidad: productos AGOTADOS para los que el motor no calcula cuánto pedir (sin ventas y sin stock mínimo ni
 *     de seguridad configurados); se avisa en vez de esconderlos. Un producto «por reponer» con cantidad 0 no entra
 *     aquí: el motor ya considera cubierto su objetivo (p. ej. justo en el stock de seguridad) y no hay nada que pedir.
 */
export function sugerenciasDePedido(snapshot, borradores = {}) {
  const candidatos = (snapshot || []).filter((p) => NIVELES_A_PEDIR.includes(p.nivel));
  const conCantidad = candidatos.filter((p) => aNumero(p.cantidad_recomendada) > 0);
  const sinCantidad = candidatos.filter((p) => p.nivel === 'agotado' && aNumero(p.cantidad_recomendada) <= 0);

  const yaEnBorrador = conCantidad.filter((p) => borradores[p.id_producto]).length;
  const pedibles = conCantidad.filter((p) => !borradores[p.id_producto]).map((p) => {
    const cantidad = aNumero(p.cantidad_recomendada);
    return {
      id_producto: p.id_producto,
      id_proveedor: p.id_proveedor ?? null,
      proveedor: p.proveedor ?? null,
      nombre: p.nombre,
      stock: aNumero(p.stock_actual),
      cantidad,
      urgencia: p.urgencia,
      nivel: p.nivel,
      costo_unitario: aNumero(p.costo_unitario),
      costo_estimado: Boolean(p.costo_estimado),
      subtotal: cantidad * aNumero(p.costo_unitario),
    };
  });
  const porUrgencia = (a, b) => rango(a.urgencia) - rango(b.urgencia) || String(a.nombre).localeCompare(String(b.nombre), 'es');

  const sinProveedor = pedibles.filter((p) => p.id_proveedor === null).sort(porUrgencia);
  const porProveedor = new Map();
  for (const p of pedibles.filter((x) => x.id_proveedor !== null)) {
    if (!porProveedor.has(p.id_proveedor)) porProveedor.set(p.id_proveedor, { id_proveedor: p.id_proveedor, proveedor: p.proveedor, items: [] });
    porProveedor.get(p.id_proveedor).items.push(p);
  }
  const grupos = [...porProveedor.values()].map((g) => {
    const items = g.items.sort(porUrgencia);
    return {
      ...g,
      items,
      urgencia: items[0].urgencia,
      total: items.reduce((suma, i) => suma + i.subtotal, 0),
      hayCostosEstimados: items.some((i) => i.costo_estimado),
    };
  }).sort((a, b) => rango(a.urgencia) - rango(b.urgencia) || String(a.proveedor).localeCompare(String(b.proveedor), 'es'));

  return { grupos, sinProveedor, sinCantidad, yaEnBorrador };
}

/**
 * Cuerpo de POST /api/ordenes/borrador/desde-consejero para armar el pedido de unos productos. `base` es la cantidad
 * del motor y `ajuste_ia` no se manda (queda en 0): nadie ajustó nada. Más de 50 productos: se mandan los primeros 50.
 */
export function cuerpoParaArmar(items) {
  return {
    items: items.slice(0, MAX_PRODUCTOS_POR_PEDIDO).map((i) => ({
      id_producto: i.id_producto,
      cantidad: i.cantidad,
      base: i.cantidad,
      urgencia: i.urgencia,
    })),
  };
}

/** Órdenes que esperan una decisión del dueño (el historial trae todas las de la tienda, sin filtrar). */
export const ordenesPorAprobar = (historial) => (historial || []).filter((o) => ['Borrador', 'Pendiente'].includes(o.estado));

/** Órdenes aprobadas a las que todavía les falta mercancía por llegar. */
export const ordenesPorRecibir = (historial) => (historial || []).filter((o) => ['Aprobada', 'Enviada', 'Parcial'].includes(o.estado));

/** Cuánto falta por llegar de una línea de orden. */
export const pendienteDeLinea = (linea) => Math.max(0, aNumero(linea.cantidad_final) - aNumero(linea.cantidad_recibida));

/** Lo que el dueño escribe en «Llegó»: un entero de 0 a 100000 (el servidor valida lo mismo); `null` si no sirve. */
export function llegadaValida(texto) {
  if (typeof texto === 'number') texto = String(texto);
  if (typeof texto !== 'string' || !/^\d+$/.test(texto.trim())) return null;
  const n = Number(texto.trim());
  return n <= 100000 ? n : null;
}

/**
 * Cuerpo de POST /api/ordenes/:id/completar. El servidor espera el TOTAL recibido de cada línea, no lo de hoy:
 * aquí se suma lo ya registrado con lo que llegó ahora. Reenviar el mismo total no vuelve a sumar stock.
 * @param {Array} lineas  Detalle de la orden (GET /api/ordenes/:id).
 * @param {Object} llegadas  { [id_producto]: texto escrito en «Llegó» }
 * @param {{cerrarConFaltante?: boolean, confirmarExceso?: boolean, motivo?: string}} [opciones]
 * @returns {{ok: true, cuerpo: Object} | {ok: false, error: string}}
 */
export function cuerpoDeRecepcion(lineas, llegadas, opciones = {}) {
  const items = [];
  for (const l of lineas) {
    const llego = llegadaValida(llegadas[l.id_producto] ?? '0');
    if (llego === null) return { ok: false, error: `Revisa la cantidad que llegó de «${l.nombre_producto}»: debe ser un número entero, 0 o más.` };
    items.push({ id_producto: l.id_producto, cantidad_recibida: aNumero(l.cantidad_recibida) + llego });
  }
  const cuerpo = { items };
  if (opciones.cerrarConFaltante) cuerpo.cerrar_con_faltante = true;
  if (opciones.confirmarExceso) {
    cuerpo.confirmar_exceso = true;
    cuerpo.motivo = (opciones.motivo || '').trim();
  }
  return { ok: true, cuerpo };
}

/** ¿Con lo que llegó ahora, a alguna línea todavía le faltaría mercancía? Decide si se ofrece «cerrar con faltante». */
export function quedaraFaltante(lineas, llegadas) {
  return lineas.some((l) => {
    const llego = llegadaValida(llegadas[l.id_producto] ?? '0');
    return llego !== null && aNumero(l.cantidad_recibida) + llego < aNumero(l.cantidad_final);
  });
}
