# Plan 19: Requisitos de la intervención (Práctica V) antes de datos reales

**Estado (6-oct-2026):** 3.1 y 3.2 implementadas y verificadas. **3.4 (modo básico), fases A, B y C: IMPLEMENTADAS el 6-oct en la rama `feat/modo-basico-web` (subida al remoto, sin mezclar a `main` ni desplegar).** Fase A y B: columna `Usuarios.modo_interfaz`, endpoint e interruptor, menú reducido. Fase C: pantalla `/pedir`, solo Administrador. Además, el modo básico no muestra ni pide las tarjetas de IA del Dashboard (plan 23). Decisión de Luis del 6-oct; ver «Actualización del 6-oct-2026» del plan 22, sección 5. 3.3 y 3.5 (incluida la encuesta de satisfacción) se implementan con el panel (plan 22, I1, I2 e I4), antes del arranque del piloto. 3.6 sigue documentada como diseño, sin implementar.
**Fecha:** 2026-09-25
**Origen:** `docs/contexto_revision_cowork_2026-09-23.md`, sección 3 ("Decisiones y sugerencias de producto"), y el análisis de resultados de `Documentacion/StockPilot_Intervencion_y_Viabilidad.docx` (sección 2.6, "Antes de recibir datos de negocios reales se deben cumplir dos condiciones...").

---

## 3.1 Copias de seguridad de PostgreSQL — implementado

**Problema:** `utils/backup.js` copiaba el archivo físico `database/inventario.db` (SQLite). Al migrar a PostgreSQL, `createBackup()` nunca encontraba ese archivo y no generaba ningún respaldo en producción — ya estaba deshabilitado en `app.js` con el comentario `// (Obsoleto en Postgres)`.

**Solución implementada:**
- `utils/backup.js` reescrito: usa `pg_dump` (formato `-Fc`, restaurable con `pg_restore`) sobre `process.env.DATABASE_URL`, guarda el volcado en `backups/` con el mismo esquema de nombre por fecha que tenía el mecanismo viejo, y conserva solo los últimos 14 (antes 10, ajustado a dos semanas de respaldo diario).
- `services/schedulerService.js` agrega un cron nuevo: `0 2 * * *` (diario, 2:00 AM), junto a los demás jobs existentes (resumen semanal, reversión de precios, evaluación de IA).
- `app.js` ya no importa `createBackup` directamente (quedaba comentado); ahora solo el scheduler lo dispara.

**Limitación conocida, documentada en el propio archivo:** el sistema de archivos de un servicio web en Render (y la mayoría de PaaS) es **efímero** — estos respaldos no sobreviven un redeploy ni un reinicio del contenedor. Sirven como red de seguridad de corto plazo entre despliegues, pero **no reemplazan una copia en almacenamiento externo** (S3, Backblaze, etc.). Subir automáticamente el volcado a ese almacenamiento queda pendiente de que el equipo provisione credenciales — no se inventó ninguna integración de nube sin que existan esas credenciales.

**Riesgo adicional no resuelto en esta ronda:** `pg_dump` debe estar disponible en la imagen del servicio de Render; algunos planes no incluyen el cliente de PostgreSQL. El código no falla el proceso si `pg_dump` no está (`try/catch` con log de error), pero conviene verificar manualmente en el entorno real que el binario existe antes de confiar en este mecanismo.

**Por qué esto no es redundante con Neon (verificado en la documentación oficial, 2026-09-25):** Neon incluye su propio "Instant Restore" (point-in-time restore), pero en el **plan gratuito la ventana de historial es fija en 6 horas** (tope de 1 GB, sin costo) — ver `Settings → Postgres → History window` en la consola de Neon del proyecto. Planes de pago suben esa ventana a 1-30 días, pero el proyecto hoy corre en el plan gratuito. Es decir: si alguien borra datos por error y nadie lo nota en menos de 6 horas, Neon ya no puede recuperarlos por sí solo. El propio Neon recomienda `pg_dump` programado como estrategia complementaria para retención más larga (tienen una guía dedicada, "Automate pg_dump backups"), que es exactamente el enfoque ya implementado aquí. Conclusión: el `pg_dump` diario sigue siendo necesario aunque seguir usando Neon; no se reemplazan entre sí, se complementan (Neon cubre el "hace 10 minutos", `pg_dump` cubre "hace 2 semanas").

