# Plan 25: Tienda de demostración para la visita al tendero

**Estado (9-oct-2026):** no iniciado, listo para ejecutar. D1 a D7 decididas por Luis y plan corregido tras la revisión (sección 0). La fase 1 puede empezar cuando Luis lo pida (primero se hace el commit de docs de D7).
**Fecha:** 2026-10-09
**Rama:** `feat/tienda-demo` (aún no existe; se crea desde `main` al ejecutar la fase 1).
**Origen:** Luis preguntó (9-oct) si algún plan cubría preparar una tienda de prueba para mostrarle al tendero las funciones principales que tendría si acepta el piloto: alertas de vencimiento, alertas de stock, órdenes de compra preparadas para solo aprobarlas o enviarlas, etc. Respuesta: el plan 22 la nombra pero no la diseña (hallazgo 1.1).
**Relacionado con:** plan 22 (sección 5, A.2, B y línea 328: separar las métricas del piloto de la base de demostración), plan 19 (3.4: modo básico, fases A a C, y P19-11), plan 13 (Consejero IA y borradores), plan 21 (alertas), plan 10 (P10-04: guardia de la semilla), `docs/guia_entorno_app.md` (levantar el backend en local).

**Cómo leer las marcas de evidencia.** **[V]** = lo leí yo en el código o lo ejecuté. **[S]** = lo informó el subagente de exploración y no lo releí (tómalo como INFERRED hasta que la fase 1 lo compruebe con una prueba). **[?]** = no se pudo comprobar.

---

## 0. Actualización del 9-oct-2026: decisiones de Luis y revisión del plan

**Decisiones de Luis (9-oct):**
- **D1 = A:** la tienda de demostración vive en local (base `stockpilot_demo` en el portátil del equipo).
- **D2 = B:** el escenario incluye fiado/cartera y caja (egresos y arqueo), además de alertas, `/pedir`, envío, recepción y venta. **No se muestra la cuenta de Tendero:** la demostración es para el dueño; esa cuenta solo importa cuando acepte usar la app. El escenario crea solo el Administrador.
- **D3 = B:** el correo del proveedor demostrativo es un buzón de Luis. Luis ya tiene configurado que los correos le lleguen solo a él (aún no hay dominio). Las demás cuentas del escenario llevan correos `@example.invalid`.
- **D4:** no se muestra el Consejero IA.
- **Datos reproducibles:** sí (generador con semilla fija). Luis añadió que el seed actual «modifica todo» y que pensaba eliminarlo y dejar solo las tiendas QA que ya están creadas → se resolvió como **D5 = conservar `seed_test_data.js` intacto** (ver abajo).
- **D5 = conservar el seed viejo** (recomendación aceptada): las tiendas QA están en producción y la demostración es local; el seed lo usan la prueba de la guardia, las guías y los E2E. Retirarlo se puede decidir más adelante sin afectar la demostración.
- **D6 = P25-06 en prioridad Alta, antes del arranque del piloto**, en una rama aparte con la prueba primero.
- **D7 = un commit solo de docs en la rama actual** antes de crear `feat/tienda-demo`, sin push hasta que Luis lo apruebe.

**Correcciones por la revisión (`/review-plan`, 9-oct).** Cada hallazgo se comprobó contra el código antes de aplicarlo:
- El comando `demo:sembrar` no pasaba la guardia (la base no termina en `_test` y faltaba `--base-local`). Ahora usa `.env.demo` (no se toca el `.env` general), exige además el sufijo `_demo` y se elimina `demo:reiniciar`, que era el mismo comando.
- La siembra ahora dice qué borra (todas las tablas de la app, no `interno.*`, con `RESTART IDENTITY`), contra qué base (solo la de `.env.demo`) y espera `db.migrationReady`.
- La mutación (a) estaba invertida (subir el stock *aumenta* los sobrantes) y la (b) no fallaba (dos corridas con la misma constante cambian por igual). Reescritas.
- Vender exige caja abierta siempre (`saleController.js:206, 336`); no solo cuando D2 incluye caja.
- Los días de stock de `stock_critico`/`stock_bajo` usan `velocity_30d` (`reposicion.js:90`), no la de 7 días. La tabla 2.1 lo dice ahora.
- En local el backend no sirve el frontend (solo con `NODE_ENV=production`, `app.js:207`): hace falta Vite.
- `sembrarDemo` no recibe pool (`Alert.generate` usa el `db` global); la guardia va dentro de `require.main === module`.
- 1.6 era falso: la auto-migración sí asigna `id_propietario` (`config/database.js:163-168`). P25-06: la l.539 tampoco filtra por tienda.
- Zona horaria: las fechas se calculan en America/Bogota, no con `toISOString()`.

