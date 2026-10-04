# Guía de construcción de la app del Tendero

**Para quién:** el equipo que construye la app Flutter (`https://github.com/luchoTeso/AppNativaFlutter`).
**Qué es esto:** el punto de partida. Dice **por dónde empezar, en qué orden construir y cuándo se da cada paso por terminado**. No repite el detalle: lo remite a los documentos que lo contienen.
**Estado:** 4-oct-2026. Lo marcado **SIN VERIFICAR** hay que comprobarlo al construir.

## 1. Qué leer, y en qué orden
1. `docs/guia_entorno_app.md`: contra qué servidor desarrollar, cuentas de prueba y reglas que más se olvidan.
2. `docs/contrato_api_app_tendero.md`: la referencia de la API. Cada endpoint tiene un ID (`[S2]`, `[V2]`…) y una prueba que lo respalda.
3. `docs/propuesta_tecnica_app_flutter.md`: las decisiones técnicas ya tomadas y sus porqués.
4. `docs/ejemplos_app_tendero/`: **cada llamada real, con petición y respuesta.** Se usan para entender la API y para simular el servidor en las pruebas.

## 2. Lo que ya está decidido (no se reabre sin hablarlo)
- **Identificador:** `com.lem.stockpilot` (`lem` son las iniciales del equipo fundador; se escribe `stockpilot`, con k).
- **Estado:** `flutter_riverpod`, siguiendo su documentación oficial. Los widgets nunca llaman al servidor directamente.
- **Sesión:** `dio` con `dio_cookie_manager` y `PersistCookieJar` (`cookie_jar`), guardando en un directorio de `path_provider`.
- **Escáner:** `mobile_scanner`.
- **Android primero.** El APK lo firma Luis, que custodia la llave; los demás compilan con su llave de depuración.
- **Repositorio público:** nada de contraseñas, claves, cookies ni la URL del servidor en el código (usar `--dart-define` o un archivo ignorado por Git).

## 3. Los pasos, en orden
Cada paso termina cuando se cumple su «Listo cuando». Prueben primero contra los ejemplos simulados y después contra el servidor de pruebas.

### Paso 0 · Crear el proyecto
- `flutter create --org com.lem --project-name stockpilot app_tendero`. Revisa que el `applicationId` quede `com.lem.stockpilot` (en `android/app/build.gradle.kts`).
- Agrega a `.gitignore`: `*.jks`, `android/key.properties` y el archivo de configuración local.
- Dependencias: `dio`, `dio_cookie_manager`, `cookie_jar`, `path_provider`, `flutter_riverpod`, `mobile_scanner` y un paquete de almacenamiento local para el carrito (por ejemplo `shared_preferences`).
- **Listo cuando:** la app compila, abre en un celular y logra `GET /api/csrf-token` con respuesta 200.

### Paso 1 · El escáner, como prueba aparte
Es el mayor riesgo del proyecto: se resuelve **antes** de construir lo demás sobre él.
- Una pantalla que escanea y muestra el código leído. Formatos: EAN-13, EAN-8, UPC-A, Code 128 y QR. Ajusten `formats`, `detectionSpeed` y la linterna.
- Prueben en **celulares reales** con etiquetas difíciles: pequeñas, curvas, arrugadas, con brillo o con poca luz.
- La versión mínima de Android que exige `mobile_scanner` no está en su documentación (SIN VERIFICAR): se averigua al compilar.
- **Listo cuando:** el equipo define un criterio (por ejemplo, cuántas etiquetas de un lote real se leen y en cuánto tiempo), lo anota y se cumple en al menos dos celulares distintos.

