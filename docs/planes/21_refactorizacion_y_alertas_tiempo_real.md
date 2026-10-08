# Plan 21: Refactorización por capas y alertas en tiempo real

**Estado (8-oct-2026):** R0 terminada y mezclada en `main` el 28-sep (ver resultados en la sección R0). **R1 hecha, verificada, aprobada por Luis y subida a `main` el 8-oct (la rama `refactor/R1-servicios-ia` también está en `origin`)** (ver «R1 — Resultados»). R2-R4 siguen en propuesta: nada implementado. Cada fase se aprueba por separado antes de tocar código.
**Orden de ejecución:** este plan dice *qué* se hace en cada fase y *por qué*. *Cuándo* se hace cada una está en el **plan 22, sección 5**, que es el único orden vigente para los planes 19, 21 y 22. La sección 6 de este plan solo recoge las dependencias entre fases. No todo el plan se hace antes del piloto: lo que queda para después está programado, no descartado.
**Fecha:** 2026-09-27
**Origen:**
- `analisis_mantenibilidad_stockpilot.md`, un análisis externo del 27-sep que Luis compartió. Este plan lo contrasta punto por punto contra el código de `main` del 27-sep, después de cerrar el plan 20.
- La propuesta de Luis de que el motor de alertas pase a funcionar en tiempo real.

**Regla general:** refactorizar significa mover código sin cambiar el comportamiento. Toda fase debe terminar con todas las pruebas unitarias y de integración en verde (al 28-sep: 196 unitarias y 97 de integración en la rama de R0), y sin bajar los `thresholds` de cobertura de `vitest.config.js`.

---

## 0. Resumen

1. **El diagnóstico del análisis es correcto en lo principal.** La lógica de negocio vive dentro de controladores grandes, no hay capa de servicios y hay páginas del frontend monolíticas. Este plan lo adopta, con cuatro correcciones:
   - Algunas cifras cambiaron.
   - La caché de IA no es una fuga de memoria; su problema real es otro (sección 1).
   - La refactorización de `aiController.js` debe coordinarse con la extracción del `ia-service` del Sprint 6 de Bases de Datos Avanzadas, para no hacer el trabajo dos veces.
   - Hay seis problemas que el análisis no menciona (sección 2).
2. **La red de seguridad ya existe.** Las 47 pruebas de integración del plan 20 ejecutan la aplicación completa por HTTP contra `stockpilot_test`. Eso permite mover código de los controladores a servicios y comprobar que nada cambió. Donde no hay pruebas, primero se escriben pruebas de caracterización (fase R0).
3. **Alertas en tiempo real: sí, pero con Server-Sent Events (SSE) y no con Socket.io, al menos en la primera etapa.** El flujo es de una sola vía (servidor → navegador). SSE reutiliza la sesión y el middleware `requireLogin` sin cambios, no necesita dependencias nuevas y reconecta solo. El diseño deja una interfaz propia (`canalTiempoReal`) para cambiar a Socket.io si aparece una necesidad bidireccional. La justificación completa está en la sección 5.

---

## 1. Contraste con el análisis

Verificado contra el código de `main` del 27-sep-2026.

| # | Hallazgo del análisis | Lo que dice el análisis | Verificado hoy | Postura |
|---|---|---|---|---|
| 1 | Controladores "God Object" | aiController 867 líneas; suppliers 565; auth 576; product 476 | aiController **898** (creció con las correcciones de degradación de IA del plan 20, sección 8.13); suppliers 574; auth 575; product 475 | **De acuerdo.** Es el problema principal. El plan 20 ya extrajo 7 funciones puras a `utils/`, pero los controladores siguen mezclando SQL, llamadas a OpenAI, auditoría y armado de respuestas. **8-oct: con R1 `aiController.js` bajó a 152 líneas; siguen pendientes de R2 `suppliersController` (632), `authController` (615), `saleController` (502) y `productController` (460).** |
| 2 | Capa `services/` con un solo archivo | Solo `schedulerService.js` | Confirmado | **De acuerdo.** |
| 3 | Dos instancias de OpenAI | aiController:24 y suppliersController:11 | Confirmado, idénticas | **De acuerdo.** Además es la costura natural para el `ia-service` (sección 4, R1). **Resuelto en R1 (8-oct): una sola instancia en `services/ia/openaiClient.js`.** |
| 4 | Caché de IA en memoria "sin TTL, fuga de memoria" | `let aiCache_v3 = {}` crece sin límite | La clave es `tiendaId` y cada escritura **sobrescribe** la anterior, así que crece con el número de tiendas, no con las peticiones. Además tiene respaldo en BD (`Cache_IA`) y solo se usa si el hash de los datos coincide. | **En desacuerdo con el diagnóstico, de acuerdo con cambiarla.** El problema real es que es **estado por proceso**: con 2 réplicas del API (Sprint 6.5, Kubernetes) cada réplica tendría su propia copia y podría llamar a OpenAI por separado. La solución es dejar solo la caché compartida (`Cache_IA`, o Redis cuando exista), no agregarle TTL a la variable. Severidad: media, no alta. **Resuelto en R1 (8-oct): `aiCache_v3` eliminada; queda solo `Cache_IA`.** |
| 5 | Páginas monolíticas | Dashboard 741 líneas y 17 `useState`; ProductFormModal ~900+ | Dashboard **740 líneas y 20 `useState`**; Tiendas 681; ProductFormModal **729**; Reportes 582; Analytics 525; Aprendizaje 464 | **De acuerdo.** `DashboardPage` va primero: además es donde aterrizan las alertas en tiempo real. |
| 6 | Solo 3 hooks | useBarcodeScanner, useProductosPage, useProveedoresPage | Confirmado. `ProductosPage` (12,9 KB) y `ProveedoresPage` (6,4 KB) ya se adelgazaron con ese patrón. | **De acuerdo.** El patrón está probado y falta extenderlo. |
| 7 | Estilos de controlador mezclados | Clases y objetos literales | 11 controladores con clases y 7 con objetos literales | **De acuerdo, pero con prioridad baja.** Se unifica solo al tocar cada archivo por otra razón. Un cambio masivo solo para esto no se justifica. |
| 8 | `translateSQL()` de `?` a `$N`; sugiere un ORM | Deuda heredada | Confirmado | **De acuerdo en que es deuda. En desacuerdo con introducir un ORM ahora:** sería reescribir todas las consultas, con riesgo alto. Para Bases de Datos Avanzadas, el SQL explícito es incluso una ventaja. Se mantiene. |
| 9 | HTML de correos dentro de `schedulerService.js` | ~100 líneas | Confirmado | **De acuerdo**, prioridad baja. |
| 10 | `console.log` en authController | Líneas 14, 24, 35 y 98 | El problema es mucho más amplio: **156** `console.*` en el backend (auth 23, product 14, sale 12, ai 12…). Solo `clienteController.js` usa el `logger` (Pino). | **De acuerdo, y el alcance es mayor.** Se hace archivo por archivo, junto con cada refactor. **8-oct: quedan 164 `console.*` en el backend (la cifra creció con las funciones nuevas). R1 dejó en 0 los de `aiController.js`, `services/ia/`, `services/inventory/` y `suppliersController.js`; siguen `authController` (24), `schedulerService` (15), `saleController` (12), `productController` (12) y `app.js` (12), entre otros.** |
| 11 | Lazy loading | 2 de 23 páginas | Confirmado: 21 importaciones estáticas y 2 con `lazy()` | **De acuerdo.** Es barato y de riesgo bajo. |
| 12 | Pruebas | 12 archivos unitarios + 5 E2E | **13 unitarios (196 pruebas) + 7 de integración (47) + 5 E2E**; cobertura del backend 35,0 % con ambas suites | Dato desactualizado. Cambia la conclusión: ya hay con qué comprobar que la refactorización no rompe nada. |
| 13 | Estimaciones de 5 a 7 días | Fase 1 de 2 a 3 días | — | **Optimistas.** Los controladores tienen 25,6 % de cobertura; antes de moverlos hay que caracterizarlos (fase R0). Mejor planear por módulo que por días. |