---

## 1. Hallazgos (qué hay hoy)

### 1.1 Lo que los planes dicen de la tienda de demostración
- Plan 22, sección 5, A.2: «Tienda de demostración y material de la visita» es un entregable antes de la visita, junto con el guion de las 6 tareas, la hoja de observación, la autorización de datos y la línea base. **No dice qué datos lleva, dónde vive ni cómo se reinicia** [V].
- Plan 22, líneas 269 y 296: la prueba de usabilidad (fase 4) se hace sobre ella, con la web en modo básico y una hoja de observación en papel [V].
- Plan 22, línea 328: las métricas del piloto y las de la base de demostración se presentan por separado [V].
- Plan 19, línea 110: dos de las 6 tareas son «registrar la llegada de mercancía» y «aprobar la sugerencia de compra» [V].
- Nada en los planes 13, 19, 21, 22, 23 ni 24 diseña los datos de la demostración [V, por búsqueda].

### 1.2 La semilla actual no sirve tal cual
`database/seed_test_data.js` (`npm run seed`, `package.json:13` [S]):
- **Vacía toda la base**: `TRUNCATE … Productos, Proveedores, Usuarios, Tienda CASCADE` (l.111-112 [S]). Solo es seguro en una base local.
- **Guardia** (`database/guardiaSemilla.js:28-33` [V]): rechaza cualquier host que no sea `localhost`, `127.0.0.1` o `::1`, y exige que la base termine en `_test` o el flag `--base-local`. Por diseño **no puede correr contra Neon**.
- Crea una tienda, un Administrador y un Tendero, 18 productos y 30 días de ventas con `Math.random` (`seed_test_data.js:48-70, 75-101` [V]). El comentario de la l.46 dice «40 productos»; son 18 [V]. Las ventas no son reproducibles: dos corridas dan alertas distintas.
- **No crea** alertas, órdenes de compra, clientes ni caja [S]; el proveedor no tiene correo (`Proveedores` solo con `id_tienda` y `nombre_empresa`) [S]. Los usuarios heredan `modo_interfaz = 'basico'` por el valor por defecto (`config/migraciones/modoInterfaz.js:18` [V]).
- **No deja alertas de vencimiento.** Los productos que vencen pronto (`LA001` en 2 días, `LA003` en 3, `SN005` en 15, `BH006` en 12) tienen stock bajo y rotación alta. `Alert.determinarAlertaVencimiento` (`models/Alert.js:342-349` [V]) solo alerta si `cantidad − floor(velocity_7d × días) > 0`; con ~4,5 unidades vendidas al día, el stock se agota antes de vencer y no hay «sobrantes». Los 4 productos ya vencidos (`VN001` a `VN004`) tampoco: `diasParaVencer < 0` devuelve `null` (l.343 [V]); sirven para el reporte de merma. **Que no salga alerta es una inferencia a partir de las reglas, no lo ejecuté (INFERRED)**, porque las ventas son aleatorias.
- **No dispara `Alert.generate`.** No hay cron de alertas: se generan por eventos (venta, movimiento de inventario, crear/editar producto, recepción de orden) y a mano con `POST /api/alertas/generate` [S]. Una tienda recién sembrada tiene la tabla `Alertas` vacía hasta que ocurra alguno.

### 1.3 Cómo se calculan las alertas (lo que el escenario debe provocar)
- `velocity_7d = ventas de los últimos 7 días ÷ 7` (`services/inventory/entradasMotor.js:31, 54` [V]). Solo cuentan productos con `estado = 'Disponible'` (l.63 [V]).
- Vencimiento: crítico si faltan ≤ 7 días y quedan sobrantes; próximo si faltan ≤ 30 (`Alert.js:346-347` [V]).
- Stock: `stock_critico` si la urgencia del motor es HOY (agotado o `diasParaAgotar ≤ lead_time`), `stock_bajo` si es SEMANA (`Alert.js:42-48`, `services/inventory/reposicion.js:92-106` [S]).
- Sobrestock: `cantidad > stock_maximo`, clase C y más de 60 días de cobertura (`Alert.js:351-353` [V]).
- **Consecuencia:** el escenario se arma con ventas explícitas y fechas relativas a «hoy», no al azar, y la prueba comprueba qué alertas salen.