### Paso 2 · Cliente HTTP y sesión
- Un **solo interceptor** aplica: `Accept: application/json` en todo; `X-CSRF-Token` en toda escritura; ante `403` con `code: CSRF_INVALID`, pedir otro token y reintentar **una vez**; ante `401`, volver al login **sin perder el carrito**; tiempo de espera de 60 s o más en la primera petición («conectando…», porque Render se duerme).
- Flujo: `POST /api/login` con `X-Canal: app` → `GET /api/csrf-token` (**después** del login) → si responde `require2FA`, `POST /api/2fa/verify` → `GET /api/session-info`. Si `cambioClaveForzoso` es `true`, pantalla de «elige tu contraseña» (`[S7]`) antes de dejar operar.
- Un `409 SESSION_ACTIVE` ofrece «cerrar la otra sesión» y repetir el login con `"force": true`.
- Endpoints: `[S1]` a `[S7]`. Ejemplos: `01` a `06`, `40` a `44`, `50` y `51`.
- **Listo cuando:** el login sobrevive a cerrar la app (dentro de los 30 minutos de la sesión), el 401 lleva al login, el 2FA y el primer cambio de contraseña funcionan, y el 409 ofrece cerrar la otra sesión.

### Paso 3 · Caja
- `[K1]` estado de la caja y `[K2]` abrir. Ejemplos `07`, `09` y `10`.
- **Listo cuando:** se puede abrir la caja y ver su estado, y la app no deja vender si no hay una abierta.

### Paso 4 · Venta
- Escanear (`[C2]`) y, si no se encuentra, **búsqueda manual por nombre** sobre la lista de `[C1]` (se filtra en el celular). Un código comercial desconocido se puede **vincular** al producto elegido (`[C3]`). Un producto sin código comercial puede llevar una etiqueta propia con su `codigo`: el escáner lo encuentra igual.
- Carrito guardado en el celular. Clientes (`[V1]`) para el fiado. Cobro con `[V2]`.
- **Una venta, un UUID** como `Idempotency-Key`, el mismo en todos los reintentos de esa venta.
- `metodo_pago` solo admite `Efectivo`, `Tarjeta`, `Transferencia` o `Fiado`, con esa escritura exacta. Las cantidades son **enteras**. Los importes llegan como **texto** con dos decimales: usen un tipo decimal.
- Ejemplos: `11` a `22`.
- **Listo cuando:** se vende con cada método; cortar la red a mitad y reintentar devuelve la **misma** venta (`Idempotent-Replayed: true`) sin duplicar; los errores 400 y 404 se muestran bien; el fiado respeta el cupo; y un 401 en medio de una venta no pierde el carrito.

### Paso 5 · Cierre de caja
- `[K3]` con el arqueo y `[V3]` con las ventas del turno (`?turno=actual`). Ejemplos `23` y `27`.
- **Listo cuando:** el Tendero declara lo contado, ve la diferencia y la caja queda cerrada.

### Paso 6 · Después de lo anterior
Egresos `[K4]` (la foto debe pesar **menos de ~750 KB**: comprimirla antes), entrada de mercancía `[M1]`, alertas `[A1]` y `[A2]`, y la solicitud de producto `[O1]`.

## 4. Reglas que no se rompen
- **No reintentar a ciegas** egresos, entradas ni apertura o cierre de caja: solo la venta tiene idempotencia.
- Los datos de la tienda (como el tope de egresos) salen de `GET /api/session-info`; no se fijan en la app.
- La app ayuda al usuario a validar, pero **las reglas las decide el servidor**: muestra siempre lo que este responde.
- Ante un 500, una lectura se puede reintentar; una escritura, solo tras comprobar su estado (excepto la venta con su clave).

## 5. Si algo del servidor no sirve
Se avisa a Luis. **Los cambios de la API se acuerdan primero en el contrato** y se cambian juntos código, prueba y documento (sección 12 del contrato). No se contornean en la app.

## 6. Lo que NO está en la primera versión
Crear o editar productos, proveedores, reportes, cartera y abonos, y usuarios: son del Administrador en la web. Tampoco hay venta por peso ni fracciones, ni verificación del pago de tarjeta o transferencia (ver `docs/propuesta_verificacion_de_pagos.md`).
