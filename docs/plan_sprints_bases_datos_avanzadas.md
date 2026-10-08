# Plan de sprints 2 a 8: Bases de Datos Avanzadas (StockPilot)

> Documento de contexto para el agente de Claude Code. Lo preparó otro asistente (Claude en Cowork) con Luis el 25-sep-2026, a partir del código actual y de la presentación del curso (`Documentacion/MetodologiaSoporteHojadeRutaProyecto2026.pptx`).
>
> **Reglas:**
> 1. No implementes nada sin que Luis apruebe el plan de cada sprint. Primero propón y después construye.
> 2. Verifica cada afirmación de este documento contra el código. Si algo no coincide, dilo en lugar de asumirlo.
> 3. **Producción (Render + Neon) no se toca.** Todo lo de los sprints 6 y 7 se construye y se demuestra en local (Docker Compose y Kubernetes con `kind`). Moverlo a producción es una decisión aparte.
> 4. Las 149 pruebas deben seguir pasando al final de cada tarea.
> 5. No cambies el esquema de las tablas existentes sin una migración aprobada. Lo nuevo va en esquemas separados (`ia`, `dw`).

---

## 1. Contexto

StockPilot también es el proyecto del curso **Bases de Datos Avanzadas**. El profesor exige esta secuencia (diapositivas 3 a 5):

> Requerimientos → Reglas del negocio → Sustantivos → Entidades → Atributos → Verbos → Relaciones → Cardinalidades → PK/FK → Dependencias funcionales → Normalización → Modelo E-R → Modelo relacional → DDL/DBMS/DML/CRUD → OLTP → Backend → Framework → API REST → Frontend → **SOA/Microservicios → Docker → Kubernetes → BD distribuidas → ETL/ELT → Data Warehouse → Analítica de datos**

| Sprint | Tema | Resultado esperado | Estado |
|---|---|---|---|
| 0 | Organización | Equipo, proyecto, alcance y backlog | Entregado |
| 1 | Análisis del negocio | Requerimientos y reglas | Entregado |
| 2 | Modelo conceptual | Sustantivos, entidades, atributos, relaciones y cardinalidades | Construido; falta la evidencia |
| 3 | Modelo lógico | Dependencias, normalización, E-R y modelo relacional | Construido; falta la evidencia |
| 4 | Base transaccional | DDL, DBMS, DML, CRUD y OLTP | Construido; falta la evidencia |
| 5 | Aplicación | Backend, framework, API REST y frontend | Construido; falta la evidencia |
| 6 | Arquitectura distribuida | SOA, microservicios, Docker y Kubernetes | **No existe** |
| 7 | Datos analíticos | BD distribuidas, ETL/ELT y data warehouse | **No existe** |
| 8 | Analítica y presentación | Indicadores, dashboard, documentación y sustentación | Parcial: hay un dashboard operacional, no uno analítico |

Los sprints 2 a 5 ya están construidos: solo hay que **documentarlos con evidencia**. El trabajo real está en los sprints 6, 7 y 8.

**Lo que dicen las diapositivas del profesor sobre microservicios (14 a 16),** que el diseño debe reflejar:
- Servicios independientes por funcionalidad de negocio.
- Comunicación por REST, gRPC o mensajería.
- **Persistencia de datos distribuida: cada microservicio con su propia base de datos.**
- Escalado y despliegue independientes.
- Docker + Kubernetes.
- CI/CD.
- **API Gateway** como punto único de entrada para el frontend.

---

## 2. Decisión de arquitectura (ya tomada con Luis)

**No se migra todo a microservicios.** Se mantiene el backend actual y se **extraen dos piezas** con el patrón *Strangler Fig*. Las razones, para que el documento las explique:

1. **Una venta es hoy una sola transacción ACID** (`controllers/saleController.js`). Bloquea el producto con `SELECT … FOR UPDATE`, inserta `Ventas` (con la sesión de caja y el estado del fiado) y `VentasProductos`, descuenta el stock y registra `MovimientosStock`, todo entre `BEGIN` y `COMMIT`. Las alertas se regeneran justo después, en otra transacción. Si esto se reparte entre servicios con bases distintas, hacen falta *sagas* con compensaciones, y es mucho más fácil que los datos queden inconsistentes.
2. **La escala no lo exige.** La prueba de carga midió 12,9 peticiones/s con una sola instancia, frente a 2-4 estimadas para 120 tiendas.
3. **El equipo es de 3 personas.** Los microservicios resuelven la coordinación entre muchos equipos, un problema que aquí no existe.
4. **La legibilidad viene de modularizar, no de distribuir.** Hoy el backend es un monolito **en capas** (routes → controllers → models), no uno modular por dominio. Conviene decirlo así.
5. Referencia: Fowler, M. (2015). *MonolithFirst*. martinfowler.com.

**Arquitectura objetivo (entorno local de demostración):**

```
                 [ Navegador ]
                       │
                       ▼
        [ Nginx: API Gateway y frontend estático ]
                       │  /api/*
                       ▼
        [ stockpilot-api (monolito, N réplicas) ] ───► [ Redis: sesiones y rate limit compartidos ]
             │                    │ HTTP interno + clave
             │                    ▼
             │          [ ia-service (microservicio) ] ──► OpenAI
             │                    │
             ▼                    ▼
   [ PostgreSQL: esquema public (OLTP) ]   [ esquema/BD ia: caché y registro de llamadas ]
             ▲
             │  lee public, escribe dw
   [ stockpilot-worker (1 réplica): cron, ETL nocturno, respaldos ]
             │
             ▼
   [ esquema dw: modelo estrella ]  ◄── consultas del dashboard analítico
```

---

## 2.1 Entornos de base de datos (propuesta del 26-sep-2026; confirmar con Luis)

Es un solo producto con un solo esquema, así que **no se crea una base distinta por materia**: dos copias del mismo esquema terminan desincronizadas y obligan a migrar dos veces. Lo que se separa es el **propósito** de cada base:

| Entorno | Base | Para qué | Regla |
|---|---|---|---|
| Producción | Neon (vía Render) | Tiendas de prueba reales | No se toca desde local ni desde las pruebas |
| Desarrollo | `stockpilot` local (la que ya existe) | Trabajo diario de las dos materias | Sus datos se conservan: nada la vacía automáticamente |
| Pruebas | `stockpilot_test` local | Pruebas de integración | Desechable: se vacía y recrea en cada ejecución. Las pruebas abortan si el nombre no termina en `_test` o si el host no es local |
| Demostración analítica (BDA) | PostgreSQL del `docker compose` (Sprint 6) | Sprints 6 a 8 y sustentación | Se crea desde cero con `init_pg.sql` + un generador de datos sintéticos; cualquiera del equipo lo levanta igual |

**Qué cambia para Bases de Datos Avanzadas:** lo nuevo va en **esquemas** dentro del mismo PostgreSQL, no en otra base: `public` (OLTP, sin cambios), `ia` (microservicio) y `dw` (modelo estrella). Así se muestra la evolución del dato transaccional al analítico en un mismo motor, que es lo que plantea la primera diapositiva del curso.

**Generador de datos sintéticos (tarea del Sprint 6 o 7):** el ETL y los indicadores necesitan historia. Propón un script (`npm run seed:demo`) que genere por lo menos 3 tiendas y 6 a 12 meses de ventas con estacionalidad semanal y mensual, productos perecederos y no perecederos, fiados y abonos, órdenes de compra y quiebres de stock. Debe ser determinista (semilla fija) y marcar los datos como sintéticos, por ejemplo con tiendas llamadas "Demo …". En los documentos se presentan como **datos sintéticos de demostración, nunca como ventas reales**.

---

## 3. Sprint 6: Arquitectura distribuida

### 6.1 Contenerización con Docker (hacer primero)

- **`Dockerfile` del backend**, multietapa:
  - Etapa 1: compilar el frontend (`npm run build:frontend`).
  - Etapa 2: `node:22-slim` solo con dependencias de producción (`npm ci --omit=dev`) y el `frontend/dist` compilado.
  - **Instalar `postgresql-client`** en la imagen: `utils/backup.js` llama a `pg_dump`, y el propio código advierte que puede no existir en Render. Con Docker queda garantizado.
  - Usuario no root, `HEALTHCHECK` contra un endpoint de salud (usar `/api/ia/ping` o crear `/health`).
