/**
 * @file definiciones.js
 * @description Las DEFINICIONES de las métricas del piloto, en un solo lugar y puras (sin base de datos). Las vistas de
 * `interno.*` entregan conteos; aquí se decide qué cuenta como «activada», cómo se mide la adopción y qué semáforo se
 * muestra. Se fijan ANTES de la convocatoria para que la meta no se ajuste al resultado (documento de intervención,
 * sección 1.6): cambiar un número de este archivo es cambiar la definición del estudio, no «afinar un detalle».
 *
 * Decididas por Luis (plan 22, sección 7): activación (28-sep), días de apertura (28-sep) y, el 9-oct-2026, el umbral
 * «regular» de la adopción, la definición de «con uso en la semana 4» del embudo y que «productos cargados» cuenta el
 * total de la tienda (P22-20 y P22-21).
 *
 * @module services/interno/definiciones
 */

/** Activación: al menos 20 productos cargados... (decisión del 28-sep-2026) */
const UMBRAL_PRODUCTOS = 20;
/** ...y ventas en al menos 5 de los primeros 7 días calendario desde el registro (decisión del 28-sep-2026). */
const UMBRAL_DIAS_CON_VENTAS = 5;
/** Meta de activación de la prueba gratuita: 25 % de los registros (documento de intervención). */
const META_ACTIVACION = 0.25;
/** Meta de adopción semanal: 80 % de los días de apertura con ventas (documento de intervención). */
const META_ADOPCION = 0.8;
/** Decidido el 9-oct-2026: por debajo de la meta pero desde aquí la adopción es «regular» (ámbar); por debajo, «baja» (rojo). */
const UMBRAL_ADOPCION_REGULAR = 0.5;
/** Decidido el 9-oct-2026: el embudo mide si la tienda sigue activa en su semana 4 de vida (días 21 a 27 desde el registro). */
const SEMANA_DEL_EMBUDO = 4;

/**
 * @param {{productos_cargados: number, dias_con_ventas_7d: number}} activacion - Una fila de `interno.v_activacion`.
 * @returns {boolean}
 */
function estaActivada({ productos_cargados, dias_con_ventas_7d }) {
  return productos_cargados >= UMBRAL_PRODUCTOS && dias_con_ventas_7d >= UMBRAL_DIAS_CON_VENTAS;
}

/**
 * - `activada`: cumple las dos condiciones (aunque la ventana de 7 días siga abierta).
 * - `en_curso`: aún no cumple, pero la ventana de 7 días no se ha cerrado: todavía puede activarse.
 * - `no_activada`: la ventana se cerró sin cumplirlas.
 * @param {{productos_cargados: number, dias_con_ventas_7d: number, ventana_cerrada: boolean}} activacion
 * @returns {'activada'|'en_curso'|'no_activada'}
 */
function estadoActivacion(activacion) {
  if (estaActivada(activacion)) return 'activada';
  return activacion.ventana_cerrada ? 'no_activada' : 'en_curso';
}

/**
 * Adopción de una semana: días con ventas ÷ días de apertura, con tope de 100 % (decisión del 28-sep-2026).
 * @param {number} diasConVentas
 * @param {number} diasApertura - 1 a 7.
 * @returns {number} entre 0 y 1
 */
function razonAdopcion(diasConVentas, diasApertura) {
  if (!diasApertura || diasApertura <= 0) return 0;
  return Math.min(1, diasConVentas / diasApertura);
}

/** @returns {'meta'|'regular'|'baja'} */
function nivelAdopcion(razon) {
  if (razon >= META_ADOPCION) return 'meta';
  if (razon >= UMBRAL_ADOPCION_REGULAR) return 'regular';
  return 'baja';
}

/**
 * Convierte las filas de `interno.v_adopcion_semanal` de UNA tienda en semanas con su razón y nivel.
 * @param {Array<Object>} filas
 * @returns {Array<{semana:number, desde:string, hasta:string, dias_con_ventas:number, dias_apertura_semana:number, completa:boolean, razon:number, nivel:string}>}
 */
