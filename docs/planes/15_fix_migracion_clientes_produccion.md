# Plan 15: Fiados falla en producción — la auto-migración no creaba `Clientes` ni `Abonos`

**Estado:** Corregido y verificado en una base temporal que reproduce producción. **Rama `fix/migracion-clientes-produccion`: mezclada en `main` (corregido el 9-oct-2026).** Las observaciones de la sección 6 siguen en P15-01 y P20-01.
**Fecha:** 2026-09-21

---

## 1. Síntoma
En el sitio desplegado, la pantalla **Cartera (Fiados)** mostraba el aviso *"Error al cargar la cartera de clientes."* y una tabla vacía. En el entorno local funcionaba.

## 2. Causa
`config/database.js` ejecuta una **auto-migración al arrancar** (pensada para producción: "evita que la app falle si el usuario olvida correr los scripts de migración"). El commit que introdujo Fiados agregó a esa migración:

```sql
ALTER TABLE Ventas ADD COLUMN IF NOT EXISTS id_cliente INTEGER REFERENCES Clientes(id_cliente) ...
```

pero **las tablas `Clientes` y `Abonos` solo se creaban en `database/init_pg.sql`**, que se aplica a mano con `npm run migrate`. En una base como la de producción (sin esas tablas) ocurría:

1. La sentencia fallaba con *"no existe la relación «clientes»"*.
2. Como el bloque del POS es **una sola consulta con varias sentencias**, PostgreSQL la revierte completa: tampoco se aplicaba nada de lo que iba junto.
3. Tras 3 reintentos, `❌ Auto-migration error definitivo` y la app arrancaba igual, sin las tablas.
4. `GET /api/clientes` consultaba una tabla inexistente → error 500 → el aviso de la pantalla.

En local funcionaba porque esa base se creó con `init_pg.sql`.

## 3. Reproducción (base temporal, sin tocar la real)
Un script crea la base temporal `stockpilot_migtest` con el **esquema del último despliegue** (commit `0e4a939`, anterior a Fiados), arranca `config/database.js` y verifica:

| | Código de `main` (antes) | Código corregido |
|---|---|---|
| Migración | falla 3 veces: `no existe la relación «clientes»` | termina en el **primer intento** |
| Tablas `clientes` / `abonos` | no existen | creadas |
| Columnas de `Ventas` | solo `id_sesion_caja`, `metodo_pago` | + `id_cliente`, `estado_deuda` |
| `SELECT … FROM Clientes` | falla | responde |

Además se comparó el esquema completo esperado hoy (`init_pg.sql` actual + los `ALTER` de `scripts/migrate.js`) contra el que deja el arranque de producción con la corrección: **sin diferencias** (ninguna otra tabla o columna faltante).

## 4. Corrección (`config/database.js`, +30 líneas, solo `IF NOT EXISTS`)
- `CREATE TABLE IF NOT EXISTS Clientes` (+ índice) **antes** del `ALTER TABLE Ventas` que la referencia, dentro del mismo bloque.
- Paso nuevo **5.1** que crea `Abonos` (+ índices), que requiere `Clientes` y `SesionCaja`.
- Mismo esquema que `init_pg.sql`. Es idempotente: en la base local (donde ya existen) no cambia nada.

Verificación: lint del backend 0, 132 pruebas unitarias ✅.

## 5. Cómo desplegar
1. Subir la rama a `main` (o cherry-pick del commit `f641d36`) y desplegar. Al arrancar, el log debe mostrar `✅ Auto-migration: … Clientes y Abonos (Fiados) …`.
2. Alternativa inmediata sin desplegar: ejecutar `npm run migrate` apuntando a la base de producción (aplica `init_pg.sql`).
3. Comprobar en la pantalla de Cartera. Si sigue fallando, revisar el log del arranque en busca de `Auto-migration error definitivo`.

## 6. Observaciones
- **`database/init_pg.sql` no se puede ejecutar sobre una base vacía:** `Tienda.id_propietario` referencia `Usuarios`, que se crea después (referencia circular). Producción se creó por otra vía. Una instalación nueva desde cero fallaría con `npm run migrate`; conviene crear `Tienda` sin esa referencia y agregarla con `ALTER TABLE` al final.
- **Riesgo estructural:** mantener el esquema en dos lugares (`init_pg.sql` y la auto-migración) vuelve a producir este tipo de brecha. Conviene que `init_pg.sql` sea la única fuente y que el arranque la aplique.
- **La pantalla ocultaba el fallo:** una lista vacía y un total de `$0` hacían pensar que "no había clientes". En la Fase 4 del rediseño (plan 14) se agregó un estado de error con botón *Reintentar*.