- **`.dockerignore`:** `node_modules`, `.env`, `coverage`, `test-results`, `playwright-report`, `backups`, `database/inventario.db` (40 MB, legado de SQLite) y `Documentacion`.
- **`docker-compose.yml`** con los servicios `postgres:15`, `redis:7`, `api`, `ia-service` (cuando exista), `worker` y `gateway` (Nginx):
  - Variables desde `.env`, **nunca copiadas a la imagen**.
  - `depends_on` con `condition: service_healthy`.
  - Volumen para los datos de PostgreSQL.
- La base del compose es el entorno de demostración de la sección 2.1: se inicializa con `database/init_pg.sql` y se siembra con el generador sintético (mientras no exista, con `npm run seed`). No reutiliza la base `stockpilot` de desarrollo.
- **Criterio de terminado:** `docker compose up` levanta todo desde cero. Se puede iniciar sesión, registrar una venta y ver las alertas. `REDIS_URL` queda activa, con lo que el código de `config/redis.js` que hoy funciona en modo *fallback* se usa de verdad.

### 6.2 Worker de tareas programadas (segundo servicio, casi sin código nuevo)

- **Problema real**, ya documentado en `Documentacion/hoja_de_ruta_escalabilidad.md`: `app.js` (línea ~321) llama a `scheduler.startScheduler()` siempre. Con 2 réplicas del API, cada tarea programada se ejecuta dos veces: correos duplicados, dos reversiones de precio y dos respaldos.
- **Solución:**
  - Variable `SCHEDULER_ENABLED`: `false` en las réplicas del API.
  - Un proceso `worker.js` que solo arranca el scheduler, con la misma imagen y otro comando, y **exactamente 1 réplica**.
- Opcional como segunda defensa: `pg_try_advisory_lock` al inicio de cada tarea, el mismo mecanismo que ya usa `Alert.generate`.

### 6.3 Extracción del microservicio de IA (`ia-service`)

**Por qué este y no otro:** tiene un límite claro (recibe indicadores y devuelve recomendaciones) y depende de un proveedor externo lento y con fallos. Aislarlo significa que **si OpenAI falla, las ventas y la caja siguen funcionando**, y permite escalarlo por separado.

**Punto de partida verificado (confírmalo):**
- **Actualización del 8-oct-2026 (plan 21, R1, mezclada a `main` local y subida en la rama `refactor/R1-servicios-ia`):** las llamadas a OpenAI de recomendaciones, promociones y riesgo de cliente ya viven en `services/ia/` (`recomendaciones.js`, `promociones.js`, `riesgoCliente.js`) y comparten un único cliente en `services/ia/openaiClient.js`. `controllers/aiController.js` quedó como capa HTTP delgada (152 líneas). Esta es la carpeta que se mueve al `ia-service`.
- La llamada de `controllers/suppliersController.js` (`generateSmartOrder`) sigue en el controlador, pero ya usa el cliente único; falta moverla a un servicio (plan 21, R2).
- `Cache_IA` solo la usa `services/ia/cacheIA.js`. La caché en memoria `aiCache_v3` se eliminó: era estado por proceso y con varias réplicas cada una habría llamado a OpenAI por separado.
- `Auditoria_IA` la escriben `services/ia/` (recomendaciones, promociones, estrategia de precio y riesgo), `ordenBorradorController.js` y `suppliersController.js`, y tiene **FK hacia `Tienda` y `Ordenes_Compra`**.

**Diseño propuesto (para aprobar):**

