---
title: Certificado de Pruebas Unitarias y Aseguramiento de Calidad
author: Sistema de Gestión de Inventario Inteligente (StockPilot)
date: 8/10/2026, 3:11:22 p. m.
---

# 📄 Certificado Oficial de Calidad de Software y Pruebas Unitarias

**Proyecto:** StockPilot — Sistema de Gestión de Inventario Inteligente
**Fecha de Certificación:** 8/10/2026, 3:11:22 p. m.
**Framework de Validación:** Vitest v4
**Entorno de Ejecución:** Node.js (V8 Engine)

---

## 1. Resumen Ejecutivo de Validación

El presente documento certifica la ejecución automatizada de la suite de pruebas **unitarias**, más la de **integración** (contra Postgres real — `stockpilot_test` — aislada de desarrollo y producción) sobre los módulos críticos (Lógica Financiera, Inteligencia Artificial y Seguridad) del sistema **StockPilot**. Las pruebas fueron diseñadas bajo el enfoque de validación de caja blanca, pruebas de límites y pruebas de integración de extremo a extremo (HTTP real sobre la aplicación completa, vía supertest).

### 1.1. Métricas de Ejecución Combinadas
- **Total de Escenarios Evaluados:** `821`
- **Tasa de Éxito (Pass Rate):** `100.00%`
- **Escenarios Exitosos:** `821`
- **Escenarios Fallidos:** `0`

### 1.2. Desglose por Tipo de Prueba

| Tipo | Escenarios | Exitosos | Fallidos | Latencia |
|---|---|---|---|---|
| Unitarias (`npm test`) | 372 | 372 | 0 | 0.62 s |
| Integración (`npm run test:integration`) | 449 | 449 | 0 | 298.89 s |

> Las pruebas de integración corren contra `stockpilot_test`, una base Postgres real aislada de desarrollo y producción — protegida por un guard que aborta si `DATABASE_URL` no es, de forma verificable, una base de pruebas local (ver `tests/integration/setupTestDb.js`).

### 1.3. Veredicto del Sistema
> **[ESTADO: APROBADO]** ✅  
> La integridad de los algoritmos predictivos, controles de acceso y matemática logística cumple con las especificaciones del diseño arquitectónico. El código está estabilizado y certificado como *Production-Ready* en el ámbito lógico.

## 2. Detalle de Certificación por Módulo — Pruebas Unitarias (Matriz de Trazabilidad)

A continuación se detalla el comportamiento de cada componente sometido a estrés y validación lógica:

### 2.1 Módulo Subyacente: `ai_feedback_metrics.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Periodo Objetivo Adaptativo: **Debería usar max(lead_time * 2, 14) → Lead time 7 → 14 días**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Periodo Objetivo Adaptativo: **Debería escalar con lead times largos → Lead time 10 → 20 días**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Periodo Objetivo Adaptativo: **Debería usar mínimo 14 días si lead time es muy corto**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Periodo Objetivo Adaptativo: **Debería usar fallback de 3 si lead time es null/undefined**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Proyección de Ventas con Ponderación Temporal: **Debería proyectar ventas con ponderación temporal si no ha pasado el periodo completo**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Proyección de Ventas con Ponderación Temporal: **Debería usar ventas reales si ya pasó el periodo completo**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Proyección de Ventas con Ponderación Temporal: **Debería proyectar de forma conservadora con 1 día transcurrido**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Factor de Precisión con Clamping: **Debería calcular factor correcto: IA sugirió 100, se vendieron 50 → 0.5**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Factor de Precisión con Clamping: **Debería calcular factor 1.0 cuando la IA acertó perfectamente**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Factor de Precisión con Clamping: **Debería aplicar clamping mínimo (0.2) si ventas son 0**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Factor de Precisión con Clamping: **Debería aplicar clamping máximo (3.0) si la IA subestimó enormemente**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Factor de Precisión con Clamping: **Debería manejar sugerido = 0 con ventas > 0 → factor fijo 2.0**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Factor de Precisión con Clamping: **Debería manejar ambos en 0 → factor por defecto 1.0**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Veredicto de Precisión: **Factor 1.0 → Acertado**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Veredicto de Precisión: **Factor 0.95 → Acertado (dentro del margen ±10%)**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Veredicto de Precisión: **Factor 0.5 → Sugirió de más**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Veredicto de Precisión: **Factor 1.5 → Sugirió de menos**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Veredicto de Precisión: **Factor 0.2 (mínimo) → Sugirió de más**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Veredicto de Precisión: **Factor 3.0 (máximo) → Sugirió de menos**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Métricas de Error y Sesgo (Error Absoluto, Bias, Error Porcentual): **Debería dar error 0 y bias 0 cuando sugerencia coincide con ventas**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Métricas de Error y Sesgo (Error Absoluto, Bias, Error Porcentual): **Debería calcular bias positivo cuando sugirió de más (sobre-predicción)**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Métricas de Error y Sesgo (Error Absoluto, Bias, Error Porcentual): **Debería calcular bias negativo cuando sugirió de menos (sub-predicción)**
- ✔️ `[Caso de Prueba]` Módulo de Feedback IA (feedbackController.js) > Métricas de Error y Sesgo (Error Absoluto, Bias, Error Porcentual): **Debería manejar ventasReales = 0 sin división por cero ni NaN**

### 2.2 Módulo Subyacente: `ai_recomendaciones_dashboard.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **Excluye los productos con base_load = 0 (stock de sobra), aunque sean los más facturados**
- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **Ordena por urgencia: CRÍTICO antes que MEDIO y BAJO**
- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **A igual riesgo conserva el orden de entrada (los más facturados primero)**
- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **Respeta el límite de productos enviados a la IA**
- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **Devuelve vacío si nada necesita reposición (no hay que llamar a la IA)**
- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **Un riesgo desconocido se trata como el menos urgente**
- ✔️ `[Caso de Prueba]` Consejero IA — recomendación accionable: **Acepta sugerencias de una o más unidades**
- ✔️ `[Caso de Prueba]` Consejero IA — recomendación accionable: **Rechaza 0 unidades, negativos, no numéricos y nulos**

### 2.3 Módulo Subyacente: `analisis_inventario.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` normalizarDiasCobertura (parámetro ?dias= del Simulador de Escenarios): **acepta de 7 a 90 días, también como texto (llega de la URL)**
- ✔️ `[Caso de Prueba]` normalizarDiasCobertura (parámetro ?dias= del Simulador de Escenarios): **fuera de rango, vacío o basura se ignora (cada producto usa su cobertura normal)**
- ✔️ `[Caso de Prueba]` armarSnapshot: **sin productos, lista vacía**
- ✔️ `[Caso de Prueba]` armarSnapshot: **devuelve el contrato que consume el frontend**
- ✔️ `[Caso de Prueba]` armarSnapshot: **un objetivo de cobertura mayor recomienda comprar más**
- ✔️ `[Caso de Prueba]` armarSnapshot: **un producto con stock de sobra no recomienda comprar**

### 2.4 Módulo Subyacente: `arqueo_cierre.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` montoContado (lo que el vendedor escribe en «Efectivo total en cajón»): **acepta un número finito >= 0, también como texto, y el 0**
- ✔️ `[Caso de Prueba]` montoContado (lo que el vendedor escribe en «Efectivo total en cajón»): **rechaza (null) lo vacío, negativo, no numérico o infinito**
- ✔️ `[Caso de Prueba]` describirDiferencia (declarado − esperado): **0 cuadra**
- ✔️ `[Caso de Prueba]` describirDiferencia (declarado − esperado): **positiva sobra y dice cuánto de más**
- ✔️ `[Caso de Prueba]` describirDiferencia (declarado − esperado): **negativa falta y dice cuánto (sin signo menos)**
- ✔️ `[Caso de Prueba]` describirDiferencia (declarado − esperado): **el ruido de decimales no cuenta como diferencia (0,1 + 0,2 − 0,3)**
- ✔️ `[Caso de Prueba]` describirDiferencia (declarado − esperado): **50 centavos de más sí es un sobrante**
- ✔️ `[Caso de Prueba]` elArqueoCambio (vista previa [K5] vs cierre real [K3]): **igual: no cambió**
- ✔️ `[Caso de Prueba]` elArqueoCambio (vista previa [K5] vs cierre real [K3]): **si se vendió algo en medio, cambió lo esperado y la diferencia**
- ✔️ `[Caso de Prueba]` elArqueoCambio (vista previa [K5] vs cierre real [K3]): **sin una de las dos, no se puede comparar: false**
- ✔️ `[Caso de Prueba]` lineasDelArqueo: **muestra el desglose en el orden de la cuenta: fondo, ventas, abonos y egresos**
- ✔️ `[Caso de Prueba]` formatoPesos: **agrupa los miles al estilo colombiano**
- ✔️ `[Caso de Prueba]` lineasPorMetodo (desglose por método de pago): **las ordena siempre igual (efectivo, tarjeta, transferencia, fiado, otro) aunque lleguen desordenadas**
- ✔️ `[Caso de Prueba]` lineasPorMetodo (desglose por método de pago): **con soloConMovimiento deja fuera los métodos sin ventas ni importe**
- ✔️ `[Caso de Prueba]` lineasPorMetodo (desglose por método de pago): **solo el efectivo entra al cajón: tarjeta, transferencia y fiado no**
- ✔️ `[Caso de Prueba]` lineasPorMetodo (desglose por método de pago): **el fiado lleva una etiqueta que aclara que es crédito**
- ✔️ `[Caso de Prueba]` lineasPorMetodo (desglose por método de pago): **un método nuevo que el servidor agregue se muestra al final con su propio nombre (no se pierde)**
- ✔️ `[Caso de Prueba]` lineasPorMetodo (desglose por método de pago): **un importe sin cantidad se sigue mostrando (no se oculta dinero)**
- ✔️ `[Caso de Prueba]` lineasPorMetodo (desglose por método de pago): **sin desglose (un servidor viejo) devuelve una lista vacía en vez de romper**
- ✔️ `[Caso de Prueba]` textoDeVentas: **singular y plural**

### 2.5 Módulo Subyacente: `canal.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` utils/canal.js: **canalDesdeCabecera: solo «app» (sin importar mayúsculas ni espacios) es app; todo lo demás es web**
- ✔️ `[Caso de Prueba]` utils/canal.js: **canalDeSesion: las sesiones sin canal (anteriores al cambio) son web**

### 2.6 Módulo Subyacente: `candado_sesion.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` sesionSigueViva: **la sesión existe en el almacén: el candado sigue en pie**
- ✔️ `[Caso de Prueba]` sesionSigueViva: **la sesión ya NO existe (caducó o se borró): el candado está huérfano**
- ✔️ `[Caso de Prueba]` sesionSigueViva: **sin identificador de sesión guardado no hay candado**
- ✔️ `[Caso de Prueba]` sesionSigueViva: **SI EL ALMACÉN FALLA no se libera el candado (se conserva el bloqueo por seguridad)**
- ✔️ `[Caso de Prueba]` sesionSigueViva: **si el almacén lanza una excepción al consultar, también se conserva el bloqueo**
- ✔️ `[Caso de Prueba]` sesionSigueViva: **un almacén que nunca responde no deja el login colgado: se conserva el bloqueo tras el tiempo de espera**

### 2.7 Módulo Subyacente: `cash_register_helpers.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` evaluarDescuadreCaja: **faltante significativo (> umbral): esSignificativo true, esFaltante true, título y mensaje de faltante**
- ✔️ `[Caso de Prueba]` evaluarDescuadreCaja: **sobrante significativo (> umbral): esFaltante false, título y mensaje de sobrante**
- ✔️ `[Caso de Prueba]` evaluarDescuadreCaja: **diferencia dentro del umbral (±5000, sin exceder): no es significativo**
- ✔️ `[Caso de Prueba]` evaluarDescuadreCaja: **acepta un umbral distinto del default (5000)**
- ✔️ `[Caso de Prueba]` normalizarMontoDeclarado: **acepta un número finito >= 0, incluido el 0 y los decimales**
- ✔️ `[Caso de Prueba]` normalizarMontoDeclarado: **acepta un texto numérico (con espacios alrededor) y lo devuelve como NÚMERO**
- ✔️ `[Caso de Prueba]` normalizarMontoDeclarado: **rechaza (null) lo ausente, negativo, no finito, vacío, de texto o de otro tipo**
- ✔️ `[Caso de Prueba]` desglosePorMetodo (desglose de auditoría del cierre de caja): **sin movimientos: todas las claves conocidas y «Otro», en cero**
- ✔️ `[Caso de Prueba]` desglosePorMetodo (desglose de auditoría del cierre de caja): **separa cada método y entiende las cifras que llegan de PostgreSQL como texto**
- ✔️ `[Caso de Prueba]` desglosePorMetodo (desglose de auditoría del cierre de caja): **un método desconocido (o con otra escritura) NO se pierde: cae en «Otro»**
- ✔️ `[Caso de Prueba]` desglosePorMetodo (desglose de auditoría del cierre de caja): **en los abonos, «Fiado» no es un método de pago: cae en «Otro»**
- ✔️ `[Caso de Prueba]` desglosePorMetodo (desglose de auditoría del cierre de caja): **los importes se redondean a centavos (sin restos de decimales)**
- ✔️ `[Caso de Prueba]` desglosePorMetodo (desglose de auditoría del cierre de caja): **la suma de todos los métodos es el total de las filas (nada se pierde ni se duplica)**

### 2.8 Módulo Subyacente: `dashboard_analytics.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería calcular margen 50% cuando costo = mitad del precio**
- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería calcular margen 0% cuando costo = precio**
- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería promediar múltiples productos**
- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería retornar 0 si no hay productos**
- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería manejar un único producto con precio = 0 sin error (división por cero)**
- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería EXCLUIR del promedio los productos con precio = 0, igual que NULLIF+AVG en SQL**

### 2.9 Módulo Subyacente: `error_handler.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` manejadorErrores (middleware/errorHandler.js): **C4: un CSRF inválido (ForbiddenError de csrf-sync) responde 403 con code CSRF_INVALID, no 500**
- ✔️ `[Caso de Prueba]` manejadorErrores (middleware/errorHandler.js): **el CSRF responde igual en producción: el mensaje no depende de NODE_ENV (antes el 500 se ocultaba tras un texto genérico)**
- ✔️ `[Caso de Prueba]` manejadorErrores (middleware/errorHandler.js): **JSON mal formado → 400; cuerpo demasiado grande → 413; cualquier otro 4xx conserva su código con un mensaje genérico**
- ✔️ `[Caso de Prueba]` manejadorErrores (middleware/errorHandler.js): **un 403 que no es de CSRF no se confunde con él**
- ✔️ `[Caso de Prueba]` manejadorErrores (middleware/errorHandler.js): **Multer: tamaño excedido → 413; otros errores de Multer → 400**
- ✔️ `[Caso de Prueba]` manejadorErrores (middleware/errorHandler.js): **el rechazo del filtro de tipo de archivo sigue siendo 400 con su mensaje**
- ✔️ `[Caso de Prueba]` manejadorErrores (middleware/errorHandler.js): **un error del servidor (sin código HTTP o 5xx) sigue siendo 500: con detalle fuera de producción, genérico en producción**
- ✔️ `[Caso de Prueba]` manejadorErrores (middleware/errorHandler.js): **respuestaDeErrorHttp: solo toma códigos 400-499 enteros**

