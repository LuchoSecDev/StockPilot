/**
 * @file errores.js
 * @description Errores de dominio que lanzan los servicios. Los servicios no conocen HTTP
 * (no reciben `res`), así que no deciden códigos de estado: lanzan un error con significado y el
 * controlador lo traduce (`RecursoNoEncontradoError` → 404, `IANoConfiguradaError` → 500).
 * Se distinguen con `instanceof`, nunca comparando el texto del mensaje.
 *
 * @module services/errores
 */

/** Falta la clave de OpenAI (o sigue el valor de ejemplo del `.env`). */
class IANoConfiguradaError extends Error {
  constructor() {
    super('La API Key de OpenAI no está configurada correctamente en el archivo .env.');
    this.name = 'IANoConfiguradaError';
  }
}

/** El recurso pedido no existe o no pertenece a la tienda de la sesión. */
class RecursoNoEncontradoError extends Error {
  /** @param {string} mensaje - Texto que verá el usuario (p. ej. «Producto no encontrado»). */
  constructor(mensaje) {
    super(mensaje);
    this.name = 'RecursoNoEncontradoError';
  }
}

module.exports = { IANoConfiguradaError, RecursoNoEncontradoError };
