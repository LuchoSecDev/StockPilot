/**
 * @file fixtures.js (helpers)
 * @description Datos mínimos para las pruebas de integración: una tienda y un usuario con
 * contraseña conocida en texto plano (para poder loguearse en la prueba), usando los mismos
 * modelos que usa la app real (Store.create, User.create) para que el hash bcrypt y las demás
 * reglas de creación sean idénticas a producción.
 *
 * @module tests/integration/helpers/fixtures
 */

const Store = require('../../../models/Store');
const User = require('../../../models/User');
const Product = require('../../../models/Product');
const db = require('../../../config/database');
const equipo = require('../../../services/interno/equipo');

let contador = 0;
/** Sufijo único por llamada, para no chocar con UNIQUE (correo/usuario) entre pruebas. */
function unico() {
  contador += 1;
  return `${Date.now()}_${contador}`;
}

async function crearTienda(overrides = {}) {
  const id_tienda = await Store.create({
    nombre_establecimiento: overrides.nombre_establecimiento || `Tienda de Prueba ${unico()}`,
    direccion: overrides.direccion || 'Calle Falsa 123',
    anio_creacion: overrides.anio_creacion || 2024,
    id_propietario: overrides.id_propietario || null
  });
  return id_tienda;
}

/**
 * @param {Object} [overrides]
 * @param {number} [overrides.id_tienda] - Si falta, crea una tienda nueva.
 * @param {string} [overrides.rol='Administrador']
 * @param {string} [overrides.password='ClaveSegura123!']
 * @returns {Promise<{id_usuario:number, id_tienda:number, usuario:string, correo:string, password:string}>}
 */
async function crearUsuario(overrides = {}) {
  const sufijo = unico();
  const password = overrides.password || 'ClaveSegura123!';
  const id_tienda = overrides.id_tienda ?? await crearTienda();
  const usuario = overrides.usuario || `usuario_${sufijo}`;
  const correo = overrides.correo || `usuario_${sufijo}@test.local`;

  const id_usuario = await User.create({
    nombres: overrides.nombres || 'Usuario de Prueba',
    genero: overrides.genero || 'Otro',
    correo,
    celular: overrides.celular || '3000000000',
    usuario,
    contrasena: password,
    rol: overrides.rol || 'Administrador',
    id_tienda,
    cambio_clave_forzoso: overrides.cambio_clave_forzoso || false,
    aceptaPoliticaDatos: true
  });

  return { id_usuario, id_tienda, usuario, correo, password };
}

/**
 * @param {Object} overrides
 * @param {number} overrides.id_tienda - Obligatorio.
 * @param {number} [overrides.cantidad=10] - Stock inicial.
 * @returns {Promise<number>} id_producto
 */
async function crearProducto(overrides = {}) {
  const sufijo = unico();
  const id_producto = await Product.create({
    codigo: overrides.codigo || `COD-${sufijo}`,
    codigo_barras: overrides.codigo_barras || null,
    nombre_producto: overrides.nombre_producto || `Producto de Prueba ${sufijo}`,
    categoria: overrides.categoria || 'General',
    subcategoria: overrides.subcategoria || null,
    tipo_producto: overrides.tipo_producto || 'Normal',
    precio: overrides.precio ?? 1000,
    cantidad: overrides.cantidad ?? 10,
    id_tienda: overrides.id_tienda,
    stock_minimo: overrides.stock_minimo ?? 2,
    stock_maximo: overrides.stock_maximo ?? 200,
    frecuencia_compra_dias: overrides.frecuencia_compra_dias ?? 7,
    stock_seguridad: overrides.stock_seguridad ?? 2,
    lead_time: overrides.lead_time ?? 3,
    costo_compra: overrides.costo_compra ?? 500,
    id_proveedor: overrides.id_proveedor ?? null
  });
  return id_producto;
}

/** Abre una sesión de caja (requisito de saleController para vender) y devuelve su id_sesion. */
async function abrirCaja(id_tienda, id_vendedor, monto_apertura = 50000) {
  const result = await db.runAsync(
    `INSERT INTO SesionCaja (id_tienda, id_vendedor, monto_apertura, estado) VALUES (?, ?, ?, 'Abierta') RETURNING id_sesion`,
    [id_tienda, id_vendedor, monto_apertura]
  );
  return result.lastID;
}

/**
 * Cuenta del equipo interno (panel), creada con el MISMO servicio que usa el script de alta.
 * @returns {Promise<{id_equipo:number, nombre:string, usuario:string, correo:string, password:string, secreto:string}>}
 */
async function crearMiembroEquipo(overrides = {}) {
  const sufijo = unico();
  const datos = {
    nombre: overrides.nombre || 'Integrante de Prueba',
    correo: overrides.correo || `equipo_${sufijo}@test.local`,
    usuario: overrides.usuario || `equipo_${sufijo}`,
    password: overrides.password || 'ClaveDelEquipo123!',
    secreto: overrides.secreto || equipo.generarSecreto()
  };
  const { id_equipo } = await equipo.crearMiembro(datos);
  if (overrides.activo === false) await db.runAsync('UPDATE interno.equipo SET activo = false WHERE id_equipo = ?', [id_equipo]);
  return { id_equipo, ...datos };
}

module.exports = { crearTienda, crearUsuario, crearProducto, abrirCaja, crearMiembroEquipo };
