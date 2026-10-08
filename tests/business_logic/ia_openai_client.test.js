import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { openaiClient, MODELO, asegurarApiKey, pedirJSON } from '../../services/ia/openaiClient.js';

// Los errores se cargan con `require`, igual que lo hace openaiClient.js: con `import`, Vitest
// crea una SEGUNDA copia del módulo CJS y `instanceof` compararía dos clases distintas (en
// producción solo hay una copia, así que esto es una particularidad del entorno de pruebas).
const require = createRequire(import.meta.url);
const { IANoConfiguradaError, RecursoNoEncontradoError } = require('../../services/errores.js');

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('asegurarApiKey', () => {
  it('lanza IANoConfiguradaError si no hay clave', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => asegurarApiKey()).toThrow(IANoConfiguradaError);
  });

  it('lanza si la clave sigue siendo el valor de ejemplo del .env', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-tuLlaveSecretaAqui');
    expect(() => asegurarApiKey()).toThrow(IANoConfiguradaError);
  });

  it('con una clave real no lanza', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-proj-abc123');
    expect(() => asegurarApiKey()).not.toThrow();
  });

  it('el mensaje es el mismo que ya veía el frontend', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(() => asegurarApiKey()).toThrow('La API Key de OpenAI no está configurada correctamente en el archivo .env.');
  });
});

describe('errores de dominio', () => {
  it('se distinguen por clase, no por el texto del mensaje', () => {
    const noEncontrado = new RecursoNoEncontradoError('Cliente no encontrado');
    expect(noEncontrado).toBeInstanceOf(RecursoNoEncontradoError);
    expect(noEncontrado).not.toBeInstanceOf(IANoConfiguradaError);
    expect(noEncontrado).toBeInstanceOf(Error);
    expect(noEncontrado.message).toBe('Cliente no encontrado');
  });
});

describe('pedirJSON', () => {
  const simular = (contenido) => vi.spyOn(openaiClient.chat.completions, 'create')
    .mockResolvedValue({ choices: [{ message: { content: contenido } }] });

  it('pide modo JSON con el modelo único y devuelve la respuesta ya parseada', async () => {
    const spy = simular('{"ok": true}');
    const mensajes = [{ role: 'user', content: 'hola' }];

    const r = await pedirJSON({ messages: mensajes });

    expect(r).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual({ model: MODELO, messages: mensajes, response_format: { type: 'json_object' } });
  });

  it('solo envía temperature cuando el caso de uso la fija', async () => {
    const spy = simular('{}');
    await pedirJSON({ messages: [], temperature: 0.1 });
    await pedirJSON({ messages: [] });
    expect(spy.mock.calls[0][0].temperature).toBe(0.1);
    expect('temperature' in spy.mock.calls[1][0]).toBe(false);
  });

  it('si el modelo no responde JSON, falla (el servicio decide cómo degradar)', async () => {
    simular('esto no es json');
    await expect(pedirJSON({ messages: [] })).rejects.toThrow(SyntaxError);
  });

  it('si OpenAI falla, el error se propaga tal cual', async () => {
    vi.spyOn(openaiClient.chat.completions, 'create').mockRejectedValue(new Error('401 clave inválida'));
    await expect(pedirJSON({ messages: [] })).rejects.toThrow('401 clave inválida');
  });
});