| Aspecto | Propuesta |
|---|---|
| Responsabilidad | Construir el prompt, llamar al LLM, validar la respuesta JSON, cachearla y registrar la llamada. **No lee ni escribe tablas del negocio.** |
| Contrato | REST documentado con **OpenAPI 3**: `POST /v1/recomendaciones`, `POST /v1/promociones`, `POST /v1/riesgo-cliente`, `GET /health`. El monolito envía el snapshot ya calculado por `services/inventory/reposicion.js` y `services/inventory/entradasMotor.js`. La matemática se queda en el monolito. |
| Base de datos propia | Esquema `ia` (o una base aparte en el compose). Se mueve **`Cache_IA`** y se crea `ia.llamadas_llm` (modelo, tokens, latencia, hash de la entrada y resultado). |
| `Auditoria_IA` | **Se queda en el monolito.** Es la auditoría de decisiones de negocio y está atada a órdenes por FK. El monolito la escribe con la respuesta del servicio. Documentar esta decisión: es el ejemplo de *database per service* sin romper la integridad referencial del OLTP. |
| Seguridad | El servicio no se expone al exterior. Solo el monolito lo llama, con `X-Internal-Key` y la red interna del compose o del clúster. La sesión del usuario sigue en el monolito. |
| Resiliencia | Tiempo de espera, 1 reintento y un *circuit breaker* simple. Si el servicio no responde, el monolito usa el **modo sin IA** que ya existe. |
| Migración | Detrás de una variable `IA_SERVICE_URL`. Si no está definida, el monolito sigue llamando a OpenAI directamente, como hoy. Así producción no cambia. |
| Pruebas | Pruebas unitarias del servicio + pruebas de contrato del cliente en el monolito (con el servicio simulado). Las 149 existentes deben seguir pasando. |

### 6.4 API Gateway

- **Nginx** como punto único de entrada, como piden las diapositivas:
  - Sirve `frontend/dist`.
  - Enruta `/api/*` al monolito.
  - Agrega cabeceras de seguridad, límite de tamaño y balanceo entre las réplicas del API.
- `ia-service` **no** pasa por el gateway porque es interno.
- Revisar que las cookies de sesión (`secure`, `sameSite`) y CSRF sigan funcionando detrás del proxy (`app.set('trust proxy', 1)`).

### 6.5 Kubernetes (solo demostración local con `kind` o `minikube`)

- Manifiestos en `k8s/`:
  - `Namespace`, `ConfigMap` y `Secret` (sin valores reales en Git).
  - `Deployment` + `Service` para `api` (**2 réplicas**), `ia-service`, `worker` (**1 réplica**), `redis` y `gateway`.
  - PostgreSQL como `StatefulSet` con volumen, o una rama de Neon solo para pruebas.
  - `readinessProbe` y `livenessProbe`.
- **Guion de demostración:**
  1. Borrar un pod del API: Kubernetes lo recrea y la sesión del usuario **no se pierde**, porque vive en Redis.
  2. `kubectl scale` a 3 réplicas.
  3. Mostrar que el worker es el único que ejecuta las tareas programadas.

### 6.6 CI (opcional, lo mencionan las diapositivas)

- GitHub Actions: `npm ci`, `npm test`, construir las imágenes y, si hay tiempo, publicarlas en GHCR.

### 6.7 Evidencia del sprint

- Diagrama de la arquitectura antes y después.
- Un ADR corto: por qué no se migró todo y por qué se extrajo IA.
- Especificación OpenAPI del `ia-service`.
- Capturas de `docker compose ps`, `kubectl get pods` y la demostración de recuperación.

---

## 4. Sprint 7: Datos analíticos

### 7.1 Bases de datos distribuidas (qué se puede afirmar con verdad)

- **Redis** como almacén distribuido y compartido de sesiones y contadores de rate limit entre réplicas. El código ya lo soporta; en el compose y en Kubernetes queda **activo**. **Verificar si producción tiene `REDIS_URL`**: si no, no afirmar que producción usa Redis.
- **Persistencia políglota por servicio:** `public` (OLTP del monolito), `ia` (del microservicio) y `dw` (analítico).
- **Separación OLTP/OLAP:** las consultas del dashboard analítico leen `dw`, no las tablas transaccionales.
- Opcional: réplica de lectura de Neon para `dw`. Revisar si el plan de Neon lo permite; si no, dejarlo documentado como el siguiente paso.
- Documentar el teorema CAP aplicado:
  - PostgreSQL, consistente, para ventas y caja.
  - Redis y la caché de IA, donde se acepta consistencia eventual.

### 7.2 ETL/ELT y data warehouse: modelo estrella en el esquema `dw`

**Tabla de hechos principal: `dw.fact_ventas`.**
- Grano: **una línea de venta** (`VentasProductos`).
- Medidas: cantidad, precio unitario, subtotal, costo (`costo_compra` del producto en la carga), margen, y si fue fiado.
- Claves: `tiempo_key`, `producto_key`, `tienda_key`, `cliente_key` y `metodo_pago_key`.