### 1.4 Órdenes de compra: lo que se puede mostrar sin IA
- La pantalla `/pedir` (modo básico, solo Administrador) usa el motor matemático, **no OpenAI** (`GET /api/ia/snapshot`, `GET /api/ordenes/borradores/resumen`; comentarios en `usePedir.js:8`, `PedirPage.jsx:7-8` [S]). Arma el borrador con `POST /api/ordenes/borrador/desde-consejero` (**ese endpoint tampoco llama a OpenAI**: recibe cantidades ya calculadas), aprueba con `PATCH /api/ordenes/:id/estado` (`Aprobada`), descarta (`Rechazada`) y recibe con `POST …/completar` [S].
- **`/pedir` no envía correo** [S]. El envío al proveedor está en `/proveedores` (historial de órdenes): `POST /api/ordenes/:id/enviar-proveedor` exige el correo del proveedor (si no, 400 «Falta email proveedor») y **solo después de que `sendMail` tiene éxito** pasa la orden a `Enviada` (`suppliersController.js:467-472` [V], l.538-539 [S]). Sin correo, el historial ofrece «descargar PDF» y «Ya la envié: marcar como enviada» (`OrdenesHistory.jsx:334, 344` [S]).
- El **Consejero IA** del dashboard (`GET /api/ia/recommendations`) **sí** llama a OpenAI (`gpt-4o-mini`) y falla sin clave (`openaiClient.js:21-24` [S]); en modo básico el dashboard ni siquiera lo pide (`DashboardPage.jsx:92-95` [S]).
- Estados reales de una orden: Borrador, Pendiente, Aprobada, Rechazada, Enviada, Parcial, Completada. **No existe «Recibida»**: el cierre es `Completada` [S]. Un solo borrador abierto por proveedor y tienda.

### 1.5 Correo
`config/mailer.js` usa Resend si hay `RESEND_API_KEY`, y si no SMTP con `EMAIL_USER`/`EMAIL_PASS` [S]. Una demostración con credenciales configuradas enviaría correos reales al proveedor registrado; el resumen semanal de alertas (lunes 8:00, `schedulerService`) iría al correo de cada Administrador [S]. Sin credenciales el envío responde 500 y la orden **no** cambia de estado [S].

### 1.6 No existe reinicio por tienda
No hay ruta, servicio ni script para borrar o reiniciar los datos de **una** tienda. `Store.delete` (`models/Store.js:67-71` [S]) existe, borra en cascada, pero solo se usa en el rollback del registro y no está expuesto. El único borrado masivo es el `TRUNCATE` de toda la base de la semilla [S]. (Corregido el 9-oct: la semilla no fija `id_propietario`, pero la auto-migración de `config/database.js:163-168` [V] asigna como dueño al primer Administrador cuando arranca el servidor, así que la tienda sí aparece en «Mis tiendas».)

### 1.7 Producción: `es_prueba` y el panel interno
- `Tienda.es_prueba` (`config/migraciones/panelInterno.js:201-203` [S]) excluye la tienda de la activación, la adopción y el embudo (`interno.v_activacion`, `v_adopcion_semanal` filtran `NOT es_prueba` [S]).
- **Solo se puede marcar desde el panel interno** (`PUT /api/interno/tiendas/:id/es-prueba`, con cuenta del equipo y 2FA) o con SQL; el registro y la semilla no lo fijan [S]. Es decir, una tienda creada en producción cuenta como real hasta que el equipo la marque.
- Render duerme el servicio tras 15 minutos y la primera petición tarda cerca de un minuto (`docs/guia_entorno_app.md:18` [V]).

### 1.8 Hallazgo de seguridad, fuera de la demostración: `enviar-proveedor` sin filtro de tienda
`sendOrderToSupplier` declara `tiendaId` (l.470) pero la consulta de la l.471 **no lo usa**: `… WHERE o.id_orden = ?`. Todos los demás endpoints de órdenes sí filtran por `id_tienda` (l.261, 284-286, 339, 456, 567 [V]). Un Administrador de otra tienda podría pedir el envío de una orden ajena (correo al proveedor de la otra tienda y estado `Enviada`) conociendo su id; la actualización de estado de la l.539 (`UPDATE … WHERE id_orden = ?`) tampoco filtra [V]. Además **ninguna prueba** menciona `enviar-proveedor` ni `sendMail` (búsqueda en `tests/` sin resultados [V]). Mismo patrón que C1 y C2 del plan 22. No se arregla aquí: queda como P25-06.

---

## 2. Qué debe poder ver el tendero (alcance del escenario)

Recorrido de ~15 minutos, de «hoy» a «lo que me cuesta menos trabajo»:

