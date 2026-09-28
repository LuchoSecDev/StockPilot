/**
 * @file setupTestDb.js
 * @description Punto de entrada obligatorio de las pruebas de integración (Nivel 2, plan 20).
 * Se registra como `setupFiles` en vitest.integration.config.js, así que corre ANTES que
 * cualquier archivo de prueba y antes de que nada importe `config/database.js` (que se conecta
 * y dispara su auto-migración apenas se lo requiere, sin preguntar — ver plan 20, sección 7).
 *
 * Carga `.env.test` (nunca `.env`) y aborta el proceso si `DATABASE_URL` no es, de forma
 * verificable, una base de pruebas local: dotenv().config() por defecto NO sobrescribe variables
 * de entorno ya definidas, así que si esta validación pasa, `config/database.js` (que se importe
 * después, desde cualquier controller/model) usará esta misma `DATABASE_URL` y no la de `.env`.
 *
 * Además espera a `db.migrationReady` antes de dejar correr cualquier prueba: sin esto, el primer
 * `TRUNCATE` de un `beforeEach` puede chocar con la auto-migración de `config/database.js` a
 * mitad de camino (que además reintenta si falla), causando deadlocks reales y violaciones de
 * llave foránea intermitentes — encontrado en plan 20, Nivel 2, sección 8.9, incluso en archivos
 * de prueba que no tocaban ventas ni nada relacionado.
 *
 * @module tests/integration/setupTestDb
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { beforeAll } from 'vitest';
// Debe importarse antes que cualquier módulo que cargue middleware/rateLimiter.js.
import { reiniciarLimitadores } from './helpers/limitadores.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

const dbUrl = process.env.DATABASE_URL || '';

let parsed = null;
try {
  parsed = new URL(dbUrl);
} catch {
  parsed = null;
}

const host = parsed?.hostname || '';
const nombreBase = (parsed?.pathname || '').replace(/^\//, '');

const esHostLocal = host === 'localhost' || host === '127.0.0.1';
const esBaseDePruebas = nombreBase.endsWith('_test');

if (!esHostLocal || !esBaseDePruebas) {
  throw new Error(
    '[SEGURIDAD] Las pruebas de integración abortaron: DATABASE_URL debe apuntar a un host local ' +
    '(localhost o 127.0.0.1) y el nombre de la base debe terminar en "_test". ' +
    `Recibido: host="${host || '(vacío)'}", base="${nombreBase || '(vacío)'}". ` +
    'Revisa .env.test — nunca debe apuntar a la base de desarrollo ni a producción.'
  );
}

// Import dinámico a propósito: debe ejecutarse DESPUÉS del guard de arriba, nunca antes (un
// `import` estático se evaluaría antes de que dotenv.config() corriera).
const { default: db } = await import('../../config/database.js');
await db.migrationReady;

// Cada archivo de prueba arranca con los contadores de los limitadores en cero (ver
// helpers/limitadores.js): sin esto se acumulan entre archivos porque `isolate: false` comparte
// el proceso, y `RESTART IDENTITY` hace que todas las pruebas usen la misma clave `user_1`.
beforeAll(async () => {
  await reiniciarLimitadores();
});
