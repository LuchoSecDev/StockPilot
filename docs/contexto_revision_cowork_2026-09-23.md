# Contexto: plan de intervención y decisiones de producto (23-sep-2026)

> Documento de contexto para el agente de Claude Code. Resume una sesión de trabajo con otro asistente (Claude en Cowork) sobre los entregables académicos de la Práctica de Ingeniería V: plan de intervención, reporte, análisis de resultados y viabilidad del negocio. Incluye las decisiones de producto que salieron de ese análisis.
> **Regla general:** verifica contra el código y los documentos antes de actuar. No escribas código ni modifiques documentos académicos hasta que Luis apruebe cada plan. Nunca inventes datos de campo (encuestas, pilotos, métricas de usuarios).

---

## 1. Fuentes

| Fuente | Qué contiene |
|---|---|
| `Documentacion/StockPilot_Intervencion_y_Viabilidad.docx` | Entregable nuevo: plan de intervención, reporte, análisis de resultados y viabilidad. Léelo con `pandoc -t markdown` |
| `Documentacion/Documento de practica de ingeniera 5 - Gestion de inventarios.md` | Documento académico principal |
| `Documentacion/Plan de Negocio_ StockPilot.md` | Plan de negocio (tiene inconsistencias, ver sección 6) |
| `evidencia_pruebas.json`, `ai_audit.log` | Evidencia de la validación técnica usada en el entregable |
| Encuesta a tenderos (Google Forms, no está en el repo) | 15 respuestas, 23-24 de marzo de 2025. Resumen en la sección 3 |

---

## 2. Cómo está planteada la intervención

La intervención tiene **cinco fases**. El documento dice con claridad cuáles se ejecutaron y cuáles no:

| Fase | Contenido | Estado |
|---|---|---|
| F1. Diagnóstico | Encuesta a 15 tenderos | Ejecutada (marzo de 2025) |
| F2. Diseño y construcción | 83 requerimientos, 5 sprints, despliegue en la nube | Ejecutada |
| F3. Validación técnica controlada | 4 tiendas de prueba, 149 pruebas Vitest (25-sep-2026), prueba de carga, 193 decisiones de IA registradas, auditoría del motor de reposición | Ejecutada (TRL 5) |
| F4. Prueba de usabilidad | 5 tenderos, 6 tareas guiadas, cuestionario SUS (meta: SUS ≥ 68 y ≥ 80 % de éxito en tareas) | Diseñada, pendiente |
| F5. Piloto de campo | 1-3 tiendas, 6 semanas (1 de línea base + 5 con StockPilot sobre 20-30 productos de alta rotación) | Diseñada; reclutamiento no iniciado |

**Dictamen de viabilidad del documento:** técnicamente viable (TRL 5), comercialmente no demostrado y financieramente condicionado (punto de equilibrio ≈ 141 tiendas). La continuidad se define por etapas: coherencia → usabilidad → piloto → pago → escalamiento.

**Punto honesto importante:** **todavía no se ha contactado ninguna tienda** para el piloto. El documento lo presenta como pendiente, no como rechazo.

---

## 3. Resumen de la encuesta (dato real, n = 15)

- **Localidades:** Barrios Unidos (6), Usme (4), Santa Fe (4) y Antonio Nariño (1). Incluye negocios que no son de víveres (cigarrería, papelería).
- **Gestión actual:** 73 % registro manual en papel; 67 % nunca usó una herramienta digital; 67 % tiene celular; 20 % no tiene ningún dispositivo.
- **Dificultades:** errores de registro 53 %; faltantes 33 %; exceso de productos 33 %; caducidad 20 %.
- **Funcionalidades esenciales:** registro automatizado 80 %; alertas de caducidad 53 %; alertas de stock, informes y códigos de barras 40 % cada una. No se preguntó por IA.
- **Obstáculos:** falta de tiempo para aprender 80 %; costo 53 %. Capacitación: sí 53 % (8 negocios), depende de la complejidad 40 %.
- **No hubo preguntas sobre disposición a pagar ni sobre el precio.**

---

## 4. Decisiones de producto

### 4.1 IA predictiva: decisión estratégica
La IA fue una **decisión estratégica del equipo** para diferenciarse de la competencia (Treinta, Chiper) y automatizar la mayoría de los procesos manuales. No fue una necesidad expresada por los tenderos. La encuesta la respalda de forma indirecta (80 % pide registro automatizado; 60 % espera ahorrar tiempo). Se comunica por el resultado ("te dice qué pedir y cuánto"), no por la tecnología. La IA depende de un registro confiable, así que el registro rápido es una condición previa.

