/**
 * @file openaiClient.js
 * @description ÚNICO punto de acceso a OpenAI en el backend: la instancia del cliente, el modelo
 * y la validación de la clave viven aquí y en ningún otro archivo. Quien necesite el modelo
 * (servicios de `services/ia/` y `suppliersController`) importa de este módulo; nadie más hace
 * `new OpenAI(...)`. Cambiar de modelo, de proveedor o agregar reintentos es tocar este archivo.
 *
 * @module services/ia/openaiClient
 */
const { OpenAI } = require('openai');
const { IANoConfiguradaError } = require('../errores');

const MODELO = 'gpt-4o-mini';

// Clave falsa si falta la variable, para que la app arranque (el chequeo real es asegurarApiKey).
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key_to_prevent_crash_on_startup'
});

/** @throws {IANoConfiguradaError} Si no hay clave, o sigue el valor de ejemplo del `.env`. */
function asegurarApiKey() {
  const clave = process.env.OPENAI_API_KEY;
  if (!clave || clave.includes('tuLlaveSecreta')) throw new IANoConfiguradaError();
}

/**
 * Pide al modelo una respuesta en modo JSON y la devuelve ya parseada.
 * @param {Object} opciones
 * @param {Array<{role: string, content: string}>} opciones.messages
 * @param {number} [opciones.temperature] - Solo si el caso de uso la fija.
 * @returns {Promise<Object>}
 * @throws {Error} Si OpenAI falla (red, clave inválida, timeout) o `SyntaxError` si responde algo que no es JSON.
 */
async function pedirJSON({ messages, temperature }) {
  const completion = await openaiClient.chat.completions.create({
    model: MODELO,
    messages,
    response_format: { type: 'json_object' },
    ...(temperature !== undefined && { temperature })
  });
  return JSON.parse(completion.choices[0].message.content);
}

module.exports = { openaiClient, MODELO, asegurarApiKey, pedirJSON };
