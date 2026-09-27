/**
 * @file run_evidence.js
 * @description Orquesta `npm run test:evidence`: corre las pruebas unitarias (obligatorio — si
 * fallan, no se genera nada) y después, en un paso aparte que puede fallar sin bloquear el resto,
 * las de integración (necesitan `stockpilot_test` disponible y `.env.test` configurado) — cada
 * una con su propio reporte JSON — y termina generando el certificado combinado con
 * `generar_reporte.js`.
 *
 * Es un script de Node, no una cadena de `&&`/`||` en package.json, porque esa cadena se
 * comporta distinto en cmd.exe que en bash, y "que la integración pueda fallar sin tumbar el
 * reporte" es justo el comportamiento que una cadena de `&&` plana no da de forma portable.
 *
 * @module scripts/run_evidence
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

function correr(args, etiqueta) {
  console.log(`\n▶️  ${etiqueta}...`);
  // Un solo string (no args[] aparte) para que Node no avise del riesgo de args sin escapar con
  // shell:true — acá no aplica (todos los argumentos son fijos, ninguno viene de afuera), pero
  // así se corre sin el warning.
  const result = spawnSync(args.join(' '), { stdio: 'inherit', shell: true, cwd: root });
  return result.status === 0;
}

const okUnitarias = correr(
  ['vitest', 'run', '--reporter=verbose', '--reporter=json', '--outputFile=evidencia_pruebas.json'],
  'Corriendo pruebas unitarias'
);

if (!okUnitarias) {
  console.error('\n❌ Las pruebas unitarias fallaron. No se genera el reporte.');
  process.exit(1);
}

const okIntegracion = correr(
  [
    'vitest', 'run',
    '--config', 'vitest.integration.config.js',
    '--reporter=verbose', '--reporter=json', '--outputFile=evidencia_pruebas_integration.json'
  ],
  'Corriendo pruebas de integración (necesita stockpilot_test disponible)'
);

if (!okIntegracion) {
  console.warn(
    '\n⚠️  Las pruebas de integración fallaron o no se pudieron correr ' +
    '(¿stockpilot_test disponible? ¿.env.test configurado?). ' +
    'El reporte se genera solo con las unitarias.'
  );
}

console.log('\n▶️  Generando reporte Markdown...');
require(path.join(root, 'generar_reporte.js'));
