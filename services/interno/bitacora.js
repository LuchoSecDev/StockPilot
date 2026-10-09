/**
 * @file bitacora.js
 * @description Bitácora del panel interno (`interno.bitacora`): quién del equipo hizo qué y cuándo. Es la contrapartida
 * de poder consultar métricas de tiendas ajenas (plan 22, 3.7): «cada consulta del equipo queda registrada».
 *
 * `registrar` LANZA si no puede escribir: una consulta sin rastro no debe ocurrir. Solo los intentos fallidos de
 * entrada se registran "sin fallar" (`registrarSinFallar`), porque no deben tumbar la respuesta de error.
 *
 * @module services/interno/bitacora
 */
const net = require('net');
const db = require('../../config/database');
const { logger } = require('../../utils/logger');

const ACCIONES = Object.freeze({
  LOGIN_OK: 'login_ok',
  LOGIN_FALLIDO: 'login_fallido',
  SEGUNDO_FACTOR_FALLIDO: 'segundo_factor_fallido',
  LOGOUT: 'logout',
  VER_TIENDAS: 'ver_tiendas',
  VER_TIENDA: 'ver_tienda',
  VER_EMBUDO: 'ver_embudo',
  VER_BITACORA: 'ver_bitacora',
  MARCAR_PRUEBA: 'marcar_prueba'
});

const LIMITE_POR_DEFECTO = 50;
const LIMITE_MAXIMO = 200;

/** La columna es `inet`: un valor que no sea una IP válida haría fallar el INSERT, así que se descarta. */
const ipValida = (ip) => (ip && net.isIP(ip) ? ip : null);

/**
 * @param {Object} entrada
 * @param {number|null} [entrada.idEquipo]
 * @param {string} entrada.accion - Una de ACCIONES.
 * @param {number|null} [entrada.idTienda]
 * @param {Object} [entrada.detalle] - Datos extra (JSON). Nunca contraseñas, códigos ni secretos.
 * @param {string} [entrada.ip]
 * @param {{query: Function}} [entrada.cliente] - Cliente de `db.getClient()`: escribe dentro de SU transacción, para que
 *   el cambio y su rastro se confirmen o se revierten juntos.
 */
async function registrar({ idEquipo = null, accion, idTienda = null, detalle = null, ip = null, cliente = null }) {
  const sql = 'INSERT INTO interno.bitacora (id_equipo, accion, id_tienda, detalle, ip) VALUES (?, ?, ?, ?, ?)';
  const params = [idEquipo, accion, idTienda, detalle === null ? null : JSON.stringify(detalle), ipValida(ip)];
  if (cliente) await cliente.query(sql, params);
  else await db.runAsync(sql, params);
}

/** Igual que `registrar`, pero si falla solo deja un aviso en el log (para los intentos de entrada fallidos). */
async function registrarSinFallar(entrada) {
  try {
    await registrar(entrada);
  } catch (err) {
    logger.error({ err, accion: entrada.accion }, 'No se pudo escribir en la bitácora del panel interno');
  }
}

const aEntero = (valor, porDefecto) => {
  const n = parseInt(valor, 10);
  return Number.isFinite(n) && n >= 0 ? n : porDefecto;
};

/**
 * @param {Object} [filtro]
 * @param {number} [filtro.limite] - Máximo 200.
 * @param {number} [filtro.desde] - Cuántas filas saltar (paginación).
 * @param {number} [filtro.idTienda] - Solo lo hecho sobre esa tienda.
 * @returns {Promise<{registros: Array<Object>, total: number}>}
 */
async function listar({ limite, desde, idTienda } = {}) {
  const tope = Math.min(Math.max(aEntero(limite, LIMITE_POR_DEFECTO), 1), LIMITE_MAXIMO);
  const salto = aEntero(desde, 0);
  const condicion = idTienda ? 'WHERE b.id_tienda = ?' : '';
  const params = idTienda ? [idTienda] : [];

  const registros = await db.allAsync(
    `SELECT b.id, b.fecha, b.accion, b.id_tienda, b.detalle, host(b.ip) AS ip, b.id_equipo, e.nombre AS equipo
       FROM interno.bitacora b
       LEFT JOIN interno.equipo e ON e.id_equipo = b.id_equipo
       ${condicion}
      ORDER BY b.fecha DESC, b.id DESC
      LIMIT ? OFFSET ?`,
    [...params, tope, salto]
  );
  const { total } = await db.getAsync(`SELECT COUNT(*)::int AS total FROM interno.bitacora b ${condicion}`, params);
  return { registros, total };
}

module.exports = { ACCIONES, LIMITE_MAXIMO, registrar, registrarSinFallar, listar };