---

## 2. Problemas que el análisis no incluye

1. **Diez llamadas "dispara y olvida" a `Alert.generate`.** Están después de escrituras en ventas (2), inventario (3), productos (3), recepción de órdenes (1) y el endpoint manual. Cada una es `Alert.generate(tiendaId).catch(e => console.error(...))`: sin `await`, con el error solo en consola y con la misma línea copiada diez veces. Esto debe centralizarse en un solo punto ("el inventario de la tienda X cambió"). **Es exactamente el gancho que necesitan las alertas en tiempo real** (sección 5).
2. **La auto-migración de `config/database.js` corre en cada `require`**, contra cualquier `DATABASE_URL` y sin protección. Está documentado en el plan 20, sección 8.3, y no se ha corregido. Debe pasar a un comando explícito (`npm run migrate`).
3. **El scheduler se duplicaría con varias réplicas.** `app.js` lo arranca en cada proceso. Ya está planeado resolverlo con el worker del Sprint 6.2; hay que hacerlo antes de escalar o de activar el tiempo real con varias réplicas.
4. **Carrera posible al abrir caja.** `openSession` hace `SELECT` y luego `INSERT` sin transacción. En 10 corridas no se reprodujo, pero nada lo garantiza (plan 20, sección 8.8). Al mover caja a un servicio, conviene envolverlo en una transacción con bloqueo, con el mismo patrón que la venta.
5. **Consultas repetidas en el frontend.** Cada navegador consulta el servidor por su cuenta, en tres lugares distintos:
   - `Sidebar` pide las alertas cada 60 segundos.
   - `NotificationCenter` pide las notificaciones cada 120 segundos.
   - `AlertasPage` recarga cada 5 minutos.

   Una alerta nueva tarda hasta un minuto en verse en el menú y hasta cinco en la página de alertas. `stockSync.js` usa `BroadcastChannel`, que **solo sincroniza pestañas del mismo navegador**: el celular del vendedor y el computador del administrador no se enteran de los cambios del otro.
6. **Los controladores no se pueden probar sin HTTP.** El análisis lo menciona de pasada, pero es la razón de fondo para crear servicios: un servicio recibe datos y devuelve datos, así que se prueba con pruebas unitarias baratas en vez de solo con integración.

---

## 3. Principios

- **Sin cambios de comportamiento dentro de un refactor.** Si al mover código aparece un bug, como pasó con el redondeo en el plan 20, se corrige en un commit aparte, con su prueba.
- **Primero la prueba, luego el movimiento.** Ningún endpoint se refactoriza si no hay una prueba de integración que fije su respuesta actual.
- **Un módulo por rama y por PR.** Nada de refactorizaciones masivas.
- **Coordinación con Bases de Datos Avanzadas.** La refactorización de IA (R1) es el paso previo a la extracción del `ia-service` (Sprint 6.3), no un trabajo aparte. El objetivo es que el `ia-service` se forme moviendo una carpeta de servicios que ya existe.
- **La cobertura no puede bajar.** Al mover lógica a `services/`, las pruebas unitarias nuevas deben subir el `threshold`, nunca bajarlo.

---

## 4. Fases de la refactorización

### R0. Pruebas de caracterización (antes de mover nada)

Pruebas de integración con `supertest` contra `stockpilot_test`, siguiendo el patrón de `tests/integration/`, que fijan la respuesta actual de los endpoints que se van a mover y hoy no tienen prueba:

| Módulo | Endpoints a caracterizar | Nota |
|---|---|---|
| IA | recomendaciones del dashboard (con y sin caché), promociones, riesgo de cliente | `ia_caida.test.js` ya cubre el camino de falla. Falta el camino feliz con OpenAI simulado; para esto se permite simular el cliente de OpenAI, porque no se quiere depender de la red. |
| Proveedores | generar borrador de orden, aprobar, recibir (recepción → stock → alertas) | La recepción es la operación con más efectos laterales. |
| Autenticación | 2FA, restablecer y cambiar contraseña | Login y sesión ya están cubiertos (10 pruebas). |
| Productos | carga masiva e importación desde Excel | |

