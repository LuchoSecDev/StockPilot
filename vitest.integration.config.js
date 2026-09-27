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
    testTimeout: 15000
  }
});
