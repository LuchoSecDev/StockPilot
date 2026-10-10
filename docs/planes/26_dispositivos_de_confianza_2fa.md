# Plan 26: Dispositivos de confianza para el segundo factor (2FA)

**Estado (10-oct-2026):** **propuesta, sin implementar.** Toca autenticación y esquema de la base: es de alto riesgo y no se empieza sin la aprobación de Luis (sección 4). Rama de esta propuesta: `docs/plan-26-dispositivos-de-confianza`.
**Fecha:** 2026-10-10
**Origen:** Luis preguntó (10-oct) si el 2FA se podía saltar al entrar desde la misma IP, «como Google, que solo pide el segundo método si se inicia sesión desde otro dispositivo». Después de la evaluación (sección 3) pidió dejarlo como propuesta, con estas condiciones: **(1)** que la cookie no se pueda capturar para entrar sin contraseña; **(2)** que cualquier cambio de seguridad priorice las posibles vulnerabilidades; **(3)** duración **máxima de 15 días**; **(4)** que se vuelva a pedir el segundo factor si se detecta un inicio de sesión en otro dispositivo.
**Relacionado con:** plan 21 (decisión del 8-oct: el 2FA se informa pero no se exige durante el piloto; P21-26, códigos de recuperación), `docs/Protocolo_Produccion.md` sección 5, plan 22 (el panel interno `/interno` tiene su propio 2FA, siempre obligatorio), `docs/contrato_api_app_tendero.md` (sesión por canal, `X-Canal: app`).

**Marcas de evidencia:** **[V]** = lo leí en el código; **[?]** = supuesto que hay que comprobar antes de implementar.

---

## 1. Qué se propone, en una frase

Después de un código 2FA correcto, la persona puede marcar «Confiar en este dispositivo (máx. 15 días)». El servidor le entrega una cookie que **no es una sesión ni una credencial**: solo sustituye el paso del código en un inicio de sesión **que sigue exigiendo la contraseña correcta**. Desde un dispositivo sin esa cookie (o con una inválida, vencida o revocada), el código se pide siempre.

**Por qué dispositivo y no IP.** Saltar el 2FA por IP debilita justo lo que protege: quien conozca la contraseña y comparta red con la víctima (la tienda, un café, la IP compartida de un proveedor móvil) no vería el segundo factor; y las IP móviles cambian. La IP sirve como dato de auditoría y, como mucho, como señal para **pedir** el código de nuevo, nunca para saltarlo.

## 2. Hallazgos: cómo está hoy (evidencia)

- **Login** (`controllers/authController.js:14`): `User.findByCredentials` valida la contraseña; si el usuario tiene 2FA activo, guarda `pending2FA_*` en la sesión y responde `require2FA: true`; el código se verifica en `verify2FA` (`:532`), que completa el login y llama a `User.setCurrentSession` [V].
- **Cookie de sesión** (`app.js:136-146`): `httpOnly: true`, `secure` en producción, `sameSite: 'strict'`, 30 minutos con renovación por actividad [V]. **`trust proxy` está en 1** (`app.js:52`) [V]: la IP que ve el servidor depende de Render.
- **CSRF** (`app.js:153-162`): `csrf-sync` con token en cabecera; el login es una ruta exenta, por eso la cookie nueva debe ser `SameSite=Strict` [V].
- **Límites** (`middleware/rateLimiter.js`): `authLimiter` (10 intentos fallidos / 15 min por IP) y `twoFactorLimiter` (5 fallidos / 15 min por usuario o IP) [V]. El camino de confianza debe seguir contando los fallos de contraseña.
- **Cambios de contraseña** (tres rutas que llaman a `User.updatePassword`, `models/User.js:115`): `changePassword` (`authController.js:358`), primera contraseña (`:391`) y restablecer por código (`:474`) [V]. Son los puntos donde hay que **revocar** los dispositivos.
- **Desactivar el 2FA** (`User.disable2FA`, `models/User.js:202`): vacía el secreto; el Administrador no puede (403) [V]. También debe revocar.
- **Panel interno** (`/interno`): su 2FA es siempre obligatorio y tiene limitadores propios (`internoLoginLimiter`, `internoSegundoFactorLimiter`) [V]. **Queda fuera** de esta propuesta, sin excepción.
- **Política:** `REQUIRE_ADMIN_2FA` está apagada y faltan los códigos de recuperación (P21-26) [V, Protocolo sección 5]. Mientras el 2FA sea voluntario, el beneficio de esta mejora es de comodidad para quien ya lo activó.

## 3. Modelo de amenazas (en orden de prioridad)

