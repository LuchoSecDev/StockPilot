/**
 * @file panelInterno.js
 * @description Esquema del panel interno del equipo (plan 22, I1 e I2): columnas nuevas en las tablas del negocio,
 * el esquema aparte `interno` (cuentas del equipo y su bitácora) y las vistas de métricas.
 *
 * Qué NO hace: no toca montos, nombres de productos ni datos de clientes. Las vistas solo exponen conteos, fechas y
 * estados por tienda (plan 22, secciones 2 y 3.3; Ley 1581 de 2012). `panel_interno_vistas.test.js` fija la lista
 * exacta de columnas de cada vista, para que agregar un dato sensible exija cambiar esa prueba a propósito.
 *
 * Reglas de tiempo: un «día con ventas» es un día CALENDARIO en hora de Bogotá, no en UTC. Neon corre en UTC: sin
 * `AT TIME ZONE` una venta de las 8 p. m. caería en el día siguiente y la adopción saldría distorsionada.
 *
 * El orden de `fecha_creacion` importa (igual que en modoInterfaz.js): agregarla CON `DEFAULT CURRENT_TIMESTAMP`
 * pondría «ahora» a todas las tiendas existentes. Por eso se agrega sin valor, se rellena donde falte y recién
 * entonces se fija el valor por defecto. Es idempotente: tras el último paso ninguna fila nueva queda en NULL.
 */

// Candado de la migración: dos réplicas arrancando a la vez no deben pelear por los mismos bloqueos.
const CLAVE_CANDADO = 22_001;

const ZONA = `'America/Bogota'`;

// Una fila por tienda y día calendario (Bogotá) con ventas. Base de las demás vistas.
const V_VENTAS_DIA = `
    CREATE VIEW interno.v_ventas_dia AS
    SELECT id_tienda,
           (fecha_salida AT TIME ZONE ${ZONA})::date AS dia,
           COUNT(*)::int AS ventas
    FROM ventas
    GROUP BY id_tienda, (fecha_salida AT TIME ZONE ${ZONA})::date
`;

// Seguimiento general: TODAS las tiendas (incluidas las de prueba, con su marca, para poder marcarlas desde el panel).
const V_TIENDAS_RESUMEN = `
    CREATE VIEW interno.v_tiendas_resumen AS
    WITH v AS (
        SELECT id_tienda,
               COUNT(*) FILTER (WHERE fecha_salida >= NOW() - INTERVAL '7 days')::int  AS ventas_7d,
               COUNT(*) FILTER (WHERE fecha_salida >= NOW() - INTERVAL '30 days')::int AS ventas_30d,
               MAX(fecha_salida) AS ultima_venta
        FROM ventas
        GROUP BY id_tienda
    ),
    d AS (
        SELECT id_tienda, COUNT(*)::int AS dias_con_ventas_30d
        FROM interno.v_ventas_dia
        WHERE dia >= (NOW() AT TIME ZONE ${ZONA})::date - 29
        GROUP BY id_tienda
    ),
    p AS (
        SELECT id_tienda, COUNT(*)::int AS productos
        FROM productos
        GROUP BY id_tienda
    ),
    u AS (
        SELECT id_tienda, COUNT(*)::int AS usuarios, MAX(ultimo_acceso) AS ultimo_acceso
        FROM usuarios
        GROUP BY id_tienda
    )
    SELECT t.id_tienda,
           t.nombre_establecimiento AS nombre,
           t.ciudad,
           t.estado,
           t.es_prueba,
           t.fecha_creacion,
           t.dias_apertura_semana,
           COALESCE(u.usuarios, 0) AS usuarios,
           -- El dueño es Tienda.id_propietario: Usuarios.id_tienda cambia cuando el dueño cambia de sucursal.
           COALESCE((SELECT o.fecha_aceptacion_politica_datos IS NOT NULL FROM usuarios o WHERE o.id_usuario = t.id_propietario), FALSE) AS dueno_acepto_politica,
           COALESCE(p.productos, 0) AS productos,
           COALESCE(v.ventas_7d, 0) AS ventas_7d,
           COALESCE(v.ventas_30d, 0) AS ventas_30d,
           COALESCE(d.dias_con_ventas_30d, 0) AS dias_con_ventas_30d,
           v.ultima_venta,
           u.ultimo_acceso
    FROM tienda t
    LEFT JOIN v ON v.id_tienda = t.id_tienda
    LEFT JOIN d ON d.id_tienda = t.id_tienda
    LEFT JOIN p ON p.id_tienda = t.id_tienda
    LEFT JOIN u ON u.id_tienda = t.id_tienda
`;

