# 🚀 Hoja de Ruta de Escalabilidad Técnica — StockPilot

Este documento establece el diagnóstico de arquitectura, los cuellos de botella identificados y el plan de acción por fases para escalar **StockPilot** desde su estado actual hasta una plataforma SaaS multi-tienda de alta concurrencia.

---

## 📌 1. Diagnóstico del Estado Actual

StockPilot cuenta con una base arquitectónica moderna y desacoplada:
- **Frontend:** Single Page Application (SPA) en React + Vite, completamente independiente.
- **Backend:** API REST en Node.js / Express.
- **Base de Datos:** PostgreSQL con consultas analíticas optimizadas en base de datos (CTEs, Window Functions).
- **Autenticación:** Sesiones con estado, cookies `httpOnly`, `SameSite: strict`, regeneración de ID de sesión y validación anti-concurrencia. El store es PostgreSQL (`connect-pg-simple`) por defecto, con soporte ya integrado para Redis (`connect-redis`) activable con la variable `REDIS_URL` (degradación elegante si no está definida).
- **Rate Limiting:** `express-rate-limit` con el mismo patrón de degradación elegante — usa `rate-limit-redis` si hay `REDIS_URL`, o `MemoryStore` local si no la hay.

```
       [ Navegador Web ]
              │
              ▼
   [ Node.js / Express (Instancia Única) ]
        ├── express-session (connect-pg-simple, o Redis si REDIS_URL está definida)
        ├── express-rate-limit (MemoryStore, o Redis si REDIS_URL está definida)
        └── node-cron (Scheduler en proceso, sin cerrojo distribuido)
              │
              ▼
       [ PostgreSQL DB ] (Pool max: 25)
```

---

## ⚠️ 2. Cuellos de Botella Identificados

### A. Escalabilidad Horizontal (Múltiples réplicas de Node.js)

| Componente | Archivo Actual | Comportamiento Actual | Problema al tener 2 o más servidores |
| :--- | :--- | :--- | :--- |
| **Rate Limiter** | `middleware/rateLimiter.js`, `config/redis.js` | ✅ **Ya soporta Redis** (`rate-limit-redis`) con fallback automático a `MemoryStore` si `REDIS_URL` no está definida. | Solo persiste si se opera **sin** `REDIS_URL` configurada: ahí sí, los contadores no se comparten entre réplicas. |
| **Cron Jobs** | `services/schedulerService.js` | Ejecuta tareas con `node-cron` dentro del mismo proceso, sin cerrojo distribuido. | Todas las réplicas ejecutarán el cron al mismo segundo, enviando correos duplicados y creando colisiones en la BD. **Sigue pendiente.** |
| **Sesiones DB** | `app.js`, `config/redis.js` | ✅ **Ya soporta Redis** (`connect-redis`) con fallback automático a `connect-pg-simple` (PostgreSQL) si `REDIS_URL` no está definida. | Solo persiste si se opera **sin** `REDIS_URL` configurada: ahí sí, con `rolling: true` cada petición HTTP hace un `UPDATE` en la tabla `session`, generando saturación de escrituras y *table bloat*. |
| **Pool de Conexiones** | `config/database.js` | `max: 25` conexiones por proceso (configurable vía `DB_POOL_MAX`). | Con 4 réplicas se abren hasta 100 conexiones simultáneas, pudiendo superar los límites del plan de base de datos. **Sigue pendiente** (requiere PgBouncer, Fase 3). |

---

### B. Escalabilidad de Datos y Almacenamiento (Volumen)

