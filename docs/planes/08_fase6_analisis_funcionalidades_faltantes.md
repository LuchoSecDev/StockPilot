# 🔍 Plan 08: Análisis de Funcionalidades Faltantes — StockPilot

**Estado (revisado el 9-oct-2026):** Fiados (punto 1) y métodos de pago (punto 4) implementados; rentabilidad (2) y conteo físico (3) parciales; historial de costos (5) y notificaciones push (6) sin iniciar. Detalle: P08-01 a P08-09.

> **Cifras sin fuente en este análisis:** «la función #1 más solicitada según MinTIC y Fenalco», «pierden entre $200.000 y $500.000 mensuales», «el 60 % usa Nequi o Daviplata (SFC, 2024)», «tasa de apertura del 90 % frente al 20 %», «inflación >10 % en 2023» y las afirmaciones de «ningún competidor». No tienen una referencia verificable en el repositorio: no citarlas en los documentos académicos sin la fuente (regla del plan 23, sección 6). La evidencia propia es la encuesta (n = 15).

## Contexto

Este análisis cruza tres fuentes:
1. **El estado actual del sistema** (70 RF implementados, 15 módulos).
2. **Investigación de mercado** sobre tendencias en software de inventario para retail 2025-2026.
3. **Necesidades específicas del tendero colombiano** documentadas por Fenalco, MinTIC y la propia validación de StockPilot.

El objetivo es identificar funcionalidades que **ningún competidor directo** (Treinta, Alegra, Siigo) ofrezca de forma integrada, y que sean técnicamente viables de implementar con el stack actual (Node.js + React + PostgreSQL).

---

## ✅ Lo que StockPilot YA tiene (y que es competitivo)

| Área | Funcionalidad | Diferenciador vs Competencia |
| :--- | :--- | :--- |
| IA Predictiva | Predicción de demanda, órdenes inteligentes, feedback loop | **Único en el segmento** |
| POS + Caja | Punto de venta, sesiones de caja, egresos con aprobación | Completo |
| Alertas | Stock crítico, vencimiento, sobrestock con sonido | Avanzado |
| Clasificación ABC | Pareto dinámico con guardrails IA | **Único** |
| Simulador | Escenarios de compra con presupuesto | **Único** |
| Promociones IA | Sugerencias automáticas de descuento/combo/2x1 | **Único** |
| Exportación | Excel + PDF con auditoría de merma | Estándar |
| Automatización | Resumen semanal por correo (cron) | Avanzado |
| Escaneo | Código de barras + OpenFoodFacts | Bueno |

---

## ❌ Lo que FALTA (Oportunidades Identificadas)

### 🏆 Tier 1 — Alto Impacto + Alta Viabilidad (Recomendadas)

---

#### 1. 📒 Gestión de Fiados (Créditos a Clientes)

> **¿Qué es?** El "fiado" es la práctica más arraigada del comercio de barrio en Colombia: el tendero vende productos a crédito a clientes de confianza y anota la deuda en una libreta. Es una realidad económica masiva.

**¿Por qué es crítico?**
- La investigación de MinTIC y Fenalco lo identifica como **la función #1 más solicitada** por tenderos después del control de inventario.
- **Treinta** tiene una versión básica (solo registra deuda), pero **ningún competidor cruza los fiados con el inventario ni con la IA**.
- Los tenderos pierden entre **COP $200.000 y $500.000 mensuales** en fiados olvidados o no cobrados.

**¿Qué haría StockPilot diferente?**
- Registro de clientes frecuentes con nombre, celular y límite de crédito.
- Cada venta en el POS puede marcarse como "Fiado" en lugar de "Pagado".
- Dashboard de cartera: quién debe cuánto, hace cuánto, y alerta automática si un cliente supera su límite.
- **Diferenciador IA:** El sistema podría sugerir a qué clientes NO fiar más basándose en su historial de pago (nunca abona, abona tarde, etc.).

**Viabilidad técnica:** ⭐⭐⭐⭐⭐ (Alta)
- Solo requiere una tabla `Clientes` y una tabla `CuentasPorCobrar` con FK a `Ventas`.
- El POS ya tiene el flujo de venta; solo se agrega un toggle "Fiado/Contado".
- Estimación: **2-3 días de desarrollo**.

---

#### 2. 📊 Dashboard de Rentabilidad por Producto (Margen Real)

