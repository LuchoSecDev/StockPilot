# Plan 22: Panel interno del equipo y funciones liberables por tienda

**Estado (6-oct-2026):** I0 terminada y en producción (sección 1.4). I1 a I4: propuesta, nada implementado. Cada fase se aprueba por separado.
**La sección 5 es el único orden de ejecución vigente** para los planes 19, 21 y 22. **Cambió el 6-oct:** el piloto va con la web y el modo básico; la app nativa va en paralelo (ver «Actualización del 6-oct-2026» en la sección 5).
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

**Estado (3-oct-2026): I0 terminada, mezclada en `main` y desplegada.** Lo que se corrigió, cada punto con sus pruebas de integración:
- Rutas de tienda con `requireAdmin` (hallazgo 1.4).
- **P22-09:** aprobar y rechazar egresos solo el Administrador y solo de su tienda; además, solo desde el estado «Registrado» (409 en otro caso), porque el arqueo suma todo egreso que no esté «Rechazado».
- **Matriz de roles (P22-10):** decisiones D1 a D4 = solo Administrador (sección 7, decisión 6; detalle en `docs/propuesta_matriz_roles_P22-10.md`). `requireAdmin` en 16 rutas. En la interfaz, el Tendero que escanea un producto existente solo puede sumar stock, y ya no ve exportar ventas ni «Activar Oferta».

Hallazgos encontrados durante I0, también corregidos y desplegados:
- **Semilla en producción (crítico):** `POST /api/admin/seed` vaciaba **todas** las tablas de todas las tiendas y creaba `admin/admin123`, y cualquier persona registrada podía llamarla, porque el registro crea Administradores. Se eliminó la ruta; la semilla solo corre como comando y con una guardia que exige base local.
- **C1:** reportes editables y borrables entre tiendas. **C2:** evaluación de IA de órdenes de otra tienda, con fuga de nombres y ventas de productos. **C3:** `alertas/test-summary` sin `requireAdmin`.
- **C6:** la carpeta `exports/` era compartida: cualquier usuario listaba y descargaba exportaciones de otras tiendas. Ahora cada archivo lleva la tienda en el nombre, se verifica al descargar, se borra tras la descarga y se eliminó el listado.
- **C7:** `PUT /api/productos/agregar/:id` sumaba (o restaba, con cantidad negativa) stock sin dejar movimiento en el Kardex. Se eliminó.

Quedan abiertos, sin riesgo de seguridad: **C4** (un CSRF inválido responde 500 en vez de 403) y **C5** (`clienteRoutes` aplica `requireLogin` a todo `/api`).

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

**Tiendas de prueba (decisión del 3-oct):** en producción conviven las tiendas de QA del equipo con las del piloto. Las vistas deben excluirlas; si no, la activación y la adopción saldrían infladas con datos de prueba. Propuesta: una columna `Tienda.es_prueba` (por defecto falso), marcada por el equipo, y todas las vistas filtran `NOT es_prueba`. Además, `Ventas.canal` ('web' o 'app', plan 07, sección 6) permite separar la adopción por canal.

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

- **`ia` es la más útil para el piloto:** permite cortar el gasto de OpenAI de una tienda sin apagar el resto. El motor matemático de reposición sigue funcionando sin IA; el modo sin IA ya existe. (6-oct: el modo básico ya oculta la IA por usuario, sin esta función; ver decisión 5 de la sección 7 y el plan 23.)
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
| **I0** | Auditoría de autorización: egresos entre tiendas (P22-09), matriz de roles (P22-10), `requireAdmin` donde la matriz lo indique (incluidas las dos rutas de tienda del hallazgo 1.4) y pruebas de 403 | **Hecha** (3-oct, en producción) |
| **I1** | Esquema (3.2), cuentas del equipo, inicio de sesión con segundo factor, `requireEquipo`, bitácora | Antes del arranque del piloto |
| **I2** | Vistas de métricas (3.3, excluyendo las tiendas de prueba) y pantallas Tiendas, Detalle y Bitácora (solo lectura) | Antes del arranque del piloto |
| **I3** | Funciones liberables (3.4) | Después del piloto: el modo básico web es una preferencia por usuario y no las necesita |
| **I4** | Pantalla de embudo, párrafo de la política (3.7), campo de experiencia digital en el registro y encuesta de satisfacción (plan 19, 3.5) | Antes del arranque del piloto |

El código nuevo se escribe desde el inicio con el patrón del plan 21: controladores delgados y lógica en `services/interno/`. Así no se crea más deuda mientras se refactoriza la existente.

---

## 5. Orden general de ejecución (único vigente)

