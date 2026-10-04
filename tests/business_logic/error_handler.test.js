import { describe, it, expect, vi, afterEach } from 'vitest';

// El manejador global usa el logger (pino): se simula para no ensuciar la salida ni depender de él.
vi.mock('../../utils/logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import multer from 'multer';
import errorHandlerModule from '../../middleware/errorHandler.js';

const { manejadorErrores, respuestaDeErrorHttp } = errorHandlerModule;

function resFalsa() {
  const res = { statusCode: null, cuerpo: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.cuerpo = b; return res; };
  return res;
}
const manejar = (err) => {
  const res = resFalsa();
  manejadorErrores(err, { originalUrl: '/api/x', method: 'POST' }, res, () => {});
  return res;
};
const errorHttp = (status, message, extra = {}) => Object.assign(new Error(message), { status, statusCode: status, expose: true, ...extra });
const NODE_ENV_ORIGINAL = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = NODE_ENV_ORIGINAL; });

describe('manejadorErrores (middleware/errorHandler.js)', () => {
  it('C4: un CSRF inválido (ForbiddenError de csrf-sync) responde 403 con code CSRF_INVALID, no 500', () => {
    const res = manejar(errorHttp(403, 'invalid csrf token', { type: undefined }));
    expect(res.statusCode).toBe(403);
    expect(res.cuerpo).toEqual({ success: false, code: 'CSRF_INVALID', error: expect.stringMatching(/csrf-token/) });
  });

  it('el CSRF responde igual en producción: el mensaje no depende de NODE_ENV (antes el 500 se ocultaba tras un texto genérico)', () => {
    process.env.NODE_ENV = 'production';
    const res = manejar(errorHttp(403, 'invalid csrf token'));
    expect(res.statusCode).toBe(403);
    expect(res.cuerpo.code).toBe('CSRF_INVALID');
  });

  it('JSON mal formado → 400; cuerpo demasiado grande → 413; cualquier otro 4xx conserva su código con un mensaje genérico', () => {
    expect(manejar(errorHttp(400, 'Unexpected token', { type: 'entity.parse.failed' })).statusCode).toBe(400);
    expect(manejar(errorHttp(400, 'Unexpected token', { type: 'entity.parse.failed' })).cuerpo.error).toMatch(/JSON/);
    expect(manejar(errorHttp(413, 'request entity too large', { type: 'entity.too.large' })).statusCode).toBe(413);
    const otro = manejar(errorHttp(404, 'texto interno de una librería'));
    expect(otro.statusCode).toBe(404);
    expect(otro.cuerpo).toEqual({ success: false, error: 'Solicitud no válida.' }); // no se filtra el mensaje de la librería
  });

  it('un 403 que no es de CSRF no se confunde con él', () => {
    const res = manejar(errorHttp(403, 'otra cosa'));
    expect(res.statusCode).toBe(403);
    expect(res.cuerpo.code).toBeUndefined();
  });

  it('Multer: tamaño excedido → 413; otros errores de Multer → 400', () => {
    const grande = new multer.MulterError('LIMIT_FILE_SIZE');
    expect(manejar(grande).statusCode).toBe(413);
    const otro = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
    expect(manejar(otro).statusCode).toBe(400);
  });

  it('el rechazo del filtro de tipo de archivo sigue siendo 400 con su mensaje', () => {
    const res = manejar(new Error('Tipo de archivo no permitido. Solo .csv y .xlsx'));
    expect(res.statusCode).toBe(400);
    expect(res.cuerpo.error).toMatch(/Tipo de archivo no permitido/);
  });

  it('un error del servidor (sin código HTTP o 5xx) sigue siendo 500: con detalle fuera de producción, genérico en producción', () => {
    process.env.NODE_ENV = 'test';
    const dev = manejar(new Error('falló la base'));
    expect(dev.statusCode).toBe(500);
    expect(dev.cuerpo.error).toBe('Error interno: falló la base');

    process.env.NODE_ENV = 'production';
    const prod = manejar(new Error('falló la base'));
    expect(prod.statusCode).toBe(500);
    expect(prod.cuerpo.error).not.toMatch(/falló la base/);

    expect(manejar(errorHttp(503, 'servicio caído')).statusCode).toBe(500);
  });

  it('respuestaDeErrorHttp: solo toma códigos 400-499 enteros', () => {
    for (const status of [undefined, 200, 302, 399, 500, 'abc', 4.5, null]) {
      expect(respuestaDeErrorHttp({ status, message: 'x' }), String(status)).toBeNull();
    }
    expect(respuestaDeErrorHttp({ statusCode: 422, message: 'x' })).toMatchObject({ status: 422 });
  });
});
