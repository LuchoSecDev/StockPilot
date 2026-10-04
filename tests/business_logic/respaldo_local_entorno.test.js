import { describe, it, expect } from 'vitest';
import backup from '../../utils/backup.js';

const { debeProgramarRespaldoLocal } = backup;

// utils/backup.js no tiene dependencias pesadas (solo child_process/fs/path), así que se puede
// importar y probar directo, sin mockear cron/db/mailer — a diferencia de una prueba que importara
// services/schedulerService.js, que sí las arrastra todas.
describe('debeProgramarRespaldoLocal(): si el cron interno de respaldo debe programarse', () => {
  it('en producción, no', () => {
    expect(debeProgramarRespaldoLocal('production')).toBe(false);
  });

  it('fuera de producción (test, development, undefined), sí', () => {
    expect(debeProgramarRespaldoLocal('test')).toBe(true);
    expect(debeProgramarRespaldoLocal('development')).toBe(true);
    expect(debeProgramarRespaldoLocal(undefined)).toBe(true);
  });

  it('sin argumento, usa process.env.NODE_ENV', () => {
    const original = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(debeProgramarRespaldoLocal()).toBe(false);
      process.env.NODE_ENV = 'test';
      expect(debeProgramarRespaldoLocal()).toBe(true);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});
