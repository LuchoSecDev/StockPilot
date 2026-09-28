# Traspaso de contexto: sesión de Cowork (23 a 26 de septiembre de 2026)

> Para un chat nuevo de Claude (Cowork) o para Claude Code. Resume el estado de todos los entregables de StockPilot trabajados en esta sesión y lo que queda pendiente.
> **Antes de afirmar cualquier dato, verifícalo contra los archivos:** este documento es un resumen y los archivos son la fuente.

---

## 1. Proyecto y equipo

- **Título vigente:** *StockPilot: plataforma web de gestión comercial asistida por inteligencia artificial para microempresas de comercio minorista en Bogotá.* Se eligió "comercio minorista" (CIIU 47) en lugar de "distribución" (CIIU 46, mayorista).
- **Equipo:** Luis Alberto Diuche Peña, Elizabeth Pérez González y Miguel Angel Espinosa Esparza (Universidad Central, Ingeniería de Sistemas).
- **Dos materias con el mismo proyecto:**
  - Práctica de Ingeniería V: documento de práctica, intervención y plan de negocio.
  - Bases de Datos Avanzadas: 8 sprints Scrum.
- **Stack:**
  - Backend: Node 22 + Express 4 y PostgreSQL 15 (Neon en producción, local en desarrollo).
  - Frontend: React 19 + Vite + Tailwind 4.
  - Soporte: Redis opcional (`REDIS_URL`), OpenAI GPT-4o-mini, Resend, Vitest y Playwright.
  - Despliegue en Render.
- **Repositorio local:** `C:\Estudio\Práctica de ing\inventario-node\inventario-node`.
- **Documento principal:** Luis lo edita en **Google Docs**. El `.docx` descargado en `Documentacion/` es la versión más reciente. El `.md` es solo para leer más fácil y **puede estar atrasado**.

---

## 2. Reglas de honestidad (corregidas por Luis; no repetir los errores)

1. **No se ha contactado ninguna tienda** para el piloto. El piloto está diseñado y pendiente. Nunca presentarlo como hecho ni como rechazado.
2. **Encuesta real:**
   - Google Forms, 23 y 24 de marzo de 2025, 15 negocios.
   - Localidades: Barrios Unidos (6), Usme (4), Santa Fe (4) y Antonio Nariño (1).
   - **No fueron entrevistas ni se hicieron en Kennedy, Suba o Engativá.**
   - No preguntó por la disposición a pagar, el precio ni la IA.
3. **La IA fue una decisión estratégica del equipo** para diferenciarse y automatizar. No fue una necesidad expresada por los tenderos.
4. **No hay evidencia** de estas cifras: NPS 68, "88 % lo recomendaría", "pilotos con 5 tiendas", 78 % de disposición a pagar ni 85 % de interés en IA. Eliminarlas o marcarlas como pendientes.
5. **Nivel de madurez: TRL 5**, validación técnica controlada. Faltan la prueba de usabilidad (F4, SUS) y el piloto de campo (F5).
6. **La cobertura de pruebas debe presentarse con su contexto** (ver la sección 4). Nunca poner un porcentaje sin decir sobre qué se midió.

---

## 3. Entregables y su estado