**Criterio de salida:** los endpoints de la tabla quedan con prueba y la suite de integración sigue en verde.

#### R0 — Resultados (rama `test/plan21-r0-caracterizacion`, mezclada en `main` el 28-sep)

**Pruebas nuevas:** 50 en 6 archivos de `tests/integration/` (48 de caracterización + 2 de guardia),
sin tocar código de producción. Toda esta fase es **P21-01**.

| Módulo | Archivo | Pruebas |
|---|---|---|
| IA (con OpenAI simulado) | `ia_recomendaciones.test.js` | 4 |
| Proveedores (orden IA, aprobar, recibir, borrador consejero) | `proveedores_flujo.test.js` | 12 |
| Autenticación (2FA, restablecer, cambiar contraseña) | `autenticacion_flujos.test.js` | 15 |
| Productos (carga masiva .xlsx real y .csv) | `productos_carga_masiva.test.js` | 8 |
| Autorización por rol (Tendero sin `requireAdmin`; los 9 casos llevaban `// I0: invertir a 403 según la matriz de roles`; en I0 se reemplazaron por una tabla de 16 rutas, ver plan 22, 1.4) | `autorizacion_roles.test.js` | 9 |
| Guardia del reinicio de limitadores | `limitadores_reinicio.test.js` | 2 |

**Corridas:** suite de integración (13 archivos, 97 pruebas: 47 preexistentes + 50 nuevas) corrida
5 veces seguidas con los cambios finales: **97/97 en las cinco**, entre 64 y 86 s, cero fallas
intermitentes. Unitarias sin cambios: **196/196**.

**Cobertura combinada (unitarias + integración), sobre las 2.943 sentencias del `coverage.include` de `vitest.config.js`:**

| | Antes (`main`) | Después (R0) |
|---|---|---|
| Sentencias | **34,90–35,00 %** (1027–1030 / 2943) | **55,66–55,79 %** (1638–1642 / 2943) |
| Ramas | 34,98–35,04 % (546–547 / 1561) | 54,84–55,03 % (856–859 / 1561) |
| Funciones | 57,02 % (207 / 363) | 72,18 % (262 / 363) |
| Líneas | 35,42–35,53 % (973–976 / 2747) | 56,50–56,64 % (1552–1556 / 2747) |

Es un rango porque el provider v8 no da el mismo número en cada corrida (±4 sentencias entre
corridas del mismo código, por temporizadores y trabajo en segundo plano): `main` se midió 4 veces
(1027, 1028, 1028, 1030) y la rama 3 veces (1638, 1641, 1642). El «1030 / 35,0 %» de partida es una
de esas cuatro corridas de `main`; el «1028 → 1642» de una versión anterior eran los valores de una
sola corrida cada uno. Cifra a citar: **≈35 % → ≈56 %**.

**Comando exacto** (corre las dos suites con cobertura v8 y une los `coverage-final.json`; requiere
`stockpilot_test`, igual que `npm run test:integration`):

```bash
npm run test:coverage:combinada     # = node scripts/cobertura_combinada.mjs
```

Para medir el «antes», exportar `main` a una carpeta aparte (`git archive main | tar -x -C <dir>`),
copiar `.env.test`, enlazar `node_modules` y correr el mismo comando allí. El script vive en el repo
desde este commit; los números de «antes» se midieron con una versión equivalente (mismas dos
corridas de vitest, unión con `istanbul-lib-coverage`; el script nuevo reproduce exactamente sus
totales sobre los mismos reportes).

**Presupuesto de limitadores — corregido tras la revisión de Luis.** La primera versión de esta
sección decía que cada prueba usaba un usuario nuevo y por eso no compartían presupuesto en
`twoFactorLimiter`. Era incorrecto: la clave es `user_<id>` y `limpiarBaseDePruebas()` hace
`RESTART IDENTITY`, así que el primer usuario de cada prueba es siempre `id_usuario = 1` → **todas
las pruebas de la corrida comparten la clave `user_1`** (en `globalLimiter`, `aiLimiter` y
`twoFactorLimiter`), y las peticiones sin sesión comparten la de la IP. Sin Redis (`.env.test` no
lo define) los contadores viven en el `MemoryStore` del proceso y `isolate: false` lo comparte entre
los archivos: se acumulaban entre archivos (hallazgo **P21-11**, resuelto en esta rama).

Medición sin reinicios (corrida completa, 95 pruebas de entonces, 83 s; pico leído del `MemoryStore`):

| Limitador | Máximo | Consumo sin reinicio | Máximo por archivo (con reinicio) |
|---|---|---|---|
| `globalLimiter` | 600/15 min | **242/600** en `user_1` (`ip_127.0.0.1`: 123) | 48/600 (`proveedores_flujo`) |
| `aiLimiter` | 60/15 min | 11/60 | 5/60 |
| `authLimiter` | 10/15 min | **7/10** (`autenticacion` 5 + `autenticacion_flujos` 2; antes se decía 6/10) | 5/10 |
| `twoFactorLimiter` | 5/15 min | 1/5 | 1/5 |

Además, el `globalLimiter` no tiene `skipSuccessfulRequests` (solo lo tienen `authLimiter` y
`twoFactorLimiter`): cuenta todas las peticiones.

**Solución, solo en pruebas:** `tests/integration/helpers/limitadores.js` registra cada `MemoryStore`
(envolviendo `MemoryStore.prototype.init`, importado desde `setupTestDb.js` antes de cargar
`middleware/rateLimiter.js`) y expone `reiniciarLimitadores()`; `setupTestDb.js` la llama en un
`beforeAll`, o sea, **un reinicio al comienzo de cada archivo**. Dentro de un archivo el consumo
sigue acumulándose sobre `user_1`, así que la cifra a vigilar al agregar pruebas es el pico por
archivo. `limitadores_reinicio.test.js` falla si una actualización de express-rate-limit cambia
esos internos.

**Comportamientos raros encontrados** (caracterizados, NO corregidos):

