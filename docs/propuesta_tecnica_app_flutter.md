# Propuesta técnica mínima para la app del Tendero (Flutter)

**Estado:** propuesta del 4-oct-2026 para que Luis y su equipo decidan; no se impone nada. Lo marcado **VERIFICADO** se comprobó en la documentación oficial del paquete ese día; **SIN VERIFICAR** quiere decir que hay que comprobarlo al construir.
**Alcance:** solo lo necesario para empezar. La API está en `docs/contrato_api_app_tendero.md`, con ejemplos reales en `docs/ejemplos_app_tendero/`, y el entorno en `docs/guia_entorno_app.md`.

## 1. Principio
La app es un **cliente delgado**: las reglas (stock, cupo de crédito, tope de egresos, arqueo) las decide el servidor. La app puede validar para ayudar al usuario, pero nunca es la fuente de verdad: no calcula un cupo o un total «oficial», muestra lo que responde el servidor.

## 2. Decisiones mínimas

| Tema | Propuesta | Por qué | Alternativa |
|---|---|---|---|
| **Cliente HTTP y sesión** | `dio` con `dio_cookie_manager` y `PersistCookieJar` (paquete `cookie_jar`), guardando en un directorio de `path_provider`. VERIFICADO: así se persisten las cookies entre reinicios de la app (`dio_cookie_manager` 3.5.0). | La sesión del servidor es la cookie `connect.sid`; sin cookie persistente el Tendero tendría que entrar cada vez que cierra la app. | `http` con manejo manual de cookies: más código y más fácil de hacer mal. |
| **Interceptor propio** (un solo lugar) | Siempre `Accept: application/json`; `X-CSRF-Token` en toda escritura; ante `403` con `code: CSRF_INVALID`, pedir otro token y reintentar **una vez**; ante `401`, volver al login **sin perder el carrito**; tiempo de espera de 60 s o más en la primera petición («conectando…»). | Son las reglas del contrato (secciones 1 y 2 y `[S6]`). Concentrarlas evita que cada pantalla las repita. | — |
| **Venta** | Generar un UUID al pulsar «cobrar» y mandarlo como `Idempotency-Key` en todos los reintentos de esa venta. | Es la única escritura con idempotencia (`[V2]`). | — |
| **Estado de la app** | Elegir **una** solución y no mezclar. Sugerencia: `flutter_riverpod` (3.4.3, VERIFICADO que existe y sigue vigente), porque separa la lógica de las pantallas y facilita probarla con los ejemplos de respuesta. | Un equipo que reparte el trabajo entre varias personas necesita una sola forma de hacer las cosas. | `provider` o `bloc`: igual de válidos; **manda lo que el equipo ya conozca**. |
| **Escáner** | `mobile_scanner` 7.4.2 (VERIFICADO: CameraX y ML Kit en Android, AVFoundation y Apple Vision en iPhone; EAN-13, EAN-8, UPC-A, Code 128 y QR). Restringir `formats` a los de las tiendas y ajustar `detectionSpeed` y linterna. | Es la base del `ai_barcode_scanner` que sugería el plan 07: usarla directa quita una capa. | `ai_barcode_scanner` (SIN VERIFICAR). |
| **ML Kit empaquetado o no** | Sugerencia: **empaquetado** (+3 a 10 MB de app). El no empaquetado suma ~600 KB pero descarga el modelo por Google Play Services. VERIFICADO en la ficha del paquete. | Las tiendas pueden tener mala conexión y el escáner no debe depender de una descarga. (Razonamiento mío, INFERRED.) | No empaquetado, si el tamaño del APK importa más. |
| **Versión mínima de Android** | **SIN VERIFICAR**: la documentación de `mobile_scanner` no la indica. Se averigua al compilar. | — | — |
| **Carrito** | Guardarlo en almacenamiento local mientras se arma. | Plan 07: «no perder el carrito si falla la red». También cubre el 401 por sesión caducada. | — |
| **Configuración** | La URL del servidor en configuración **fuera del repositorio** (`--dart-define` o un archivo ignorado en `.gitignore`). Nada de contraseñas, claves ni cookies en el código. | El repositorio de la app es público. | — |
| **Plataforma y entrega** | Solo Android al inicio, APK firmado (plan 07, 6.3). La llave de firma **fuera del repositorio** y con una persona responsable de custodiarla. | Una app firmada con otra llave no puede actualizar a la ya instalada (comportamiento estándar de Android, no verificado aquí): perderla obliga a desinstalar en cada celular. | — |
| **Identificador del paquete** (`applicationId`) | Definirlo **antes** de empezar. Es decisión del equipo. | Cambiarlo después equivale a publicar otra app. | — |

## 3. Orden de construcción (corte vertical)

1. **Escáner, como prueba aparte desde el primer día.** Es el mayor riesgo (plan 22): se prueba en celulares reales con etiquetas difíciles, antes de construir lo demás sobre él.
2. **Sesión:** login con `X-Canal: app`, CSRF, cookie persistente, pantalla del código 2FA y primer cambio de contraseña (`[S7]`).
3. **Abrir caja** (`[K2]`) y consultar su estado.
4. **Venta:** escáner, carrito, método de pago y fiado, con `Idempotency-Key`.
5. **Cierre de caja** (`[K3]`) con el arqueo.
6. **Después:** egresos (foto de **menos de ~750 KB**: comprimir antes de enviar), entrada de mercancía, alertas, solicitud de producto.

Cada paso se da por terminado cuando funciona contra los ejemplos simulados **y** contra el servidor de pruebas.

## 4. Riesgos que ya conocemos (con su fuente en el contrato)
- Solo la venta tiene idempotencia: **no reintentar a ciegas** egresos, entradas ni apertura o cierre de caja.
- La sesión caduca a los 30 minutos sin actividad y Render gratuito se duerme a los 15 minutos sin tráfico (~1 minuto para despertar).
- Los importes llegan como **texto** con dos decimales: usar un tipo decimal, no sumar texto.
- Desde el arranque del piloto no se puede desarrollar contra producción: hará falta un entorno aparte (ver la guía de entorno).