### 2.10 Módulo Subyacente: `guardia_semilla.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Guardia de la semilla (database/guardiaSemilla.js): **acepta una base de pruebas local**
- ✔️ `[Caso de Prueba]` Guardia de la semilla (database/guardiaSemilla.js): **rechaza cualquier host remoto, incluso si la base se llama _test**
- ✔️ `[Caso de Prueba]` Guardia de la semilla (database/guardiaSemilla.js): **rechaza un host que solo parece local (localhost.evil.com, usuario "localhost@")**
- ✔️ `[Caso de Prueba]` Guardia de la semilla (database/guardiaSemilla.js): **una base local que no termina en _test exige --base-local**
- ✔️ `[Caso de Prueba]` Guardia de la semilla (database/guardiaSemilla.js): **rechaza una DATABASE_URL ausente o inválida**
- ✔️ `[Caso de Prueba]` npm run seed: el script se niega a correr (proceso real, sin conectarse a nada): **con una base remota (tipo Neon) aborta con código 1 y sin cargar la base**
- ✔️ `[Caso de Prueba]` npm run seed: el script se niega a correr (proceso real, sin conectarse a nada): **con una base local que no es _test y sin --base-local aborta con código 1**

### 2.11 Módulo Subyacente: `guardrails_ia.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` aplicarAjusteIA (guardrail de ajuste de IA, ex-duplicado en aiController.js y suppliersController.js): **clase A: permite hasta +100%**
- ✔️ `[Caso de Prueba]` aplicarAjusteIA (guardrail de ajuste de IA, ex-duplicado en aiController.js y suppliersController.js): **clase B: recorta a +50% aunque la IA sugiera más**
- ✔️ `[Caso de Prueba]` aplicarAjusteIA (guardrail de ajuste de IA, ex-duplicado en aiController.js y suppliersController.js): **clase C (o cualquier otra): recorta a +20%**
- ✔️ `[Caso de Prueba]` aplicarAjusteIA (guardrail de ajuste de IA, ex-duplicado en aiController.js y suppliersController.js): **piso de -50% para cualquier clase, incluso si la IA sugiere bajar más**
- ✔️ `[Caso de Prueba]` aplicarAjusteIA (guardrail de ajuste de IA, ex-duplicado en aiController.js y suppliersController.js): **un ajuste dentro de rango no se recorta**
- ✔️ `[Caso de Prueba]` aplicarAjusteIA (guardrail de ajuste de IA, ex-duplicado en aiController.js y suppliersController.js): **redondea finalTotal hacia arriba (Math.ceil)**
- ✔️ `[Caso de Prueba]` aplicarAjusteIA (guardrail de ajuste de IA, ex-duplicado en aiController.js y suppliersController.js): **no esconde una fracción genuina: un resultado real de 1000.00005 sigue redondeando hacia arriba a 1001**

### 2.12 Módulo Subyacente: `ia_candidatos_promocion.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` diasParaVencer: **sin fecha de vencimiento devuelve null (no es lo mismo que 0 días)**
- ✔️ `[Caso de Prueba]` diasParaVencer: **cuenta los días que faltan, con decimales**
- ✔️ `[Caso de Prueba]` elegirCandidatos: qué productos merecen una promoción: **un producto sin ninguna señal no es candidato**
- ✔️ `[Caso de Prueba]` elegirCandidatos: qué productos merecen una promoción: **rotación baja: la última semana vende mucho menos que el mes y hay stock (> 10)**
- ✔️ `[Caso de Prueba]` elegirCandidatos: qué productos merecen una promoción: **rotación baja pero con poco stock (≤ 10) no cuenta**
- ✔️ `[Caso de Prueba]` elegirCandidatos: qué productos merecen una promoción: **por vencer: faltan menos de 30 días**
- ✔️ `[Caso de Prueba]` elegirCandidatos: qué productos merecen una promoción: **sobrestock: más de 50 unidades y se vende menos de 1 por día**
- ✔️ `[Caso de Prueba]` elegirCandidatos: qué productos merecen una promoción: **nunca promociona algo que además hay que reponer (aunque venza pronto)**
- ✔️ `[Caso de Prueba]` elegirCandidatos: qué productos merecen una promoción: **ordena por vencimiento: el que vence antes va primero y los que no vencen, al final**
- ✔️ `[Caso de Prueba]` elegirCandidatos: qué productos merecen una promoción: **devuelve como máximo 10**
- ✔️ `[Caso de Prueba]` elegirCandidatos: qué productos merecen una promoción: **no modifica la lista que recibe**

### 2.13 Módulo Subyacente: `ia_composicion_promociones.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` componerPromociones: lo que propone la IA: **toma el tipo y el descuento de la IA y calcula el impacto financiero**
- ✔️ `[Caso de Prueba]` componerPromociones: lo que propone la IA: **un 2x1 sin porcentaje explícito se corrige a 50%**
- ✔️ `[Caso de Prueba]` componerPromociones: lo que propone la IA: **usa el id de la base de datos, no el que devolvió la IA (cuando coinciden con un candidato)**
- ✔️ `[Caso de Prueba]` componerPromociones: lo que propone la IA: **descarta lo que la IA propone para un producto que no es candidato**
- ✔️ `[Caso de Prueba]` componerPromociones: lo que propone la IA: **isCritical: vence en menos de 10 días**
- ✔️ `[Caso de Prueba]` componerPromociones: motor de reglas de respaldo: **con la IA caída (lista vacía) las reglas cubren el 100% de los candidatos**
- ✔️ `[Caso de Prueba]` componerPromociones: motor de reglas de respaldo: **completa solo lo que la IA omitió, sin duplicar lo que ya cubrió**
- ✔️ `[Caso de Prueba]` componerPromociones: motor de reglas de respaldo: **sin candidatos no hay promociones**

### 2.14 Módulo Subyacente: `ia_contexto_recomendaciones.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` armarRecomendaciones: de lo que dice la IA a la recomendación final: **aplica el ajuste de la IA sobre la cantidad base**
- ✔️ `[Caso de Prueba]` armarRecomendaciones: de lo que dice la IA a la recomendación final: **guardrail: la IA no puede pasarse del tope de su clase (A +100%, B +50%, C +20%)**
- ✔️ `[Caso de Prueba]` armarRecomendaciones: de lo que dice la IA a la recomendación final: **guardrail: la reducción nunca baja de -50%**
- ✔️ `[Caso de Prueba]` armarRecomendaciones: de lo que dice la IA a la recomendación final: **tolera que la IA devuelva el id como texto**
- ✔️ `[Caso de Prueba]` armarRecomendaciones: de lo que dice la IA a la recomendación final: **tolera un ajuste ausente o con texto raro: se trata como 0%**
- ✔️ `[Caso de Prueba]` armarRecomendaciones: de lo que dice la IA a la recomendación final: **descarta ids que la IA inventó**
- ✔️ `[Caso de Prueba]` armarRecomendaciones: de lo que dice la IA a la recomendación final: **descarta las sugerencias de 0 unidades (no son accionables)**
- ✔️ `[Caso de Prueba]` armarRecomendaciones: de lo que dice la IA a la recomendación final: **confianza: el promedio de aciertos en porcentaje; sin historial, 50% (incertidumbre)**
- ✔️ `[Caso de Prueba]` armarRecomendaciones: de lo que dice la IA a la recomendación final: **sin proveedor, devuelve null y no undefined**
- ✔️ `[Caso de Prueba]` armarContextoProductos: cruce con el motor único de reposición: **un producto agotado con ventas pide reposición**
- ✔️ `[Caso de Prueba]` armarContextoProductos: cruce con el motor único de reposición: **un producto con stock de sobra no pide nada**
- ✔️ `[Caso de Prueba]` armarContextoProductos: cruce con el motor único de reposición: **etiqueta la tendencia: alcista si la última semana supera al mes, bajista si cae**
- ✔️ `[Caso de Prueba]` armarContextoProductos: cruce con el motor único de reposición: **pasa la confianza (factor_ia) tal cual, null incluido**
- ✔️ `[Caso de Prueba]` armarContextoProductos: cruce con el motor único de reposición: **lista vacía → lista vacía**

### 2.15 Módulo Subyacente: `ia_hash_y_historial.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` hashIA: **es MD5 hexadecimal de 32 caracteres (cabe en Cache_IA.data_hash VARCHAR(32))**
- ✔️ `[Caso de Prueba]` hashIA: **un objeto se hashea como su JSON: mismo hash que producía el controlador original**
- ✔️ `[Caso de Prueba]` hashIA: **un texto se hashea tal cual (sin volver a serializarlo con comillas): compatible con las promociones ya guardadas**
- ✔️ `[Caso de Prueba]` hashIA: **datos distintos → hash distinto; mismos datos → mismo hash**
- ✔️ `[Caso de Prueba]` hashIA: **claves de caché por tienda: no se pisan entre tiendas ni entre usos**
- ✔️ `[Caso de Prueba]` armarHistorialCredito: **suma lo fiado y lo abonado y calcula el saldo pendiente**
- ✔️ `[Caso de Prueba]` armarHistorialCredito: **los montos que llegan como texto (NUMERIC de Postgres) se suman como números**
- ✔️ `[Caso de Prueba]` armarHistorialCredito: **sin movimientos: todo en cero**
- ✔️ `[Caso de Prueba]` armarHistorialCredito: **PRIVACIDAD (Ley 1581): no incluye el nombre ni el celular del cliente**

### 2.16 Módulo Subyacente: `ia_openai_client.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` asegurarApiKey: **lanza IANoConfiguradaError si no hay clave**
- ✔️ `[Caso de Prueba]` asegurarApiKey: **lanza si la clave sigue siendo el valor de ejemplo del .env**
- ✔️ `[Caso de Prueba]` asegurarApiKey: **con una clave real no lanza**
- ✔️ `[Caso de Prueba]` asegurarApiKey: **el mensaje es el mismo que ya veía el frontend**
- ✔️ `[Caso de Prueba]` errores de dominio: **se distinguen por clase, no por el texto del mensaje**
- ✔️ `[Caso de Prueba]` pedirJSON: **pide modo JSON con el modelo único y devuelve la respuesta ya parseada**
- ✔️ `[Caso de Prueba]` pedirJSON: **solo envía temperature cuando el caso de uso la fija**
- ✔️ `[Caso de Prueba]` pedirJSON: **si el modelo no responde JSON, falla (el servicio decide cómo degradar)**
- ✔️ `[Caso de Prueba]` pedirJSON: **si OpenAI falla, el error se propaga tal cual**

### 2.17 Módulo Subyacente: `ia_prompts.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` mensajesRecomendaciones: **envía un mensaje de sistema y uno de usuario**
- ✔️ `[Caso de Prueba]` mensajesRecomendaciones: **el sistema fija los límites por clase y el formato de respuesta**
- ✔️ `[Caso de Prueba]` mensajesRecomendaciones: **el usuario lleva los productos críticos como JSON**
- ✔️ `[Caso de Prueba]` mensajesPromociones: **incluye el contexto del dueño dentro del mensaje de sistema**
- ✔️ `[Caso de Prueba]` mensajesPromociones: **sin contexto del dueño no deja rastro ("undefined") en el texto**
- ✔️ `[Caso de Prueba]` mensajesPromociones: **exige una sugerencia por cada producto y limita el descuento**
- ✔️ `[Caso de Prueba]` contextoPromocionesDelDueno: **sin ejemplos devuelve cadena vacía**
- ✔️ `[Caso de Prueba]` contextoPromocionesDelDueno: **lista cada decisión previa del dueño**
- ✔️ `[Caso de Prueba]` mensajesRiesgoCliente: **devuelve el prompt de usuario aparte porque también se guarda en la auditoría**
- ✔️ `[Caso de Prueba]` mensajesRiesgoCliente: **envía exactamente el historial que recibe (el servicio decide qué datos entran)**
- ✔️ `[Caso de Prueba]` mensajesRiesgoCliente: **pide un perfil y un riesgo con valores cerrados**

### 2.18 Módulo Subyacente: `input_sanitization.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > sanitize() — Escape HTML: **Debería escapar etiquetas HTML (<script>)**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > sanitize() — Escape HTML: **Debería escapar comillas dobles**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > sanitize() — Escape HTML: **Debería escapar comillas simples**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > sanitize() — Escape HTML: **Debería escapar ampersands**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > sanitize() — Escape HTML: **Debería escapar el signo mayor que**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > sanitize() — Escape HTML: **Debería aplicar trim (eliminar espacios al inicio y final)**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > sanitize() — Escape HTML: **Debería retornar el valor original si no es un string**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > sanitize() — Escape HTML: **Debería manejar string vacío**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > sanitize() — Escape HTML: **Debería manejar strings con múltiples caracteres peligrosos**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateLogin() — Lógica de validación: **Debería pasar con todos los campos completos y rol válido**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateLogin() — Lógica de validación: **Debería rechazar si falta el login**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateLogin() — Lógica de validación: **Debería rechazar si falta el password**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateLogin() — Lógica de validación: **Debería rechazar si falta el rol**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateLogin() — Lógica de validación: **Debería rechazar un rol no válido**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateLogin() — Lógica de validación: **Debería aceptar el rol Tendero**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateRegister() — Lógica de validación: **Debería pasar con datos completos y válidos**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateRegister() — Lógica de validación: **Debería rechazar si falta el nombre**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateRegister() — Lógica de validación: **Debería rechazar email inválido (sin @)**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateRegister() — Lógica de validación: **Debería rechazar email inválido (sin dominio)**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateRegister() — Lógica de validación: **Debería rechazar contraseña menor a 4 caracteres**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateRegister() — Lógica de validación: **Debería aceptar contraseña de exactamente 4 caracteres**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateProduct() — Lógica de validación: **Debería pasar con código de barras obligatorio y asignar SKU por defecto**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateProduct() — Lógica de validación: **Debería pasar y respetar código SKU si viene explícito**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateProduct() — Lógica de validación: **Debería aceptar código SKU como fallback retrocompatible si no viene código de barras**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateProduct() — Lógica de validación: **Debería rechazar si no viene ni código de barras ni SKU**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateProduct() — Lógica de validación: **Debería rechazar sin nombre de producto**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateProduct() — Lógica de validación: **Debería rechazar precio negativo**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateProduct() — Lógica de validación: **Debería aceptar precio = 0 (producto gratuito)**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateProduct() — Lógica de validación: **Debería rechazar cantidad negativa**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateProduct() — Lógica de validación: **Debería rechazar precio no numérico**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateSale() — Lógica de validación: **Debería pasar con producto y cantidad válidos**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateSale() — Lógica de validación: **Debería rechazar sin id_producto**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateSale() — Lógica de validación: **Debería rechazar sin cantidad**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateSale() — Lógica de validación: **Debería rechazar cantidad = 0**
- ✔️ `[Caso de Prueba]` Middleware de Validación (validation.js) > validateSale() — Lógica de validación: **Debería rechazar cantidad negativa**

### 2.19 Módulo Subyacente: `inventory_math.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Clasificación ABC Pareto: **Debería asignar A al producto con mayor ingreso (top 80%)**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Clasificación ABC Pareto: **Debería ordenar productos de mayor a menor ingreso**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Clasificación ABC Pareto: **Debería manejar productos sin ventas (velocity = 0)**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Clasificación ABC Pareto: **Debería manejar productos con propiedades indefinidas (fallbacks a 0)**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Clasificación ABC Pareto: **Debería clasificar correctamente con distribución equilibrada**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Alertas de Vencimiento (Cruce con Velocidad): **Debería generar vencimiento_critico si vence en ≤7 días y quedarán sobrantes**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Alertas de Vencimiento (Cruce con Velocidad): **Debería generar vencimiento_proximo si vence en ≤30 días con sobrantes**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Alertas de Vencimiento (Cruce con Velocidad): **No debería generar alerta si alcanzamos a vender todo**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Alertas de Vencimiento (Cruce con Velocidad): **No debería generar alerta si vence en más de 30 días**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Sobrestock (Capital Estancado): **Debería detectar sobrestock: clase C, sobre máximo, +60 días de stock**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Sobrestock (Capital Estancado): **No debería marcar sobrestock si es clase A (producto importante)**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Sobrestock (Capital Estancado): **No debería marcar sobrestock si no supera el máximo**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > Sobrestock (Capital Estancado): **No debería marcar sobrestock si se agota en menos de 60 días**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > evaluarProducto (motor unificado, plan 17 O8): **Regresión E1: producto agotado, sin ventas y stockSeguridad en 0 SÍ genera stock_critico**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > evaluarProducto (motor unificado, plan 17 O8): **Genera stock_bajo cuando el agotamiento cae dentro de la ventana de reorden**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > evaluarProducto (motor unificado, plan 17 O8): **No genera ninguna alerta para un producto sano**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > evaluarProducto (motor unificado, plan 17 O8): **Genera vencimiento_critico cuando aplica, incluso con el stock sano**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > evaluarProducto (motor unificado, plan 17 O8): **Genera vencimiento_proximo (8-30 días) en vez de crítico**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > evaluarProducto (motor unificado, plan 17 O8): **Genera sobrestock cuando aplica, sin ventas para medir agotamiento**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > evaluarProducto (motor unificado, plan 17 O8): **Puede devolver más de una alerta a la vez para el mismo producto**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > evaluarProducto (motor unificado, plan 17 O8): **Usa 3 días de lead time por defecto cuando el producto no tiene lead_time configurado**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > evaluarProducto (motor unificado, plan 17 O8): **Crítico por debajo de stock de seguridad, sin ventas y con stock > 0: mensaje distinto al de "sin stock"**
- ✔️ `[Caso de Prueba]` Motor Matemático de Alertas (Alert.js) > evaluarProducto (motor unificado, plan 17 O8): **No genera alerta de vencimiento si la fecha está a más de 30 días, aunque venga informada**