// Activación (decisión del 28-sep): la vista da los CONTEOS; el umbral (≥ 20 productos y ventas en ≥ 5 de los
// primeros 7 días) vive en services/interno/definiciones.js, en un solo lugar y con su prueba.
// «Primeros 7 días» = el día calendario del registro (día 0) y los 6 siguientes.
const V_ACTIVACION = `
    CREATE VIEW interno.v_activacion AS
    WITH base AS (
        SELECT id_tienda, fecha_creacion, (fecha_creacion AT TIME ZONE ${ZONA})::date AS dia_registro
        FROM tienda
        WHERE NOT es_prueba
    ),
    prod AS (
        SELECT b.id_tienda,
               COUNT(*)::int AS productos_cargados,
               COUNT(*) FILTER (WHERE p.fecha_entrada >= b.dia_registro AND p.fecha_entrada < b.dia_registro + 7)::int AS productos_primeros_7d
        FROM base b
        JOIN productos p ON p.id_tienda = b.id_tienda
        GROUP BY b.id_tienda
    ),
    dias AS (
        SELECT b.id_tienda, COUNT(*)::int AS dias_con_ventas_7d
        FROM base b
        JOIN interno.v_ventas_dia vd ON vd.id_tienda = b.id_tienda AND vd.dia >= b.dia_registro AND vd.dia < b.dia_registro + 7
        GROUP BY b.id_tienda
    )
    SELECT b.id_tienda,
           b.fecha_creacion,
           b.dia_registro,
           COALESCE(prod.productos_cargados, 0) AS productos_cargados,
           COALESCE(prod.productos_primeros_7d, 0) AS productos_primeros_7d,
           COALESCE(dias.dias_con_ventas_7d, 0) AS dias_con_ventas_7d,
           ((NOW() AT TIME ZONE ${ZONA})::date >= b.dia_registro + 7) AS ventana_cerrada
    FROM base b
    LEFT JOIN prod ON prod.id_tienda = b.id_tienda
    LEFT JOIN dias ON dias.id_tienda = b.id_tienda
`;

// Adopción semanal: por tienda y semana de vida (semana 1 = días 0 a 6 desde el registro, etc.), los días con ventas.
// La razón contra los días de apertura (con tope de 100 %) se calcula en services/interno/definiciones.js.
// Se limita a 12 semanas: el piloto dura 6 y una tienda antigua no debe generar cientos de filas.
const V_ADOPCION_SEMANAL = `
    CREATE VIEW interno.v_adopcion_semanal AS
    WITH base AS (
        SELECT id_tienda, dias_apertura_semana, (fecha_creacion AT TIME ZONE ${ZONA})::date AS dia_registro,
               (NOW() AT TIME ZONE ${ZONA})::date AS hoy
        FROM tienda
        WHERE NOT es_prueba
    ),
    semanas AS (
        SELECT b.id_tienda, b.dias_apertura_semana, b.hoy, s.semana,
               b.dia_registro + (s.semana - 1) * 7 AS desde,
               b.dia_registro + s.semana * 7 - 1 AS hasta
        FROM base b
        CROSS JOIN LATERAL generate_series(1, LEAST(12, GREATEST(1, ((b.hoy - b.dia_registro) / 7) + 1))) AS s(semana)
    )
    SELECT s.id_tienda,
           s.semana,
           s.desde,
           s.hasta,
           COUNT(vd.dia)::int AS dias_con_ventas,
           s.dias_apertura_semana,
           (s.hoy > s.hasta) AS semana_completa
    FROM semanas s
    LEFT JOIN interno.v_ventas_dia vd ON vd.id_tienda = s.id_tienda AND vd.dia BETWEEN s.desde AND s.hasta
    GROUP BY s.id_tienda, s.semana, s.desde, s.hasta, s.dias_apertura_semana, s.hoy
`;

