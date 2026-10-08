import axios from 'axios';

const BASE = '/api/interno';

/**
 * Trae un token CSRF nuevo. Hay que hacerlo después de cada paso del acceso: el servidor regenera la sesión (anti fijación
 * de sesión) y el token anterior deja de valer.
 */
export async function renovarCsrf() {
  const { data } = await axios.get('/api/csrf-token');
  if (data?.csrfToken) axios.defaults.headers.common['x-csrf-token'] = data.csrfToken;
}

/** El mensaje que dio el servidor, o uno genérico si no hubo respuesta (red caída, servidor dormido). */
export function mensajeDeError(err, porDefecto = 'No se pudo completar la operación. Intenta de nuevo.') {
  return err?.response?.data?.error || porDefecto;
}

const datos = (promesa) => promesa.then(r => r.data);

/** Llamadas al panel interno. Todo lo que devuelven son conteos, fechas y estados: nunca montos ni datos de clientes. */
export const api = {
  sesion: () => datos(axios.get(`${BASE}/sesion`)),
  login: (usuario, password) => datos(axios.post(`${BASE}/login`, { usuario, password })),
  segundoFactor: (token) => datos(axios.post(`${BASE}/2fa`, { token })),
  logout: () => datos(axios.post(`${BASE}/logout`)),
  tiendas: (incluirPrueba = false) => datos(axios.get(`${BASE}/tiendas`, { params: { incluirPrueba } })),
  tienda: (id) => datos(axios.get(`${BASE}/tiendas/${id}`)),
  marcarPrueba: (id, esPrueba) => datos(axios.put(`${BASE}/tiendas/${id}/es-prueba`, { esPrueba })),
  embudo: () => datos(axios.get(`${BASE}/embudo`)),
  bitacora: ({ limite = 50, desde = 0 } = {}) => datos(axios.get(`${BASE}/bitacora`, { params: { limite, desde } }))
};
