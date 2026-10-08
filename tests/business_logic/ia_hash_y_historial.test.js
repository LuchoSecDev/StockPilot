import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { calcularHash, claveRecomendaciones, clavePromociones } from '../../services/ia/hashIA.js';
import { armarHistorialCredito } from '../../services/ia/historialCredito.js';

describe('hashIA', () => {
  const md5 = (texto) => crypto.createHash('md5').update(texto).digest('hex');

  it('es MD5 hexadecimal de 32 caracteres (cabe en Cache_IA.data_hash VARCHAR(32))', () => {
    expect(calcularHash({ a: 1 })).toMatch(/^[0-9a-f]{32}$/);
  });

  it('un objeto se hashea como su JSON: mismo hash que producía el controlador original', () => {
    const filas = [{ id_producto: 1, stock_actual: 3 }];
    expect(calcularHash(filas)).toBe(md5(JSON.stringify(filas)));
  });

  it('un texto se hashea tal cual (sin volver a serializarlo con comillas): compatible con las promociones ya guardadas', () => {
    const texto = 'PROMO_' + JSON.stringify([{ id: 1 }]);
    expect(calcularHash(texto)).toBe(md5(texto));
  });

  it('datos distintos → hash distinto; mismos datos → mismo hash', () => {
    expect(calcularHash([{ stock: 1 }])).not.toBe(calcularHash([{ stock: 2 }]));
    expect(calcularHash([{ stock: 1 }])).toBe(calcularHash([{ stock: 1 }]));
  });

  it('claves de caché por tienda: no se pisan entre tiendas ni entre usos', () => {
    expect(claveRecomendaciones(3)).toBe('RECS_V4_3');
    expect(clavePromociones(3)).toBe('PROMO_3');
    expect(claveRecomendaciones(3)).not.toBe(claveRecomendaciones(4));
    expect(claveRecomendaciones(3)).not.toBe(clavePromociones(3));
  });
});

describe('armarHistorialCredito', () => {
  const cliente = { id_cliente: 4, limite_credito: 100000, nombre: 'Doña Rosa', celular: '3001234567' };

  it('suma lo fiado y lo abonado y calcula el saldo pendiente', () => {
    const h = armarHistorialCredito(
      cliente,
      [{ precio_total: 30000, fecha_salida: 'f1' }, { precio_total: 20000, fecha_salida: 'f2' }],
      [{ monto: 15000, fecha_abono: 'a1' }]
    );
    expect(h).toMatchObject({
      id_cliente: 4, limite_credito: 100000,
      total_compras_fiadas: 50000, total_pagado: 15000, saldo_pendiente_actual: 35000,
      num_compras_fiadas: 2, num_abonos: 1,
      fechas_compras: ['f1', 'f2'], fechas_abonos: ['a1']
    });
  });

  it('los montos que llegan como texto (NUMERIC de Postgres) se suman como números', () => {
    const h = armarHistorialCredito(cliente, [{ precio_total: '30000.50' }, { precio_total: '1000' }], [{ monto: '500' }]);
    expect(h.total_compras_fiadas).toBe(31000.5);
    expect(h.saldo_pendiente_actual).toBe(30500.5);
  });

  it('sin movimientos: todo en cero', () => {
    const h = armarHistorialCredito(cliente, [], []);
    expect(h).toMatchObject({ total_compras_fiadas: 0, total_pagado: 0, saldo_pendiente_actual: 0, num_compras_fiadas: 0, num_abonos: 0 });
  });

  it('PRIVACIDAD (Ley 1581): no incluye el nombre ni el celular del cliente', () => {
    const h = armarHistorialCredito(cliente, [{ precio_total: 1000 }], []);
    const texto = JSON.stringify(h);
    expect(Object.keys(h)).not.toContain('nombre');
    expect(Object.keys(h)).not.toContain('celular');
    expect(texto).not.toContain('Doña Rosa');
    expect(texto).not.toContain('3001234567');
  });
});
