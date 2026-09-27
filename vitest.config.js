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
      reporter: ['text', 'html', 'json']
    }
  }
});