---

## 3.2 Política de Tratamiento de Datos (Ley 1581 de 2012) — implementado

**Implementado:**
- Página nueva `frontend/src/pages/PoliticaDatosPage.jsx`, ruta pública `/politica-datos` (no requiere sesión), con las secciones exigibles: responsable del tratamiento, qué datos se recopilan, para qué se usan (incluyendo la aclaración de que el resumen enviado a OpenAI no incluye datos personales), derechos del titular (conocer/actualizar/rectificar/suprimir) y vigencia.
- `RegisterPage.jsx`: checkbox obligatorio "Acepto la Política de Tratamiento de Datos", con enlace a la página anterior; el botón de registro queda deshabilitado hasta marcarlo.
- `controllers/authController.js`: rechaza el registro con 400 si `acepta_politica_datos` no llega en `true`.
- `models/User.js` / `database/init_pg.sql` / `config/database.js`: columna nueva `Usuarios.fecha_aceptacion_politica_datos` (TIMESTAMP, nullable), que solo se completa en el flujo de registro propio — **no** cuando un administrador da de alta a un colaborador desde `tenderoController.js`, porque quien acepta la política es el titular de la cuenta, no quien lo registra.
- Enlace adicional desde el pie de la Landing Page, para quien no vaya a registrarse pero quiera consultarla.

**Fuera de esta ronda (no pedido):** un flujo de re-consentimiento si el texto de la política cambia en el futuro, y el ejercicio real de los derechos (hoy dice "escribiendo al soporte", no hay un formulario de autoservicio).

---

## 3.3 Métrica de activación de la prueba gratuita — solo documentado, sin implementar

Del `docx` (sección 3.3 del contexto y 2.6/4.2 de la intervención): la meta es **≥ 25% de activación**, definida como "registros que cargan al menos 20 productos y registran ventas durante 7 días ÷ registros totales".

**Diseño propuesto (no implementado):**

```sql
-- Candidato a vista o consulta bajo demanda, NO a tabla materializada (el volumen no lo justifica).
WITH RegistrosNuevos AS (
  SELECT t.id_tienda, t.fecha_creacion
  FROM Tienda t
),
CatalogoCargado AS (
  SELECT id_tienda, COUNT(*) AS productos
  FROM Productos
  GROUP BY id_tienda
),
VentasPrimeros7Dias AS (
  SELECT v.id_tienda, COUNT(*) AS ventas
  FROM Ventas v
  JOIN RegistrosNuevos rn ON rn.id_tienda = v.id_tienda
  WHERE v.fecha_salida BETWEEN rn.fecha_creacion AND rn.fecha_creacion + INTERVAL '7 days'
  GROUP BY v.id_tienda
)
SELECT
  rn.id_tienda,
  COALESCE(cc.productos, 0) AS productos_cargados,
  COALESCE(vp.ventas, 0) AS ventas_primeros_7_dias,
  (COALESCE(cc.productos, 0) >= 20 AND COALESCE(vp.ventas, 0) > 0) AS activado
FROM RegistrosNuevos rn
LEFT JOIN CatalogoCargado cc ON cc.id_tienda = rn.id_tienda
LEFT JOIN VentasPrimeros7Dias vp ON vp.id_tienda = rn.id_tienda;
```

**Dónde viviría:** un método nuevo en `models/Tienda.js` (p. ej. `Tienda.getActivacion()`) y un endpoint `GET /api/tiendas/activacion`, restringido a un rol interno del equipo (no es información que deba ver cualquier administrador de tienda — es una métrica del negocio de StockPilot, no del negocio del tendero). No se construyó porque el piloto/la convocatoria pública (fase 5 de la intervención) todavía no arrancó — no hay registros que medir todavía. Implementar esto ahora sería instrumentación sin datos que instrumentar.