- **P21-09** `/api/verify-reset-code` no tiene limitador propio: se pueden probar códigos de 6 dígitos sin límite.
- **P21-10** `suppliersController.completarRecepcion` no valida `cantidad_recibida` contra lo pedido (pedir 5, recibir 500 se acepta). **Resuelto el 4-oct-2026** en la rama `feat/recepcion-con-confirmacion`: `cantidad_recibida` es el total acumulado de la línea (reenviar el mismo total no vuelve a sumar stock); más de lo pedido → 409 `RECEPCION_EXCEDE_PEDIDO` y solo se registra con `confirmar_exceso` y un motivo (queda en el Kardex); menos → la orden queda «Parcial» y se puede seguir recibiendo; `cerrar_con_faltante` la cierra como «Completada» dando el resto por perdido. Pruebas: `recepcion_mercancia.test.js`.
- **P21-11** Contadores de los limitadores compartidos entre pruebas — **resuelto** en esta rama (ver arriba).
- **P21-12** `bulkUpload`: el `if (!req.file)` es código muerto, `validateFileType` ya responde 400 antes.
- **P21-13** El `skip` de `globalLimiter` es inerte: está montado en `/api/` y Express entrega `req.path` sin ese prefijo (`/login`, no `/api/login`), así que `/login`, `/registro` y `/2fa/verify` sí gastan el presupuesto global. Comprobado: un `POST /api/login` y un `POST /api/2fa/verify` suman 1 golpe cada uno en el contador global.
- **P22-09** `CashRegister.approveExpense`/`rejectExpense` no filtran por `id_tienda`: un usuario de cualquier tienda puede aprobar o rechazar el egreso de otra conociendo el `id_egreso`.
- **P22-10** Ningún endpoint de la lista (PUT/DELETE producto, promociones, `ia/apply-strategy`, alertas generate/resolve, inventario/ajuste, reportes, exportar) exige `requireAdmin`: responden 200 a un Tendero. Es el insumo de la matriz de roles de I0.

### R1. Servicios de IA y cliente único de OpenAI (preparación del `ia-service`)

```
services/
  ia/
    openaiClient.js       ← instancia única (elimina la duplicación de aiController y suppliersController)
    recomendaciones.js    ← entradas del motor + hash + caché + llamada + guardrails + auditoría
    promociones.js        ← candidatos + llamada + fallback determinista (utils/promociones.js)
    riesgoCliente.js
    cacheIA.js            ← solo Cache_IA (o Redis si hay REDIS_URL); elimina la variable aiCache_v3
```

- `aiController.js` queda como capa delgada: valida la sesión, lee los parámetros, llama al servicio y responde.
- Las funciones de `services/ia/` reciben `tiendaId` y datos, **nunca `req`/`res`**. Así se pueden probar con pruebas unitarias y moverlas al `ia-service` sin cambios.
- `console.*` se reemplaza por `logger` en los archivos tocados.

**Relación con el Sprint 6.3:** el contrato OpenAPI del `ia-service` se escribe a partir de las firmas de `services/ia/`. Si R1 se hace antes, la extracción del microservicio es casi solo mover la carpeta y cambiar la llamada local por una llamada HTTP.

#### R1 — Resultados (rama `refactor/R1-servicios-ia`, 8-oct-2026, sin mezclar a `main`)

**Estado:** hecha, verificada y aprobada por Luis (8-oct). Se mezcló a `main` con un merge sin avance rápido (`--no-ff`, `f93958e`), que conserva los hitos, y se subió `main` a `origin` con los 17 commits que `main` local tenía por delante (incluido el 2FA en operaciones CRUD, `ec4d48c`, que Luis había dejado sin subir). Luis autorizó subir a producción el 8-oct porque la visita a las tiendas aún no ocurre; el congelamiento del piloto (sección 6) rige desde su arranque.

| Commit | Qué hace |
|---|---|
| `9ac27a4` | 15 pruebas de caracterización de los 3 endpoints analíticos de `/api/ia` que no tenían ninguna (snapshot, tendencia de precios, umbrales sugeridos), **antes** de moverlos |
| `72b35c8` | `entradasMotor`, `guardrailsIA`, `reposicion` y `sugerenciasStock` pasan de `utils/` a `services/inventory/` (solo rutas) |
| `f01bbd0` | `services/ia/`, `services/errores.js`, 4 servicios de análisis en `services/inventory/`, `aiController` delgado y cliente único de OpenAI |
| `9306750` | 68 pruebas unitarias de la lógica pura |
| `458118e` | 9 pruebas de integración de los errores y bordes de `/api/ia` que nada cubría |
| `b899d45` | Arreglo de `generar_reporte.js` (hallazgo P21-17) |

**Estructura final.** La propuesta tenía 5 archivos en `services/ia/`; quedaron 14, porque cada uno hace una sola cosa y lo puro (que se prueba sin base de datos) está separado de lo que lee la base. La regla es que ningún archivo vuelva a crecer hasta ser un «God Object».

```
services/
  errores.js                  ← IANoConfiguradaError, RecursoNoEncontradoError (se distinguen con instanceof)
  ia/
    openaiClient.js           ← ÚNICA instancia de OpenAI, modelo, asegurarApiKey() y pedirJSON()
    prompts.js                ← los textos del modelo (puro)
    recomendaciones.js        ← Consejero: orquesta entradas → caché → OpenAI → guardrails → auditoría
    contextoRecomendaciones.js← cruce con el motor y guardrails (puro)
    promociones.js            ← orquesta candidatos → caché → OpenAI → composición → auditoría
    candidatosPromocion.js    ← a quién se promociona (puro, reloj inyectado)
    composicionPromociones.js ← lista final con respaldo determinista (puro)
    datosPromociones.js       ← lecturas de BD de este flujo
    estrategiaPromocion.js    ← aplica el precio en una transacción
    riesgoCliente.js          ← riesgo crediticio; historialCredito.js arma el historial sin datos personales (puro)
    cacheIA.js                ← solo Cache_IA; hashIA.js: hash y claves (puro); auditoriaIA.js: bitácora en archivo
  inventory/
    (los 4 motores movidos) + analisisInventario.js (puro) + snapshotAnalitico.js + tendenciaPrecios.js + umbralesProducto.js
```

