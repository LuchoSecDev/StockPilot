// database/seed_demo.js
// Plan 25, fase 1. Siembra la TIENDA DE DEMOSTRACIÓN (database/demoEscenario.js) en una base LOCAL de demostración.
//
// ⚠️ VACÍA todas las tablas de la app (menos el esquema `interno`, que guarda las cuentas del equipo y la bitácora) de la
// base a la que apunte DATABASE_URL, y vuelve a sembrar. Por eso, como comando, solo corre contra un host local y una base
// cuyo nombre termine en `_demo` (evaluarGuardiaDemo). Reiniciar la demostración es volver a correr el mismo comando; las
// fechas del escenario son relativas a «hoy», así que se siembra el mismo día de la visita.
//
// Uso (ver docs/guion_demo_tienda.md):
//   npm run demo:sembrar        (lee .env.demo: DATABASE_URL de stockpilot_demo, DEMO_PASSWORD y DEMO_CORREO_PROVEEDOR)
//
// `config/database.js` se conecta y migra al cargarse, así que NUNCA se carga antes de pasar la guardia: se requiere
// dentro de `sembrarDemo`, y el bloque de línea de comandos evalúa la guardia primero.

const bcrypt = require('bcrypt');
const { evaluarGuardiaSemilla } = require('./guardiaSemilla');
const { armarEscenario } = require('./demoEscenario');

const SALT_ROUNDS = 10; // el mismo que models/User.js
const SEMILLA = 25;
const LARGO_MINIMO_CLAVE = 8;

// Todas las tablas de la app (misma lista que tests/integration/helpers/db.js), sin `interno.*`.
const TABLAS = [
    'abonos', 'alertas', 'auditoria_ia', 'cache_ia', 'clientes', 'egresoscaja', 'feedback_ia',
    'historial_precios', 'movimientosstock', 'notificacionesusuario', 'ordenes_detalle',
    'ordenes_compra', 'productos', 'promociones_manuales', 'proveedores', 'reportes',
    'sesioncaja', 'session', 'usuarios', 'ventasproductos', 'ventas', 'tienda'
];

/**
 * La guardia de la semilla (host local) MÁS el sufijo `_demo`: el comando nunca puede vaciar `stockpilot`,
 * `stockpilot_test` ni una base remota. No se toca guardiaSemilla.js.
 * @param {string|undefined} databaseUrl
 * @returns {{ok: boolean, motivo?: string}}
 */