**Tabla de hechos secundaria: `dw.fact_inventario_diario`.** Es una foto periódica del stock por producto y por día. Hace falta para la rotación, los días de inventario y la tasa de quiebre, que no se pueden reconstruir bien después.

**Dimensiones:**

| Dimensión | Contenido |
|---|---|
| `dim_tiempo` | Fecha, día de la semana, semana, mes, trimestre, año y festivo en Colombia |
| `dim_producto` | Nombre, categoría, tipo (perecedero, no perecedero o digital), proveedor y clase ABC. Tipo SCD 1; la categoría puede ser SCD 2 si sobra tiempo |
| `dim_tienda` | Datos de la tienda |
| `dim_cliente` | Incluye un miembro "Consumidor final" para las ventas sin cliente |
| `dim_metodo_pago` | Métodos de pago |

**Proceso de carga, que es ELT en el mismo motor:**
- Extracción incremental por **marca de agua** (`fecha_salida` mayor que la última cargada), guardada en `dw.etl_ejecuciones` con inicio, fin, filas y estado.
- Transformación con `INSERT … SELECT … ON CONFLICT` en SQL, idempotente: si se ejecuta dos veces, no duplica.
- Lo ejecuta el **worker** cada noche, con la opción de ejecutarlo a mano (`npm run etl`).
- **Control de calidad:** después de cada carga, comparar la suma de `fact_ventas` con la suma de `Ventas.precio_total` por tienda y día, y registrar las diferencias.
- Multi-tienda: todas las consultas del dashboard filtran por `tienda_key` de la sesión.
- **Precio unitario:** `VentasProductos.precio_unitario` lo llena la venta POS de varios productos, pero no la venta individual, que solo guarda `Ventas.precio_total`. La transformación debe derivarlo en ese caso (`precio_total / cantidad`). Verifícalo con una consulta de cuántas filas lo tienen en NULL.
- dbt es opcional. Si se usa, que sea como capa de transformación sobre el mismo PostgreSQL; no agregar Airflow.

---

## 5. Sprint 8: Analítica y presentación

### 8.1 Indicadores

Deben calcularse desde `dw`, cada uno con su fórmula en el documento:

| Indicador | Fórmula |
|---|---|
| Ventas y ticket promedio | Suma de subtotal; ventas / número de ventas |
| Margen bruto (%) | (ventas − costo) / ventas |
| Rotación de inventario | Costo de lo vendido / inventario promedio (desde `fact_inventario_diario`) |
| Días de inventario | 365 / rotación, o inventario / costo diario |
| Tasa de quiebre de stock | Días-producto con stock 0 / días-producto observados |
| Mermas por vencimiento | Valor de lo retirado por vencimiento. **Hoy no hay una fuente confiable:** `MovimientosStock.tipo_movimiento` solo distingue Entrada, Salida y Ajuste. El motivo, si existe, está en `observacion` como texto libre. Proponer agregar el motivo (migración aprobada) o dejar este indicador fuera |
| Clasificación ABC | Participación acumulada en ventas por producto |
| Precisión de la IA | MAPE y sesgo desde `Feedback_IA` (ya se calculan en `feedbackController.js`: reutilizar la lógica) |
| Cartera (fiados) | Saldo pendiente y antigüedad, desde `Ventas` (Fiado) y `Abonos` |

### 8.2 Dashboard analítico

- Página "Analítica" en React con Recharts, separada del dashboard operacional actual.
- Filtros de periodo y categoría.
- Endpoints `/api/analitica/*` que leen solo `dw`.

### 8.3 Documentación y sustentación

- Informe final con la secuencia completa del profesor y evidencia de cada eslabón.
- Guion de demostración de unos 10 minutos: venta → ETL → indicador actualizado; caída de un pod; IA caída sin afectar las ventas.

---

## 6. Evidencia pendiente de los sprints 2 a 5 (tareas cortas)