### 4.2 Modo básico: idea en evaluación, sin implementar todavía
Los administradores de microempresas suelen ser personas mayores y 15 módulos son demasiados. La propuesta es **divulgación progresiva**, no eliminar módulos:
- **Modo tienda (por defecto):** 4 acciones grandes: *Vender*, *¿Qué pido?*, *Alertas* y *Recibir mercancía*.
- **Modo avanzado:** simulador, aprendizaje, reportes, promociones y lo demás, para quien lo active.
- Meta: que baste una capacitación de unos 15 minutos. Aprovechar los roles existentes (Administrador y Tendero).
- **Solo diseño y propuesta por ahora.**

### 4.3 Reclutamiento: convocatoria pública de prueba gratuita
El plan es publicar la prueba gratuita en canales digitales (grupos de Facebook de comerciantes o del barrio, grupos de WhatsApp de tenderos, Marketplace y la landing con "Explorar Demo"). Recomendaciones:
- Tratarla como un **experimento medido en etapas, con metas fijadas antes de publicar**: visitas → registros → **activación** (≥ 20 productos cargados y ventas registradas durante 7 días; meta ≥ 25 %) → uso a 4 semanas → "¿pagaría $39.900?".
- Riesgo de sesgo: quien la encuentra en internet ya es más digital que el tendero promedio.
- Complementar con contacto directo a los **8 encuestados que dijeron que sí se capacitarían**.

### 4.4 Requisitos antes de recibir datos de negocios reales (prioridad alta)
1. **Copias de seguridad:** el mecanismo actual copiaba el archivo SQLite y dejó de funcionar al migrar a PostgreSQL. Reemplazarlo por `pg_dump` programado con almacenamiento externo, o verificar y documentar los respaldos automáticos de Neon.
2. **Política de tratamiento de datos (Ley 1581 de 2012)** publicada en la plataforma, con aceptación al registrarse.

---

## 5. Lo que necesita la prueba de usabilidad (F4)

- **Una tienda de demostración** con catálogo y ventas realistas, para que los tenderos usen el sistema sin haberlo visto antes.
- **Las 6 tareas:**
  1. Registrar una venta de 3 productos.
  2. Consultar qué productos están por agotarse.
  3. Agregar un producto nuevo con fecha de vencimiento.
  4. Registrar la llegada de mercancía de un proveedor.
  5. Revisar y aprobar la sugerencia de compra de un proveedor.
  6. Encontrar cuánto se vendió en la última semana.
- **Qué se registra por participante:** si completó cada tarea, el tiempo y los errores, además del puntaje SUS. El cuestionario SUS está en el anexo A del documento.

---

## 6. Correcciones pendientes en la documentación

El Plan de Negocio y el Documento 5 contienen afirmaciones que la encuesta real contradice. Ajústalas **solo con aprobación de Luis**, y nunca inventes datos que las reemplacen:
1. "15 entrevistas en Kennedy, Suba y Engativá + 50 encuestas". Lo real son 15 encuestas en las localidades de la sección 3.
2. "Pruebas piloto con 5 tiendas", "NPS 68 con 10 tenderos en Figma" y "88 % lo recomendaría". No hay evidencia: eliminar o marcar como pendiente.
3. 78 % de disposición a pagar, 85 % de interés en IA y 92-100 % de pérdidas por vencimiento. La encuesta no preguntó los dos primeros y el tercero es 20 %.
4. **Cifras financieras inconsistentes:** ingresos del año 1 de $39,9 M frente a $29,9 M; resultado de −$25,9 M frente a −$36,4 M; inversión de $15,85 M frente a $42,78 M. El CAC de $48.300 excluye el salario comercial (con él da ~$274.583). Falta la proyección a 5 años que exige la actividad.
5. **Datos técnicos que difieren entre documentos:** 50, 132 o 142 pruebas (el conteo actual es de 149 en 8 archivos; `evidencia_pruebas.json` es del 20-sep-2026 y debe regenerarse con `npm run test:evidence`); 5,8 o 26,5 KLOC; el Plan de Negocio afirma que el sistema es PWA, pero las recomendaciones del Documento 5 lo tratan como trabajo futuro.

---

## 7. Qué te pido ahora

1. Lee este documento y el entregable `StockPilot_Intervencion_y_Viabilidad.docx`.
2. Propón un plan corto (sin implementar) para los requisitos de la sección 4.4: copias de seguridad en PostgreSQL y política de datos.
3. Propón cómo preparar la prueba de usabilidad (sección 5): la tienda de demostración, con datos sembrados o un script de seed, y cualquier ajuste que las 6 tareas necesiten.
4. Propón cómo medir la activación de la convocatoria pública (sección 4.3) con los datos que ya existen (productos y ventas por tienda y por fecha).
5. Propón el diseño del modo básico (sección 4.2), solo como documento.
6. Prepara una lista de los cambios de texto de la sección 6, cada uno con su ubicación exacta en los documentos, para que yo los apruebe.
7. Si algo de este documento no coincide con el código o los documentos actuales, dímelo en lugar de asumirlo.