| Archivo | Qué es | Estado y pendientes |
|---|---|---|
| `Documentacion/StockPilot_Intervencion_y_Viabilidad.docx` | Plan de intervención (5 fases), reporte, análisis de resultados (encuesta con 3 figuras) y viabilidad (técnica TRL 5, comercial no demostrada, financiera condicionada) | Actualizado el 25-sep: 149/149 pruebas y respaldos "programados con pg_dump, sin verificar en producción ni copia externa". **Pendiente:** actualizar la cifra de pruebas y la cobertura con los números finales del trabajo de cobertura (sección 4) |
| `Documentacion/Revision_Documento_Practica_5.docx` | Revisión del documento principal (versión de Google Docs) | Lista de correcciones en las secciones A a G: párrafos atrasados, alcance, 13 inconsistencias, módulos sin documentar (Cartera/fiados, Comunicados, Historial del copiloto, 2FA), estructura de la Práctica V, ~28 referencias faltantes y formato. **Pendiente:** que Luis las aplique en Google Docs |
| `Documentacion/Plan_de_Negocio_StockPilot_secciones_corregidas.docx` | Secciones del plan de negocio corregidas para copiar y pegar (con recuadros "INSTRUCCIÓN") | Personal "según carga de trabajo". **Pendiente:** que Luis las pegue en el original |
| `Documentacion/StockPilot_Modelo_Financiero_5_anios.xlsx` | Modelo a 5 años con 3 escenarios, selector de escenario y de modo de personal, y resumen para Fondo Emprender | Terminado. Precio de $39.900/mes; punto de equilibrio de ≈141 tiendas (169 si el precio incluye IVA) |
| `docs/contexto_revision_cowork_2026-09-23.md` | Contexto para Claude Code sobre la intervención y las decisiones de producto (modo básico, convocatoria pública, requisitos antes de recibir datos reales) | Vigente. Aún no está implementado nada de lo que propone |
| `docs/plan_sprints_bases_datos_avanzadas.md` | Plan de los sprints 2 a 8 de Bases de Datos Avanzadas | Propuesta. La sección 2.1 (entornos de base de datos) está **pendiente de que Luis la confirme** |
| `Documentacion/Herramientas_Tecnologicas_corregidas.docx` | Texto corregido de los 20 puntos de "Herramientas Tecnológicas" del documento de seguimiento del profesor | **Pendiente:** actualizar el punto 19 (pruebas y cobertura) con los números finales. Los puntos 14 a 17 tienen versión "hoy" y versión "al cerrar el sprint" |

Los scripts que generan los `.docx` y el `.xlsx` estaban en el espacio temporal de la sesión anterior y **no se conservan**. Para editarlos en otra sesión, trabajar sobre los archivos directamente.

---

## 4. Estado técnico verificado (25-26 de septiembre)

**Pruebas:**
- Eran 149 (8 archivos, todas aprobadas). **Ya son 154.**
- Trabajo en curso en la rama **`feature/cobertura-nivel-1`, commit `5655215`**. Ahí están `docs/planes/20_cobertura_real_backend.md` y la regla nueva de `CLAUDE.md` sobre archivos generados.
- **Cuando se hizo el traspaso, la carpeta tenía `main` activa**, por eso esos archivos no aparecían. Verificar con `git status` y `git log`.

**Cobertura:**
- El 99,27 % anterior se medía solo sobre 5 archivos y con grandes bloques excluidos con `/* v8 ignore */`:
  - `feedbackController.js`, líneas 16-228.
  - `Alert.js`, líneas 93-307.
  - Casi todo `auth.js`.
- **Línea base real del backend completo: 8,2 %** de sentencias (229/2794). Por carpeta:

  | Carpeta | Cobertura |
  |---|---|
  | `controllers` | 1,2 % |
  | `models` | 27,9 % |
  | `middleware` | 48,4 % |
  | `services` | 0 % |
  | `utils` | 52,7 % |

- Plan de mejora:
  - **Nivel 1:** sin base de datos. Simular `config/database.js`, incluir los `utils` que ya tienen pruebas y cubrir las ramas pendientes.
  - **Nivel 2:** integración contra la base `stockpilot_test`, con una protección que aborta si el nombre no termina en `_test`.
- `dashboard_analytics.test.js` prueba una copia de la fórmula que **no coincide con el SQL real**: `NULLIF(precio, 0)` + `AVG` excluye los productos con precio 0, y la copia los cuenta. Hay que marcarla como especificación y reemplazarla en el Nivel 2.

**Archivos generados automáticamente** (no editarlos a mano): `evidencia_pruebas.json`, `Documentacion/Reporte_Pruebas_StockPilot.md` y `coverage/`. La plantilla de `generar_reporte.js` escribe datos fijos equivocados ("Vitest v3") y lenguaje exagerado ("Certificado Oficial", "*Production-Ready*"). Hay que corregirla antes de anexar ese reporte.

**Base de datos:**
- 22 tablas en `database/init_pg.sql`: **21 entidades de negocio + `session`**, que es técnica.
- Tablas puente N:M: `VentasProductos` y `Ordenes_Detalle`.
- **Transacciones:**
  - La venta (`saleController.js`) va entre `BEGIN` y `COMMIT`, con `SELECT … FOR UPDATE`, e inserta Ventas, VentasProductos, el descuento de stock y MovimientosStock. Las alertas se regeneran después, en otra transacción.
  - `Alert.generate` usa `pg_advisory_xact_lock`.

