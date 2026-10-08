/**
 * @file panel_interno_metricas.test.js
 * @description Plan 22, I2: los endpoints de métricas del panel interno (Tiendas, Detalle, Embudo, Bitácora) y la marca
 * de «tienda de prueba». Cubre: las definiciones aplicadas de punta a punta, el caso de UNA sola tienda (el piloto
 * mínimo), la privacidad (solo conteos y fechas: ningún monto), la bitácora de cada consulta y que sin rastro no se
 * entregan datos.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';
import { authenticator } from 'otplib';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { reiniciarLimitadores } from './helpers/limitadores.js';
import { crearUsuario, crearProducto, crearMiembroEquipo } from './helpers/fixtures.js';
import { obtenerCsrfToken } from './helpers/sesion.js';

// El servicio de bitácora se carga con `require`: es la MISMA copia que usa metricas.js (con `import`, el espía no la alcanzaría).
const bitacoraServicio = createRequire(import.meta.url)('../../services/interno/bitacora.js');

let hoy;
beforeEach(async () => {
  await limpiarBaseDePruebas();
  await reiniciarLimitadores();
  hoy = (await db.getAsync("SELECT to_char((NOW() AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD') AS d")).d;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const diaIso = (n) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
const hace = (n, hora = '10:00') => new Date(`${diaIso(n)}T${hora}:00-05:00`);

/** Tienda con su Administrador, fecha de creación `creadaHace` días atrás, y `productos` productos cargados. */
async function tiendaPiloto({ creadaHace = 0, esPrueba = false, diasApertura = 7, productos = 0, nombre } = {}) {
  const u = await crearUsuario();
  await db.runAsync('UPDATE Tienda SET fecha_creacion = ?, es_prueba = ?, dias_apertura_semana = ?, nombre_establecimiento = COALESCE(?, nombre_establecimiento) WHERE id_tienda = ?',
    [hace(creadaHace, '09:00'), esPrueba, diasApertura, nombre || null, u.id_tienda]);
  await db.runAsync('UPDATE Tienda SET id_propietario = ? WHERE id_tienda = ?', [u.id_usuario, u.id_tienda]);
  for (let i = 0; i < productos; i++) await crearProducto({ id_tienda: u.id_tienda });
  const vender = (instante, total = 1000) => db.runAsync(
    'INSERT INTO Ventas (id_vendedor, id_tienda, fecha_salida, precio_total) VALUES (?, ?, ?, ?)', [u.id_usuario, u.id_tienda, instante, total]);
  /** Vende en los días `offsets` contados desde el día del registro (0 = el día del registro). */
  const venderEnDias = async (offsets, total) => { for (const o of offsets) await vender(hace(creadaHace - o), total); };
  return { ...u, vender, venderEnDias };
}

async function entrarComoEquipo() {
  const m = await crearMiembroEquipo();
  const agente = request.agent(app);
  let csrf = await obtenerCsrfToken(agente);
  await agente.post('/api/interno/login').set('X-CSRF-Token', csrf).send({ usuario: m.usuario, password: m.password });
  csrf = await obtenerCsrfToken(agente);
  await agente.post('/api/interno/2fa').set('X-CSRF-Token', csrf).send({ token: authenticator.generate(m.secreto) });
  return { agente, miembro: m, csrf: await obtenerCsrfToken(agente) };
}

const acciones = async () => (await db.allAsync('SELECT accion FROM interno.bitacora ORDER BY id')).map(b => b.accion);