function evaluarGuardiaDemo(databaseUrl) {
    const base = evaluarGuardiaSemilla(databaseUrl, { permitirBaseLocal: true });
    if (!base.ok) return base;
    const nombre = new URL(databaseUrl).pathname.replace(/^\//, '');
    if (!nombre.endsWith('_demo')) {
        return { ok: false, motivo: `la base "${nombre}" no termina en "_demo". La siembra de demostración vacía TODA la base: crea una aparte (stockpilot_demo) y apúntala en .env.demo.` };
    }
    return { ok: true };
}

/**
 * Vacía las tablas de la app y siembra el escenario, todo en UNA transacción; después genera las alertas.
 * Usa el `db` global de config/database.js (también lo usa Alert.generate).
 * @param {Object} opciones
 * @param {string} opciones.contrasena - Clave de la cuenta de demostración (mínimo 8 caracteres).
 * @param {string} [opciones.hoy] - Fecha de Bogotá (YYYY-MM-DD). Por defecto, la de hoy.
 * @param {string} [opciones.correoProveedor] - Buzón del proveedor A (D3 = B del plan 25).
 * @param {number} [opciones.semilla]
 * @returns {Promise<{id_tienda:number, id_admin:number, alertas:number, hoy:string}>}
 */
async function sembrarDemo({ contrasena, hoy, correoProveedor, semilla = SEMILLA } = {}) {
    if (typeof contrasena !== 'string' || contrasena.length < LARGO_MINIMO_CLAVE) {
        throw new Error(`sembrarDemo: la contraseña de la cuenta de demostración es obligatoria (mínimo ${LARGO_MINIMO_CLAVE} caracteres).`);
    }
    const db = require('../config/database');
    await db.migrationReady; // sin esperar la auto-migración, el TRUNCATE compite con ella (deadlock)
    const Alert = require('../models/Alert');

    const fecha = hoy || db.getBogotaDate();
    const esc = armarEscenario({ hoy: fecha, semilla, correoProveedor });
    const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);

    const client = await db.getClient();
    let id_tienda;
    let id_admin;
    try {
        await client.query('BEGIN');

        // 1) Vaciar (solo las tablas que existen en esta base).
        const existentes = [];
        for (const t of TABLAS) {
            const { rows } = await client.query('SELECT to_regclass(?) AS r', [t]);
            if (rows[0].r) existentes.push(t);
        }
        await client.query(`TRUNCATE ${existentes.join(', ')} RESTART IDENTITY CASCADE`);

        // 2) Tienda y Administrador (el dueño).
        const t = esc.tienda;
        id_tienda = (await client.query(
            `INSERT INTO Tienda (nombre_establecimiento, direccion, anio_creacion, ciudad, celular, estado, es_prueba, dias_apertura_semana, fecha_creacion)
             VALUES (?, ?, ?, ?, ?, 'Activo', ?, ?, ?) RETURNING id_tienda`,
            [t.nombre_establecimiento, t.direccion, t.anio_creacion, t.ciudad, t.celular, t.es_prueba, t.dias_apertura_semana, t.fecha_creacion]
        )).rows[0].id_tienda;
        const a = esc.admin;
        id_admin = (await client.query(
            `INSERT INTO Usuarios (nombres, genero, correo, celular, usuario, contrasena, rol, id_tienda, cambio_clave_forzoso, fecha_aceptacion_politica_datos)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?) RETURNING id_usuario`,
            [a.nombres, a.genero, a.correo, a.celular, a.usuario, hash, a.rol, id_tienda, t.fecha_creacion]
        )).rows[0].id_usuario;
        await client.query('UPDATE Tienda SET id_propietario = ? WHERE id_tienda = ?', [id_admin, id_tienda]);

        // 3) Proveedores.
        const idProv = new Map();
        for (const p of esc.proveedores) {
            const r = await client.query(
                `INSERT INTO Proveedores (nombre_empresa, nit, contacto_principal, telefono, email, correo, direccion, id_tienda, estado)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Activo') RETURNING id_proveedor`,
                [p.nombre_empresa, p.nit, p.contacto_principal, p.telefono, p.email, p.email, p.direccion, id_tienda]
            );
            idProv.set(p.clave, r.rows[0].id_proveedor);
        }

        // 4) Productos.
        const idProd = new Map();
        for (const p of esc.productos) {
            const r = await client.query(
                `INSERT INTO Productos (codigo, nombre_producto, categoria, subcategoria, tipo_producto, precio, costo_compra, cantidad,
                                        stock_minimo, stock_maximo, stock_seguridad, lead_time, frecuencia_compra_dias,
                                        fecha_vencimiento, fecha_entrada, estado, id_tienda, id_proveedor)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Disponible', ?, ?) RETURNING id_producto`,
                [p.codigo, p.nombre, p.categoria, p.subcategoria, p.tipo, p.precio, p.costo, p.cantidad,
                 p.stock_minimo, p.stock_maximo, p.stock_seguridad, p.lead_time, p.frecuencia_compra_dias,
                 p.vencimiento, p.fecha_entrada, id_tienda, idProv.get(p.proveedor)]
            );
            idProd.set(p.clave, r.rows[0].id_producto);
        }

        // 5) Clientes.
        const idCli = new Map();
        for (const c of esc.clientes) {
            const r = await client.query(
                `INSERT INTO Clientes (id_tienda, nombre, celular, limite_credito, fecha_registro) VALUES (?, ?, ?, ?, ?) RETURNING id_cliente`,
                [id_tienda, c.nombre, c.celular, c.limite_credito, t.fecha_creacion]
            );
            idCli.set(c.clave, r.rows[0].id_cliente);
        }

        // 6) Caja de ayer (cerrada), con su arqueo ya calculado.
        const idSes = new Map();
        for (const s of esc.sesiones) {
            const r = await client.query(
                `INSERT INTO SesionCaja (id_tienda, id_vendedor, monto_apertura, monto_cierre_declarado, monto_cierre_calculado, diferencia, fecha_apertura, fecha_cierre, estado)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id_sesion`,
                [id_tienda, id_admin, s.monto_apertura, s.monto_cierre_declarado, s.monto_cierre_calculado, s.diferencia, s.fecha_apertura, s.fecha_cierre, s.estado]
            );
            idSes.set(s.clave, r.rows[0].id_sesion);
        }

        // 7) Ventas y sus líneas (en el orden del escenario: el id real coincide con el del escenario tras RESTART IDENTITY).
        const idVenta = new Map();
        for (const v of esc.ventas) {
            const r = await client.query(
                `INSERT INTO Ventas (id_vendedor, id_tienda, id_sesion_caja, id_cliente, fecha_salida, precio_total, metodo_pago, estado_deuda, efectivo_recibido, cambio_devuelto, canal)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'web') RETURNING id_venta`,
                [id_admin, id_tienda, v.sesion ? idSes.get(v.sesion) : null, v.cliente ? idCli.get(v.cliente) : null, v.instante,
                 v.total, v.metodo_pago, v.estado_deuda, v.efectivo_recibido, v.cambio_devuelto]
            );
            idVenta.set(v.id, r.rows[0].id_venta);
            for (const it of v.items) {
                await client.query(
                    'INSERT INTO VentasProductos (id_venta, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
                    [idVenta.get(v.id), idProd.get(it.producto), it.cantidad, it.precio]
                );
            }
        }

        // 8) Abonos y egresos de caja.
        for (const ab of esc.abonos) {
            await client.query(
                `INSERT INTO Abonos (id_cliente, id_tienda, id_sesion_caja, monto, metodo_pago, fecha_abono, id_usuario_recibe) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [idCli.get(ab.cliente), id_tienda, ab.sesion ? idSes.get(ab.sesion) : null, ab.monto, ab.metodo_pago, ab.instante, id_admin]
            );
        }
        for (const e of esc.egresos) {
            await client.query(
                `INSERT INTO EgresosCaja (id_sesion_caja, id_tienda, id_usuario, monto, motivo, categoria, estado, aprobado_por, fecha_aprobacion, fecha_registro)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [idSes.get(e.sesion), id_tienda, id_admin, e.monto, e.motivo, e.categoria, e.estado, id_admin, e.instante, e.instante]
            );
        }

        // 9) Pedidos.
        for (const o of esc.ordenes) {
            const r = await client.query(
                `INSERT INTO Ordenes_Compra (id_tienda, id_proveedor, id_usuario, fecha_creacion, fecha_aprobacion, estado, total_estimado, presupuesto_total, riesgo, origen)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id_orden`,
                [id_tienda, idProv.get(o.proveedor), id_admin, o.fecha_creacion, o.fecha_aprobacion, o.estado, o.presupuesto_total, o.presupuesto_total, o.riesgo, o.origen]
            );
            for (const l of o.lineas) {
                await client.query(
                    `INSERT INTO Ordenes_Detalle (id_orden, id_producto, cantidad_sugerida, cantidad_final, costo_unitario, urgencia, costo_estimado)
                     VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
                    [r.rows[0].id_orden, idProd.get(l.producto), l.cantidad_sugerida, l.cantidad_final, l.costo_unitario, l.urgencia]
                );
            }
        }

        // 10) Kardex: entrada inicial y una salida por cada línea vendida.
        for (const m of esc.movimientos) {
            const obs = m.venta ? `Venta #${String(idVenta.get(m.venta)).padStart(6, '0')}` : m.observacion;
            await client.query(
                `INSERT INTO MovimientosStock (id_producto, tipo_movimiento, cantidad, stock_final, fecha_movimiento, observacion, id_usuario, id_tienda)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [idProd.get(m.producto), m.tipo_movimiento, m.cantidad, m.stock_final, m.instante, obs, id_admin, id_tienda]
            );
        }

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    // Las alertas se generan fuera de la transacción (Alert.generate abre la suya).
    const alertas = await Alert.generate(id_tienda);
    return { id_tienda, id_admin, alertas, hoy: fecha };
}

module.exports = { sembrarDemo, evaluarGuardiaDemo };

// --- Línea de comandos ---
if (require.main === module) {
    const guardia = evaluarGuardiaDemo(process.env.DATABASE_URL);
    if (!guardia.ok) {
        console.error(`❌ Siembra de demostración abortada: ${guardia.motivo}`);
        process.exit(1);
    }
    if (!process.env.DEMO_PASSWORD || process.env.DEMO_PASSWORD.length < LARGO_MINIMO_CLAVE) {
        console.error(`❌ Siembra de demostración abortada: falta DEMO_PASSWORD en .env.demo (mínimo ${LARGO_MINIMO_CLAVE} caracteres). La cuenta de demostración no se siembra sin clave.`);
        process.exit(1);
    }
    console.log('🌱 Sembrando la tienda de demostración (esto vacía la base de demostración)...');
    sembrarDemo({ contrasena: process.env.DEMO_PASSWORD, correoProveedor: process.env.DEMO_CORREO_PROVEEDOR || undefined })
        .then(async (r) => {
            const db = require('../config/database');
            const destino = new URL(process.env.DATABASE_URL);
            console.log(`✅ Tienda de demostración lista (id ${r.id_tienda}, fecha ${r.hoy}, ${r.alertas} alertas). Usuario: demo`);
            console.log(`   Base sembrada: ${destino.pathname.replace(/^\//, '')} (${destino.hostname}).`);
            console.log('   Para entrar, el servidor tiene que usar ESA base: npm run demo:servidor (no npm run dev, que usa tu .env general)');
            console.log('   y, en otra terminal, cd frontend && npm run dev. La clave es la de DEMO_PASSWORD.');
            await db.pool.end();
        })
        .catch((error) => {
            console.error('❌ Error sembrando la demostración:', error.message);
            process.exit(1);
        });
}