### 2.20 Módulo Subyacente: `menu_modo_basico.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` enlacesDelMenu en modo avanzado (el menú de siempre): **el Administrador ve los 17 enlaces (los 16 de siempre más «¿Qué pido?»)**
- ✔️ `[Caso de Prueba]` enlacesDelMenu en modo avanzado (el menú de siempre): **el Colaborador solo ve lo que no es del Administrador**
- ✔️ `[Caso de Prueba]` enlacesDelMenu en modo avanzado (el menú de siempre): **conserva los id que usan el tour y las pruebas, y el texto de «Mis Tiendas» solo para el Administrador**
- ✔️ `[Caso de Prueba]` enlacesDelMenu en modo básico (menú reducido): **el Administrador ve Vista general, Punto de Venta, Catálogo, «¿Qué pido?», Alertas y Mi Perfil**
- ✔️ `[Caso de Prueba]` enlacesDelMenu en modo básico (menú reducido): **el Colaborador ve lo mismo salvo «¿Qué pido?», que mueve dinero y es solo del Administrador**
- ✔️ `[Caso de Prueba]` enlacesDelMenu en modo básico (menú reducido): **oculta lo avanzado, pero ocultar no es conceder: un Colaborador nunca ve enlaces de Administrador**
- ✔️ `[Caso de Prueba]` enlacesDelMenu en modo básico (menú reducido): **el modo básico siempre es un subconjunto del avanzado**
- ✔️ `[Caso de Prueba]` ante un modo desconocido o ausente no se esconde nada: **modo undefined enseña el menú completo**
- ✔️ `[Caso de Prueba]` ante un modo desconocido o ausente no se esconde nada: **modo null enseña el menú completo**
- ✔️ `[Caso de Prueba]` ante un modo desconocido o ausente no se esconde nada: **modo  enseña el menú completo**
- ✔️ `[Caso de Prueba]` ante un modo desconocido o ausente no se esconde nada: **modo experto enseña el menú completo**
- ✔️ `[Caso de Prueba]` ante un modo desconocido o ausente no se esconde nada: **modo BASICO enseña el menú completo**
- ✔️ `[Caso de Prueba]` modoOpuesto: **alterna entre los dos modos y cualquier otra cosa lleva a básico**
- ✔️ `[Caso de Prueba]` modoOpuesto: **la lista de modos coincide con la que acepta el servidor**

### 2.21 Módulo Subyacente: `pedir_modo_basico.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` sugerenciasDePedido: qué entra: **ofrece agotados, críticos y por reponer; un producto sano («ok») no, aunque traiga cantidad calculada**
- ✔️ `[Caso de Prueba]` sugerenciasDePedido: qué entra: **lo que ya está en un pedido en borrador no se vuelve a ofrecer, y se cuenta aparte**
- ✔️ `[Caso de Prueba]` sugerenciasDePedido: qué entra: **un producto AGOTADO con cantidad 0 no se puede pedir: se avisa aparte en vez de esconderlo**
- ✔️ `[Caso de Prueba]` sugerenciasDePedido: qué entra: **un producto «por reponer» con cantidad 0 (objetivo ya cubierto) no se pide ni se avisa: no hay nada que hacer**
- ✔️ `[Caso de Prueba]` sugerenciasDePedido: qué entra: **sin datos o con listas vacías no falla**
- ✔️ `[Caso de Prueba]` sugerenciasDePedido: qué entra: **la cantidad y el costo pueden llegar como texto**
- ✔️ `[Caso de Prueba]` sugerenciasDePedido: cómo se agrupa y ordena: **un grupo por proveedor, con el total de cantidad × costo**
- ✔️ `[Caso de Prueba]` sugerenciasDePedido: cómo se agrupa y ordena: **los productos sin proveedor van aparte, no dentro de un grupo**
- ✔️ `[Caso de Prueba]` sugerenciasDePedido: cómo se agrupa y ordena: **el proveedor con lo más urgente va primero, y dentro de cada grupo lo más urgente primero**
- ✔️ `[Caso de Prueba]` sugerenciasDePedido: cómo se agrupa y ordena: **avisa si algún costo es estimado (el producto no tiene costo de compra)**
- ✔️ `[Caso de Prueba]` cuerpoParaArmar: **manda producto, cantidad, base y urgencia, sin ajuste de IA**
- ✔️ `[Caso de Prueba]` cuerpoParaArmar: **manda como máximo 50 productos (el servidor rechaza más)**
- ✔️ `[Caso de Prueba]` listas de órdenes: **por aprobar: Borrador y Pendiente**
- ✔️ `[Caso de Prueba]` listas de órdenes: **por recibir: Aprobada, Enviada y Parcial; las Completadas y Rechazadas no**
- ✔️ `[Caso de Prueba]` listas de órdenes: **sin historial no falla**
- ✔️ `[Caso de Prueba]` recepción de mercancía: **pendienteDeLinea: lo pedido menos lo ya recibido, nunca negativo**
- ✔️ `[Caso de Prueba]` recepción de mercancía: **llegadaValida acepta enteros de 0 a 100000 y rechaza el resto**
- ✔️ `[Caso de Prueba]` recepción de mercancía: **el cuerpo lleva el TOTAL recibido de cada línea: lo ya registrado más lo que llegó ahora**
- ✔️ `[Caso de Prueba]` recepción de mercancía: **una línea sin nada escrito cuenta como 0 que llegó, y conserva lo ya recibido**
- ✔️ `[Caso de Prueba]` recepción de mercancía: **un valor inválido en cualquier línea impide enviar y dice cuál producto revisar**
- ✔️ `[Caso de Prueba]` recepción de mercancía: **cerrar con faltante y confirmar exceso (con motivo) solo se mandan cuando se piden**
- ✔️ `[Caso de Prueba]` recepción de mercancía: **quedaraFaltante: solo si con lo que llegó ahora alguna línea sigue incompleta**

### 2.22 Módulo Subyacente: `politica_dos_factores.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` politicaActiva: **está apagada por defecto y solo se enciende con el texto exacto «true»**
- ✔️ `[Caso de Prueba]` rutaExentaDe2FA: **exime las rutas de acceso, de la propia cuenta y de notificaciones**
- ✔️ `[Caso de Prueba]` rutaExentaDe2FA: **NO exime ninguna ruta de negocio**
- ✔️ `[Caso de Prueba]` rutaExentaDe2FA: **exige el límite de segmento: «/2fax» o «/perfiles» no cuelgan de «/2fa» ni de «/perfil»**
- ✔️ `[Caso de Prueba]` rutaExentaDe2FA: **la lista de exentas es corta (cada ruta nueva exenta debe justificarse)**
- ✔️ `[Caso de Prueba]` debeComprobar2FA: **con la política apagada nunca comprueba**
- ✔️ `[Caso de Prueba]` debeComprobar2FA > con la política encendida: **comprueba las escrituras de un Administrador**
- ✔️ `[Caso de Prueba]` debeComprobar2FA > con la política encendida: **no comprueba las lecturas**
- ✔️ `[Caso de Prueba]` debeComprobar2FA > con la política encendida: **no comprueba rutas exentas aunque sea una escritura**
- ✔️ `[Caso de Prueba]` debeComprobar2FA > con la política encendida: **no es asunto de esta política quien no es Administrador o no tiene sesión**

### 2.23 Módulo Subyacente: `product_polymorphism.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductFactory.create() — Selector polimórfico: **Debería crear un PerishableProduct cuando tipo es "Perecedero"**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductFactory.create() — Selector polimórfico: **Debería crear un NonPerishableProduct cuando tipo es "No Perecedero"**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductFactory.create() — Selector polimórfico: **Debería crear un DigitalProduct cuando tipo es "Digital"**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductFactory.create() — Selector polimórfico: **Debería crear NonPerishableProduct por defecto si no se pasa tipo**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductFactory.create() — Selector polimórfico: **Debería crear NonPerishableProduct para tipos desconocidos (fallback)**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductFactory.create() — Selector polimórfico: **Todas las instancias deberían heredar de ProductBase**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductBase — Defaults y validación: **Debería aplicar valores por defecto si no se pasan datos**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductBase — Defaults y validación: **Debería permitir sobreescribir los defaults con datos del usuario**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductBase — Defaults y validación: **validate() debería fallar si no hay nombre de producto**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductBase — Defaults y validación: **validate() debería fallar si el precio es negativo**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductBase — Defaults y validación: **validate() debería pasar con datos válidos**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductBase.toDBRecord() — Conversión a registro SQL: **Debería convertir precio a float**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductBase.toDBRecord() — Conversión a registro SQL: **Debería convertir cantidad a integer**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductBase.toDBRecord() — Conversión a registro SQL: **Debería poner id_proveedor como null si no se pasa**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductBase.toDBRecord() — Conversión a registro SQL: **Debería convertir id_proveedor a integer si se pasa como string**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > ProductBase.toDBRecord() — Conversión a registro SQL: **Debería usar defaults para stock_minimo y lead_time si no se pasan**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > PerishableProduct — Validación de vencimiento: **Debería fallar si falla la validación base (ej. precio negativo)**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > PerishableProduct — Validación de vencimiento: **Debería fallar si no tiene fecha de vencimiento**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > PerishableProduct — Validación de vencimiento: **Debería fallar si la fecha de vencimiento es pasada**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > PerishableProduct — Validación de vencimiento: **Debería pasar con fecha de vencimiento futura**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > PerishableProduct — Validación de vencimiento: **Debería tener defaults diferentes a NonPerishable (stock_minimo más alto)**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > PerishableProduct — Validación de vencimiento: **Debería tener lead_time más corto que no perecedero**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > DigitalProduct — Producto intangible: **Debería tener stock virtualmente infinito por defecto**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > DigitalProduct — Producto intangible: **Debería tener lead_time = 0 (entrega inmediata)**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > DigitalProduct — Producto intangible: **Debería tener stock_minimo = 0 (no requiere stock físico)**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > DigitalProduct — Producto intangible: **validate() debería pasar sin fecha de vencimiento**
- ✔️ `[Caso de Prueba]` Patrón Factory Method (ProductFactory.js) > DigitalProduct — Producto intangible: **validate() debería fallar sin nombre igual que los demás**

### 2.24 Módulo Subyacente: `promociones.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` normalizarDescuento (corrección de descuento efectivo de la IA): **2x1 sin porcentaje explícito (0) se corrige a 50%**
- ✔️ `[Caso de Prueba]` normalizarDescuento (corrección de descuento efectivo de la IA): **2x1 con porcentaje explícito no se toca (la IA ya lo puso)**
- ✔️ `[Caso de Prueba]` normalizarDescuento (corrección de descuento efectivo de la IA): **otros tipos de promoción no se corrigen**
- ✔️ `[Caso de Prueba]` normalizarDescuento (corrección de descuento efectivo de la IA): **discount undefined/null se trata como 0**
- ✔️ `[Caso de Prueba]` calcularImpactoPromocion (ex-duplicado dentro de aiController.js): **calcula precio con descuento y capital liberado**
- ✔️ `[Caso de Prueba]` calcularImpactoPromocion (ex-duplicado dentro de aiController.js): **sin descuento (0%): el precio no cambia**
- ✔️ `[Caso de Prueba]` calcularImpactoPromocion (ex-duplicado dentro de aiController.js): **descuento del 50% (equivalente al caso 2x1)**
- ✔️ `[Caso de Prueba]` calcularImpactoPromocion (ex-duplicado dentro de aiController.js): **redondea discountedPrice y capitalLiberado al peso más cercano**
- ✔️ `[Caso de Prueba]` determinarPromocionFallback (reglas deterministas cuando la IA no cubre un candidato): **vence en 10 días o menos: liquidación al 25%, duración = días restantes (mínimo 3)**
- ✔️ `[Caso de Prueba]` determinarPromocionFallback (reglas deterministas cuando la IA no cubre un candidato): **vence en 10 días o menos: duration_days nunca baja de 3**
- ✔️ `[Caso de Prueba]` determinarPromocionFallback (reglas deterministas cuando la IA no cubre un candidato): **vence entre 11 y 30 días: descuento moderado del 15% por 7 días**
- ✔️ `[Caso de Prueba]` determinarPromocionFallback (reglas deterministas cuando la IA no cubre un candidato): **no vence (null) pero hay sobrestock (>50): combo al 10% por 14 días**
- ✔️ `[Caso de Prueba]` determinarPromocionFallback (reglas deterministas cuando la IA no cubre un candidato): **no vence y sin sobrestock: descuento genérico del 15% por 10 días (baja rotación)**

### 2.25 Módulo Subyacente: `redondeo.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` techoSeguro (Math.ceil sin el ruido de punto flotante de JS): **absorbe el ruido cuando el resultado real es un entero exacto (2.2 * 25 = 55.00000000000001)**
- ✔️ `[Caso de Prueba]` techoSeguro (Math.ceil sin el ruido de punto flotante de JS): **absorbe el ruido cuando el resultado real es un entero exacto (200 * 1.1 = 220.00000000000003)**
- ✔️ `[Caso de Prueba]` techoSeguro (Math.ceil sin el ruido de punto flotante de JS): **no esconde una fracción genuina: sigue redondeando hacia arriba**
- ✔️ `[Caso de Prueba]` techoSeguro (Math.ceil sin el ruido de punto flotante de JS): **un entero exacto (sin ruido) se mantiene igual**
- ✔️ `[Caso de Prueba]` techoSeguro (Math.ceil sin el ruido de punto flotante de JS): **funciona igual con valores negativos**