| Sprint | Evidencia a generar |
|---|---|
| 2 | Tabla sustantivo → entidad, adjetivo → atributo y verbo → relación, sacada de las reglas del negocio (`StockPilot - (Requerimientos - Reglas del Negocio).md`). Diagrama conceptual (actualizar `Documentacion/diagrama_er.md`) |
| 3 | Dependencias funcionales de las tablas principales y verificación de 1FN, 2FN y 3FN tabla por tabla. Diagrama E-R generado **desde `information_schema`** de la base real. **Señalar cualquier tabla que no cumpla 3FN en vez de afirmarlo sin revisar**, por ejemplo campos derivados como saldos o totales guardados |
| 4 | Extracto del DDL (`database/init_pg.sql`) con restricciones e índices; matriz CRUD (entidad × operación × endpoint); **2 o 3 transacciones OLTP documentadas** con su `BEGIN/COMMIT` (registro de venta con `SELECT … FOR UPDATE`, `Alert.generate` con `pg_advisory_xact_lock` y aplicación de una estrategia de precio en `services/ia/estrategiaPromocion.js`) |
| 5 | Lista de endpoints de la API REST (19 archivos de rutas), idealmente como OpenAPI; diagrama de capas; stack del frontend |

---

## 7. Datos actualizados (para no repetir errores en los documentos)

- **Pruebas:** 149 en 8 archivos, **149/149 aprobadas** (25-sep-2026).
- **Cobertura:** 99,27 % de sentencias, 95,57 % de ramas y 100 % de funciones y de líneas. **Solo sobre los 5 módulos incluidos en `vitest.config.js`:** `models/Alert.js`, `models/products/**`, `controllers/feedbackController.js`, `middleware/auth.js` y `middleware/validation.js`. No es la cobertura de todo el proyecto y no debe presentarse así.
  - Pendientes menores: la línea 7 de `middleware/auth.js` (rama `Administrador` en `evaluarAcceso`, a la que le falta una prueba) y las ramas 25, 44-46 y 59 de `models/Alert.js`.
  - `requireLogin` y `requireAdmin` están excluidas con `/* v8 ignore */`.
- **Tablas:** 22 en `init_pg.sql`. Son **21 entidades de negocio + la tabla técnica `session`** de connect-pg-simple. Decir "21 entidades" es correcto.
- **Tablas puente N:M:** `VentasProductos` (Ventas ↔ Productos) y `Ordenes_Detalle` (Ordenes_Compra ↔ Productos).
- **Rutas:** 19 archivos en `/routes`.
- **Planes de trabajo:** 19 en `docs/planes`.
- **Respaldos:** `utils/backup.js` ya usa `pg_dump`, pero escribe en el disco efímero del servidor y `pg_dump` puede no existir en Render. Falta una copia en almacenamiento externo y verificarlo en producción.
- **Encuesta:** 15 negocios, en Google Forms, marzo de 2025, en Barrios Unidos, Usme, Santa Fe y Antonio Nariño. **No** fueron entrevistas ni se hicieron en Kennedy, Suba o Engativá.
- **Velocidad de venta** (`utils/reposicion.js`): velocidad de 30 días × tendencia. La tendencia es v7/v30, acotada entre 0,5 y 2, y vale 1 si hay menos de 5 unidades vendidas en 30 días. No son "velocidades ponderadas" ni "promedios 7/30/90".

---

## 8. Qué te pido ahora

1. Lee este documento, `Documentacion/hoja_de_ruta_escalabilidad.md` y las diapositivas del curso.
2. **Verifica** los datos de las secciones 3.3 y 7 contra el código y avísame de cualquier diferencia.
3. Propón el plan detallado del **Sprint 6**, solo las tareas 6.1 (Docker) y 6.2 (worker), con los archivos a crear o cambiar. Espera la aprobación antes de implementar.
4. Propón el **contrato OpenAPI** del `ia-service` (6.3) y la lista exacta de funciones que se mueven, sin implementarlo todavía.
5. Propón el DDL del esquema `dw` (7.2) y la consulta de control de calidad, sin ejecutarlos.
6. Estima el esfuerzo de cada tarea en horas para un equipo de 3 personas, y marca lo que es opcional si falta tiempo. Orden: 6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 7.2 → 7.1 → 8.1 → 8.2. La 6.6 es opcional. Si falta tiempo, lo primero que se recorta es la 6.5 (dejarla en manifiestos sin demostración) y la foto diaria de inventario de la 7.2.