describe('GET /api/interno/tiendas', () => {
  it('lista las tiendas del piloto con su activación y adopción (el caso de UNA sola tienda)', async () => {
    const t = await tiendaPiloto({ creadaHace: 10, productos: 22, nombre: 'Tienda Doña Rosa' });
    await t.venderEnDias([0, 1, 2, 3, 4, 5]);       // semana 1: 6 días con ventas
    await t.venderEnDias([7, 8]);                    // semana 2 (en curso): 2 días
    const { agente } = await entrarComoEquipo();

    const r = await agente.get('/api/interno/tiendas');

    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.tiendas).toHaveLength(1);
    const tienda = r.body.tiendas[0];
    expect(tienda).toMatchObject({
      id_tienda: t.id_tienda, nombre: 'Tienda Doña Rosa', es_prueba: false, dias_apertura_semana: 7,
      usuarios: 1, productos: 22, dueno_acepto_politica: true
    });
    expect(tienda.activacion).toMatchObject({ estado: 'activada', productos_cargados: 22, dias_con_ventas_7d: 6, ventana_cerrada: true });
    // El semáforo usa la última semana COMPLETA (la 1: 6 de 7 días = 86 %), no la que va a medias.
    expect(tienda.adopcion).toMatchObject({ semana: 1, completa: true, dias_con_ventas: 6, nivel: 'meta' });
    expect(tienda.adopcion.razon).toBeCloseTo(6 / 7);
    expect(r.body.metas).toMatchObject({ activacion: 0.25, adopcion: 0.8, umbral_productos: 20, umbral_dias_con_ventas: 5 });
  });

  it('una tienda que no llega al umbral queda «en curso» mientras su ventana siga abierta y «no activada» al cerrarse', async () => {
    const reciente = await tiendaPiloto({ creadaHace: 2, productos: 5 });
    const antigua = await tiendaPiloto({ creadaHace: 9, productos: 5 });
    await reciente.venderEnDias([0, 1]);
    await antigua.venderEnDias([0, 1]);
    const { agente } = await entrarComoEquipo();

    const { tiendas } = (await agente.get('/api/interno/tiendas')).body;

    const estado = (id) => tiendas.find(t => t.id_tienda === id).activacion.estado;
    expect(estado(reciente.id_tienda)).toBe('en_curso');
    expect(estado(antigua.id_tienda)).toBe('no_activada');
  });

  it('por defecto EXCLUYE las tiendas de prueba; con ?incluirPrueba=true las muestra, marcadas y sin activación', async () => {
    const real = await tiendaPiloto();
    const prueba = await tiendaPiloto({ esPrueba: true });
    const { agente } = await entrarComoEquipo();

    const sinPrueba = (await agente.get('/api/interno/tiendas')).body.tiendas.map(t => t.id_tienda);
    const conPrueba = (await agente.get('/api/interno/tiendas?incluirPrueba=true')).body.tiendas;

    expect(sinPrueba).toEqual([real.id_tienda]);
    expect(conPrueba.map(t => t.id_tienda).sort()).toEqual([real.id_tienda, prueba.id_tienda].sort());
    const marcada = conPrueba.find(t => t.id_tienda === prueba.id_tienda);
    expect(marcada.es_prueba).toBe(true);
    expect(marcada.activacion).toBeNull();
    expect(marcada.adopcion).toBeNull();
  });

  it('sin ninguna tienda responde una lista vacía (no un error)', async () => {
    const { agente } = await entrarComoEquipo();
    const r = await agente.get('/api/interno/tiendas');
    expect(r.status).toBe(200);
    expect(r.body.tiendas).toEqual([]);
  });

  it('cada consulta queda en la bitácora, con quién la hizo', async () => {
    await tiendaPiloto();
    const { agente, miembro } = await entrarComoEquipo();

    await agente.get('/api/interno/tiendas?incluirPrueba=true');

    const fila = await db.getAsync("SELECT id_equipo, detalle FROM interno.bitacora WHERE accion = 'ver_tiendas'");
    expect(fila.id_equipo).toBe(miembro.id_equipo);
    expect(fila.detalle).toEqual({ incluirPrueba: true });
  });

  it('SIN RASTRO NO HAY DATOS: si no se puede escribir en la bitácora, responde 500 y no entrega métricas', async () => {
    await tiendaPiloto({ nombre: 'Tienda Secreta' });
    const { agente } = await entrarComoEquipo();
    vi.spyOn(bitacoraServicio, 'registrar').mockRejectedValue(new Error('bitácora no disponible'));

    const r = await agente.get('/api/interno/tiendas');

    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('Tienda Secreta');
  });
});