### 2.26 Módulo Subyacente: `reposicion.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` calcularReposicion: **stock sobrado: cantidad 0 y puede esperar**
- ✔️ `[Caso de Prueba]` calcularReposicion: **crítico: alcanza para menos días que el proveedor tarda → Pide hoy**
- ✔️ `[Caso de Prueba]` calcularReposicion: **alcanza para lead_time + frecuencia_compra_dias (default 7) → En esta compra**
- ✔️ `[Caso de Prueba]` calcularReposicion: **frecuenciaCompraDias distinto de 7 mueve la ventana (plan 17, decisión 2)**
- ✔️ `[Caso de Prueba]` calcularReposicion: **sin ventas y stock crítico → Pide hoy aunque no haya días para agotar que calcular (caso Leche Alquería)**
- ✔️ `[Caso de Prueba]` calcularReposicion: **sin ventas pero con stock sano (no crítico) → Puede esperar**
- ✔️ `[Caso de Prueba]` calcularReposicion: **crítico pero con ventas que dan muchos días de cobertura → manda el cálculo real, no el riesgo (caso Papas Margarita)**
- ✔️ `[Caso de Prueba]` calcularReposicion: **sin stock y con demanda → Pide hoy**
- ✔️ `[Caso de Prueba]` calcularReposicion: **sin stock, sin ventas y stockSeguridad en 0 (el valor por defecto) → Pide hoy igual (plan 17, hallazgo E1)**
- ✔️ `[Caso de Prueba]` calcularReposicion: **stockMinimo es piso de cantidad para un producto sin historial (plan 17, decisión 4)**
- ✔️ `[Caso de Prueba]` calcularReposicion: **stockMinimo nunca decide "agotado" ni "crítico", solo el piso de "reponer" (plan 17, decisión 4)**
- ✔️ `[Caso de Prueba]` calcularReposicion: **nivel: agotado > crítico > reponer > ok, en ese orden**
- ✔️ `[Caso de Prueba]` calcularReposicion: **stock objetivo por clase ABC (A=15, B=30, C=45 días)**
- ✔️ `[Caso de Prueba]` calcularReposicion: **lead_time por defecto (3 días) si falta**
- ✔️ `[Caso de Prueba]` calcularReposicion: **diasCoberturaOverride reemplaza el DIAS_COBERTURA fijo por ABC (plan 18, Simulador)**
- ✔️ `[Caso de Prueba]` calcularReposicion: **diasCoberturaOverride no afecta el piso de un producto sin ventas (plan 18)**
- ✔️ `[Caso de Prueba]` calcularReposicion: **ruido de punto flotante (2.2 * 25 = 55.00000000000001 en JS) no debe subir rop ni nivel a "reponer" de más (plan 20, corrección de redondeo)**
- ✔️ `[Caso de Prueba]` calcularTendencia: **se acota entre 0,5 y 2**
- ✔️ `[Caso de Prueba]` calcularTendencia: **con muestra pequeña no exagera**
- ✔️ `[Caso de Prueba]` costoUnitario: **usa costo_compra si existe**
- ✔️ `[Caso de Prueba]` costoUnitario: **si es 0 o nulo estima con el margen y lo marca**
- ✔️ `[Caso de Prueba]` agruparPorProveedor: **agrupa por proveedor, separa sin proveedor y omite cantidad 0 y duplicados**
- ✔️ `[Caso de Prueba]` agruparPorProveedor: **total = Σ cantidad × costo**
- ✔️ `[Caso de Prueba]` evaluarRiesgoOrden: **excede el presupuesto → Alto, aunque no haya productos críticos ni en alerta**
- ✔️ `[Caso de Prueba]` evaluarRiesgoOrden: **presupuesto excedido manda sobre productos críticos (se evalúa primero)**
- ✔️ `[Caso de Prueba]` evaluarRiesgoOrden: **dentro de presupuesto pero con productos críticos → Alto**
- ✔️ `[Caso de Prueba]` evaluarRiesgoOrden: **dentro de presupuesto, sin críticos, con productos en alerta (naranja) → Medio**
- ✔️ `[Caso de Prueba]` evaluarRiesgoOrden: **dentro de presupuesto, sin críticos ni alertas → Bajo**

### 2.27 Módulo Subyacente: `respaldo_local_entorno.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` debeProgramarRespaldoLocal(): si el cron interno de respaldo debe programarse: **en producción, no**
- ✔️ `[Caso de Prueba]` debeProgramarRespaldoLocal(): si el cron interno de respaldo debe programarse: **fuera de producción (test, development, undefined), sí**
- ✔️ `[Caso de Prueba]` debeProgramarRespaldoLocal(): si el cron interno de respaldo debe programarse: **sin argumento, usa process.env.NODE_ENV**

### 2.28 Módulo Subyacente: `security_2fa_frontend.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` esBloqueoPorDosFactores (el servidor decidió; el navegador solo reacciona): **reconoce el 403 con el code de la política de 2FA**
- ✔️ `[Caso de Prueba]` esBloqueoPorDosFactores (el servidor decidió; el navegador solo reacciona): **no confunde otros 403 (sin permisos de administrador, CSRF…) con el bloqueo por 2FA**
- ✔️ `[Caso de Prueba]` esBloqueoPorDosFactores (el servidor decidió; el navegador solo reacciona): **el code solo cuenta con status 403**
- ✔️ `[Caso de Prueba]` esBloqueoPorDosFactores (el servidor decidió; el navegador solo reacciona): **tolera errores sin respuesta (red caída, cancelación) y valores vacíos**
- ✔️ `[Caso de Prueba]` debeMostrarAvisoDosFactores (el aviso informa que la función existe): **se muestra a quien tiene el 2FA pendiente de activar**
- ✔️ `[Caso de Prueba]` debeMostrarAvisoDosFactores (el aviso informa que la función existe): **no se muestra si ya lo activó, si no aplica (Tendero) o sin sesión**
- ✔️ `[Caso de Prueba]` contrato del evento: **el nombre del evento es estable (lo emite AuthContext y lo escucha el layout)**

### 2.29 Módulo Subyacente: `security_auth_rules.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Middleware de Seguridad - Lógica auth.js > requireLogin: **Debería permitir el paso si hay userId y la sesión es válida**
- ✔️ `[Caso de Prueba]` Middleware de Seguridad - Lógica auth.js > requireLogin: **Debería denegar acceso si no hay sesión**
- ✔️ `[Caso de Prueba]` Middleware de Seguridad - Lógica auth.js > requireLogin: **Debería denegar acceso si la sesión no tiene userId**
- ✔️ `[Caso de Prueba]` Middleware de Seguridad - Lógica auth.js > requireLogin: **Debería detectar sesión concurrente si isSessionValid es false**
- ✔️ `[Caso de Prueba]` Middleware de Seguridad - Lógica auth.js > requireLogin: **Debería priorizar no_auth sobre concurrent si no hay userId**
- ✔️ `[Caso de Prueba]` Middleware de Seguridad - Lógica auth.js > requireLogin: **Debería permitir múltiples sesiones concurrentes para el rol Administrador**
- ✔️ `[Caso de Prueba]` Middleware de Seguridad - Lógica auth.js > requireAdmin: **Debería permitir el paso si el rol es Administrador**
- ✔️ `[Caso de Prueba]` Middleware de Seguridad - Lógica auth.js > requireAdmin: **Debería denegar acceso si el rol es Colaborador**
- ✔️ `[Caso de Prueba]` Middleware de Seguridad - Lógica auth.js > requireAdmin: **Debería denegar acceso si no hay sesión**
- ✔️ `[Caso de Prueba]` Middleware de Seguridad - Lógica auth.js > requireAdmin: **Debería denegar acceso si el rol no está definido**

### 2.30 Módulo Subyacente: `sugerencias_stock.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` sugerirUmbralesStock (umbrales de reorder point sin historial propio): **calcula stock de seguridad como colchón de 2 días de venta**
- ✔️ `[Caso de Prueba]` sugerirUmbralesStock (umbrales de reorder point sin historial propio): **calcula stock mínimo como ventas durante el lead time + el colchón**
- ✔️ `[Caso de Prueba]` sugerirUmbralesStock (umbrales de reorder point sin historial propio): **redondea hacia arriba (Math.ceil) cuando las ventas diarias no son enteras**
- ✔️ `[Caso de Prueba]` sugerirUmbralesStock (umbrales de reorder point sin historial propio): **aplica el piso mínimo de stockSeguridad=2 cuando las ventas son casi nulas**
- ✔️ `[Caso de Prueba]` sugerirUmbralesStock (umbrales de reorder point sin historial propio): **aplica el piso mínimo de stockMinimo=5 cuando el cálculo da menos**
- ✔️ `[Caso de Prueba]` sugerirUmbralesStock (umbrales de reorder point sin historial propio): **ruido de punto flotante (2.2 * 25 = 55.00000000000001 en JS) no debe sumar una unidad de más a stockMinimo**
- ✔️ `[Caso de Prueba]` sugerirUmbralesStock (umbrales de reorder point sin historial propio): **ruido de punto flotante (1.12 * 25 = 28.000000000000004 en JS) no debe sumar una unidad de más a stockMinimo**


---

## 3. Detalle de Certificación por Flujo — Pruebas de Integración

Ejecutadas contra Postgres real (`stockpilot_test`), sobre la aplicación completa vía HTTP real (supertest) — sin mocks de base de datos:

### 3.1 Flujo: `aislamiento_feedback.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` C2. Evaluación de IA de una orden: aislamiento entre tiendas y solo Administrador: **el Administrador de OTRA tienda recibe 404, sin datos de la orden y sin escribir en Feedback_IA**
- ✔️ `[Caso de Prueba]` C2. Evaluación de IA de una orden: aislamiento entre tiendas y solo Administrador: **un Tendero (de la misma tienda o de otra) recibe 403 y no se escribe nada**
- ✔️ `[Caso de Prueba]` C2. Evaluación de IA de una orden: aislamiento entre tiendas y solo Administrador: **el Administrador de la tienda dueña sí la evalúa**

### 3.2 Flujo: `aislamiento_multitienda.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Aislamiento multi-tienda: **Productos: la lista de una tienda nunca incluye productos de otra**
- ✔️ `[Caso de Prueba]` Aislamiento multi-tienda: **Productos: ver/editar/eliminar un producto de otra tienda por su ID da 404 (guard IDOR ya existente)**
- ✔️ `[Caso de Prueba]` Aislamiento multi-tienda: **Ventas: comprar un producto de otra tienda da 404, y el listado de ventas nunca mezcla tiendas**
- ✔️ `[Caso de Prueba]` Aislamiento multi-tienda: **Proveedores: actualizar el propio (misma tienda) sigue funcionando después del arreglo de la sección 8.12**
- ✔️ `[Caso de Prueba]` Aislamiento multi-tienda: **Proveedores: la lista de una tienda nunca incluye proveedores de otra**
- ✔️ `[Caso de Prueba]` Aislamiento multi-tienda: **Proveedores: actualizar/eliminar el de otra tienda da 404 y no lo modifica (corregido, ver plan sección 8.12)**

### 3.3 Flujo: `aislamiento_reportes.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` C1. Reportes: aislamiento entre tiendas y solo Administrador para editar/borrar: **el Administrador de la tienda edita y borra su propio reporte**
- ✔️ `[Caso de Prueba]` C1. Reportes: aislamiento entre tiendas y solo Administrador para editar/borrar: **un Tendero, ni siquiera de la misma tienda, puede editar o borrar reportes: 403 y la fila no cambia**
- ✔️ `[Caso de Prueba]` C1. Reportes: aislamiento entre tiendas y solo Administrador para editar/borrar: **el Administrador de OTRA tienda no puede editar, borrar ni descargar el reporte: 404 y la fila no cambia**
- ✔️ `[Caso de Prueba]` C1. Reportes: aislamiento entre tiendas y solo Administrador para editar/borrar: **la tienda dueña sí descarga su reporte**
- ✔️ `[Caso de Prueba]` C1. Reportes: aislamiento entre tiendas y solo Administrador para editar/borrar: **un id que no existe o no es numérico da 404, no 500**

### 3.4 Flujo: `alertas_test_summary.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` C3. POST /api/alertas/test-summary solo para el Administrador: **un Tendero recibe 403 (y por tanto no se envía ningún correo)**

### 3.5 Flujo: `alert_generate_concurrencia.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Alert.generate() con concurrencia: **5 llamadas concurrentes a generar alertas de la misma tienda: nunca duplica la alerta del mismo producto**
- ✔️ `[Caso de Prueba]` Alert.generate() con concurrencia: **dos tiendas distintas generando alertas al mismo tiempo: el lock es por tienda, ninguna bloquea a la otra ni se mezclan sus alertas**
- ✔️ `[Caso de Prueba]` Alert.generate() con concurrencia: **generar dos veces seguidas (secuencial): la alerta se actualiza en el mismo lugar, no se duplica ni cambia su fecha_creacion**
- ✔️ `[Caso de Prueba]` Alert.generate() con concurrencia: **producto que deja de estar crítico: la siguiente generación resuelve la alerta vieja (no queda activa)**
- ✔️ `[Caso de Prueba]` Alert.generate() con concurrencia: **DISABLE_ALERT_ENGINE=true: generate() no crea nada y devuelve 0 (interruptor de emergencia, plan 17 O8)**

### 3.6 Flujo: `autenticacion.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Autenticación: **login con credenciales correctas: 200, éxito, y la sesión queda funcional para pedir datos protegidos**
- ✔️ `[Caso de Prueba]` Autenticación: **login con contraseña incorrecta: 401, sin crear sesión**
- ✔️ `[Caso de Prueba]` Autenticación: **login con usuario inexistente: mismo 401 que contraseña incorrecta (no filtra si el usuario existe)**
- ✔️ `[Caso de Prueba]` Autenticación: **login sin campos obligatorios: 400 (rechazado por validación, ni siquiera consulta la base)**
- ✔️ `[Caso de Prueba]` Autenticación: **sin sesión: un endpoint que requiere login da 401 (no redirige, porque se pide JSON)**
- ✔️ `[Caso de Prueba]` Autenticación: **con sesión: el mismo endpoint protegido responde 200**
- ✔️ `[Caso de Prueba]` Autenticación: **logout: cierra la sesión y el endpoint protegido vuelve a dar 401**
- ✔️ `[Caso de Prueba]` Autenticación: **Tendero: un segundo login sin "force" queda bloqueado con 409 SESSION_ACTIVE mientras la primera sesión sigue activa**
- ✔️ `[Caso de Prueba]` Autenticación: **Tendero: el segundo login SÍ pasa con force:true, y la primera sesión queda invalidada de verdad**
- ✔️ `[Caso de Prueba]` Autenticación: **Administrador: puede tener varias sesiones activas a la vez, sin bloqueo (a diferencia de Tendero)**

### 3.7 Flujo: `autenticacion_flujos.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` 2FA: **generate2FA: devuelve un secreto y un QR (data URL)**
- ✔️ `[Caso de Prueba]` 2FA: **verify2FA (habilitar desde el perfil): un token TOTP válido activa el 2FA**
- ✔️ `[Caso de Prueba]` 2FA: **verify2FA: un token inválido da 401 y no activa el 2FA**
- ✔️ `[Caso de Prueba]` 2FA: **login con 2FA ya activado: el login no abre sesión de una, exige verify2FA para completarla**
- ✔️ `[Caso de Prueba]` 2FA: **disable2FA: bloqueado para Administrador (403), aunque la contraseña sea correcta**
- ✔️ `[Caso de Prueba]` 2FA: **disable2FA: un Tendero con la contraseña correcta sí puede desactivarlo**
- ✔️ `[Caso de Prueba]` Restablecer contraseña por correo: **flujo completo: forgot-password → verify-reset-code → reset-password, y la contraseña vieja deja de servir**
- ✔️ `[Caso de Prueba]` Restablecer contraseña por correo: **verify-reset-code con un código incorrecto: 400 (el limitador por correo se prueba en limitadores_recuperacion.test.js)**
- ✔️ `[Caso de Prueba]` Restablecer contraseña por correo: **reset-password con un código incorrecto: 400 y la contraseña original sigue funcionando**
- ✔️ `[Caso de Prueba]` Restablecer contraseña por correo: **forgot-password con un correo que no existe: responde success:true igual (no filtra si el correo está registrado)**
- ✔️ `[Caso de Prueba]` Cambiar contraseña: **changePassword: contraseña actual correcta, cambia y la nueva sirve para loguear**
- ✔️ `[Caso de Prueba]` Cambiar contraseña: **changePassword: contraseña actual incorrecta da 400 y no cambia nada**
- ✔️ `[Caso de Prueba]` Cambiar contraseña: **changePassword: la nueva contraseña igual a la actual da 400**
- ✔️ `[Caso de Prueba]` Cambiar contraseña: **firstPasswordChange: sin cambio_clave_forzoso en la sesión, da 400 (no se puede usar como atajo)**
- ✔️ `[Caso de Prueba]` Cambiar contraseña: **firstPasswordChange: con cambio_clave_forzoso activo, establece la contraseña y apaga la bandera**

