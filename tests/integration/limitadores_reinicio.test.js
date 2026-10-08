/**
 * @file limitadores_reinicio.test.js
 * @description Guardia del helper `helpers/limitadores.js` (plan 21, R0). Ese helper reinicia los
 * contadores de los limitadores registrando los `MemoryStore` de express-rate-limit; si una
 * actualización de la librería cambia esos internos, el reinicio dejaría de funcionar en silencio
 * y las pruebas volverían a compartir contadores entre archivos. Esta prueba lo hace ruidoso.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { contadoresActuales, reiniciarLimitadores } from './helpers/limitadores.js';

describe('reinicio de los contadores de los limitadores', () => {
  it('registra los 8 limitadores de middleware/rateLimiter.js', () => {
    expect(Object.keys(contadoresActuales())).toEqual(['global', 'ia', 'auth', '2fa', '2fa-setup', 'codigo-reset', 'olvido-correo', 'olvido-ip']);
  });

  it('reiniciarLimitadores() devuelve el límite global a su valor inicial', async () => {
    await reiniciarLimitadores();
    const primera = await request(app).get('/api/csrf-token');
    const segunda = await request(app).get('/api/csrf-token');
    expect(primera.headers['ratelimit-limit']).toBeDefined();
    expect(Number(segunda.headers['ratelimit-remaining']))
      .toBe(Number(primera.headers['ratelimit-remaining']) - 1);
    expect(Object.keys(contadoresActuales().global).length).toBeGreaterThan(0);

    await reiniciarLimitadores();
    expect(contadoresActuales().global).toEqual({});
    const tras = await request(app).get('/api/csrf-token');
    expect(tras.headers['ratelimit-remaining']).toBe(primera.headers['ratelimit-remaining']);
  });
});