describe('PRIVACIDAD: solo conteos, fechas y estados', () => {
  const PROHIBIDAS = ['precio', 'monto', 'total_venta', 'precio_total', 'nombre_producto', 'cliente', 'celular', 'correo', 'contrasena', 'password', 'secret', 'secreto', 'token'];

  const clavesDe = (valor, acumulado = new Set()) => {
    if (Array.isArray(valor)) valor.forEach(v => clavesDe(v, acumulado));
    else if (valor && typeof valor === 'object') for (const [k, v] of Object.entries(valor)) { acumulado.add(k.toLowerCase()); clavesDe(v, acumulado); }
    return acumulado;
  };

  it('ninguna respuesta incluye montos, productos, clientes ni credenciales (ni como clave ni como valor)', async () => {
    const t = await tiendaPiloto({ creadaHace: 10, productos: 3 });
    await t.venderEnDias([0, 1, 2], 987654);   // monto inconfundible
    await crearProducto({ id_tienda: t.id_tienda, nombre_producto: 'Aguardiente Cristal Premium' });
    await db.runAsync("INSERT INTO Clientes (id_tienda, nombre, celular, limite_credito) VALUES (?, 'Cliente Reservado', '3105550000', 0)", [t.id_tienda]);
    const { agente } = await entrarComoEquipo();

    const respuestas = [
      await agente.get('/api/interno/tiendas?incluirPrueba=true'),
      await agente.get(`/api/interno/tiendas/${t.id_tienda}`),
      await agente.get('/api/interno/embudo'),
      await agente.get('/api/interno/bitacora')
    ];

    for (const r of respuestas) {
      expect(r.status).toBe(200);
      const texto = JSON.stringify(r.body);
      for (const prohibido of ['987654', 'Aguardiente', 'Cliente Reservado', '3105550000', t.correo]) {
        expect(texto, prohibido).not.toContain(prohibido);
      }
      const claves = clavesDe(r.body);
      for (const prohibida of PROHIBIDAS) expect(claves.has(prohibida), `clave «${prohibida}»`).toBe(false);
    }
  });
});

describe('GET /api/interno/tiendas/:id', () => {
  it('devuelve el detalle: métricas, semanas con su razón y el historial de lo que el equipo hizo con la tienda', async () => {
    const t = await tiendaPiloto({ creadaHace: 10, productos: 21, diasApertura: 6 });
    await t.venderEnDias([0, 1, 2, 3, 4]);
    await t.venderEnDias([7]);
    const { agente, miembro, csrf } = await entrarComoEquipo();
    await agente.put(`/api/interno/tiendas/${t.id_tienda}/es-prueba`).set('X-CSRF-Token', csrf).send({ esPrueba: false });

    const r = await agente.get(`/api/interno/tiendas/${t.id_tienda}`);

    expect(r.status).toBe(200);
    expect(r.body.tienda).toMatchObject({ id_tienda: t.id_tienda, dias_apertura_semana: 6 });
    expect(r.body.tienda.activacion.estado).toBe('activada');
    expect(r.body.semanas).toHaveLength(2);
    expect(r.body.semanas[0]).toMatchObject({ semana: 1, dias_con_ventas: 5, dias_apertura_semana: 6, completa: true, nivel: 'meta' });
    expect(r.body.semanas[1]).toMatchObject({ semana: 2, dias_con_ventas: 1, completa: false });
    expect(r.body.semanas[0].desde).toBe(diaIso(10));
    expect(r.body.historial[0]).toMatchObject({ accion: 'marcar_prueba', id_equipo: miembro.id_equipo });
  });

  it('una tienda de prueba se puede consultar, sin activación ni semanas', async () => {
    const prueba = await tiendaPiloto({ esPrueba: true });
    const { agente } = await entrarComoEquipo();
    const r = await agente.get(`/api/interno/tiendas/${prueba.id_tienda}`);
    expect(r.status).toBe(200);
    expect(r.body.tienda.es_prueba).toBe(true);
    expect(r.body.tienda.activacion).toBeNull();
    expect(r.body.semanas).toEqual([]);
  });

  it.each([['inexistente', '999999', 404], ['no numérico', 'abc', 400], ['cero', '0', 400], ['negativo', '-3', 400], ['decimal', '1.5', 400]])('id %s → %i', async (_n, id, estado) => {
    const { agente } = await entrarComoEquipo();
    expect((await agente.get(`/api/interno/tiendas/${id}`)).status).toBe(estado);
  });

  it('deja constancia de qué tienda se consultó', async () => {
    const t = await tiendaPiloto();
    const { agente } = await entrarComoEquipo();
    await agente.get(`/api/interno/tiendas/${t.id_tienda}`);
    const fila = await db.getAsync("SELECT id_tienda FROM interno.bitacora WHERE accion = 'ver_tienda'");
    expect(fila.id_tienda).toBe(t.id_tienda);
  });
});