| Componente | Archivo Actual | Comportamiento Actual | Problema a largo plazo |
| :--- | :--- | :--- | :--- |
| **Fotos de Perfil** | `ProfilePage.jsx` / `Usuarios` | Almacenadas como cadenas Base64 en la columna `foto_url TEXT`. | Un usuario con foto suma ~1.3 MB directo a la tabla. Mil usuarios inflan la base de datos en gigabytes de texto ineficiente. |
| **Índices Multi-tienda** | `database/init_pg.sql` | ✅ Ya existen índices compuestos en los campos más consultados: `Ventas(id_tienda, fecha_salida)`, `Productos(id_tienda, estado)`, `MovimientosStock(id_tienda, fecha_movimiento)`, `Alertas(id_tienda, resuelta)`. | Falta un índice compuesto `Productos(id_tienda, cantidad)` para acelerar los filtros de stock bajo/crítico al superar millones de registros. |
| **Procesamiento de IA** | `controllers/aiController.js` | Ejecución en el ciclo de vida síncrono de la petición HTTP. | Consultas complejas bloquean el hilo de eventos de Node.js si la concurrencia es alta. |

---

## 🗺️ 3. Plan de Acción por Fases

```mermaid
flowchart TD
    subgraph FASE 1 ["Fase 1: Lanzamiento y Producción Inicial (1 - 50 Tiendas)"]
        F1A["Arquitectura actual sin cambios mayores"]
        F1B["Monitoreo de logs y pool de Postgres"]
        F1C["Respaldos periódicos en Postgres"]
    end

    subgraph FASE 2 ["Fase 2: Crecimiento Medio (50 - 500 Tiendas)"]
        F2A["Aprovisionar Redis y definir REDIS_URL en producción (código ya listo)"]
        F2B["Mudar fotos a Cloudinary / S3"]
        F2C["Crear índice compuesto Productos(id_tienda, cantidad)"]
    end

    subgraph FASE 3 ["Fase 3: Alta Escala (> 1,000 Tiendas / Múltiples Servidores)"]
        F3A["PgBouncer para pooling de conexiones"]
        F3B["Worker dedicado para Cron y Background Jobs (BullMQ)"]
        F3C["Balanceador de carga horizontal con Nginx / AWS ALB"]
        F3D["Réplicas de lectura (Read Replicas) para reportes"]
    end

    subgraph FASE 4 ["Fase 4: Hiper-Escala (Enterprise SaaS & Aislamiento)"]
        F4A["CDN Edge (Cloudflare/AWS) para Frontend estático"]
        F4B["Colas asíncronas para IA y Rate Limiting agresivo"]
        F4C["APM (Datadog / New Relic) para observabilidad"]
        F4D["PostgreSQL Table Partitioning & RLS (Row-Level Security)"]
    end

    FASE 1 --> FASE 2
    FASE 2 --> FASE 3
    FASE 3 --> FASE 4
```

---

## 🛠️ 4. Guía Técnica de Implementación por Fase

### Fase 2: Crecimiento Medio (50 - 500 Tiendas)

#### 1. Activar Redis para Sesiones y Rate Limiting (ya implementado en código)
Este paso **no requiere escribir código nuevo**: `config/redis.js`, `app.js` y `middleware/rateLimiter.js` ya están preparados con degradación elegante (usan Redis si `REDIS_URL` está definida, y caen a PostgreSQL/memoria si no lo está). Lo único pendiente para activarlo en producción es aprovisionar una instancia de Redis y definir la variable de entorno:

```bash
REDIS_URL=redis://usuario:password@host:puerto
```

Configuración ya existente en `config/redis.js`:
```javascript
const redisClient = process.env.REDIS_URL
    ? createClient({ url: process.env.REDIS_URL })
    : null; // Fallback a PostgreSQL (sesiones) y MemoryStore (rate limit)
```

`app.js` y `middleware/rateLimiter.js` ya consumen ese mismo `redisClient` para elegir el store correspondiente.

---

#### 2. Migrar Fotos de Base64 a Object Storage (Cloudinary o AWS S3)
En lugar de enviar Base64 a `Usuarios.foto_url`:
1. El backend recibe la imagen vía `multer`.
2. Se sube el buffer directamente a Cloudinary o S3:
```javascript
const cloudinary = require('cloudinary').v2;

// Subir stream/buffer
const uploadResult = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder: 'stockpilot/perfiles' }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
    }).end(req.file.buffer);
});

// Guardar solo la URL limpia en PostgreSQL
await User.update(userId, { foto_url: uploadResult.secure_url });
```

