/**
 * @file equipo.js
 * @description Cuentas del equipo interno (tabla `interno.equipo`, aparte de `Usuarios`): crear, autenticar con
 * contraseña, verificar el segundo factor (obligatorio) y consultar si la cuenta sigue activa. Recibe datos, nunca
 * `req`/`res`. Las cuentas se crean SOLO por script (`npm run equipo:crear`): no hay endpoint de registro.
 *
 * @module services/interno/equipo
 */
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
const db = require('../../config/database');

const SALT_ROUNDS = 10; // el mismo costo que las cuentas de tienda (models/User.js)
const LARGO_MINIMO_CLAVE = 12;
const NOMBRE_EMISOR_TOTP = 'StockPilot (equipo)';

// Un código TOTP ya aceptado no se vuelve a aceptar mientras siga vigente (ventana de 30 s ± 1 paso, con margen).
const SEGUNDOS_SIN_REPETIR_CODIGO = 90;

// Instancia propia con tolerancia de ±1 paso (30 s) para el desajuste de reloj del celular. Se clona: modificar
// `authenticator.options` cambiaría también la verificación de las cuentas de tienda, que comparten el singleton.
const totp = authenticator.clone({ window: 1 });

// Hash de una contraseña que nadie tiene: cuando el usuario no existe o está inactivo se compara contra este, para que
// la respuesta tarde lo mismo y no se pueda averiguar qué usuarios existen midiendo el tiempo.
const HASH_FICTICIO = bcrypt.hashSync('contrasena-que-nadie-tiene', SALT_ROUNDS);

class DatosDeCuentaInvalidosError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'DatosDeCuentaInvalidosError';
  }
}

/** @returns {string} Secreto TOTP nuevo. */
const generarSecreto = () => authenticator.generateSecret();

/** URI `otpauth://` que se muestra como QR para añadir la cuenta a Google Authenticator. */
const uriOtpauth = (correo, secreto) => authenticator.keyuri(correo, NOMBRE_EMISOR_TOTP, secreto);

/**
 * @param {string} secreto
 * @param {string} token - Código de 6 dígitos.
 * @returns {boolean} true si es válido AHORA (no guarda nada: sirve para confirmar el alta en el script).
 */
const codigoEsValido = (secreto, token) => /^\d{6}$/.test(String(token)) && totp.check(String(token), secreto);

function validarDatos({ nombre, correo, usuario, password }) {
  if (!nombre || !String(nombre).trim()) throw new DatosDeCuentaInvalidosError('Falta el nombre.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo || ''))) throw new DatosDeCuentaInvalidosError('El correo no es válido.');
  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(String(usuario || ''))) throw new DatosDeCuentaInvalidosError('El usuario debe tener de 3 a 50 caracteres (letras, números, punto, guion).');
  if (String(password || '').length < LARGO_MINIMO_CLAVE) throw new DatosDeCuentaInvalidosError(`La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
}

/**
 * Crea una cuenta del equipo. El 2FA es obligatorio: sin secreto no se crea.
 * @param {{nombre: string, correo: string, usuario: string, password: string, secreto: string}} datos
 * @returns {Promise<{id_equipo: number}>}
 * @throws {DatosDeCuentaInvalidosError} Datos inválidos o usuario/correo ya usados.
 */
async function crearMiembro({ nombre, correo, usuario, password, secreto }) {
  validarDatos({ nombre, correo, usuario, password });
  if (!secreto) throw new DatosDeCuentaInvalidosError('El segundo factor es obligatorio: falta el secreto.');

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const r = await db.runAsync(
      'INSERT INTO interno.equipo (nombre, correo, usuario, contrasena, two_factor_secret) VALUES (?, ?, ?, ?, ?)',
      [String(nombre).trim(), String(correo).trim().toLowerCase(), String(usuario).trim(), hash, secreto]
    );
    return { id_equipo: r.lastID };
  } catch (err) {
    if (err.code === '23505') throw new DatosDeCuentaInvalidosError('Ya existe una cuenta con ese usuario o correo.');
    throw err;
  }
}

/**
 * Verifica usuario y contraseña. NO abre sesión: el segundo factor sigue pendiente.
 * @param {string} usuario
 * @param {string} password
 * @returns {Promise<{id_equipo: number, nombre: string}|null>} null si no coincide (sin distinguir el motivo).
 */
async function autenticar(usuario, password) {
  const miembro = await db.getAsync(
    'SELECT id_equipo, nombre, contrasena, activo FROM interno.equipo WHERE usuario = ?',
    [String(usuario)]
  );
  // Se compara SIEMPRE, exista o no la cuenta, para que el tiempo de respuesta no delate si el usuario existe.
  const coincide = await bcrypt.compare(String(password), miembro ? miembro.contrasena : HASH_FICTICIO);
  if (!miembro || !miembro.activo || !coincide) return null;
  return { id_equipo: miembro.id_equipo, nombre: miembro.nombre };
}

/**
 * Comprueba el código del segundo factor y lo "gasta": el mismo código no sirve dos veces seguidas.
 * @param {number} idEquipo
 * @param {string} token
 * @returns {Promise<boolean>}
 */
async function aceptarSegundoFactor(idEquipo, token) {
  const miembro = await db.getAsync('SELECT two_factor_secret FROM interno.equipo WHERE id_equipo = ? AND activo', [idEquipo]);
  if (!miembro || !codigoEsValido(miembro.two_factor_secret, token)) return false;

  // Atómico: solo uno de dos intentos simultáneos con el mismo código puede ganar.
  const r = await db.runAsync(
    `UPDATE interno.equipo
        SET ultimo_token_usado = ?, ultimo_token_en = CURRENT_TIMESTAMP, ultimo_acceso = CURRENT_TIMESTAMP
      WHERE id_equipo = ? AND activo
        AND (ultimo_token_usado IS DISTINCT FROM ? OR ultimo_token_en < NOW() - (? * INTERVAL '1 second'))`,
    [String(token), idEquipo, String(token), SEGUNDOS_SIN_REPETIR_CODIGO]
  );
  return r.changes === 1;
}

/**
 * La cuenta con esa sesión, si sigue existiendo y activa (se consulta en cada petición: desactivar a alguien corta su
 * acceso de inmediato, sin esperar a que caduque la sesión).
 * @param {number} idEquipo
 * @returns {Promise<{id_equipo: number, nombre: string}|null>}
 */
async function obtenerActivo(idEquipo) {
  const miembro = await db.getAsync('SELECT id_equipo, nombre FROM interno.equipo WHERE id_equipo = ? AND activo', [idEquipo]);
  return miembro || null;
}

module.exports = {
  DatosDeCuentaInvalidosError, LARGO_MINIMO_CLAVE,
  generarSecreto, uriOtpauth, codigoEsValido, crearMiembro, autenticar, aceptarSegundoFactor, obtenerActivo
};
