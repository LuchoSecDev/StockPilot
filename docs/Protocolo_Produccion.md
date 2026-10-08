# Protocolo de Producción: Respaldos de Base de Datos (Neon)

**Proyecto:** StockPilot
**Infraestructura de DB:** Neon Serverless PostgreSQL

## 1. Visión General
Dado que StockPilot en producción utiliza **Neon (Serverless Postgres)**, el mecanismo tradicional de generar archivos `.sql` localmente mediante tareas cron programadas ha sido deprecado. Neon proporciona mecanismos nativos y de alta disponibilidad para la recuperación de datos.

## 2. Point-In-Time Recovery (PITR)
Neon guarda un historial continuo de todas las transacciones realizadas. Si ocurre un borrado accidental o un fallo de datos, puedes restaurar la base de datos a **cualquier punto específico en el tiempo** (con precisión de segundos) durante tu período de retención (generalmente 7 días en planes base).

### Cómo restaurar:
1. Iniciar sesión en el panel de control de Neon (console.neon.tech).
2. Seleccionar el proyecto `StockPilot`.
3. Navegar a **Branches**.
4. Seleccionar la rama principal (usualmente `main`).
5. Hacer clic en **Restore**.
6. Seleccionar la fecha y hora (Timestamp) exacta justo antes del incidente.
7. Crear un nuevo Branch a partir de ese punto o restaurar la rama actual.

## 3. Descarga Manual de Respaldo (Opcional/Legal)
Si necesitas descargar un archivo físico (SQL) por políticas de retención empresarial:
1. Instala `pg_dump` en tu máquina local.
2. Ejecuta el comando exportando a un archivo local:
   ```bash
   pg_dump -U tu_usuario_neon -h tu_host_neon.neon.tech -d tu_database -F c -f "stockpilot_backup_$(date +%F).dump"
   ```

## 4. Alertas Críticas
Cualquier script en el código antiguo que referencie `utils/backup.js` debe ignorarse. Los contenedores efímeros (como los de Render o Railway) no deben usarse para guardar archivos `.dump`, ya que se pierden en cada reinicio del servidor. Toda la gestión debe realizarse desde la plataforma de Neon.