| # | Función | Qué debe verse | Datos que lo provocan |
|---|---|---|---|
| 1 | Vista general / Monitor de alertas | Alertas por stock y por vencimiento, con severidad | Ver 2.1 |
| 2 | Punto de venta | Una venta de mostrador de principio a fin | Productos con precio y stock suficiente. **Toda venta exige caja abierta** (`saleController.js:206, 336` [V]): el guion abre la caja con un monto ficticio antes de vender |
| 3 | `/pedir` | «Lo que hay que pedir» agrupado por proveedor, un pedido listo para aprobar | 2 proveedores con productos en alerta |
| 4 | Aprobar y enviar | Un pedido `Aprobada` listo para enviar (con correo) y otro para el camino sin correo (PDF / «ya la envié») | Proveedor A con correo controlado, proveedor B sin correo |
| 5 | Recibir mercancía | Una orden `Enviada` lista para recibir, con una línea que llega incompleta (regla P21-10) | 1 orden `Enviada` |
| 6 | Catálogo | Productos, categorías, vencimientos | 25 a 30 productos |
| 7 | Fiado / Cartera, egresos de caja y arqueo (D2 = B) | Un cliente con deuda y un abono; un egreso; el arqueo previo al cierre | 2 o 3 clientes (uno con deuda), 1 egreso. Cartera y Colaboradores no están en el menú básico (P19-11): se pasa a «Ver menú completo» |

### 2.1 Escenario de alertas (cifras objetivo; la fase 1 las ajusta con la prueba)
**Cálculo que el escenario debe respetar** [V, `reposicion.js:76-106`, `entradasMotor.js:31-32, 54-55`, `Alert.js:342-349`]: los días de stock son `floor(cantidad ÷ (ventas de 30 días ÷ 30))`; la urgencia exige `cantidadBase > 0`; el vencimiento usa `ventas de 7 días ÷ 7`; la clase ABC es relativa a toda la tienda (C = el último 5 % de ingresos). Por eso cada producto de vencimiento necesita ventas en ambas ventanas y un `stock_maximo` ≥ su cantidad (para no disparar también sobrestock), y el producto de sobrestock debe tener 0 ventas en 30 días y `cantidad > stock_maximo`. Las ventas no caen en los días 0, 7 ni 30 hacia atrás (bordes de ventana).

| Alerta | Cuántas | Cómo se provoca |
|---|---|---|
| `stock_critico` | 3 a 4 | Alta rotación (≥ 4 u/día), stock ≤ 1 día de venta, `lead_time` 2 |
| `stock_bajo` | 2 a 3 | Stock para ~4 a 6 días con `lead_time` 2 y `frecuencia_compra_dias` 7 |
| `vencimiento_critico` | 2 | Vence en 3 a 6 días, stock 12, vendió 1 a 2 unidades en 7 días (→ sobrantes) |
| `vencimiento_proximo` | 2 | Vence en 15 a 25 días, stock 20, vendió 3 a 4 en 7 días |
| `sobrestock` | 1 | Clase C, `cantidad > stock_maximo`, más de 60 días de cobertura |
| Vencidos (merma) | 2 | `fecha_vencimiento` en el pasado (reporte de merma; no generan alerta) |

---

## 3. Decisiones

**Decididas (9-oct): D1 a D7**, ver la sección 0; las opciones originales se conservan abajo como registro. **No quedan decisiones pendientes para la fase 1.**

### D1. ¿Dónde vive la tienda de demostración? **DECIDIDO: A (local)**
| Opción | A favor | En contra |
|---|---|---|
| **A. Local, en el portátil del equipo** (`stockpilot_demo` sembrada con un script nuevo, `npm run dev`) | La guardia actual ya permite sembrarla; no toca producción ni las métricas del piloto; sin arranque en frío de Render; el reinicio es borrar y sembrar; sin riesgo de correos reales | Solo se ve en ese equipo; el tendero no puede explorar después desde su celular; requiere Node y PostgreSQL locales |
| **B. Producción, tienda aparte marcada `es_prueba`** | Se puede dejar un enlace; sirve también para ensayar | Exige un script de reinicio por tienda que **no existe** y que escribe en producción (alto riesgo, ver fase 3); la guardia de la semilla lo prohíbe; la tienda cuenta como real hasta que el equipo la marque; arranque en frío de Render ~1 min delante del tendero; correos reales |
| **C. Base aparte en la nube** (rama de Neon + segundo servicio) | Enlace accesible, aislada de producción | Más infraestructura y costo; sigue necesitando un servicio desplegado y credenciales; es el mismo «entorno aparte» de P22-25 y conviene decidirlo junto |

**Recomendación: A para la visita.** Es la única que no escribe en producción y la que ya tiene guardia. B/C se reevalúan después si el piloto pide una demostración que el tendero pueda abrir solo. **Si se elige B o C, aparece la fase 3 y D1 deja de ser «solo local».**

