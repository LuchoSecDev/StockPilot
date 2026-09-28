/**
 * @file tiendas.js (helpers)
 * @description Dos tiendas independientes, cada una con un Administrador y un Tendero ya logueados
 * (agente supertest + token CSRF). Para pruebas de aislamiento entre tiendas y de rol.
 *
 * @module tests/integration/helpers/tiendas
 */

const request = require('supertest');
const { crearUsuario } = require('./fixtures');
const { iniciarSesion, obtenerCsrfToken } = require('./sesion');

async function sesion(app, datos) {
  const agente = request.agent(app);
  await iniciarSesion(agente, datos);
  return { agente, csrfToken: await obtenerCsrfToken(agente), ...datos };
}

/** @param {import('express').Express} app - La misma instancia que importa la prueba (`import app from '../../app.js'`).
 * @returns {Promise<{adminA, tenderoA, adminB, tenderoB}>} Cada uno: {agente, csrfToken, id_usuario, id_tienda, ...}. */
async function dosTiendas(app) {
  const adminA = await sesion(app, await crearUsuario({ rol: 'Administrador' }));
  const tenderoA = await sesion(app, await crearUsuario({ rol: 'Tendero', id_tienda: adminA.id_tienda }));
  const adminB = await sesion(app, await crearUsuario({ rol: 'Administrador' }));
  const tenderoB = await sesion(app, await crearUsuario({ rol: 'Tendero', id_tienda: adminB.id_tienda }));
  return { adminA, tenderoA, adminB, tenderoB };
}

module.exports = { sesion, dosTiendas };