| # | Amenaza | Defensa del diseño | Cómo se prueba |
|---|---|---|---|
| 1 | **Entrar sin contraseña con la cookie** (la preocupación principal) | La cookie nunca autentica: el login evalúa **primero** la contraseña (`findByCredentials`); la cookie solo se consulta después, para decidir si pide o no el código | Con una cookie válida y contraseña incorrecta o ausente: 401 y **ninguna** sesión creada |
| 2 | **Robo de la cookie por XSS** | `HttpOnly` (JavaScript no la lee); además la política de contenido ya existente | Prueba de cabeceras: `Set-Cookie` lleva `HttpOnly`, `SameSite=Strict`, `Secure` en producción |
| 3 | **Robo de la cookie por red o disco** | `Secure` (solo HTTPS) y vida máxima de 15 días; una cookie robada **sin la contraseña no sirve** (amenaza 1) | Cookie vencida (15 días + 1 s) no salta el 2FA |
| 4 | **Filtración de la base de datos** | En la base se guarda **solo el hash SHA-256** del token (256 bits aleatorios con `crypto.randomBytes`); el valor de la cookie nunca se guarda | Revisar que la tabla no contiene el token; comparar con `timingSafeEqual` |
| 5 | **Reutilización (replay) de una cookie robada** | **Rotación en cada uso:** cada inicio con un dispositivo de confianza emite un token nuevo y el anterior deja de valer; la vigencia total **no se extiende** (tope absoluto de 15 días desde el 2FA que la concedió). **Detección de reutilización:** si llega un token ya rotado, se **revocan todos los dispositivos** de ese usuario, se pide el código y se deja un registro | Presentar dos veces el mismo token: la segunda revoca todo |
| 6 | **Otro dispositivo** (requisito de Luis) | Sin cookie válida de **ese** usuario, se pide el código; no hay forma de «heredar» la confianza. Opcional: aviso por correo «nuevo inicio de sesión desde otro dispositivo» | Mismo usuario sin cookie: 2FA; cookie de **otro usuario**: 2FA |
| 7 | **Cookie de otro usuario** (confusión de cuentas) | El registro guarda `id_usuario`; se valida que coincida con quien acaba de pasar la contraseña | Cookie de A usada con la contraseña de B: 2FA |
| 8 | **Computador compartido** (tendero con tablet de la tienda) | La casilla viene **desmarcada** por defecto y dice «solo en tu dispositivo personal»; cualquier dispositivo se revoca desde «Mi perfil» | Prueba de interfaz manual |
| 9 | **Cambio de contraseña o de 2FA** | Revoca todos los dispositivos del usuario (las tres rutas de la sección 2, `disable2FA` y el procedimiento de soporte del Protocolo) | Tras cambiar la contraseña, la cookie vieja pide 2FA |
| 10 | **Oráculo** (averiguar si una cookie existe) | Una cookie inválida, vencida o revocada se comporta **igual** que ninguna cookie: el siguiente paso es pedir el código, sin mensaje distinto | Mismas respuestas en los tres casos |
| 11 | **Fuerza bruta de la cookie** | 256 bits; búsqueda por identificador + comparación del hash | — |
| 12 | **Fijación de sesión** | Se mantiene el `req.session.regenerate` actual del login | Prueba existente de login |
| 13 | **Datos personales** (IP y navegador guardados) | Guardar solo lo necesario (resumen del navegador, IP de creación), borrar los vencidos, y **actualizar la política de datos** (Ley 1581) | Revisión de la política antes de publicar |

**Señal adicional (opcional, decisión D5):** si el resumen del navegador (`User-Agent`) no coincide con el del dispositivo registrado, se pide el código. Es una señal débil (se puede falsificar), útil solo como defensa en profundidad.

## 4. Decisiones

**Ya decididas por Luis (10-oct):** duración **máxima 15 días**; si se inicia sesión desde otro dispositivo, **se pide el segundo factor**; las vulnerabilidades tienen prioridad sobre la comodidad.

**Pendientes (no empezar una fase que dependa de ellas):**

| ID | Decisión | Recomendación |
|---|---|---|
| D1 | ¿Qué roles pueden usarlo? | Administrador y Tendero que ya tengan 2FA activo; el panel interno **no** |
| D2 | ¿Se incluye el canal de la app (`X-Canal: app`)? | **No en la primera fase:** cambia el contrato de la app (cookie persistente y su almacenamiento); se evalúa después con el equipo de la app |
| D3 | ¿Cuántos dispositivos de confianza por usuario? | Máximo **3**; el cuarto reemplaza al más antiguo |
| D4 | ¿Aviso por correo al iniciar desde un dispositivo nuevo? | **Sí** (Resend ya está configurado); cuidado con el destinatario real en pruebas |
| D5 | ¿Pedir el código también si cambia el navegador (señal débil)? | Sí, como defensa en profundidad |
| D6 | ¿Cerrar sesión «olvida» el dispositivo? | **No:** cerrar sesión deja la confianza; «Olvidar este dispositivo» es una acción aparte en «Mi perfil» |
| D7 | ¿Cuándo? | **Después del piloto**, junto con los códigos de recuperación (P21-26) y la política `REQUIRE_ADMIN_2FA`; durante las 6 semanas solo se despliegan correcciones (plan 22, sección 5) |