---

## 3.5 Mensaje de la convocatoria pública y segmentación en el registro — solo documentado, sin implementar

Contexto (2026-09-24): la muestra de la encuesta (F1) está sesgada hacia tenderos ya digitales (quien encuentra la convocatoria en redes ya es más digital que el promedio — 20% de la población no usa ningún dispositivo). La idea evaluada fue pedirle a quien vea el anuncio que lo recomiende a un tendero sin experiencia digital en vez de usarlo él mismo. Conclusión de la evaluación: **no restringir el uso ni pedirle a nadie que se abstenga** — el canal (redes, WhatsApp) ya está filtrado hacia gente digital sin importar el mensaje, y pedirle al usuario más probable que no se registre corta el embudo sin garantizar que el mensaje llegue al perfil objetivo. En su lugar: **segmentar en el registro** (para poder analizar por separado, no para filtrar entrada) y **agregar una llamada a compartir** como CTA adicional, no como advertencia.

**1. Pregunta de calificación en el registro (`RegisterPage.jsx` / `authController.js`):**
- Campo nuevo, opcional, no bloqueante: *"¿Actualmente usas alguna app o herramienta digital para administrar tu negocio (Excel, otra app, red social para vender)?"* → Sí / No.
- Se guardaría como `Usuarios.experiencia_digital_previa` (booleano, nullable — nadie queda obligado a responder).
- Uso: cruzar la métrica de activación (3.3) y la encuesta de satisfacción (punto 3 abajo) por este campo, para saber si el perfil sin experiencia digital previa activa/se queda igual, mejor o peor que el resto — el dato que la encuesta F1 no puede dar porque no se preguntó ahí.

**2. Texto de la convocatoria (landing, grupos de Facebook/WhatsApp de comerciantes):**
- CTA principal (sin cambios): invitar a probar la app gratis.
- CTA secundaria, nueva: *"¿Conoces a un tendero que todavía lleva las cuentas en un cuaderno? Cuéntale de StockPilot — así llega a quien más lo necesita."* — con un botón/enlace para compartir, no un filtro de entrada. Coherente con el hallazgo de la propia intervención (sección 4.7 del docx) de que el boca a boca entre tenderos probablemente genera más confianza que un anuncio digital directo.

**3. Encuesta de satisfacción y sugerencias:**
- No es un instrumento nuevo independiente: extiende el cierre de piloto ya diseñado (Anexo A.2 del docx) con las dos preguntas de "sorpresa" acordadas en el chat del 2026-09-24: *"¿Hubo algo que el sistema hizo por usted sin que se lo pidiera, y que le pareció útil?"* y *"¿Qué le sorprendió, para bien o para mal, de usar la aplicación?"*
- Corta a propósito (el 80% de la encuesta F1 dijo no tener tiempo para aprender algo nuevo — una encuesta larga después de probar tendrá la misma barrera).
- Se dispara en un punto natural (a los 7 días de uso o tras cargar cierto número de productos), no en el registro, cuando todavía no hay nada que opinar.

**Por qué no se implementó:** depende de que la convocatoria pública (Fase 5 de la intervención) esté lista para publicarse — construir el campo de segmentación y la encuesta antes tendría el mismo problema que la métrica de activación (3.3): instrumentación sin datos que instrumentar todavía.

---

## 3.4 Modo básico (divulgación progresiva) — evaluación y plan detallado, sin implementar

**Estado (6-oct-2026):** el 3-oct se había aplazado porque la app nativa iba a la visita. Ya no: **el piloto y la visita van con la web**, así que se construyen A, B y C como prototipo y se lleva a la prueba de usabilidad (fase F, tal como se había pensado desde el principio). Decisiones del 6-oct:
- `/pedir` (fase C) solo para el **Administrador**; la fase D (permisos de Colaborador sobre órdenes, medio-alto riesgo) y la E (catálogo simplificado) quedan para después de la visita.
- El modo básico es una **preferencia por usuario**; no depende de las funciones por tienda (plan 22, I3).
- Las 6 tareas de la fase 4 incluyen «registrar la llegada de mercancía» y «aprobar la sugerencia de compra»: sin la fase C no se podrían hacer en modo básico.

