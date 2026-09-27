import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', 'dist/**', 'tests/e2e/**', 'tests/integration/**'],
    coverage: {
      provider: 'v8',
      // Plan 20: cobertura de TODO el backend, no de un puñado de archivos elegidos a mano —
      // así el número que se reporte es siempre el real. scripts/, database/ y config/ quedan
      // fuera a propósito (migraciones, semillas y arranque de infraestructura, no lógica de
      // negocio) y no forman parte de include, así que ya quedan excluidos por defecto.
      include: [
        'controllers/**/*.js',
        'models/**/*.js',
        'middleware/**/*.js',
        'utils/**/*.js',
        'services/**/*.js'
      ],
      reporter: ['text', 'html', 'json'],
      // Piso de regresión, no una meta: fijado un poco por debajo de la cobertura real medida el
      // 2026-09-27 tras cerrar el plan 20 (10,53% statements / 15,69% branches / 19,55% functions
      // / 9,75% lines) — solo `npm test`/`test:coverage` (unitarias); las 47 pruebas de
      // integración de tests/integration/ (npm run test:integration) cubren bastante más código
      // real (p. ej. Alert.generate/findActive, requireLogin/requireAdmin, la mayoría de
      // middleware/validation.js) pero esa suite queda excluida de este `include` a propósito
      // (arriba) y no se mide acá. Si este número baja sin que sea por mover código a
      // tests/integration/, es una regresión real de cobertura unitaria.
      thresholds: {
        statements: 10,
        branches: 15,
        functions: 19,
        lines: 9
      }
    }
  }
});