---

#### 3. Índices Compuestos Multi-tienda

La mayoría de estos índices **ya existen** en `database/init_pg.sql` (verificado contra el esquema real, cuyas tablas/columnas son `Ventas.fecha_salida`, `VentasProductos` en vez de `DetalleVenta`, y `Productos.cantidad` en vez de `stock`):

```sql
-- Ya existe: idx_ventas_tienda_fecha ON Ventas (id_tienda, fecha_salida DESC)
-- Ya existe: idx_ventasprod_venta ON VentasProductos (id_venta)
-- Ya existe: idx_ventasprod_producto ON VentasProductos (id_producto)
-- Ya existe: idx_alertas_tienda_resuelta ON Alertas (id_tienda, resuelta)

-- Único pendiente: acelerar el filtrado de stock bajo/crítico por tienda
CREATE INDEX IF NOT EXISTS idx_productos_tienda_cantidad 
ON Productos (id_tienda, cantidad);
```

---

### Fase 3: Alta Escala (> 1,000 Tiendas)

#### 1. Bloqueo Distribuido o Worker Dedicado para Crons
Para evitar que múltiples servidores ejecuten el mismo cron simultáneamente, usar un cerrojo a nivel de Postgres:

```javascript
// En services/schedulerService.js
const runWeeklySummary = async () => {
    // 🛡️ Intentar obtener cerrojo consultivo exclusivo (ID arbitrario: 991234)
    const lockResult = await db.getAsync('SELECT pg_try_advisory_lock(991234) as locked');
    if (!lockResult || !lockResult.locked) {
        console.log('⏳ Otra réplica ya está ejecutando el cron. Saltando ejecución.');
        return;
    }

    try {
        // Ejecutar envío de emails...
    } finally {
        // Liberar el cerrojo
        await db.runAsync('SELECT pg_advisory_unlock(991234)');
    }
};
```

#### 2. Connection Pooling Centralizado (PgBouncer)
En lugar de que cada contenedor Node.js gestione un pool directo contra PostgreSQL:
- Conectar cada instancia a PgBouncer (`DATABASE_URL=postgres://...:6543/db`).
- PgBouncer mantiene un pool pequeño de conexiones reales y despacha miles de transacciones de clientes por turno.

---

### Fase 4: Hiper-Escala (Enterprise SaaS & Aislamiento)

#### 1. Aislamiento Multi-Tenant (RLS y Particionamiento Físico)
Para proteger la integridad de los datos a gran escala y optimizar consultas sobre tablas con más de 100 millones de filas.

**Configuración de Row-Level Security (RLS) en PostgreSQL:**
Se debe habilitar RLS en las tablas transaccionales y forzar que el `id_tienda` coincida con una variable de entorno de la transacción de BD.
```sql
-- 1. Habilitar RLS en la tabla
ALTER TABLE Ventas ENABLE ROW LEVEL SECURITY;

-- 2. Crear política estricta
CREATE POLICY tenant_isolation_policy ON Ventas
    USING (id_tienda = current_setting('app.current_tenant_id')::integer);
```
En Node.js, antes de ejecutar cualquier *query*, se inyecta el tenant (aislado en la transacción):
```javascript
// Middleware o Wrapper de BD
await db.query(`SET LOCAL app.current_tenant_id = ${req.user.id_tienda}`);
const ventas = await db.query('SELECT * FROM Ventas'); // Solo retornará las suyas automáticamente
```

#### 2. CDN para Frontend Estático
Actualmente Node.js sirve los archivos de React (`/dist`). A gran escala, esto consume RAM y ancho de banda del servidor backend innecesariamente.
- **Implementación:** El *build* de Vite (`npm run build`) se sube a **Cloudflare Pages** o **AWS CloudFront**.
- **Beneficio:** Los usuarios descargan la interfaz desde un servidor perimetral (Edge) cercano a su ciudad, reduciendo la latencia de carga visual a milisegundos. Node.js se configura exclusivamente como API (solo responde JSON bajo `/api`).

