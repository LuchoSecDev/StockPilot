/**
 * @file refrescoAlEntrar.js
 * @description Recalcula las alertas de una tienda cuando alguien entra a la app.
 *
 * Las alertas del Monitor, la campanita y el Dashboard son una foto guardada en la tabla `Alertas`; el Catálogo, en
 * cambio, calcula el nivel de cada producto al abrirse. La foto solo se actualizaba con una venta, un movimiento de
 * inventario, crear o editar un producto, recibir una orden o el botón «Actualizar Alertas». Así, al entrar a la app, el
 * Dashboard podía decir «Inventario Óptimo» mientras el Catálogo mostraba productos críticos (10-oct-2026; decisión de Luis:
 * recalcular al ingresar).
 *
 * Esto se ejecuta DESPUÉS de autenticar (nunca antes: un visitante sin sesión no puede disparar el motor) y no debe poner en
 * riesgo el inicio de sesión: un fallo del motor se registra y se deja entrar; una tienda grande no demora el login más de
 * `esperaMaxMs` (el cálculo sigue en segundo plano, con el candado por tienda que ya tiene `Alert.generate`).
 *
 * @module services/alertas/refrescoAlEntrar
 */

const ESPERA_MAXIMA_MS = 3000;

/**
 * @param {number|null|undefined} tiendaId
 * @param {Object} [opciones]
 * @param {(tiendaId:number) => Promise<any>} [opciones.generar] - Por defecto `Alert.generate` (inyectable para las pruebas).
 * @param {number} [opciones.esperaMaxMs] - Máximo que se espera antes de dejar entrar.
 * @param {(mensaje:string, error?:any) => void} [opciones.registrarError]
 * @returns {Promise<{estado: 'listo'|'error'|'espera_agotada'|'omitido'}>} Nunca lanza.
 */
async function refrescarAlertasAlEntrar(tiendaId, { generar, esperaMaxMs = ESPERA_MAXIMA_MS, registrarError = console.error } = {}) {
    if (tiendaId === undefined || tiendaId === null) return { estado: 'omitido' };

    // `Alert` se carga aquí y no arriba para que las pruebas unitarias del servicio no abran la base de datos.
    const motor = generar || ((id) => require('../../models/Alert').generate(id));
    const trabajo = Promise.resolve().then(() => motor(tiendaId));
    // Único lugar donde se registra el fallo (llegue antes o DESPUÉS de agotada la espera): sin este manejador, un fallo
    // tardío quedaría como rechazo sin atender y tumbaría el servidor.
    trabajo.catch((error) => registrarError('Error recalculando alertas al entrar:', error));

    let temporizador;
    const limite = new Promise((resolver) => { temporizador = setTimeout(() => resolver({ estado: 'espera_agotada' }), esperaMaxMs); });
    try {
        return await Promise.race([trabajo.then(() => ({ estado: 'listo' })), limite]);
    } catch {
        return { estado: 'error' };
    } finally {
        clearTimeout(temporizador);
    }
}

module.exports = { refrescarAlertasAlEntrar, ESPERA_MAXIMA_MS };
