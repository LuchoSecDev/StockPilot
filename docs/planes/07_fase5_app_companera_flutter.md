# Plan 07: Aplicación Móvil Compañera (Flutter)

**Estado (9-oct-2026):** en construcción por el equipo, en un repositorio aparte (P07-01). El backend que necesita ya está en `main` (P07-02 y plan 24).

> **Cómo leer este plan:** las secciones 1 a 5 son la propuesta original de septiembre y se conservan como historial. El alcance, las librerías y los plazos vigentes están en la **sección 6**; donde se contradigan, manda la 6. Las decisiones técnicas de la app viven en `docs/propuesta_tecnica_app_flutter.md` y `docs/guia_construccion_app.md`, y la API en `docs/contrato_api_app_tendero.md`.

## 1. Contexto y Motivación
Actualmente, la lectura de códigos de barras mediante navegadores web en dispositivos móviles se ve limitada por:
1. La falta de acceso directo a las APIs de autoenfoque (autofocus) del hardware de la cámara.
2. El alto consumo de recursos (CPU/Batería) que requiere decodificar video en tiempo real a través de JavaScript y WebAssembly.

Aunque la aplicación web de POS actualiza el escáner al máximo nivel permitido en entornos web (resolución de 720p, API nativa de `BarcodeDetector` y fallback a `ZXing`), para un escenario de alta concurrencia en retail (tiendas), un tendero necesita escaneos instantáneos, tolerantes al movimiento rápido y a distintas condiciones de luz. 

Para lograr la eficiencia de un láser físico usando un celular, se requiere acceso nativo a la cámara.

## 2. Propuesta: Enfoque "App Compañera"
En lugar de reconstruir toda la plataforma administrativa, se recomienda el desarrollo de una **"App Compañera"** (Companion App) móvil, construida en **Flutter**. 

Esta aplicación estará diseñada **exclusivamente para la operación diaria en la tienda (Rol Tendero)**, manteniendo al administrador en la aplicación Web (Dashboard, IA, Reportes, Gráficas).

### Ventajas del enfoque:
- **Desarrollo ágil (Estimado 2-3 semanas):** Al reciclar el 100% de la lógica de negocio actual (API REST Node.js y base de datos PostgreSQL), el esfuerzo se concentra únicamente en la interfaz de usuario.
- **Rendimiento Nativo:** Integración con librerías de Flutter (ej. `ai_barcode_scanner` o `mobile_scanner`) que compilan código nativo de Swift (iOS) y Kotlin (Android), garantizando lectura en milisegundos sin sobrecalentar el dispositivo.
- **UX Especializada:** Interfaces adaptadas ergonómicamente para ser usadas con una sola mano, ideales para trabajo de mostrador.

## 3. Alcance del Producto Mínimo Viable (MVP)
La App Compañera debería incluir únicamente los siguientes módulos para mantener el desarrollo rápido:

1. **Autenticación:**
   - Login con credenciales.
   - Restricción de vistas (solo se permitirá el acceso a usuarios con rol 'Tendero' o 'Administrador' en modo operador).

2. **Módulo de Venta Rápida (POS):**
   - Lector de código de barras a pantalla completa (integración con `ai_barcode_scanner`).
   - Carrito de compras y modificación de cantidades.
   - Confirmación de venta y descuento en base de datos.

3. **Consultas de Inventario:**
   - Buscador de productos por nombre o lectura de código para consultar stock actual y precios.

4. **Centro de Notificaciones:**
   - Recepción de alertas (ej. bajo stock, promociones aprobadas por IA).

## 4. Stack Tecnológico Sugerido
- **Frontend Móvil:** Flutter SDK (Lenguaje Dart).
- **Scanner Core:** `ai_barcode_scanner` (Capa de abstracción sobre `mobile_scanner` optimizada para POS).
- **Comunicación HTTP:** Paquete `http` o `dio` en Flutter para conectarse a las rutas actuales (`/api/ventas`, `/api/productos`, etc.).
- **Backend:** (Reutilizado) Node.js + Express + PostgreSQL.

## 5. Recomendación Hardware vs Software
- **Para PC de Escritorio/Caja:** Se recomienda seguir utilizando la Plataforma Web actual junto a una pistola láser física conectada por USB.
- **Para Movilidad en Tienda:** Se recomienda migrar a la App Compañera en Flutter instalada en smartphones o terminales POS Android (ej. Sunmi, Honeywell).

---

## 6. Actualización (3-oct-2026, revisada el 6-oct): la app del Tendero

**Estado (6-oct-2026):** en construcción por el equipo, en un repositorio aparte, **en paralelo al piloto**. El orden general está en el plan 22, sección 5.

