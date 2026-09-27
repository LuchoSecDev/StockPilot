import { describe, it, expect } from 'vitest';
import { calcularReposicion, calcularTendencia, costoUnitario } from '../../utils/reposicion.js';
import { agruparPorProveedor, totalOrden, evaluarRiesgoOrden } from '../../utils/ordenesBorrador.js';

const base = { ventasDia7: 2, ventasDia30: 2, ventas30Total: 60, claseABC: 'A', stock: 10, stockSeguridad: 4, leadTime: 3, factorIA: 1 };

describe('calcularReposicion', () => {
  it('stock sobrado: cantidad 0 y puede esperar', () => {
    const r = calcularReposicion({ ...base, stock: 500 });
    expect(r.cantidadBase).toBe(0);
    expect(r.urgencia).toBe('Puede esperar');
    expect(r.riesgo).toBe('BAJO');
  });
  it('crítico: alcanza para menos días que el proveedor tarda → Pide hoy', () => {
    const r = calcularReposicion({ ...base, stock: 4 }); // 2 días de stock, lead 3
    expect(r.riesgo).toBe('CRÍTICO');
    expect(r.diasParaAgotar).toBe(2);
    expect(r.urgencia).toBe('Pide hoy');
    expect(r.cantidadBase).toBeGreaterThan(0);
  });
  it('alcanza para lead_time + frecuencia_compra_dias (default 7) → En esta compra', () => {
    const r = calcularReposicion({ ...base, stock: 16 }); // 8 días, lead 3 → ≤ 10
    expect(r.urgencia).toBe('En esta compra');
  });
  it('frecuenciaCompraDias distinto de 7 mueve la ventana (plan 17, decisión 2)', () => {
    // 8 días de stock, lead 3: con frecuencia 7 (default) ya no alcanza (8 > 3+7=10... sí alcanza); probamos el borde real
    const r16dias = { ...base, stock: 32 }; // 16 días de stock, lead 3
    expect(calcularReposicion({ ...r16dias, frecuenciaCompraDias: 7 }).urgencia).toBe('Puede esperar'); // 16 > 3+7=10
    expect(calcularReposicion({ ...r16dias, frecuenciaCompraDias: 14 }).urgencia).toBe('En esta compra'); // 16 <= 3+14=17
  });
  it('sin ventas y stock crítico → Pide hoy aunque no haya días para agotar que calcular (caso Leche Alquería)', () => {
    const r = calcularReposicion({ ...base, ventasDia7: 0, ventasDia30: 0, ventas30Total: 0, stock: 1 }); // stock 1 < seguridad 4
    expect(r.diasParaAgotar).toBeNull();
    expect(r.riesgo).toBe('CRÍTICO');
    expect(r.urgencia).toBe('Pide hoy');
  });
  it('sin ventas pero con stock sano (no crítico) → Puede esperar', () => {
    const r = calcularReposicion({ ...base, ventasDia7: 0, ventasDia30: 0, ventas30Total: 0, stock: 20 }); // stock 20 > seguridad 4
    expect(r.diasParaAgotar).toBeNull();
    expect(r.riesgo).toBe('BAJO');
    expect(r.urgencia).toBe('Puede esperar');
  });
  it('crítico pero con ventas que dan muchos días de cobertura → manda el cálculo real, no el riesgo (caso Papas Margarita)', () => {
    const r = calcularReposicion({ ...base, ventasDia7: 0.03, ventasDia30: 0.03, ventas30Total: 1, stock: 11, stockSeguridad: 20 });
    expect(r.riesgo).toBe('CRÍTICO'); // 11 < 20
    expect(r.diasParaAgotar).toBeGreaterThan(base.leadTime + 7);
    expect(r.urgencia).toBe('Puede esperar');
  });
  it('sin stock y con demanda → Pide hoy', () => {
    expect(calcularReposicion({ ...base, stock: 0 }).urgencia).toBe('Pide hoy');
  });
  it('sin stock, sin ventas y stockSeguridad en 0 (el valor por defecto) → Pide hoy igual (plan 17, hallazgo E1)', () => {
    // Antes cantidadBase salía en 0 en este caso exacto y la urgencia se quedaba en "Puede esperar":
    // un producto nuevo, agotado y sin stock de seguridad configurado no se veía urgente.
    const r = calcularReposicion({ ventasDia7: 0, ventasDia30: 0, ventas30Total: 0, claseABC: 'C', stock: 0, stockSeguridad: 0, leadTime: 3 });
    expect(r.cantidadBase).toBe(0);
    expect(r.riesgo).toBe('CRÍTICO');
    expect(r.urgencia).toBe('Pide hoy');
  });
  it('stockMinimo es piso de cantidad para un producto sin historial (plan 17, decisión 4)', () => {
    const r = calcularReposicion({ ventasDia7: 0, ventasDia30: 0, ventas30Total: 0, claseABC: 'C', stock: 0, stockSeguridad: 0, stockMinimo: 5, leadTime: 3 });
    expect(r.cantidadBase).toBe(5); // antes salía en 0 (hallazgo E1) aunque la urgencia ya dijera "Pide hoy"
    expect(r.urgencia).toBe('Pide hoy');
    expect(r.nivel).toBe('agotado');
  });
  it('stockMinimo nunca decide "agotado" ni "crítico", solo el piso de "reponer" (plan 17, decisión 4)', () => {
    // Stock sano según riesgo (BAJO) y sin ventas: stockMinimo alto solo debe empujarlo a "reponer", no a "critico"
    const r = calcularReposicion({ ventasDia7: 0, ventasDia30: 0, ventas30Total: 0, claseABC: 'C', stock: 30, stockSeguridad: 4, stockMinimo: 40, leadTime: 3 });
    expect(r.riesgo).toBe('BAJO'); // 30 > stockSeguridad(4) y > rop
    expect(r.nivel).toBe('reponer'); // 30 <= max(rop, stockMinimo=40)
    expect(r.nivel).not.toBe('critico');
    expect(r.nivel).not.toBe('agotado');
  });
  it('nivel: agotado > crítico > reponer > ok, en ese orden', () => {
    expect(calcularReposicion({ ...base, stock: 0 }).nivel).toBe('agotado');
    expect(calcularReposicion({ ...base, stock: 4 }).nivel).toBe('critico'); // urgencia "Pide hoy"
    expect(calcularReposicion({ ...base, stock: 16 }).nivel).toBe('reponer'); // urgencia "En esta compra"
    expect(calcularReposicion({ ...base, stock: 500 }).nivel).toBe('ok');
  });
  it('stock objetivo por clase ABC (A=15, B=30, C=45 días)', () => {
    expect(calcularReposicion({ ...base, stock: 0, claseABC: 'A' }).stockObjetivo).toBe(2 * 15 + 4);
    expect(calcularReposicion({ ...base, stock: 0, claseABC: 'C' }).stockObjetivo).toBe(2 * 45 + 4);
  });
  it('lead_time por defecto (3 días) si falta', () => {
    expect(calcularReposicion({ ...base, leadTime: undefined }).rop).toBe(Math.ceil(2 * 3 + 4));
  });
  it('diasCoberturaOverride reemplaza el DIAS_COBERTURA fijo por ABC (plan 18, Simulador)', () => {
    const sinOverride = calcularReposicion({ ...base, stock: 0 });
    expect(sinOverride.stockObjetivo).toBe(2 * 15 + 4); // claseABC A → 15 días
    const conOverride = calcularReposicion({ ...base, stock: 0 }, { diasCoberturaOverride: 90 });
    expect(conOverride.stockObjetivo).toBe(2 * 90 + 4);
    expect(conOverride.cantidadBase).toBeGreaterThan(sinOverride.cantidadBase);
  });
  it('diasCoberturaOverride no afecta el piso de un producto sin ventas (plan 18)', () => {
    const p = { ventasDia7: 0, ventasDia30: 0, ventas30Total: 0, claseABC: 'C', stock: 0, stockSeguridad: 0, stockMinimo: 5, leadTime: 3 };
    expect(calcularReposicion(p).cantidadBase).toBe(5);
    expect(calcularReposicion(p, { diasCoberturaOverride: 7 }).cantidadBase).toBe(5);
    expect(calcularReposicion(p, { diasCoberturaOverride: 90 }).cantidadBase).toBe(5);
  });
});

