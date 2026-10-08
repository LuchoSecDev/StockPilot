/**
 * @file metricas.js
 * @description Lectura de las métricas del piloto desde las vistas `interno.*` y su composición con las definiciones
 * (`definiciones.js`). Solo conteos, fechas y estados por tienda: nunca montos, nombres de productos ni datos de clientes
 * (plan 22, secciones 2 y 3.3). Cada respuesta se arma CAMPO POR CAMPO (lista blanca) en vez de reenviar la fila de la
 * vista: si alguien agregara una columna sensible a una vista, no llegaría al panel por descuido.
 *
 * @module services/interno/metricas
 */
const db = require('../../config/database');
const { RecursoNoEncontradoError } = require('../errores');
const definiciones = require('./definiciones');
const bitacora = require('./bitacora');

// Las fechas tipo DATE se piden como texto: node-pg las convertiría a Date con la zona del servidor y correrían un día.
const SQL_ACTIVACION = `
  SELECT id_tienda, to_char(dia_registro, 'YYYY-MM-DD') AS dia_registro, productos_cargados, productos_primeros_7d,
         dias_con_ventas_7d, ventana_cerrada
  FROM interno.v_activacion`;
const SQL_ADOPCION = `
  SELECT id_tienda, semana, to_char(desde, 'YYYY-MM-DD') AS desde, to_char(hasta, 'YYYY-MM-DD') AS hasta,
         dias_con_ventas, dias_apertura_semana, semana_completa
  FROM interno.v_adopcion_semanal`;
const SQL_RESUMEN = `
  SELECT id_tienda, nombre, ciudad, estado, es_prueba, fecha_creacion, dias_apertura_semana, usuarios, dueno_acepto_politica,
         productos, ventas_7d, ventas_30d, dias_con_ventas_30d, ultima_venta, ultimo_acceso
  FROM interno.v_tiendas_resumen`;

/** Reparte filas en un Map por id_tienda. */
function agruparPorTienda(filas) {
  const mapa = new Map();
  for (const fila of filas) {
    if (!mapa.has(fila.id_tienda)) mapa.set(fila.id_tienda, []);
    mapa.get(fila.id_tienda).push(fila);
  }
  return mapa;
}

function armarActivacion(fila) {
  if (!fila) return null;
  return {
    estado: definiciones.estadoActivacion(fila),
    dia_registro: fila.dia_registro,
    productos_cargados: fila.productos_cargados,
    productos_primeros_7d: fila.productos_primeros_7d,
    dias_con_ventas_7d: fila.dias_con_ventas_7d,
    ventana_cerrada: fila.ventana_cerrada
  };
}

function armarAdopcion(semana) {
  if (!semana) return null;
  return {
    semana: semana.semana,
    completa: semana.completa,
    dias_con_ventas: semana.dias_con_ventas,
    dias_apertura_semana: semana.dias_apertura_semana,
    razon: semana.razon,
    nivel: semana.nivel
  };
}

/** Lo que el panel muestra de una tienda (lista blanca). */
function armarTienda(resumen, activacion, semanas) {
  return {
    id_tienda: resumen.id_tienda,
    nombre: resumen.nombre,
    ciudad: resumen.ciudad,
    estado: resumen.estado,
    es_prueba: resumen.es_prueba,
    fecha_creacion: resumen.fecha_creacion,
    dias_apertura_semana: resumen.dias_apertura_semana,
    usuarios: resumen.usuarios,
    dueno_acepto_politica: resumen.dueno_acepto_politica,
    productos: resumen.productos,
    ventas_7d: resumen.ventas_7d,
    ventas_30d: resumen.ventas_30d,
    dias_con_ventas_30d: resumen.dias_con_ventas_30d,
    ultima_venta: resumen.ultima_venta,
    ultimo_acceso: resumen.ultimo_acceso,
    activacion: armarActivacion(activacion),
    adopcion: armarAdopcion(definiciones.semanaRepresentativa(semanas))
  };
}