### D2. ¿Qué incluye el escenario? **DECIDIDO: B (con cartera y caja), solo cuenta de Administrador**
- **A.** Alertas + `/pedir` + aprobar/enviar + recibir + una venta (sección 2, filas 1 a 6). **Recomendada:** cubre lo que Luis pidió y las 6 tareas de la fase 4.
- **B.** A + fiado/cartera + egresos y arqueo de caja (fila 7). Más datos, más tiempo de guion; y hoy Colaboradores y Cartera **no están en el menú básico** (P19-11 sigue pendiente): habría que pasar a «Ver menú completo» durante la demostración.
- Pregunta aparte, resuelta: la cuenta de **Tendero** no se muestra (la demostración es para el dueño). `/pedir` es solo del Administrador (plan 19, línea 108).

### D3. Correo en la demostración **DECIDIDO: B (buzón de Luis; PDF como plan B)**
- **A. Sin credenciales de correo**: el envío falla con 500 y se demuestra el camino «PDF / ya la envié». Seguro; pero no se ve «enviar de verdad».
- **B. Correo del proveedor demostrativo = un buzón del equipo**, y credenciales reales solo en el `.env` local (nunca en el repositorio ni en este plan). Se ve el correo salir y llegar. Verificar antes con una orden de prueba; Resend con el remitente de pruebas puede limitar los destinatarios [?, conocimiento general, no está en el repositorio].
- **Recomendación: B para el ensayo, con A como plan B** si no hay red o el servicio falla en la visita.

### D4. ¿Se muestra el Consejero IA del dashboard? **DECIDIDO: no**
Necesita `OPENAI_API_KEY` y red [S]. **Recomendación: no.** `/pedir` ya muestra «qué pedir» sin IA, y la demostración no debe depender de un servicio externo. Si Luis la quiere, se ensaya antes con la misma tienda y se deja el plan B.

### D5. Datos reproducibles **DECIDIDO: sí**, y destino de la semilla vieja **DECIDIDO: conservarla intacta**
Reemplazar `Math.random` por un generador con semilla fija y fechas relativas a `hoy`, de modo que dos corridas den lo mismo y la prueba pueda afirmar qué alertas salen.

**Pregunta que se resolvió: ¿qué se hace con `database/seed_test_data.js` (`npm run seed`)?** Luis dijo que «modifica todo» (es cierto: hace `TRUNCATE` de toda la base, `seed_test_data.js:111-112`) y propuso eliminarlo y quedarse con las tiendas QA que ya existen. Lo que hay que saber antes de decidir [V]:
- Las tiendas QA que ya existen están **en producción (Neon)**; con D1 = A la demostración es local y no las ve.
- Quien depende hoy del archivo: `package.json:13`; la prueba `tests/business_logic/guardia_semilla.test.js:51-52` (que lo ejecuta como proceso real para comprobar que se niega a correr contra una base remota); las guías `docs/guia_entorno_app.md:47` y `docs/hallazgo_e2e_desactualizados.md:5, 27-28` (los E2E de Playwright dependen del usuario de la semilla); el plan 10 (P10-04).
- Opciones: (1) **conservarlo intacto** y crear `seed_demo.js` aparte (recomendada: no rompe nada y la guardia queda probada); (2) **retirarlo**: hay que reescribir la prueba de la guardia para que use `seed_demo.js`, quitar el script y actualizar las tres guías, y los E2E quedan sin datos; (3) usar una tienda QA de producción como demostración: contradice D1 = A, escribe en producción y requeriría la fase 3.

### D6. Severidad y momento de P25-06 **DECIDIDO: Alta, antes del piloto**
Hoy está en Media. Los defectos análogos corregidos (C1, C2, P22-09) se marcaron Alta. Recomendación: **Alta, arreglarlo antes del arranque del piloto**, con la prueba primero (en una rama aparte de la demostración).

### D7. Dónde se commitean los docs antes de crear la rama **DECIDIDO: un commit de docs en la rama actual**
Hoy hay unos 25 archivos de `docs/` modificados sin commitear, y este plan y el plan 24 están sin seguimiento en git. Recomendación: **un commit solo de docs en la rama actual (o en `main`, según prefiera Luis), con su aprobación**, antes de crear `feat/tienda-demo`.

---

## 4. Fases

