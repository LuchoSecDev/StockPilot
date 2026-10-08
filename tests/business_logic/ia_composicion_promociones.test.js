import { describe, it, expect } from 'vitest';
import { componerPromociones } from '../../services/ia/composicionPromociones.js';

const AHORA = new Date('2026-10-08T12:00:00Z');
const enDias = (n) => new Date(AHORA.getTime() + n * 86400000).toISOString();

const candidato = (overrides = {}) => ({
  id: 1, nombre: 'Yogur', stock: 20, precio: 1000, fecha_vencimiento: null,
  ...overrides
});

const deLaIA = (overrides = {}) => ({
  id: 1, type: 'descuento', title: 'Promo', reason: 'Motivo', duration_days: 10,
  complementary_name: null, discount: 15,
  ...overrides
});

describe('componerPromociones: lo que propone la IA', () => {
  it('toma el tipo y el descuento de la IA y calcula el impacto financiero', () => {
    const [p] = componerPromociones([candidato()], [deLaIA()], AHORA);

    expect(p).toMatchObject({
      id: 1, type: 'descuento', discount: 15, productName: 'Yogur',
      originalPrice: 1000, discountedPrice: 850, impact: 17000
    });
  });

  it('un 2x1 sin porcentaje explícito se corrige a 50%', () => {
    const [p] = componerPromociones([candidato()], [deLaIA({ type: '2x1', discount: 0 })], AHORA);
    expect(p.discount).toBe(50);
    expect(p.discountedPrice).toBe(500);
  });

  it('usa el id de la base de datos, no el que devolvió la IA (cuando coinciden con un candidato)', () => {
    const [p] = componerPromociones([candidato({ id: 7 })], [deLaIA({ id: 7 })], AHORA);
    expect(p.id).toBe(7);
  });

  it('descarta lo que la IA propone para un producto que no es candidato', () => {
    const r = componerPromociones([candidato({ id: 1 })], [deLaIA({ id: 999 })], AHORA);
    expect(r).toHaveLength(1);          // el candidato 1 lo cubre el motor de reglas
    expect(r[0].id).toBe(1);
    expect(r[0].title).toBe('Yogur');   // título del fallback = nombre del producto, no el de la IA
  });

  it('isCritical: vence en menos de 10 días', () => {
    const [vencePronto] = componerPromociones([candidato({ fecha_vencimiento: enDias(5) })], [deLaIA()], AHORA);
    const [venceLejos] = componerPromociones([candidato({ fecha_vencimiento: enDias(25) })], [deLaIA()], AHORA);
    const [sinFecha] = componerPromociones([candidato()], [deLaIA()], AHORA);

    expect(vencePronto.isCritical).toBe(true);
    expect(venceLejos.isCritical).toBe(false);
    expect(sinFecha.isCritical).toBeFalsy();
  });
});

describe('componerPromociones: motor de reglas de respaldo', () => {
  it('con la IA caída (lista vacía) las reglas cubren el 100% de los candidatos', () => {
    const candidatos = [
      candidato({ id: 1, fecha_vencimiento: enDias(5) }),
      candidato({ id: 2, fecha_vencimiento: enDias(20) }),
      candidato({ id: 3, stock: 80 }),
      candidato({ id: 4 })
    ];

    const porId = Object.fromEntries(componerPromociones(candidatos, [], AHORA).map(p => [p.id, p]));

    expect(porId[1]).toMatchObject({ type: 'liquidacion', discount: 25, isCritical: true });
    expect(porId[2]).toMatchObject({ type: 'descuento', discount: 15, isCritical: false });
    expect(porId[3]).toMatchObject({ type: 'combo', discount: 10, isCritical: false });
    expect(porId[4]).toMatchObject({ type: 'descuento', discount: 15, isCritical: false });
  });

  it('completa solo lo que la IA omitió, sin duplicar lo que ya cubrió', () => {
    const candidatos = [candidato({ id: 1 }), candidato({ id: 2 })];

    const r = componerPromociones(candidatos, [deLaIA({ id: 1, discount: 20 })], AHORA);

    expect(r.map(p => p.id).sort()).toEqual([1, 2]);
    expect(r.find(p => p.id === 1).discount).toBe(20); // la de la IA se conserva
  });

  it('sin candidatos no hay promociones', () => {
    expect(componerPromociones([], [], AHORA)).toEqual([]);
  });
});
