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

## 5. Verificación en dos pasos (2FA) del Administrador

**Qué hace hoy.** Un Administrador puede activar el 2FA (aplicación Google Authenticator) desde el aviso del encabezado o desde «Mi perfil». Una vez activo, el inicio de sesión pide el código de 6 dígitos y **no se puede desactivar** (regla de seguridad). Durante el piloto el 2FA es una **recomendación**: no se exige para trabajar.

**Política obligatoria (apagada por defecto).** La variable de entorno `REQUIRE_ADMIN_2FA` controla si el servidor exige el 2FA:

| Valor | Efecto |
|---|---|
| sin definir, o cualquier cosa distinta de `true` | El Administrador trabaja con normalidad; solo ve el aviso recomendando activarlo. **Es el estado del piloto.** |
| `true` | La API responde **403** (`code: DOS_FACTORES_REQUERIDO`) a las **escrituras** de un Administrador sin 2FA activo. Leer, entrar, salir y activar el 2FA siguen permitidos. El Tendero no se ve afectado. |

Para cambiarla: en Render, *Environment* → editar `REQUIRE_ADMIN_2FA` → guardar (el servicio se reinicia). No hace falta tocar código. La decisión se lee en cada escritura, así que un administrador que activa el 2FA en plena sesión queda habilitado de inmediato.

> **No encender `REQUIRE_ADMIN_2FA` antes de tener códigos de recuperación** (plan 21, P21-26). Hoy, si un dueño pierde el celular, no tiene cómo entrar y depende del procedimiento de abajo.

**Procedimiento de soporte: un dueño perdió el celular (o no puede entrar con 2FA).**
1. **Confirmar su identidad por un canal independiente** (por ejemplo, llamarlo al número registrado de la tienda). Quien pide el reinicio podría no ser el dueño.
2. Si es producción, tener a mano el punto de restauración (sección 2) antes de modificar datos.
3. En el editor SQL de Neon, desactivar el 2FA de **esa** cuenta (por su correo, nunca sin `WHERE`):
   ```sql
   UPDATE Usuarios
   SET two_factor_enabled = false, two_factor_secret = NULL
   WHERE correo = 'correo-del-dueno@ejemplo.com';
   ```
4. Pedirle que entre solo con su contraseña y reactive el 2FA desde el aviso del encabezado (si la política está encendida, el sistema se lo pedirá al primer intento de modificar datos).
5. Dejar constancia (fecha, quién lo pidió, quién lo hizo) en la Bitácora de `docs/seguimiento_planes.xlsx`.

**Intentos fallidos.** Activar o desactivar el 2FA tiene un límite de 5 intentos fallidos cada 15 minutos por usuario; pasado ese límite el servidor responde 429 hasta que se cumpla la ventana.

## 6. Panel interno del equipo (métricas del piloto)

**Qué es.** Una pantalla solo para el equipo de StockPilot, en **`/interno`** (por ejemplo `https://stockpilot-qg0s.onrender.com/interno`), para medir las tiendas del piloto: activación, adopción semanal, embudo y una bitácora de lo que el equipo consulta. Muestra solo **conteos, fechas y estados**; nunca montos, productos ni datos de clientes (Ley 1581 de 2012). Las cuentas del equipo viven en un esquema aparte (`interno`) y no se mezclan con las de las tiendas.

**Antes de la primera vez: copia de seguridad.** El primer despliegue agrega columnas a `Tienda` y `Usuarios` y crea el esquema `interno` con sus vistas (solo agrega; no borra ni reescribe datos de negocio). Confirma que el punto de restauración de Neon (sección 2) está disponible y revisa en los logs de Render que aparezca «Auto-migration … actualizados exitosamente». Si el rol de la base no pudiera crear esquemas, la migración lo dirá en el log y el panel no funcionará; el resto de la app no se afecta.

**Crear una cuenta del equipo** (una por integrante, sin cuentas compartidas, para que la bitácora sirva). Solo se puede por script, nunca desde la web:

```bash
# Contra producción: pasa la URL de Neon SOLO para este comando (no la dejes en archivos)
DATABASE_URL="postgresql://…neon…/tu_base" npm run equipo:crear
```

El script (1) muestra a qué base apunta y exige escribir su nombre para continuar; (2) pide nombre, correo, usuario y contraseña (mínimo 12 caracteres, sin eco); (3) muestra un **código QR una sola vez** para Google Authenticator; y (4) **no guarda la cuenta hasta que escribas un código válido** de la app. Si cierras la terminal antes de escanear, no se crea nada y se repite.

**Desactivar a alguien** (pierde el acceso en su siguiente petición, sin esperar a que caduque su sesión):

```sql
UPDATE interno.equipo SET activo = false WHERE usuario = 'usuario-del-integrante';
```

**Si un integrante pierde el celular:** desactivar su cuenta (arriba) y crearle una nueva con el script. No hay recuperación por correo a propósito: el segundo factor es obligatorio.

**Antes de medir: marcar las tiendas del equipo como de prueba.** En producción conviven las tiendas de QA y demostración con las del piloto. En **Tiendas → Detalle → «Marcar como tienda de prueba»** (queda en la bitácora). Las marcadas no cuentan en la activación, la adopción ni el embudo.

**Seguridad del acceso.** Contraseña + código de Google Authenticator (obligatorio); 5 intentos fallidos cada 15 minutos por IP en la contraseña y por cuenta en el código; un código ya usado no sirve otra vez; el intento a medias caduca a los 5 minutos; entrar al panel cierra cualquier sesión de tienda abierta en ese navegador. Todo lo que el equipo consulta queda en la **Bitácora**; si no se puede registrar, no se entregan datos.

**Qué NO hace:** no permite «entrar como» un usuario de una tienda, no edita datos de tiendas y no crea cuentas. La variable `REQUIRE_ADMIN_2FA` (sección 5) es independiente: el 2FA del equipo es siempre obligatorio.
