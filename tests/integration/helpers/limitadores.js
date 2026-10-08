/**
 * @file limitadores.js (helpers)
 * @description Reinicio de los contadores de los limitadores de peticiones entre archivos de
 * prueba (plan 21, R0). Solo para pruebas: no toca `middleware/rateLimiter.js`.
 *
 * Por qué hace falta: sin REDIS_URL (tests/.env.test no lo define) cada limitador usa el
 * `MemoryStore` de express-rate-limit, que vive en la memoria del proceso. Con `isolate: false`
 * ese proceso es el MISMO para toda la corrida, así que los contadores se acumulan entre archivos.
 * Y como `limpiarBaseDePruebas()` hace `RESTART IDENTITY`, el primer usuario de cada prueba vuelve
 * a ser `id_usuario = 1`: todas las pruebas comparten la clave `user_1` (globalLimiter, aiLimiter,
 * twoFactorLimiter), y las peticiones sin sesión (login, registro…) comparten la clave de la IP.
 *
 * Cómo: cada `rateLimit()` crea su propio `MemoryStore` y no lo expone, así que se registra cada
 * instancia envolviendo `MemoryStore.prototype.init` (que `rateLimit()` llama al construirse).
 * El parche debe instalarse ANTES de que algo cargue `middleware/rateLimiter.js`; por eso lo importa
 * `setupTestDb.js`. Se usa `createRequire` para obtener el MISMO módulo CJS que carga
 * `rateLimiter.js` (el `import` ESM de express-rate-limit sería otra copia de la clase).
 *
 * @module tests/integration/helpers/limitadores
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { MemoryStore } = require('express-rate-limit');

// Registro en globalThis: con isolate:false el módulo se comparte, pero así no depende de que
// Vitest lo evalúe una sola vez.
const CLAVE = Symbol.for('stockpilot.tests.memoryStoresLimitadores');
if (!globalThis[CLAVE]) {
  globalThis[CLAVE] = [];
  const initOriginal = MemoryStore.prototype.init;
  MemoryStore.prototype.init = function (...args) {
    if (!globalThis[CLAVE].includes(this)) globalThis[CLAVE].push(this);
    return initOriginal.apply(this, args);
  };
}

// Orden de creación en middleware/rateLimiter.js: globalLimiter, aiLimiter, authLimiter,
// twoFactorLimiter, twoFactorSetupLimiter, resetCodeLimiter, forgotEmailLimiter, forgotIpLimiter, internoLoginLimiter,
// internoSegundoFactorLimiter. Solo se usa para rotular la medición.
const NOMBRES = ['global', 'ia', 'auth', '2fa', '2fa-setup', 'codigo-reset', 'olvido-correo', 'olvido-ip', 'interno-login', 'interno-2fa'];

/** Pone en cero los contadores de TODOS los limitadores. */
export async function reiniciarLimitadores() {
  await Promise.all(globalThis[CLAVE].map((store) => store.resetAll()));
}

/**
 * Foto de los contadores actuales: por limitador, cada clave con su número de peticiones.
 * @returns {Record<string, Record<string, number>>}
 */
export function contadoresActuales() {
  const foto = {};
  globalThis[CLAVE].forEach((store, i) => {
    const nombre = NOMBRES[i] ?? `store${i}`;
    foto[nombre] = {};
    for (const mapa of [store.previous, store.current]) {
      for (const [clave, cliente] of mapa) foto[nombre][clave] = cliente.totalHits;
    }
  });
  return foto;
}
