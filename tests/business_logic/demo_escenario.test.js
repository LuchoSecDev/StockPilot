import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';

/**
 * Plan 25, fase 1. El escenario de la tienda de demostración (database/demoEscenario.js) es una función PURA:
 * recibe «hoy» y una semilla y devuelve todos los datos con fechas relativas a «hoy». Aquí se comprueba, sin base de
 * datos, que esos datos provocan exactamente las alertas que el guion de la visita promete (stock crítico, stock
 * bajo, vencimientos, sobrestock), evaluándolos con la MISMA regla que usa la aplicación (Alert.evaluarProducto):
 * no se reimplementa. La clase ABC la calcula Alert.calcularClasificacionABC; la real (SQL) la confirma la prueba
 * de integración tests/integration/demo_sembrado.test.js.
 *
 * Alert.js hace require('../config/database') al cargarse: se simula para que la prueba sea 100 % local.
 */
// Si una prueba FALLA, Vitest vuelve a cargar el módulo real de la base (comprobado el 9-oct-2026, también con
// inventory_math): sin esto migraría la base de su .env. Una URL inservible hace que, en ese caso, no toque nada.
vi.hoisted(() => { process.env.DATABASE_URL = 'postgresql://sin_uso:sin_uso@127.0.0.1:1/sin_uso_test'; });

vi.mock('../../config/database.js', () => {
  const db = { allAsync: vi.fn(), getAsync: vi.fn(), runAsync: vi.fn(), getClient: vi.fn(), pool: {} };
  return { default: db, ...db };
});

import Alert from '../../models/Alert.js';
import escenarioModulo from '../../database/demoEscenario.js';

const { armarEscenario } = escenarioModulo;

const HOY = '2026-10-09';
const SEMILLA = 25;
const DIA_MS = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' → Date a medianoche LOCAL (así Alert.evaluarProducto no depende de la zona horaria de la máquina). */
const fechaLocal = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
const diasEntre = (desdeIso, hastaIso) => Math.round((fechaLocal(hastaIso) - fechaLocal(desdeIso)) / DIA_MS);

/** Lo que el SQL de entradasMotor.js calcula por producto: unidades de los últimos 7 y 30 días. */
function ventasPorProducto(esc) {
  const acc = new Map(esc.productos.map((p) => [p.clave, { q7: 0, q30: 0 }]));
  for (const v of esc.ventas) {
    for (const it of v.items) {
      const a = acc.get(it.producto);
      if (v.diasAtras <= 7) a.q7 += it.cantidad;
      if (v.diasAtras <= 30) a.q30 += it.cantidad;
    }
  }
  return acc;
}

/** Evalúa cada producto del escenario con la regla real y devuelve { clave: [tipos de alerta ordenados] }. */
function alertasPorProducto(esc) {
  const ventas = ventasPorProducto(esc);
  const items = esc.productos.map((p) => {
    const { q7, q30 } = ventas.get(p.clave);
    return {
      id_producto: p.clave, precio: p.precio, stock_actual: p.cantidad, stock_seguridad: p.stock_seguridad,
      stock_minimo: p.stock_minimo, lead_time: p.lead_time, frecuencia_compra_dias: p.frecuencia_compra_dias,
      velocity_7d: q7 / 7, velocity_30d: q30 / 30, qty_30d_total: q30, factor_ia: null,
    };
  });
  Alert.calcularClasificacionABC(items);
  const hoy = fechaLocal(esc.hoy);
  const resultado = {};
  for (const it of items) {
    const p = esc.productos.find((x) => x.clave === it.id_producto);
    const conClase = { ...it, claseABC: it.clasificacion_abc };
    const extra = { fecha_vencimiento: p.vencimiento ? fechaLocal(p.vencimiento) : undefined, stock_maximo: p.stock_maximo };
    resultado[p.clave] = Alert.evaluarProducto(conClase, extra, hoy).map((a) => a.tipo).sort();
  }
  return resultado;
}