Esta es la única lista de orden para los planes 07, 19, 21 y 22; el plan 21 remite aquí y en su sección 6 solo guarda las dependencias entre sus fases. El estado de cada punto se lleva en `docs/seguimiento_planes.xlsx`.

**Actualización del 6-oct-2026 (reemplaza la del 3-oct).** Luis decidió que **el piloto y la visita de esta semana van con la web**, y que la app nativa del Tendero sigue en paralelo, sin fecha de piloto, para presentarla en la sustentación (prevista para noviembre, día por confirmar). Motivo: la app todavía no cubre egresos, mercancía, alertas ni cobros no efectivos, y llevarla a una tienda real con prisa pondría en riesgo los datos del piloto. La app es una comodidad para los tenderos que no usan computador, no un requisito del piloto.

Qué cambia respecto al 3-oct:
- **El modo básico web (plan 19, 3.4) vuelve a ir antes de la visita**, porque sin app la web es lo único que ve el Tendero y el menú tiene 15 o 16 módulos. Van las fases **A, B y C** (preferencia, menú condicional y la pantalla `/pedir`). **D** (permisos de Colaborador sobre órdenes) y **E** (catálogo simplificado) quedan para después de la visita: `/pedir` se entrega solo al Administrador, que es el dueño de la tienda y quien hará la prueba.
- **El modo básico es una preferencia por usuario** (`Usuarios.modo_interfaz`), no una función por tienda, así que **I3 sigue después del piloto**.
- **El panel (I1, I2, I4) sigue siendo antes del arranque del piloto, no antes de la visita**, y suma la **encuesta de satisfacción** del plan 19, 3.5 (punto 3), con las dos preguntas de «sorpresa».
- **La visita sigue sin ser el arranque del piloto.** Para la prueba de usabilidad (fase 4) se usa una tienda de demostración y una hoja de observación en papel (tiempo, errores y SUS por tarea): el panel no la mide.
- **La app deja de ir en la visita.** Se sigue construyendo en ramas, contra un entorno aparte desde el arranque del piloto, y no se publica nueva versión durante las 6 semanas. Una prueba pequeña con 2 o 3 tenderos, antes de la sustentación, dará la evidencia real de la app.
- R3.1 sigue **después del piloto**: el modo básico (A, B y C) no depende de ese refactor.

**Actualización del 3-oct-2026 (histórica, ya no vigente).** El equipo adelantó la app nativa del Tendero (plan 07, sección 6) para llevarla a la visita a las tiendas piloto, prevista para la semana del 5 de octubre. La visita **no** es el arranque del piloto: el arranque se programa después con cada dueño. Con la app, el modo básico web (plan 19, 3.4), R3.1 e I3 dejaban de ir antes del piloto.

**Hecho (28-sep a 3-oct), todo en `main` y desplegado:**
- R0 del plan 21 (P21-01) y el reinicio de limitadores en las pruebas (P21-11).
- I0 completo: P22-09, matriz de roles (P22-10), la semilla en producción y C1, C2, C3, C6 y C7 (sección 1.4).
- Respaldo externo: workflow diario de GitHub Actions, cifrado, con 14 días de retención (`docs/restaurar_respaldo.md`). Restauración verificada el 3-oct, según Luis.

**A. Antes de la visita (vigente desde el 6-oct)**
1. **Modo básico web, fases A, B y C** (plan 19, 3.4.3), cada una con su prueba. Las cuentas existentes se respaldan a `'avanzado'` para no cambiarles el menú de golpe.
2. **Tienda de demostración** y **material de la visita:** guion de la fase 4 con las 6 tareas, hoja de observación (tiempo, errores, SUS), autorización de tratamiento de datos y formato de línea base.
3. **Backend para la app: ya hecho** (lo que sigue es histórico, del 3 al 5-oct; está en `main` y desplegado). Lo que quede pendiente del lado de la app no bloquea la visita.

*Histórico, backend para la app* (rama `feat/backend-app-tendero`), cada punto con su prueba:
   - sesión por canal: una en la web y una en la app al mismo tiempo (plan 07, sección 6);
   - `Ventas.canal` ('web' o 'app');
   - limitador de `verify-reset-code` y `skip` del limitador global (P21-09 y P21-13);
   - apertura de caja con transacción y bloqueo (plan 21, punto 2.4);
   - `docs/contrato_api_app_tendero.md`, con la prueba de integración de cada endpoint.
   - **Añadido el 4-oct-2026**, antes de que la app empiece a construirse: idempotencia de la venta del carrito (cabecera `Idempotency-Key`, para reintentar sin duplicar cuando se pierde la señal) y validación de `metodo_pago` (un «efectivo» en minúscula dejaba la venta fuera del arqueo). Ambas en el contrato `[V2]`, con sus pruebas.
   - **Entorno de desarrollo de la app (4-oct-2026):** mientras no haya tiendas reales, el equipo desarrolla contra el servidor desplegado (`docs/guia_entorno_app.md`). Desde el arranque del piloto eso deja de ser posible: hará falta un entorno aparte (ver C).
   - *Versión de prueba de la app para Android* (equipo, repositorio aparte), construida contra ese contrato: **sigue en desarrollo, fuera de la visita.**