### 3.8 Flujo: `autorizacion_roles.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/productos/bulk (carga masiv…': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/productos/admin (crear prod…': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'PUT /api/productos/:id (editar)': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'PUT /api/productos/inhabilitar/:id': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'PUT /api/productos/habilitar/:id': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'DELETE /api/productos/:id': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/promociones': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/inventario/salida': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/inventario/ajuste': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/alertas/generate': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/reportes': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/exportar/ventas': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/exportar/reportes': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/ia/apply-strategy': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/clientes': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Tendero → 'POST /api/clientes/:id/abonos': 403 y no cambia nada**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/productos/bulk (carga masiv…': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/productos/admin (crear prod…': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'PUT /api/productos/:id (editar)': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'PUT /api/productos/inhabilitar/:id': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'PUT /api/productos/habilitar/:id': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'DELETE /api/productos/:id': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/promociones': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/inventario/salida': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/inventario/ajuste': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/alertas/generate': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/reportes': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/exportar/ventas': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/exportar/reportes': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/ia/apply-strategy': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/clientes': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): rutas solo del Administrador: **Administrador → 'POST /api/clientes/:id/abonos': la ruta le responde (no 401/403)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): lo que el Tendero SÍ puede hacer: **vincular un código de barras a un producto (PUT /api/productos/:id/link-barcode)**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): lo que el Tendero SÍ puede hacer: **registrar una entrada de mercancía (POST /api/inventario/entrada): suma stock y deja el movimiento**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): lo que el Tendero SÍ puede hacer: **resolver una alerta (PATCH /api/alertas/:id/resolve), generada por el Administrador**
- ✔️ `[Caso de Prueba]` Matriz de roles (P22-10, I0): lo que el Tendero SÍ puede hacer: **solicitar un producto al administrador (POST /api/ordenes/borrador/solicitar)**
- ✔️ `[Caso de Prueba]` Rutas eliminadas: **PUT /api/productos/agregar/:id ya no existe (sumaba stock sin dejar movimiento y sin validar el signo)**
- ✔️ `[Caso de Prueba]` Egresos de caja: aprobar y rechazar (P22-09, corregido): **un Tendero NO puede aprobar ni rechazar egresos, ni siquiera los de su propia tienda: 403 y la fila no cambia**
- ✔️ `[Caso de Prueba]` Egresos de caja: aprobar y rechazar (P22-09, corregido): **el Administrador de la tienda aprueba y rechaza: 200, queda quién lo hizo y el Tendero recibe la notificación**
- ✔️ `[Caso de Prueba]` Egresos de caja: aprobar y rechazar (P22-09, corregido): **un egreso de OTRA tienda no se puede tocar: 403 al Tendero, 404 al Administrador de la otra tienda, y la fila no cambia**
- ✔️ `[Caso de Prueba]` Egresos de caja: aprobar y rechazar (P22-09, corregido): **un id que no existe o no es numérico da 404, no 500**
- ✔️ `[Caso de Prueba]` Egresos de caja: aprobar y rechazar (P22-09, corregido): **un egreso ya resuelto no se reabre: aprobar/rechazar de nuevo da 409, la fila y las notificaciones no cambian**
- ✔️ `[Caso de Prueba]` Egresos de caja: aprobar y rechazar (P22-09, corregido): **dos peticiones simultáneas sobre el mismo egreso: una gana (200) y la otra recibe 409**

### 3.9 Flujo: `caja.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Caja: **abrir caja: éxito, y /api/caja/sesion refleja active:true**
- ✔️ `[Caso de Prueba]` Caja: **abrir caja dos veces seguidas: la segunda da 400 (ya hay una abierta)**
- ✔️ `[Caso de Prueba]` Caja: **5 aperturas de caja simultáneas del mismo vendedor: nunca deben quedar 2+ sesiones abiertas a la vez**
- ✔️ `[Caso de Prueba]` Caja: **cerrar caja sin haberla abierto: 400**
- ✔️ `[Caso de Prueba]` Caja: **cerrar caja sin descuadre (declarado = apertura, sin ventas/egresos): no genera notificación**
- ✔️ `[Caso de Prueba]` Caja: **cerrar caja con descuadre significativo (>$5.000): genera notificación de faltante**
- ✔️ `[Caso de Prueba]` Caja: **Tendero: registrar un egreso dentro del límite de la tienda, éxito**
- ✔️ `[Caso de Prueba]` Caja: **Tendero: un egreso por encima del límite de la tienda (default $150.000) se rechaza**
- ✔️ `[Caso de Prueba]` Caja: **Administrador: no tiene límite de egreso (puede registrar más del tope de Tendero)**
- ✔️ `[Caso de Prueba]` Caja: **egreso sin caja abierta: 400**

### 3.10 Flujo: `caja_apertura_concurrencia.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Apertura de caja: atómica por vendedor: **20 aperturas simultáneas del mismo vendedor: exactamente una gana (200) y las demás reciben 400**
- ✔️ `[Caso de Prueba]` Apertura de caja: atómica por vendedor: **repetido 5 veces con lotes de 12 (para atrapar una carrera intermitente): nunca hay más de una caja abierta**
- ✔️ `[Caso de Prueba]` Apertura de caja: atómica por vendedor: **dos vendedores de la MISMA tienda abren a la vez: las dos cajas se abren (el bloqueo es por vendedor)**
- ✔️ `[Caso de Prueba]` Apertura de caja: atómica por vendedor: **cerrar y volver a abrir sigue funcionando; la sesión nueva queda abierta**
- ✔️ `[Caso de Prueba]` Apertura de caja: atómica por vendedor: **la respuesta de éxito trae el id_sesion de la caja realmente creada**
- ✔️ `[Caso de Prueba]` Apertura de caja: montos inválidos (contrato para la app): **monto ausente, negativo o no numérico: 400, nunca 500, y no se abre ninguna caja**
- ✔️ `[Caso de Prueba]` Apertura de caja: montos inválidos (contrato para la app): **monto 0 es válido (caja que arranca vacía)**

### 3.11 Flujo: `caja_historial.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` GET /api/caja/historial — contenido: **cada sesión trae lo vendido por método: efectivo, tarjeta, transferencia y fiado quedan separados y no se mezclan con otros turnos ni tiendas**
- ✔️ `[Caso de Prueba]` GET /api/caja/historial — contenido: **los abonos de clientes quedan separados por método en la sesión del Administrador que los recibió**
- ✔️ `[Caso de Prueba]` GET /api/caja/historial — contenido: **una sesión sin ventas tiene el desglose en cero (no falta ninguna clave)**

### 3.12 Flujo: `caja_historial_autorizacion.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` GET /api/caja/historial — quién puede verlo: **403 para un Tendero (aunque tenga sesión y caja abierta); 401 sin sesión; el Administrador entra**
- ✔️ `[Caso de Prueba]` GET /api/caja/historial — quién puede verlo: **el Administrador de OTRA tienda tampoco ve las sesiones de esta**

### 3.13 Flujo: `cartera.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Cartera (clientes fiados): **crear cliente: éxito**
- ✔️ `[Caso de Prueba]` Cartera (clientes fiados): **crear cliente sin nombre: 400**
- ✔️ `[Caso de Prueba]` Cartera (clientes fiados): **listar clientes: saldo_pendiente = 0 para un cliente recién creado, sin fiados**
- ✔️ `[Caso de Prueba]` Cartera (clientes fiados): **flujo completo: venta fiada crea deuda, un abono parcial la reduce (saldo_pendiente correcto en todo momento)**
- ✔️ `[Caso de Prueba]` Cartera (clientes fiados): **registrar abono para un cliente inexistente: 404**
- ✔️ `[Caso de Prueba]` Cartera (clientes fiados): **registrar abono con monto inválido (<=0): 400**
- ✔️ `[Caso de Prueba]` Cartera (clientes fiados): **venta Fiado sin id_cliente: 400 (el cliente es obligatorio para ventas fiadas)**
- ✔️ `[Caso de Prueba]` Cartera (clientes fiados): **aislamiento por tienda: no se puede ver ni abonar a un cliente de otra tienda**

### 3.14 Flujo: `contrato_app_tendero.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` [S1] GET /api/csrf-token: **sin sesión y con sesión devuelve { csrfToken } (cadena larga); es distinto en cada sesión**
- ✔️ `[Caso de Prueba]` [S1] GET /api/csrf-token: **el token pertenece a la sesión: tras iniciar sesión hay que pedir uno nuevo (el de antes del login ya no sirve)**
- ✔️ `[Caso de Prueba]` [S2] POST /api/login: **200 (Tendero): { success, message, user: { nombres, rol, cambioClaveForzoso, needs2FASetup } } y cookie de sesión**
- ✔️ `[Caso de Prueba]` [S2] POST /api/login: **se puede entrar con el usuario o con el correo**
- ✔️ `[Caso de Prueba]` [S2] POST /api/login: **400 sin login o sin password; 401 con credenciales incorrectas (mismo mensaje para usuario inexistente y clave mala)**
- ✔️ `[Caso de Prueba]` [S2] POST /api/login: **409 { code: "SESSION_ACTIVE" } si ese canal ya tiene sesión; con force:true la reemplaza (la anterior recibe 401 CONCURRENT_SESSION)**
- ✔️ `[Caso de Prueba]` [S2] POST /api/login: **el límite de intentos fallidos (10 por IP cada 15 min) responde 429 con { success:false, error }**
- ✔️ `[Caso de Prueba]` [S3] POST /api/2fa/verify (completar el login con segundo factor): **flujo: login → { success, require2FA: true } (sin sesión todavía) → verify con el código → 200 con user; el CSRF se pide DESPUÉS del login**
- ✔️ `[Caso de Prueba]` [S3] POST /api/2fa/verify (completar el login con segundo factor): **400 sin token; 401 con un código incorrecto (y la sesión sigue a medias); 401 si no hay login previo**
- ✔️ `[Caso de Prueba]` [S3] POST /api/2fa/verify (completar el login con segundo factor): **a los 5 códigos incorrectos de la misma cuenta responde 429**
- ✔️ `[Caso de Prueba]` [S4] GET /api/session-info: **200 con los datos de la sesión (userId, tiendaId, rol, límite de egreso…) y 401 sin sesión**
- ✔️ `[Caso de Prueba]` [S5] POST /api/logout: **200 { success, message }, invalida la sesión y libera el candado de su canal; funciona aunque la sesión ya no sea válida**
- ✔️ `[Caso de Prueba]` [S7] PUT /api/perfil/first-password (primer cambio de contraseña): **el login avisa con user.cambioClaveForzoso = true; el cambio responde 200 { success, message } y la marca se apaga**
- ✔️ `[Caso de Prueba]` [S7] PUT /api/perfil/first-password (primer cambio de contraseña): **400 con menos de 8 caracteres, ausente, o igual a la contraseña temporal; la contraseña no cambia**
- ✔️ `[Caso de Prueba]` [S7] PUT /api/perfil/first-password (primer cambio de contraseña): **400 «Acción no permitida» si la cuenta no tiene un cambio pendiente; 401 sin sesión; 403 sin token CSRF**
- ✔️ `[Caso de Prueba]` [S7] PUT /api/perfil/first-password (primer cambio de contraseña): **COMPORTAMIENTO ACTUAL: el servidor NO bloquea las demás rutas mientras el cambio está pendiente; es la app la que debe exigirlo antes de dejar operar**
- ✔️ `[Caso de Prueba]` [S6] Errores transversales (valen para todos los endpoints protegidos): **sin sesión: 401 { error: "No autenticado" } SI la app manda Accept: application/json; sin esa cabecera responde 302 a "/"**
- ✔️ `[Caso de Prueba]` [S6] Errores transversales (valen para todos los endpoints protegidos): **403 { error: "Se requieren permisos de administrador" } cuando el Tendero llama a una ruta del Administrador**
- ✔️ `[Caso de Prueba]` [S6] Errores transversales (valen para todos los endpoints protegidos): **una escritura sin token CSRF, o con uno inválido, responde 403 { success:false, code:"CSRF_INVALID", error } (C4, corregido)**
- ✔️ `[Caso de Prueba]` [S6] Errores transversales (valen para todos los endpoints protegidos): **las lecturas (GET) no exigen CSRF; las escrituras sí (se comprueba con POST, PUT y PATCH)**
- ✔️ `[Caso de Prueba]` [C1] GET /api/productos: **200 con un ARREGLO (sin paginación) de los productos de la tienda de la sesión, con los campos que usa la app**
- ✔️ `[Caso de Prueba]` [C1] GET /api/productos: **la respuesta al Tendero NO incluye costo_compra ni clasificacion_abc (datos de margen: solo el Administrador); detalle en datos_de_margen.test.js**
- ✔️ `[Caso de Prueba]` [C2] GET /api/productos/barcode/:code: **200 { success, data: producto } si existe en la tienda; 404 { success:false, error } si no; 404 también si es de otra tienda**
- ✔️ `[Caso de Prueba]` [C2] GET /api/productos/barcode/:code: **también encuentra el producto por su código interno (codigo / SKU): sirve para productos sin código de barras comercial, con una etiqueta propia**
- ✔️ `[Caso de Prueba]` [C3] PUT /api/productos/:id/link-barcode: **200 { success, message } y el producto queda con ese código; el Tendero SÍ puede (matriz de roles I0)**
- ✔️ `[Caso de Prueba]` [C3] PUT /api/productos/:id/link-barcode: **400 sin código; 404 si el producto no existe o es de otra tienda**
- ✔️ `[Caso de Prueba]` [C3] PUT /api/productos/:id/link-barcode: **409 { success:false, code:"BARCODE_DUPLICADO", error } si el código ya lo tiene OTRO producto de la tienda (también contra su SKU); el mismo producto puede repetirlo; detalle en link_barcode.test.js**
- ✔️ `[Caso de Prueba]` [K1] GET /api/caja/sesion: **{ active:false } sin caja abierta; { active:true, session } con ella (importes como texto, fechas ISO)**
- ✔️ `[Caso de Prueba]` [K1] GET /api/caja/sesion: **la caja es POR VENDEDOR: la del Administrador de la misma tienda no cuenta como la del Tendero**
- ✔️ `[Caso de Prueba]` [K2] POST /api/caja/abrir: **200 { success, message, id_sesion }; 400 { error } si ya hay una abierta; 400 con monto ausente, negativo o no numérico**
- ✔️ `[Caso de Prueba]` [K3] POST /api/caja/cerrar: **200 { success, message, arqueo } con apertura, ventas en efectivo, abonos, egresos, calculado, declarado y diferencia; la caja queda cerrada**
- ✔️ `[Caso de Prueba]` [K3] POST /api/caja/cerrar: **400 { error } sin caja abierta; 400 con monto declarado ausente o negativo (la caja sigue abierta)**
- ✔️ `[Caso de Prueba]` [K3] POST /api/caja/cerrar: **un monto declarado en texto numérico («60000») se acepta y el arqueo lo devuelve como NÚMERO**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **200 { success, arqueo } con las MISMAS cuentas que [K3]; no cierra la caja, no guarda nada y no notifica; se puede pedir varias veces**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **solo cuentan las ventas en EFECTIVO; un egreso rechazado no se resta y uno pendiente de aprobar sí**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **la vista previa puede quedar vieja: si se vende algo después, [K3] recalcula**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **solo mira la caja del propio usuario: la de otro vendedor (de otra tienda) no se mezcla**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **DESGLOSE POR MÉTODO (auditoría): tarjeta, transferencia, fiado y un método desconocido quedan separados; la suma de todos es lo vendido en el turno y solo el efectivo entra al cajón**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **DESGLOSE: cada turno tiene el suyo; lo vendido en un turno anterior de la misma tienda no se mezcla con el actual**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **DESGLOSE: los abonos de clientes también se separan por método; solo el abono en efectivo entra al cajón**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **400 { error } sin caja abierta; 400 con monto ausente, negativo, nulo, de texto o de otro tipo (la caja sigue abierta); el 0 y el texto numérico valen**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **403 CSRF_INVALID sin el token (es una escritura para el servidor aunque no cambie datos)**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **401 sin sesión, aunque traiga un token CSRF válido de una sesión anónima**
- ✔️ `[Caso de Prueba]` [K5] POST /api/caja/arqueo-previo: **el Administrador también puede usarlo con SU caja**
- ✔️ `[Caso de Prueba]` [K4] POST /api/caja/egreso: **200 { success, message, id_egreso } con caja abierta; queda en estado «Registrado»**
- ✔️ `[Caso de Prueba]` [K4] POST /api/caja/egreso: **400 { error } sin caja abierta, monto <= 0, motivo de menos de 5 caracteres, o monto sobre el tope del Tendero (150.000 por defecto)**
- ✔️ `[Caso de Prueba]` [K4] POST /api/caja/egreso: **COMPORTAMIENTO ACTUAL: foto_soporte cabe hasta ~1 MB de base64 (≈ 750 KB de imagen), no 2 MB; por encima, 413 antes de llegar al controlador**
- ✔️ `[Caso de Prueba]` [K4] POST /api/caja/egreso: **el Tendero NO aprueba ni rechaza egresos (PUT /api/caja/egreso/:id/aprobar|rechazar → 403): eso es del Administrador**
- ✔️ `[Caso de Prueba]` [V1] GET /api/clientes: **200 { success, clientes: [{ id_cliente, nombre, celular, limite_credito, total_fiado, total_abonado, saldo_pendiente }] } solo de la tienda**
- ✔️ `[Caso de Prueba]` [V1] GET /api/clientes: **el Tendero NO puede crear clientes ni registrar abonos (403): D4 de la matriz de roles**
- ✔️ `[Caso de Prueba]` [V2] POST /api/registrar-venta-carrito: **200 { success, message, id_venta }; descuenta el stock, deja el movimiento en el Kardex y registra el canal de la sesión**
- ✔️ `[Caso de Prueba]` [V2] POST /api/registrar-venta-carrito: **Idempotency-Key: reintentar la misma venta devuelve el mismo id_venta (200, cabecera Idempotent-Replayed) sin duplicar; otra carga con la misma clave da 422; una clave mal formada, 400**
- ✔️ `[Caso de Prueba]` [V2] POST /api/registrar-venta-carrito: **fiado: con id_cliente de un cliente de la tienda queda en estado_deuda «Pendiente» y suma al saldo del cliente**
- ✔️ `[Caso de Prueba]` [V2] POST /api/registrar-venta-carrito: **403 { success:false, error } sin caja abierta; 400 con carrito vacío, cantidad inválida, fiado sin cliente o stock insuficiente**
- ✔️ `[Caso de Prueba]` [V2] POST /api/registrar-venta-carrito: **404 { success:false, error } si un producto del carrito no existe o es de otra tienda (no se vende nada)**
- ✔️ `[Caso de Prueba]` [V2] POST /api/registrar-venta-carrito: **fiado: 404 «Cliente no encontrado» si el cliente no existe o es de OTRA tienda; 400 si la venta supera el cupo de crédito (limite_credito > 0)**
- ✔️ `[Caso de Prueba]` [V3] GET /api/ventas: **200 { data, total, limit, offset, hasMore } con las ventas de la tienda (paginadas con ?limit y ?offset)**
- ✔️ `[Caso de Prueba]` [V3] GET /api/ventas: **?turno=actual devuelve solo las ventas de la caja abierta del usuario; un valor distinto de «actual» es 400; detalle en ventas_turno.test.js**
- ✔️ `[Caso de Prueba]` [M1] POST /api/inventario/entrada: **200 { success, message, data: { id, producto, tipo, cantidad, stockAnterior, stockNuevo } }; suma stock y deja el movimiento; el Tendero puede**
- ✔️ `[Caso de Prueba]` [M1] POST /api/inventario/entrada: **400 { success:false, error } con producto o cantidad ausentes o no positivos; 404 si el producto no existe o es de otra tienda**
- ✔️ `[Caso de Prueba]` [A1] GET /api/alertas: **200 { success, alerts, data } (las dos con la MISMA lista de alertas activas de la tienda); vacío si no hay**
- ✔️ `[Caso de Prueba]` [A2] PATCH /api/alertas/:id/resolve: **200 { success, message } y la alerta deja de aparecer; el Tendero puede (matriz de roles I0)**
- ✔️ `[Caso de Prueba]` [A2] PATCH /api/alertas/:id/resolve: **404 { success:false, error:"Alerta no encontrada" } si el id no existe, no es numérico o es de otra tienda (y no toca la alerta ajena); volver a archivar una real sigue dando 200**
- ✔️ `[Caso de Prueba]` [O1] POST /api/ordenes/borrador/solicitar (el Tendero pide un producto al Administrador): **200 { success, id_orden, proveedor }; crea (o amplía) el borrador y avisa a los administradores**
- ✔️ `[Caso de Prueba]` [O1] POST /api/ordenes/borrador/solicitar (el Tendero pide un producto al Administrador): **400 con producto/cantidad inválidos o producto sin proveedor; 404 si no es de la tienda; 409 si ya está en un borrador**
- ✔️ `[Caso de Prueba]` [O2] /api/notificaciones: **GET → { success, notifications }, GET /count → { success, count }, PATCH /read-all y PATCH /:id/read → { success }; solo las del propio usuario**

