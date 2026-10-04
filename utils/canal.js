// utils/canal.js
// Canal desde el que se inicia sesión: 'web' (el navegador, por defecto) o 'app' (la app nativa del
// Tendero). Lo declara el cliente con la cabecera `X-Canal: app` SOLO en el login; después el canal
// vive en la sesión (`req.session.canal`) y ya no se vuelve a leer de la cabecera.
//
// No es una frontera de seguridad (el cliente puede declarar lo que quiera): sirve para que el
// candado de sesión única de los Tenderos sea por canal, o sea, como máximo una sesión web y una app.

/**
 * @param {import('express').Request} req
 * @returns {'web'|'app'} 'app' solo si la cabecera X-Canal vale «app» (sin importar mayúsculas ni espacios).
 */
function canalDesdeCabecera(req) {
    const valor = req.get ? req.get('X-Canal') : req.headers?.['x-canal'];
    return String(valor ?? '').trim().toLowerCase() === 'app' ? 'app' : 'web';
}

/**
 * @param {object} [session] req.session
 * @returns {'web'|'app'} Las sesiones anteriores a este cambio no traen canal: son 'web'.
 */
function canalDeSesion(session) {
    return session?.canal === 'app' ? 'app' : 'web';
}

module.exports = { canalDesdeCabecera, canalDeSesion };
