/**
 * @file cobertura_combinada.mjs
 * @description Cobertura del backend con las dos suites juntas (plan 21, R0). `npm run test:coverage`
 * mide solo las unitarias (`tests/integration/**` está excluido de vitest.config.js a propósito),
 * pero las pruebas de integración cubren mucho más código real. Este script corre las dos suites
 * con cobertura v8, une los dos `coverage-final.json` (suma de contadores por sentencia, función y
 * rama) y muestra unitarias, integración y combinada sobre el MISMO conjunto de archivos: el
 * `coverage.include` de vitest.config.js (única fuente de verdad, no se duplica aquí).
 *
 * Uso: `npm run test:coverage:combinada`. Requiere `stockpilot_test` (lo mismo que
 * `npm run test:integration`). Los reportes quedan en `coverage/combinada/` (ignorado por git).
 *
 * La cifra NO es exactamente reproducible: el provider v8 varía unas ±4 sentencias entre corridas
 * del mismo código (temporizadores y trabajo en segundo plano). Por eso los planes citan un rango
 * medido en varias corridas, no un número único.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Une dos `coverage-final.json` sumando contadores. Falla si un archivo cambió de forma. */
export function fusionar(a, b) {
  const salida = {};
  for (const archivo of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[archivo];
    const y = b[archivo];
    if (!x || !y) {
      salida[archivo] = structuredClone(x || y);
      continue;
    }
    const mismaForma =
      Object.keys(x.s).length === Object.keys(y.s).length &&
      Object.keys(x.f).length === Object.keys(y.f).length &&
      Object.keys(x.b).length === Object.keys(y.b).length;
    if (!mismaForma) {
      throw new Error(`cobertura_combinada: ${archivo} tiene sentencias/funciones/ramas distintas en las dos corridas; no se puede unir.`);
    }
    const copia = structuredClone(x);
    for (const k of Object.keys(y.s)) copia.s[k] += y.s[k];
    for (const k of Object.keys(y.f)) copia.f[k] += y.f[k];
    for (const k of Object.keys(y.b)) copia.b[k] = copia.b[k].map((n, i) => n + y.b[k][i]);
    salida[archivo] = copia;
  }
  return salida;
}

/** Totales cubiertos/total de sentencias, ramas, funciones y líneas (mismas reglas que istanbul). */
export function resumir(cobertura) {
  const t = { statements: [0, 0], branches: [0, 0], functions: [0, 0], lines: [0, 0] };
  for (const c of Object.values(cobertura)) {
    for (const n of Object.values(c.s)) { t.statements[1]++; if (n > 0) t.statements[0]++; }
    for (const n of Object.values(c.f)) { t.functions[1]++; if (n > 0) t.functions[0]++; }
    for (const ramas of Object.values(c.b)) for (const n of ramas) { t.branches[1]++; if (n > 0) t.branches[0]++; }
    const lineas = {};
    for (const [k, n] of Object.entries(c.s)) {
      const linea = c.statementMap[k]?.start.line;
      if (linea === undefined) continue;
      if (lineas[linea] === undefined || lineas[linea] < n) lineas[linea] = n;
    }
    for (const n of Object.values(lineas)) { t.lines[1]++; if (n > 0) t.lines[0]++; }
  }
  return t;
}

const formato = ([cubiertas, total]) => `${cubiertas}/${total} (${(100 * cubiertas / total).toFixed(2).replace('.', ',')} %)`;

function correrVitest(args) {
  const bin = path.join(raiz, 'node_modules', 'vitest', 'vitest.mjs'); // `exports` de vitest no publica este archivo
  const r = spawnSync(process.execPath, [bin, 'run', ...args], { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0) {
    process.stderr.write((r.stdout || '') + (r.stderr || ''));
    throw new Error(`cobertura_combinada: vitest ${args.join(' ')} terminó con código ${r.status}`);
  }
  return (r.stdout || '').match(/^\s*Tests\s+(.+)$/m)?.[1]?.trim() ?? '?';
}

async function main() {
  // vitest.config.js es ESM dentro de un paquete CommonJS: Node no lo importa directo, Vite sí lo carga.
  const { loadConfigFromFile } = await import('vite');
  const { config } = await loadConfigFromFile({ command: 'build', mode: 'test' }, path.join(raiz, 'vitest.config.js'));
  const incluir = config.test.coverage.include;
  const base = path.join(raiz, 'coverage', 'combinada');
  fs.rmSync(base, { recursive: true, force: true });
  const dirUnit = path.join(base, 'unitarias');
  const dirInteg = path.join(base, 'integracion');

  const comunes = ['--coverage', '--coverage.reporter=json'];
  const pruebasUnit = correrVitest([...comunes, `--coverage.reportsDirectory=${dirUnit}`]);
  const pruebasInteg = correrVitest([
    '--config', 'vitest.integration.config.js', ...comunes,
    ...incluir.map((p) => `--coverage.include=${p}`),
    `--coverage.reportsDirectory=${dirInteg}`
  ]);

  const leer = (d) => JSON.parse(fs.readFileSync(path.join(d, 'coverage-final.json'), 'utf8'));
  const unit = leer(dirUnit);
  const integ = leer(dirInteg);
  const filas = { 'Unitarias': resumir(unit), 'Integración': resumir(integ), 'Combinada': resumir(fusionar(unit, integ)) };

  console.log(`Pruebas unitarias: ${pruebasUnit} · integración: ${pruebasInteg}`);
  console.log(`Archivos medidos: ${Object.keys(unit).length} (coverage.include de vitest.config.js)\n`);
  for (const [nombre, t] of Object.entries(filas)) {
    console.log(`${nombre.padEnd(12)} sentencias ${formato(t.statements)} · ramas ${formato(t.branches)} · funciones ${formato(t.functions)} · líneas ${formato(t.lines)}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