> **¿Qué es?** Un panel que muestre no solo cuánto se vende, sino **cuánto se gana** por cada producto, identificando "productos trampa" (alto volumen pero margen bajo) y "joyas ocultas" (bajo volumen pero margen alto).

**¿Por qué es crítico?**
- StockPilot ya almacena `precio` y `costo` en cada producto, pero **no existe ninguna vista que calcule ni muestre el margen de ganancia**.
- Los tenderos toman decisiones de compra basándose en volumen de ventas, no en rentabilidad. Esto es un error común que genera pérdidas silenciosas.
- **Ningún competidor** en el segmento microempresa ofrece análisis de margen cruzado con clasificación ABC.

**¿Qué haría StockPilot diferente?**
- Margen bruto por producto: `((precio - costo) / precio) × 100`.
- Ranking de productos por rentabilidad total (margen × unidades vendidas).
- Alertas de "producto trampa": si un producto Clase A tiene margen < 10%, el sistema avisa.
- Cruce con IA: "Este producto genera el 15% de tus ventas pero solo el 3% de tu ganancia. Considera renegociar con tu proveedor o subir el precio."

**Viabilidad técnica:** ⭐⭐⭐⭐⭐ (Alta)
- Los datos ya existen (`precio`, `costo` en tabla `Productos`; `cantidad`, `precio_unitario` en `DetalleVenta`).
- Es fundamentalmente un nuevo endpoint de reportes + una sección nueva en el Centro Analítico.
- Estimación: **1-2 días de desarrollo**.

---

#### 3. 📦 Módulo de Conteo Físico / Auditoría de Inventario

> **¿Qué es?** Una herramienta para que el tendero haga un conteo físico de su inventario real y lo compare automáticamente con lo que dice el sistema, identificando diferencias (mermas, robos, errores de registro).

**¿Por qué es crítico?**
- El inventario digital **nunca es 100% exacto**: se rompen productos, se roban, se regalan, se dañan. Con el tiempo, la diferencia entre lo que dice el sistema y lo que hay en la estantería crece.
- Sin esta función, el tendero pierde confianza en el sistema porque "dice que tengo 20 jabones pero solo veo 17".
- **Ningún competidor del segmento** ofrece un flujo guiado de conteo con detección de diferencias.

**¿Qué haría StockPilot diferente?**
- "Iniciar Conteo": El sistema lista todos los productos y el tendero va ingresando la cantidad real que cuenta.
- Al finalizar, se genera un reporte de diferencias: `Stock Sistema vs. Stock Real`, con valor económico de la diferencia.
- Opción de "Ajustar inventario" que registra un movimiento automático de tipo "Ajuste por conteo" con la diferencia.
- **Diferenciador:** Cruce con IA para identificar patrones de merma ("Siempre faltan galletas los fines de semana → posible robo hormiga").

**Viabilidad técnica:** ⭐⭐⭐⭐ (Alta)
- Requiere una tabla `ConteoFisico` (id, fecha, id_tienda, id_usuario, estado) y `DetalleConteo` (id_producto, stock_sistema, stock_real, diferencia).
- Se integra con `MovimientosInventario` para los ajustes.
- Estimación: **2-3 días de desarrollo**.

---

### 🥈 Tier 2 — Impacto Medio + Viabilidad Media

---

#### 4. 💰 Registro de Métodos de Pago (Nequi, Daviplata, Efectivo, Transferencia)

> **¿Qué es?** Que cada venta registre **cómo pagó el cliente** (efectivo, Nequi, Daviplata, transferencia), no solo el monto.

**¿Por qué importa?**
- El POS actualmente registra ventas pero no diferencia el método de pago.
- Para el cuadre de caja, es crítico saber cuánto entró en efectivo vs. cuánto entró digital (porque el efectivo es lo que se cuenta físicamente al cerrar).
- Colombia ha tenido una explosión de billeteras digitales: el 60% de los colombianos ya usa Nequi o Daviplata (SFC, 2024).

**Viabilidad:** ⭐⭐⭐⭐ (Alta)
- Solo un campo `metodo_pago ENUM('efectivo', 'nequi', 'daviplata', 'transferencia')` en la tabla `Ventas`.
- El cuadre de caja filtra solo las ventas con `metodo_pago = 'efectivo'` para el arqueo físico.
- Estimación: **1 día de desarrollo**.

