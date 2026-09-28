import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import guardiaModule from '../../database/guardiaSemilla.js';

const { evaluarGuardiaSemilla } = guardiaModule;

// La semilla hace TRUNCATE de toda la base y crea admin/admin123: la guardia es lo único que
// impide que un `npm run seed` con la DATABASE_URL de producción borre los datos reales.

describe('Guardia de la semilla (database/guardiaSemilla.js)', () => {
  it('acepta una base de pruebas local', () => {
    expect(evaluarGuardiaSemilla('postgresql://u:p@localhost:5432/stockpilot_test').ok).toBe(true);
    expect(evaluarGuardiaSemilla('postgresql://u:p@127.0.0.1:5432/stockpilot_test').ok).toBe(true);
    expect(evaluarGuardiaSemilla('postgresql://u:p@[::1]:5432/stockpilot_test').ok).toBe(true);
  });

  it('rechaza cualquier host remoto, incluso si la base se llama _test', () => {
    for (const url of [
      'postgresql://u:p@ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require',
      'postgresql://u:p@dpg-abc123.oregon-postgres.render.com/stockpilot',
      'postgresql://u:p@ep-cool-123.aws.neon.tech/stockpilot_test',
      'postgresql://u:p@10.0.0.5:5432/stockpilot_test'
    ]) {
      const r = evaluarGuardiaSemilla(url, { permitirBaseLocal: true });
      expect(r.ok, url).toBe(false);
      expect(r.motivo).toMatch(/no es local/);
    }
  });

  it('rechaza un host que solo parece local (localhost.evil.com, usuario "localhost@")', () => {
    expect(evaluarGuardiaSemilla('postgresql://u:p@localhost.evil.com/stockpilot_test').ok).toBe(false);
    expect(evaluarGuardiaSemilla('postgresql://localhost:p@evil.com/stockpilot_test').ok).toBe(false);
  });

  it('una base local que no termina en _test exige --base-local', () => {
    const url = 'postgresql://u:p@localhost:5432/stockpilot';
    const sin = evaluarGuardiaSemilla(url);
    expect(sin.ok).toBe(false);
    expect(sin.motivo).toMatch(/--base-local/);
    expect(evaluarGuardiaSemilla(url, { permitirBaseLocal: true }).ok).toBe(true);
  });

  it('rechaza una DATABASE_URL ausente o inválida', () => {
    expect(evaluarGuardiaSemilla(undefined).ok).toBe(false);
    expect(evaluarGuardiaSemilla('').ok).toBe(false);
    expect(evaluarGuardiaSemilla('esto no es una url').ok).toBe(false);
  });
});

describe('npm run seed: el script se niega a correr (proceso real, sin conectarse a nada)', () => {
  const script = path.resolve(__dirname, '../../database/seed_test_data.js');
  // Puerto 1 y credenciales falsas: aunque la guardia fallara, no habría a qué conectarse.
  const correr = (databaseUrl, args = []) => spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    timeout: 20000
  });

  it('con una base remota (tipo Neon) aborta con código 1 y sin cargar la base', () => {
    const r = correr('postgresql://falso:falso@ep-prueba-123.us-east-2.aws.neon.tech:1/neondb', ['--base-local']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Semilla abortada.*no es local/);
    expect(r.stdout).not.toMatch(/Iniciando Seeder/);
  });

  it('con una base local que no es _test y sin --base-local aborta con código 1', () => {
    const r = correr('postgresql://falso:falso@localhost:1/stockpilot');
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Semilla abortada.*--base-local/);
    expect(r.stdout).not.toMatch(/Iniciando Seeder/);
  });
});