/** Metas y umbrales vigentes: el panel los muestra para que nadie tenga que adivinar contra qué se compara. */
const metas = () => ({
  activacion: definiciones.META_ACTIVACION,
  adopcion: definiciones.META_ADOPCION,
  umbral_productos: definiciones.UMBRAL_PRODUCTOS,
  umbral_dias_con_ventas: definiciones.UMBRAL_DIAS_CON_VENTAS,
  semana_del_embudo: definiciones.SEMANA_DEL_EMBUDO
});

/**
 * @param {{incluirPrueba?: boolean}} [opciones] - Por defecto las tiendas de prueba NO aparecen.
 */
async function listarTiendas({ incluirPrueba = false } = {}) {
  const [resumenes, activaciones, adopciones] = await Promise.all([
    db.allAsync(`${SQL_RESUMEN} WHERE (? OR NOT es_prueba) ORDER BY fecha_creacion DESC, id_tienda DESC`, [incluirPrueba]),
    db.allAsync(SQL_ACTIVACION),
    db.allAsync(`${SQL_ADOPCION} ORDER BY id_tienda, semana`)
  ]);
  const activacionPorTienda = new Map(activaciones.map(a => [a.id_tienda, a]));
  const semanasPorTienda = agruparPorTienda(adopciones);

  return {
    tiendas: resumenes.map(r => armarTienda(r, activacionPorTienda.get(r.id_tienda), definiciones.armarSemanas(semanasPorTienda.get(r.id_tienda) || []))),
    metas: metas()
  };
}

/**
 * @param {number} idTienda
 * @throws {RecursoNoEncontradoError}
 */
async function detalleTienda(idTienda) {
  const resumen = await db.getAsync(`${SQL_RESUMEN} WHERE id_tienda = ?`, [idTienda]);
  if (!resumen) throw new RecursoNoEncontradoError('Tienda no encontrada');

  const [activacion, filasAdopcion, historial] = await Promise.all([
    db.getAsync(`${SQL_ACTIVACION} WHERE id_tienda = ?`, [idTienda]),
    db.allAsync(`${SQL_ADOPCION} WHERE id_tienda = ? ORDER BY semana`, [idTienda]),
    bitacora.listar({ idTienda, limite: 30 })
  ]);
  const semanas = definiciones.armarSemanas(filasAdopcion);

  return {
    tienda: armarTienda(resumen, activacion, semanas),
    semanas,
    historial: historial.registros,
    metas: metas()
  };
}

async function embudo() {
  const [activaciones, adopciones] = await Promise.all([db.allAsync(SQL_ACTIVACION), db.allAsync(SQL_ADOPCION)]);
  return { embudo: definiciones.armarEmbudo(activaciones, adopciones), metas: metas() };
}

/**
 * Marca (o desmarca) una tienda como de prueba del equipo: las métricas del piloto dejan de contarla. El cambio y su
 * rastro en la bitácora se confirman juntos o no se confirma ninguno.
 * @throws {RecursoNoEncontradoError}
 */
async function marcarPrueba({ idTienda, esPrueba, idEquipo, ip }) {
  const cliente = await db.getClient();
  try {
    await cliente.query('BEGIN');
    const anterior = await cliente.query('SELECT es_prueba FROM tienda WHERE id_tienda = ? FOR UPDATE', [idTienda]);
    if (anterior.rows.length === 0) throw new RecursoNoEncontradoError('Tienda no encontrada');

    await cliente.query('UPDATE tienda SET es_prueba = ? WHERE id_tienda = ?', [esPrueba, idTienda]);
    await bitacora.registrar({
      idEquipo, accion: bitacora.ACCIONES.MARCAR_PRUEBA, idTienda, ip, cliente,
      detalle: { de: anterior.rows[0].es_prueba, a: esPrueba }
    });
    await cliente.query('COMMIT');
    return { id_tienda: idTienda, es_prueba: esPrueba };
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }
}

module.exports = { listarTiendas, detalleTienda, embudo, marcarPrueba };