> [!NOTE]
> Revisando el código, veo que `metodo_pago` ya fue añadido a la tabla `Ventas` en el diagrama ER reciente. Faltaría integrar el selector en el frontend del POS y ajustar la lógica de cierre de caja para filtrar por método.

> **Actualización (9-oct-2026):** implementado en el plan 01 (`PaymentModal.jsx`, `Ventas.metodo_pago`); el arqueo solo suma el efectivo, `metodo_pago` se valida desde el 4-oct y el arqueo muestra el desglose por método desde el 5-oct (plan 24).

---

#### 5. 📈 Historial de Precios de Costo (Fluctuación de Proveedores)

> **¿Qué es?** Registrar cada vez que cambia el precio de costo de un producto al recibir mercancía, para detectar tendencias de inflación o proveedores que suben precios sin avisar.

**¿Por qué importa?**
- En Colombia, los precios de los insumos suben constantemente (inflación acumulada >10% en 2023).
- El tendero no se da cuenta de que su proveedor subió el arroz un 8% hasta que hace cuentas al final del mes y ve que su margen se redujo.
- **Ningún competidor** ofrece tracking automático de fluctuación de costos.

**Viabilidad:** ⭐⭐⭐⭐ (Alta)
- Una tabla `HistorialCostos` (id_producto, costo_anterior, costo_nuevo, fecha, id_proveedor).
- Se registra automáticamente cada vez que se edita el costo de un producto o se recibe inventario.
- Gráfico de línea en el detalle del producto mostrando la evolución del costo.
- Estimación: **1-2 días de desarrollo**.

---

#### 6. 🔔 Notificaciones Push (PWA)

> **¿Qué es?** Enviar notificaciones nativas al celular del tendero (como WhatsApp) cuando ocurran eventos críticos, incluso si no tiene la app abierta.

**¿Por qué importa?**
- StockPilot ya está configurado como PWA (`manifest.json` existe), pero no usa la API de Push Notifications.
- El correo semanal es útil pero no inmediato. Si un producto se agota a las 2 PM, el tendero no se entera hasta el lunes siguiente.
- Las notificaciones push tienen una tasa de apertura del 90% vs. 20% del email.

**Viabilidad:** ⭐⭐⭐ (Media)
- Requiere un Service Worker con la Web Push API y un servidor de notificaciones (ej. web-push de npm).
- Integración con las alertas existentes para disparar pushes en tiempo real.
- Estimación: **2-3 días de desarrollo**.

---

### 🥉 Tier 3 — Ideas a Futuro (Post-Lanzamiento)

| Idea | Descripción | Complejidad |
| :--- | :--- | :--- |
| **Facturación Electrónica DIAN** | Generación de facturas electrónicas según normativa colombiana. Requiere integración con proveedores tecnológicos autorizados. | 🔴 Alta (requiere certificación) |
| **Catálogo compartido para clientes** | URL pública donde los clientes del barrio pueden ver qué productos tiene la tienda y precios, tipo "vitrina digital". | 🟡 Media |
| **Integración con WhatsApp Business API** | Enviar alertas y resúmenes directamente por WhatsApp en vez de email. | 🟡 Media (costo API) |
| **App Companion (Flutter/React Native)** | Versión nativa móvil para operaciones rápidas (conteo, escaneo, consulta). | 🔴 Alta |
| **Multi-tienda centralizada** | Un solo admin con vista consolidada de N tiendas (franquicias). | 🟡 Media |

---

## 📋 Resumen Ejecutivo: Top 3 Recomendaciones

| # | Funcionalidad | Impacto Diferenciador | Esfuerzo | Prioridad |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **Gestión de Fiados** | 🔥🔥🔥🔥🔥 Ningún competidor lo cruza con IA | 2-3 días | **CRÍTICA** |
| 2 | **Dashboard de Rentabilidad (Margen)** | 🔥🔥🔥🔥 Datos ya existen, solo falta visualizar | 1-2 días | **ALTA** |
| 3 | **Conteo Físico / Auditoría de Inventario** | 🔥🔥🔥🔥 Cierra el ciclo de confianza en el sistema | 2-3 días | **ALTA** |

> [!IMPORTANT]
> La **Gestión de Fiados** es, con diferencia, la funcionalidad más impactante que le falta a StockPilot. Es el dolor #1 del tendero colombiano después del desabastecimiento, y es la única que podría hacer que un tendero elija StockPilot sobre Treinta **solo por esta función**. Ningún competidor la integra con IA predictiva.
