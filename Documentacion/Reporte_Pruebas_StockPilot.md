---
title: Certificado de Pruebas Unitarias y Aseguramiento de Calidad
author: Sistema de Gestión de Inventario Inteligente (StockPilot)
date: 25/9/2026, 10:46:49 p. m.
---

# 📄 Certificado Oficial de Calidad de Software y Pruebas Unitarias

**Proyecto:** StockPilot — Sistema de Gestión de Inventario Inteligente
**Fecha de Certificación:** 25/9/2026, 10:46:49 p. m.
**Framework de Validación:** Vitest v3
**Entorno de Ejecución:** Node.js (V8 Engine)

---

## 1. Resumen Ejecutivo de Validación

El presente documento certifica la ejecución automatizada de la suite de pruebas unitarias sobre los módulos críticos (Lógica Financiera, Inteligencia Artificial y Seguridad) del sistema **StockPilot**. Las pruebas fueron diseñadas bajo el enfoque de validación de caja blanca y pruebas de límites.

### 1.1. Métricas de Ejecución
- **Total de Escenarios Evaluados:** `154`
- **Tasa de Éxito (Pass Rate):** `100.00%`
- **Escenarios Exitosos:** `154`
- **Escenarios Fallidos:** `0`
- **Tiempo Computacional (Latencia):** `0.06 ms`

### 1.2. Veredicto del Sistema
> **[ESTADO: APROBADO]** ✅  
> La integridad de los algoritmos predictivos, controles de acceso y matemática logística cumple con las especificaciones del diseño arquitectónico. El código está estabilizado y certificado como *Production-Ready* en el ámbito lógico.

## 2. Detalle de Certificación por Módulo (Matriz de Trazabilidad)

A continuación se detalla el comportamiento de cada componente sometido a estrés y validación lógica:

### 2.1 Módulo Subyacente: `ai_feedback_metrics.test.js`
**Estado del Módulo:** ✅ Aprobado

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
**Estado del Módulo:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **Excluye los productos con base_load = 0 (stock de sobra), aunque sean los más facturados**
- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **Ordena por urgencia: CRÍTICO antes que MEDIO y BAJO**
- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **A igual riesgo conserva el orden de entrada (los más facturados primero)**
- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **Respeta el límite de productos enviados a la IA**
- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **Devuelve vacío si nada necesita reposición (no hay que llamar a la IA)**
- ✔️ `[Caso de Prueba]` Consejero IA — selección de candidatos: **Un riesgo desconocido se trata como el menos urgente**
- ✔️ `[Caso de Prueba]` Consejero IA — recomendación accionable: **Acepta sugerencias de una o más unidades**
- ✔️ `[Caso de Prueba]` Consejero IA — recomendación accionable: **Rechaza 0 unidades, negativos, no numéricos y nulos**

### 2.3 Módulo Subyacente: `dashboard_analytics.test.js`
**Estado del Módulo:** ✅ Aprobado

- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería calcular margen 50% cuando costo = mitad del precio**
- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería calcular margen 0% cuando costo = precio**
- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería promediar múltiples productos**
- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería retornar 0 si no hay productos**
- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería manejar un único producto con precio = 0 sin error (división por cero)**
- ✔️ `[Caso de Prueba]` Especificación de la fórmula: Margen Promedio (no prueba código de producción) > Margen de Ganancia Promedio: **Debería EXCLUIR del promedio los productos con precio = 0, igual que NULLIF+AVG en SQL**

### 2.4 Módulo Subyacente: `input_sanitization.test.js`
**Estado del Módulo:** ✅ Aprobado

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

### 2.5 Módulo Subyacente: `inventory_math.test.js`
**Estado del Módulo:** ✅ Aprobado

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

### 2.6 Módulo Subyacente: `product_polymorphism.test.js`
**Estado del Módulo:** ✅ Aprobado

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

### 2.7 Módulo Subyacente: `reposicion.test.js`
**Estado del Módulo:** ✅ Aprobado

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
- ✔️ `[Caso de Prueba]` calcularTendencia: **se acota entre 0,5 y 2**
- ✔️ `[Caso de Prueba]` calcularTendencia: **con muestra pequeña no exagera**
- ✔️ `[Caso de Prueba]` costoUnitario: **usa costo_compra si existe**
- ✔️ `[Caso de Prueba]` costoUnitario: **si es 0 o nulo estima con el margen y lo marca**
- ✔️ `[Caso de Prueba]` agruparPorProveedor: **agrupa por proveedor, separa sin proveedor y omite cantidad 0 y duplicados**
- ✔️ `[Caso de Prueba]` agruparPorProveedor: **total = Σ cantidad × costo**

### 2.8 Módulo Subyacente: `security_auth_rules.test.js`
**Estado del Módulo:** ✅ Aprobado

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


---

### 3. Firma de Aprobación Automatizada
*Documento autogenerado por el pipeline de Integración Continua (CI) de StockPilot.*  
*Generado para su anexo como evidencia técnica en documento de grado.*