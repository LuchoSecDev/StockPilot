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
      // 2026-10-08 tras cerrar R1 del plan 21 (18,33% statements / 25,45% branches / 35,07%
      // functions / 17,10% lines) — solo `npm test`/`test:coverage` (unitarias). Antes del 8-oct
      // era 10/15/19/9 (medido el 2026-09-27, plan 20). Las pruebas de integración de
      // tests/integration/ (npm run test:integration) cubren bastante más código real (69%
      // de las sentencias; 73,5% combinadas con las unitarias, ver `npm run
      // test:coverage:combinada`) pero esa suite queda excluida de este `include` a propósito
      // (arriba) y no se mide acá. Si este número baja sin que sea por mover código a
      // tests/integration/, es una regresión real de cobertura unitaria. Regla del plan 21
      // (sección 3): al agregar pruebas unitarias estos pisos se SUBEN, nunca se bajan.
      thresholds: {
        statements: 17,
        branches: 23,
        functions: 32,
        lines: 15
      }
    }
  }
});
