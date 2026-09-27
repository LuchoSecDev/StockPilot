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
 * @module tests/integration/setupTestDb
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

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
