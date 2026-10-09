/**
 * @file panel_interno_vistas.test.js
 * @description Plan 22 (I1/I2): la migración del panel interno y sus vistas de métricas. Es lo que mide el piloto,
 * así que se prueba con datos sembrados a mano y fechas relativas a «hoy en Bogotá»:
 *   - la migración es idempotente, no pisa `fecha_creacion` y rellena las tiendas que ya existían;
 *   - un «día con ventas» es un día calendario de BOGOTÁ (una venta de las 11:30 p. m. no salta al día siguiente);
 *   - «primeros 7 días» = el día del registro y los 6 siguientes;
 *   - las tiendas de prueba salen de la activación y la adopción, pero siguen en el resumen con su marca;
 *   - las vistas NO exponen montos, nombres de productos ni datos de clientes (lista exacta de columnas).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto } from './helpers/fixtures.js';
import { asegurarPanelInterno } from '../../config/migraciones/panelInterno.js';

// La auto-migración de arranque (que también crea estas vistas) debe haber terminado antes de volver a correr la
// migración a mano: dos DDL en paralelo sobre las mismas tablas son justo lo que provoca un deadlock.
beforeAll(async () => {
  await db.migrationReady;
});

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

// --- Utilidades de fechas: todo relativo a «hoy en Bogotá» (Bogotá no tiene horario de verano: siempre UTC-5) ---
let hoyBogota;
beforeEach(async () => {
  hoyBogota = (await db.getAsync("SELECT to_char((NOW() AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') AS d")).d;
});

/** 'YYYY-MM-DD' de hace `n` días respecto a hoy en Bogotá. */
const diaIso = (n) => {
  const d = new Date(`${hoyBogota}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};
/** Instante en hora de Bogotá: `hace(3, '23:30')` = hace 3 días a las 11:30 p. m. de Bogotá. */
const hace = (n, hora = '10:00') => new Date(`${diaIso(n)}T${hora}:00-05:00`);

async function tienda({ creadaHace = 0, esPrueba = false, diasApertura = 7 } = {}) {
  const u = await crearUsuario();
  await db.runAsync('UPDATE Tienda SET fecha_creacion = ?, es_prueba = ?, dias_apertura_semana = ? WHERE id_tienda = ?',
    [hace(creadaHace, '09:00'), esPrueba, diasApertura, u.id_tienda]);
  return { ...u, vender: (instante) => db.runAsync(
    'INSERT INTO Ventas (id_vendedor, id_tienda, fecha_salida, precio_total) VALUES (?, ?, ?, 1000)', [u.id_usuario, u.id_tienda, instante]) };
}

const fila = async (vista, id) => db.getAsync(`SELECT * FROM interno.${vista} WHERE id_tienda = ?`, [id]);
const filas = async (vista, id) => db.allAsync(`SELECT * FROM interno.${vista} WHERE id_tienda = ? ORDER BY 1, 2`, [id]);
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

describe('migración', () => {
  it('se puede correr varias veces sin error y sin pisar fecha_creacion', async () => {
    const t = await tienda({ creadaHace: 5 });
    const antes = (await db.getAsync('SELECT fecha_creacion FROM Tienda WHERE id_tienda = ?', [t.id_tienda])).fecha_creacion;

    await asegurarPanelInterno(db.pool);
    await asegurarPanelInterno(db.pool);

    const despues = (await db.getAsync('SELECT fecha_creacion FROM Tienda WHERE id_tienda = ?', [t.id_tienda])).fecha_creacion;
    expect(despues.getTime()).toBe(antes.getTime());
  });

  it('rellena las tiendas que ya existían con la fecha de registro más antigua de sus usuarios', async () => {
    const t = await tienda();
    const registro = (await db.getAsync('SELECT fecha_registro FROM Usuarios WHERE id_usuario = ?', [t.id_usuario])).fecha_registro;
    // Se simula una base «vieja»: la columna existe pero la tienda quedó sin fecha.
    await db.pool.query('ALTER TABLE Tienda ALTER COLUMN fecha_creacion DROP NOT NULL');
    await db.pool.query('UPDATE Tienda SET fecha_creacion = NULL');

    await asegurarPanelInterno(db.pool);

    const rellena = (await db.getAsync('SELECT fecha_creacion FROM Tienda WHERE id_tienda = ?', [t.id_tienda])).fecha_creacion;
    expect(rellena.getTime()).toBe(registro.getTime());
    // Y la columna vuelve a quedar obligatoria, con su valor por defecto para las tiendas nuevas.
    const col = await db.getAsync("SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'tienda' AND column_name = 'fecha_creacion'");
    expect(col.is_nullable).toBe('NO');
    expect(col.column_default).toMatch(/CURRENT_TIMESTAMP|now\(\)/i);
  });

  it('el relleno NO toca las tiendas que ya tienen fecha: solo las que quedaron en NULL', async () => {
    const conFecha = await tienda({ creadaHace: 30 });
    const sinFecha = await tienda({ creadaHace: 1 });
    const intacta = (await db.getAsync('SELECT fecha_creacion FROM Tienda WHERE id_tienda = ?', [conFecha.id_tienda])).fecha_creacion;
    await db.pool.query('ALTER TABLE Tienda ALTER COLUMN fecha_creacion DROP NOT NULL');
    await db.pool.query('UPDATE Tienda SET fecha_creacion = NULL WHERE id_tienda = $1', [sinFecha.id_tienda]);

    await asegurarPanelInterno(db.pool);

    const despues = (await db.getAsync('SELECT fecha_creacion FROM Tienda WHERE id_tienda = ?', [conFecha.id_tienda])).fecha_creacion;
    expect(despues.getTime()).toBe(intacta.getTime());
    expect((await db.getAsync('SELECT fecha_creacion FROM Tienda WHERE id_tienda = ?', [sinFecha.id_tienda])).fecha_creacion).toBeInstanceOf(Date);
  });

  it('una sucursal sin usuarios propios toma la fecha de su primera venta (y no «ahora»)', async () => {
    const dueno = await crearUsuario();
    const sucursal = (await db.runAsync("INSERT INTO Tienda (nombre_establecimiento, id_propietario) VALUES ('Sucursal', ?) RETURNING id_tienda", [dueno.id_usuario])).lastID;
    const primera = hace(20, '08:00');
    await db.runAsync('INSERT INTO Ventas (id_vendedor, id_tienda, fecha_salida, precio_total) VALUES (?, ?, ?, 1000)', [dueno.id_usuario, sucursal, primera]);
    await db.pool.query('ALTER TABLE Tienda ALTER COLUMN fecha_creacion DROP NOT NULL');
    await db.pool.query('UPDATE Tienda SET fecha_creacion = NULL WHERE id_tienda = $1', [sucursal]);

    await asegurarPanelInterno(db.pool);

    const f = (await db.getAsync('SELECT fecha_creacion FROM Tienda WHERE id_tienda = ?', [sucursal])).fecha_creacion;
    expect(f.getTime()).toBe(primera.getTime());
  });

  it('una tienda nueva nace con fecha de creación, 7 días de apertura y sin marca de prueba', async () => {
    const u = await crearUsuario();
    const t = await db.getAsync('SELECT fecha_creacion, dias_apertura_semana, es_prueba FROM Tienda WHERE id_tienda = ?', [u.id_tienda]);
    expect(t.fecha_creacion).toBeInstanceOf(Date);
    expect(Math.abs(Date.now() - t.fecha_creacion.getTime())).toBeLessThan(60_000);
    expect(t.dias_apertura_semana).toBe(7);
    expect(t.es_prueba).toBe(false);
  });

  it.each([
    ['fecha_creacion', 'DROP DEFAULT'],
    ['dias_apertura_semana', 'DROP DEFAULT'],
    ['es_prueba', 'DROP DEFAULT'],
    ['dias_apertura_semana', 'DROP NOT NULL'],
    ['es_prueba', 'DROP NOT NULL']
  ])('se repara sola si %s pierde su configuración (%s): crear una tienda nueva sigue funcionando', async (columna, rotura) => {
    await db.pool.query(`ALTER TABLE Tienda ALTER COLUMN ${columna} ${rotura}`);

    await asegurarPanelInterno(db.pool);

    const col = await db.getAsync("SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'tienda' AND column_name = ?", [columna]);
    expect(col.is_nullable).toBe('NO');
    expect(col.column_default).not.toBeNull();
    await expect(crearUsuario()).resolves.toBeTruthy();   // crea tienda + usuario
  });

  it('dias_apertura_semana solo admite de 1 a 7', async () => {
    const u = await crearUsuario();
    await expect(db.runAsync('UPDATE Tienda SET dias_apertura_semana = 0 WHERE id_tienda = ?', [u.id_tienda])).rejects.toThrow();
    await expect(db.runAsync('UPDATE Tienda SET dias_apertura_semana = 8 WHERE id_tienda = ?', [u.id_tienda])).rejects.toThrow();
  });
});

describe('interno.v_activacion', () => {
  it('cuenta los días CALENDARIO con ventas dentro de los primeros 7 (registro = día 0)', async () => {
    const t = await tienda({ creadaHace: 10 });
    // días 0, 1, 2, 3 con 2 ventas cada uno: cuentan 4 días, no 8 ventas
    for (const dia of [0, 1, 2, 3]) { await t.vender(hace(10 - dia, '10:00')); await t.vender(hace(10 - dia, '15:00')); }
    // día 6 (el último de la ventana)
    await t.vender(hace(10 - 6, '10:00'));
    // día 7: FUERA de la ventana
    await t.vender(hace(10 - 7, '10:00'));

    const a = await fila('v_activacion', t.id_tienda);

    expect(a.dias_con_ventas_7d).toBe(5);
    expect(a.ventana_cerrada).toBe(true);
  });

  it('usa la hora de Bogotá: una venta a las 11:30 p. m. cuenta en SU día, no en el siguiente', async () => {
    const t = await tienda({ creadaHace: 10 });
    // 23:30 de Bogotá del día 6 = 04:30 UTC del día 7: en UTC caería FUERA de la ventana de 7 días.
    await t.vender(hace(10 - 6, '23:30'));

    const a = await fila('v_activacion', t.id_tienda);

    expect(a.dias_con_ventas_7d).toBe(1);
  });

  it('NO depende de la zona horaria de la sesión de la base: con la sesión en UTC (como Neon) da lo mismo', async () => {
    const t = await tienda({ creadaHace: 10 });
    await t.vender(hace(10 - 6, '23:30'));   // 04:30 UTC del día siguiente
    await t.vender(hace(10 - 3, '21:00'));   // 02:00 UTC del día siguiente

    const cliente = await db.pool.connect();
    try {
      await cliente.query("SET TIME ZONE 'UTC'");
      const { rows } = await cliente.query('SELECT dias_con_ventas_7d FROM interno.v_activacion WHERE id_tienda = $1', [t.id_tienda]);
      expect(rows[0].dias_con_ventas_7d).toBe(2);
      const semanas = await cliente.query('SELECT semana, dias_con_ventas FROM interno.v_adopcion_semanal WHERE id_tienda = $1 ORDER BY semana', [t.id_tienda]);
      expect(semanas.rows[0]).toMatchObject({ semana: 1, dias_con_ventas: 2 });
    } finally {
      await cliente.query('RESET TIME ZONE');
      cliente.release();
    }
  });

  it('una venta a las 12:30 a. m. del día 7 ya NO cuenta (frontera exacta)', async () => {
    const t = await tienda({ creadaHace: 10 });
    await t.vender(hace(10 - 7, '00:30'));

    expect((await fila('v_activacion', t.id_tienda)).dias_con_ventas_7d).toBe(0);
  });

  it('cuenta productos cargados y los cargados en los primeros 7 días (por fecha de entrada)', async () => {
    const t = await tienda({ creadaHace: 10 });
    const dentro1 = await crearProducto({ id_tienda: t.id_tienda });
    const dentro2 = await crearProducto({ id_tienda: t.id_tienda });
    const fuera = await crearProducto({ id_tienda: t.id_tienda });
    await db.runAsync('UPDATE Productos SET fecha_entrada = ? WHERE id_producto = ?', [diaIso(9), dentro1]);
    await db.runAsync('UPDATE Productos SET fecha_entrada = ? WHERE id_producto = ?', [diaIso(4), dentro2]);
    await db.runAsync('UPDATE Productos SET fecha_entrada = ? WHERE id_producto = ?', [diaIso(1), fuera]);

    const a = await fila('v_activacion', t.id_tienda);

    expect(a.productos_cargados).toBe(3);
    expect(a.productos_primeros_7d).toBe(2);
  });

  it('una tienda sin nada devuelve ceros (no desaparece ni da NULL)', async () => {
    const t = await tienda({ creadaHace: 2 });

    const a = await fila('v_activacion', t.id_tienda);

    expect(a).toMatchObject({ productos_cargados: 0, productos_primeros_7d: 0, dias_con_ventas_7d: 0, ventana_cerrada: false });
  });

  it('la ventana sigue abierta durante los 7 días del registro y se cierra al octavo', async () => {
    const dia6 = await tienda({ creadaHace: 6 });
    const dia7 = await tienda({ creadaHace: 7 });

    expect((await fila('v_activacion', dia6.id_tienda)).ventana_cerrada).toBe(false);
    expect((await fila('v_activacion', dia7.id_tienda)).ventana_cerrada).toBe(true);
  });

  it('EXCLUYE las tiendas de prueba', async () => {
    const real = await tienda();
    const prueba = await tienda({ esPrueba: true });

    expect(await fila('v_activacion', real.id_tienda)).toBeTruthy();
    expect(await fila('v_activacion', prueba.id_tienda)).toBeUndefined();
  });
});

describe('interno.v_adopcion_semanal', () => {
  it('reparte los días con ventas por semana de vida (semana 1 = días 0 a 6)', async () => {
    const t = await tienda({ creadaHace: 10, diasApertura: 6 });
    for (const dia of [0, 1, 2]) await t.vender(hace(10 - dia));      // semana 1: 3 días
    await t.vender(hace(10 - 7));                                      // semana 2: 1 día (el primero)
    await t.vender(hace(10 - 7, '16:00'));                             // el mismo día no cuenta dos veces

    const semanas = await filas('v_adopcion_semanal', t.id_tienda);

    expect(semanas).toHaveLength(2);
    expect(semanas[0]).toMatchObject({ semana: 1, dias_con_ventas: 3, dias_apertura_semana: 6, semana_completa: true });
    expect(iso(semanas[0].desde)).toBe(diaIso(10));
    expect(iso(semanas[0].hasta)).toBe(diaIso(4));
    expect(semanas[1]).toMatchObject({ semana: 2, dias_con_ventas: 1, semana_completa: false });
    expect(iso(semanas[1].desde)).toBe(diaIso(3));
  });

  it('una tienda de hoy tiene una sola semana, en curso y con cero días', async () => {
    const t = await tienda({ creadaHace: 0 });

    const semanas = await filas('v_adopcion_semanal', t.id_tienda);

    expect(semanas).toHaveLength(1);
    expect(semanas[0]).toMatchObject({ semana: 1, dias_con_ventas: 0, semana_completa: false });
  });

  it('una tienda muy antigua no genera más de 12 semanas', async () => {
    const t = await tienda({ creadaHace: 400 });
    expect(await filas('v_adopcion_semanal', t.id_tienda)).toHaveLength(12);
  });

  it('EXCLUYE las tiendas de prueba', async () => {
    const prueba = await tienda({ esPrueba: true });
    expect(await filas('v_adopcion_semanal', prueba.id_tienda)).toEqual([]);
  });
});

describe('interno.v_tiendas_resumen', () => {
  it('resume usuarios, productos, ventas, última venta y último acceso (solo conteos y fechas)', async () => {
    const t = await tienda({ creadaHace: 40 });
    await crearProducto({ id_tienda: t.id_tienda });
    await crearProducto({ id_tienda: t.id_tienda });
    await t.vender(hace(2));
    await t.vender(hace(2, '16:00'));
    await t.vender(hace(20));
    await t.vender(hace(35));
    const acceso = hace(1, '08:00');
    await db.runAsync('UPDATE Usuarios SET ultimo_acceso = ? WHERE id_usuario = ?', [acceso, t.id_usuario]);
    await crearUsuario({ id_tienda: t.id_tienda, rol: 'Tendero' });

    const r = await fila('v_tiendas_resumen', t.id_tienda);

    expect(r).toMatchObject({ usuarios: 2, productos: 2, ventas_7d: 2, ventas_30d: 3, dias_con_ventas_30d: 2, es_prueba: false, estado: 'Activo' });
    expect(r.ultima_venta.getTime()).toBe(hace(2, '16:00').getTime());
    expect(r.ultimo_acceso.getTime()).toBe(acceso.getTime());
  });

  it('INCLUYE las tiendas de prueba, con su marca (para poder marcarlas desde el panel)', async () => {
    const prueba = await tienda({ esPrueba: true });
    expect((await fila('v_tiendas_resumen', prueba.id_tienda)).es_prueba).toBe(true);
  });

  it('dueno_acepto_politica sale del PROPIETARIO de la tienda, no de cualquier usuario', async () => {
    const t = await tienda();
    await db.runAsync('UPDATE Tienda SET id_propietario = ? WHERE id_tienda = ?', [t.id_usuario, t.id_tienda]);
    await db.runAsync('UPDATE Usuarios SET fecha_aceptacion_politica_datos = NULL WHERE id_usuario = ?', [t.id_usuario]);
    // Un Tendero de la misma tienda que SÍ aceptó (las fixtures lo marcan para todos) no debe contar como el dueño.
    await crearUsuario({ id_tienda: t.id_tienda, rol: 'Tendero' });

    expect((await fila('v_tiendas_resumen', t.id_tienda)).dueno_acepto_politica).toBe(false);

    await db.runAsync('UPDATE Usuarios SET fecha_aceptacion_politica_datos = CURRENT_TIMESTAMP WHERE id_usuario = ?', [t.id_usuario]);
    expect((await fila('v_tiendas_resumen', t.id_tienda)).dueno_acepto_politica).toBe(true);
  });

  it('una tienda sin propietario registrado no rompe la vista (acepto = falso)', async () => {
    const t = await tienda();
    await db.runAsync('UPDATE Tienda SET id_propietario = NULL WHERE id_tienda = ?', [t.id_tienda]);
    expect((await fila('v_tiendas_resumen', t.id_tienda)).dueno_acepto_politica).toBe(false);
  });
});

describe('PRIVACIDAD: las vistas solo exponen las columnas permitidas', () => {
  // Si alguien agrega una columna a una vista (un monto, un nombre de producto, un dato de cliente…), esta prueba
  // falla y obliga a decidirlo a propósito. Plan 22, secciones 2 y 3.6; Ley 1581 de 2012.
  const PERMITIDAS = {
    v_ventas_dia: ['id_tienda', 'dia', 'ventas'],
    v_tiendas_resumen: ['id_tienda', 'nombre', 'ciudad', 'estado', 'es_prueba', 'fecha_creacion', 'dias_apertura_semana', 'usuarios',
      'dueno_acepto_politica', 'productos', 'ventas_7d', 'ventas_30d', 'dias_con_ventas_30d', 'ultima_venta', 'ultimo_acceso'],
    v_activacion: ['id_tienda', 'fecha_creacion', 'dia_registro', 'productos_cargados', 'productos_primeros_7d', 'dias_con_ventas_7d', 'ventana_cerrada'],
    v_adopcion_semanal: ['id_tienda', 'semana', 'desde', 'hasta', 'dias_con_ventas', 'dias_apertura_semana', 'semana_completa']
  };

  it.each(Object.entries(PERMITIDAS))('%s expone exactamente las columnas esperadas', async (vista, esperadas) => {
    const cols = await db.allAsync(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'interno' AND table_name = ? ORDER BY ordinal_position", [vista]);
    expect(cols.map(c => c.column_name)).toEqual(esperadas);
  });

  it('no existe ninguna otra vista en el esquema interno sin revisar', async () => {
    const vistas = await db.allAsync("SELECT table_name FROM information_schema.views WHERE table_schema = 'interno' ORDER BY table_name");
    expect(vistas.map(v => v.table_name)).toEqual(Object.keys(PERMITIDAS).sort());
  });
});