// De más dependiente a menos, para poder borrarlas sin error.
const VISTAS = ['v_adopcion_semanal', 'v_activacion', 'v_tiendas_resumen', 'v_ventas_dia'];

/**
 * ¿Falta alguna de las columnas de este panel, o alguna perdió su NOT NULL o su valor por defecto?
 * (Sin el valor por defecto, crear una tienda fallaría: por eso también se comprueba, no solo que exista la columna.)
 * Se consulta ANTES de tocar nada: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pide un bloqueo exclusivo sobre la tabla
 * aunque la columna ya exista, y esta migración corre en cada arranque. Con tráfico real (y más de una réplica) eso
 * bloquea ventas durante el arranque y puede terminar en deadlock. Con la consulta, un arranque normal no bloquea nada.
 */
async function faltanColumnas(client) {
    const { rows } = await client.query(`
        SELECT table_name, column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND ((table_name = 'tienda' AND column_name IN ('fecha_creacion', 'dias_apertura_semana', 'es_prueba'))
            OR (table_name = 'usuarios' AND column_name = 'ultimo_acceso'))
    `);
    if (rows.length < 4) return true;
    // Las tres de Tienda deben ser obligatorias y traer valor por defecto (ultimo_acceso es opcional a propósito).
    return rows.filter(r => r.table_name === 'tienda').some(r => r.is_nullable !== 'NO' || r.column_default === null);
}

async function asegurarColumnas(client) {
    await client.query(`ALTER TABLE Tienda ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ`);
    // Relleno único de las tiendas que ya existían: la fecha de registro más antigua de sus usuarios; si no hay
    // (sucursales adicionales, que no tienen usuarios propios), su primera venta; y como último recurso, ahora.
    await client.query(`
        UPDATE Tienda t SET fecha_creacion = COALESCE(
            (SELECT MIN(u.fecha_registro) FROM Usuarios u WHERE u.id_tienda = t.id_tienda),
            (SELECT MIN(v.fecha_salida) FROM Ventas v WHERE v.id_tienda = t.id_tienda),
            CURRENT_TIMESTAMP)
        WHERE t.fecha_creacion IS NULL
    `);
    await client.query(`ALTER TABLE Tienda ALTER COLUMN fecha_creacion SET DEFAULT CURRENT_TIMESTAMP`);
    await client.query(`ALTER TABLE Tienda ALTER COLUMN fecha_creacion SET NOT NULL`);

    // Días a la semana que abre la tienda (decisión del 28-sep): base de la adopción. 7 hasta que el dueño lo indique.
    await client.query(`ALTER TABLE Tienda ADD COLUMN IF NOT EXISTS dias_apertura_semana SMALLINT NOT NULL DEFAULT 7`);
    // Si la columna ya existía, ADD COLUMN IF NOT EXISTS no vuelve a fijar esto: se reafirma para que la migración se repare sola.
    await client.query(`ALTER TABLE Tienda ALTER COLUMN dias_apertura_semana SET DEFAULT 7`);
    await client.query(`ALTER TABLE Tienda ALTER COLUMN dias_apertura_semana SET NOT NULL`);
    await client.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_tienda_dias_apertura') THEN
                ALTER TABLE Tienda ADD CONSTRAINT ck_tienda_dias_apertura CHECK (dias_apertura_semana BETWEEN 1 AND 7);
            END IF;
        END $$;
    `);

    // Tiendas del equipo (QA, demostración): las métricas del piloto las excluyen.
    await client.query(`ALTER TABLE Tienda ADD COLUMN IF NOT EXISTS es_prueba BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE Tienda ALTER COLUMN es_prueba SET DEFAULT FALSE`);
    await client.query(`ALTER TABLE Tienda ALTER COLUMN es_prueba SET NOT NULL`);

    // Último inicio de sesión completo (con 2FA incluido). Se actualiza en cada login, no en cada petición.
    await client.query(`ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ`);
}

// Esquema aparte: un error en los permisos de tienda nunca da acceso al panel, y al revés.
async function asegurarEsquemaDelEquipo(client) {
    await client.query(`CREATE SCHEMA IF NOT EXISTS interno`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS interno.equipo (
            id_equipo SERIAL PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL,
            correo VARCHAR(255) NOT NULL UNIQUE,
            usuario VARCHAR(100) NOT NULL UNIQUE,
            contrasena VARCHAR(255) NOT NULL,
            two_factor_secret VARCHAR(255) NOT NULL,
            -- Último código TOTP aceptado: un mismo código no sirve dos veces (evita repetir uno espiado).
            ultimo_token_usado VARCHAR(10),
            ultimo_token_en TIMESTAMPTZ,
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ultimo_acceso TIMESTAMPTZ
        )
    `);
    await client.query(`
        CREATE TABLE IF NOT EXISTS interno.bitacora (
            id BIGSERIAL PRIMARY KEY,
            id_equipo INTEGER REFERENCES interno.equipo(id_equipo),
            accion VARCHAR(50) NOT NULL,
            -- Sin FK a propósito: borrar una tienda no debe borrar el rastro de lo que el equipo hizo con ella.
            id_tienda INTEGER,
            detalle JSONB,
            ip INET,
            fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bitacora_fecha ON interno.bitacora (fecha DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bitacora_tienda ON interno.bitacora (id_tienda, fecha DESC)`);
}

