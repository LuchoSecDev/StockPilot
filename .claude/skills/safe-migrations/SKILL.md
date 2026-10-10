---
name: safe-migrations
description: Use before adding or changing any table, column, index, view or default in this project's PostgreSQL schema (StockPilot), or before running anything that migrates or seeds a database.
---

# Safe schema changes in StockPilot

Schema changes are high-risk: stop and ask before implementing (see "When to stop and ask" in `CLAUDE.md`).
Every rule below comes from a real failure in this repository.

## Where the schema lives (all of them must agree)

| Place | When it runs | Lesson |
|---|---|---|
| `database/init_pg.sql` | New installs, `npm run migrate` | It once could not create an empty database (circular `Tienda` ↔ `Usuarios`, plan 20, 8.1). |
| `config/database.js`, `autoMigrate()` | **On every `require` of that module**, against whatever `DATABASE_URL` says (P21-15) | Production only gets what is here. Fiados failed in production because its tables were only in `init_pg.sql` (plan 15). |
| `config/migraciones/*.js` (`modoInterfaz.js`, `panelInterno.js`) | Called from `autoMigrate()` | The pattern for new, non-trivial migrations: separate file, testable against an "old" database. |

Until R4 (plan 21) moves migrations to an explicit command, every new table or column goes in **both**
`init_pg.sql` and the auto-migration.

## Rules

1. **Idempotent.** `CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`; for constraints, check `pg_constraint`
   first (PostgreSQL has no `ADD CONSTRAINT IF NOT EXISTS`).
2. **New column with a default on existing rows: three steps.** `ADD COLUMN ... DEFAULT x` fills every existing
   row with `x` in the same statement, so a later `UPDATE ... WHERE col IS NULL` finds nothing. Do: add the column
   without a default → backfill existing rows → `SET DEFAULT` (and `SET NOT NULL` if needed). See `modoInterfaz.js`
   and `fecha_creacion` in `panelInterno.js`.
3. **No unique index over data that may already be duplicated.** It fails on production data and, inside a
   multi-statement block, rolls back the whole block (plan 13, section 10). Consolidate first, or enforce
   uniqueness in a transaction with `pg_advisory_xact_lock`.
4. **One failing statement rolls back its whole multi-statement query.** Order dependencies (create the referenced
   table before the `REFERENCES`) and keep risky steps in their own query.
5. **Concurrent starts.** Two instances can migrate at once: use an advisory lock like `CLAVE_CANDADO` in
   `panelInterno.js`, and check before `ALTER TABLE` (it takes an exclusive lock even when the column exists).
6. **Dates.** Neon runs in UTC; business days are Bogotá days (`AT TIME ZONE 'America/Bogota'`).
7. **Personal data.** New views or exports for the internal panel expose counts, dates and states only
   (`panel_interno_vistas.test.js` pins the column list).

## Before running anything

- Loading any module that requires `config/database.js` migrates the database in `.env`. Check `DATABASE_URL`
  first; never point a local command at Neon by accident.
- `npm run seed` and the integration tests have guards (`database/guardiaSemilla.js`,
  `tests/integration/setupTestDb.js`: local host and a name ending in `_test`). Do not bypass them.
- Production changes: backup first (`docs/restaurar_respaldo.md`), then check the Render log for the
  auto-migration success line.

## How to verify

- An integration test that starts from the **old** schema and checks existing rows keep their values (pattern:
  `tests/integration/modo_interfaz.test.js`), plus one for a fresh database.
- `npm run test:integration` (needs the local `stockpilot_test` database).
- Say which of these you actually ran and against which database.
