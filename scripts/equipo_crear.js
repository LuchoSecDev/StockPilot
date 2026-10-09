/**
 * @file equipo_crear.js
 * @description Alta de una cuenta del equipo interno (`npm run equipo:crear`). Es la ÚNICA forma de crear cuentas del
 * panel: no hay endpoint de registro (plan 22, 3.1). Interactivo.
 *
 * Seguridad del propio script:
 *   1. ANTES de tocar la base muestra a cuál apunta (servidor y nombre, sin credenciales) y exige escribir el nombre de la
 *      base para confirmar. Este script SÍ está pensado para correr contra producción, así que no puede tener la guardia
 *      de «solo local» de la semilla; la confirmación explícita ocupa su lugar.
 *   2. La contraseña se escribe sin eco (services/interno/entradaOculta.js), se pide dos veces y debe tener al menos 12 caracteres.
 *   3. El segundo factor es obligatorio: se muestra el QR UNA vez y la cuenta NO se guarda hasta que el celular genere un
 *      código válido. Así nadie queda encerrado por un QR mal escaneado.
 *
 * `require('../config/database')` ejecuta la auto-migración de la base destino; por eso solo se carga DESPUÉS de confirmar.
 */
require('dotenv').config();
const qrcode = require('qrcode');
const { crearEntrada } = require('../services/interno/entradaOculta');

const INTENTOS_DEL_CODIGO = 5;

/** Servidor y base del DATABASE_URL, sin usuario ni contraseña. */
function destino() {
  try {
    const u = new URL(process.env.DATABASE_URL);
    return { servidor: u.hostname, base: u.pathname.replace(/^\//, '') };
  } catch {
    return null;
  }
}

async function main() {
  // La contraseña se pide sin eco (ver services/interno/entradaOculta.js y su prueba: el truco anterior no funcionaba en Node 24).
  const entrada = crearEntrada();
  const rl = entrada.rl;
  try {
    const dest = destino();
    if (!dest) throw new Error('DATABASE_URL no está definida o no es válida.');

    console.log('\n=== Alta de una cuenta del equipo interno ===');
    console.log(`Base de datos destino:  ${dest.base}  (servidor: ${dest.servidor})`);
    const confirmacion = (await rl.question(`Para continuar escribe el nombre de la base («${dest.base}»): `)).trim();
    if (confirmacion !== dest.base) {
      console.log('No coincide. No se hizo nada.');
      return 1;
    }

    // Recién ahora se carga el módulo que conecta y migra la base.
    const equipo = require('../services/interno/equipo');
    const db = require('../config/database');
    await db.migrationReady;

    const nombre = (await rl.question('Nombre completo: ')).trim();
    const correo = (await rl.question('Correo: ')).trim();
    const usuario = (await rl.question('Usuario (para iniciar sesión): ')).trim();
    const password = await entrada.preguntarOculto(`Contraseña (mínimo ${equipo.LARGO_MINIMO_CLAVE} caracteres): `);
    const repetida = await entrada.preguntarOculto('Repite la contraseña: ');
    if (password !== repetida) {
      console.log('Las contraseñas no coinciden. No se hizo nada.');
      return 1;
    }

    const secreto = equipo.generarSecreto();
    console.log('\nEscanea este QR con Google Authenticator (se muestra UNA sola vez):\n');
    console.log(await qrcode.toString(equipo.uriOtpauth(correo, secreto), { type: 'terminal', small: true }));
    console.log(`Si no puedes escanear, escribe esta clave a mano en la app:  ${secreto}\n`);

    let verificado = false;
    for (let intento = 1; intento <= INTENTOS_DEL_CODIGO && !verificado; intento++) {
      const codigo = (await rl.question('Escribe el código de 6 dígitos que muestra la app: ')).trim();
      verificado = equipo.codigoEsValido(secreto, codigo);
      if (!verificado) console.log(`Código incorrecto (${intento}/${INTENTOS_DEL_CODIGO}).`);
    }
    if (!verificado) {
      console.log('No se pudo comprobar el segundo factor. La cuenta NO se creó.');
      return 1;
    }

    const { id_equipo } = await equipo.crearMiembro({ nombre, correo, usuario, password, secreto });
    console.log(`\nListo. Cuenta creada (id ${id_equipo}). Entra en /interno con el usuario «${usuario}».`);
    return 0;
  } catch (err) {
    console.error(`\nNo se pudo crear la cuenta: ${err.message}`);
    return 1;
  } finally {
    entrada.cerrar();
  }
}

main().then((codigo) => process.exit(codigo));
