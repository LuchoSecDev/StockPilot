/**
 * @file modoInterfaz.js
 * @description Migración de `Usuarios.modo_interfaz` (plan 19, 3.4.3, fase A): 'basico' muestra el menú reducido
 * y 'avanzado' el completo. Está aparte de `autoMigrate` para poder probar el respaldo con una base «vieja».
 *
 * El orden importa. Agregar la columna CON `DEFAULT 'basico'` rellenaría a todas las cuentas existentes con 'basico',
 * y cada Administrador vería su menú reducido de golpe el día del despliegue. Por eso:
 *   1. se agrega SIN valor por defecto (las cuentas existentes quedan en NULL),
 *   2. las cuentas en NULL pasan a 'avanzado' (conservan el menú al que están acostumbradas),
 *   3. recién entonces el valor por defecto pasa a 'basico', que es el de las cuentas NUEVAS.
 * Es idempotente: tras el paso 3 ninguna fila nueva queda en NULL, así que el paso 2 no vuelve a tocar nada.
 */

/** @param {{ query: (sql: string) => Promise<unknown> }} pool */
async function asegurarModoInterfaz(pool) {
    await pool.query(`ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS modo_interfaz VARCHAR(10)`);
    await pool.query(`UPDATE Usuarios SET modo_interfaz = 'avanzado' WHERE modo_interfaz IS NULL`);
    await pool.query(`ALTER TABLE Usuarios ALTER COLUMN modo_interfaz SET DEFAULT 'basico'`);
    await pool.query(`ALTER TABLE Usuarios ALTER COLUMN modo_interfaz SET NOT NULL`);
    // PostgreSQL no tiene ADD CONSTRAINT IF NOT EXISTS: se consulta antes, como hace init_pg.sql.
    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_usuarios_modo_interfaz') THEN
                ALTER TABLE Usuarios ADD CONSTRAINT ck_usuarios_modo_interfaz CHECK (modo_interfaz IN ('basico', 'avanzado'));
            END IF;
        END $$;
    `);
}

module.exports = { asegurarModoInterfaz };
