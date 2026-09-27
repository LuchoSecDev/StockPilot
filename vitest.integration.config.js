import { defineConfig } from 'vitest/config';

// Plan 20, Nivel 2: pruebas de integración con Postgres real (stockpilot_test), separadas de las
// unitarias (vitest.config.js). Corren solo con `npm run test:integration`, nunca con `npm test`.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.js'],
    exclude: ['**/node_modules/**', 'dist/**'],
    setupFiles: ['./tests/integration/setupTestDb.js'],
    // Secuencial a propósito: varias pruebas comparten la misma base de datos y algunas ejercitan
    // concurrencia de forma deliberada (varios requests a la vez dentro de UNA prueba); correr
    // archivos de prueba en paralelo entre sí mezclaría datos de pruebas distintas.
    fileParallelism: false,
    // Por defecto Vitest aísla cada archivo de prueba en su propio registro de módulos, así que
    // config/database.js se volvía a `require` (Pool nuevo + su IIFE de auto-migración, que ya de
    // por sí no se espera) una vez por archivo — varios Pools y varias auto-migraciones pegándole
    // a la vez a la misma base, chocando entre sí y con el TRUNCATE del beforeEach del siguiente
    // archivo. Causaba deadlocks reales y violaciones de llave foránea intermitentes, incluso en
    // pruebas que no tocaban ventas (plan 20, Nivel 2, sección 8.9). `isolate: false` hace que
    // todos los archivos compartan un solo registro de módulos — un solo Pool, una sola migración.
    isolate: false,
    testTimeout: 15000
  }
});