function armarSemanas(filas) {
  return [...filas]
    .sort((a, b) => a.semana - b.semana)
    .map(f => {
      const razon = razonAdopcion(f.dias_con_ventas, f.dias_apertura_semana);
      return {
        semana: f.semana,
        desde: f.desde,
        hasta: f.hasta,
        dias_con_ventas: f.dias_con_ventas,
        dias_apertura_semana: f.dias_apertura_semana,
        completa: f.semana_completa,
        razon,
        nivel: nivelAdopcion(razon)
      };
    });
}

/**
 * La semana que representa a la tienda en el semáforo: la última COMPLETA (una semana a medias castigaría a la tienda
 * por días que aún no han pasado); si todavía no tiene ninguna completa, la que va en curso (marcada como tal).
 * @param {ReturnType<typeof armarSemanas>} semanas
 * @returns {ReturnType<typeof armarSemanas>[number]|null}
 */
function semanaRepresentativa(semanas) {
  const completas = semanas.filter(s => s.completa);
  if (completas.length) return completas[completas.length - 1];
  return semanas.length ? semanas[semanas.length - 1] : null;
}

/** @returns {number|null} Proporción, o null si no hay base (evita mostrar 0 % cuando no hay nada que medir). */
const proporcion = (parte, total) => (total > 0 ? parte / total : null);

/**
 * Embudo de la convocatoria: registros → activadas → con uso en la semana 4. Con pocas tiendas (puede ser UNA) los
 * porcentajes engañan, así que siempre se entregan también los conteos (`n de N`).
 * @param {Array<Object>} activaciones - Filas de `interno.v_activacion` (ya sin tiendas de prueba).
 * @param {Array<Object>} adopciones - Filas de `interno.v_adopcion_semanal` (ya sin tiendas de prueba).
 */
function armarEmbudo(activaciones, adopciones) {
  const estados = activaciones.map(estadoActivacion);
  const activadas = estados.filter(e => e === 'activada').length;
  const enCurso = estados.filter(e => e === 'en_curso').length;
  const noActivadas = estados.filter(e => e === 'no_activada').length;

  const porTienda = new Map();
  for (const fila of adopciones) {
    if (!porTienda.has(fila.id_tienda)) porTienda.set(fila.id_tienda, []);
    porTienda.get(fila.id_tienda).push(fila);
  }

  let alcanzaronSemana4 = 0;
  let conUsoSemana4 = 0;
  let evaluadas = 0;
  let enMeta = 0;
  for (const filas of porTienda.values()) {
    const semanas = armarSemanas(filas);
    const s4 = semanas.find(s => s.semana === SEMANA_DEL_EMBUDO);
    if (s4) {
      alcanzaronSemana4 += 1;
      if (s4.dias_con_ventas >= 1) conUsoSemana4 += 1;
    }
    const representativa = semanaRepresentativa(semanas);
    if (representativa && representativa.completa) {
      evaluadas += 1;
      if (representativa.razon >= META_ADOPCION) enMeta += 1;
    }
  }

  return {
    registros: activaciones.length,
    activadas,
    en_curso: enCurso,
    no_activadas: noActivadas,
    tasa_activacion: proporcion(activadas, activaciones.length),
    meta_activacion: META_ACTIVACION,
    semana_4: {
      semana: SEMANA_DEL_EMBUDO,
      alcanzaron: alcanzaronSemana4,
      con_uso: conUsoSemana4,
      tasa: proporcion(conUsoSemana4, alcanzaronSemana4)
    },
    adopcion: {
      evaluadas,
      en_meta: enMeta,
      tasa_en_meta: proporcion(enMeta, evaluadas),
      meta: META_ADOPCION
    }
  };
}

module.exports = {
  UMBRAL_PRODUCTOS, UMBRAL_DIAS_CON_VENTAS, META_ACTIVACION, META_ADOPCION, UMBRAL_ADOPCION_REGULAR, SEMANA_DEL_EMBUDO,
  estaActivada, estadoActivacion, razonAdopcion, nivelAdopcion, armarSemanas, semanaRepresentativa, armarEmbudo
};
