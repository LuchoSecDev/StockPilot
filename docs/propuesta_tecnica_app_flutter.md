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
| **Estado de la app** | **Decidido (4-oct-2026): `flutter_riverpod`** (3.4.3, VERIFICADO que existe y sigue vigente). Ninguno de los tres integrantes del equipo fundador conoce otra solución de estado, así que se adopta la sugerida. **Reglas:** no mezclar con otra solución; seguir la **documentación oficial** (riverpod.dev) y no tutoriales viejos, porque hay material de versiones anteriores con otra sintaxis; los widgets **nunca** llaman al servidor directamente: lo hace una capa de datos y los widgets solo leen el estado. | Separa la lógica de las pantallas y facilita probarla con los ejemplos de respuesta. Un equipo que reparte el trabajo necesita una sola forma de hacer las cosas. | `provider` o `bloc`, si en el futuro alguien del equipo ya los domina (cambiar a mitad del proyecto cuesta). |
| **Escáner** | `mobile_scanner` 7.4.2 (VERIFICADO: CameraX y ML Kit en Android, AVFoundation y Apple Vision en iPhone; EAN-13, EAN-8, UPC-A, Code 128 y QR). Restringir `formats` a los de las tiendas y ajustar `detectionSpeed` y linterna. | Es la base del `ai_barcode_scanner` que sugería el plan 07: usarla directa quita una capa. | `ai_barcode_scanner` (SIN VERIFICAR). |
| **ML Kit empaquetado o no** | Sugerencia: **empaquetado** (+3 a 10 MB de app). El no empaquetado suma ~600 KB pero descarga el modelo por Google Play Services. VERIFICADO en la ficha del paquete. | Las tiendas pueden tener mala conexión y el escáner no debe depender de una descarga. (Razonamiento mío, INFERRED.) | No empaquetado, si el tamaño del APK importa más. |
| **Versión mínima de Android** | **SIN VERIFICAR**: la documentación de `mobile_scanner` no la indica. Se averigua al compilar. | — | — |
| **Carrito** | Guardarlo en almacenamiento local mientras se arma. | Plan 07: «no perder el carrito si falla la red». También cubre el 401 por sesión caducada. | — |
| **Configuración** | La URL del servidor en configuración **fuera del repositorio** (`--dart-define` o un archivo ignorado en `.gitignore`). Nada de contraseñas, claves ni cookies en el código. | El repositorio de la app es público. | — |
| **Plataforma y entrega** | Solo Android al inicio, APK firmado (plan 07, 6.3). La llave de firma **fuera del repositorio**. **Custodia: Luis (decidido el 4-oct-2026).** Las contraseñas y la ruta de la llave no se escriben en ningún documento del repositorio. | Una app firmada con otra llave no puede actualizar a la ya instalada (comportamiento estándar de Android, no verificado aquí): perderla obliga a desinstalar en cada celular. | — |
| **Identificador del paquete** (`applicationId`) | **Decidido (4-oct-2026): `com.lem.stockpilot`.** Ver la nota debajo de la tabla. | Cambiarlo después equivale a publicar otra app. | — |

### Por qué `com.lem.stockpilot`
**`lem` son las iniciales del equipo fundador** (decisión de Luis, 4-oct-2026). Si el proyecto pasa a otras personas, esas letras se quedan así a propósito: son la huella de quienes lo empezaron, y **no se cambian**. El identificador no lo ve el usuario final (ve el nombre de la app); sirve para que Android y Google Play reconozcan la app.
- Cumple las reglas de Android (VERIFICADO en su documentación): al menos dos segmentos, cada uno empieza con una letra y solo lleva letras, números o guion bajo.
- **Se escribe `stockpilot`, con k.** Una vez publicada la app el identificador no se cambia: Google Play la trataría como otra app distinta.
- Al crear el proyecto: `flutter create --org com.lem --project-name stockpilot app_tendero`. Debería dar `com.lem.stockpilot` (INFERRED: es el comportamiento habitual de `flutter create`, no se probó aquí). Si se corrige a mano, es `applicationId` en `android/app/build.gradle.kts`, y conviene mantener `namespace` igual.
- La disponibilidad en Google Play solo se comprueba al subir la app por primera vez; el APK por instalación directa no la necesita.

## 3. Orden de construcción (corte vertical)

1. **Escáner, como prueba aparte desde el primer día.** Es el mayor riesgo (plan 22): se prueba en celulares reales con etiquetas difíciles, antes de construir lo demás sobre él.
2. **Sesión:** login con `X-Canal: app`, CSRF, cookie persistente, pantalla del código 2FA y primer cambio de contraseña (`[S7]`).
3. **Abrir caja** (`[K2]`) y consultar su estado.
4. **Venta:** escáner, **búsqueda manual por nombre** (ver la sección «Productos sin código de barras»), carrito, método de pago y fiado, con `Idempotency-Key`.
5. **Cierre de caja** (`[K3]`) con el arqueo.
6. **Después:** egresos (foto de **menos de ~750 KB**: comprimir antes de enviar), entrada de mercancía, alertas, solicitud de producto.

Cada paso se da por terminado cuando funciona contra los ejemplos simulados **y** contra el servidor de pruebas.

## Productos sin código de barras
Muchos productos (en una papelería, casi todos los sueltos) no traen código comercial. Cómo se resuelve con lo que ya existe:
1. **El escáner también encuentra por `codigo`** (el código interno o SKU del producto): VERIFICADO leyendo `Product.findByBarcode`, y fijado con una prueba (`[C2]`). Un producto sin código comercial puede llevar una **etiqueta propia** impresa con su `codigo` (Code 128 o QR).
2. **Código comercial que el sistema aún no conoce** (`[C2]` responde 404): la app ofrece buscar el producto por nombre y, una vez elegido, **vincularle ese código** (`[C3]`) para que la próxima vez lo reconozca. Es lo que el plan 07 prevé para el arranque: «al principio muchos productos no tendrán el código asociado».
3. **Búsqueda manual por nombre:** la lista de `[C1]` llega completa (sin paginación) y se filtra en el celular. Es imprescindible desde la primera versión de la venta, no un extra. SIN VERIFICAR el rendimiento con un catálogo muy grande.
4. **El producto tiene que existir en el catálogo.** Crearlo es del Administrador (decisión D1): el Tendero no crea productos desde la app.

**Límite que hay que conocer:** el stock y las cantidades vendidas son **números enteros** (VERIFICADO en el esquema: `Productos.cantidad` y `VentasProductos.cantidad` son `INTEGER`). No se puede vender por peso ni por fracciones (media libra, medio metro). Cómo venden esos productos las tiendas del piloto es una pregunta para la visita (por ejemplo, venderlos por unidades de un tamaño fijo); la primera versión de la app asume unidades enteras.

## 4. Riesgos que ya conocemos (con su fuente en el contrato)
- Solo la venta tiene idempotencia: **no reintentar a ciegas** egresos, entradas ni apertura o cierre de caja.
- La sesión caduca a los 30 minutos sin actividad y Render gratuito se duerme a los 15 minutos sin tráfico (~1 minuto para despertar).
- Los importes llegan como **texto** con dos decimales: usar un tipo decimal, no sumar texto.
- Desde el arranque del piloto no se puede desarrollar contra producción: hará falta un entorno aparte (ver la guía de entorno).