**Criterio de salida (verificado):**

| Criterio | Antes | Ahora |
|---|---|---|
| Líneas de `aiController.js` | 901 | **152** |
| `new OpenAI(...)` en el backend | 2 | **1** (`openaiClient.js`) |
| `aiCache_v3` (caché en memoria del proceso) | sí | **no** |
| `req`/`res`/`session` en `services/ia/` y `services/inventory/` | — | **0** |
| `console.*` en `aiController` y `suppliersController` | 16 (12 + 4) | **0** (usan el logger de pino) |
| Pruebas unitarias | 297 | **365** |
| Pruebas de integración | 407 | **431** (44 archivos) |

**Sin cambio de comportamiento, comprobado.** 500 sin clave de OpenAI, 404 de producto o cliente inexistente, campo `cached`, ruta de `ai_audit.log` y hash de la caché de promociones son iguales a `main`. Los 6 textos de los prompts son idénticos byte a byte (verificado con un script contra `HEAD`). Lo que sí cambió, a propósito y pedido por este plan: ya no hay caché en memoria, así que cada petición consulta `Cache_IA` (una consulta por llamada), y `cached:true` se conserva.

**Lo que no se movió (queda para R2 y R4):**
- `suppliersController.generateSmartOrder`: ya usa el cliente único, pero su prompt y su lógica siguen en el controlador (632 líneas, el más grande). R2 lo lleva a `services/proveedores.js`.
- `ordenBorradorController` (escribe en `Auditoria_IA`).
- Los `console.*` de `productController` (12), `ordenBorradorController` (5) y `Alert.js` (1), que en R1 solo cambiaron de ruta de importación. `ai_audit.log` se sigue escribiendo en la raíz del repo (se conservó), mientras el resto de los logs va a `logs/`.

**Lección del proceso (hallazgo, no se repite).** El primer intento de R1, sin commitear, cambió el comportamiento sin que nada lo advirtiera: 500 → 200 sin clave de OpenAI, `cached` siempre en `false`, 404 → 500 en `apply-strategy`, el prompt de promociones abreviado y un `require` del logger roto que dejaba la IA en «mantenimiento» para siempre. Lo detectaron 6 pruebas de R0. El análisis de cobertura posterior mostró además que **varios de esos comportamientos no tenían ninguna prueba** (404 de `apply-strategy`, 404 y 500-sin-clave de `assess-risk`, y «sin candidatos» de promociones). Ahora la tienen (`ia_errores_http.test.js`, 9 pruebas, incluido el camino feliz de `apply-strategy`, que cambia precios). Regla para R2 y R3: **antes de mover un endpoint, caracterizar también sus ramas de error**, no solo su camino feliz.

**Verificación (8-oct):**
- Mutaciones: 11 arreglos rotos a propósito (6 unitarios y 5 de integración); cada uno hizo fallar al menos una prueba.
- Lint (ESLint ad hoc, el método del plan 10): 0 hallazgos en los archivos tocados.
- `npm run test:evidence`: 365 unitarias + 431 de integración = **796**, todas en verde; reporte regenerado.
- Cobertura combinada (`npm run test:coverage:combinada`), sobre las 3.464 sentencias del `coverage.include` (la base de código creció desde R0, que midió 2.943, así que las cifras no son directamente comparables):

| | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| Unitarias | 18,33 % | 25,45 % | 35,07 % | 17,10 % |
| Integración | 69,35 % | 66,13 % | 79,57 % | 71,04 % |
| **Combinada** | **73,50 %** | **74,29 %** | **84,97 %** | **74,35 %** |

  Los 24 archivos de `services/` que toca R1 están entre 67 % y 100 % (medido antes de agregar `ia_errores_http.test.js`, que sube algo más los servicios de promociones y riesgo); `aiController.js` estaba en 70 % y lo que le faltaba eran ramas de error, que esa prueba cubre en parte.
- **No se hizo:** arrancar la aplicación real con `node app.js` (levanta el planificador de correos con la configuración del `.env`); la app se ejercitó completa vía HTTP con las pruebas de integración.

**Hallazgos nuevos de esta fase** (también en `docs/seguimiento_planes.xlsx`):
- **P21-17** `generar_reporte.js` escribía en `Documentacion/` (carpeta que el commit `a665b8c` eliminó) y `npm run test:evidence` terminaba en verde sin generar el reporte. **Corregido** en `b899d45` (ruta y código de salida).
- **P21-18** El `CLAUDE.md` del repo todavía cita `Documentacion/Reporte_Pruebas_StockPilot.md`; hoy es `docs/Reporte_Pruebas_StockPilot.md`. **Corregido el 8-oct** (aprobado por Luis): ahora cita `docs/Reporte_Pruebas_StockPilot.md`.
- **P21-19** `coverage.include` usa `utils/**/*.js`, que también atrapa 4 archivos de `frontend/src/utils/` (`arqueo`, `menu`, `pedir`, `security2FA`; 126 sentencias, 100 % cubiertas): suman cerca de un punto a la cobertura del backend.
- **P21-20** Los umbrales de cobertura unitaria (10/15/19/9) quedaron muy por debajo de lo medido (18,3/25,5/35,1/17,1). La sección 3 de este plan pide subirlos, nunca bajarlos. **Hecho el 8-oct (aprobado por Luis): ahora son 17/23/32/15**, un poco por debajo de lo medido en la última corrida (18,3/25,3/34,4/17,0). Se comprobó que el control falla (código de salida 1) cuando no se cumple.
- **P21-21** Zonas con poca cobertura combinada: `tenderoController` 6 %, `dashboardController` 10 %, `auditController` 11 %, `schedulerService` 12 % (los correos), `storeController` 30 % y `reportController` 40 %. Son las candidatas a caracterizar antes de R2 y R3.
- **P21-22** Las corridas de integración muestran `MaxListenersExceededWarning` (11 listeners en un `Server`, probablemente de `supertest` con `isolate:false`). Es inofensivo, pero ya aparecía antes del cierre de R1; no se verificó si es anterior a R1.
- **Ratificado, P21-15:** cargar cualquier módulo que importe `config/database.js` ejecuta la auto-migración contra el `DATABASE_URL` del `.env` (en esta sesión ocurrió por accidente al comprobar un `require`; apuntaba a la base local). Refuerza hacerla un comando explícito.

