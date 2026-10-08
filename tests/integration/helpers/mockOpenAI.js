/**
 * @file mockOpenAI.js (helpers)
 * @description Simula el camino feliz de OpenAI para pruebas de caracterización (plan 21, R0),
 * sin tocar código de producción y sin arriesgar fuga entre archivos bajo
 * `vitest.integration.config.js` (isolate:false comparte el registro de módulos entre TODOS los
 * archivos de la corrida de integración).
 *
 * Por qué `vi.spyOn` sobre el prototipo compartido y no `vi.mock('openai', ...)`:
 * el cliente de OpenAI se construye UNA sola vez por proceso (`services/ia/openaiClient.js`) al
 * cargar el módulo, y con `isolate:false` esa instancia sobrevive toda la corrida — un `vi.mock`
 * de fábrica no la alcanzaría retroactivamente, y además contaminaría cualquier otro archivo que
 * importe `openai` (incluido `ia_caida.test.js`, que necesita el fallo REAL de red con la clave
 * inválida de `.env.test`). En cambio, `Object.getPrototypeOf(new OpenAI({apiKey}).chat.completions)`
 * es el MISMO objeto (`Completions.prototype`) sin importar cuántas instancias de `OpenAI` se
 * construyan. Espiar ese prototipo intercepta la llamada real de la instancia ya construida, y
 * `mockRestore()` en `afterEach` devuelve la función original exacta (misma referencia), así que
 * ningún otro archivo del proceso queda afectado una vez restaurado. (Antes había dos instancias,
 * una en `aiController` y otra en `suppliersController`; el prototipo compartido las cubría a ambas.)
 *
 * @module tests/integration/helpers/mockOpenAI
 */
const { OpenAI } = require('openai');

const protoCompletions = Object.getPrototypeOf(new OpenAI({ apiKey: 'sk-test-solo-para-tomar-el-prototipo' }).chat.completions);

/**
 * Instala el mock persistente (mockResolvedValue, no *Once*: cada prueba debe verificar
 * explícitamente cuántas veces se llamó, no depender de que se "gaste" solo).
 * Recibe `vi` del archivo de prueba (no se puede `require('vitest')` desde un módulo CommonJS).
 * @param {import('vitest')['vi']} vi
 * @param {object} jsonContent - Lo que `JSON.parse(completion.choices[0].message.content)` debe devolver.
 * @returns {import('vitest').MockInstance} el spy, para poder aserir `toHaveBeenCalledTimes(...)`.
 */
function instalarMockOpenAI(vi, jsonContent) {
  const spy = vi.spyOn(protoCompletions, 'create');
  spy.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(jsonContent) } }] });
  return spy;
}

/** Restaura la función original del prototipo compartido (llamar siempre en afterEach). */
function restaurarMockOpenAI(vi) {
  vi.restoreAllMocks();
}

module.exports = { instalarMockOpenAI, restaurarMockOpenAI, protoCompletions };