### 3.15 Flujo: `csrf_errores.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` C4: CSRF inválido → 403 CSRF_INVALID: **sin token, con un token falso o vacío: 403 y la escritura no se ejecuta**
- ✔️ `[Caso de Prueba]` C4: CSRF inválido → 403 CSRF_INVALID: **el token de OTRA sesión no vale**
- ✔️ `[Caso de Prueba]` C4: CSRF inválido → 403 CSRF_INVALID: **el token pedido antes del login deja de valer tras él (el login regenera la sesión); uno nuevo sí sirve**
- ✔️ `[Caso de Prueba]` C4: CSRF inválido → 403 CSRF_INVALID: **PUT, PATCH y DELETE sin token también dan 403; un token válido sigue funcionando; los GET no lo exigen**
- ✔️ `[Caso de Prueba]` C4: CSRF inválido → 403 CSRF_INVALID: **un 403 de CSRF no se confunde con un 403 de rol: el de rol sigue siendo { error: "Se requieren permisos de administrador" }**
- ✔️ `[Caso de Prueba]` Otros 4xx que antes caían en el 500 genérico: **JSON mal formado → 400 { success:false, error } (login no exige CSRF)**
- ✔️ `[Caso de Prueba]` Otros 4xx que antes caían en el 500 genérico: **cuerpo de más de 1 MB → 413**

### 3.16 Flujo: `datos_de_margen.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Datos de margen: solo para el Administrador: **GET /api/productos: el Tendero NO recibe costo_compra ni clasificacion_abc; el Administrador sí**
- ✔️ `[Caso de Prueba]` Datos de margen: solo para el Administrador: **GET /api/productos/:id y GET /api/productos/barcode/:code: igual**
- ✔️ `[Caso de Prueba]` Datos de margen: solo para el Administrador: **GET /api/inventario/productos (la misma lista de productos): igual**

### 3.17 Flujo: `ejemplos_app_tendero.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Ejemplos de la API de la app del Tendero: **flujo completo de un turno: sesión, caja, catálogo, venta, egreso, recepción y cierre**
- ✔️ `[Caso de Prueba]` Ejemplos de la API de la app del Tendero: **segundo factor del Administrador: login, código y sesión válida**
- ✔️ `[Caso de Prueba]` Ejemplos de la API de la app del Tendero: **primer inicio de sesión de un Tendero con contraseña temporal**

### 3.18 Flujo: `exports_por_tienda.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` C6. Exportaciones: aisladas por tienda y de un solo uso: **la carpeta de las pruebas es temporal, no la del proyecto**
- ✔️ `[Caso de Prueba]` C6. Exportaciones: aisladas por tienda y de un solo uso: **el nombre del archivo lleva el id de la tienda**
- ✔️ `[Caso de Prueba]` C6. Exportaciones: aisladas por tienda y de un solo uso: **otra tienda no puede descargarlo (404) y el archivo sigue en su sitio**
- ✔️ `[Caso de Prueba]` C6. Exportaciones: aisladas por tienda y de un solo uso: **la tienda dueña lo descarga y el archivo se borra al terminar; una segunda descarga da 404**
- ✔️ `[Caso de Prueba]` C6. Exportaciones: aisladas por tienda y de un solo uso: **los reportes exportados también llevan la tienda y se aíslan igual**
- ✔️ `[Caso de Prueba]` C6. Exportaciones: aisladas por tienda y de un solo uso: **GET /api/exportar/archivos ya no existe (listaba los archivos de todas las tiendas)**
- ✔️ `[Caso de Prueba]` C6. Exportaciones: aisladas por tienda y de un solo uso: **nombres con formato antiguo, con recorrido de carpetas o inventados dan 404 y no leen nada**
- ✔️ `[Caso de Prueba]` C6. Exportaciones: aisladas por tienda y de un solo uso: **al exportar se barren los archivos (formato nuevo) que nadie descargó en más de una hora; los demás no se tocan**

### 3.19 Flujo: `feedback_evaluar_orden.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` POST /api/feedback/evaluate/:orderId: evaluar una orden de la propia tienda: **camino feliz: compara lo sugerido por la IA con lo vendido y guarda una fila de Feedback_IA**
- ✔️ `[Caso de Prueba]` POST /api/feedback/evaluate/:orderId: evaluar una orden de la propia tienda: **evaluar dos veces la misma orden actualiza la fila existente, no la duplica**
- ✔️ `[Caso de Prueba]` POST /api/feedback/evaluate/:orderId: evaluar una orden de la propia tienda: **una orden que no existe da 404**
- ✔️ `[Caso de Prueba]` POST /api/feedback/evaluate/:orderId: evaluar una orden de la propia tienda: **una orden que aún no está aprobada da 400 y no guarda nada**
- ✔️ `[Caso de Prueba]` POST /api/feedback/evaluate/:orderId: evaluar una orden de la propia tienda: **una orden aprobada sin detalle da 400**
- ✔️ `[Caso de Prueba]` POST /api/feedback/evaluate/:orderId: evaluar una orden de la propia tienda: **un id que no es numérico da 404 (antes daba 500 por un error de Postgres sin controlar; corregido con C2)**

### 3.20 Flujo: `ia_analitica.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` GET /api/ia/snapshot (getAnalyticalSnapshot): **sin sesión redirige al login (302)**
- ✔️ `[Caso de Prueba]` GET /api/ia/snapshot (getAnalyticalSnapshot): **tienda sin productos: success:true y data vacío**
- ✔️ `[Caso de Prueba]` GET /api/ia/snapshot (getAnalyticalSnapshot): **devuelve por producto el contrato que consume el frontend (claves y valores del motor)**
- ✔️ `[Caso de Prueba]` GET /api/ia/snapshot (getAnalyticalSnapshot): **el parámetro dias solo se respeta entre 7 y 90; fuera de rango se ignora (igual que sin parámetro)**
- ✔️ `[Caso de Prueba]` GET /api/ia/snapshot (getAnalyticalSnapshot): **no mezcla productos de otra tienda**
- ✔️ `[Caso de Prueba]` GET /api/ia/price-trend (getPriceTrend): **sin sesión redirige al login (302)**
- ✔️ `[Caso de Prueba]` GET /api/ia/price-trend (getPriceTrend): **sin cambios de precio: success:true y trend vacío**
- ✔️ `[Caso de Prueba]` GET /api/ia/price-trend (getPriceTrend): **devuelve cada cambio con fecha YYYY-MM-DD, precios numéricos y variación**
- ✔️ `[Caso de Prueba]` GET /api/ia/price-trend (getPriceTrend): **no muestra los cambios de precio de otra tienda**
- ✔️ `[Caso de Prueba]` GET /api/ia/suggest-alerts (suggestStockAlerts): **sin sesión redirige al login (302)**
- ✔️ `[Caso de Prueba]` GET /api/ia/suggest-alerts (suggestStockAlerts): **sin producto ni categoría: valores base (mínimo 5, seguridad 2, entrega 3 días)**
- ✔️ `[Caso de Prueba]` GET /api/ia/suggest-alerts (suggestStockAlerts): **producto sin ventas: valores base, pero conserva el lead_time propio del producto**
- ✔️ `[Caso de Prueba]` GET /api/ia/suggest-alerts (suggestStockAlerts): **producto con ventas: umbrales a partir de las ventas reales de los últimos 30 días**
- ✔️ `[Caso de Prueba]` GET /api/ia/suggest-alerts (suggestStockAlerts): **ventas anteriores a 30 días no cuentan**
- ✔️ `[Caso de Prueba]` GET /api/ia/suggest-alerts (suggestStockAlerts): **producto nuevo con categoría: promedio de la categoría repartido entre sus productos**

### 3.21 Flujo: `ia_caida.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` IA caída: **getDashboardRecommendations con OpenAI fallando: degrada con elegancia (200, error:true, sugerencia de reemplazo), no rompe**
- ✔️ `[Caso de Prueba]` IA caída: **getDashboardRecommendations sin productos para reponer: ni siquiera llama a OpenAI, responde vacío de una**
- ✔️ `[Caso de Prueba]` IA caída: **getDashboardRecommendations sin OPENAI_API_KEY configurada: 500 explícito, sin siquiera intentar la red**
- ✔️ `[Caso de Prueba]` IA caída: **assessClientRisk con OpenAI fallando: degrada con elegancia (200, error:true, aviso de mantenimiento) — corregido, ver plan sección 8.13**
- ✔️ `[Caso de Prueba]` IA caída: **getPromotionSuggestions con OpenAI fallando: degrada con el motor de reglas deterministas (200, sugerencias reales, no un aviso genérico) — corregido, ver plan sección 8.13**

### 3.22 Flujo: `ia_errores_http.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` POST /api/ia/apply-strategy: **sin id_producto o sin nuevo_precio responde 400 y no toca nada**
- ✔️ `[Caso de Prueba]` POST /api/ia/apply-strategy: **producto inexistente: 404 «Producto no encontrado» (no un 500)**
- ✔️ `[Caso de Prueba]` POST /api/ia/apply-strategy: **AISLAMIENTO: un producto de OTRA tienda responde 404 y su precio no cambia**
- ✔️ `[Caso de Prueba]` POST /api/ia/apply-strategy: **camino feliz: baja el precio, guarda el original, deja historial y auditoría**
- ✔️ `[Caso de Prueba]` POST /api/ia/apply-strategy: **promociones encadenadas: el precio original que se guarda es el primero, no el de la promoción anterior**
- ✔️ `[Caso de Prueba]` GET /api/ia/assess-risk/:id_cliente (errores): **cliente inexistente: 404 «Cliente no encontrado»**
- ✔️ `[Caso de Prueba]` GET /api/ia/assess-risk/:id_cliente (errores): **AISLAMIENTO: un cliente de OTRA tienda responde 404**
- ✔️ `[Caso de Prueba]` GET /api/ia/assess-risk/:id_cliente (errores): **sin OPENAI_API_KEY configurada: 500 explícito, antes de consultar al cliente**
- ✔️ `[Caso de Prueba]` GET /api/ia/promotions (bordes): **sin ningún producto candidato: {success:true, promotions:[]} (sin campo cached) y sin llamar a OpenAI**

### 3.23 Flujo: `ia_privacidad.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Análisis de riesgo de un cliente: no se envía quién es: **lo que se manda a OpenAI no contiene el nombre ni el celular del cliente**
- ✔️ `[Caso de Prueba]` Análisis de riesgo de un cliente: no se envía quién es: **sigue mandando lo que la IA necesita para evaluar: saldo, número de compras y de abonos**
- ✔️ `[Caso de Prueba]` Análisis de riesgo de un cliente: no se envía quién es: **la auditoría de IA guarda el id del cliente (para poder rastrear el análisis) y tampoco su nombre**