### R2. Eventos de inventario y servicios de dominio

```
services/
  eventosInventario.js    ← un solo punto: inventarioCambio(tiendaId, motivo)
  alertas.js              ← regenera alertas (Alert.generate) y publica el evento de tiempo real
  proveedores.js          ← órdenes, recepción, correo al proveedor
  auth.js                 ← 2FA, restablecer y cambiar contraseña
  productos.js            ← carga masiva e importación
  caja.js                 ← apertura con transacción y bloqueo (corrige el punto 2.4)
```

- Las diez llamadas a `Alert.generate(...).catch(console.error)` se reemplazan por `eventosInventario.inventarioCambio(tiendaId, 'venta' | 'entrada' | …)`. Por dentro, ese evento regenera las alertas y avisa al canal de tiempo real. El comportamiento es el mismo (la regeneración sigue fuera de la transacción de la venta), pero queda un solo lugar que manejar, registrar y probar.
- Los correos del scheduler pasan a plantillas en `services/correo/plantillas/`.

### R3. Frontend: hooks y descomposición

1. **`useDashboardPage.js`** con los 20 estados de `DashboardPage`. Luego se descompone en `components/dashboard/`: tarjetas de indicadores, panel del Consejero IA, panel de promociones y aviso de bienvenida. Va primero porque es la página más grande y la que va a consumir los eventos en tiempo real.
2. **`useTiendasPage`, `useReportesPage`, `useAprendizajePage`, `useSimuladorPage`** con el mismo patrón de `useProductosPage`.
3. **`ProductFormModal.jsx`** (729 líneas): se separan las secciones del formulario (datos básicos, precios, vencimiento, escáner) y la validación va a un hook.
4. **Lazy loading de todas las rutas** que no son de entrada (todas menos Landing, Login y Dashboard). Se mide el tamaño del bundle inicial antes y después con `vite build`.

**Nota:** el plan de modo básico (plan 19, sección 3.4) toca el `Sidebar` y la navegación. Si se aprueba, conviene hacerlo **después** de R3.1, para no pelear con el mismo archivo.

### R4. Limpieza

- Sacar la auto-migración de `config/database.js` y dejarla en un comando explícito, con la misma protección de `setupTestDb.js` para las bases que no son de producción.
- Unificar el estilo de controladores al tocar cada uno. Se propone el objeto literal, porque los controladores delgados ya no necesitan métodos estáticos.
- Revisar que no queden `console.*` en controladores y servicios.

---

## 5. Alertas en tiempo real

### 5.1 Cómo funciona hoy

- Las alertas se recalculan del lado del servidor justo después de cada escritura que cambia el inventario (sección 2.1). Hasta ahí el sistema ya reacciona en el momento.
- **El problema está en la entrega.** El navegador solo se entera cuando pregunta:
  - `Sidebar` pregunta cada 60 segundos.
  - `NotificationCenter` cada 120 segundos.
  - `AlertasPage` cada 5 minutos.
- Otro dispositivo de la misma tienda no se entera de nada hasta su siguiente consulta.

**Objetivo:** que una alerta nueva o resuelta, o una notificación nueva (descuadre de caja, solicitud del tendero), aparezca en todos los dispositivos conectados de esa tienda en menos de 2 segundos, sin recargar, y que se eliminen las tres consultas periódicas.

### 5.2 ¿Socket.io o Server-Sent Events?

| Criterio | Server-Sent Events (`EventSource`) | Socket.io (WebSocket) |
|---|---|---|
| Dirección que se necesita | Servidor → navegador. **Es lo que hace falta:** las acciones del usuario siguen yendo por la API REST, con su CSRF. | Bidireccional. La vía navegador → servidor no se usaría. |
| Autenticación | Es un `GET` normal: la cookie de sesión viaja sola y `requireLogin` funciona **sin cambios**. | Hay que compartir la sesión con `io.engine.use(sessionMiddleware)` y extraer el middleware de sesión de `app.js`. Además la sesión no se recarga sola durante la conexión (hay que usar `reload()`/`save()`). |
| Dependencias | Ninguna: `EventSource` es nativo del navegador y en Express es una respuesta con `text/event-stream`. | `socket.io` en el servidor y `socket.io-client` en el frontend. |
| Reconexión | Automática. `Last-Event-ID` permite reanudar. | Automática, con búfer. |
| Varias réplicas (Sprint 6.5, 2 réplicas en Kubernetes) | Necesita un canal entre procesos (Redis pub/sub). No necesita sesiones pegajosas. | Necesita un adaptador (`@socket.io/redis-adapter`) y además **sesiones pegajosas en Nginx**, salvo que se desactive el respaldo por long-polling y se use solo WebSocket. |
| Nginx (API Gateway) | `proxy_buffering off` y un `proxy_read_timeout` largo para esa ruta. | Encabezados `Upgrade`/`Connection` y, si hay long-polling, `ip_hash` o afinidad. |
| Middleware actual | `compression()` está activo en `app.js` y **bufferiza** los eventos: hay que excluir esa ruta de la compresión o llamar `res.flush()`. | No le afecta. |
| Límite del navegador | Con HTTP/1.1 el navegador permite **6 conexiones por dominio** en total entre pestañas. Con HTTP/2 el límite es alto. Se mitiga con una sola conexión por navegador, repartida a las demás pestañas con el `BroadcastChannel` que ya existe en `stockSync.js`. | No tiene ese límite. |
| Render (producción) | Funciona como una respuesta HTTP larga. | WebSockets soportados. Las conexiones se cierran en cada despliegue (30 s de gracia); igual para SSE. |
| Cuándo gana | Notificaciones y alertas de una sola vía. | Colaboración en vivo: varios cajeros sobre el mismo carrito, chat con el proveedor, "quién está viendo esto", juegos. |

