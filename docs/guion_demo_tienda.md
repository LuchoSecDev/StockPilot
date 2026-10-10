# Guion de la tienda de demostración (visita al tendero)

**Qué es:** una tienda ficticia («Tienda Demo La Esperanza») con datos preparados para enseñarle al dueño lo que tendría si acepta usar StockPilot: alertas de stock y de vencimiento, pedidos listos para aprobar o enviar, recepción de mercancía, venta, fiado y caja. **Vive solo en el portátil del equipo** (base local `stockpilot_demo`), nunca en producción; no cuenta en las métricas del piloto (la tienda queda marcada como de prueba). Plan: `docs/planes/25_tienda_de_demostracion.md`.

**Duración:** unos 15 minutos. **Cuenta:** usuario `demo` (Administrador, modo básico); la clave es la que pongas en `DEMO_PASSWORD`. No hay cuenta de Tendero: la demostración es para el dueño.

**Cómo leer las marcas.** **[V]** = recorrido en el navegador el 9-oct-2026 con una base sembrada igual (rótulos copiados de la pantalla). **[API]** = comprobado por la prueba de integración (`tests/integration/demo_sembrado.test.js`) pero no recorrido en pantalla. **[?]** = no comprobado.

---

## 1. Preparación (una sola vez)

Requisitos: Node 22 o superior, PostgreSQL 16 o superior local, y `npm install` en la carpeta del proyecto y en `frontend/`.

1. Crear la base y su esquema (la siembra no crea las tablas base):
   ```bash
   psql -U postgres -c "CREATE DATABASE stockpilot_demo;"
   psql -U postgres -d stockpilot_demo -f database/init_pg.sql
   ```
2. Crear el archivo `.env.demo` en la raíz del proyecto (**no se sube al repositorio**: `.gitignore` ignora `.env.*`). Plantilla:
   ```
   DATABASE_URL=postgresql://USUARIO:CLAVE@localhost:5432/stockpilot_demo
   PORT=3000
   NODE_ENV=development
   SESSION_SECRET=un-texto-largo-y-aleatorio
   DEMO_PASSWORD="la clave de la cuenta demo (mínimo 8 caracteres)"
   DEMO_CORREO_PROVEEDOR=buzon-del-equipo@ejemplo.com
   # Solo si quieres ver salir el correo de verdad (si no, el envío falla y se usa el plan B):
   # RESEND_API_KEY=
   # EMAIL_USER=
   # EMAIL_PASS=
   ```
   - Si `DEMO_PASSWORD` lleva `#` o espacios, va **entre comillas dobles**: sin ellas, dotenv corta el valor en el `#` y la clave real no coincide.
   - `PORT=3000` es obligatorio: el frontend (Vite) reenvía las llamadas a `localhost:3000`.
   - **Lo que no definas aquí se toma de tu `.env` general** (dotenv no lo pisa pero sí lo completa). Para que la demostración no dependa de internet ni de servicios externos, deja vacías `OPENAI_API_KEY` y, si no quieres correo, `RESEND_API_KEY`, `EMAIL_USER` y `EMAIL_PASS`. **No definas `REQUIRE_ADMIN_2FA`**: con la política activa se bloquean las escrituras del Administrador sin 2FA.

## 2. Checklist del día de la visita (30 minutos antes)

Las fechas del escenario son relativas a **hoy**: hay que sembrar **el mismo día**. Un vencimiento «en 4 días» deja de serlo mañana.

1. `npm run demo:sembrar` → debe terminar con «Tienda de demostración lista (…, 12 alertas)». Vacía la base de demostración y vuelve a sembrar; **cierra todas las sesiones**.
2. Terminal 1 (backend): `npm run demo:servidor`. **No uses `npm run dev`**: ese lee tu `.env` general (otra base) y el usuario `demo` no existe ahí; es la causa del «contraseña incorrecta».
3. Terminal 2 (frontend): `cd frontend` y `npm run dev`; abrir `http://localhost:5173`.
4. Iniciar sesión (`demo` + `DEMO_PASSWORD`). Sale el aviso «¡ACCIÓN URGENTE!»: botón «Entendido». Aparece una vez por sesión.
5. Comprobar los números: **Vista General** «6 Productos en Estado Crítico»; **Monitor Alertas** Todas 12 · Críticas 6 · Advertencias 5 · Sobrestock 1; la campanita dice 12.
6. Probar el correo (solo si lo configuraste): `/proveedores` → orden aprobada → «Enviar Orden al Proveedor por Email» y confirmar que llega al buzón. **Después vuelve a sembrar** para dejar los datos como nuevos (enviar la orden la pasa a «Enviada»).
7. No dejes la caja abierta: el guion la abre en vivo. Si ensayaste ventas, vuelve a sembrar.