### 6.1 Qué se decidió
- **3-oct:** el equipo adelantó la app para llevarla a la visita a las tiendas piloto (semana del 5 de octubre) y, por eso, aplazó el modo básico web.
- **6-oct (vigente):** Luis decidió que **el piloto y la visita van con la web**, en modo básico (plan 19, 3.4, fases A, B y C). La app sigue construyéndose sin fecha de piloto y se presentará en la sustentación (prevista para noviembre, día por confirmar). Motivo: aún no cubre egresos, mercancía, alertas ni cobros no efectivos, y probarla con prisa en una tienda real arriesgaría los datos del piloto. Para los tenderos que no usan computador es una comodidad, no un requisito.
- **Durante las 6 semanas del piloto** no se publica una versión nueva de la app, y su desarrollo usa un entorno aparte, nunca la base de producción (plan 22, sección 5, C y D). Sus ventas llevan `canal = 'app'`, así que no deben mezclarse con las del piloto: las pruebas de la app van a una tienda de prueba.
- Antes de la sustentación se hará una prueba pequeña con 2 o 3 tenderos para tener evidencia real de la app.

### 6.2 Alcance de la versión para el piloto
Todo usa endpoints que ya existen y que, después de I0 (plan 22, 1.4), el Tendero puede usar.

| Función | Endpoints | Notas |
|---|---|---|
| Iniciar sesión | `GET /api/csrf-token`, `POST /api/login`, `POST /api/2fa/verify` | El Administrador (casi siempre el dueño) tiene segundo factor obligatorio: la app necesita la pantalla del código. La configuración inicial del segundo factor se hace en la web, durante la visita. |
| Vender | `POST /api/registrar-venta-carrito`, `GET /api/productos/barcode/:code` | Escáner, carrito y método de pago. **Incluye fiado a un cliente existente** (`GET /api/clientes`); crear clientes y registrar abonos es solo del Administrador (decisión D4). |
| Caja | `GET /api/caja/sesion`, `POST /api/caja/abrir`, `POST /api/caja/cerrar`, `POST /api/caja/egreso` | Sin el registro de egresos, cada gasto de caja chica aparece como faltante en el cierre. |
| Recibir mercancía | `POST /api/inventario/entrada` | Sin esto el stock solo baja y las alertas y el consejero de IA trabajan con datos falsos. Deja el movimiento en el Kardex. |
| Alertas | `GET /api/alertas`, `PATCH /api/alertas/:id/resolve` | |
| Catálogo y consulta | `GET /api/productos`, `PUT /api/productos/:id/link-barcode` | Al principio muchos productos no tendrán el código de barras asociado. |
| Recomendables | `POST /api/ordenes/borrador/solicitar`, ventas del turno, `/api/notificaciones` | Si alcanza el tiempo. |

**Se queda en la web (Administrador):** crear o editar productos y precios, proveedores, reportes, estrategias de IA, cartera y abonos, y usuarios.

**Requisitos que no son pantallas:** enviar el token CSRF en cada escritura, como la web; no perder el carrito si falla la red; mostrar «conectando…» mientras el servidor despierta (Render gratuito se duerme tras 15 minutos sin tráfico y tarda cerca de un minuto en volver).

### 6.3 Decisiones técnicas
- **Flutter, un solo código para Android e iPhone.** Para la visita y el piloto se distribuye **solo en Android**, como APK o por prueba interna de Google Play. Publicar en la tienda exige, para una cuenta personal nueva, una prueba cerrada de 12 personas durante 14 días. iPhone queda para después: compilar requiere un Mac, y entregar la app a otras personas (TestFlight) requiere la membresía de pago de Apple.
- **Repositorio aparte.** Lo construye otra parte del equipo, con otro lenguaje y otras herramientas, y sus commits no deben disparar despliegues del backend en Render. Para que la app y la API no se desincronicen, **el contrato vive en el repositorio del backend** (`docs/contrato_api_app_tendero.md`), con una prueba de integración por endpoint. Cualquier cambio de la API que afecte a la app se acuerda primero ahí.
- **Sesión por canal.** Hoy el Tendero solo puede tener una sesión abierta. La app enviará `X-Canal: app` al iniciar sesión, y el backend permitirá **una sesión en la web y una en la app al mismo tiempo**, manteniendo el bloqueo de un segundo inicio de sesión dentro del mismo canal. El mismo dato llena `Ventas.canal`, para medir la adopción por canal en el piloto.
- **Congelamiento:** durante las 6 semanas del piloto no se publican versiones nuevas de la app, salvo correcciones de errores.