## 5. Fases (cuando se apruebe)

Cada fase se aprueba por separado. **Regla de todo el plan:** pruebas primero; mutación de cada defensa de la sección 3; ejecutar `/security-review` al terminar la fase 3.

### Fase 1: almacenamiento y reglas puras (sin tocar el login)
- **Archivos nuevos:** `config/migraciones/dispositivosConfianza.js` (tabla `dispositivos_confianza`: `id`, `id_usuario` con `ON DELETE CASCADE`, `token_hash`, `token_anterior_hash`, `ua_hash`, `ua_resumen`, `ip_creacion`, `creado_en`, `expira_en`, `ultimo_uso`, `revocado_en`, `motivo`), `services/seguridad/dispositivosConfianza.js` (crear, validar, rotar, revocar, detectar reutilización) y sus pruebas. Se agrega la tabla a `tests/integration/helpers/db.js`.
- **Migración:** aditiva e idempotente, con el patrón de `config/migraciones/panelInterno.js` (sondear antes de `ALTER`, una transacción, sin bloqueos largos); aplicar la skill `safe-migrations`.
- **No tocar:** `authController`, `app.js`, el panel interno.
- **Salida:** pruebas de las defensas 4, 5, 7 y 10 en verde; mutaciones (guardar el token en claro, no rotar, no validar el usuario) detectadas.

### Fase 2: integración con el login
- Tocar `authController.login` y `verify2FA`: la cookie se evalúa **después** de la contraseña; la casilla «Confiar en este dispositivo» viaja en `verify2FA`; la cookie lleva `HttpOnly; Secure (producción); SameSite=Strict; Path=/api; Max-Age ≤ 15 días` (en producción, prefijo `__Host-` si el hospedaje lo permite [?]).
- **Prueba obligatoria de la amenaza 1:** cookie válida + contraseña mala = 401 sin sesión; y que `authLimiter` siga contando el intento.
- **Parar y preguntar** si hace falta cambiar el contrato de la app o el orden de `findByCredentials`.

### Fase 3: revocación, lista en «Mi perfil» y avisos
- Revocar en las tres rutas de contraseña y en `disable2FA`; endpoints para listar y olvidar dispositivos (con CSRF); aviso por correo de dispositivo nuevo (D4); texto en la política de datos; sección en el Protocolo (soporte: revocar todos con una sentencia SQL).
- Salida: `/security-review` sin hallazgos abiertos de severidad alta.

## 6. Despliegue y reversión
- **Migración aditiva:** la tabla nueva no afecta a lo existente; si se apaga la función (variable de entorno `DISPOSITIVOS_CONFIANZA=false`, a definir en la fase 2), el login vuelve a pedir siempre el código.
- **Reversión:** revertir el commit y, si se quiere, `DROP TABLE dispositivos_confianza`; las cookies que queden en los navegadores dejan de valer solas (no hay registro que las respalde).
- **Antes de desplegar:** copia de seguridad (`docs/restaurar_respaldo.md`) y aviso al equipo de la app si se tocó el contrato.

## 7. Filas para el seguimiento (a agregar al consolidar `docs/seguimiento_planes.xlsx`)

| ID | Pendiente | Tipo | Prioridad |
|---|---|---|---|
| P26-01 | Decisiones D1 a D7 del plan 26 (roles, canal de la app, número de dispositivos, aviso por correo, señal del navegador, cerrar sesión, fecha) | Decisión pendiente | Media |
| P26-02 | Fase 1: tabla `dispositivos_confianza` y reglas puras con pruebas | Trabajo futuro | Media |
| P26-03 | Fase 2: integrar con `login` y `verify2FA` (la cookie nunca sustituye la contraseña) | Trabajo futuro | Media |
| P26-04 | Fase 3: revocación, lista en «Mi perfil», aviso por correo, política de datos y `/security-review` | Trabajo futuro | Media |

*No se agregaron al xlsx en esta rama para no crear versiones divergentes de un archivo binario entre ramas; se añaden al consolidar.*

---

## Entrega al ejecutor

- **Fase a hacer ahora:** ninguna. Esperar la aprobación de Luis y las decisiones D1 a D7.
- **Rama (cuando se apruebe):** `feat/dispositivos-confianza`, desde `main`; antes, `git status`.
- **Primer comando (fase 1):** escribir la prueba de `services/seguridad/dispositivosConfianza.js` y verla fallar con `npx vitest run tests/business_logic/dispositivos_confianza.test.js`.
- **Parar y preguntar:** si se quiere guardar el token en claro «por simplicidad»; si hay que relajar `SameSite`; si se propone usar la IP para **saltar** el 2FA; si la fase toca el panel interno; antes de cualquier cambio de esquema en producción.
- **No hacer** commit sin que se pida, ni push sin aprobación aparte.
