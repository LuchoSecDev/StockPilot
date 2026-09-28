# Plan 22: Panel interno del equipo y funciones liberables por tienda

**Estado:** I0 en progreso: la rama `fix/rutas-tienda-requireadmin` (solo las rutas de tienda) espera aprobación, y el 28-sep I0 se amplió a una auditoría de autorización completa (sección 1.4). I1 a I4: propuesta, nada implementado. Cada fase se aprueba por separado.
**La sección 5 es el único orden de ejecución vigente** para los planes 19, 21 y 22.
**Fecha:** 2026-09-28
**Origen:** decisión de Luis (28-sep) de tener, antes del piloto, un panel del equipo para:
- ver las tiendas y usuarios registrados,
- seguir cómo va la app,
- liberar funciones por tienda.

**Relacionado con:**
- Plan 19, secciones 3.3 (métrica de activación), 3.4 (modo básico) y 3.5 (segmentación en el registro).
- Plan 21: el código nuevo se escribe directamente como servicios.
- Documento de intervención: indicadores de la fase 5 en la Tabla 3.

---

## 0. Resumen

- **El panel es el instrumento de medición del piloto, no solo una herramienta de control.** Hoy nadie puede medir sin escribir SQL a mano contra producción:
  - la activación de la prueba gratuita (meta ≥ 25 %),
  - la adopción (días con ventas ÷ días de apertura, meta ≥ 80 %),
  - el embudo de la convocatoria.
- **Tiene dos piezas con urgencias distintas:**
  1. **Panel de solo lectura, con métricas agregadas.** Hace falta antes de la convocatoria pública y del piloto (fase 5). La prueba de usabilidad (fase 4) no lo necesita.
  2. **Funciones liberables por tienda.** Se construyen junto con las fases A y B del modo básico (plan 19, sección 3.4), porque ese es su primer uso real.
- **Hay un hallazgo de seguridad que se corrige antes de todo lo demás** (sección 1.4).

---

## 1. Hallazgos verificados en el código (28-sep-2026)

### 1.1 Solo existen dos roles, y ambos pertenecen a una tienda
`Usuarios.rol` es `Administrador` (dueño de su tienda) o `Tendero`, y `Usuarios.id_tienda` es `NOT NULL`. No hay ningún rol por encima de las tiendas. Un "usuario del equipo" no cabe en `Usuarios` sin inventar una tienda ficticia, lo que mezclaría datos internos con datos de clientes.

**Decisión de diseño:** las cuentas del equipo van en una **tabla aparte** (`EquipoInterno`), con su propio inicio de sesión. Así un error en los permisos de tienda nunca da acceso al panel, y al revés.

### 1.2 `Tienda` no tiene fecha de creación
Las columnas de `Tienda` en `database/init_pg.sql` no incluyen ninguna fecha. **El SQL de la métrica de activación del plan 19, sección 3.3, usa `t.fecha_creacion`, que no existe:** tal como está escrito, fallaría.

**Arreglo:** agregar `Tienda.fecha_creacion` y rellenar las tiendas existentes con la fecha de registro más antigua de sus usuarios (`MIN(Usuarios.fecha_registro)`).

### 1.3 No existe ningún mecanismo de funciones por tienda
El único precedente es el interruptor global `DISABLE_ALERT_ENGINE` (plan 17). El menú (`Sidebar.jsx`) muestra los módulos según el rol, no según la tienda.

### 1.4 Hallazgo de seguridad: un Tendero puede modificar o desactivar su tienda
En `routes/storeRoutes.js`, dos rutas solo piden `requireLogin`, sin `requireAdmin`:
- `PUT /api/tienda/update/:id` (`updateStore`)
- `PUT /api/tienda/estado/:id` (`toggleStoreStatus`)

Los controladores verifican que la tienda sea la del usuario, pero **no su rol**. Por eso un Tendero de esa tienda podría, desde la API y aunque la interfaz no le muestre el botón:
- cambiar los datos del negocio,
- **subir su propio `limite_egreso_tendero`** (el tope de los egresos que registra sin aprobación),
- **desactivar la tienda.**

Esto se verificó leyendo el código; no se ejecutó.

