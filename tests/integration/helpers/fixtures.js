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

module.exports = { crearTienda, crearUsuario };