// Lo que el guion promete por producto (sección 2.1 del plan 25). Añadir un producto al escenario obliga a
// declarar aquí qué alerta debe tener: así nadie cambia los datos sin querer la demostración.
const ESPERADO = {
  leche: ['stock_critico'], huevos: ['stock_critico'], arroz: ['stock_critico'], aceite: ['stock_critico'],
  cafe: ['stock_bajo'], pasta: ['stock_bajo'], gaseosa: ['stock_bajo'],
  yogur: ['vencimiento_critico'], queso: ['vencimiento_critico'],
  galletas: ['vencimiento_proximo'], mermelada: ['vencimiento_proximo'],
  jabon: ['sobrestock'],
  lecheVencida: [], panVencido: [],
  azucar: [], sal: [], lentejas: [], arrozRoa: [], atun: [], panela: [], harina: [], chocolate: [], papas: [],
  agua: [], cerveza: [], detergente: [], mantequilla: [], kumis: [],
};

describe('Escenario de la tienda de demostración (plan 25)', () => {
  const esc = armarEscenario({ hoy: HOY, semilla: SEMILLA });

  describe('alertas que provoca (regla real de la aplicación)', () => {
    const alertas = alertasPorProducto(esc);

    it('cada producto tiene exactamente las alertas declaradas en ESPERADO (y no hay productos sin declarar)', () => {
      expect(Object.keys(alertas).sort()).toEqual(Object.keys(ESPERADO).sort());
      for (const [clave, tipos] of Object.entries(ESPERADO)) {
        expect({ clave, alertas: alertas[clave] }).toEqual({ clave, alertas: tipos });
      }
    });

    it('el conteo por tipo coincide con la tabla 2.1 del plan', () => {
      const contar = (tipo) => Object.values(alertas).filter((t) => t.includes(tipo)).length;
      expect(contar('stock_critico')).toBe(4);
      expect(contar('stock_bajo')).toBe(3);
      expect(contar('vencimiento_critico')).toBe(2);
      expect(contar('vencimiento_proximo')).toBe(2);
      expect(contar('sobrestock')).toBe(1);
    });

    it('las alertas no dependen del día de la demostración: con otro «hoy» salen las mismas', () => {
      const otro = armarEscenario({ hoy: '2026-11-17', semilla: SEMILLA });
      expect(alertasPorProducto(otro)).toEqual(alertas);
    });

    it('hay productos ya vencidos para el reporte de merma, y no generan alerta', () => {
      const vencidos = esc.productos.filter((p) => p.vencimiento && diasEntre(esc.hoy, p.vencimiento) < 0);
      expect(vencidos.map((p) => p.clave).sort()).toEqual(['lecheVencida', 'panVencido']);
    });
  });

  describe('determinismo y fechas relativas', () => {
    it('la misma semilla y el mismo «hoy» dan exactamente el mismo escenario', () => {
      expect(armarEscenario({ hoy: HOY, semilla: SEMILLA })).toEqual(esc);
    });

    // Huella fija: si alguien cambia los datos (o reemplaza el generador por Math.random), esta prueba falla.
    // Para cambiar el escenario a propósito: actualizar el valor y explicar el cambio en el commit.
    it('la huella SHA-256 del escenario no cambia sin querer', () => {
      const huella = createHash('sha256').update(JSON.stringify(esc)).digest('hex');
      expect(huella).toBe('716918f0374a41c6b70d7db682adc6d9f659c05fcbc105153e064ae23e5aff0b');
    });

    it('con otro «hoy» las fechas se desplazan igual (todo es relativo a hoy)', () => {
      const otro = armarEscenario({ hoy: '2026-11-17', semilla: SEMILLA });
      const desfase = diasEntre(HOY, '2026-11-17');
      expect(otro.productos.length).toBe(esc.productos.length);
      esc.productos.forEach((p, i) => {
        const q = otro.productos[i];
        expect(q.clave).toBe(p.clave);
        if (p.vencimiento) expect(diasEntre(p.vencimiento, q.vencimiento)).toBe(desfase);
        else expect(q.vencimiento).toBeNull();
      });
      esc.ventas.forEach((v, i) => {
        expect(otro.ventas[i].diasAtras).toBe(v.diasAtras);
        expect(diasEntre(v.dia, otro.ventas[i].dia)).toBe(desfase);
      });
    });

    it('otra semilla da otras cantidades de venta (el generador sí se usa)', () => {
      const otra = armarEscenario({ hoy: HOY, semilla: 26 });
      expect(JSON.stringify(otra.ventas)).not.toBe(JSON.stringify(esc.ventas));
    });
  });

  describe('coherencia de los datos', () => {
    it('ninguna venta cae en los bordes de las ventanas de 7 y 30 días (días 0, 7 y 30 hacia atrás)', () => {
      for (const v of esc.ventas) expect([0, 7, 30]).not.toContain(v.diasAtras);
    });

    it('precios y costos son enteros positivos y el costo es menor que el precio; el stock no es negativo', () => {
      for (const p of esc.productos) {
        expect(Number.isInteger(p.precio) && p.precio > 0).toBe(true);
        expect(Number.isInteger(p.costo) && p.costo > 0 && p.costo < p.precio).toBe(true);
        expect(Number.isInteger(p.cantidad) && p.cantidad >= 0).toBe(true);
      }
    });

    it('el total de cada venta es la suma de sus líneas, y las líneas apuntan a productos que existen', () => {
      const claves = new Set(esc.productos.map((p) => p.clave));
      for (const v of esc.ventas) {
        expect(v.items.length).toBeGreaterThan(0);
        for (const it of v.items) expect(claves.has(it.producto)).toBe(true);
        expect(v.total).toBe(v.items.reduce((s, it) => s + it.cantidad * it.precio, 0));
      }
    });

    it('no hay cuenta de Tendero: la demostración es para el dueño (solo un Administrador)', () => {
      expect(esc.admin.rol).toBe('Administrador');
      expect(esc.usuarios).toBeUndefined();
    });

    it('todos los correos son de un dominio que no existe (@example.invalid), salvo el del proveedor A si se configura', () => {
      const correos = [esc.admin.correo, ...esc.proveedores.map((p) => p.email).filter(Boolean)];
      for (const c of correos) expect(c).toMatch(/@example\.invalid$/);

      const conBuzon = armarEscenario({ hoy: HOY, semilla: SEMILLA, correoProveedor: 'buzon.real@ejemplo.test' });
      const a = conBuzon.proveedores.find((p) => p.clave === 'A');
      const b = conBuzon.proveedores.find((p) => p.clave === 'B');
      expect(a.email).toBe('buzon.real@ejemplo.test');
      expect(b.email).toBeNull(); // el proveedor B sirve para mostrar el camino sin correo (PDF / «ya la envié»)
      expect(conBuzon.admin.correo).toMatch(/@example\.invalid$/);
    });

    it('rechaza un «hoy» que no sea una fecha ISO (YYYY-MM-DD)', () => {
      expect(() => armarEscenario({ hoy: '09/10/2026', semilla: SEMILLA })).toThrow(/hoy/);
      expect(() => armarEscenario({ hoy: undefined, semilla: SEMILLA })).toThrow(/hoy/);
    });
  });

  describe('órdenes de compra', () => {
    it('hay un borrador por aprobar, una orden aprobada lista para enviar y una enviada por recibir', () => {
      const estados = esc.ordenes.map((o) => `${o.estado}:${o.proveedor}`).sort();
      expect(estados).toEqual(['Aprobada:A', 'Borrador:A', 'Enviada:B']);
    });

    it('un solo borrador abierto por proveedor, con total = suma de cantidad final × costo', () => {
      const borradores = esc.ordenes.filter((o) => o.estado === 'Borrador');
      expect(new Set(borradores.map((o) => o.proveedor)).size).toBe(borradores.length);
      for (const o of esc.ordenes) {
        expect(o.lineas.length).toBeGreaterThan(0);
        expect(o.presupuesto_total).toBe(o.lineas.reduce((s, l) => s + l.cantidad_final * l.costo_unitario, 0));
      }
    });

    it('cada línea es de un producto del mismo proveedor de la orden y usa su costo', () => {
      for (const o of esc.ordenes) {
        for (const l of o.lineas) {
          const p = esc.productos.find((x) => x.clave === l.producto);
          expect(p.proveedor).toBe(o.proveedor);
          expect(l.costo_unitario).toBe(p.costo);
        }
      }
    });

    it('la aprobada lleva el proveedor con correo (se puede enviar) y la enviada el proveedor sin correo', () => {
      const emailDe = (clave) => esc.proveedores.find((p) => p.clave === clave).email;
      expect(emailDe(esc.ordenes.find((o) => o.estado === 'Aprobada').proveedor)).toBeTruthy();
      expect(emailDe(esc.ordenes.find((o) => o.estado === 'Enviada').proveedor)).toBeNull();
    });
  });

  describe('cartera y caja', () => {
    const saldo = (clave) => {
      const fiado = esc.ventas.filter((v) => v.metodo_pago === 'Fiado' && v.cliente === clave).reduce((s, v) => s + v.total, 0);
      const abonado = esc.abonos.filter((a) => a.cliente === clave).reduce((s, a) => s + a.monto, 0);
      return fiado - abonado;
    };

    it('hay clientes con deuda, uno sin deuda, y nadie supera su límite de crédito', () => {
      const saldos = esc.clientes.map((c) => saldo(c.clave));
      expect(saldos.filter((s) => s > 0).length).toBeGreaterThanOrEqual(2);
      expect(saldos.filter((s) => s === 0).length).toBeGreaterThanOrEqual(1);
      esc.clientes.forEach((c) => expect(saldo(c.clave)).toBeLessThanOrEqual(c.limite_credito));
    });

    it('toda venta fiada es de un cliente que existe; solo las fiadas tienen cliente', () => {
      const claves = new Set(esc.clientes.map((c) => c.clave));
      for (const v of esc.ventas) {
        if (v.metodo_pago === 'Fiado') expect(claves.has(v.cliente)).toBe(true);
        else expect(v.cliente).toBeNull();
      }
    });

    it('hay una sesión de caja cerrada (ayer) con el arqueo calculado como lo hace la aplicación y NINGUNA abierta', () => {
      expect(esc.sesiones).toHaveLength(1);
      const s = esc.sesiones[0];
      expect(s.estado).toBe('Cerrada');
      const efectivo = esc.ventas.filter((v) => v.sesion === s.clave && v.metodo_pago === 'Efectivo').reduce((t, v) => t + v.total, 0);
      const abonos = esc.abonos.filter((a) => a.sesion === s.clave && a.metodo_pago === 'Efectivo').reduce((t, a) => t + a.monto, 0);
      const egresos = esc.egresos.filter((e) => e.sesion === s.clave && e.estado !== 'Rechazado').reduce((t, e) => t + e.monto, 0);
      expect(s.monto_cierre_calculado).toBe(s.monto_apertura + efectivo + abonos - egresos);
      expect(s.diferencia).toBe(s.monto_cierre_declarado - s.monto_cierre_calculado);
      // Vender exige caja abierta: el guion la abre en vivo.
      expect(esc.sesiones.some((x) => x.estado === 'Abierta')).toBe(false);
    });

    it('las ventas de la sesión de ayer son de ayer', () => {
      for (const v of esc.ventas.filter((x) => x.sesion)) expect(v.diasAtras).toBe(1);
    });
  });

  describe('Kardex', () => {
    it('cada producto arranca con una entrada inicial y cada venta deja su salida, de modo que el saldo cuadra con el stock', () => {
      for (const p of esc.productos) {
        const movs = esc.movimientos.filter((m) => m.producto === p.clave);
        expect(movs[0].tipo_movimiento).toBe('Entrada');
        const saldoFinal = movs.reduce((s, m) => s + (m.tipo_movimiento === 'Entrada' ? m.cantidad : -m.cantidad), 0);
        expect({ clave: p.clave, saldo: saldoFinal }).toEqual({ clave: p.clave, saldo: p.cantidad });
      }
    });
  });
});
