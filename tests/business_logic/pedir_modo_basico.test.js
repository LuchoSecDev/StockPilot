import { describe, it, expect } from 'vitest';
import {
  sugerenciasDePedido, cuerpoParaArmar, ordenesPorAprobar, ordenesPorRecibir,
  pendienteDeLinea, llegadaValida, cuerpoDeRecepcion, quedaraFaltante, MAX_PRODUCTOS_POR_PEDIDO,
} from '../../frontend/src/utils/pedir.js';

const fila = (extra) => ({
  id_producto: 1, id_proveedor: 10, proveedor: 'Distribuidora Sol', nombre: 'Arroz 500g', nivel: 'reponer', urgencia: 'En esta compra',
  cantidad_recomendada: 6, costo_unitario: 2000, costo_estimado: false, stock_actual: 2, ...extra,
});

describe('sugerenciasDePedido: qué entra', () => {
  it('ofrece agotados, críticos y por reponer; un producto sano («ok») no, aunque traiga cantidad calculada', () => {
    const { grupos } = sugerenciasDePedido([
      fila({ id_producto: 1, nivel: 'agotado' }),
      fila({ id_producto: 2, nivel: 'critico' }),
      fila({ id_producto: 3, nivel: 'reponer' }),
      fila({ id_producto: 4, nivel: 'ok', cantidad_recomendada: 5 }),
    ]);
    expect(grupos[0].items.map((i) => i.id_producto).sort()).toEqual([1, 2, 3]);
  });

  it('lo que ya está en un pedido en borrador no se vuelve a ofrecer, y se cuenta aparte', () => {
    const r = sugerenciasDePedido([fila({ id_producto: 1 }), fila({ id_producto: 2 })], { 1: { id_orden: 7, cantidad: 6, proveedor: 'X' } });
    expect(r.grupos[0].items.map((i) => i.id_producto)).toEqual([2]);
    expect(r.yaEnBorrador).toBe(1);
  });

  it('un producto AGOTADO con cantidad 0 no se puede pedir: se avisa aparte en vez de esconderlo', () => {
    const r = sugerenciasDePedido([fila({ id_producto: 1, nivel: 'agotado', cantidad_recomendada: 0 }), fila({ id_producto: 2 })]);
    expect(r.sinCantidad.map((p) => p.id_producto)).toEqual([1]);
    expect(r.grupos[0].items.map((i) => i.id_producto)).toEqual([2]);
  });

  it('un producto «por reponer» con cantidad 0 (objetivo ya cubierto) no se pide ni se avisa: no hay nada que hacer', () => {
    const r = sugerenciasDePedido([fila({ id_producto: 1, nivel: 'reponer', cantidad_recomendada: 0 })]);
    expect(r).toEqual({ grupos: [], sinProveedor: [], sinCantidad: [], yaEnBorrador: 0 });
  });

  it('sin datos o con listas vacías no falla', () => {
    for (const entrada of [undefined, null, []]) {
      expect(sugerenciasDePedido(entrada)).toEqual({ grupos: [], sinProveedor: [], sinCantidad: [], yaEnBorrador: 0 });
    }
  });

  it('la cantidad y el costo pueden llegar como texto', () => {
    const { grupos } = sugerenciasDePedido([fila({ cantidad_recomendada: '4', costo_unitario: '1500.50', stock_actual: '1' })]);
    expect(grupos[0].items[0]).toMatchObject({ cantidad: 4, costo_unitario: 1500.5, stock: 1, subtotal: 6002 });
  });
});

