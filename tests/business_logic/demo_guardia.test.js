import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import seedModulo from '../../database/seed_demo.js';

/**
 * Plan 25, fase 1. `npm run demo:sembrar` VACÍA todas las tablas de la app de la base a la que apunte su DATABASE_URL
 * (la de `.env.demo`). Solo es seguro porque se niega a correr salvo contra una base LOCAL cuyo nombre termine en
 * `_demo`. Aquí se comprueba esa negativa, tanto en la función pura como con el script como proceso real (sin
 * conectarse a nada: puerto 1 y credenciales falsas). Mismo patrón que guardia_semilla.test.js.
 */
const { evaluarGuardiaDemo } = seedModulo;
const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database/seed_demo.js');

describe('evaluarGuardiaDemo (función pura)', () => {
  it('acepta una base local cuyo nombre termina en _demo', () => {
    expect(evaluarGuardiaDemo('postgresql://u:p@localhost:5432/stockpilot_demo').ok).toBe(true);
    expect(evaluarGuardiaDemo('postgresql://u:p@127.0.0.1:5432/otra_demo').ok).toBe(true);
  });

  it('rechaza las bases de desarrollo y de pruebas aunque sean locales (no terminan en _demo)', () => {
    for (const base of ['stockpilot', 'stockpilot_test', 'demo', 'stockpilot_demo2', 'stockpilot_demo_test']) {
      const r = evaluarGuardiaDemo(`postgresql://u:p@localhost:5432/${base}`);
      expect(r.ok, base).toBe(false);
      expect(r.motivo).toMatch(/_demo/);
    }
  });

  it('rechaza cualquier host remoto, incluso con el nombre correcto, y las URL ausentes o inválidas', () => {
    expect(evaluarGuardiaDemo('postgresql://u:p@ep-prueba-123.us-east-2.aws.neon.tech/stockpilot_demo').ok).toBe(false);
    expect(evaluarGuardiaDemo('postgresql://u:p@localhost.evil.com/stockpilot_demo').ok).toBe(false);
    expect(evaluarGuardiaDemo(undefined).ok).toBe(false);
    expect(evaluarGuardiaDemo('esto no es una url').ok).toBe(false);
  });
});

describe('npm run demo:sembrar: el script se niega a correr (proceso real, sin conectarse a nada)', () => {
  const correr = (databaseUrl, extra = {}) => spawnSync(process.execPath, [script], {
    env: { ...process.env, DATABASE_URL: databaseUrl, DEMO_PASSWORD: 'ClaveDeLaDemo123!', ...extra },
    encoding: 'utf8', timeout: 20000
  });

  it.each([
    ['la base de desarrollo local', 'postgresql://falso:falso@localhost:1/stockpilot', /_demo/],
    ['la base de pruebas', 'postgresql://falso:falso@localhost:1/stockpilot_test', /_demo/],
    ['una base remota (tipo Neon)', 'postgresql://falso:falso@ep-prueba-123.us-east-2.aws.neon.tech:1/stockpilot_demo', /no es local/],
  ])('con %s aborta con código 1 y sin cargar la base', (_nombre, url, motivo) => {
    const r = correr(url);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Siembra de demostración abortada/);
    expect(r.stderr).toMatch(motivo);
    expect(r.stdout).not.toMatch(/Auto-migration|Sembrando/);
  });

  it('sin DEMO_PASSWORD aborta con código 1 antes de tocar la base (nunca se siembra una cuenta sin clave)', () => {
    const r = correr('postgresql://falso:falso@localhost:1/stockpilot_demo', { DEMO_PASSWORD: '' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/DEMO_PASSWORD/);
    expect(r.stdout).not.toMatch(/Auto-migration|Sembrando/);
  });
});