### Fase 1: escenario de datos y semilla de demostración (D1 = A y D2 = B decididas; falta cerrar D5 y D7)
**Objetivo.** Un comando que deja una base local con el escenario de la sección 2.
**Fuera de alcance.** Reinicio por tienda en producción (fase 3), cambios a pantallas, el arreglo de `enviar-proveedor` (P25-06), y modificar o retirar `seed_test_data.js` (queda a lo que decida D5; esta fase no lo toca).
**Archivos.**
- Crear `database/demoEscenario.js`: función **pura** `armarEscenario({ hoy, semilla })` que devuelve tienda, usuarios, proveedores, productos, ventas, y las órdenes (Borrador, Aprobada, Enviada) con fechas relativas a `hoy`. Generador pseudoaleatorio con semilla (p. ej. mulberry32).
- Crear `database/seed_demo.js` con dos partes:
  - **Función exportada** `sembrarDemo({ hoy })`: usa el `db` global de `config/database.js` (no recibe pool: `Alert.generate` también usa el global, `models/Alert.js:1, 108` [V]); espera `await db.migrationReady` antes de escribir (si no, el `TRUNCATE` compite con la auto-migración y produce deadlocks, como documenta `tests/integration/helpers/db.js`); en **una sola transacción** vacía todas las tablas de la app (la lista de `tests/integration/helpers/db.js`, **sin** `interno.*`) con `TRUNCATE … RESTART IDENTITY CASCADE` y siembra el escenario; al final llama a `Alert.generate(tiendaId)`. `hoy` es por defecto `db.getBogotaDate()` (`config/database.js:113` [V]); las fechas se formatean en America/Bogota, nunca con `toISOString()`; las ventas van a las 12:00 de Bogotá. Se puede importar desde una prueba sin efectos.
  - **CLI** dentro de `if (require.main === module)`: antes de cargar `config/database.js`, llama a `evaluarGuardiaSemilla(process.env.DATABASE_URL, { permitirBaseLocal: true })` **y además exige que el nombre de la base termine en `_demo`**; si no, imprime el motivo y `process.exit(1)`. Así el comando nunca puede vaciar `stockpilot`, `stockpilot_test` ni una base remota.
