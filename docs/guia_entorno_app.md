# Guía de entorno para construir la app del Tendero

**Para quién:** Luis y los compañeros que construyen la app Flutter. Su repositorio es aparte: <https://github.com/luchoTeso/AppNativaFlutter> (público, vacío al 4-oct-2026). **No subas ahí contraseñas, cookies, claves ni la URL de un entorno con datos reales**; la URL del servidor de pruebas va en un archivo de configuración fuera del control de versiones.
**Qué contiene:** contra qué backend desarrollar, qué cuentas usar, cómo levantar el backend en local y qué reglas no se pueden romper. La referencia de la API es `docs/contrato_api_app_tendero.md`: léelo primero, cada endpoint tiene una prueba que lo respalda. Para ver cada llamada completa y simular el servidor en tus pruebas, usa los ejemplos de `docs/ejemplos_app_tendero/`. Las decisiones técnicas mínimas para empezar el proyecto Flutter están en `docs/propuesta_tecnica_app_flutter.md`.

> **Punto de partida para construir la app: `docs/guia_construccion_app.md`** (qué leer, orden de construcción y cuándo se da cada paso por terminado).

> Estado de esta guía (4-oct-2026): lo marcado **VERIFICADO** se comprobó contra el servidor real; lo marcado **SIN VERIFICAR** se dedujo leyendo el código y no se ha probado en una máquina limpia.

---

## 1. Contra qué backend desarrollar

### Ahora (todavía no hay tiendas reales): el servidor desplegado
Todas las tiendas que existen hoy en producción son de prueba, así que el equipo puede desarrollar contra `https://stockpilot-qg0s.onrender.com`. **VERIFICADO** (4-oct-2026): responde, `GET /api/csrf-token` da 200 y el login con la cabecera `X-Canal: app` funciona con una cuenta de Tendero.

- Pide a Luis una cuenta de **Tendero de prueba** (usuario y contraseña); no se escriben en este repositorio.
- El plan gratuito de Render se **duerme tras 15 minutos** sin tráfico y la primera petición tarda cerca de un minuto. Usa un tiempo de espera de al menos 60 s en esa primera petición y muestra «conectando…».
- No hay entorno de pruebas separado: lo que se registre en las tiendas de prueba queda en la base compartida. No uses cuentas ni datos de una tienda real.

### Cuando arranque el piloto: ya NO
Desde el arranque del piloto (plan 22, sección 5, bloque D) producción se congela y tendrá tiendas reales. A partir de ahí desarrollar contra ella ensuciaría los arqueos y los indicadores del piloto. **Antes de ese día hace falta un entorno aparte** (el backend en local, o un servicio de pruebas con su propia base). Hay que decidirlo antes del arranque; hasta entonces, usar lo de la sección 2 es la forma de practicar.

---

## 2. Levantar el backend en local (SIN VERIFICAR en una máquina limpia)

**Requisitos:** Node 22 o superior (`engines` de `package.json`), PostgreSQL 16 o superior (el de producción es 18) y Git.

1. Clona el repositorio e instala: `npm install`.
2. Crea la base y el esquema:
   ```bash
   psql -U postgres -c "CREATE DATABASE stockpilot;"
   psql -U postgres -d stockpilot -f database/init_pg.sql
   ```
3. Crea un archivo `.env` (no se versiona) a partir de `.env.example`. Variables que importan:

   | Variable | Para qué |
   |---|---|
   | `DATABASE_URL` | Conexión a tu Postgres local. |
   | `SESSION_SECRET` | **Obligatoria**: sin ella el servidor se detiene al arrancar. Cualquier texto largo en local. |
   | `NODE_ENV` | `development` en local. |
   | `PORT` | Por defecto **3001** (el README y el contrato dicen 3000: ajusta `PORT` o la URL de la app). |
   | `OPENAI_API_KEY`, `RESEND_API_KEY` | Opcionales: sin ellas arranca, solo quedan apagados la IA y los correos. |

4. Arranca: `npm start` (o `npm run dev` con recarga).
5. Datos de ejemplo: `npm run seed -- --base-local`. **Cuidado:** vacía las tablas de la base a la que apunte. Tiene una guardia que solo corre contra `localhost` y exige el flag `--base-local` (o que la base se llame `*_test`); no hay ninguna ruta HTTP que siembre. Crea una tienda con productos y **un Administrador**, pero **ningún Tendero**.
6. Para tener un Tendero: lo crea el Administrador (crear colaboradores es una función del Administrador según la sección 10 del contrato; la pantalla exacta no se verificó). El ejemplo de cómo crearlo por código está en `crearUsuario` de `tests/integration/helpers/fixtures.js`. Un Tendero nuevo nace con contraseña temporal (`cambioClaveForzoso: true`), y la app debe mostrar la pantalla de «elige tu contraseña» (`[S7]` del contrato).

La base de las pruebas automáticas es otra (`stockpilot_test`, con su `.env.test`): no la uses para desarrollar la app.

---

## 3. Reglas de la API que más se olvidan (resumen; la verdad está en el contrato)

- **Siempre** `Accept: application/json`. Sin ella, una petición sin sesión recibe un 302 en HTML en vez de un 401.
- Login con **`X-Canal: app`** (solo en el login). Después, el token CSRF se pide **tras** el login (`GET /api/csrf-token`) y va en `X-CSRF-Token` en toda escritura.
- Cookie `connect.sid` **persistente** (en Flutter, un almacén de cookies que sobreviva al cierre de la app). Caduca a los 30 minutos sin actividad y se renueva con cada petición. Maneja el 401 a mitad de una venta **sin perder el carrito**.
- **Una venta, una clave:** manda `Idempotency-Key` (UUID nuevo por venta, el mismo en los reintentos). Ver `[V2]`. El resto de escrituras no tienen idempotencia: no las reintentes a ciegas.
- `metodo_pago` solo admite `Efectivo`, `Tarjeta`, `Transferencia` o `Fiado`, con esa escritura exacta.
- El tope de egresos y demás datos de la tienda salen de `GET /api/session-info`; no los fijes en la app.
- Importes como **texto** con dos decimales: conviértelos con un tipo decimal, no sumes texto.

## 4. Cambiar la API
Cualquier cambio que afecte a la app se acuerda en el contrato primero y se cambia en un solo commit: código, prueba de `tests/integration/contrato_app_tendero.test.js` y documento (sección 12 del contrato).

## 5. Pendientes que dependen de la app
- **El escáner no está probado.** Hace falta una prueba de aceptación con etiquetas difíciles en celulares reales (`mobile_scanner` usa ML Kit en Android y Apple Vision en iOS). Conviene construirlo y probarlo primero.
- Verificar en celular real con la app: cookie persistente tras cerrar la app, sesión de 30 minutos con renovación, y reconexión después del sueño de Render.