describe('GET /api/interno/embudo', () => {
  it('sin tiendas no inventa porcentajes', async () => {
    const { agente } = await entrarComoEquipo();
    const r = await agente.get('/api/interno/embudo');
    expect(r.status).toBe(200);
    expect(r.body.embudo).toMatchObject({ registros: 0, activadas: 0, tasa_activacion: null });
  });

  it('cuenta registros, activadas y uso en la semana 4, SIN las tiendas de prueba', async () => {
    const activada = await tiendaPiloto({ creadaHace: 30, productos: 20 });
    await activada.venderEnDias([0, 1, 2, 3, 4, 21, 22]);                 // activada y con uso en la semana 4
    const fallida = await tiendaPiloto({ creadaHace: 30, productos: 3 });
    await fallida.venderEnDias([0]);                                        // ventana cerrada sin activar; semana 4 sin uso
    const nueva = await tiendaPiloto({ creadaHace: 1, productos: 1 });      // en curso
    await nueva.venderEnDias([0]);
    const prueba = await tiendaPiloto({ creadaHace: 30, productos: 50, esPrueba: true });
    await prueba.venderEnDias([0, 1, 2, 3, 4, 5, 6]);                       // no debe contar
    const { agente } = await entrarComoEquipo();

    const { embudo } = (await agente.get('/api/interno/embudo')).body;

    expect(embudo).toMatchObject({ registros: 3, activadas: 1, en_curso: 1, no_activadas: 1 });
    expect(embudo.tasa_activacion).toBeCloseTo(1 / 3);
    expect(embudo.semana_4).toMatchObject({ alcanzaron: 2, con_uso: 1, tasa: 0.5 });
    // Adopción: la última semana completa de las dos tiendas con historia (la 4: 2 de 7 días y 0 de 7); ninguna llega al 80 %.
    expect(embudo.adopcion).toMatchObject({ evaluadas: 2, en_meta: 0, tasa_en_meta: 0, meta: 0.8 });
  });

  it('con UNA sola tienda activada da 1 de 1', async () => {
    const t = await tiendaPiloto({ creadaHace: 8, productos: 20 });
    await t.venderEnDias([0, 1, 2, 3, 4]);
    const { agente } = await entrarComoEquipo();
    const { embudo } = (await agente.get('/api/interno/embudo')).body;
    expect(embudo).toMatchObject({ registros: 1, activadas: 1, tasa_activacion: 1 });
  });
});

describe('GET /api/interno/bitacora', () => {
  it('lista lo ocurrido, lo más reciente primero, con el nombre de quien lo hizo', async () => {
    const { agente } = await entrarComoEquipo();
    await agente.get('/api/interno/tiendas');

    const r = await agente.get('/api/interno/bitacora');

    expect(r.status).toBe(200);
    const acc = r.body.registros.map(b => b.accion);
    expect(acc[0]).toBe('ver_bitacora');
    expect(acc).toEqual(expect.arrayContaining(['ver_tiendas', 'login_ok']));
    expect(r.body.registros.find(b => b.accion === 'login_ok').equipo).toBe('Integrante de Prueba');
    expect(r.body.total).toBeGreaterThanOrEqual(3);
  });

  it('pagina con limite y desde; el límite máximo es 200 y un valor absurdo no rompe nada', async () => {
    const { agente } = await entrarComoEquipo();
    for (let i = 0; i < 4; i++) await agente.get('/api/interno/tiendas');
    // Más filas que el tope, para que el límite de 200 realmente se ejerza.
    await db.pool.query("INSERT INTO interno.bitacora (accion) SELECT 'ver_tiendas' FROM generate_series(1, 250)");

    const pagina = await agente.get('/api/interno/bitacora?limite=2&desde=1');
    const enorme = await agente.get('/api/interno/bitacora?limite=999999');
    const basura = await agente.get('/api/interno/bitacora?limite=abc&desde=-5');

    expect(pagina.body.registros).toHaveLength(2);
    expect(enorme.status).toBe(200);
    expect(enorme.body.registros).toHaveLength(200);
    expect(enorme.body.total).toBeGreaterThanOrEqual(250);
    expect(basura.status).toBe(200);
  });
});