### 3.24 Flujo: `ia_recomendaciones.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` IA: camino feliz con OpenAI simulado: **getDashboardRecommendations sin caché: llama a OpenAI una vez y devuelve cached:false con el ajuste de la IA**
- ✔️ `[Caso de Prueba]` IA: camino feliz con OpenAI simulado: **getDashboardRecommendations con caché: la segunda llamada con el mismo inventario NO vuelve a llamar a OpenAI (cached:true)**
- ✔️ `[Caso de Prueba]` IA: camino feliz con OpenAI simulado: **getPromotionSuggestions con OpenAI simulada: toma el tipo y el descuento que responde la IA (no el motor de reglas)**
- ✔️ `[Caso de Prueba]` IA: camino feliz con OpenAI simulado: **assessClientRisk con OpenAI simulada: usa el perfil/riesgo de la IA, no el aviso de mantenimiento**

### 3.25 Flujo: `limitadores_recuperacion.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` P21-09: limitador del código de recuperación: **a los 5 intentos fallidos de un correo, el sexto recibe 429 aunque el código sea el correcto, y la contraseña no cambia**
- ✔️ `[Caso de Prueba]` P21-09: limitador del código de recuperación: **el límite es por correo, no por IP: otro correo desde la misma IP tiene su propio presupuesto**
- ✔️ `[Caso de Prueba]` P21-09: limitador del código de recuperación: **verify-reset-code y reset-password comparten el contador: no se puede adivinar el código por el segundo**
- ✔️ `[Caso de Prueba]` P21-09: limitador del código de recuperación: **los intentos que aciertan no gastan el presupuesto (flujo normal: verificar y restablecer)**
- ✔️ `[Caso de Prueba]` P21-09: limitador del código de recuperación: **el correo se normaliza (mayúsculas y espacios) para el contador, y sin correo cae a la IP**
- ✔️ `[Caso de Prueba]` P21-09: limitador del código de recuperación: **un intento fallido deja las cabeceras RateLimit-* para que la app muestre cuántos le quedan**
- ✔️ `[Caso de Prueba]` P21-13: el skip del limitador global ya funciona: **POST /api/login y POST /api/2fa/verify NO suman al contador global (siguen contando en el suyo)**
- ✔️ `[Caso de Prueba]` P21-13: el skip del limitador global ya funciona: **POST /api/registro tampoco suma al global, ni una ruta bajo /api/2fa con query**
- ✔️ `[Caso de Prueba]` P21-13: el skip del limitador global ya funciona: **control: una ruta normal de /api/ SÍ suma al global, y /api/login-falso (prefijo parecido) también**

### 3.26 Flujo: `limitadores_reinicio.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` reinicio de los contadores de los limitadores: **registra los 8 limitadores de middleware/rateLimiter.js**
- ✔️ `[Caso de Prueba]` reinicio de los contadores de los limitadores: **reiniciarLimitadores() devuelve el límite global a su valor inicial**

### 3.27 Flujo: `limitador_olvido_contrasena.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` forgot-password: límite por correo (3 cada 15 min): **la 4.ª petición del mismo correo recibe 429, también si el correo NO existe (misma respuesta: no se enumera)**
- ✔️ `[Caso de Prueba]` forgot-password: límite por correo (3 cada 15 min): **con un usuario real: las peticiones 4.ª en adelante no vuelven a pisar su código ni a enviar correo**
- ✔️ `[Caso de Prueba]` forgot-password: límite por correo (3 cada 15 min): **el correo se normaliza (mayúsculas y espacios) para el contador; otro correo tiene su propio presupuesto**
- ✔️ `[Caso de Prueba]` forgot-password: límite por correo (3 cada 15 min): **un formato de correo inválido también gasta presupuesto (no es una vía libre para probar sin límite)**
- ✔️ `[Caso de Prueba]` forgot-password: límite por IP (10 cada 15 min): **la 11.ª petición desde la misma IP recibe 429 aunque cada una use un correo distinto**
- ✔️ `[Caso de Prueba]` forgot-password: no afecta al resto del flujo de recuperación: **pedir el código una vez, verificarlo y restablecer funciona como antes**

### 3.28 Flujo: `link_barcode.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` link-barcode: un código identifica a un solo producto por tienda: **un código nuevo se vincula (200) y el producto queda con él**
- ✔️ `[Caso de Prueba]` link-barcode: un código identifica a un solo producto por tienda: **un código que ya tiene OTRO producto de la tienda da 409 con el nombre del dueño, y no cambia nada**
- ✔️ `[Caso de Prueba]` link-barcode: un código identifica a un solo producto por tienda: **también choca con el SKU (columna codigo) de otro producto, porque la búsqueda por código mira las dos columnas**
- ✔️ `[Caso de Prueba]` link-barcode: un código identifica a un solo producto por tienda: **vincular de nuevo el MISMO código al MISMO producto es válido (idempotente: un reintento de la app no falla)**
- ✔️ `[Caso de Prueba]` link-barcode: un código identifica a un solo producto por tienda: **el mismo código en OTRA tienda es válido (la unicidad es por tienda)**
- ✔️ `[Caso de Prueba]` link-barcode: un código identifica a un solo producto por tienda: **el código se recorta (espacios) y acepta un número; el recortado también cuenta para el duplicado**
- ✔️ `[Caso de Prueba]` link-barcode: un código identifica a un solo producto por tienda: **400 con código ausente, vacío, solo espacios, de otro tipo o de más de 50 caracteres (antes, el largo daba 500)**
- ✔️ `[Caso de Prueba]` link-barcode: un código identifica a un solo producto por tienda: **404 si el producto no existe o es de otra tienda (y no se toca)**
- ✔️ `[Caso de Prueba]` link-barcode: un código identifica a un solo producto por tienda: **dos productos que piden el MISMO código a la vez: uno gana (200) y el otro recibe 409 (no quedan duplicados)**

### 3.29 Flujo: `modo_interfaz.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Migración de modo_interfaz: **las cuentas que ya existían quedan en avanzado y las nuevas nacen en basico**
- ✔️ `[Caso de Prueba]` Migración de modo_interfaz: **es idempotente: correrla otra vez no pisa lo que la persona ya eligió**
- ✔️ `[Caso de Prueba]` Migración de modo_interfaz: **la base rechaza un valor fuera de la lista (restricción CHECK)**
- ✔️ `[Caso de Prueba]` Migración de modo_interfaz: **una cuenta creada como colaborador por el Administrador también nace en basico**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **cambia el modo de la propia cuenta, en los dos sentidos, y session-info lo refleja**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **el Colaborador (rol Tendero) también puede cambiar su propio modo**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **solo cambia la cuenta de la sesión: un id_usuario en el cuerpo se ignora**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **rechaza un valor desconocido con 400 y no cambia nada**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **rechaza un texto con inyección SQL con 400 y no cambia nada**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **rechaza un número con 400 y no cambia nada**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **rechaza una lista con 400 y no cambia nada**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **rechaza null con 400 y no cambia nada**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **rechaza mayúsculas con 400 y no cambia nada**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **rechaza sin el campo con 400 y no cambia nada**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **sin sesión responde 401**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **sin token CSRF responde 403 CSRF_INVALID y no cambia nada**
- ✔️ `[Caso de Prueba]` PATCH /api/perfil/modo-interfaz: **GET /api/perfil incluye el modo (la pantalla de perfil lo muestra)**

### 3.30 Flujo: `pedir_flujo.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` /pedir: sugerencias con datos reales del motor: **el snapshot trae los campos que usa la pantalla y las reglas del frontend los clasifican bien**
- ✔️ `[Caso de Prueba]` /pedir: sugerencias con datos reales del motor: **un Colaborador (Tendero) no puede armar ni aprobar pedidos: /pedir es solo del Administrador**
- ✔️ `[Caso de Prueba]` /pedir: armar, aprobar y recibir: **recorre el flujo completo y el stock sube con lo que llegó**
- ✔️ `[Caso de Prueba]` /pedir: armar, aprobar y recibir: **una recepción parcial deja la orden «por recibir» y la siguiente suma sin duplicar stock**
- ✔️ `[Caso de Prueba]` /pedir: armar, aprobar y recibir: **recibir de más pide confirmación con motivo (409) y la pantalla lo reenvía con confirmar_exceso**
- ✔️ `[Caso de Prueba]` /pedir: armar, aprobar y recibir: **descartar un pedido (Rechazada) lo saca de la lista por aprobar**

### 3.31 Flujo: `politica_dos_factores.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` política APAGADA (por defecto, durante el piloto): **un Administrador SIN 2FA puede crear productos y proveedores**
- ✔️ `[Caso de Prueba]` política APAGADA (por defecto, durante el piloto): **un valor distinto de «true» tampoco la enciende**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **un Administrador SIN 2FA recibe 403 con code DOS_FACTORES_REQUERIDO y NO se crea nada**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **es por defecto: POST /api/proveedores también se bloquea (no depende de rutas marcadas a mano)**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **es por defecto: PUT /api/productos/:id también se bloquea (no depende de rutas marcadas a mano)**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **es por defecto: DELETE /api/productos/:id también se bloquea (no depende de rutas marcadas a mano)**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **es por defecto: POST /api/clientes también se bloquea (no depende de rutas marcadas a mano)**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **es por defecto: POST /api/inventario/ajuste también se bloquea (no depende de rutas marcadas a mano)**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **es por defecto: POST /api/ia/apply-strategy también se bloquea (no depende de rutas marcadas a mano)**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **un Administrador CON 2FA activo opera con normalidad**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **leer sigue permitido: un Administrador SIN 2FA puede consultar**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **los flujos de la propia cuenta siguen abiertos: activar el 2FA, cerrar sesión y el modo de interfaz**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **el Tendero no se ve afectado (la política es solo del Administrador)**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **FALLA CERRADO: si no se puede consultar el estado del 2FA, responde 500 y NO deja escribir**
- ✔️ `[Caso de Prueba]` política ENCENDIDA (REQUIRE_ADMIN_2FA=true): **si el Administrador activa el 2FA en plena sesión, la siguiente escritura ya pasa (se lee de la BD, no de la sesión)**
- ✔️ `[Caso de Prueba]` POST /api/2fa/generate no permite reemplazar un 2FA ya activo: **con el 2FA activo responde 409 DOS_FACTORES_YA_ACTIVO y el secreto NO cambia**
- ✔️ `[Caso de Prueba]` POST /api/2fa/generate no permite reemplazar un 2FA ya activo: **sin 2FA activo sigue generando (activación inicial y reintentos de activación)**
- ✔️ `[Caso de Prueba]` limitador de /api/2fa/disable: **tras 5 contraseñas incorrectas, el sexto intento responde 429 aunque la contraseña sea correcta**

### 3.32 Flujo: `productos_carga_masiva.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Productos: carga masiva (.xlsx y .csv): **.xlsx: crea productos nuevos con las columnas mínimas (Código y Nombre)**
- ✔️ `[Caso de Prueba]` Productos: carga masiva (.xlsx y .csv): **.xlsx: una fila con el mismo código que un producto existente lo ACTUALIZA (upsert), no crea un duplicado**
- ✔️ `[Caso de Prueba]` Productos: carga masiva (.xlsx y .csv): **.csv: mismo comportamiento que .xlsx (crea productos nuevos)**
- ✔️ `[Caso de Prueba]` Productos: carga masiva (.xlsx y .csv): **.xlsx: una fila sin Código o sin Nombre se OMITE con una advertencia, no rompe el resto del archivo**
- ✔️ `[Caso de Prueba]` Productos: carga masiva (.xlsx y .csv): **.xlsx: una fila con precio o cantidad negativos se OMITE con una advertencia**
- ✔️ `[Caso de Prueba]` Productos: carga masiva (.xlsx y .csv): **un formato no soportado (.txt) da 400 sin llegar a leer el contenido**
- ✔️ `[Caso de Prueba]` Productos: carga masiva (.xlsx y .csv): **sin ninguna columna de Código/Nombre en el encabezado: 400 explícito**
- ✔️ `[Caso de Prueba]` Productos: carga masiva (.xlsx y .csv): **sin ningún archivo adjunto: 400 (el mensaje viene de validateFileType, no del chequeo propio de bulkUpload — ese queda inalcanzable por esta ruta)**

