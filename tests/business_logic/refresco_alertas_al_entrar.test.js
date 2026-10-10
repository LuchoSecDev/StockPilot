import { describe, it, expect, vi } from 'vitest';
import servicio from '../../services/alertas/refrescoAlEntrar.js';

/**
 * 10-oct-2026. Las alertas del Monitor son una foto guardada que solo se actualiza cuando pasa algo (venta, movimiento de
 * inventario, crear o editar un producto, recibir una orden, el botón «Actualizar Alertas»). Al entrar a la app el
 * Dashboard decía «Inventario Óptimo» aunque el Catálogo mostrara productos críticos. Decisión de Luis: recalcular al
 * ingresar. Este servicio lo hace SIN poner en riesgo el inicio de sesión: un fallo del motor o una tienda grande no
 * pueden impedir ni demorar de más el login (se espera un máximo y el trabajo sigue en segundo plano).
 */
const { refrescarAlertasAlEntrar } = servicio;
const silencio = () => {};

describe('refrescarAlertasAlEntrar', () => {
  it('recalcula las alertas de la tienda que entra y espera a que terminen', async () => {
    let termino = false;
    const generar = vi.fn(async () => { await new Promise((r) => setTimeout(r, 15)); termino = true; return 3; });
    const r = await refrescarAlertasAlEntrar(7, { generar, esperaMaxMs: 500, registrarError: silencio });
    expect(r).toEqual({ estado: 'listo' });
    expect(generar).toHaveBeenCalledTimes(1);
    expect(generar).toHaveBeenCalledWith(7);
    expect(termino).toBe(true); // el Dashboard que se abre después ya ve las alertas nuevas
  });

  it('si el motor falla, NO lanza: avisa en el registro y deja entrar', async () => {
    const registrarError = vi.fn();
    const r = await refrescarAlertasAlEntrar(7, { generar: async () => { throw new Error('boom'); }, esperaMaxMs: 500, registrarError });
    expect(r).toEqual({ estado: 'error' });
    expect(registrarError).toHaveBeenCalledTimes(1);
    expect(String(registrarError.mock.calls[0][0])).toMatch(/alertas al entrar/i);
  });

  it('si el motor lanza de forma síncrona, tampoco rompe el inicio de sesión', async () => {
    const r = await refrescarAlertasAlEntrar(7, { generar: () => { throw new Error('síncrono'); }, esperaMaxMs: 500, registrarError: silencio });
    expect(r).toEqual({ estado: 'error' });
  });

  it('si tarda más de lo permitido, deja entrar sin esperar (y el trabajo sigue en segundo plano)', async () => {
    let terminoDespues = false;
    const generar = () => new Promise((r) => setTimeout(() => { terminoDespues = true; r(1); }, 120));
    const t0 = Date.now();
    const r = await refrescarAlertasAlEntrar(7, { generar, esperaMaxMs: 30, registrarError: silencio });
    expect(r).toEqual({ estado: 'espera_agotada' });
    expect(Date.now() - t0).toBeLessThan(100); // no esperó a los 120 ms
    expect(terminoDespues).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(terminoDespues).toBe(true); // no se canceló
  });

  it('un fallo que llega DESPUÉS de agotar la espera no deja un «unhandled rejection» que tumbe el servidor', async () => {
    const rechazos = [];
    const escuchar = (e) => rechazos.push(e);
    process.on('unhandledRejection', escuchar);
    try {
      const generar = () => new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('tarde')), 60));
      const r = await refrescarAlertasAlEntrar(7, { generar, esperaMaxMs: 15, registrarError: silencio });
      expect(r).toEqual({ estado: 'espera_agotada' });
      await new Promise((resolve) => setTimeout(resolve, 150));
    } finally {
      process.off('unhandledRejection', escuchar);
    }
    expect(rechazos).toEqual([]);
  });

  it('no hace nada (ni pregunta al motor) sin tienda', async () => {
    const generar = vi.fn();
    expect(await refrescarAlertasAlEntrar(undefined, { generar, registrarError: silencio })).toEqual({ estado: 'omitido' });
    expect(await refrescarAlertasAlEntrar(null, { generar, registrarError: silencio })).toEqual({ estado: 'omitido' });
    expect(generar).not.toHaveBeenCalled();
  });
});