describe('calcularTendencia', () => {
  it('se acota entre 0,5 y 2', () => {
    expect(calcularTendencia(10, 1, 30)).toBe(2);
    expect(calcularTendencia(0, 1, 30)).toBe(0.5);
  });
  it('con muestra pequeña no exagera', () => {
    expect(calcularTendencia(1.85, 0.53, 16)).toBeGreaterThan(1); // 16 unidades: hay muestra
    expect(calcularTendencia(1.85, 0.1, 3)).toBe(1); // 3 unidades: sin muestra
  });
});

describe('costoUnitario', () => {
  it('usa costo_compra si existe', () => expect(costoUnitario({ costoCompra: 800, precio: 1000 })).toEqual({ costo: 800, estimado: false }));
  it('si es 0 o nulo estima con el margen y lo marca', () => {
    expect(costoUnitario({ costoCompra: 0, precio: 1000 })).toEqual({ costo: 750, estimado: true });
    expect(costoUnitario({ costoCompra: null, precio: 1000, margenMedio: 0.4 })).toEqual({ costo: 600, estimado: true });
  });
});

describe('agruparPorProveedor', () => {
  const items = [
    { id_producto: 1, id_proveedor: 7, cantidad: 5 },
    { id_producto: 2, id_proveedor: 7, cantidad: 3 },
    { id_producto: 3, id_proveedor: 9, cantidad: 2 },
    { id_producto: 4, id_proveedor: null, cantidad: 4 },
    { id_producto: 5, id_proveedor: 7, cantidad: 0 },
    { id_producto: 1, id_proveedor: 7, cantidad: 99 },
  ];
  it('agrupa por proveedor, separa sin proveedor y omite cantidad 0 y duplicados', () => {
    const r = agruparPorProveedor(items);
    expect(r.grupos.map(g => [g.id_proveedor, g.items.length])).toEqual([[7, 2], [9, 1]]);
    expect(r.sinProveedor).toEqual([4]);
    expect(r.omitidos).toEqual([5]);
    expect(r.grupos[0].items[0].cantidad).toBe(5); // el duplicado no pisa
  });
  it('total = Σ cantidad × costo', () => {
    expect(totalOrden([{ cantidad: 2, costo_unitario: 500 }, { cantidad: 1, costo_unitario: 250 }])).toBe(1250);
  });
});

