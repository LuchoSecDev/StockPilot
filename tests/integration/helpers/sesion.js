/**
 * @file sesion.js (helpers)
 * @description Login contra la app real usando un agente de supertest (mantiene la cookie de
 * sesión entre pedidos). Reutilizable por cualquier flujo que necesite "un vendedor logueado".
 *
 * @module tests/integration/helpers/sesion
 */

/**
 * @param {import('supertest').Agent} agente
 * @param {{usuario:string, password:string}} credenciales - Lo que devuelve crearUsuario().
 */
async function iniciarSesion(agente, { usuario, password }) {
  const res = await agente.post('/api/login').send({ login: usuario, password });
  if (res.status !== 200) {
    throw new Error(`iniciarSesion(): login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res;
}

/**
 * Token CSRF para el agente ya logueado (toda ruta /api/ que no sea /login, /registro o
 * /2fa/verify lo exige en POST/PUT/DELETE — ver app.js). Debe pedirse con el MISMO agente
 * (misma cookie de sesión) que después hace la petición que lo usa.
 */
async function obtenerCsrfToken(agente) {
  const res = await agente.get('/api/csrf-token');
  return res.body.csrfToken;
}

module.exports = { iniciarSesion, obtenerCsrfToken };