#### 3. Offloading de IA con Colas Asíncronas (BullMQ)
Evitar cuellos de botella y errores HTTP 429 (*Rate Limit* de OpenAI) aislando las peticiones de IA del hilo principal.

**Implementación con BullMQ y Redis:**
```javascript
const { Queue, Worker } = require('bullmq');

// Crear la cola
const aiQueue = new Queue('ai-recommendations', { connection: redisClient });

// 1. Controller encola el trabajo y responde rápido al Frontend
app.post('/api/ia/recomendar', async (req, res) => {
    const job = await aiQueue.add('predict', { tiendaId: req.user.id_tienda });
    res.json({ status: 'processing', jobId: job.id }); 
});

// 2. Worker Dedicado (puede correr en otro servidor)
const aiWorker = new Worker('ai-recommendations', async job => {
    // Llamada lenta a OpenAI GPT-4o-mini
    const result = await processOpenAI(job.data);
    // Guardar resultado en DB o enviar por WebSocket/SSE
}, { connection: redisClient, concurrency: 5 /* Límite seguro para API OpenAI */ });
```

#### 4. Observabilidad Avanzada (APM)
Para detectar *Memory Leaks*, cuellos de botella en DB, y monitorizar la experiencia real del usuario sin depender de logs manuales (`console.log`).
- **Implementación (Datadog / New Relic):** Se inyecta un agente en la raíz de Node.js.
```javascript
// En la línea 1 de app.js (antes de requerir express)
require('dd-trace').init({
    logInjection: true,
    env: process.env.NODE_ENV
});
```
Esto genera automáticamente gráficos de latencia (ej. "el endpoint `/ventas` toma 300ms porque la query SQL toma 280ms"), facilitando la identificación instantánea del problema mencionado en la *Matriz de Decisión*.

---

## 📊 5. Matriz de Decisión: ¿Cuándo activar cada fase?

| Síntoma / Métrica | Causa | Acción Inmediata |
| :--- | :--- | :--- |
| **Uso de CPU en PostgreSQL > 70% sin muchas consultas pesadas.** | Escrituras constantes de la tabla `session` por `rolling: true` (solo ocurre si no hay `REDIS_URL` configurada). | **Activar Fase 2:** definir `REDIS_URL` en producción (el soporte ya está en el código). |
| **Tiempos de respuesta lentos en Dashboard/Reportes (> 1 seg).** | Filtrado de stock por tienda sin el índice `Productos(id_tienda, cantidad)`. | **Activar Fase 2:** crear ese índice compuesto (el resto ya existen). |
| **La base de datos aumenta de tamaño rápidamente (GBs en semanas).** | Almacenamiento de fotos en Base64 en Postgres. | **Activar Fase 2:** Mudar a Cloudinary o AWS S3. |
| **Error `too many clients already` en logs de PostgreSQL.** | Pool saturado al desplegar más servidores o reiniciar réplicas. | **Activar Fase 3:** Configurar PgBouncer. |
| **Usuarios reportan recibir 2 o más correos idénticos del cron.** | Múltiples instancias de Node.js corriendo el scheduler a la vez. | **Activar Fase 3:** Cerrojo distribuido con `pg_advisory_lock` o worker aislado. |
| **Consultas demoran más de 3 segundos en tablas de Ventas (>50M filas)** | Índices sobrepasados por el volumen (I/O). | **Activar Fase 4:** Particionamiento de Tablas y RLS. |
| **Gastos disparados o bloqueos en la API de OpenAI (Rate Limit 429)** | Peticiones síncronas bloqueando el Event Loop y picos de tráfico. | **Activar Fase 4:** Cola BullMQ + SSE/Webhooks para IA. |

---

*Documento generado y mantenido como referencia técnica de arquitectura para el equipo de StockPilot.*
