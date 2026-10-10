import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import readline from 'node:readline/promises';
import entradaOculta from '../../services/interno/entradaOculta.js';

/**
 * `npm run equipo:crear` pide la contraseña sin eco. La primera versión silenciaba el eco con `rl._writeToOutput` y escribía
 * el aviso con process.stdout.write antes de rl.question(''). En Node 24 ese gancho ya no existe, así que (1) la contraseña
 * se veía al teclearla y (2) readline, al pedir la línea, vuelve a la columna 0 y borra hacia abajo: el aviso desaparecía y
 * la pantalla parecía quedarse en «Usuario» (9-oct-2026; las pruebas del script usaban entrada por tubería y no lo vieron).
 *
 * Aquí se usa un readline REAL en modo terminal con flujos falsos y se mira lo que se pinta: el aviso sale DESPUÉS del último
 * borrado de pantalla, y lo que se teclea no aparece.
 */
const { crearEntrada } = entradaOculta;
const BORRAR_PANTALLA_ABAJO = '\x1b[0J';
const AVISO = 'Contraseña (mínimo 12 caracteres): ';
const SECRETO = 'la-clave-secreta-123';

/** Flujos falsos: `teclear` simula al usuario y `pintado()` junta lo que llegaría a la pantalla. */
function pantallaFalsa({ terminal }) {
  const input = new PassThrough();
  const output = new PassThrough();
  if (terminal) {
    input.isTTY = true;
    input.setRawMode = () => input;
    output.isTTY = true;
    output.columns = 80;
  }
  let pintado = '';
  output.on('data', (d) => { pintado += d.toString('utf8'); });
  const escribir = terminal ? (t) => input.write(t) : (t) => input.write(t.replace(/\r/g, '\n'));
  return { input, output, teclear: escribir, pintado: () => pintado };
}

/** La implementación que falló, solo como referencia para comprobar que la prueba detecta el defecto. */
function preguntarOcultoAnterior(rl, pregunta, output) {
  return new Promise((resolver) => {
    const salidaOriginal = rl._writeToOutput;
    output.write(pregunta); // antes: process.stdout.write(pregunta), la misma pantalla que usa readline
    rl._writeToOutput = () => {};
    rl.question('').then((texto) => { rl._writeToOutput = salidaOriginal; resolver(texto); });
  });
}

describe('crearEntrada().preguntarOculto (contraseñas de npm run equipo:crear)', () => {
  it('muestra el aviso, no muestra lo que se teclea y devuelve lo escrito', async () => {
    const p = pantallaFalsa({ terminal: true });
    const e = crearEntrada({ input: p.input, output: p.output });
    const respuesta = e.preguntarOculto(AVISO);
    p.teclear(`${SECRETO}\r`);
    expect(await respuesta).toBe(SECRETO);
    expect(p.pintado()).toContain(AVISO);
    expect(p.pintado()).not.toContain('secret'); // ni siquiera una parte de lo tecleado
    expect(p.pintado()).not.toContain(SECRETO.slice(0, 4));
    e.cerrar();
  });

  it('el aviso sale DESPUÉS del último borrado de pantalla (si no, readline lo borra y la pantalla parece detenida)', async () => {
    const p = pantallaFalsa({ terminal: true });
    const e = crearEntrada({ input: p.input, output: p.output });
    const respuesta = e.preguntarOculto(AVISO);
    p.teclear('otra-clave-123\r');
    await respuesta;
    const pintado = p.pintado();
    expect(pintado.lastIndexOf(BORRAR_PANTALLA_ABAJO)).toBeLessThan(pintado.lastIndexOf(AVISO));
    e.cerrar();
  });

  it('contraseña y repetición seguidas funcionan, y el eco vuelve en las preguntas normales', async () => {
    const p = pantallaFalsa({ terminal: true });
    const e = crearEntrada({ input: p.input, output: p.output });
    const primera = e.preguntarOculto('Contraseña: ');
    p.teclear('clave-uno-12345\r');
    expect(await primera).toBe('clave-uno-12345');
    const segunda = e.preguntarOculto('Repite: ');
    p.teclear('clave-uno-12345\r');
    expect(await segunda).toBe('clave-uno-12345');
    const normal = e.preguntar('Nombre: ');
    p.teclear('Luis\r');
    expect(await normal).toBe('Luis');
    expect(p.pintado()).toContain('Luis'); // una pregunta normal sí muestra lo que se escribe
    expect(p.pintado()).not.toContain('clave-uno');
    e.cerrar();
  });

  it('tras cada contraseña el cursor baja a la línea siguiente (la pregunta que sigue no queda pegada)', async () => {
    const p = pantallaFalsa({ terminal: true });
    const e = crearEntrada({ input: p.input, output: p.output });
    const respuesta = e.preguntarOculto('Contraseña: ');
    p.teclear('clave-uno-12345\r');
    await respuesta;
    expect(p.pintado().endsWith('\n')).toBe(true);
    e.cerrar();
  });

  it('sin terminal (entrada por tubería, como en las pruebas del script) pregunta normal y devuelve lo escrito', async () => {
    const p = pantallaFalsa({ terminal: false });
    const e = crearEntrada({ input: p.input, output: p.output });
    const respuesta = e.preguntarOculto(AVISO);
    p.teclear('desde-tuberia\r');
    expect(await respuesta).toBe('desde-tuberia');
    expect(p.pintado()).toContain(AVISO);
    e.cerrar();
  });

  it('REFERENCIA: la implementación anterior borraba el aviso y dejaba ver lo tecleado (así se comprobó el defecto)', async () => {
    const p = pantallaFalsa({ terminal: true });
    const rl = readline.createInterface({ input: p.input, output: p.output, terminal: true });
    const respuesta = preguntarOcultoAnterior(rl, AVISO, p.output);
    p.teclear('visible-123\r');
    await respuesta;
    const pintado = p.pintado();
    // 1) El aviso se escribió y DESPUÉS readline borró la pantalla desde la columna 0: en una terminal real desaparece.
    expect(pintado.lastIndexOf(BORRAR_PANTALLA_ABAJO)).toBeGreaterThan(pintado.lastIndexOf(AVISO));
    // 2) En esta versión de Node el gancho no existe: el eco no se silenció.
    expect(pintado).toContain('visible-123');
    rl.close();
  });
});