**Postura:** estoy de acuerdo con la necesidad y con que Socket.io funcionaría. No estoy de acuerdo con que sea la mejor opción **para este caso**. Hoy todos los eventos van en una sola dirección, y SSE los resuelve con menos piezas: sin librerías, sin tocar la sesión ni el CSRF y sin sesiones pegajosas. Lo que pide de más es poco: excluir la compresión en esa ruta y la configuración de Nginx.

**Condición para cambiar a Socket.io:** que aparezca un caso de uso que necesite enviar datos del navegador al servidor por el mismo canal y con baja latencia, por ejemplo varios cajeros editando el mismo carrito. Para que el cambio sea barato, el diseño de 5.3 esconde el transporte detrás de una interfaz propia.

### 5.3 Diseño por etapas

**T1. Bus interno y endpoint SSE (un solo proceso; así funciona hoy producción)**
- `services/tiempoReal/canal.js`: interfaz `publicar(tiendaId, evento)` / `suscribir(tiendaId, fn)`. La primera implementación usa `EventEmitter` en memoria.
- `GET /api/eventos` con `requireLogin`:
  - Responde `text/event-stream`.
  - Se suscribe **solo** al canal de `req.session.tiendaId`, con el mismo principio de aislamiento que verifica `aislamiento_multitienda.test.js`.
  - Envía un comentario cada 25 segundos para mantener viva la conexión.
  - Se desuscribe al cerrarse.
- Eventos con **datos mínimos**, sin información sensible:
  - `alertas.actualizadas` con `{ nuevas, resueltas, activas }`.
  - `notificacion.nueva` con `{ id, tipo }`.
  - `inventario.cambio` con `{ motivo }`.
- Cuando el navegador recibe un evento, **vuelve a pedir** los datos por la API REST, que ya valida permisos. Así el canal nunca se convierte en otra superficie de autorización.
- `services/alertas.js` (R2) publica después de `Alert.generate`, y `Notification.create` publica al crear. Para saber qué cambió hay que agregar a `Alert.generate` el retorno `{ nuevas, resueltas }`; hoy solo devuelve un conteo.
- Excluir `/api/eventos` de `compression()`.

**T2. Frontend**
- Hook `useEventosTiempoReal()` en el layout: abre **una** conexión `EventSource` por navegador y reparte los eventos a las demás pestañas con el `BroadcastChannel` de `stockSync.js`.
- `Sidebar`, `NotificationCenter`, `AlertasPage` y `DashboardPage` se suscriben al hook en lugar de consultar cada cierto tiempo.
- **Respaldo:** si la conexión cae, se hace una consulta al reconectar y queda una consulta de seguridad cada 5 minutos. Una desconexión nunca deja datos viejos en pantalla indefinidamente.

**T3. Varias réplicas y worker (con el Sprint 6)**
- Segunda implementación de `canal.js` con **Redis pub/sub** cuando exista `REDIS_URL`. Redis ya está en el `docker-compose` del Sprint 6.1 y la app ya lo soporta de forma opcional.
- Alternativa con la base de datos, interesante para Bases de Datos Avanzadas: un trigger `AFTER INSERT OR UPDATE` en `Alertas` con `pg_notify`, y un `LISTEN` en cada réplica.
  - **Limitación:** en Neon, `LISTEN/NOTIFY` **no funciona con la conexión agrupada (pooled)**; necesita la conexión directa. Si se elige esta opción, se documenta como variante para el entorno Docker, con la advertencia para producción.
- Nginx: `location /api/eventos { proxy_buffering off; proxy_read_timeout 1h; }`.

**T4. Pruebas y medición**
- Pruebas de integración:
  - Una sesión abre `/api/eventos` y otra de la **misma** tienda registra una venta que deja un producto crítico: el evento llega. Se mide la latencia, con meta de menos de 2 segundos.
  - Una sesión de **otra** tienda no recibe nada.
  - Sin sesión, la respuesta es 401.
- Carga: 50 conexiones abiertas con Autocannon o `k6` mientras se repite la prueba de carga de 12,9 peticiones por segundo, para comprobar que las conexiones abiertas no degradan la API.

### 5.4 Riesgos

| Riesgo | Mitigación |
|---|---|
| La compresión retiene los eventos y "no llega nada" | Excluir la ruta de `compression()` (T1) y una prueba de integración que lo detecte |
| Varias pestañas agotan las 6 conexiones de HTTP/1.1 | Una sola conexión por navegador, repartida con `BroadcastChannel` (T2) |
| Cada despliegue en Render corta las conexiones | Reconexión automática de `EventSource` y consulta de sincronización al reconectar |
| Un evento filtra datos de otra tienda | Canal por `tiendaId` de la sesión, eventos sin datos y prueba de aislamiento (T4) |
| Con varias réplicas un evento solo llega a los navegadores conectados a la réplica que lo generó | Redis pub/sub (T3) antes de activar la segunda réplica |

---

## 6. Dependencias entre fases y tramo de cada una

El orden de ejecución de todo el proyecto está en el **plan 22, sección 5**. Esta sección solo dice qué depende de qué dentro del plan 21 y en qué tramo cae cada fase respecto al piloto.

**Actualización del 8-oct-2026.** R1 está hecha, mezclada y subida a `main` (ver «R1 — Resultados»). Luis levantó la restricción de desplegar: como la visita a las tiendas aún no ocurre, `main` puede ir a producción. El congelamiento (no desplegar salvo correcciones con su prueba) rige desde el arranque del piloto. Con R1 hecha, la extracción del `ia-service` (Sprint 6.3) es mover `services/ia/` y cambiar las llamadas locales por llamadas HTTP.

**Actualización del 6-oct-2026.** Luis decidió que el piloto va con la web y que la app nativa sigue en paralelo (plan 22, sección 5). El modo básico web (fases A, B y C del plan 19) vuelve antes de la visita, pero **no depende de R3.1**: se construye sobre `Sidebar.jsx` y una pantalla nueva. Por eso **los tramos de la tabla no cambian**: R3.1 y el resto siguen después del piloto. Las filas P21-09, P21-13 y R2 de `caja.js` ya están en `main` (merge `cb028d9`).

