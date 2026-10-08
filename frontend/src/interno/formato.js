/**
 * Formato y textos del panel interno (funciones puras, sin React ni red). Todo lo que el equipo lee pasa por aquí para
 * que un porcentaje, una fecha o una etiqueta se vean igual en todas las pantallas.
 */

const ZONA = 'America/Bogota';
const SIN_DATO = '—';

/**
 * @param {number|null|undefined} razon - Entre 0 y 1.
 * @returns {string} «86 %», o «—» si no hay base para calcularlo (no se muestra un 0 % que no es real).
 */
export function formatearPorcentaje(razon) {
  if (razon === null || razon === undefined || Number.isNaN(razon)) return SIN_DATO;
  return `${Math.round(razon * 100)} %`;
}

/** «6 de 7»: con pocas tiendas los porcentajes engañan, así que siempre se acompañan del conteo. */
export const fraccion = (parte, total) => `${parte} de ${total}`;

/** Fecha y hora en hora de Bogotá (el servidor entrega instantes UTC). */
export function formatearFechaHora(iso) {
  if (!iso) return SIN_DATO;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return SIN_DATO;
  return fecha.toLocaleString('es-CO', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Solo la fecha, en hora de Bogotá. */
export function formatearFecha(iso) {
  if (!iso) return SIN_DATO;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return SIN_DATO;
  return fecha.toLocaleDateString('es-CO', { timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** «2026-10-07» (ya es un día calendario de Bogotá) → «07/10/2026», sin pasar por Date para no correr el día por la zona. */
export function formatearDia(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : SIN_DATO;
}

/** «hace 3 días», «hoy», «hace 5 h»… para «última venta» y «último acceso». */
export function haceCuanto(iso, ahora = Date.now()) {
  if (!iso) return 'Nunca';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return SIN_DATO;
  const minutos = Math.max(0, Math.round((ahora - t) / 60000));
  if (minutos < 60) return minutos <= 1 ? 'hace un momento' : `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? 'ayer' : `hace ${dias} días`;
}

const ACTIVACION = {
  activada: { texto: 'Activada', tono: 'exito' },
  en_curso: { texto: 'En curso', tono: 'aviso' },
  no_activada: { texto: 'No activada', tono: 'peligro' }
};

const ADOPCION = {
  meta: { texto: 'En la meta', tono: 'exito' },
  regular: { texto: 'Regular', tono: 'aviso' },
  baja: { texto: 'Baja', tono: 'peligro' }
};

/** @returns {{texto: string, tono: 'exito'|'aviso'|'peligro'|'neutro'}} */
export const etiquetaActivacion = (estado) => ACTIVACION[estado] || { texto: SIN_DATO, tono: 'neutro' };

/**
 * Una semana que aún no termina NO se califica: «2 de 7 días» a mitad de semana no es una adopción baja, es una semana a
 * medias. Se muestra neutra («En curso») para no alarmar por días que todavía no han pasado.
 * @param {string} nivel - 'meta' | 'regular' | 'baja'
 * @param {boolean} [completa=true] - Si la semana ya terminó.
 */
export const etiquetaAdopcion = (nivel, completa = true) => {
  if (completa === false) return { texto: 'En curso', tono: 'neutro' };
  return ADOPCION[nivel] || { texto: 'Sin datos', tono: 'neutro' };
};

const ACCIONES = {
  login_ok: 'Inició sesión',
  login_fallido: 'Intento de entrada fallido',
  segundo_factor_fallido: 'Código del segundo factor incorrecto',
  logout: 'Cerró sesión',
  ver_tiendas: 'Consultó la lista de tiendas',
  ver_tienda: 'Consultó el detalle de una tienda',
  ver_embudo: 'Consultó el embudo',
  ver_bitacora: 'Consultó la bitácora',
  marcar_prueba: 'Cambió la marca de tienda de prueba'
};

/** Texto legible de una acción de la bitácora (si aparece una nueva, se muestra tal cual en vez de romperse). */
export const etiquetaAccion = (accion) => ACCIONES[accion] || accion;

/** Las acciones que merecen atención en la bitácora (intentos fallidos). */
export const esAccionDeAlerta = (accion) => accion === 'login_fallido' || accion === 'segundo_factor_fallido';

/**
 * Conteos de la lista de tiendas para las tarjetas de arriba. Solo tiendas del piloto (las de prueba no cuentan).
 * @param {Array<Object>} tiendas - Lo que devuelve GET /api/interno/tiendas.
 */
export function resumirTiendas(tiendas) {
  const piloto = tiendas.filter(t => !t.es_prueba);
  const estados = piloto.map(t => t.activacion?.estado);
  const evaluadas = piloto.filter(t => t.adopcion && t.adopcion.completa);
  return {
    total: piloto.length,
    activadas: estados.filter(e => e === 'activada').length,
    en_curso: estados.filter(e => e === 'en_curso').length,
    no_activadas: estados.filter(e => e === 'no_activada').length,
    adopcion_evaluadas: evaluadas.length,
    adopcion_en_meta: evaluadas.filter(t => t.adopcion.nivel === 'meta').length,
    sin_ventas_7d: piloto.filter(t => t.ventas_7d === 0).length,
    politica_pendiente: piloto.filter(t => !t.dueno_acepto_politica).length
  };
}
