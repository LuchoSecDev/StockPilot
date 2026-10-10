/**
 * @file entradaOculta.js
 * @description Preguntas por consola con readline, y una variante SIN ECO para contraseñas (`npm run equipo:crear`).
 *
 * Por qué existe (9-oct-2026): la primera versión silenciaba el eco reemplazando `rl._writeToOutput` y escribía el aviso con
 * `process.stdout.write` antes de `rl.question('')`. En Node 24 ese gancho ya no existe (`rl._writeToOutput` es undefined),
 * así que (1) el eco NO se silenciaba y (2) readline, al pedir la línea, vuelve a la columna 0 y borra hacia abajo, con lo que
 * el aviso de la contraseña desaparecía: la pantalla parecía detenida en «Usuario» y lo que se tecleaba se veía.
 * Ahora la salida de readline pasa por un Writable propio que se puede silenciar: no depende de ninguna pieza interna de
 * readline. El aviso lo escribe el propio `rl.question` (con el eco normal) y solo DESPUÉS se silencia lo que se teclea.
 *
 * @module services/interno/entradaOculta
 */
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');

/**
 * @param {{input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream}} [flujos] - Por defecto stdin y stdout.
 * @returns {{rl: import('node:readline/promises').Interface, preguntar: (p: string) => Promise<string>,
 *   preguntarOculto: (p: string) => Promise<string>, cerrar: () => void}}
 */
function crearEntrada({ input = process.stdin, output = process.stdout } = {}) {
    const esTTY = Boolean(input.isTTY);
    let silenciado = false;
    const salida = new Writable({
        write(trozo, _codificacion, listo) {
            if (!silenciado) output.write(trozo);
            listo();
        }
    });
    // readline decide si hay terminal y cuántas columnas tiene mirando estas propiedades de la salida.
    salida.isTTY = Boolean(output.isTTY);
    salida.columns = output.columns;
    salida.rows = output.rows;

    const rl = readline.createInterface({ input, output: salida, terminal: esTTY });

    return {
        rl,
        preguntar: (pregunta) => rl.question(pregunta),
        /** Sin terminal (entrada por tubería, como en las pruebas del script) pregunta normal. */
        preguntarOculto(pregunta) {
            if (!esTTY) return rl.question(pregunta);
            const respuesta = rl.question(pregunta); // escribe el aviso AHORA, de forma síncrona, con el eco normal
            silenciado = true; // desde aquí, lo que se teclea no se pinta
            return respuesta.finally(() => {
                silenciado = false;
                output.write('\n'); // readline escribió su salto de línea mientras estaba silenciado
            });
        },
        cerrar: () => rl.close()
    };
}

module.exports = { crearEntrada };