Evaluación y plan completos a pedido del usuario (2026-09-24). Es un cambio de UX que toca la navegación principal, y la propia intervención (Fase 4, prueba de usabilidad con 5 tenderos) es el paso diseñado para validarlo.

### 3.4.1 Evaluación

**A favor, con evidencia propia (no solo intuición):** el hallazgo H4 del docx es contundente — 80% de los encuestados no tiene tiempo para aprender una herramienta nueva, 40% condiciona su participación a la complejidad, y 87% considera la interfaz sencilla importante o muy importante. StockPilot tiene hoy 15-16 módulos en el Sidebar. Ningún tendero pidió "menos módulos" explícitamente en la encuesta (no era una pregunta), pero el patrón de respuestas apunta directo a eso: la funcionalidad más pedida (registro automatizado, 80%) es también la más simple de las que existen.

**En contra / riesgos a tener en cuenta:**
- **Costo de mantenimiento duplicado.** A partir de este cambio, cada nueva funcionalidad hay que decidir en qué modo vive, y el equipo (3 personas) tiene que probar dos superficies de navegación en vez de una. Es el tipo de deuda que se acumula silenciosamente.
- **Riesgo de sentirse "encerrado".** Si el toggle para pasar a modo avanzado no es obvio y accesible en todo momento, un administrador que sí quiere ver Reportes o Analítica puede sentir que StockPilot "le escondió" algo, justo lo opuesto del efecto buscado. La mitigación (ver 3.4.3, Fase A) es que el switch nunca se esconda a su vez.
- **No sustituye la prueba de usabilidad.** El diseño de abajo son hipótesis basadas en la encuesta (n=15, sin preguntas específicas de navegación) y en el conocimiento del sistema — no en observar a un tendero navegando. Construirlo completo antes de la Fase 4 de la intervención sería invertir sin el dato que precisamente está diseñado para producirlo.

**Recomendación:** construir por fases (3.4.3), y usar el prototipo de las Fases A-C (las más baratas) como parte de lo que se le muestra a los 5 tenderos de la prueba de usabilidad, en vez de completar todo el plan a ciegas.

### 3.4.2 Qué vistas son realmente necesarias (matriz)

El diseño original (ver historial de este documento) proponía 4 accesos: *Vender*, *¿Qué pido?*, *Alertas*, *Recibir mercancía*. Al revisar contra la encuesta y el inventario real de pantallas, encontré que **falta una quinta**: sin poder dar de alta un producto nuevo, no hay nada que vender ni que recibir — y "registro automatizado" es la necesidad #1 de la encuesta (80%), no solo el registro de ventas.

