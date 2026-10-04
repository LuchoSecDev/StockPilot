# Restaurar el respaldo externo de Neon

Este documento explica cómo usar el respaldo que genera `.github/workflows/respaldo-neon.yml`
(diario a las 02:00 Bogotá, y a mano cuando se quiera desde la pestaña Actions de GitHub).

**Por qué existe este respaldo** (contexto, 28-sep-2026): Render corre en el plan gratuito, sin
disco persistente y se duerme tras 15 minutos sin tráfico, así que el cron interno de
`utils/backup.js` casi nunca llega a correr allí y, aunque corriera, el archivo no sobreviviría un
redeploy. Neon, también en plan gratuito, solo permite restaurar las últimas 6 horas ("Instant
Restore"). Este workflow corre en la infraestructura de GitHub Actions, no en Render, así que no
depende de que el servicio esté despierto, y sube el respaldo como artefacto de GitHub con 14 días
de retención — la misma ventana de dos semanas que ya usaba `utils/backup.js` en desarrollo.

**Qué NO es:** no reemplaza el "Instant Restore" de Neon para un error notado en minutos (para eso,
usar la consola de Neon directamente, es más rápido). Cubre el caso de "algo se rompió hace más de
6 horas y nadie lo notó".

---

## 1. Descargar el artefacto

El respaldo está **cifrado** (ver sección 3), así que descargarlo no expone datos por sí solo, pero
sigue siendo información de producción: trátalo con el mismo cuidado que la base de datos.

**Desde la web:**
1. `github.com/luchoTeso/StockPilot` → pestaña **Actions** → workflow **Respaldo externo de Neon**.
2. Abrir la corrida del día que se quiere restaurar (o la más reciente).
3. En **Artifacts**, descargar `respaldo-neon-AAAA-MM-DD.zip` (GitHub siempre empaqueta el artefacto
   en un .zip, aunque adentro haya un solo archivo).
4. Descomprimir ese .zip: queda `respaldo.dump.gz.gpg`.

**Con la CLI de GitHub** (`gh`), como alternativa:
```bash
gh run list --workflow=respaldo-neon.yml --limit 5
gh run download <run-id> --name respaldo-neon-AAAA-MM-DD
```

## 2. Ver los conteos de filas que dejó la corrida (para comparar después)

En la misma página de la corrida, abrir el paso **"Conteo de filas por tabla"** y copiar su salida
(tabla y número de filas). El workflow imprime solo eso — nunca datos de las tablas — así que este
paso es seguro de mirar y de pegar en un chat o un ticket si hace falta.

## 3. Descifrar y descomprimir

Se necesita la frase de cifrado del secret `BACKUP_PASSPHRASE` (la tiene quien administra los
secrets del repositorio) y `gpg` instalado localmente (`winget install GnuPG.GnuPG` en Windows,
`brew install gnupg` en macOS, o el paquete `gnupg`/`gpg` del gestor de paquetes en Linux).

```bash
# Pide la frase de forma interactiva (no queda en el historial de la terminal).
gpg --decrypt -o respaldo.dump.gz respaldo.dump.gz.gpg
gunzip respaldo.dump.gz
# Queda: respaldo.dump (formato "custom" de pg_dump, el que usa pg_restore)
```

## 4. Restaurar a una base LOCAL, nunca a producción

**Nunca apuntar estos comandos a la `DATABASE_URL` de producción ni a la de desarrollo compartido.**
El objetivo es verificar el respaldo o investigar un incidente, no sobrescribir datos vivos.

```bash
# 1. Crear la base local vacía (requiere Postgres instalado localmente; misma versión mayor que
#    Neon o superior — ver el paso "Verificar versión" del workflow para saber cuál).
createdb stockpilot_restore

# 2. Restaurar. --no-owner/--no-privileges porque los roles de Neon no existen en local.
pg_restore --no-owner --no-privileges --dbname=stockpilot_restore respaldo.dump
```

Si `pg_restore` avisa de errores de tipo "role X does not exist" con `--no-owner --no-privileges`
puestos, son inofensivos — Postgres los reporta pero el resto de la restauración continúa.

## 5. Comparar los conteos

Con la base restaurada localmente, correr la misma consulta que usa el workflow y comparar el
resultado, tabla por tabla, contra lo copiado en el paso 2:

```sql
SELECT quote_ident(table_name) AS tabla
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
-- y luego, por cada tabla: SELECT COUNT(*) FROM "<tabla>";
```

O, más rápido, en una sola línea de shell contra `stockpilot_restore`:

```bash
psql stockpilot_restore -Atc \
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name" \
| while read -r t; do printf '%-30s %s\n' "$t" "$(psql stockpilot_restore -Atc "SELECT COUNT(*) FROM \"$t\"")"; done
```

Si algún conteo no coincide con el del log de la corrida, el respaldo puede corresponder a un
momento anterior al que se pensaba (por ejemplo, si se restaura la corrida de ayer en vez de la de
hoy) o hubo un problema durante el `pg_dump`; revisar los logs de esa corrida en Actions.

## 6. Limpieza

Cuando termines de verificar o de investigar:
```bash
dropdb stockpilot_restore
rm -f respaldo.dump respaldo.dump.gz respaldo.dump.gz.gpg
```
Los archivos descifrados en disco son datos reales de producción: no los dejes en carpetas
compartidas ni los subas a ningún repositorio, y bórralos del sistema apenas termines.

## Secrets que necesita el workflow (los agrega quien administra el repositorio, no este documento)

| Secret | Qué es |
|---|---|
| `NEON_DATABASE_URL` | La conexión **directa** de Neon (el host **no** debe llevar `-pooler`) — `pg_dump` necesita una sesión larga y la conexión agrupada (pgbouncer en modo transacción) no la sostiene bien en volcados grandes. Se copia desde la consola de Neon: **Connection Details → Direct connection**. |
| `BACKUP_PASSPHRASE` | Frase de cifrado simétrico de `gpg`. Debe guardarse en un gestor de contraseñas del equipo — sin ella, los respaldos existentes no se pueden recuperar, y no hay forma de reestablecerla. |