describe('sugerenciasDePedido: cómo se agrupa y ordena', () => {
  it('un grupo por proveedor, con el total de cantidad × costo', () => {
    const { grupos } = sugerenciasDePedido([
      fila({ id_producto: 1, id_proveedor: 10, proveedor: 'Sol', cantidad_recomendada: 5, costo_unitario: 1000 }),
      fila({ id_producto: 2, id_proveedor: 10, proveedor: 'Sol', cantidad_recomendada: 2, costo_unitario: 3000 }),
      fila({ id_producto: 3, id_proveedor: 20, proveedor: 'Luna', cantidad_recomendada: 1, costo_unitario: 500 }),
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos.find((g) => g.id_proveedor === 10).total).toBe(11000);
    expect(grupos.find((g) => g.id_proveedor === 20).total).toBe(500);
  });

  it('los productos sin proveedor van aparte, no dentro de un grupo', () => {
    const r = sugerenciasDePedido([fila({ id_producto: 1, id_proveedor: null, proveedor: null }), fila({ id_producto: 2 })]);
    expect(r.sinProveedor.map((p) => p.id_producto)).toEqual([1]);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].items.map((i) => i.id_producto)).toEqual([2]);
  });

  it('el proveedor con lo más urgente va primero, y dentro de cada grupo lo más urgente primero', () => {
    const { grupos } = sugerenciasDePedido([
      fila({ id_producto: 1, id_proveedor: 10, proveedor: 'Antes en el alfabeto', urgencia: 'Puede esperar', nombre: 'A' }),
      fila({ id_producto: 2, id_proveedor: 20, proveedor: 'Zeta', urgencia: 'Pide hoy', nombre: 'B' }),
      fila({ id_producto: 3, id_proveedor: 20, proveedor: 'Zeta', urgencia: 'En esta compra', nombre: 'A' }),
      fila({ id_producto: 4, id_proveedor: 20, proveedor: 'Zeta', urgencia: 'Pide hoy', nombre: 'A' }),
    ]);
    expect(grupos.map((g) => g.proveedor)).toEqual(['Zeta', 'Antes en el alfabeto']);
    expect(grupos[0].urgencia).toBe('Pide hoy');
    expect(grupos[0].items.map((i) => i.id_producto)).toEqual([4, 2, 3]);
  });

  it('avisa si algún costo es estimado (el producto no tiene costo de compra)', () => {
    const { grupos } = sugerenciasDePedido([fila({ costo_estimado: true }), fila({ id_producto: 2, costo_estimado: false })]);
    expect(grupos[0].hayCostosEstimados).toBe(true);
    expect(sugerenciasDePedido([fila()]).grupos[0].hayCostosEstimados).toBe(false);
  });
});

describe('cuerpoParaArmar', () => {
  it('manda producto, cantidad, base y urgencia, sin ajuste de IA', () => {
    const { grupos } = sugerenciasDePedido([fila({ id_producto: 9, cantidad_recomendada: 8 })]);
    expect(cuerpoParaArmar(grupos[0].items)).toEqual({ items: [{ id_producto: 9, cantidad: 8, base: 8, urgencia: 'En esta compra' }] });
  });

  it(`manda como máximo ${MAX_PRODUCTOS_POR_PEDIDO} productos (el servidor rechaza más)`, () => {
    const muchos = Array.from({ length: 60 }, (_, i) => ({ id_producto: i + 1, cantidad: 1, urgencia: 'Pide hoy' }));
    expect(cuerpoParaArmar(muchos).items).toHaveLength(MAX_PRODUCTOS_POR_PEDIDO);
  });
});

describe('listas de órdenes', () => {
  const historial = ['Borrador', 'Pendiente', 'Aprobada', 'Enviada', 'Parcial', 'Completada', 'Rechazada'].map((estado, i) => ({ id_orden: i + 1, estado }));

  it('por aprobar: Borrador y Pendiente', () => {
    expect(ordenesPorAprobar(historial).map((o) => o.estado)).toEqual(['Borrador', 'Pendiente']);
  });

  it('por recibir: Aprobada, Enviada y Parcial; las Completadas y Rechazadas no', () => {
    expect(ordenesPorRecibir(historial).map((o) => o.estado)).toEqual(['Aprobada', 'Enviada', 'Parcial']);
  });

  it('sin historial no falla', () => {
    expect(ordenesPorAprobar(undefined)).toEqual([]);
    expect(ordenesPorRecibir(null)).toEqual([]);
  });
});