| Vista | Modo básico | Justificación |
|---|---|---|
| **Vender** (`/ventas`, existente) | ✅ Esencial | Registro de ventas — la acción más frecuente del día a día. |
| **¿Qué pido?** (nueva, `/pedir`) | ✅ Esencial | Cubre "alertas de stock" (40%) y es el diferenciador de IA, pero mostrado como resultado, no como tecnología (hallazgo H3). |
| **Alertas** (`/alertas`, existente) | ✅ Esencial | Cubre "alertas de caducidad" (53%) y "alertas de stock" (40%), las dos funcionalidades más pedidas después del registro. |
| **Recibir mercancía** (dentro de "¿Qué pido?", no un menú aparte) | ✅ Esencial | Parte de "registro automatizado" (80%): sin esto, las entradas de inventario no quedan registradas. |
| **Catálogo simplificado** (`/productos`, variante recortada) | ✅ Esencial (el 5.º que faltaba) | Alta de productos nuevos — condición previa para que Vender/Recibir tengan algo que mostrar. Oculta columnas avanzadas (ABC, velocidad, nivel_stock detallado), conserva nombre/stock/precio y el botón de alta. |
| Vista general (`/dashboard`) | 🟡 Opcional | Se puede fusionar con "¿Qué pido?" (ambas son "qué necesito saber hoy") en vez de mantenerla aparte. |
| Mi Tienda (`/tiendas`) | 🟡 Opcional | Solo necesaria para editar datos del negocio o si hay más de una sede — no es una tarea diaria. |
| Colaboradores (`/registro-tendero`) | 🟡 Depende del negocio | Si el tendero ya tiene empleados, es tan esencial como Vender desde el día 1; si trabaja solo, no aplica. No se puede decidir en abstracto — mejor mostrarla si `COUNT(Usuarios) > 1` para esa tienda, sin importar el modo. |
| Cartera (Fiados) (`/cartera`) | ⚪ Oculto | No todos los tenderos fían; la encuesta no lo midió como prioridad. |
| Movimientos (`/movimientos`) | ⚪ Oculto | Ajustes manuales y mermas — uso ocasional, no diario; se puede promover a "básico" más adelante si se ve que hace falta. |
| Comunicados (`/comunicados`) | ⚪ Oculto | Comunicación con clientes, no operación de inventario. |
| Proveedores AI completo (`/proveedores`) | ⚪ Oculto | La edición manual de cantidades, simulación de presupuesto y panel de IA quedan en modo avanzado; la versión de uso diario vive en "¿Qué pido?". |
| Analítica Visual (`/analitica-visual`) | ⚪ Oculto | Explícitamente fuera del alcance de alguien que recién empieza (hallazgo H4). |
| Simulador AI (`/simulador`) | ⚪ Oculto | Herramienta de planeación, no de operación diaria. |
| Generar Reportes (`/reportes`) | ⚪ Oculto | Útil pasado el primer mes, no en la primera semana; un resumen mínimo de "cuánto vendí hoy" puede vivir dentro de Vender en vez de un módulo aparte. |
| Auditoría AI (`/auditoria`) | ⚪ Oculto | Transparencia técnica sobre las decisiones de la IA, no una acción. |
| Aprendizaje AI (`/aprendizaje`) | ⚪ Oculto | Panel de métricas de la IA, no una acción. |

**Conclusión:** el modo básico real son **5 vistas** (Vender, ¿Qué pido?/Recibir, Alertas, Catálogo simplificado, más el switch a modo avanzado siempre visible), no 4. El resto del sistema no desaparece — solo se deja de mostrar en el menú hasta que el usuario decida activarlo o hasta que el propio sistema detecte que ya lo necesita (ej. Colaboradores, cuando hay más de un usuario).

### 3.4.3 Plan de implementación por fases