**Otros:**
- **Redis:** el código lo soporta con modo de respaldo. No está confirmado que producción tenga `REDIS_URL`.
- **Respaldos:** `utils/backup.js` usa `pg_dump` (nocturno, conserva 14). Escribe en el disco efímero de Render, y `pg_dump` puede no existir ahí. Falta una copia externa.
- **Tareas programadas:** `app.js` llama siempre a `scheduler.startScheduler()`. Con varias réplicas, las tareas se duplicarían.
- **Motor de reposición** (`utils/reposicion.js`): velocidad de 30 días × tendencia. La tendencia es v7/v30, acotada entre 0,5 y 2, y vale 1 si hay menos de 5 unidades vendidas en 30 días.
- **Otras cifras:** 19 archivos de rutas y 19 planes en `docs/planes` (más el 20 en la rama de cobertura). La prueba de carga midió 12,9 peticiones/s con una instancia, frente a 2-4 estimadas para 120 tiendas.

---

## 5. Bases de Datos Avanzadas

- **Sprints:**
  - 0 y 1: entregados.
  - 2 a 5: construidos, falta la evidencia.
  - 6 a 8: por hacer.
- **Decisión de arquitectura:** no migrar todo a microservicios; usar *Strangler Fig*. En orden:
  1. Docker (Dockerfile con `postgresql-client` y docker-compose).
  2. Worker de tareas programadas (1 réplica, `SCHEDULER_ENABLED`).
  3. `ia-service` como microservicio. Se lleva `Cache_IA`; `Auditoria_IA` se queda en el monolito por sus claves foráneas.
  4. Nginx como API Gateway.
  5. Kubernetes solo como demostración local.
- **Sprint 7:** esquema `dw` con modelo estrella (`fact_ventas` por línea de venta y `fact_inventario_diario`) y un proceso ELT incremental ejecutado por el worker.
- **Sprint 8:** indicadores y un dashboard analítico.
- **Entornos (propuesta):**
  - Producción: Neon, no se toca.
  - Desarrollo: `stockpilot` local, compartido por las dos materias.
  - Pruebas: `stockpilot_test`, desechable.
  - Demostración: PostgreSQL en Docker con **datos sintéticos marcados como tales**.
- **Lo nuevo va en esquemas** (`ia`, `dw`), no en otra base.
- Diapositivas del curso: `Documentacion/MetodologiaSoporteHojadeRutaProyecto2026.pptx`. Documento de seguimiento: `Documentacion/SEGUIMIENTO DEL PROYECTO A REALIZAR2026.docx`.

---

## 6. Pendientes, en orden sugerido

1. **Cobertura:** terminar el Nivel 1 en la rama `feature/cobertura-nivel-1`. Después, actualizar con los números finales el entregable de intervención, las herramientas (punto 19) y el documento principal. Presentarlo como "línea base 8,2 % → resultado".
2. **Documento principal:** aplicar la revisión (`Revision_Documento_Practica_5.docx`) y pegar las secciones corregidas del plan de negocio.
3. **Bases de Datos Avanzadas:** confirmar la sección 2.1 del plan y arrancar el Sprint 6 (Docker + worker). Preparar la evidencia de los sprints 2 a 5.
4. **Antes de recibir datos reales:** copia externa de los respaldos y política de tratamiento de datos (Ley 1581 de 2012).
5. **Fase 4 (usabilidad):** tienda de demostración, las 6 tareas y el cuestionario SUS con 5 tenderos.
6. **Reclutamiento del piloto:** convocatoria pública medida por etapas, más contacto con los 8 encuestados que dijeron que sí se capacitarían.
7. **Idea en evaluación:** "modo básico" con 4 acciones (Vender, ¿Qué pido?, Alertas y Recibir mercancía). Solo diseño.
8. **Plantilla de `generar_reporte.js`:** corregir la versión de Vitest y el tono.

---

## 7. Cómo retomar

Mensaje sugerido para abrir un chat nuevo de Cowork:

> Estoy trabajando en StockPilot (Práctica de Ingeniería V y Bases de Datos Avanzadas). Lee primero `docs/traspaso_cowork_2026-09-26.md` en la carpeta del proyecto y verifica lo que necesites contra los archivos. Hoy quiero trabajar en: [tarea].