describe('recepción de mercancía', () => {
  const lineas = [
    { id_producto: 1, nombre_producto: 'Arroz', cantidad_final: 10, cantidad_recibida: 0 },
    { id_producto: 2, nombre_producto: 'Aceite', cantidad_final: 5, cantidad_recibida: 3 },
  ];

  it('pendienteDeLinea: lo pedido menos lo ya recibido, nunca negativo', () => {
    expect(pendienteDeLinea(lineas[0])).toBe(10);
    expect(pendienteDeLinea(lineas[1])).toBe(2);
    expect(pendienteDeLinea({ cantidad_final: 5, cantidad_recibida: 9 })).toBe(0);
    expect(pendienteDeLinea({ cantidad_final: 5, cantidad_recibida: null })).toBe(5);
  });

  it('llegadaValida acepta enteros de 0 a 100000 y rechaza el resto', () => {
    expect(llegadaValida('0')).toBe(0);
    expect(llegadaValida(' 12 ')).toBe(12);
    expect(llegadaValida(7)).toBe(7);
    expect(llegadaValida('100000')).toBe(100000);
    for (const malo of ['', '-1', '1.5', 'abc', '12abc', '100001', null, undefined, '1e3']) {
      expect(llegadaValida(malo), String(malo)).toBeNull();
    }
  });

  it('el cuerpo lleva el TOTAL recibido de cada línea: lo ya registrado más lo que llegó ahora', () => {
    const r = cuerpoDeRecepcion(lineas, { 1: '10', 2: '2' });
    expect(r).toEqual({ ok: true, cuerpo: { items: [{ id_producto: 1, cantidad_recibida: 10 }, { id_producto: 2, cantidad_recibida: 5 }] } });
  });

  it('una línea sin nada escrito cuenta como 0 que llegó, y conserva lo ya recibido', () => {
    const r = cuerpoDeRecepcion(lineas, {});
    expect(r.cuerpo.items).toEqual([{ id_producto: 1, cantidad_recibida: 0 }, { id_producto: 2, cantidad_recibida: 3 }]);
  });

  it('un valor inválido en cualquier línea impide enviar y dice cuál producto revisar', () => {
    const r = cuerpoDeRecepcion(lineas, { 1: '10', 2: 'x' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Aceite');
  });

  it('cerrar con faltante y confirmar exceso (con motivo) solo se mandan cuando se piden', () => {
    expect(cuerpoDeRecepcion(lineas, { 1: '4' }).cuerpo).not.toHaveProperty('cerrar_con_faltante');
    expect(cuerpoDeRecepcion(lineas, { 1: '4' }).cuerpo).not.toHaveProperty('confirmar_exceso');
    expect(cuerpoDeRecepcion(lineas, { 1: '4' }, { cerrarConFaltante: true }).cuerpo.cerrar_con_faltante).toBe(true);
    const exceso = cuerpoDeRecepcion(lineas, { 1: '14' }, { confirmarExceso: true, motivo: '  El proveedor regaló 4  ' }).cuerpo;
    expect(exceso).toMatchObject({ confirmar_exceso: true, motivo: 'El proveedor regaló 4' });
  });

  it('quedaraFaltante: solo si con lo que llegó ahora alguna línea sigue incompleta', () => {
    expect(quedaraFaltante(lineas, { 1: '10', 2: '2' })).toBe(false);
    expect(quedaraFaltante(lineas, { 1: '9', 2: '2' })).toBe(true);
    expect(quedaraFaltante(lineas, { 1: '10', 2: '1' })).toBe(true);
    expect(quedaraFaltante(lineas, { 1: '15', 2: '2' })).toBe(false); // de más no es faltante
    // Un texto inválido no cuenta como faltante: igual no se enviaría (cuerpoDeRecepcion rechaza esa línea).
    expect(quedaraFaltante(lineas, { 1: 'x', 2: '2' })).toBe(false);
  });
});