**Actualización del 3-oct-2026.** El equipo adelantó la app nativa del Tendero (plan 07, sección 6) para la visita a las tiendas piloto. Eso cambió el tramo de tres filas: la app reemplazaba al modo básico web antes del piloto, así que **R3.1 ya no va antes del piloto**; **R1 pasa a después del piloto**, salvo que la fecha del Sprint 6.3 lo exija antes, y el tiempo real (T1 y T2) **se replantea**, porque para una app nativa lo natural son notificaciones push y no SSE.

| Fase | Requiere | Tramo | Motivo |
|---|---|---|---|
| **R0** | — | Hecha (mezclada en `main` el 28-sep) | Red de seguridad de todo lo demás. |
| **P21-09 y P21-13** (limitador de `verify-reset-code` y `skip` de `globalLimiter`) | R0 | Antes de la visita, en la rama del backend para la app | La app usa esas rutas de autenticación. Cambian el comportamiento a propósito, así que no van dentro de un refactor (sección 3): cada una en su commit, con su prueba. |
| **R2, solo `caja.js`** (punto 2.4) | R0 | Antes de la visita, en la rama del backend para la app | La app abre y cierra caja; una doble apertura dañaría los arqueos, que son datos del piloto. |
| **P21-10** (recepción sin tope) | R0 | Antes del arranque del piloto, cuando se decida la regla (decisión 5) | La app recibe mercancía. |
| **R4, solo migración explícita** (punto 2.2) | — | Antes del arranque del piloto (recomendado, decisión 4) | Con datos reales en producción, una auto-migración en cada `require` es un riesgo que no conviene llevar al piloto. |
| **R1** | R0 | **Hecha el 8-oct y subida a `main`.** Luis autorizó el despliegue antes de la visita a las tiendas; desde el arranque del piloto rige el congelamiento | La app no lo necesita; es la base del `ia-service`. |
| **R2** (resto) | R0 | Después del piloto; en rama durante | Toca ventas, inventario y alertas, justo lo que mide el piloto. |
| **T1 + T2 y sus pruebas (T4)** | R2 (`eventosInventario`) | Después del piloto, **replanteado** | Para la app nativa, las alertas en tiempo real se entregan con notificaciones push; SSE sigue sirviendo para la web. Para medir activación y adopción basta la consulta periódica actual. |
| **R3.1 a R3.4** | Una prueba E2E o de componente que fije cada página (hoy 7 de 11 E2E están desactualizados, ver `docs/hallazgo_e2e_desactualizados.md`) | Después del piloto | Con la app nativa, el modo básico web deja de ir antes del piloto, y con él la razón para adelantar R3.1. |
| **T3** | T1 + T2 y el worker del Sprint 6.2 (punto 2.3) | Con el Sprint 6 de Bases de Datos Avanzadas | Si el Sprint 6 cae durante el piloto, se trabaja en rama y se muestra en Docker, sin desplegar. |
| **R4** (resto, incluido P21-12) | R1 a R3 | Después del piloto | Limpieza. |

**Congelar durante el piloto significa no desplegar a producción ni publicar versiones nuevas de la app**, salvo correcciones de errores con su prueba. El desarrollo sigue en ramas.

---

## 7. Texto para los documentos académicos

Para la sección de Recomendaciones del Documento de Práctica 5, o como trabajo futuro en la sección 4.1 del documento de intervención:

> Se propone que el motor de alertas evolucione hacia la notificación en tiempo real. Hoy las alertas se recalculan en el servidor inmediatamente después de cada venta, entrada o ajuste de inventario, pero el navegador solo se entera al consultar de forma periódica (entre uno y cinco minutos, según la pantalla) y los demás dispositivos de la tienda no reciben el cambio hasta su siguiente consulta. La propuesta es publicar un evento por tienda cada vez que cambian sus alertas o llega una notificación, y entregarlo a todos los dispositivos conectados de esa tienda mediante Server-Sent Events, un estándar web de comunicación del servidor hacia el navegador que reutiliza la sesión y los controles de autorización existentes. Para operar con varias réplicas del servidor, los eventos se distribuyen entre procesos con Redis. Se evaluó también Socket.io (WebSockets), que se reserva para cuando exista una necesidad de comunicación bidireccional en tiempo real, como varios cajeros operando el mismo punto de venta. La meta es que una alerta llegue a todos los dispositivos de la tienda en menos de dos segundos.

---

## 8. Decisiones pendientes (Luis)

1. ¿Se aprueba el transporte **SSE** para T1 y T2, con la interfaz que permite cambiar a Socket.io? ¿O se prefiere Socket.io desde el inicio? Si se elige Socket.io, el plan cambia en T1 (compartir la sesión), T3 (adaptador de Redis y solo WebSocket, o afinidad en Nginx) y T2 (cliente `socket.io-client`), pero no en R0 a R4.
2. ¿R1 se hace antes del Sprint 6.3, para que el `ia-service` salga de `services/ia/`? Recomendado: sí. **Hecho el 8-oct (rama `refactor/R1-servicios-ia`, mezclada y subida a `main`).**
3. En la opción de T3, ¿se prefiere Redis pub/sub (recomendado, porque funciona igual en Neon) o `LISTEN/NOTIFY` de PostgreSQL (más vistoso para Bases de Datos Avanzadas, pero con la limitación de Neon)?
4. ¿Se hace la migración explícita de R4 antes de lo previsto, dado el riesgo de la sección 2.2? Recomendado: sí, antes del piloto (así figura en el plan 22, sección 5).
5. Recepción de mercancía (P21-10): ¿se bloquea recibir más de lo pedido, se pide confirmación o solo se registra la diferencia? ¿Y recibir menos deja el faltante pendiente o cierra la orden como hoy?
   **Decidido (4-oct-2026, Luis): opción B, pedir confirmación** cuando lo recibido supera lo pedido y registrar la diferencia. **Detalles decididos (4-oct-2026, Luis):** la confirmación **pide un motivo** (obligatorio) y recibir menos **deja el faltante pendiente** en la misma orden, en vez de cerrarla como hoy. No afecta a la app (la `[M1]` del contrato no cambia); va antes del arranque del piloto.