// Las vistas se recrean enteras (DROP + CREATE): CREATE OR REPLACE no deja quitar ni reordenar columnas.
async function recrearVistas(client) {
    for (const vista of VISTAS) await client.query(`DROP VIEW IF EXISTS interno.${vista}`);
    await client.query(V_VENTAS_DIA);
    await client.query(V_TIENDAS_RESUMEN);
    await client.query(V_ACTIVACION);
    await client.query(V_ADOPCION_SEMANAL);
}

const DEADLOCK = '40P01';
const MAX_INTENTOS = 4;

/**
 * Todo en UNA transacción bajo un candado de aplicación: o queda completo o no queda nada, y dos instancias que
 * arrancan a la vez se turnan en vez de pelear por los mismos bloqueos.
 *
 * Si aun así PostgreSQL elige a esta transacción como víctima de un deadlock, se REINTENTA: la transacción quedó
 * revertida por completo y la migración es idempotente, así que repetirla es seguro. Los DROP/CREATE de las vistas
 * pueden cruzarse con otras sesiones que justo las consultan o limpian tablas; el otro participante queda en el aviso.
 * @param {{ connect: Function }} pool - El Pool de pg.
 */
async function asegurarPanelInterno(pool) {
    for (let intento = 1; ; intento++) {
        try {
            return await ejecutarMigracion(pool);
        } catch (err) {
            if (err.code !== DEADLOCK || intento >= MAX_INTENTOS) throw err;
            console.warn(`⚠️ Panel interno: deadlock al migrar (intento ${intento}/${MAX_INTENTOS}), se reintenta. Detalle: ${err.detail}`);
            await new Promise(resolver => setTimeout(resolver, 150 * intento));
        }
    }
}

async function ejecutarMigracion(pool) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [CLAVE_CANDADO]);
        if (await faltanColumnas(client)) await asegurarColumnas(client);
        await asegurarEsquemaDelEquipo(client);
        await recrearVistas(client);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { asegurarPanelInterno };