### 3.33 Flujo: `proveedores_flujo.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Proveedores: orden inteligente (copiloto IA, aprobar, recibir): **ai-copilot: ajusta la cantidad matemática con el porcentaje que responde la IA simulada**
- ✔️ `[Caso de Prueba]` Proveedores: orden inteligente (copiloto IA, aprobar, recibir): **submitSmartOrder → updateOrderStatus(Aprobada) → completarRecepcion: recibir EXACTAMENTE lo pedido**
- ✔️ `[Caso de Prueba]` Proveedores: orden inteligente (copiloto IA, aprobar, recibir): **completarRecepcion: recibir MENOS de lo pedido se acepta y la orden queda «Parcial» con el faltante pendiente (P21-10; el detalle está en recepcion_mercancia.test.js)**
- ✔️ `[Caso de Prueba]` Proveedores: orden inteligente (copiloto IA, aprobar, recibir): **recibir MÁS de lo pedido ya no se acepta sin más: pide confirmación (409) y no toca el stock (P21-10; el detalle está en recepcion_mercancia.test.js)**
- ✔️ `[Caso de Prueba]` Proveedores: orden inteligente (copiloto IA, aprobar, recibir): **completarRecepcion: un producto que no pertenece a la orden da 400 y no toca nada**
- ✔️ `[Caso de Prueba]` Proveedores: orden inteligente (copiloto IA, aprobar, recibir): **updateOrderStatus: no permite marcar "Completada" directamente, exige pasar por completarRecepcion**
- ✔️ `[Caso de Prueba]` Proveedores: borrador de orden desde el Consejero IA (/api/ordenes/borrador/*): **crearDesdeConsejero: agrupa por proveedor y crea un borrador nuevo**
- ✔️ `[Caso de Prueba]` Proveedores: borrador de orden desde el Consejero IA (/api/ordenes/borrador/*): **crearDesdeConsejero dos veces seguidas para el mismo proveedor: suma al MISMO borrador, no crea uno nuevo**
- ✔️ `[Caso de Prueba]` Proveedores: borrador de orden desde el Consejero IA (/api/ordenes/borrador/*): **editarLinea (PATCH): cambia la cantidad final y recalcula el total del borrador**
- ✔️ `[Caso de Prueba]` Proveedores: borrador de orden desde el Consejero IA (/api/ordenes/borrador/*): **quitarLinea (DELETE): si era la única línea, elimina también el borrador completo**
- ✔️ `[Caso de Prueba]` Proveedores: borrador de orden desde el Consejero IA (/api/ordenes/borrador/*): **solicitarProducto (Tendero): agrega su línea al borrador del proveedor y notifica a los administradores**
- ✔️ `[Caso de Prueba]` Proveedores: borrador de orden desde el Consejero IA (/api/ordenes/borrador/*): **solicitarProducto: si el producto YA está en un borrador de ese proveedor, da 409 y no duplica la línea**

### 3.34 Flujo: `recepcion_mercancia.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Recepción de mercancía: lo recibido frente a lo pedido: **recibir exactamente lo pedido cierra la orden como «Completada»**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: lo recibido frente a lo pedido: **recibir MENOS deja la orden «Parcial» con el faltante pendiente, y el total es lo realmente recibido**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: lo recibido frente a lo pedido: **una orden «Parcial» se sigue recibiendo: el total acumulado suma solo la diferencia y al llegar a lo pedido se completa**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: lo recibido frente a lo pedido: **reenviar el MISMO total (doble clic, reintento) no vuelve a sumar stock ni al Kardex**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: lo recibido frente a lo pedido: **dos recepciones idénticas simultáneas suman el stock una sola vez**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: lo recibido frente a lo pedido: **un total MENOR que lo ya recibido da 400 y no cambia nada**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: lo recibido frente a lo pedido: **con varias líneas, la orden sigue «Parcial» mientras alguna no esté completa**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: lo recibido frente a lo pedido: **una línea que no se envía cuenta como no recibida: la orden queda «Parcial»**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo: **sin confirmar: 409 RECEPCION_EXCEDE_PEDIDO con el detalle del exceso, y no escribe NADA**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo: **confirmar el exceso sin motivo da 400 y no escribe nada**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo: **confirmar el exceso con motivo vacío da 400 y no escribe nada**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo: **confirmar el exceso con motivo demasiado corto da 400 y no escribe nada**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo: **confirmar el exceso con motivo demasiado largo da 400 y no escribe nada**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo: **confirmar el exceso con motivo que no es texto da 400 y no escribe nada**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo: **confirmado con motivo: se registra todo, el motivo queda en el Kardex y la orden se completa**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo: **el exceso se mide sobre el TOTAL acumulado: una orden «Parcial» que pasa de lo pedido también pide confirmación**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo: **con dos líneas, el exceso de una bloquea toda la recepción (no se guarda la otra a medias)**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: recibir MÁS de lo pedido pide confirmación y motivo: **confirmar_exceso sin que haya exceso no exige motivo ni cambia nada**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: cerrar con faltante, estados y permisos: **cerrar_con_faltante: true completa la orden aunque falte, y ya no admite más recepciones**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: cerrar con faltante, estados y permisos: **una orden «Completada» no admite otra recepción (ni siquiera con el mismo total)**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: cerrar con faltante, estados y permisos: **un producto repetido en la misma recepción da 400 y no escribe nada**
- ✔️ `[Caso de Prueba]` Recepción de mercancía: cerrar con faltante, estados y permisos: **un Tendero recibe 403 y no cambia nada (la recepción es del Administrador)**

### 3.35 Flujo: `seed_ruta_eliminada.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` POST /api/admin/seed: **con un Administrador responde 404 y no toca ni Tienda ni Usuarios ni Productos**
- ✔️ `[Caso de Prueba]` POST /api/admin/seed: **sin sesión (con un token CSRF válido, que se obtiene sin iniciar sesión) no ejecuta nada**

### 3.36 Flujo: `sesion_candado_caducada.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Candado de sesión caducada: canal app: **sesión VIVA: el segundo login sigue recibiendo 409 SESSION_ACTIVE (el candado funciona)**
- ✔️ `[Caso de Prueba]` Candado de sesión caducada: canal app: **sesión CADUCADA sin haber cerrado sesión: el siguiente login entra (200) y el candado pasa a la sesión nueva**
- ✔️ `[Caso de Prueba]` Candado de sesión caducada: canal app: **sesión BORRADA del almacén (no solo caducada): también se libera**
- ✔️ `[Caso de Prueba]` Candado de sesión caducada: canal app: **`force` sigue funcionando con una sesión viva: entra y la anterior queda invalidada**
- ✔️ `[Caso de Prueba]` Candado de sesión caducada: canal web: **sesión VIVA: el segundo login sigue recibiendo 409 SESSION_ACTIVE (el candado funciona)**
- ✔️ `[Caso de Prueba]` Candado de sesión caducada: canal web: **sesión CADUCADA sin haber cerrado sesión: el siguiente login entra (200) y el candado pasa a la sesión nueva**
- ✔️ `[Caso de Prueba]` Candado de sesión caducada: canal web: **sesión BORRADA del almacén (no solo caducada): también se libera**
- ✔️ `[Caso de Prueba]` Candado de sesión caducada: canal web: **`force` sigue funcionando con una sesión viva: entra y la anterior queda invalidada**
- ✔️ `[Caso de Prueba]` Candado de sesión caducada: no afecta a lo que no debe: **la sesión caducada de un canal NO libera el candado VIVO del otro canal**
- ✔️ `[Caso de Prueba]` Candado de sesión caducada: no afecta a lo que no debe: **la clave incorrecta sigue siendo 401 (no se llega a consultar el candado)**
- ✔️ `[Caso de Prueba]` Candado de sesión caducada: no afecta a lo que no debe: **un candado con el identificador de una sesión que NO existe (basura en la columna) se trata como huérfano**

### 3.37 Flujo: `sesion_por_canal.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Sesión por canal (Tendero): web y app a la vez: **web y app a la vez: las dos sesiones son válidas y cada una guarda su candado en su columna**
- ✔️ `[Caso de Prueba]` Sesión por canal (Tendero): web y app a la vez: **solo la app: el candado queda en session_id_app y session_id sigue vacío (y viceversa)**
- ✔️ `[Caso de Prueba]` Sesión por canal (Tendero): web y app a la vez: **un segundo login en el MISMO canal da 409 SESSION_ACTIVE, en web y en app, sin tocar la sesión vigente**
- ✔️ `[Caso de Prueba]` Sesión por canal (Tendero): web y app a la vez: **el candado de un canal no bloquea el otro: con web abierta, la app entra sin force (y al revés)**
- ✔️ `[Caso de Prueba]` Sesión por canal (Tendero): web y app a la vez: **force en la app invalida SOLO la sesión app anterior; la web sigue válida**
- ✔️ `[Caso de Prueba]` Sesión por canal (Tendero): web y app a la vez: **force en la web invalida SOLO la sesión web anterior; la app sigue válida**
- ✔️ `[Caso de Prueba]` Sesión por canal (Tendero): web y app a la vez: **force sin sesión previa en ese canal no hace nada raro: entra normal**
- ✔️ `[Caso de Prueba]` Sesión por canal: cabecera X-Canal: **«App» y « app » (mayúsculas, espacios) cuentan como app; cualquier otro valor cuenta como web**
- ✔️ `[Caso de Prueba]` Sesión por canal: cabecera X-Canal: **la cabecera solo se lee en el login: una petición posterior con otro X-Canal no cambia el canal de la sesión**
- ✔️ `[Caso de Prueba]` Sesión por canal: logout: **el logout de la app libera solo session_id_app; la web sigue válida y la app puede volver a entrar sin force**
- ✔️ `[Caso de Prueba]` Sesión por canal: logout: **el logout de la web libera solo session_id; la app sigue válida**
- ✔️ `[Caso de Prueba]` Sesión por canal: logout: **una sesión vieja invalidada por force que hace logout NO borra el candado de la sesión nueva**
- ✔️ `[Caso de Prueba]` Sesión por canal: el Administrador no tiene candado: **varios inicios de sesión en cada canal, sin 409 y sin invalidar las anteriores**
- ✔️ `[Caso de Prueba]` Sesión por canal: con 2FA: **el canal elegido en el paso de la contraseña se conserva al completar el 2FA (el del código no lo cambia)**

### 3.38 Flujo: `tienda_permisos.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Permisos de tienda (plan 22, fase I0): **Tendero: PUT /api/tienda/update/:id da 403 y no modifica la tienda**
- ✔️ `[Caso de Prueba]` Permisos de tienda (plan 22, fase I0): **Tendero: PUT /api/tienda/estado/:id da 403 y no desactiva la tienda**
- ✔️ `[Caso de Prueba]` Permisos de tienda (plan 22, fase I0): **Administrador: PUT /api/tienda/update/:id sigue funcionando (200, cambio real)**
- ✔️ `[Caso de Prueba]` Permisos de tienda (plan 22, fase I0): **Administrador: PUT /api/tienda/estado/:id sigue funcionando (200, la desactiva)**

### 3.39 Flujo: `ventas_canal.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Ventas.canal: **registrar-venta: una sesión web registra canal «web» y una sesión app, «app»**
- ✔️ `[Caso de Prueba]` Ventas.canal: **registrar-venta-carrito: igual, para web y para app**
- ✔️ `[Caso de Prueba]` Ventas.canal: **la venta fiada desde la app también queda como «app»**
- ✔️ `[Caso de Prueba]` Ventas.canal: **el canal sale de la sesión: un `canal` en el cuerpo o una cabecera X-Canal en la propia venta se ignoran**
- ✔️ `[Caso de Prueba]` Ventas.canal: **las ventas anteriores a la columna (o insertadas sin canal) quedan como «web»**
- ✔️ `[Caso de Prueba]` Ventas.canal: **la base rechaza un canal que no sea «web» o «app»**

### 3.40 Flujo: `ventas_fiado_validaciones.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` El cliente de la venta tiene que ser de la tienda de la sesión: **carrito: un cliente de OTRA tienda da 404 «Cliente no encontrado»; no se registra la venta ni se descuenta stock**
- ✔️ `[Caso de Prueba]` El cliente de la venta tiene que ser de la tienda de la sesión: **venta de un solo producto: igual**
- ✔️ `[Caso de Prueba]` El cliente de la venta tiene que ser de la tienda de la sesión: **un id_cliente inexistente o no numérico también da 404 (antes, 400 «Error interno» o un 500)**
- ✔️ `[Caso de Prueba]` El cliente de la venta tiene que ser de la tienda de la sesión: **un cliente ajeno tampoco se puede ligar a una venta que NO es fiada (efectivo)**
- ✔️ `[Caso de Prueba]` El cliente de la venta tiene que ser de la tienda de la sesión: **un cliente de la propia tienda sigue funcionando (carrito y venta de un solo producto)**
- ✔️ `[Caso de Prueba]` Límite de crédito del cliente: **una venta fiada que deja el saldo POR ENCIMA del cupo se rechaza con 400 y un mensaje claro; no se registra nada**
- ✔️ `[Caso de Prueba]` Límite de crédito del cliente: **justo en el cupo SÍ pasa; la siguiente venta (cualquier monto) ya no**
- ✔️ `[Caso de Prueba]` Límite de crédito del cliente: **cuenta lo que el cliente ya debe: las ventas fiadas anteriores suman y los abonos restan**
- ✔️ `[Caso de Prueba]` Límite de crédito del cliente: **la venta de un solo producto aplica el mismo cupo**
- ✔️ `[Caso de Prueba]` Límite de crédito del cliente: **un cupo de 0 (el valor por defecto al crear un cliente) significa «sin tope»: la venta pasa**
- ✔️ `[Caso de Prueba]` Límite de crédito del cliente: **el cupo solo se aplica a ventas FIADAS: pagar en efectivo a un cliente sin cupo disponible no se bloquea**
- ✔️ `[Caso de Prueba]` Límite de crédito del cliente: **dos ventas fiadas SIMULTÁNEAS al mismo cliente no pueden pasarse del cupo juntas (se serializan por el bloqueo del cliente)**
- ✔️ `[Caso de Prueba]` Producto inexistente o de otra tienda en el carrito: **404 «Producto no encontrado o no pertenece a tu tienda» (antes 400 «Error interno procesando la venta»); el resto del carrito no se vende**
- ✔️ `[Caso de Prueba]` Producto inexistente o de otra tienda en el carrito: **el stock insuficiente sigue siendo 400 con el nombre del producto**

### 3.41 Flujo: `ventas_idempotencia.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **sin la cabecera nada cambia: dos peticiones iguales son dos ventas (compatibilidad con la web)**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **la primera venta con clave se registra normal y NO lleva la marca de repetición**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **el reintento con la misma clave y la misma carga devuelve la MISMA venta sin duplicar nada**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **CARRERA: dos peticiones con la misma clave DENTRO de la transacción a la vez registran una sola venta**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **cinco peticiones casi simultáneas con la misma clave registran una sola venta y todas devuelven su id**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **la repetición sigue valiendo aunque entre medias el stock ya no alcance para una venta nueva**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **la repetición sigue valiendo si la caja se cerró entre medias**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **la misma clave con OTRA carga es un error (422) y no registra una segunda venta**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **dos vendedores pueden usar la misma clave: son ventas independientes**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **una venta que FALLA no consume la clave: tras corregir el problema, la misma clave funciona**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **una clave muy corta da 400 y no registra nada**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **una clave con caracteres no permitidos da 400 y no registra nada**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **una clave demasiado larga da 400 y no registra nada**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **una clave vacía da 400 y no registra nada**
- ✔️ `[Caso de Prueba]` Idempotency-Key en registrar-venta-carrito: **las ventas anteriores (sin clave) no estorban: varias ventas sin clave y una con clave conviven**

### 3.42 Flujo: `ventas_metodo_pago.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **registrar-venta-carrito rechaza "efectivo" con 400 y no registra nada**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **registrar-venta-carrito rechaza "EFECTIVO" con 400 y no registra nada**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **registrar-venta-carrito rechaza "Nequi" con 400 y no registra nada**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **registrar-venta-carrito rechaza "Mixto" con 400 y no registra nada**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **registrar-venta-carrito rechaza 123 con 400 y no registra nada**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **registrar-venta-carrito rechaza true con 400 y no registra nada**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **registrar-venta-carrito rechaza {"a":1} con 400 y no registra nada**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **registrar-venta (un producto) también lo rechaza y no registra nada**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **«Efectivo» se acepta tal cual y se guarda así**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **«Tarjeta» se acepta tal cual y se guarda así**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **«Transferencia» se acepta tal cual y se guarda así**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **«Fiado» se acepta tal cual y se guarda así**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **los espacios alrededor se recortan (sanitizeBody) y se guarda el texto exacto**
- ✔️ `[Caso de Prueba]` metodo_pago de una venta: **sin metodo_pago (o null, o vacío) sigue valiendo «Efectivo» por defecto**

### 3.43 Flujo: `ventas_precio_historico.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Historial de ventas con el precio al que se vendió: **venta de carrito: si el precio del producto cambia después, el historial conserva el precio de la venta**
- ✔️ `[Caso de Prueba]` Historial de ventas con el precio al que se vendió: **venta de un solo producto: también guarda el precio unitario y conserva el historial**
- ✔️ `[Caso de Prueba]` Historial de ventas con el precio al que se vendió: **ventas a precios distintos: cada fila y el total usan el suyo**
- ✔️ `[Caso de Prueba]` Historial de ventas con el precio al que se vendió: **una fila antigua sin precio_unitario (venta anterior a esta corrección) cae al precio actual del producto**

### 3.44 Flujo: `ventas_turno.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` GET /api/ventas: canal y turno: **cada fila trae el canal de la venta; sin parámetros devuelve todas las de la tienda**
- ✔️ `[Caso de Prueba]` GET /api/ventas: canal y turno: **?turno=actual devuelve SOLO las ventas de la caja abierta del usuario (no las de otros vendedores de la tienda)**
- ✔️ `[Caso de Prueba]` GET /api/ventas: canal y turno: **el turno es la caja ABIERTA: tras cerrarla la lista queda vacía, y al abrir otra solo cuenta lo nuevo**
- ✔️ `[Caso de Prueba]` GET /api/ventas: canal y turno: **la paginación respeta el filtro (limit, offset, hasMore y total)**
- ✔️ `[Caso de Prueba]` GET /api/ventas: canal y turno: **un valor de turno distinto de «actual» es un error del cliente (400); no se interpreta como «sin filtro»**
- ✔️ `[Caso de Prueba]` GET /api/ventas: canal y turno: **las ventas de otra tienda nunca aparecen, con o sin filtro**

### 3.45 Flujo: `venta_concurrencia.test.js`
**Estado:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Venta con concurrencia: **POST /api/registrar-venta (un producto): con stock=1, dos ventas simultáneas de 1 unidad -> una sola gana**
- ✔️ `[Caso de Prueba]` Venta con concurrencia: **POST /api/registrar-venta-carrito (mismo producto): con stock=1, dos ventas simultáneas de 1 unidad -> nunca sobrevende (observado, ver hallazgo 8.7 sobre por qué no está garantizado por diseño)**
- ✔️ `[Caso de Prueba]` Venta con concurrencia: **POST /api/registrar-venta-carrito bajo más contención (5 pedidos simultáneos, stock=3): nunca vende más unidades de las que había en stock**


---

### 4. Firma de Aprobación Automatizada
*Documento autogenerado por el pipeline de Integración Continua (CI) de StockPilot.*  
*Generado para su anexo como evidencia técnica en documento de grado.*