## 3. Guion (≈15 min)

| # | Min | Pantalla | Qué hacer (rótulos exactos) | Qué decir | Comprobado |
|---|---|---|---|---|---|
| 0 | 0-1 | — | Presentarse y avisar que los datos son de ejemplo | «Esta tienda es ficticia: nada de lo que veamos es suyo» | — |
| 1 | 1-2 | **Vista General** (`/dashboard`) | Mostrar «28 Productos», la tarjeta **Alertas 6 · URGENTE** («críticas (stock o vencimiento) · 12 alertas en total») y «6 Productos en Estado Crítico» | «De un vistazo: qué se le está acabando o se le va a vencer» | [V] |
| 2 | 2-4 | **Campanita** (arriba a la derecha) | Abrirla: **12 alertas**; cada una lleva una caja (stock) o un calendario (vencimiento); botón «Ingresar al Centro de Control de Alertas» | «Aunque esté en otra pantalla, la campanita le avisa» | [V] |
| 3 | 4-6 | **Monitor Alertas** (`/alertas`) | Tarjetas **Todas 12 · Críticas 6 · Advertencias 5 · Sobrestock 1**. Recorrer los separadores: «Stock crítico (4)» (Huevos: «quedan 1 días»), «Por vencer (7 días o menos) (2)» (Queso: «Vence en 6 días… te sobrarán ~10»), «Stock bajo (3)», «Próximas a vencer (8 a 30 días) (2)», «Sobrestock (1)» (Jabón de loza). Pulsar «Críticas» para ver solo esas | «Rojo: hágalo hoy. Amarillo: en la próxima compra. Azul: tiene plata quieta» | [V] |
| 4 | 6-9 | **¿Qué pido?** (`/pedir`) | «Por pedir»: Distribuidora La Sabana (Aceite, Arroz, Huevos) y Lácteos y Panadería del Norte (Leche). «Armar pedido» en La Sabana: **se suma al borrador que ya existía** (#2, ahora 6 productos). En «Pedidos por aprobar»: «Ver productos» → «Aprobar pedido» → «Sí, aprobar» (el texto dice que **no se envía nada al proveedor**). Pasa a «Por recibir» | «Usted solo revisa y aprueba; el sistema calcula cuánto» | [V] |
| 5 | 9-10 | **Proveedores** (`/proveedores`) | Historial de órdenes: la orden aprobada de Distribuidora La Sabana ($232.200) → «Revisar Pedido →» → «Detalle de Orden #1» → «✓ Orden aprobada — Lista para enviar» → «Enviar Orden al Proveedor por Email» | «Con un clic le llega al proveedor» (solo si el correo está configurado; si no, ver plan B) | [V] hasta el botón; el envío real [?] |
| 6 | 10-11 | **¿Qué pido?** → «Por recibir» | En el pedido de Lácteos y Panadería del Norte: «¿Llegó el pedido? Registrar». La tabla trae Producto / Pedido / Ya llegó / Llegó ahora (viene con lo pedido). Cambiar **Kumis a 9** (pedidos 12) → «Confirmar recepción» → el pedido queda **«Llegó una parte; falta el resto»** | «Si el proveedor le manda de menos, el sistema lo recuerda» | [V] |
| 7 | 11-13 | **Punto de Venta** (`/ventas`) | «Abrir Caja» → «Base de Caja Inicial» **40000** → «Abrir Turno» (el botón pasa a «Cerrar Turno (Caja Activa)»). Buscar «Coca» y pulsar el resultado → «Cobrar» → «Efectivo» → «Efectivo Recibido» **5000** → «Confirmar y Facturar» → «¡Éxito! Venta procesada exitosamente.» Se abre una pestaña «Ticket_Venta» (el recibo): ciérrala | «Vender exige abrir caja: así la plata cuadra al final del día» | [V] |
| 8 | 13-14 | **Cartera** (menú «Ver menú completo» → Cartera, `/cartera`) | «Total en la Calle **$43.300**»: Marta Rodríguez $28.100, Lucía Gómez $15.200, Jairo Pardo $0. Mostrar «Registrar Abono». **No pulses «Evaluar Riesgo IA»** (necesita IA, que no está en la demostración) | «Sabe quién le debe y cuánto, sin cuaderno» | [V] la lista; el abono en pantalla [API] |
| 9 | 14-15 | **Cierre de caja** (`/ventas`) | «Cerrar Turno (Caja Activa)» → «Efectivo Total en Cajón» (40000 + las ventas en efectivo) → «Ver Arqueo» → «Revisar Arqueo»: Fondo inicial + Ventas en efectivo + Abonos − Egresos = «Debería haber», «Tú contaste» y «Cuadra». Botones «Recontar» y «Confirmar cierre» | «El sistema le dice si falta o sobra plata» | [V] hasta «Revisar Arqueo» |
| 10 | 15 | — | Preguntas; la autorización de datos y la línea base van aparte (plan 22, sección 5) | — | — |

**Extras si sobra tiempo:** venta **fiada** (método «Fiado» pide elegir cliente) [API]; **«Egreso»** (gasto del turno, botón junto al buscador del POS) [?]; **«Historial Caja»**: la caja de ayer, cerrada, con una diferencia de $1.500 [API].

## 4. Plan B

| Si pasa… | Haz… |
|---|---|
| El login dice «incorrecto» | El servidor no es el de la demostración: detén `npm run dev` y arranca `npm run demo:servidor`. Si ya lo es, revisa `DEMO_PASSWORD` (¿lleva `#`? entre comillas) y vuelve a sembrar |
| Se bloquea el login por varios intentos fallidos | Espera unos minutos (se desbloquea solo) o reinicia `npm run demo:servidor` [? el reinicio no está comprobado] |
| El correo no sale (el botón de envío falla y la orden **queda «Aprobada»**, no se pierde nada) | Decir que el envío se prueba aparte y seguir; si necesitas el camino sin correo, usa el proveedor **Lácteos y Panadería del Norte** (no tiene correo): arma y aprueba el pedido de la Leche y ábrelo en `/proveedores`; el historial ofrece descargar el PDF y «Ya la envié: marcar como enviada» [? solo por código, no recorrido en pantalla] |
| No hay internet | Todo funciona (es local) salvo el correo |
| Algo quedó raro (ventas de ensayo, pedidos aprobados) | `npm run demo:sembrar` y volver a iniciar sesión (≈30 segundos) |
| El servidor no arranca | ¿Está encendido el servicio de PostgreSQL? ¿Existe `.env.demo` con `PORT=3000`? ¿La base se llama `…_demo`? |

## 5. Lo que no se enseña (y por qué)

- **«Evaluar Riesgo IA»** (Cartera) y el **Consejero IA** del dashboard: dependen de OpenAI; decisión D4 del plan 25.
- **«Mensaje para el proveedor (opcional)»** en el detalle de la orden: el servidor todavía **no lo envía** (P25-10). No lo uses en la demostración.
- **La lista «Por pedir»** de `/pedir` vuelve a sugerir productos que ya están en un pedido aprobado y esperando la mercancía (no descuenta lo que viene en camino). Es normal en esta versión (P25-09); si el tendero lo nota: «esa lista todavía no descuenta lo que ya pidió».
- En `/pedir`, el pedido **aprobado** y el **enviado** se ven igual («Aprobado, esperando la mercancía»); el envío por correo está en `/proveedores`.
- El aviso amarillo «Activa la verificación en 2 pasos (recomendado)» es del producto real; se puede ignorar o explicar. No actives el 2FA en la cuenta demo.

## 6. Después de la visita

Vuelve a sembrar antes de la siguiente visita. La base de demostración no se usa para las métricas del piloto. Para borrarla por completo: `DROP DATABASE stockpilot_demo;` y repetir la sección 1.

## 7. Qué falta comprobar de este guion

- **Ensayo cronometrado** por una persona que no lo escribió (criterio de salida de la fase 2 del plan 25): sin hacer.
- **Correo real** al buzón del equipo y el recorrido desde un **celular**: sin hacer.
- Los pasos marcados [API] y [?].