**Ampliación (28-sep, resultados de la fase R0 del plan 21).** El problema no se limita a la tienda. `tests/integration/autorizacion_roles.test.js` registra lo que responde hoy una sesión de Tendero, y esta vez sí se ejecutó:
- **Egresos de caja (P22-09, el más grave):** `PUT /api/caja/egreso/:id/aprobar` y `/rechazar` no revisan el rol, y `CashRegister.approveExpense`/`rejectExpense` actualizan con `WHERE id_egreso = ?`, sin `id_tienda`. Un Tendero aprueba sus propios egresos y **también los de cualquier otra tienda** conociendo el id. Rompe el aislamiento entre tiendas.
- **Responden 200 a un Tendero:** editar y eliminar productos (incluido el precio), `POST /api/promociones`, `POST /api/ia/apply-strategy`, generar y resolver alertas, `POST /api/inventario/ajuste`, crear reportes y exportar ventas.

No todo lo segundo es un defecto: resolver una alerta o registrar un conteo físico pueden ser tareas normales del Tendero. Por eso I0 empieza con una decisión (P22-10, sección 7): la matriz rol × endpoint. Los 9 casos de la prueba llevan la marca `// I0: invertir a 403 según la matriz de roles`; solo se invierten los que la matriz indique.

**Arreglo:** agregar `requireAdmin` a ambas rutas, más una prueba de integración con una sesión de Tendero que espere 403 en las dos. Va primero (fase I0) porque el piloto pondrá cuentas de Tendero reales en uso.

---

## 2. Alcance

**Sí incluye:**
- Cuentas del equipo, creadas por script.
- Inicio de sesión con segundo factor obligatorio.
- Vistas de métricas agregadas por tienda.
- Liberación de funciones por tienda.
- Bitácora de todo lo que hace el equipo en el panel.

**No incluye, a propósito:**
- **"Entrar como" un usuario de la tienda** ni ver el detalle de sus ventas, productos o clientes. Son datos de negocio de terceros (Ley 1581 de 2012). El panel muestra conteos, fechas y estados, no montos ni nombres de productos.
- **Editar datos de las tiendas o de sus usuarios desde el panel.** Si hace falta soporte, se atiende con el dueño de la tienda.
- **Crear cuentas del equipo desde la interfaz.**

---

## 3. Diseño

### 3.1 Cuentas del equipo y acceso
- **Tabla `EquipoInterno`:** `id_equipo`, `nombre`, `correo` (UNIQUE), `usuario` (UNIQUE), `contrasena` (bcrypt), `two_factor_secret` (**obligatorio**), `activo`, `creado_en`.
- **Alta por script** (`npm run equipo:crear`): interactivo, genera el secreto TOTP y muestra el QR una sola vez. No hay endpoint de registro.
- **Inicio de sesión aparte:** `POST /api/interno/login` y `POST /api/interno/2fa`. La sesión guarda `req.session.interno = { idEquipo }` y **no** tiene `tiendaId`, así que ninguna ruta de tienda le sirve.
- **Middleware `requireEquipo`:** exige sesión interna con el segundo factor verificado. Tiene su propio limitador de peticiones, más estricto que el global.
- **Rutas separadas:** todo vive bajo `/api/interno/*`. El frontend usa una ruta `/interno` cargada de forma diferida, para que su código no viaje en el bundle de los tenderos.

### 3.2 Esquema
Siguiendo la regla del plan de Bases de Datos Avanzadas, lo nuevo va en un esquema propio, `interno`:

```sql
ALTER TABLE Tienda ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
-- relleno único para las tiendas existentes: la fecha de registro más antigua de sus usuarios
UPDATE Tienda t SET fecha_creacion = u.primera
FROM (SELECT id_tienda, MIN(fecha_registro) AS primera FROM Usuarios GROUP BY id_tienda) u
WHERE u.id_tienda = t.id_tienda;

ALTER TABLE Usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;  -- se actualiza en cada inicio de sesión
ALTER TABLE Tienda ADD COLUMN IF NOT EXISTS dias_apertura_semana SMALLINT DEFAULT 7 CHECK (dias_apertura_semana BETWEEN 1 AND 7);  -- decisión 4

CREATE SCHEMA IF NOT EXISTS interno;

CREATE TABLE IF NOT EXISTS interno.equipo (...);          -- EquipoInterno, sección 3.1

CREATE TABLE IF NOT EXISTS interno.funciones_tienda (
  id_tienda      INTEGER NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
  funcion        VARCHAR(50) NOT NULL,        -- clave del catálogo, sección 3.4
  habilitada     BOOLEAN NOT NULL,
  actualizado_por INTEGER REFERENCES interno.equipo(id_equipo),
  actualizado_en TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_tienda, funcion)
);

CREATE TABLE IF NOT EXISTS interno.bitacora (
  id          BIGSERIAL PRIMARY KEY,
  id_equipo   INTEGER REFERENCES interno.equipo(id_equipo),
  accion      VARCHAR(50) NOT NULL,           -- 'login', 'ver_tienda', 'cambiar_funcion', ...
  id_tienda   INTEGER,
  detalle     JSONB,
  ip          INET,
  fecha       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

Todo se agrega también a la auto-migración, con el mismo patrón `IF NOT EXISTS`, hasta que el plan 21 (R4) la saque a un comando explícito.

### 3.3 Vistas de métricas (solo agregados)

| Vista | Qué muestra por tienda | Para qué indicador |
|---|---|---|
| `interno.v_tiendas_resumen` | nombre, ciudad, estado, fecha de creación, usuarios, si el dueño aceptó la política, productos cargados, ventas en 7 y 30 días (conteo, sin montos), días con ventas en los últimos 30, última venta, último acceso | Seguimiento general |
| `interno.v_activacion` | productos cargados en los primeros 7 días, días con ventas en los primeros 7 días, `activada` (sí/no) | Activación de la prueba gratuita (meta ≥ 25 %) |
| `interno.v_adopcion_semanal` | por semana: días con ventas ÷ días de apertura | Adopción del piloto (meta ≥ 80 %) |
| `interno.v_embudo` | registros → activadas → con uso en la semana 4 | Embudo de la convocatoria |

Dos definiciones deben quedar fijadas **antes** de publicar la convocatoria, para que la meta no se ajuste al resultado (así lo exige la sección 1.6 del documento de intervención). Ver las decisiones 3 y 4 de la sección 7.

### 3.4 Funciones liberables

**Distinción clave con el modo básico:**

| | Modo básico (plan 19, 3.4) | Función liberada (este plan) |
|---|---|---|
| Quién decide | El usuario de la tienda | El equipo, desde el panel |
| Qué hace | **Oculta** módulos del menú; el usuario puede volver a mostrarlos | **Bloquea** el módulo en la interfaz y en la API (403) |
| Para qué | Simplificar lo que ve alguien que empieza | Controlar qué está disponible en cada tienda del piloto, y los costos |

Las dos cosas se combinan: el menú muestra la intersección entre lo liberado para la tienda y lo que el modo del usuario deja ver.

**Catálogo inicial**, con claves alineadas a los módulos del menú:
`simulador`, `analitica`, `aprendizaje_ia`, `auditoria_ia`, `reportes`, `comunicados`, `cartera`, `movimientos`, `proveedores_ia`, `promociones_ia`, `ia` (todas las llamadas a OpenAI de esa tienda).

- **`ia` es la más útil para el piloto:** permite cortar el gasto de OpenAI de una tienda sin apagar el resto. El motor matemático de reposición sigue funcionando sin IA; el modo sin IA ya existe.
- **Perfil por defecto** de una tienda nueva del piloto: las 5 vistas esenciales del plan 19 (Vender, ¿Qué pido?/Recibir, Alertas, Catálogo simplificado, Perfil). El resto queda liberable.
- **Backend:**
  - `GET /api/funciones` devuelve las funciones de la tienda de la sesión.
  - El middleware `requireFuncion('simulador')` protege las rutas de cada módulo. Consulta con caché corta por proceso; con varias réplicas usará Redis, igual que en el plan 21.
- **Frontend:** el hook `useFunciones()` alimenta al `Sidebar` y a las rutas protegidas. Un módulo no liberado muestra "Esta función aún no está disponible en tu tienda", no un error.
- **Cada cambio queda en `interno.bitacora`** y le llega al administrador de la tienda como notificación (`tipo: 'funcion_liberada'`).

### 3.5 Pantallas del panel
1. **Tiendas:** tabla con semáforo de activación y adopción, filtro por estado y búsqueda.
2. **Detalle de tienda:** métricas agregadas, interruptores de funciones y el historial de cambios de esa tienda.
3. **Embudo:** registros, activadas y activas a la semana 4, con la meta marcada.
4. **Bitácora:** quién del equipo hizo qué y cuándo.

### 3.6 Seguridad y pruebas
Pruebas de integración con `supertest` contra `stockpilot_test`, siguiendo el patrón de `tests/integration/`:

| Caso | Resultado esperado |
|---|---|
| Sesión de Administrador de tienda → `/api/interno/*` | 403 |
| Cuenta del equipo con contraseña correcta pero sin el segundo factor | 401 |
| Sesión del equipo → rutas de tienda (`/api/productos`, ventas…) | 401 o 403 (no tiene `tiendaId`) |
| Función no liberada → su ruta en la API | 403 con mensaje claro |
| Cambio de función desde el panel | Queda una fila en `interno.bitacora` y le llega la notificación al administrador |
| Tendero → `PUT /api/tienda/update/:id` y `/estado/:id` | 403 (hallazgo 1.4) |
| Cualquier sesión → aprobar o rechazar un egreso de **otra** tienda | 404, sin cambio en la fila (P22-09) |
| Tendero → aprobar o rechazar egresos de su tienda | 403 (P22-09) |
| Tendero → endpoints que la matriz de roles reserve al Administrador | 403 (P22-10) |
| Vistas del panel | No devuelven montos, nombres de productos ni datos de clientes |

### 3.7 Política de tratamiento de datos
Antes de la convocatoria, agregar a `/politica-datos` un párrafo como este:

> Para operar y mejorar el servicio, el equipo de StockPilot consulta métricas agregadas de uso de cada tienda (fecha de registro, número de productos cargados, número de días con ventas y fecha del último acceso). Estas métricas no incluyen los montos de las ventas, los productos vendidos ni los datos de los clientes de la tienda. Cada consulta del equipo queda registrada.

---

## 4. Fases

| Fase | Contenido | Cuándo |
|---|---|---|
| **I0** | Auditoría de autorización: egresos entre tiendas (P22-09), matriz de roles (P22-10), `requireAdmin` donde la matriz lo indique (incluidas las dos rutas de tienda del hallazgo 1.4) y pruebas de 403 | Antes que todo lo demás del plan |
| **I1** | Esquema (3.2), cuentas del equipo, inicio de sesión con segundo factor, `requireEquipo`, bitácora | Antes de la convocatoria |
| **I2** | Vistas de métricas (3.3) y pantallas Tiendas, Detalle y Bitácora (solo lectura) | Antes de la convocatoria |
| **I3** | Funciones liberables (3.4) | Junto con el modo básico A y B |
| **I4** | Pantalla de embudo, párrafo de la política (3.7) y campo de experiencia digital en el registro (plan 19, 3.5) | Antes de publicar la convocatoria |

El código nuevo se escribe desde el inicio con el patrón del plan 21: controladores delgados y lógica en `services/interno/`. Así no se crea más deuda mientras se refactoriza la existente.

---

## 5. Orden general de ejecución (único vigente)

Esta es la única lista de orden para los planes 19, 21 y 22; el plan 21 remite aquí y en su sección 6 solo guarda las dependencias entre sus fases. El estado de cada punto se lleva en `docs/seguimiento_planes.xlsx`. Reemplaza la versión anterior de esta sección (28-sep), que no incluía los hallazgos de R0.

**A. Antes del piloto**
1. **Merge de R0** del plan 21 (P21-01). Es la red de seguridad de todo lo que sigue.
2. **Seguridad y respaldos**, en paralelo (uno es código y el otro configuración de Render):
   - Egresos entre tiendas (P22-09), primero.
   - Decisión de la matriz de roles (P22-10) y luego I0 completo, que incluye la rama `fix/rutas-tienda-requireadmin`.
   - Limitador en `/api/verify-reset-code` (P21-09), junto con el `skip` del limitador global (P21-13), porque es el mismo archivo.
   - Copia externa de los respaldos, con verificación de `pg_dump` en Render y una restauración probada (plan 19, 3.1).
3. **Correcciones pequeñas de integridad**, cada una en su commit y con su prueba:
   - Apertura de caja con transacción y bloqueo (plan 21, punto 2.4; se adelanta de R2).
   - Migración explícita en vez de la auto-migración (plan 21, punto 2.2; se adelanta de R4). Recomendado; es la decisión 4 del plan 21.
   - Recepción de mercancía (P21-10), cuando se decida la regla (decisión 5 del plan 21).
4. **R1** del plan 21: servicios de IA y cliente único. Va antes del Sprint 6.3, pero no bloquea el piloto; si el tiempo no alcanza, sigue en rama.
5. **I1 e I2**: panel de solo lectura.
6. **R3.1** del plan 21 (`DashboardPage`) y después **modo básico A y B, más I3**. R3.1 va primero porque el modo básico toca los mismos archivos.
7. **Fase 4**: prueba de usabilidad con 5 tenderos y el prototipo del modo básico.
8. **I4**, y después la convocatoria y el piloto (fase 5).

**B. Durante las 6 semanas del piloto**
- **Se congela producción:** solo se despliegan correcciones de errores, cada una con su prueba. Si la aplicación cambia a mitad del piloto, no se sabe si un cambio en los indicadores se debe al tendero o al software.
- **Congelar no es dejar de desarrollar.** En ramas pueden avanzar R2, T1 y T2 del plan 21, y T3 si el Sprint 6 de Bases de Datos Avanzadas cae en estas semanas (se muestra en Docker, sin desplegar).

**C. Después del piloto**
- Se despliega en este orden: R2 → T1 y T2 con sus pruebas (T4) → R3.2 a R3.4 → T3 con el worker del Sprint 6.2 → resto de R4.
- Por qué R2 y el tiempo real esperan: tocan ventas, inventario y alertas, justo lo que mide el piloto, y para medir activación y adopción basta la consulta periódica actual (de 1 a 5 minutos).

**D. Sin fecha**
- Socket.io: solo si aparece una necesidad de comunicación bidireccional (plan 21, sección 5.2).

---

## 6. Relación con Bases de Datos Avanzadas
- El esquema `interno` y sus vistas son un caso real de lo que pide el curso: separar la analítica de la operación, con vistas y agregaciones sobre la base transaccional.
- Las vistas pueden alimentar el dashboard del Sprint 8. **En los documentos se presentan por separado** las métricas del piloto (datos reales) y las de la base de demostración (datos sintéticos).

---

## 7. Decisiones (Luis)
1. ¿Se aprueba la tabla aparte para las cuentas del equipo, en vez de un tercer rol dentro de `Usuarios`? Recomendado: sí (sección 1.1).
2. ¿Cuántas cuentas del equipo? Recomendado: una por integrante, sin cuentas compartidas, para que la bitácora sirva.
3. **Definición exacta de "activación": DECIDIDO (28-sep-2026).** Una tienda está activada si carga al menos 20 productos **y registra ventas en al menos 5 de sus primeros 7 días** desde `Tienda.fecha_creacion`. Se descartaron "una venta cualquiera en 7 días" (una venta de prueba bastaría) y "ventas los 7 días" (un día de cierre la invalidaría).
4. **"Días de apertura" para la adopción: DECIDIDO (28-sep-2026).** Se pregunta en el registro cuántos días a la semana abre la tienda (campo `Tienda.dias_apertura_semana`, entero de 1 a 7, obligatorio en el registro nuevo; las tiendas existentes quedan en 7 hasta que el administrador lo edite en Mi Tienda). La adopción semanal es días con ventas ÷ `dias_apertura_semana`, con tope de 100 %. Se implementa en I4 junto con la pregunta de experiencia digital.
5. ¿La función `ia` arranca apagada o encendida en las tiendas del piloto? Recomendado: encendida, porque es el diferenciador que se quiere medir, con un tope de consultas diarias por tienda.
6. **Matriz de roles (P22-10).** Para cada endpoint de la ampliación de 1.4: ¿lo puede usar el Tendero, solo el Administrador, o el Tendero con aprobación posterior? Se decide antes de I0; las pruebas de `autorizacion_roles.test.js` se invierten a 403 solo donde la matriz lo indique.