describe('evaluarRiesgoOrden', () => {
  it('excede el presupuesto → Alto, aunque no haya productos críticos ni en alerta', () => {
    const r = evaluarRiesgoOrden(200000, 100000, 0, 0);
    expect(r.riskLevel).toBe('Alto');
    expect(r.riskReason).toMatch(/excede el presupuesto/);
  });
  it('presupuesto excedido manda sobre productos críticos (se evalúa primero)', () => {
    const r = evaluarRiesgoOrden(200000, 100000, 3, 0);
    expect(r.riskReason).toMatch(/excede el presupuesto/);
  });
  it('dentro de presupuesto pero con productos críticos → Alto', () => {
    const r = evaluarRiesgoOrden(50000, 100000, 2, 0);
    expect(r.riskLevel).toBe('Alto');
    expect(r.riskReason).toMatch(/2 productos en estado crítico/);
  });
  it('dentro de presupuesto, sin críticos, con productos en alerta (naranja) → Medio', () => {
    const r = evaluarRiesgoOrden(50000, 100000, 0, 4);
    expect(r.riskLevel).toBe('Medio');
    expect(r.riskReason).toMatch(/4 productos en alerta/);
  });
  it('dentro de presupuesto, sin críticos ni alertas → Bajo', () => {
    const r = evaluarRiesgoOrden(50000, 100000, 0, 0);
    expect(r.riskLevel).toBe('Bajo');
  });
});