- Crear `.env.demo` (ya lo ignora `.gitignore:6`, regla `.env.*` [V]), solo local, con `DATABASE_URL=postgres://…@localhost:5432/stockpilot_demo`, `PORT=3000`, `NODE_ENV=development`, `DEMO_CORREO_PROVEEDOR` (el buzón de Luis), la contraseña de la cuenta de demostración, y las credenciales de correo (D3 = B). Nada de esto va al repositorio ni a este plan.
- `package.json`: un solo script, `"demo:sembrar": "node -r dotenv/config database/seed_demo.js dotenv_config_path=.env.demo"` (`dotenv` ya es dependencia, `package.json:33` [V]; `dotenv` no pisa variables ya definidas, así que el `.env` general no interfiere). **Se elimina `demo:reiniciar`**: reiniciar es volver a correr el mismo comando. La guardia se aplica por la bandera interna del CLI, no por el nombre del script.
- No tocar: `database/seed_test_data.js` (hasta D5), `database/guardiaSemilla.js`, `models/Alert.js`, controladores, el `.env` general.
**Pasos.**
1. Pruebas primero (abajo); verlas fallar.
2. Escribir `demoEscenario.js` hasta que las unitarias pasen; luego `seed_demo.js` hasta que la de integración pase.
3. Verificar el esquema real antes de insertar (`database/init_pg.sql` y las migraciones): columnas de `Proveedores` (`email` y `correo`, los dos se escriben en `suppliersController.js:46-49` [V]), `Ordenes_Compra` (`origen`, `riesgo`, `presupuesto_total`), `Ordenes_Detalle` (`cantidad_final`, `costo_unitario`), `MovimientosStock`, `VentasProductos.precio_unitario`, y, por D2 = B, `Clientes`, `Abonos`, `SesionCaja` y `EgresosCaja`. Cada producto lleva un movimiento de Kardex «Entrada» inicial y cada venta deja su `precio_unitario` (si no, Movimientos y los reportes de margen salen vacíos).
4. Los borradores/órdenes se insertan con SQL que replica lo que hace `crearDesdeConsejero` (`ordenBorradorController.js:35-130` [S]); la prueba de integración comprueba que la API los lee y los puede aprobar y recibir.
**Riesgo.** **Borra todas las tablas de la app** de la base a la que apunte `.env.demo`; solo es seguro porque la guardia exige host local y sufijo `_demo`. **Detenerse y preguntar** si hace falta tocar `guardiaSemilla.js`, relajar el sufijo `_demo`, sembrar contra un host no local, o si se cambia D1.
**Verificación.**
- *Unitarias* (`tests/business_logic/demo_escenario.test.js`): con la misma semilla y `hoy` el resultado es idéntico, y una **huella SHA-256 fija** de `JSON.stringify(armarEscenario({ hoy: '2026-10-09', semilla: 25 }))` se compara contra un valor escrito en la prueba; con otro `hoy`, las fechas se desplazan; cada producto de la sección 2.1 se evalúa con `Alert.evaluarProducto(item, extra, hoy)` (simulando `config/database.js` con un mock, como en `tests/business_logic/inventory_math.test.js:14-19`) para no reimplementar la regla; precios y costos enteros positivos; ningún correo externo salvo `DEMO_CORREO_PROVEEDOR`; las cuentas del escenario usan `@example.invalid`. La clase ABC se pasa explícita aquí; la real la comprueba la prueba de integración.
- *Integración* (`tests/integration/demo_sembrado.test.js`, contra `stockpilot_test`, nunca contra `.env`): `limpiarBaseDePruebas()`, luego `sembrarDemo({ hoy })` con `hoy` = la fecha real de Bogotá (porque `Alert.generate` usa la fecha real) y comprobar que el conjunto de tipos de alerta incluye `stock_critico`, `stock_bajo`, `vencimiento_critico`, `vencimiento_proximo` y `sobrestock`; `GET /api/ordenes/borradores/resumen` devuelve los borradores; el Administrador aprueba un borrador y recibir la orden `Enviada` con una línea incompleta la deja `Parcial`; una venta funciona **después de abrir caja** y devuelve 403 antes; hay un cliente con deuda. **Aislamiento:** crear una segunda tienda con `tests/integration/helpers/tiendas.js` y `fixtures.js` y comprobar que su Administrador ve 0 alertas, 0 borradores y 0 clientes de la tienda de demostración.
- *Mutación* (restaurar después de cada una): (a) **bajar** la cantidad de un producto de `vencimiento_critico` a ≤ `floor(ventas7 ÷ 7 × días)` → debe desaparecer su alerta y fallar la prueba de integración; (b) reemplazar el generador con semilla por `Math.random` → debe fallar la huella; (c) sembrar con `hoy` fijo y no desplazar las fechas → debe fallar la prueba de fechas relativas; (d) quitar la espera de `db.migrationReady` → documentar si la prueba lo detecta (puede ser intermitente; si no falla de forma fiable, dejarlo anotado como no cubierto); (e) cambiar el sufijo exigido `_demo` por cualquier otro → debe fallar la prueba del CLI, que corre el script como proceso real contra una URL `…/stockpilot` y espera código 1 sin conectarse a nada (mismo patrón que `guardia_semilla.test.js:51`).
- *Recorrido manual* (navegador integrado). El backend **no sirve el frontend** fuera de producción (`app.js:207-217` [V]): levantar el backend con `.env.demo` (puerto 3000) y el frontend con `cd frontend && npm run dev` (Vite reenvía a `localhost:3000`). Iniciar sesión como Administrador, abrir caja, ver el Monitor de alertas, `/pedir`, aprobar un pedido, abrir `/proveedores` y enviar al buzón de Luis, recibir la orden, vender, fiar y abonar, registrar un egreso y ver el arqueo previo. **No cubre** el recorrido en un celular ni otros navegadores.
**Criterio de salida.** `npm run demo:sembrar`, con `.env.demo` apuntando a una base local `stockpilot_demo` ya creada, termina sin error y se niega (código 1) con cualquier otra base; las pruebas nuevas pasan y fallan al aplicar cada mutación; `npm test` y `npm run test:integration` en verde; el recorrido manual de la sección 2 (filas 1 a 7) funciona.

### Fase 2: reinicio y guion de la visita (depende de la fase 1; D3 y D4 ya decididas)
**Objetivo.** Poder dejar la demostración como nueva antes de cada visita y tener un guion.
**Hecho clave.** Las fechas del escenario son relativas a «hoy»: **hay que volver a sembrar el mismo día de la visita**, o los vencimientos ya habrán cambiado de categoría.
**Archivos.** Crear `docs/guion_demo_tienda.md` (recorrido de la sección 2 con tiempos, qué clic muestra qué, qué decir de privacidad; plan B sin red / sin correo / sin Render; checklist del día: crear la base una sola vez (`psql -U postgres -c "CREATE DATABASE stockpilot_demo;"` y `psql -U postgres -d stockpilot_demo -f database/init_pg.sql`, según `docs/guia_entorno_app.md:31-35`), sembrar con `npm run demo:sembrar`, levantar el backend con `.env.demo` y el frontend con Vite, probar el correo al buzón de Luis, abrir la caja antes de vender, cerrar sesión). Ajustar `docs/guia_entorno_app.md` solo con un enlace al guion. No tocar código.
**Verificación.** Ensayo completo cronometrado por una persona que no escribió el guion; anotar fallos en el propio documento. No cubre la reacción de un tendero real (eso es la fase 4 del documento de intervención).
**Criterio de salida.** El guion existe, se ensayó una vez de punta a punta y el reinicio dejó la base equivalente: mismos conteos de alertas por tipo y producto, y mismas órdenes por estado y proveedor (los ids tampoco cambian, porque el reinicio usa `RESTART IDENTITY`).