describe('PUT /api/interno/tiendas/:id/es-prueba', () => {
  it('marca una tienda como de prueba: sale de las métricas del piloto y queda en la bitácora (de → a)', async () => {
    const t = await tiendaPiloto({ productos: 2 });
    const { agente, csrf, miembro } = await entrarComoEquipo();
    expect((await agente.get('/api/interno/embudo')).body.embudo.registros).toBe(1);

    const r = await agente.put(`/api/interno/tiendas/${t.id_tienda}/es-prueba`).set('X-CSRF-Token', csrf).send({ esPrueba: true });

    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, id_tienda: t.id_tienda, es_prueba: true });
    expect((await agente.get('/api/interno/embudo')).body.embudo.registros).toBe(0);
    const fila = await db.getAsync("SELECT id_equipo, id_tienda, detalle FROM interno.bitacora WHERE accion = 'marcar_prueba'");
    expect(fila).toMatchObject({ id_equipo: miembro.id_equipo, id_tienda: t.id_tienda, detalle: { de: false, a: true } });
  });

  it('se puede desmarcar', async () => {
    const t = await tiendaPiloto({ esPrueba: true });
    const { agente, csrf } = await entrarComoEquipo();
    await agente.put(`/api/interno/tiendas/${t.id_tienda}/es-prueba`).set('X-CSRF-Token', csrf).send({ esPrueba: false });
    expect((await db.getAsync('SELECT es_prueba FROM Tienda WHERE id_tienda = ?', [t.id_tienda])).es_prueba).toBe(false);
  });

  it.each([['texto', 'true'], ['número', 1], ['null', null], ['ausente', undefined], ['lista', [true]]])('rechaza con 400 un valor que no es booleano (%s) y no cambia nada', async (_n, valor) => {
    const t = await tiendaPiloto();
    const { agente, csrf } = await entrarComoEquipo();
    const r = await agente.put(`/api/interno/tiendas/${t.id_tienda}/es-prueba`).set('X-CSRF-Token', csrf).send({ esPrueba: valor });
    expect(r.status).toBe(400);
    expect((await db.getAsync('SELECT es_prueba FROM Tienda WHERE id_tienda = ?', [t.id_tienda])).es_prueba).toBe(false);
  });

  it('una tienda inexistente responde 404 y no deja rastro de un cambio', async () => {
    const { agente, csrf } = await entrarComoEquipo();
    const r = await agente.put('/api/interno/tiendas/999999/es-prueba').set('X-CSRF-Token', csrf).send({ esPrueba: true });
    expect(r.status).toBe(404);
    expect(await acciones()).not.toContain('marcar_prueba');
  });

  it('exige el token CSRF y la sesión del equipo', async () => {
    const t = await tiendaPiloto();
    const { agente } = await entrarComoEquipo();
    expect((await agente.put(`/api/interno/tiendas/${t.id_tienda}/es-prueba`).send({ esPrueba: true })).status).toBe(403);
    const anonimo = request.agent(app);
    const csrf = await obtenerCsrfToken(anonimo);
    expect((await anonimo.put(`/api/interno/tiendas/${t.id_tienda}/es-prueba`).set('X-CSRF-Token', csrf).send({ esPrueba: true })).status).toBe(401);
    expect((await db.getAsync('SELECT es_prueba FROM Tienda WHERE id_tienda = ?', [t.id_tienda])).es_prueba).toBe(false);
  });

  it('ATÓMICO: si no se puede escribir la bitácora, el cambio se revierte (no queda una marca sin rastro)', async () => {
    const t = await tiendaPiloto();
    const { agente, csrf } = await entrarComoEquipo();
    vi.spyOn(bitacoraServicio, 'registrar').mockRejectedValue(new Error('bitácora no disponible'));

    const r = await agente.put(`/api/interno/tiendas/${t.id_tienda}/es-prueba`).set('X-CSRF-Token', csrf).send({ esPrueba: true });

    expect(r.status).toBe(500);
    expect((await db.getAsync('SELECT es_prueba FROM Tienda WHERE id_tienda = ?', [t.id_tienda])).es_prueba).toBe(false);
  });
});