**Fase A — Preferencia y toggle (riesgo bajo, sin tocar la navegación aún)**
- Columna nueva `Usuarios.modo_interfaz VARCHAR(10) DEFAULT 'basico'` (mismo patrón de migración que `fecha_aceptacion_politica_datos`: `init_pg.sql` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` en `config/database.js`).
- **Importante para no romper el hábito de quien ya usa el sistema:** el default `'basico'` solo debe aplicar a cuentas *nuevas*. Las cuentas existentes necesitan un backfill explícito a `'avanzado'` en la misma migración (`UPDATE Usuarios SET modo_interfaz = 'avanzado' WHERE modo_interfaz IS NULL AND fecha_registro < NOW()`, ejecutado una sola vez antes de que el default entre en vigor) — si no, todo administrador actual vería su Sidebar reducido de golpe el día del despliegue, un downgrade sorpresivo que iría en contra del propósito de este cambio.
- Endpoint `PATCH /api/perfil/modo-interfaz` (el propio usuario cambia su preferencia; un Administrador podría cambiarla para un Colaborador, a definir en la Fase B).
- Frontend: `AuthContext` expone `user.modoInterfaz`; un switch pequeño y **siempre visible** (no escondido en un submenú) en el Sidebar y en `/perfil` — mitiga el riesgo de "sentirse encerrado" de la evaluación.

**Fase B — Sidebar condicional (riesgo bajo)**
- `Sidebar.jsx` filtra el arreglo `links` según `modoInterfaz`, mostrando solo las 5 vistas esenciales de la matriz (más el switch y "Mi Perfil") cuando es `'basico'`.
- **Decisión de diseño: ocultar del menú, no bloquear el acceso.** Ninguna ruta se protege de más; si un Colaborador en modo básico llega a `/reportes` por un enlace directo (ej. desde una notificación), la ve igual — solo desaparece del menú. Esto evita romper flujos existentes que ya enlazan a esas rutas y evita construir una segunda capa de permisos sobre la que ya existe (`AdminRoute`).
- Punto de decisión pendiente: ¿el Colaborador puede cambiar su propio modo, o solo el Administrador se lo asigna? Recomiendo que el Colaborador sí pueda subirse a avanzado por su cuenta (es su propia curva de aprendizaje), pero que el Administrador vea en qué modo está cada uno desde Colaboradores.

**Fase C — Pantalla nueva "¿Qué pido?" (riesgo medio; la única pantalla verdaderamente nueva)**
- Ruta `/pedir`, accesible a Administrador **y** Colaborador (hoy el equivalente, Proveedores AI, es `AdminRoute` — este es el cambio de alcance más importante del plan).
- Contenido: lista agrupada por proveedor, solo productos en nivel `critico`/`reponer` (reutiliza `leerEntradasMotor` + `calcularReposicion`, ya existentes — sin SQL nuevo), con la cantidad sugerida y un botón "Armar pedido" que reutiliza `ordenesBorrador`/`suppliersController` para crear el borrador. No expone edición manual de cantidades, simulación de presupuesto ni el panel de IA — eso se queda en Proveedores AI para modo avanzado.
- Incluye la sección "Recibir mercancía": lista de `Ordenes_Compra` en estado `Aprobada`/`Enviada`, con un botón para marcarlas recibidas (reutiliza `completarRecepcion` tal cual, ya transaccional y ya dispara `Alert.generate` desde el cierre de plan 17).

**Fase D — Permisos de Colaborador sobre órdenes (riesgo medio-alto: es el cambio que más toca seguridad)**
- Hoy ningún Colaborador puede tocar `Ordenes_Compra` — todo el módulo de Proveedores es `AdminRoute`/`requireAdmin` en el backend. Exponer "¿Qué pido?"/"Recibir mercancía" a Colaborador significa decidir con precisión qué puede hacer:
  - **Recomendado:** el Colaborador puede *ver* órdenes pendientes y *marcarlas recibidas*, igual que ya puede *registrar* un egreso de caja sin poder aprobarlo — mismo patrón que `EgresosCaja` (registra, el Administrador aprueba/rechaza).
  - **Recomendado:** el Colaborador puede *generar* un borrador de orden desde "¿Qué pido?", pero no *aprobarla* ni *enviarla* al proveedor (eso sigue siendo del Administrador) — evita que alguien sin autoridad comprometa dinero del negocio.
  - **Punto de decisión pendiente:** si el Colaborador debe ver los montos/costos de la orden o solo las cantidades. Ninguna evidencia de la encuesta obliga una respuesta; es una decisión de confianza del dueño del negocio hacia su empleado, más que una decisión técnica.

**Fase E — Catálogo simplificado (riesgo bajo-medio)**
- Reutiliza `ProductosPage`/`ProductTable` con una variante que oculta columnas avanzadas (ABC, velocidad, nivel_stock detallado) y deja nombre, stock, precio y el botón "+ Nuevo producto". El formulario de alta (`ProductFormModal`) no cambia — ya es el mismo para todos los roles.

**Fase F — Validación (se apoya en la Fase 4 de la intervención, no es trabajo nuevo)**
- Antes de construir D y E (las más costosas), llevar el prototipo de A+B+C a la prueba de usabilidad con los 5 tenderos ya diseñada en la intervención. Si el SUS o la tasa de éxito en tareas no mejora frente al Sidebar completo, no tiene sentido completar el resto del plan.

### 3.4.4 Resumen de riesgos por fase

| Fase | Riesgo | Por qué |
|---|---|---|
| A. Preferencia y toggle | Bajo | Columna nueva + endpoint; sin cambios visibles si se hace bien el backfill. |
| B. Sidebar condicional | Bajo | Solo filtra un arreglo ya existente; ninguna ruta cambia de protección. |
| C. "¿Qué pido?" | Medio | Pantalla nueva, pero reutiliza lógica ya probada (`leerEntradasMotor`, `ordenesBorrador`, `completarRecepcion`). |
| D. Permisos de Colaborador | Medio-alto | Es el único punto que amplía lo que un Colaborador puede hacer sobre dinero/proveedores — requiere decisión explícita del dueño, no solo del equipo de desarrollo. |
| E. Catálogo simplificado | Bajo-medio | Cambio de UI sobre una pantalla existente, sin tocar el backend. |

---

## 3.6 Descarga de recibo (PDF) y vista de factura individual — solo documentado, sin implementar

Contexto (2026-09-24): hoy "Imprimir" en el Punto de Venta ([`CajaRapidaTab.jsx`](../../frontend/src/components/puntoventa/CajaRapidaTab.jsx)) usa `react-to-print`, que solo abre el diálogo nativo de impresión del navegador sobre el ticket renderizado en [`TicketPrinter.jsx`](../../frontend/src/components/TicketPrinter.jsx). Si el tendero no tiene impresora conectada (muy probable en la prueba gratuita, que se instala en PC/tablet/celular sin hardware POS), la única forma de conservar un comprobante es que sepa usar la opción "Guardar como PDF" del diálogo de su sistema operativo — confiable en Windows/Android, pero poco obvia en iPhone (hay que ampliar la vista previa y usar Compartir → Guardar en Archivos). Para el perfil objetivo (sin experiencia digital), es un punto de fricción real que puede leerse como "la función no sirve".

**Importante — la venta nunca se pierde:** con o sin impresora, la venta ya queda guardada en `Ventas`/`VentasProductos` y siempre se puede consultar en la pestaña "Historial". Lo que falta no es persistencia de datos, es una forma de *presentarlos* como documento.

**Diseño propuesto (no implementado):**
1. **Botón "Descargar recibo (PDF)"**, alterno al de "Imprimir": genera el PDF en el servidor reutilizando `pdfkit` (ya es dependencia del proyecto, ya se usa en `reportController.generateMermaPDF`) a partir de los datos de la venta, y lo entrega como descarga directa (`Content-Disposition: attachment`) — sin pasar por el diálogo de impresión del navegador, así que funciona igual en Windows, Android e iPhone.
2. **Ver factura individual desde el Historial:** un botón por fila que abre un modal con el mismo formato de recibo (reutilizando el layout de `TicketPrinter`), con las acciones "Reimprimir" y "Descargar PDF" del punto 1.

**Por qué esto NO satura la base de datos (aclaración explícita, a pedido del usuario):** el diseño correcto es generar el PDF/la vista *al leer*, no guardarlo *al vender*. Ni el PDF ni ninguna vista de factura se almacenan — se arman en el momento a partir de `Ventas`/`VentasProductos`, exactamente como ya hace `TicketPrinter` hoy. No se agrega ninguna columna ni tabla nueva. Guardar un PDF por venta como archivo/blob sí sería un problema de crecimiento de almacenamiento — el mismo antipatrón que las fotos de perfil en Base64 señaladas en `Documentacion/hoja_de_ruta_escalabilidad.md` — y es precisamente lo que este diseño evita.

**Por qué no se implementó:** ambas piezas comparten la misma base técnica (formatear una venta como documento), así que tiene sentido construirlas juntas en vez de por separado; queda para cuando el usuario decida priorizarlo.