### Fase 3 (solo si D1 = B o C): reinicio por tienda
**No ejecutar sin una nueva decisión de Luis.** Escribir en producción, **alto riesgo** (borrado de datos). Requisitos mínimos si llegara a hacerse: script con `id_tienda` explícito y verificación de `es_prueba = TRUE` antes de borrar; transacción; copia de seguridad previa (`docs/restaurar_respaldo.md`); registro en la bitácora interna; prueba de integración que compruebe que **otra tienda no pierde ni una fila**; la guardia de la semilla no se relaja. Se detalla en una actualización de este plan si se elige.

---

## 5. Despliegue y reversión
- Con D1 = A **no hay despliegue**: son scripts locales, pruebas y documentación. Nada cambia en producción ni en Render.
- Reversión: borrar la base local de demostración; revertir el commit de la rama.
- Variables de entorno: `.env.demo` local (no se versiona) con la `DATABASE_URL` de `stockpilot_demo`; las credenciales de correo van solo ahí. El `.env` general no se edita.
- Cuidado: `config/database.js` migra la base de su `DATABASE_URL` al cargarse; no importarlo desde un script con `node -e` ni con el `.env` de producción.

## 6. Filas del seguimiento (`docs/seguimiento_planes.xlsx`)
| ID | Pendiente | Tipo | Prioridad | Responsable |
|---|---|---|---|---|
| P25-01 | D1: dónde vive la tienda de demostración. **Decidido 9-oct: A (local)** | Decisión pendiente | Alta | Luis |
| P25-02 | D2: alcance del escenario. **Decidido 9-oct: B (con cartera y caja), solo cuenta de Administrador** | Decisión pendiente | Alta | Luis |
| P25-03 | D3 y D4. **Decidido 9-oct: correo al buzón de Luis (PDF como plan B); sin Consejero IA** | Decisión pendiente | Media | Luis |
| P25-04 | Fase 1: escenario reproducible, semilla de demostración y pruebas | Pendiente del plan | Alta | Agente |
| P25-05 | Fase 2: reinicio, guion de la visita y ensayo | Pendiente del plan | Alta | Equipo |
| P25-06 | C8: `POST /api/ordenes/:id/enviar-proveedor` sin filtro de tienda (`suppliersController.js:471` y `:539`) y sin pruebas. Prioridad Alta (D6, decidido 9-oct) | Observación / defecto | Alta | Agente |
| P25-07 | Fase 3: reinicio por tienda en producción (solo si D1 cambia a B o C) | Trabajo futuro | Baja | Luis |
| P25-08 | D5 y D7. **Decidido 9-oct: conservar `database/seed_test_data.js`; un commit solo de docs en la rama actual** | Decisión pendiente | Alta | Luis |

Dependencias: P25-04 y P25-05 ya no esperan decisiones (P25-01 a P25-03 y P25-08 están cerradas); P25-04 empieza tras el commit de docs. P25-06 es independiente y conviene antes del arranque del piloto (con tiendas reales ya hay otros dueños). P19-11 (menú básico y Cartera) afecta a P25-02 (D2 = B): la demostración pasa al menú completo para cartera.

---

## Entrega al ejecutor

- **Fase a hacer ahora:** la fase 1, cuando Luis lo pida (D1 a D7 ya decididas).
- **Rama:** `feat/tienda-demo`. Antes, `git status`: el commit de docs de D7 ya debe estar hecho; si aún hay cambios sin commitear en `docs/`, detenerse y preguntar. Después, `git switch main && git pull && git switch -c feat/tienda-demo`.
- **Primer comando:** después de crear la rama, escribir `tests/business_logic/demo_escenario.test.js` y correr `npx vitest run tests/business_logic/demo_escenario.test.js` para verlo fallar.
- **Pruebas que deben pasar al final:** las dos nuevas (más la del CLI), `npm test` y `npm run test:integration` (contra `stockpilot_test`).
- **Parar y preguntar:** si D1 resulta B o C; si hace falta cambiar `guardiaSemilla.js` o relajar el sufijo `_demo`; si hay que tocar `seed_test_data.js` (D5: se conserva intacto); si hay que sembrar un host no local; si el esquema real no permite insertar lo que el escenario necesita; antes de cualquier comando que escriba en una base que no sea local; ante cualquier archivo sin commitear que se vaya a sobrescribir. No tocar `docs/planes/reglas_proyecto.md`.
- **No hacer** commit sin que se pida, ni push sin aprobación aparte.
