import { describe, it, expect } from 'vitest';
import canalModule from '../../utils/canal.js';

const { canalDesdeCabecera, canalDeSesion } = canalModule;
const reqConCabecera = (valor) => ({ get: (nombre) => (nombre.toLowerCase() === 'x-canal' ? valor : undefined) });

describe('utils/canal.js', () => {
  it('canalDesdeCabecera: solo «app» (sin importar mayúsculas ni espacios) es app; todo lo demás es web', () => {
    for (const v of ['app', 'APP', ' App ', '\tapp\n']) expect(canalDesdeCabecera(reqConCabecera(v)), JSON.stringify(v)).toBe('app');
    for (const v of ['web', 'xyz', '', ' ', 'app2', 'aplicacion', undefined, null]) expect(canalDesdeCabecera(reqConCabecera(v)), JSON.stringify(v)).toBe('web');
  });

  it('canalDeSesion: las sesiones sin canal (anteriores al cambio) son web', () => {
    expect(canalDeSesion({ canal: 'app' })).toBe('app');
    expect(canalDeSesion({ canal: 'web' })).toBe('web');
    expect(canalDeSesion({})).toBe('web');
    expect(canalDeSesion(undefined)).toBe('web');
    expect(canalDeSesion({ canal: 'otro' })).toBe('web');
  });
});