**B. La visita**
- Presentación, autorización de datos, línea base y **fase 4 (usabilidad) con la web en modo básico**, sobre la tienda de demostración. Si la fase C no estuviera lista, las tareas 4 y 5 se hacen en el menú completo y el informe lo dice.
- Render está en plan gratuito y se duerme tras 15 minutos sin tráfico: abrir la app o la web unos minutos antes de entrar a cada tienda.

**C. Entre la visita y el arranque del piloto**
1. Correcciones que salgan de la fase 4, en la app y en el backend.
2. **I1 e I2:** panel de solo lectura, excluyendo las tiendas de prueba (sección 3.3).
3. **I4:** preguntas del registro (días de apertura, experiencia digital) y párrafo de la política de datos.
4. Recomendado: migración explícita (plan 21, punto 2.2) y la regla de recepción de mercancía (P21-10, decisión 5 del plan 21; **decidida e implementada el 4-oct: opción B, pedir confirmación con motivo, y el faltante queda pendiente en una orden «Parcial»**).
   - **Antes del arranque, limpiar la base de producción.** Hoy todas las tiendas son de prueba y una tiene el Administrador `admin` con una contraseña conocida (`admin123`, la que crea la semilla). Con tiendas reales eso es una puerta abierta: borrar o cambiar esas cuentas y las tiendas de prueba que no se usen en el piloto, y decidir el **entorno aparte** de desarrollo de la app (el backend en local, o un servicio de pruebas con su propia base).
5. Decidir si se mantiene despierto el servidor en horario de tienda con un *ping* (cabe en las horas gratuitas de Render si es el único servicio gratuito).
6. Arranque acordado con cada dueño.

**D. Durante las 6 semanas del piloto**
- **Se congelan producción y la app:** solo correcciones de errores, cada una con su prueba. Si la herramienta cambia a mitad del piloto, no se sabe si un cambio en los indicadores se debe al tendero o al software.
- **Congelar no es dejar de desarrollar.** En ramas pueden avanzar R1, R2 y T3 si el Sprint 6 de Bases de Datos Avanzadas cae en estas semanas (se muestra en Docker, sin desplegar). **R1 ya está hecha (8-oct): mezclada a `main` local y subida en la rama `refactor/R1-servicios-ia`**; `origin/main` sin actualizar por el congelamiento. Ver el plan 21, sección 4.

**E. Después del piloto**
- R1 (hecha el 8-oct y mezclada a `main` local; falta subir `main` y desplegarla después del piloto), R2, tiempo real replanteado para la app (notificaciones push) y para la web (SSE), R3, T3 con el worker del Sprint 6.2 y R4.
- Actualizar los E2E de Playwright (`docs/hallazgo_e2e_desactualizados.md`), C4 y C5.
- Modo básico web fases D y E, e I3, solo si el piloto muestra que hacen falta.
- Prueba de usabilidad de la app con 2 o 3 tenderos, en entorno aparte, antes de la sustentación.
- Distribución en iPhone (requiere un Mac y la membresía de pago de Apple).

**F. Sin fecha**
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
5. **La función `ia` en el piloto: DECIDIDO (6-oct-2026), cambia la recomendación anterior («encendida»).** La IA va **disponible pero opcional**: en el modo básico (el de las cuentas nuevas) no se muestra ni se pide al servidor; con «Ver menú completo» aparecen el Consejero y las promociones. El piloto es corto y la IA necesita historial para aprender, así que lo que se prueba es el punto de venta, las alertas y el inventario con el motor matemático. La función `ia` por tienda (I3) sigue siendo después del piloto; antes de activar cualquier envío de datos personales o fotos a OpenAI aplica la regla de privacidad del plan 23, sección 4.
6. **Matriz de roles (P22-10): DECIDIDO (28-sep-2026).** D1: crear y editar productos, solo Administrador (el Tendero que escanea solo suma stock). D2: salida y ajuste de inventario, solo Administrador por ahora. D3: exportar ventas y aplicar estrategias de IA, solo Administrador, ocultando los controles sin flujo de solicitud. D4: clientes y abonos, solo Administrador por ahora; en la fase 4 se pregunta quién cobra los fiados en cada tienda. Detalle en `docs/propuesta_matriz_roles_P22-10.md`.
