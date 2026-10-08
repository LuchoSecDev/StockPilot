![C:\\Users\\Carlos\\Desktop\\Física I\\logo.png][image1]

Plan de Negocios: StockPilot

**Sistema Inteligente de Gestión de Inventarios y Ventas con Inteligencia Artificial Predictiva** 

Práctica de Ingeniería V

Elizabeth Pérez González  
Luis Alberto Diuche Peña  
Miguel Angel Espinosa Esparza

Profesor Juan Carlos Franco Rodriguez

Universidad Central

Bogotá D.C

 28 de Agosto de 2026

# Módulo 0: Datos Generales

**Localización de la empresa:**

**Ciudad sede principal:** Bogotá D.C, Colombia  
**Cobertura operativa:** Nacional (operación 100% remota / SaaS con acceso desde cualquier región del país con conexión a internet)  
**Dirección física:** Operación remota (Home Office) con base administrativa en la localidad de Teusaquillo, Bogotá D.C.  
**Justificación de la ubicación:** Bogotá concentra el 24.7% del total de empresas activas del país (MinCIT, 2023\) y es el principal centro de desarrollo tecnológico de Colombia, adicionalmente, la operación 100% remota minimiza los gastos fijos (sin necesidad de arrendamiento de oficina física), lo cual es crítico en la etapa inicial.

Mantener la base administrativa en Bogotá facilita el networking y si esta se ubica específicamente en la localidad de Teusaquillo esto nos ofrece fácil acceso, zonas de coworking con costos asequibles y cercanía a la Universidad Central, facilitando la vinculación de talento joven. Por último, el uso de coworking esporádico (cuando se requiera) permite tener una dirección comercial formal sin los costos fijos de un arriendo tradicional.

**Sector económico**  
**Código CIIU:**  6201 \- Actividades de desarrollo de sistemas informáticos (software)  
**Clasificación:** Sector Terciario \- Servicios de Tecnología de la Información.  
**Justificación:** El proyecto consiste en el desarrollo y comercialización de una plataforma software como servicio (SaaS), actividad que corresponde exactamente a la descripción del código CIIU 6201: "Actividades de desarrollo de sistemas informáticos (software)".

**Descripción del proyecto**  
StockPilot es una plataforma web bajo el modelo Software as a Service (SaaS) diseñada para digitalizar, optimizar y automatizar la gestión de inventarios, ventas y compras de microempresas y pequeñas empresas del sector retail en Colombia, con énfasis en tiendas de barrio, minimercados, ferreterías y distribuidoras de víveres.

El núcleo diferenciador de StockPilot es la integración de un motor de inteligencia artificial predictiva que:

1. Analiza automáticamente el historial de ventas para calcular velocidades de consumo por producto.  
2. Proyecta fechas estimadas de agotamiento y detecta riesgos de desabastecimiento.  
3. Genera alertas tempranas de vencimiento y sobrestock.  
4. Sugiere órdenes de compra inteligentes con cantidades óptimas.  
5. Aprende de sus propias predicciones mediante un bucle de retroalimentación continua (Feedback IA).

**Objetivo General del Proyecto:**  
Posicionar StockPilot como la solución líder en gestión inteligente de inventarios para microempresas del sector retail en Colombia, alcanzando una base de **120 clientes activos al finalizar el primer año de operación comercial**, con una **facturación acumulada anual de COP 39.900.000** (proyección conservadora) y generando **2 empleos directos** en el primer año, con un equipo fundador de 3 personas (nosotros).

**Metas del primer año**

| Indicador | Meta (Año 1\)	 | Justificación |
| :---: | :---: | :---: |
| Empleos directos | 2 | Equipo mínimo: 1 Líder Comercial (mes 1\) \+ 1 Desarrollador/Soporte (mes 2). Los fundadores (3) no reciben salario en el primer año. |
| Ventas (ingresos acumulados) | COP 39.900.000 | Proyección de 120 clientes promedio a $39.900/mes (crecimiento gradual: 10 en mes 1 → 120 en mes 12\) |
| Clientes activos (fin de año) | 120 | Crecimiento gradual: 10 en mes 1, 25 en mes 3, 50 en mes 6, 120 en mes 12 |
| Mercadeo (eventos)  | 4 eventos | Ferias de emprendimiento y retail en Bogotá y principales ciudades |
| Contrapartida SENA | $2.000.000 | Aportes de fundadores en especie (horas de trabajo, equipos preexistentes) |
| Empleos indirectos | 1 | Asesoría legal y contable externa (honorarios) |

# 

# Módulo I: ¿Quién es el protagonista? 

**1\. Perfil del Cliente y Localización**

**1.1. Perfil del Cliente (Quien paga la suscripción)**

| Característica | Descripción |
| ----- | ----- |
| Tipo de negocio | Tiendas de barrio, minimercados, distribuidoras de víveres, ferreterías, misceláneas |
| Edad del propietario | 35 a 60 años (promedio 40-44 según Fenalco) |
| Género | 52% mujeres, 48% hombres (Fenalco, 2021\) |
| Nivel educativo | Bachillerato completo o técnico/tecnólogo |
| Ingresos mensuales del negocio | COP 2.000.000 a COP 15.000.000 |
| Número de empleados | 1 a 5 personas |
| Localización | Zonas urbanas y periurbanas de Colombia (estratos 2, 3 y 4\) con acceso a internet |
| Concentración geográfica | Bogotá (Kennedy, Suba, Engativá), Medellín, Cali, Barranquilla, Bucaramanga |
| Nivel tecnológico actual | Bajo a medio. Uso de cuadernos, libretas u hojas de cálculo básicas |
| Dispositivo principal | Teléfono inteligente (Android/iOS) con conexión a internet |
| Hábitos de compra | Compras a proveedores cada 8-15 días, generalmente por necesidad inmediata  |
| Principales frustraciones | Pérdidas por vencimiento, desabastecimiento, tiempo en inventario manual (en cuadernos o en hojas de cálculo (Excel) muy básicas) |

**1.2. Justificación del Segmento de Clientes**  
La selección de este segmento se fundamenta en seis pilares cuantitativos y cualitativos:

**1\. Tamaño del mercado y relevancia económica:**  
Colombia cuenta con aproximadamente **500.000 tiendas de barrio** que representan el 40% del comercio nacional y generan empleo para cerca de 575.000 personas (Fenalco, Napse, 2024). Bogotá concentra entre **40.000 y 50.000** de estos negocios (DANE, 2022).

**2\. Brecha de digitalización comprobada:**  
El **76% de las microempresas** no ha adoptado la facturación electrónica y el **55%** no ha iniciado ningún proceso de transformación digital (ACOPI, 2023). Solo el **15%** de los tenderos usaba algún software básico en 2015 (Cámara de Comercio de Bogotá).

**3\. Pérdidas económicas cuantificables y urgentes:**  
Las tiendas de barrio pierden en promedio el **4.76% de sus ventas anuales** en mermas y vencimientos (BID, 2021). Para una tienda con ventas de COP 8.000.000 mensuales, esto representa **COP 380.000 perdidos cada mes**.

**4\. Alta rotación de inventario y desbalance:**  
El **61% de las tiendas** reporta simultáneamente faltantes de productos de alta demanda y excesos de productos de baja rotación (Microsip, 2023).

**5\. Acceso a internet y adopción de dispositivos móviles:**  
El **88% de los hogares en zonas urbanas** de Colombia tiene acceso a internet (DANE, 2023\) y el **96% de los colombianos** tiene un teléfono inteligente (GSMA, 2023).

**6\. Concentración en Bogotá como mercado inicial:**  
Bogotá concentra el **24.7%** del total de empresas activas del país (MinCIT, 2023), con **40.000 a 50.000** microempresas dedicadas a la distribución de víveres (DANE, 2022), concentradas en Kennedy (11.5%), Suba (10.7%) y Engativá (8.8%).

**Cliente vs. Consumidor:** El cliente es el dueño del negocio (quien paga la suscripción), y el consumidor o usuario final es el tendero o cajero que opera el sistema en el día a día.

**1.3. Perfil del Consumidor (Usuario final del sistema)**

| Característica | Descripción |
| ----- | ----- |
| **Perfil** | Tenderos, cajeros, empleados de tienda que operan el sistema en el día a día |
| **Edad** | 20 a 50 años |
| **Nivel educativo** | Bachillerato o técnico |
| **Habilidad tecnológica** | Básica a media. Familiaridad con aplicaciones móviles (WhatsApp, redes sociales) |
| **Responsabilidad** | Registrar ventas, movimientos de inventario y consultar alertas |
| **Tiempo en el negocio** | Variable, generalmente con alta rotación laboral |
| **Motivación principal** | Hacer su trabajo más rápido y con menos errores |

**2\. Necesidades a Satisfacer**  
Con base en el análisis del problema (documentado en el Árbol de Problemas y Diagrama de Ishikawa) y las herramientas de ideación (Lean Canvas, entrevistas, encuestas), las necesidades críticas que StockPilot satisface son:

**2.1. Necesidades de los Clientes (Dueños de tienda)**

| \# | Necesidad | Descripción detallada | Evidencia cuantificable |
| :---: | :---: | :---: | :---: |
| 1 | Prevenir desabastecimiento | Saber con anticipación cuándo un producto se va a agotar para realizar el pedido a tiempo | El **42% de los clientes** abandona la compra por faltantes (DANE, 2022\) |
| 2 | Reducir pérdidas por vencimiento | Identificar productos próximos a vencer y calcular cuántas unidades no se venderán | El **28% de productos perecederos** se deteriora antes de venderse (BID, 2021\) |
| 3 | Optimizar compras a proveedores | Saber exactamente qué, cuánto y cuándo comprar a cada proveedor | El **22% de las compras** se realizan en emergencia a precios inflados (MRPEasy) |
| 4 | Ahorrar tiempo en gestión | Automatizar el conteo, control y planeación de inventario | El inventario manual toma **4 horas semanales** (Microsip, 2023\) |
| 5 | Clasificar productos por importancia | Identificar qué productos generan más ingresos (clasificación ABC) | Sin clasificación, el tendero trata todos los productos igual |
| 6 | Tomar decisiones con datos | Contar con métricas objetivas (velocidad de venta, punto de reorden, tendencias) | Actualmente la planeación de compras es **100% intuitiva** |
| 7 | Mejorar competitividad | Competir con cadenas organizadas que ya tienen sistemas de inventario | Las cadenas como D1, Ara o Oxxo le arrebatan le arrebatan **2.7% de participación** de mercado anual (MinCIT) |
| 8 | Capacitar y controlar empleados | Que los colaboradores puedan operar el sistema sin necesidad de un contador o de conocimientos técnicos avanzados | La edad promedio del tendero **(40-44 años)** y su baja familiaridad tecnológica exigen una interfaz extremadamente intuitiva (Fenalco, 2021). |
| 9 | Reducir el estrés y la incertidumbre | Disminuir la ansiedad de no saber si va a faltar producto o si se va a dañar la mercancía | El **70% de las microempresas** cierra antes de cumplir 5 años, en parte por la presión de una gestión ineficiente (eWorkplace, 2023). |

	

**2.2. Necesidades de los Consumidores (Tenderos/Empleados)**

| \# | Necesidad	 | Descripción |
| :---: | :---: | :---: |
| 1 | Registro rápido de ventas | Poder registrar una venta en menos de 2 minutos |
| 2 | Consulta de stock en tiempo real | Saber instantáneamente si hay producto en bodega sin tener que ir a buscar físicamente |
| 3 | Alertas claras y accionables | Recibir notificaciones simples de qué producto necesita atención y qué acción tomar |
| 4 | Interfaz intuitiva | 	Operar el sistema sin capacitación extensa, con una curva de aprendizaje mínima |
| 5 | Reducción de conflictos | Evitar tener que explicar a los clientes que el producto no está disponible o que está vencido |

# 

# Módulo II: ¿Existe oportunidad en el mercado?

**3\. Tendencia de Crecimiento del Mercado**  
De acuerdo con el Ministerio TIC de Colombia y FENALCO, solo cerca del **30% de las microempresas** utilizan software especializado. La necesidad de digitalización en el comercio minorista creció exponencialmente tras la pandemia.

**3.1. Análisis del Mercado Objetivo (TAM, SAM, SOM)**

| Variable | Dato | Fuente | Año  |
| :---: | :---: | :---: | :---: |
| Tiendas de barrio en Colombia (TAM) | 500.000 | Fenalco, Napse  | 2024 |
| Tiendas de barrio en Bogotá (SAM) | 40.000 \- 50.000 | DANE (Encuesta de Micronegocios) | 2022 |
| % de microempresas sin digitalización | 76% | ACOPI | 2023 |
| % de tenderos que usa software básico | 15% | Cámara de Comercio de Bogotá | 2015 |
| % de microempresas sin facturación electrónica | 76% | Centro Nacional de Consultoría / iNNpulsa | 2024 |
| % de microempresas sin proceso de transformación digital | 55% | ACOPI | 2023 |
| % de tenderos que adoptó herramientas digitales post-pandemia | 40% | DANE | 2021 |
| SOM (Año 1 \- objetivo) | 120 tiendas | Cálculo propio (0.24% del SAM de Bogotá) | 2026 |
| SOM (Año 2 \- proyección) | 300 tiendas | Cálculo propio | 2027 |
| SOM (Año 3 \- proyección) | 600 tiendas | Cálculo propio | 2028 |

**Justificación de la proyección:**

* El mercado total direccionable (TAM) es de 500.000 tiendas a nivel nacional.  
* El mercado disponible (SAM) se concentra en Bogotá con 40.000-50.000 tiendas.  
* El mercado obtenible (SOM) para el primer año es de 120 tiendas, lo que representa menos del **0.3% del mercado de Bogotá**, una meta conservadora y alcanzable con un solo asesor comercial de campo y pauta digital localizada.

### **3.2. Tendencias de Crecimiento del Sector**

**1\. Aceleración de la digitalización post-pandemia:**

* **El 40% de los tenderos bogotanos** adoptó plataformas digitales durante la pandemia de COVID-19, el cual fueun catalizador forzoso para la digitalización de las microempresas. (DANE, 2021), un salto significativo desde el **15% reportado** en 2015\. Esta tendencia no se ha revertido y continúa acelerándose.

* Se proyecta un **crecimiento anual del mercado de software de gestión para PyMEs del 12.5%** para el período 2024-2028 (Market Research Future).

**2\. Aumento de la penetración de internet y dispositivos móviles:**

* El acceso a internet en zonas urbanas alcanza el **88%** (DANE, 2023).  
* El **96%** de los colombianos posee un teléfono inteligente (GSMA, 2023).  
* El costo de datos móviles ha disminuido un **60% en los últimos 5 años.**

**3\. Políticas gubernamentales de apoyo a la digitalización:**

* El gobierno colombiano ha implementado programas como "**MiPYME Digital**" (Ministerio TIC) y "**Centros de Desarrollo Tecnológico**" y la Ley de Financiamiento que incentivan la formalización y digitalización de las microempresas.

* Estos programas crean un entorno favorable para la adopción de soluciones tecnológicas.

**4\. Demanda insatisfecha en el canal tradicional:**

* Las soluciones actuales **(Treinta, Alegra, Siigo)** stán orientadas principalmente a la contabilidad fiscal y facturación electrónica, no a **gestión operativa predictiva**, que es el dolor más agudo del tendero.

* Esta demanda insatisfecha representa una oportunidad de mercado significativa.

**5\. Consolidación de la industria de software en Colombia:**

* Colombia es el **tercer mercado de tecnología más grande de Latinoamérica** (BID, 2023\) y el sector de software y TI creció un **8.5% en 2024** (Fedesoft).  
* El ecosistema emprendedor tecnológico colombiano está en plena expansión, con múltiples casos de éxito (Rappi, Chiper, Treinta) que demuestran que las startups de tecnología B2B tienen un mercado receptivo y en crecimiento.

**3.3. Validación de Mercado (Metodología y Resultados)**

| Etapa | Herramienta | Participantes | Descripción | Resultado |
| :---: | :---: | :---: | :---: | :---: |
| 1\. Descubrimiento | Lean Canvas | Equipo fundador | Identificación de segmentos de clientes, problema, solución, métricas clave y ventaja competitiva | Validación del problema central: pérdidas por vencimiento y desabastecimiento |
| 2\. Empatía | Entrevistas en profundidad  | 15 tenderos   | Tenderos en las localidades de Kennedy, Suba y Engativá (Bogotá) | 100% reportó pérdidas por vencimiento como problema recurrente |
| 3\. Cuantificación | Encuestas estructuradas | 50 tenderos en Bogotá  | Validación de necesidades y disposición a pagar | El 92% manifestó interés en una herramienta que prediga desabastecimiento |
| 4\. Prototipado | Prototipo en Figma  | 10 tenderos  | Validación de usabilidad y experiencia de usuario | NPS del prototipo: 68 (excelente) |
| 5\. PMV  | Desarrollo funcional y pruebas piloto | 5 tiendas en Bogotá  | Pruebas con 5 tiendas en entorno controlado | Validación de funcionalidad y valor percibido |

**Resultados clave de la validación:**

| Hallazgo | Resultado | Implicación para el negocio |
| :---: | :---: | :---: |
| Disposición a pagar | **78%** dispuesto a pagar entre $20.000 y $50.000 mensualespor una solución que prediga desabastecimiento  | Valida el modelo de precios: $39.900/mes es aceptable |
| Interés en IA | **85%** manifestó interés en recomendaciones automáticas de compra | El componente de IA es un diferenciador atractivo |
| Frustración por vencimiento | **92%** reportó pérdidas por vencimiento como problema significativo | El enfoque en alertas de vencimiento es el principal motor de compra |
| Tiempo de inventario manual | Promedio: **4 horas semanales** | El ahorro de tiempo es un beneficio tangible y valorado |
| Motivación principal | "No perder ventas por falta de producto" **(84%)** | El mensaje de marketing debe enfocarse en prevención de pérdidas |
| Segunda motivación | "No botar comida" **(76%)** | El mensaje ambiental y de ahorro económico es igualmente poderoso |

**4\. Análisis de la Competencia**

### **4.1. Mapa de Competidores**

| Criterio | StockPilot | Treinta | Alegra | Siigo |
| :---: | :---: | :---: | :---: | :---: |
| Concepto del negocio | Gestión de inventario con IA predictiva | App para control de tienda | Facturación y contabilidad | Facturación y contabilidad |
| Localización | Colombia (SaaS) | Colombia | Colombia | Colombia |
| Precio mensual | $39.900 | $39.900 \- $99.900  | $49.000 \- $89.000 | $55.000 \- $99.000 |
| Enfoque principal | Logística operativa \+ IA | Control de tienda | Facturación electrónica | Facturación \+ módulos |
| Predicción de demanda | Sí (IA) | No | No | No |
| Alertas de vencimiento | Sí | No | No | No |
| Clasificación ABC dinámica | Sí (automática) | No | No | No |
| Órdenes de compra con IA | Sí | No | No | No |
| Simulador de escenarios | Sí | No | No | No |
| Bucle de aprendizaje IA | Sí | No | No | No |
| Feedback de precisión | Sí | No | No | No |
| Control de Caja y Egresos | Sí (Con auditoría) | Básica | Sí | Sí |
| Interfaz para tenderos | Alta (diseñada para no técnicos) | Media | Baja (requiere contador) | Baja (requiere contador) |
| Curva de aprendizaje | Baja | Media | Alta | Alta |
| Equipo de desarrollo | 3 ingenieros | \>50 empleados | \>200 empleados | \>100 empleados |
| Tiempo en mercado | 2026 (lanzamiento) | 2018 | 2010 | 2010 |
| Inversión recibida | $0 (bootstrapping) | \>US$65M | N/A (empresa consolidada) | N/A (empresa consolidada) |

### **4.2. Ventajas Competitivas de StockPilot**

| \# | Ventaja	 | Descripción | Impacto |
| :---: | :---: | :---: | :---: |
| 1 | Enfoque 100% en logística operativa | Mientras la competencia se centra en contabilidad fiscal y facturación electrónica, StockPilot resuelve el problema real del tendero: "¿qué comprar, cuándo comprar y cuánto?" | Resuelve el dolor más agudo del cliente, no un problema secundario |
| 2 | Inteligencia Artificial Predictiva | Ningún competidor en el segmento de microempresas ofrece un motor de IA que analice velocidad de venta, clasifique productos ABC y genere órdenes de compra sugeridas con aprendizaje continuo | Diferenciación tecnológica difícil de replicar |
| 3 | Costo accesible | Plan desde $39.900 mensuales, similar al competidor más cercano pero con más funcionalidades | Baja barrera de entrada  |
| 4 | Interfaz intuitiva | Diseñada para tenderos de 40-44 años con baja familiaridad tecnológica | Alta tasa de adopción y baja necesidad de capacitación |
| 5 | Bucle de aprendizaje continuo | El sistema mejora sus predicciones con el tiempo | Alta retención: el cliente se vuelve más dependiente del sistema con el tiempo |
| 6 | Enfoque en prevención de vencimiento | Única solución que prioriza la prevención de pérdidas por caducidad | Impacto directo en la rentabilidad del cliente |
| 7 | Simulador de escenarios | Permite al tendero visualizar el impacto de diferentes decisiones de compra antes de realizarlas | Empodera al cliente para tomar decisiones informadas |
| 8 | Feedback y auditoría de IA | Cada recomendación de IA es auditada y se registra la precisión, generando confianza y transparencia | Credibilidad y confianza en el sistema |

### 

### **4.3. Análisis FODA de la Competencia**

**Fortalezas de la competencia:**

* **Treinta:** Marca reconocida, base de usuarios \>40.000, modelo freemium, inversión de capital.  
* **Alegra y Siigo:** Empresas consolidadas, soluciones completas, integración con contabilidad y DIAN.

**Debilidades de la competencia:**

* Complejidad excesiva para el tendero no contable.  
* Precios elevados para el segmento microempresa.  
* Falta de enfoque en predicción de demanda y vencimiento.  
* Curva de aprendizaje alta.

**Oportunidades de StockPilot:**

* **Segmento no atendido:** tenderos que necesitan operación, no contabilidad.  
* Tendencia de digitalización del retail tradicional.  
* Aceptación de herramientas SaaS y pago por suscripción.  
* Políticas gubernamentales de apoyo.

# Módulo III: ¿Cuál es mi solución?

**5\. Propuesta de Solución e Innovación**

### **5.1. Concepto del Negocio**

StockPilot es un **Software as a Service (SaaS) de gestión inteligente de inventarios** que transforma la administración manual y reactiva de las microempresas en una gestión **proactiva, basada en datos y potenciada por inteligencia artificial.**

A diferencia de las soluciones de contabilidad fiscal, StockPilot se enfoca en la **operación diaria del negocio**: qué vender, cuándo reponer, cuánto pedir y cómo evitar pérdidas.

### **5.2. Propuesta de Valor**

"No te quedes sin vender ni compres de más. StockPilot te dice exactamente qué necesita tu tienda usando IA." 

# ***Pilares de la propuesta de valor:***

| Pilar | Descripción	 | Beneficio cuantificable |
| :---: | :---: | :---: |
| Prevención de desabastecimiento | Alertas tempranas con proyección de agotamiento | Reducción de pérdidas de ventas por faltantes (**42%** de clientes abandonan compra) |
| Reducción de pérdidas por vencimiento | Notificaciones de productos próximos a vencer con estimación de unidades invendibles y sugerencias de promoción | Reducción del **28%** de pérdidas en perecederos (BID, 2021\) |
| Optimización de compras | Órdenes de compra sugeridas con cantidades óptimas por producto, priorizando clase A y respetando presupuesto | Reducción del **22%** de compras de emergencia |
| Ahorro de tiempo | Automatización de conteos, clasificaciones y reportes | Reducción de 4 horas semanales en inventario manual |
| Decisiones con datos | Dashboard con KPIs y recomendaciones en lenguaje natural | Mayor certeza en decisiones |
| Aprendizaje continuo | El sistema mejora sus predicciones con cada venta | Mayor precisión con el tiempo |

### **5.3. Componente Innovador / Factor Diferencial**

| Variable | Descripción de la Innovación | Justificación de su carácter innovador |
| ----- | ----- | ----- |
| Concepto del negocio | Modelo SaaS para el canal tradicional que combina gestión operativa con inteligencia artificial predictiva. No existe un competidor en el segmento microempresas que integre un copiloto IA para decisiones de reabastecimiento con bucle de aprendizaje. | La competencia (Treinta, Alegra, Siigo) se enfoca en contabilidad fiscal, no en operación predictiva. StockPilot crea una nueva categoría: "gestión de inventario predictiva". |
| Producto o servicio | **Motor de predicción de demanda** que calcula velocidad de venta ponderada (7, 30, 90 días), identifica tendencias, proyecta agotamiento y genera órdenes de compra sugeridas con ajustes IA. Incorpora **clasificación dinámica ABC** (Pareto) y **guardrails** por clase. | El uso de un LLM (GPT-4o-mini) para ajustar cantidades de compra en lenguaje natural, con guardrails matemáticos, es una aplicación novedosa en el segmento microempresas. La clasificación ABC dinámica y el cálculo de ROP se automatizan en tiempo real. |
| Proceso | **Bucle de retroalimentación adaptativa** (Feedback IA): el sistema compara cantidades sugeridas con ventas reales posteriores, calcula un factor de precisión por producto (limitado entre 0.2 y 3.0) y lo aplica como multiplicador en futuras sugerencias. Este proceso de aprendizaje continuo no existe en soluciones actuales para el segmento. | Crea una barrera de entrada: mientras más tiempo usa el cliente, más precisa es la IA, generando fidelización y costos de cambio. Es un mecanismo de mejora continua basado en datos reales, no en intuición. |
| Tecnología | Stack moderno con **Node.js/Express** (backend), **React 19** (frontend, con manifiesto de PWA configurado), **PostgreSQL** (BD en la nube), **OpenAI GPT-4o-mini** (copiloto IA) con caché MD5, y **Playwright/Vitest** para pruebas automatizadas. | El uso de un LLM de bajo costo y alta capacidad (GPT-4o-mini) democratiza el acceso a IA predictiva. La arquitectura desacoplada permite escalabilidad y portabilidad. El **100%** de cobertura en pruebas de lógica de negocio garantiza confiabilidad. |
| Automatización | Envío automático de resumen semanal por correo electrónico con estadísticas de alertas, alertas críticas y recomendaciones. Cron job con node-cron. | **Proactividad:** el sistema no solo responde a consultas, sino que contacta al cliente con información relevante sin que este lo solicite. |

**5.4. Validación de Mercado (Metodología y Resultados)**

| Etapa | Herramienta | Participantes | Descripción | Resultado |
| :---: | :---: | :---: | :---: | :---: |
| 1\. Descubrimiento | Lean Canvas | Equipo fundador | Identificación de segmentos de clientes, problema, solución, métricas clave y ventaja competitiva | Validación del problema central: pérdidas por vencimiento y desabastecimiento |
| 2\. Empatía | Entrevistas en profundidad  | 15 tenderos   | Tenderos en las localidades de Kennedy, Suba y Engativá (Bogotá) | 100% reportó pérdidas por vencimiento como problema recurrente |
| 3\. Cuantificación | Encuestas estructuradas | 50 tenderos en Bogotá  | Validación de necesidades y disposición a pagar | El 92% manifestó interés en una herramienta que prediga desabastecimiento |
| 4\. Prototipado | Prototipo en Figma  | 10 tenderos  | Validación de usabilidad y experiencia de usuario | NPS del prototipo: 68 (excelente) |
| 5\. PMV  | Desarrollo funcional y pruebas piloto | 5 tiendas en Bogotá  | Pruebas con 5 tiendas en entorno controlado | Validación de funcionalidad y valor percibido |

**Resultados clave de la validación:**

| Hallazgo | Resultado | Implicación para el negocio |
| :---: | :---: | :---: |
| Disposición a pagar | **78%** dispuesto a pagar entre $20.000 y $50.000 mensualespor una solución que prediga desabastecimiento  | Valida el modelo de precios: $39.900/mes es aceptable |
| Interés en IA | **85%** manifestó interés en recomendaciones automáticas de compra | El componente de IA es un diferenciador atractivo |
| Frustración por vencimiento | **92%** reportó pérdidas por vencimiento como problema significativo | El enfoque en alertas de vencimiento es el principal motor de compra |
| Tiempo de inventario manual | Promedio: **4 horas semanales** | El ahorro de tiempo es un beneficio tangible y valorado |
| Motivación principal | "No perder ventas por falta de producto" **(84%)** | El mensaje de marketing debe enfocarse en prevención de pérdidas |
| Segunda motivación | "No botar comida" **(76%)** | El mensaje ambiental y de ahorro económico es igualmente poderoso |

**5.5. Motivaciones de los Clientes para Adquirir el Producto**

Las motivaciones identificadas durante la validación de mercado —entrevistas a profundidad (n=15), encuestas estructuradas (n=50) y pruebas piloto con 5 tiendas en Bogotá— permiten clasificar las razones por las cuales un tendero estaría dispuesto a pagar una suscripción mensual de **$39.900 COP por StockPilot.** **Estas motivaciones no son únicamente racionales o económicas; también incorporan dimensiones operativas, competitivas, emocionales, ambientales y tecnológicas que, en conjunto, explican la disposición a adoptar la solución. La motivación principal es financiera: evitar las pérdidas por vencimiento y desabastecimiento.** **El ahorro estimado de $380.000 mensuales** para una tienda con ventas de $8.000.000 justifica ampliamente la inversión de **$39.900/mes**, con un retorno neto mensual de aproximadamente **$340.100 y un ahorro anual superior a $4.000.000.** La segunda motivación es **operativa:** liberar 4 horas semanales de trabajo manual (16 horas al mes), tiempo que puede destinarse a la atención al cliente o a actividades generadoras de ingresos. La tercera es **competitiva:** no perder clientes por faltantes, ya que el 42% de los compradores abandona la compra cuando no encuentra un producto básico (DANE, 2022), y las cadenas organizadas le arrebatan 2.7% de participación de mercado anual al canal tradicional (MinCIT, 2023). La cuarta es **emocional:** reducir la ansiedad y la incertidumbre de no saber qué productos se agotarán o vencerán; los tenderos expresaron sentirse "a ciegas" respecto a su inventario. La quinta es **ambiental:** evitar el desperdicio de alimentos, una preocupación manifestada por el 76% de los encuestados. Y la sexta es **tecnológica:** acceder a inteligencia artificial predictiva a un precio accesible, interés manifestado por el 85% de los encuestados, quienes además validaron el rango de precio de $20.000 a $50.000 mensuales. La consistencia de estas motivaciones en las tres etapas de validación —entrevistas, encuestas y pruebas piloto— confirma que StockPilot no resuelve un problema imaginario, sino una necesidad real, cuantificable y urgente. El 88% de los usuarios del prototipo afirmó que recomendaría la herramienta a otro tendero, lo que evidencia un alto potencial de adopción orgánica y referidos. En síntesis, la propuesta de valor de StockPilot no se basa en una promesa abstracta, sino en un ahorro verificable: el tendero no "gasta" $39.900 al mes, **invierte** esa suma para dejar de perder $380.000, con una relación costo-beneficio de 1 a 9.5, lo que convierte a StockPilot en una herramienta de rentabilidad y no en un gasto operativo.

**6\. Nivel de Avance del Proyecto**

### **6.1. Aspecto Técnico-Productivo (PMV 100% Funcional)**

| Área | Avance | Estado | Evidencia |
| :---: | :---: | :---: | :---: |
| Backend (API REST) | 100% desarrollado con Node.js/Express | Completado | Repositorio GitHub |
| Frontend | 100% desarrollado con React 19 \+ Vite \+ TailwindCSS | Completado  | Manifiesto de PWA configurado; falta el Service Worker para instalación y modo offline completos |
| Base de datos | PostgreSQL 15 desplegado en Neon Cloud | Completado | Conexión activa y probada |
| Pruebas unitarias | 50/50 pruebas aprobadas; 100% cobertura lógica de negocio | Completado | Reporte de pruebas |
| Pruebas E2E  | Playwright para flujos críticos | Completado | Scripts de pruebas automatizadas |
| Módulos funcionales | 15 módulos implementados (83 requerimientos) | Completado | Casos de uso documentados |
| Integración IA | OpenAI GPT-4o-mini con caché MD5 y guardrails ABC | Completado | Endpoint /api/ia/recommendations funcional |
| Auditoría IA | Log de auditoría de decisiones (ai\_audit.log) | Completado | Archivo generado en el servidor |
| Automatización | node-cron para resúmenes semanales por correo | Completado | Módulo de automatización implementado |
| Reportes | Exportación a Excel (XLSX) y PDF | Completado | Funcionalidad probada |
| Seguridad | bcrypt, sesiones server-side, Helmet, rate limiting | Completado | Verificado en pruebas de seguridad |
| Pruebas de carga (Benchmarking) | Autocannon: 12.9 req/seg, 0% errores | Completado | Pruebas de esfuerzo documentadas |

### **6.2. Aspecto Comercial**

| Área | Avance	 | Detalle |
| :---: | :---: | :---: |
| Validación de mercado | Completada | 15 entrevistas, 50 encuestas, pruebas piloto con 5 tiendas |
| Estrategia de precios | Definida | Plan Base: $39.900/mes por tienda |
| Canales de distribución | Identificados | Redes sociales, WhatsApp Business, prospección en campo, alianzas con gremios |
| Alianzas estratégicas | En negociación | Contactos con gremios de tenderos y proveedores de víveres |

### **6.3. Aspecto Legal**

| Área | Avance	 | Detalle |
| :---: | :---: | :---: |
| Tipo societario | SAS (Sociedad por Acciones Simplificada) | Se eligió SAS por su flexibilidad y adecuación para startups tecnológicas |
| Estado | En fase de estructuración y registro | Documentación en preparación |
| Registro de marca | Pendiente | Prioridad post-lanzamiento |
| Normatividad | Identificada y parcialmente cumplida | Ley 1581, Ley 1273, Ley 527 |

## **7\. Ficha Técnica del Producto**

### **7.1. Producto: StockPilot (Plataforma SaaS)**

| Ítem | Descripción |
| ----- | ----- |
| Producto específico | Software de gestión de inventarios y ventas con inteligencia artificial |
| Nombre comercial | StockPilot |
| Unidad de medida | Suscripción mensual (por tienda) |
| Descripción general | Plataforma web que permite gestionar inventarios, registrar ventas, administrar sesiones de caja y egresos, clasificar productos ABC, recibir alertas predictivas de desabastecimiento y vencimiento, generar órdenes de compra inteligentes con IA, y visualizar KPIs en dashboard interactivo |
| Características técnicas | \- Acceso por navegador web (Chrome, Edge, Firefox) \- Interfaz responsive (adaptable a dispositivos móviles) \- Manifiesto de PWA configurado (falta el Service Worker para instalación y modo offline completos) \- Autenticación con usuario/contraseña y bcrypt \- Roles: Administrador y Colaborador \- Control de Caja Menor \- PostgreSQL en la nube \- Motor IA: GPT-4o-mini con guardrails y caché MD5 \- Exportación a Excel y PDF \- SLA 99.5% |
| Condiciones especiales | Requiere conexión a internet para operación completa. El sistema está diseñado para ser ligero y funcionar incluso con conexiones de baja velocidad (3G) |
| Composición | SaaS (no aplica composición física). El sistema se compone de código fuente, base de datos y API de IA. |

**7.2. Planes y Precios**

| Plan | Precio mensual | Características |
| ----- | ----- | ----- |
| Plan Base | $39.900 | \- Gestión de productos (hasta 1.000) \- Registro de ventas, cuadre de caja y egresos \- Alertas de stock (crítico y advertencia) \- Clasificación ABC (Pareto) \- Dashboard con KPIs \- Soporte por WhatsApp \- 15 días de prueba gratuita |

# 

# Módulo IV: ¿Cómo desarrollo mi solución?

**8\. Estrategia de Generación de Ingresos**

**8.1. Modelo de Ingresos**  
StockPilot generará ingresos a través de un **modelo de suscripción SaaS B2B** con un plan base de **$39.900 COP/mes por tienda.** Los ingresos se obtienen mediante pago mensual anticipado a través de:

1. **Suscripción en línea:** Pago con tarjeta débito/crédito (pasarela de pagos Wompi o PayU).  
2. **Transferencia bancaria**: Para clientes sin tarjeta, pago por transferencia a cuenta bancaria.  
3. **Pago por WhatsApp:** Coordinación manual vía WhatsApp Business.

**Forma de pago:** Contado (pago mensual anticipado).

**Estrategia de mercadeo y ventas:**

* **Canales de comercialización:** Venta directa digital mediante landing page optimizada, prospección directa en campo en localidades con alta densidad comercial en Bogotá (Kennedy, Suba, Engativá, Barrios Unidos) y alianzas estratégicas con asociaciones de comerciantes y distribuidores mayoristas de abarrotes.  
* **Estrategias de atracción:** Demostración interactiva sin barreras ("Explorar Demo"), periodo de prueba guiado (15 días gratis), testimoniales de tenderos pioneros y atención personalizada vía WhatsApp Business.

### **8.2. Proyección de Cantidades y Precios de Venta (Mensual)**

| Mes | Clientes Acumulados | Ingreso Mensual | Ingreso Acumulado |
| :---: | :---: | :---: | :---: |
| 1 | 10 | $399.000 | $399.000 |
| 2 | 15 | $598.500 | $997.500 |
| 3 | 25 | $997.500 | $1.995.000 |
| 4 | 35 | $1.396.500 | $3.391.500 |
| 5 | 45 | $1.795.500 | $5.187.000 |
| 6 | 55 | $2.194.500 | $7.381.500 |
| 7 | 65 | $2.593.500 | $9.975.000 |
| 8 | 80 | $3.192.000 | $13.167.000 |
| 9 | 90 | $3.591.000 | $16.758.000 |
| 10 | 100 | $3.990.000 | $20.748.000 |
| 11 | 110 | $4.389.000 | $25.137.000 |
| 12 | 120 | $4.788.000 | $29.925.000 |

# 

**Proyección Total Año 1: COP 29.925.000**

***Supuestos del modelo:***

* **Crecimiento gradual:** 10 en el mes 1 → 120 en el mes 12\.  
* **Precio fijo:** $39.900/mes.  
* **Tasa de retención mensual:** 95% (churn 5%).  
* Sin IVA incluido en la proyección base.

***Justificación de la proyección:***

* Bogotá cuenta con más de 45.000 tiendas de barrio. Capturar 120 tiendas en el primer año representa menos del 0.3% del mercado potencial, una meta conservadora y alcanzable.  
* El crecimiento es escalonado: fase piloto (meses 1-3), consolidación (meses 4-6), maduración (meses 7-12).

### 

### **8.3. Estrategias de Promoción, Comunicación y Distribución**

#### ***8.3.1. Estrategia de Promoción: "El Tendedero Digital"***

| Actividad | Recursos | Mes | Costo | Responsable |
| :---: | :---: | :---: | :---: | :---: |
| Campaña en redes sociales (Instagram, Facebook) | Contenido gráfico, anuncios | Mes 1-3 | $1.000.000 | Líder Comercial |
| Alianzas con gremios de tenderos | Networking, material | Mes 2-6 | $500.000 | CEO |
| Programa de referidos | Sistema de incentivos | Mes 3 | $500.000 | CEO |
| Participación en ferias (4 eventos) | Stand, material, viáticos | Mes 3,6,9,12 | $1.000.000 | Líder Comercial |

**Costo total promoción:** $3.000.000

***8.3.2. Estrategia de Comunicación: "Historias de Éxito Tenderas"***

| Actividad | Recursos | Mes | Costo | Responsable |
| :---: | :---: | :---: | :---: | :---: |
| Casos de éxito en blog/redes | Contenido | Mes 1-12 | $300.000 | Líder Comercial |
| Testimonios en video (3 al año) | Grabación, edición | Mes 3,6,9 | $600.000 | CEO |
| Boletín mensual por correo | Plataforma email | Mes 2-12 | $200.000 | CEO |

**Costo total comunicación:** $1.100.000

**8.3.3. Estrategia de Distribución: "Digitaliza tu Tienda"**

| Actividad | Recursos | Mes | Costo | Responsable |
| :---: | :---: | :---: | :---: | :---: |
| Landing page de ventas | Desarrollo web | Mes 1 | $1.000.000 | CEO/Desarrollo |
| Canal WhatsApp Business | Automatización | Mes 1 | $100.000 | Líder Comercial |
| Prospección en campo (Kennedy, Suba, Engativá) | Transporte, material | Mes 1-12 | $600.000 | Líder Comercial |

**Costo total distribución:** $1.700.000

**Presupuesto total marketing y ventas (Año 1):** $5.800.000

## 

## **9\. Condiciones Comerciales**

### **9.1. Para Clientes (Dueños de tienda)**

| Variable | Descripción |
| ----- | ----- |
| Volumen y frecuencia de compra | Suscripción mensual por tienda. Un cliente puede tener múltiples tiendas. |
| Características exigidas para la compra | Plataforma intuitiva, costo accesible, funcionamiento en navegador móvil/escritorio. Registro en línea con correo electrónico y teléfono. Pago con tarjeta débito/crédito (a través de pasarela), transferencia bancaria o PSE. Facturación mensual. |
| Sitio de compra | Plataforma web de StockPilot (landing page con proceso de registro y pago), canal de WhatsApp Business (coordinación manual). |
| Forma de pago | Contado (pago mensual anticipado) |
| Precio | $39.900/mes \+ IVA (si aplica) |
| Requisitos post-venta | Facturación mensual, soporte por WhatsApp, actualizaciones automáticas |
| Garantías | Satisfacción garantizada (reembolso en primer mes si no está satisfecho) |
| Validación de mercado | Entrevistas, encuestas, pruebas piloto con tenderos reales |
| Margen de comercialización | N/A (venta directa sin intermediarios en la etapa inicial). Se evaluarán canales de afiliados en el futuro. |

### **9.2. Para Consumidores (Tenderos/Empleados)**

| Variable | Descripción |
| ----- | ----- |
| Lugar de compra | No aplica (no pagan directamente; su acceso es financiado por el cliente). |
| Frecuencia de compra | Acceso diario al sistema (ventas, consultas, alertas). |
| Precio | Incluido en la suscripción del cliente |
| Características exigidas | Carga rápida, interfaz semaforizada, mínimo consumo de datos |
| Perfil del consumidor | Tenderos, cajeros y empleados de tienda que utilizan el sistema para registrar ventas, consultar stock, recibir alertas y generar reportes. |

**10\. Normatividad Aplicable**

| Tipo de Normatividad | Identificación de la Norma, Procesos, Costos y Tiempos |
| ----- | ----- |
| Empresarial (Constitución) | Ley 1258 de 2008 (SAS) y Ley 905 de 2004\. Registro en Cámara de Comercio de Bogotá. Costo: \~$350.000 COP. Tiempo: 3-5 días hábiles. |
| Tributaria y Facturación | Estatuto Tributario, Decreto 410 de 1971\. Inscripción en RUT. Tiempo: 1 día. |
| Protección de Datos Personales | Ley 1581 de 2012 y Decreto 1377 de 2013\. Política de Tratamiento de Información. Costo: Asesoría legal inicial \~$500.000 COP. |
| Comercio Electrónico y Seguridad | Ley 527 de 1999\. Certificados SSL/TLS, bcrypt, pasarelas PCI-DSS. |
| Registro de Marca | Decisión 486 de la Comunidad Andina. Registro ante SIC. Costo: \~$1.150.000 COP. Tiempo: 6-8 meses. |
| Laboral | Código Sustantivo del Trabajo. Contratación formal con seguridad social integral. |

**11\. Condiciones Técnicas para la Operación**

**11.1. Arquitectura del Sistema**

**Arquitectura:** Desacoplada cliente-servidor basada en micro-servicios modulares con patrón MVC y Factory Method, permitiendo escalar el frontend y la API de manera independiente.

**Stack Tecnológico:**

* **Backend:** Node.js con Express, middleware de seguridad (Helmet, CORS, Rate-Limiting) y autenticación JWT con roles jerárquicos (RBAC).  
* **Frontend:** Single Page Application (SPA) con React 19, Vite y TailwindCSS, con manifiesto de PWA configurado (pendiente el Service Worker para instalación y modo offline completos), optimizada para carga rápida y consumo eficiente en dispositivos móviles.  
* **Base de Datos:** PostgreSQL 15 en la nube (Neon Cloud), con modelos relacionales normalizados y aislamiento multi-tenant por tienda (tienda\_id).  
* **Motor de IA:** Integración con OpenAL API (GPT-4o-mini), complementado con categorización analítica ABC y sistema de caché determinístico para optimización de consumo de tokens.

### **11.2. SLA y Tiempos de Respuesta**

**Latencia media API:** \<200ms en operaciones de lectura, \<350ms en escritura.

**Disponibilidad objetivo (SLA):** 99.5%.

**Capacidad instalada:** 13-25 transacciones por segundo (validado con pruebas de carga Autocannon).

**12\. Requerimientos en Infraestructura, Equipos y Activos**

**12.1. ¿Es necesario un lugar físico de operación?**  
**Respuesta:** NO \- Operación 100% Remota (Home Office).

**Justificación:** Al ser una plataforma nativa digital (SaaS en la nube), las operaciones de programación, despliegue y soporte técnico se gestionan de forma remota por el equipo fundador desde sus propios domicilios. No se requiere arrendar ni adecuar un local comercial u oficina física.

**12.2. Requerimientos de Inversión**

| Tipo de Activo | Descripción | Cantidad | Valor Unitario | Valor Total | Observación |
| :---: | :---: | :---: | :---: | :---: | :---: |
| Equipos de cómputo | Laptops para desarrollo | 3 | $0 | $0 | Aporte propio (equipos preexistentes) |
| Infraestructura Cloud | Servidores, BD, API IA | 12 meses | $220.000/mes | $2.640.000 | Render \+ Neon \+ OpenAI (estimado) |
| Comunicaciones | Internet fibra óptica | 12 meses  | $0 | $0 | Uso doméstico asumido por fundadores |
| Muebles y enseres | Puestos de trabajo | 3 | $0 | $0 | Preexistentes en domicilios |
| Gastos preoperativos | Trámites legales, dominio, SSL | 1 | $500.000 | $500.000 | Compra de dominio y registros |
| Marketing inicial | Landing page, material | 1 | $1.000.000 | $1.000.000 | Desarrollo de landing page |

**Total Inversión Inicial:** $4.140.000

**Justificación:** La mayor parte de la infraestructura física ya está cubierta como aporte del equipo emprendedor. Los gastos se concentran en infraestructura Cloud y costos preoperativos.

**12.3. Condiciones Técnicas de Infraestructura**  
**Área requerida:** No aplica un área comercial. Se utilizan espacios de trabajo (Home Office).

**Uso del suelo (POT):** No aplica al no requerir establecimiento físico abierto al público.

**12.4. ¿Importación de activos?**  
**Respuesta:** NO.

**Justificación:** Toda la infraestructura física ya está en el país. Los servicios de software se pagan bajo suscripción digital mensual.

**13\. Proceso de Producción (Prestación del Servicio)**

**Bien / Servicio:** Servicio continuo de software en la nube (StockPilot SaaS)  
**Unidades a producir:** Disponibilidad ininterrumpida 24/7 y atención a tiendas suscritas.

| Actividad del proceso | Tiempo estimado | Cargos que participan | N° personas | Equipos y herramientas |
| :---: | :---: | :---: | :---: | :---: |
| 1\. Prospección y alta de cliente (Onboarding) | 25 min | Líder Comercial | 1 | CRM, WhatsApp Business |
| 2\. Configuración inicial de tienda y usuarios | 10 min | Desarrollador/Soporte | 1 | API StockPilot |
| 3\. Carga de catálogo y saldos de inventario | 45 min | Soporte \+ Tendero | 1 | Módulo de Productos |
| 4\. Capacitación básica y entrega de accesos | 20 min | Líder Comercial | 1 | Guía interactiva |
| 5\. Operación automática y alertas inteligentes | Continuo (24/7) | Sistema automatizado | \- | Servidores cloud, motor IA |
| 6\. Mantenimiento, pruebas y copias de seguridad | 4 horas/semana | CEO/Desarrollador | 2 | GitHub, suite de pruebas |

**Total tiempo de activación por cliente nuevo:** \~1.7 Horas

**14\. Capacidad Productiva de la Empresa**

**14.1. Capacidad Instalada**  
La infraestructura base en la nube (Render \+ Neon PostgreSQL) cuenta con una capacidad instalada para despachar entre 13 y 25 transacciones por segundo, equivalente a más de 1.000.000 de transacciones mensuales en un único nodo.

**14.2. Validación Empírica (Pruebas de Esfuerzo)**

| Métrica Técnica | Prueba 1: Carga Moderada | Prueba 2: Carga Pico |
| :---: | :---: | :---: |
| Duración del test | 10 segundos | 10 segundos |
| Peticiones completadas | 52 | 139 |
| Throughput (RPS) | 4.7 req/seg | 12.9 req/seg |
| Latencia promedio | 1,044 ms | 747 ms |
| Percentil 97.5% | 4.4 segundos | 2.02 segundos |
| Tasa de errores | 0% | 0% |

**14.3. Capacidad Utilizada Proyectada (Año 1\)**  
**Meta comercial:** 120 tiendas suscritas.

**Demanda operativa:** 40-60 transacciones diarias por tienda.

**Demanda pico agregada:** 2-4 solicitudes por segundo.

**Porcentaje de uso:** 15%-30% de la capacidad instalada.

**Margen de holgura:** \>70% para absorber picos.

## **15\. Equipo de Trabajo**

## **15.1. Perfil del Emprendedor, Rol y Dedicación**

| Nombre | Perfil | Rol | Dedicación |
| :---: | :---: | :---: | :---: |
| Luis Alberto Diuche Peña | Estudiante de 10° semestre de Ingeniería de Sistemas. Conocimientos y práctica académica en desarrollo full-stack (Node.js, React, PostgreSQL), integración de APIs de IA y arquitectura de software con patrones MVC y Factory Method, aplicados en ejercicios y proyectos de clase. Sin experiencia laboral formal. | CEO y Líder Técnico (CTO) — rol dentro del proyecto académico. | Tiempo completo al proyecto integrador. |
| Elizabeth Pérez González | Estudiante de 10° semestre de Ingeniería de Sistemas. Conocimientos y práctica académica en desarrollo frontend, UX/UI y pruebas automatizadas (Vitest, Playwright), aplicados en trabajos y proyectos de aula. Sin experiencia laboral formal.  | Líder de Desarrollo Frontend y QA.  | Tiempo completo al proyecto integrador. |
| Miguel Angel Espinosa Esparza | Estudiante de 10° semestre de Ingeniería de Sistemas. Conocimientos y práctica académica en backend, bases de datos y arquitectura en la nube, adquiridos en asignaturas, ejercicios y proyectos de clase. Sin experiencia laboral formal. | Líder de Backend e Integración IA.  | Tiempo completo al proyecto integrador.  |

**15.2. Cargos Requeridos para la Operación (Año 1\)**

| Nombre del Cargo | Funciones principales | Perfil requerido | Tipo de contratación | Dedicación  | Remuneración mensual | Mes de vinculación |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Líder Comercial y Adopción | Prospección de tiendas, demostraciones en sitio, onboarding y fidelización de tenderos | Profesional/tecnólogo en Mercadeo o Administración, 1 año en ventas B2B o de campo | Nómina \+ comisiones | Tiempo completo | $2.000.000 \+ comisiones | Mes 1 |
| Desarrollador y Soporte Técnico | Atención de incidencias, desarrollo de mejoras, pruebas unitarias y E2E | Tecnólogo o estudiante de últimos semestres de Ing. de Sistemas, 1 año de experiencia | Nómina | Tiempo completo | $1.800.000 | Mes 2 |

**Nota:** Los tres fundadores (CEO, Frontend, Backend) no reciben salario en el primer año, operando como socios con participación accionaria. Esta es una práctica común en startups tecnológicas en etapa temprana y permite que el capital de trabajo se destine a cubrir los gastos operativos.

**Total nómina Año 1:**

* **Líder Comercial:** $2.000.000 × 12 \= $24.000.000  
* **Desarrollador/Soporte:** $1.800.000 × 11 \= $19.800.000  
* ***Total: $43.800.000***

# Módulo V: ¿Cuál es el futuro de mi negocio?

**16\. Período de Arranque e Improductivo**

**16.1. Período de Arranque**

**Tiempo estimado:** 3 meses

| Actividad |     Mes	 | Descripción |
| :---: | :---: | :---: |
| Constitución legal (SAS) | 1 | Elaboración de la minuta, inscripción en Cámara de Comercio de Bogotá |
| Apertura de cuenta bancaria empresarial | 1 | Apertura de cuenta corriente o de ahorros a nombre de StockPilot SAS |
| Registro en Cámara de Comercio | 2 | Obtención del certificado de existencia y representación legal |
| Inscripción en DIAN (RUT) | 2 | Registro Único Tributario |
| Alquiler de espacio de trabajo (coworking) | 2 | Contrato de arrendamiento en coworking en Bogotá |
| Contratación de personal | 2-3 | Vinculación del Líder Comercial y Desarrollador/Soporte |
| Lanzamiento comercial | 3 | Inicio de la campaña de lanzamiento y prospección en campo |

**16.2. Período Improductivo**

**Tiempo estimado:** 2 meses

Este período corresponde al tiempo entre la firma del acta de inicio y la producción del primer lote de servicios (clientes activos generando ingresos):

| Actividad | Mes	 | Descripción |
| :---: | :---: | :---: |
| Período de montaje y constitución | 1-2 | Actividades legales y administrativas |
| Desarrollo de funcionalidades post-PMV | 1-2 | Ajustes finales al producto basados en pruebas piloto |
| Campaña de lanzamiento y adquisición de primeros clientes | 2 | Inicio de la estrategia de marketing y ventas |
| Primeros clientes activos con pago | 3 | Registro de los primeros clientes pagos en el sistema |

**Justificación:** El período improductivo de 2 meses es típico en startups tecnológicas. Durante este tiempo se realizan inversiones sin generación de ingresos, lo que requiere capital de trabajo suficiente para cubrir los costos fijos (salarios, infraestructura, marketing).

**17\. Proyecciones Financieras**

**17.1. Proyección de Ingresos (Año 1\)**

| Mes | Clientes Acumulados | Ingreso Mensual | Ingreso Acumulado |
| :---: | :---: | :---: | :---: |
| 1 | 10 | $399.000 | $399.000 |
| 2 | 15 | $598.500 | $997.500 |
| 3 | 25 | $997.500 | $1.995.000 |
| 4 | 35 | $1.396.500 | $3.391.500 |
| 5 | 45 | $1.795.500 | $5.187.000 |
| 6 | 55 | $2.194.500 | $7.381.500 |
| 7 | 65 | $2.593.500 | $9.975.000 |
| 8 | 80 | $3.192.000 | $13.167.000 |
| 9 | 90 | $3.591.000 | $16.758.000 |
| 10 | 100 | $3.990.000 | $20.748.000 |
| 11 | 110 | $4.389.000 | $25.137.000 |
| 12 | 120 | $4.788.000 | $29.925.000 |

# **Total Ingresos Año 1:** COP 29.925.000

### **17.2. Proyección de Costos Variables (Año 1\)**

| Concepto | Mes 1 | Mes 6 | Mes 12 | Total Año |
| :---: | :---: | :---: | :---: | :---: |
| Infraestructura cloud (Render \+ Neon) | $220.000 | $220.000 | $220.000 | $2.640.000 |
| API de OpenAI (GPT-4o-mini) | $30.000 | $80.000 | $150.000 | $1.140.000 |
| Dominio y SSL | $10.000 | $10.000 | $10.000 | $120.000 |
| **Total costos variables** | **$260.000** | **$310.000** | **$380.000** | **$3.900.000** |

**Justificación:** Los costos de infraestructura son fijos mensuales (servidor) hasta que se requiera escalar. El costo de OpenAI crece con el número de clientes (más productos, más llamadas a la API). El dominio es un costo fijo anual.

**17.3. Proyección de Gastos Fijos (Año 1\)**

| Concepto | Mes 1 | Mes 3 | Mes 6 | Mes 12 | Total Año |
| :---: | :---: | :---: | :---: | :---: | :---: |
| Nómina (Comercial mes 1-12 \+ Desarrollador mes 2-12) | $2.000.000 | $3.800.000 | $3.800.000 | $3.800.000 | **$43.800.000** |
| Coworking (arriendo) | $500.000 | $500.000 | $500.000 | $500.000 | **$6.000.000** |
| Marketing y ventas | $500.000 | $1.000.000 | $800.000 | $600.000 | **$8.950.000** |
| Gastos administrativos y legales | $200.000 | $200.000  | $200.000 | $200.000 | **$2.400.000** |
| Software y herramientas | $200.000 | $100.000 | $100.000 | $100.000 | **$1.300.000** |
| **Total gastos fijos** | **$3.400.000** | **$5.600.000** | **$5.400.000** | **$5.200.000** | **$62.450.000** |

**Detalle mensual completo (para respaldar el Total Año)**

| Mes | Nómina | Coworking | Marketing | Admin. y legales | Software | Total Mes |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | $2.000.000 | $500.000 | $500.000 | $200.000 | $200.000 | $3.400.000 |
| 2 | $3.800.000 | $500.000 | $750.000 | $200.000  | $100.000 | $5.350.000 |
| 3 | $3.800.000 | $500.000 | $1.000.000 | $200.000 | $100.000 | $5.600.000 |
| 4 | $3.800.000 | $500.000 | $933.000 | $200.000 | $100.000 | $5.533.000 |
| 5 | $3.800.000 | $500.000 | $867.000 | $200.000 | $100.000 | $5.467.000 |
| 6 | $3.800.000 | $500.000 | $800.000 | $200.000 | $100.000 | $5.400.000 |
| 7 | $3.800.000 | $500.000 | $767.000 | $200.000 | $100.000 | $5.367.000 |
| 8 | $3.800.000 | $500.000 | $733.000 | $200.000 | $100.000 | $5.333.000 |
| 9 | $3.800.000 | $500.000 | $700.000 | $200.000 | $100.000 | $5.300.000 |
| 10 | $3.800.000 | $500.000 | $667.000 | $200.000 | $100.000 | $5.267.000 |
| 11 | $3.800.000 | $500.000 | $633.000 | $200.000 | $100.000 | $5.233.000 |
| 12 | $3.800.000 | $500.000 | $600.000 | $200.000 | $100.000 | $5.200.000 |
| **Total** | **$43.800.000** | **$6.000.000** | **$8.950.000** | **$2.400.000** | **$1.300.000** | **$62.450.000** |

## **Verificación matemática**

* **Nómina:** $2.000.000 (mes 1\) \+ 11 × $3.800.000 \= $2.000.000 \+ $41.800.000 \= **$43.800.000**  
* **Coworking:** 12 × $500.000 \= **$6.000.000**  
* **Marketing:** suma mensual interpolada \= **$8.950.000**  
* **Administrativos y legales:** 12 × $200.000 \= **$2.400.000**  
* **Software:** $200.000 \+ 11 × $100.000 \= **$1.300.000**  
* **Total Año 1:** $43.800.000 \+ $6.000.000 \+ $8.950.000 \+ $2.400.000 \+ $1.300.000 \= **$62.450.000**

**17.4. Resumen de Flujo de Caja (Año 1\)**

| Concepto | Total Año 1 (COP) |
| ----- | ----- |
| Ingresos | $29.925.000 |
| Costos variables | $3.900.000 |
| Gastos fijos | $52.000.000 |
| **Déficit/Pérdida** | **\-$25.975.000** |

**Análisis:** El primer año operará con pérdidas de $25.975.000, lo cual es normal en startups tecnológicas. El punto de equilibrio se alcanza cuando los ingresos mensuales cubren los gastos mensuales (\~$4.600.000), lo que ocurre aproximadamente en el mes 12 con 120 clientes.  
**17.5. Inversión Inicial y Capital de Trabajo**

| Concepto | Tipo | COP | Justificación / Base de cálculo |
| :---: | :---: | :---: | :---: |
| Gastos preoperativos (legal, dominio) | Inversión inicial | $500.000 | Constitución SAS, Cámara de Comercio, DIAN, dominio y correo corporativo. |
| Marketing inicial (landing page) | Inversión inicial | $1.000.000  | Diseño y desarrollo de landing page, branding básico y material de presentación. |
| **Subtotal inversión inicial** | \- | **$1.500.000** | $500.000 \+ $1.000.000 |
| Capital de trabajo (3 meses) | Capital de trabajo | $14.350.000 | Suma de gastos fijos de meses 1 a 3: $3.400.000 \+ $5.350.000 \+ $5.600.000 |
| **Total Inversión Requerida** | \- | **$15.850.000** | $1.500.000 \+ $14.350.000 |

## **17.6. Detalle del capital de trabajo (3 meses)**

| Mes | Gastos fijos totales | Acumulado |
| :---: | :---: | :---: |
| Mes 1 | $3.400.000 | $3.400.000 |
| Mes 2 | $5.350.000 | $8.750.000 |
| Mes 3 | $5.600.000 | $14.350.000 |
| **Total** | **$14.350.000** | **$14.350.000** |

**Gasto fijo promedio mensual primeros 3 meses:** 14.350.000/3=4.783.333

**17.7. Resumen de Fuentes de Financiación**

**Opción A:** Mantener el total requerido en $42.780.000 y mostrar la brecha de financiación

| Fuente | Tipo | Monto (COP) | % | Justificación |
| :---: | :---: | :---: | :---: | :---: |
| Recursos propios (fundadores) | Aporte de capital | $7.000.000 | 16,36% | Aportes de los 3 fundadores en partes iguales. Incluye efectivo y/o aportes en especie. |
| Fondo Emprender (convocatoria) | Financiación no reembolsable | $25.000.000 | 58,44%  | Capital semilla del Estado para emprendimientos innovadores. Sujeto a aprobación. |
| Otras fuentes (familiares, inversionista ángel) | Capital privado | $10.000.000 | 23,38% | Inversión de familiares y/o inversionistas ángel interesados en el sector retail tech. |
| **Subtotal fuentes identificadas** | **\-** | **$42.000.000** | **98,18%** | **\-** |
| **Financiación adicional requerida** | **Por definir** | **$780.000** | **1,82%** | Brecha para igualar el total de financiación requerida. |
| **Total** | **\-** | **$42.780.000** | **100,00%** | **\-** |

**Verificación matemática:**

* $7.000.000 \+ $25.000.000 \+ $10.000.000 \= $42.000.000  
* $42.000.000 \+ $780.000 \= $42.780.000  
  **Porcentajes:**  
* $7.000.000 / $42.780.000 \= 16,36%  
* $25.000.000 / $42.780.000 \= 58,44%  
* $10.000.000 / $42.780.000 \= 23,38%  
* $780.000 / $42.780.000 \= 1,82%  
* Suma \= 100,00%

**Opción B:** Ajustar las fuentes para cubrir exactamente $42.780.000

| Fuente | Tipo | Monto (COP) | % | Justificación |
| :---: | :---: | :---: | :---: | :---: |
| Recursos propios (fundadores) | Aporte de capital | $7.000.000 | 16,36% | Aportes de los 3 fundadores en partes iguales. |
| Fondo Emprender (convocatoria) | Financiación no reembolsable | $25.780.000 | 60,26%  | Se incrementa la solicitud para cubrir la brecha. |
| Otras fuentes (familiares, inversionista ángel) | Capital privado | $10.000.000 | 23,38% | Inversión de familiares y/o inversionistas ángel. |
| **Total** | **\-** | **$42.780.000** | **100,00%** | **\-** |

**Verificación matemática:**

* $7.000.000 \+ $25.780.000 \+ $10.000.000 \= $42.780.000  
  **Porcentajes:**  
* $7.000.000 / $42.780.000 \= 16,36%  
* $25.780.000 / $42.780.000 \= 60,26%  
* $10.000.000 / $42.780.000 \= 23,38%  
  **Suma** \= 100,00%

**17.8. Detalle de la financiación requerida**

| Concepto | Monto (COP)	 | Observación |
| :---: | :---: | :---: |
| Inversión Inicial | $13.500.000 | Debe desglosarse en gastos preoperativos, marketing inicial, equipos, infraestructura, etc. |
| Capital de Trabajo (3 meses) | $29.280.000 | Cubre los gastos fijos de los primeros 3 meses sin depender de ingresos. |
| **Total Financiación Requerida** | **$42.780.000** | No debe redondearse a $42.000.000; la diferencia es $780.000. |

**Cálculo del capital de trabajo mensual promedio:** 29.280.000/3=9.760.000

Esto implica que los gastos fijos mensuales promedio de los primeros 3 meses deben ser **$9.760.000.**

**Justificación del monto:** La inversión requerida es relativamente baja para una startup tecnológica, gracias a que el PMV ya está desarrollado (ahorro significativo en costos de desarrollo). El capital de trabajo cubre los gastos operativos de los primeros meses sin depender de ingresos. El modelo de negocio SaaS es liviano en capital y escalable.

# Módulo VI: ¿Qué riesgos enfrento?

**18\. Análisis de Riesgos**

### **18.1. Identificación de Actores Críticos**

| Actor | Rol en la ejecución | Nivel de dependencia | Descripción de su influencia |
| :---: | :---: | :---: | :---: |
| **Fundadores (Equipo técnico)** | Desarrollo y operación del sistema | Crítica (5/5) | Son los responsables de la implementación técnica y la continuidad del proyecto |
| **Cliente (dueño de tienda)** | Paga la suscripción y usa el sistema | Crítica (5/5) | La adopción de los clientes determina el éxito comercial |
| **Proveedor de nube (Render/Neon)** | Hosting de la plataforma | Alta (4/5) | La disponibilidad del sistema depende de estos proveedores |
| **OpenAI** | API de IA para recomendaciones | Media (3/5) | Proporciona el motor de IA; esencial para la propuesta de valor |
| **Gremios de tenderos** | Canales de distribución y validación | Media (3/5) | Pueden acelerar o frenar la adopción en el mercado |
| **Aliados comerciales** | Recomendación y referidos | Baja (2/5) | Ayudan en la difusión pero no son críticos |

**18.2. Matriz de Riesgos y Planes de Mitigación**

| Variable | Riesgo | Probabilidad | Impacto | Plan de Mitigación |
| :---: | :---: | :---: | :---: | :---: |
| Técnico | Fallo crítico del sistema | Media (3/5)  | Alto (5/5) | Backups diarios, monitoreo, pruebas automatizadas, protocolo de respuesta \<4 horas |
| Técnico | API OpenAI no disponible | Media (3/5) | Alto (4/5) | Caché MD5, fallback determinístico (sin IA), evaluar alternativas |
| Comercial | Baja adopción (\<120 clientes) | Media (3/5) | Alto (5/5) | Estrategia freemium, alianzas con gremios, marketing digital enfocado |
| Comercial | Competidor lanza funcionalidad similar de IA | Media (3/5) | Medio (3/5) | Ventaja del primer entrante en el enfoque de IA para este segmento. Bucle de aprendizaje como barrera de entrada (los datos históricos generan precisión).  Mejora continua del producto basada en feedback de clientes. Registro de marca y propiedad intelectual |
| Financiero | Flujo de caja insuficiente | Media (3/5) | Alto (5/5) | Capital de trabajo 3 meses, fondo de reserva, búsqueda de financiación adicional |
| Talento humano | Rotación de personal clave | Baja (2/5) | Alto (4/5) | Documentación del código, contratos estables, participación accionaria |
| Normativo | Cambios en regulación de protección de datos (Ley 1581\) | Baja (2/5) | Medio (3/5) | Asesoría legal continúa (contar con abogado externo). Cumplimiento proactivo de la normatividad de protección de datos. Política de privacidad y aviso de tratamiento de datos disponibles en la plataforma |
| Tecnológico | Obsolescencia tecnológica (framework, lenguaje) | Baja (2/5) | Medio (3/5)  | Stack moderno y mantenido (Node.js 20+, React 19, PostgreSQL 15). Actualizaciones periódicas de dependencias. Monitoreo de tendencias tecnológicas en el sector. Código modular para facilitar migraciones |
| Seguridad | Brecha de seguridad, hackeo | Baja (2/5) | Alto (5/5) | bcrypt, sesiones server-side, rate limiting, Helmet, sanitización de inputs |

**18.3. Plan de Contingencia para Riesgos Críticos**

| Riesgo Crítico | Plan de Contingencia Detallado |
| ----- | ----- |
| **Fallo técnico crítico (caída del sistema)** | • **Protocolo de respuesta a incidentes: 1\)** Identificación del problema, 2\) Comunicación inmediata a clientes por correo y WhatsApp, 3\) Ejecución de recuperación desde backup (**tiempo estimado:** \<1 hora), 4\) Análisis de causa raíz y corrección definitiva. • Los clientes son informados del incidente y del tiempo estimado de resolución. |
| **Churn de clientes \>10% mensual** | • Investigación de causas mediante encuestas de salida y entrevistas. • Implementación de mejoras de producto basadas en feedback. • Ofrecimiento de descuentos o meses gratis para retención. • Revisión de la estrategia de precios y propuesta de valor. |
| **API de OpenAI no disponible** | • Activación inmediata del modo "sin IA" con cálculos matemáticos básicos (velocidad de venta, ROP, alertas sin ajuste IA). • Comunicación a clientes sobre el modo de operación reducido. • Evaluación de proveedores alternativos (Anthropic, Google Gemini, etc.). |
| **Flujo de caja negativo (sin liquidez)** | • Reducción de gastos no esenciales (marketing, herramientas). • Aplazamiento de contrataciones previstas. • Búsqueda de financiación de emergencia (inversionistas ángel, créditos). • Ajuste de estrategia comercial para acelerar ingresos (descuentos, campañas agresivas). |

# Módulo VII: Resumen Ejecutivo

## **Nombre del Emprendedor**

StockPilot SAS (en proceso de constitución)

Representantes legales: Luis Alberto Diuche Peña, Elizabeth Pérez González y Miguel Angel Espinosa Esparza.

**Perfil del Emprendedor**  
**Luis Alberto Diuche Peña** es estudiante de décimo semestre de Ingeniería de Sistemas en la Universidad Central. Cuenta con conocimientos y práctica académica en desarrollo full-stack (Node.js, React, PostgreSQL), integración de APIs de inteligencia artificial y arquitectura de software con patrones MVC y Factory Method, aplicados en ejercicios y proyectos de clase. **Sin experiencia laboral formal**.

El equipo fundador se complementa con **Elizabeth Pérez González** (desarrollo frontend, UX/UI, pruebas automatizadas con Vitest y Playwright) y **Miguel Angel Espinosa Esparza** (backend, bases de datos y arquitectura en la nube), ambos estudiantes de décimo semestre de Ingeniería de Sistemas, con conocimientos y práctica académica en sus respectivas áreas, **sin experiencia laboral formal.**

**Concepto del Negocio**  
StockPilot es una plataforma SaaS de gestión inteligente de inventarios para microempresas del sector retail colombiano, que utiliza inteligencia artificial (OpenAI GPT-4o-mini) para predecir desabastecimiento, generar alertas tempranas de vencimiento, sugerir órdenes de compra óptimas y aprender de sus propias predicciones mediante un bucle de retroalimentación continua.

**Metas (Primer Año)**

| Indicador | Meta (Año 1\) | Justificación |
| :---: | :---: | :---: |
| Empleos directos | 2 | Líder Comercial (mes 1\) \+ Desarrollador/Soporte (mes 2). Fundadores (3) sin salario. |
| Ventas (ingresos acumulados) | COP 29.925.000 | 120 clientes al mes 12 a $39.900/mes, con crecimiento gradual. |
| Clientes activos (fin de año) | 120 | Crecimiento gradual: 10 en mes 1 → 120 en mes 12 |
| Mercadeo (eventos) | 4 eventos | Ferias de emprendimiento y retail en Bogotá y otras ciudades. |
| Contrapartida SENA | $2.000.000 | Aportes de fundadores en especie (horas de trabajo y equipos preexistentes). |
| Empleos indirectos | 1 | Asesoría legal y contable externa |

**Inversión Total Requerida**

| Concepto | Monto (COP) |
| :---: | :---: |
| Gastos preoperativos (legal, dominio) | $500.000 |
| Marketing inicial (landing page) | $1.000.000 |
| **Subtotal inversión inicial** | **$1.500.000** |
| Capital de trabajo (3 meses) | $14.350.000 |
| **Total Inversión Requerida** | **$15.850.000** |

**Detalle del capital de trabajo (3 meses):** 

| Mes | Gastos fijos | Acumulado |
| :---: | :---: | :---: |
| Mes 1 | $3.400.000 | $3.400.000 |
| Mes 2 | $5.350.000 | $8.750.000 |
| Mes 3 | $5.600.000 | $14.350.000 |
| **Total** | **$14.350.000** | **$14.350.000** |

**Gasto fijo promedio mensual primeros 3 meses:** $14.350.000 / 3 \= **$4.783.333**. 

**Fuentes de financiación:**

| Fuente | Monto (COP) | % | Justificación |
| :---: | :---: | :---: | :---: |
| Recursos propios (fundadores) | $4.000.000 | 25,24% | Aportes de los 3 fundadores en partes iguales, en efectivo y/o en especie (equipos, horas de trabajo). |
| Fondo Emprender (convocatoria) | $6.000.000 | 37,85% | Financiación no reembolsable para emprendimientos innovadores. |
| Otras fuentes (familiares, inversionista ángel) | $5.850.000 | 36,91% | Capital privado de familiares y/o inversionistas ángel interesados en retail tech. |
| **Total** | **$15.850.000** | 100,00% | \- |

## **Indicadores Financieros Clave (Proyectados)**

| Indicador | Valor | Justificación / Cálculo |
| :---: | :---: | :---: |
| Ingresos Año 1 | $29.925.000 | 	Suma de ingresos mensuales (17.1). |
| Costos variables Año 1 | $3.900.000 | Cloud \+ OpenAI \+ dominio (17.2). |
| Gastos fijos Año 1 | $62.450.000 | Nómina \+ coworking \+ marketing \+ admin \+ software (17.3). |
| Costo total Año 1 | $66.350.000 | $3.900.000 \+ $62.450.000. |
| Déficit operativo Año 1 | \-$36.425.000 | $29.925.000 − $66.350.000. |
| Margen bruto | 87,0% | ($29.925.000 − $3.900.000) / $29.925.000. |
| Punto de equilibrio mensual | \~$5.580.000 | Gastos fijos mes 12 ($5.200.000) \+ costos variables mes 12 ($380.000). |
| Clientes para equilibrio | \~141 clientes | $5.580.000 / $39.900 ≈ 139,85, ajustado por costo variable por cliente ($1.250/mes) → 141\. |
| Mes de equilibrio | Mes 15-16 (no Año 1\) | Con 120 clientes en el mes 12, aún no se cubre el costo total mensual. |
| Tasa de retención anual | 90% | Estimación conservadora SaaS B2B. |
| CAC | $48.300 | $5.800.000 marketing / 120 clientes. |
| LTV | $430.920 | ($39.900 × 12\) × 90%. |
| LTV / CAC | 8,9x | $430.920 / $48.300. Excelente (\>3x es bueno). |
| Payback period | \~15-16 meses | Tiempo real para alcanzar el punto de equilibrio, no 12\. |
| Financiación total requerida Año 1 | $37.925.000 | Inversión inicial ($1.500.000) \+ déficit operativo anual ($36.425.000). |
| Brecha adicional (si solo se cubre 17.5) | $22.075.000 | 	Financiación adicional requerida para meses 4-12. |

**Ventajas Competitivas y Factores Clave de Éxito**

* **Diferenciación clara:** StockPilot se enfoca en logística operativa con IA predictiva, no en contabilidad fiscal.  
* **PMV completado:** El sistema ya está desarrollado y probado, con 83 requerimientos implementados.  
* **Barrera de entrada:** El bucle de aprendizaje continuo hace que el sistema mejore con el tiempo.  
* **Costo accesible:** $39.900/mes, comparable a la competencia pero con más funcionalidades.  
* **Equipo técnico sólido:** Fundadores con conocimientos y práctica académica en las tecnologías utilizadas.  
* **Mercado validado:** 15 entrevistas, 50 encuestas y pruebas piloto con 5 tiendas confirman la necesidad.

**Riesgos y Supuestos Críticos**

* **Riesgo de adopción:** La baja familiaridad tecnológica del tendero exige una interfaz muy intuitiva y soporte constante.  
* **Riesgo de churn:** La tasa de retención del 90% anual es un supuesto; si baja al 80%, el LTV cae a $383.040 y el LTV/CAC a 7,9x.  
* **Riesgo de financiación:** El déficit operativo anual ($36.425.000) requiere cubrirse con capital adicional o acelerar el crecimiento de clientes.  
* **Supuesto de precio:** Se asume un precio fijo de $39.900/mes sin IVA. Si se incluye IVA (19%), el precio efectivo subiría a $47.481 y afectaría la disposición a pagar.  
* **Supuesto de no salario a fundadores:** Crítico para la viabilidad del Año 1\. Si los fundadores requieren salario, el déficit aumenta significativamente.

# 

# Bibliografía

# **LIBROS Y CAPÍTULOS DE LIBRO**

* Chase, R. B., Jacobs, F. R., & Aquilano, N. J. (2009). Administración de operaciones: Producción y cadena de suministros (12.ª ed.). McGraw-Hill.  
* Davis, F. D. (1989). Perceived usefulness, perceived ease of use, and user acceptance of information technology. MIS Quarterly, 13(3), 319–340. [https://doi.org/10.2307/249008](https://doi.org/10.2307/249008)  
* Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design patterns: Elements of reusable object-oriented software. Addison-Wesley Professional.  
* Goldratt, E. M. (1984). The goal: A process of ongoing improvement. North River Press.  
* Makridakis, S., Wheelwright, S. C., & Hyndman, R. J. (1998). Forecasting: Methods and applications (3.ª ed.). John Wiley & Sons.  
* Monk, E., & Wagner, B. (2012). Concepts in enterprise resource planning (4.ª ed.). Cengage Learning.  
* Ohno, T. (1988). Toyota production system: Beyond large-scale production. Productivity Press.  
* Sutherland, J. (2014). Scrum: The art of doing twice the work in half the time. Crown Currency.  
* Wilson, R. H. (1934). A scientific routine for stock control. Harvard Business Review, 13(1), 116–128.

### **ARTÍCULOS DE REVISTA CIENTÍFICA**

* Amershi, S., Weld, D., Vorvoreanu, M., Fourney, A., Nushi, B., Collisson, P., Suh, J., Iqbal, S., Bennett, P. N., Inkpen, K., Teevan, J., Kikin-Gil, R., & Horvitz, E. (2019). Guidelines for human-AI interaction. Proceedings of the 2019 CHI Conference on Human Factors in Computing Systems, 1–13. [https://doi.org/10.1145/3290605.3300233](https://doi.org/10.1145/3290605.3300233)  
* Arora, A., Sharma, A., & Gupta, P. (2023). Comparative analysis of decision trees and LSTM networks in retail demand forecasting. Applied Sciences, 13(19), 11112\. [https://doi.org/10.3390/app131911112](https://doi.org/10.3390/app131911112)  
* Brown, T. B., Mann, B., Ryder, N., Subbiah, M., Kaplan, J., Dhariwal, P., Neelakantan, A., Shyam, P., Sastry, G., Askell, A., Agarwal, S., Herbert-Voss, A., Krueger, G., Henighan, T., Child, R., Ramesh, A., Ziegler, D. M., Wu, J., Winter, C., … Amodei, D. (2020). Language models are few-shot learners. Advances in Neural Information Processing Systems, 33, 1877–1901.  
* Habel, C., Nair, H. S., & Dube, J.-P. (2024). Predictive analytics in sales and retail: Enhancing purchasing precision. Journal of Marketing Research. [https://doi.org/10.1177/00222437221151039](https://doi.org/10.1177/00222437221151039)  
* Ji, X., Wang, Y., & Zhang, L. (2024). Daily sales prediction in retail using XGBoost algorithm. Journal of Computer Science and Technology Studies, 6(2), 15–28. [https://doi.org/10.32996/jcsts.2024.6.2.15](https://doi.org/10.32996/jcsts.2024.6.2.15)  
* Jiménez, J. H. C. (2018). Microempresas: Análisis empírico de algunos problemas. Revista En-Contexto, 6(9), 1–20. [https://ojs.tdea.edu.co/index.php/encontexto/article/view/486](https://ojs.tdea.edu.co/index.php/encontexto/article/view/486)  
* Moreira-Cañarte, F., & Peñafiel-Rivas, C. (2018). Importancia del control de inventarios en la rentabilidad de las microempresas. Revista FIPCAEC, 3(8). [https://fipcaec.com/index.php/fipcaec/article/view/106](https://fipcaec.com/index.php/fipcaec/article/view/106)  
* Orobia, L. A., Nakibuuka, J., Bananuka, J., & Akisimire, R. (2020). Inventory management and financial performance in small businesses. Journal of Accounting in Emerging Economies, 10(4), 505–523. [https://doi.org/10.1108/jaee-07-2019-0147](https://doi.org/10.1108/jaee-07-2019-0147)  
* Pan, Y. (2022). Machine learning algorithms for price and demand forecasting. Proceedings of Retail Data Analytics Conference.  
* Polo-Triana, M., Rojas, A., & Martínez, C. (2024). Machine learning for decision making in Colombian SMEs: A systematic review. Journal of Industrial Engineering and Management, 17(1). [https://doi.org/10.3926/jiem.6403](https://doi.org/10.3926/jiem.6403)  
* Sadeghi, M., Mousavi, S. M., & Khosravani, M. (2023). Deep learning for supply chain management: A systematic literature review. Computers & Industrial Engineering, 174, 108780\. [https://doi.org/10.1016/j.cie.2022.108780](https://doi.org/10.1016/j.cie.2022.108780)

### **INFORMES INSTITUCIONALES Y REPORTES TÉCNICOS**

* Alcaldía Mayor de Bogotá. (2024). Informe de desarrollo económico de Bogotá 2024\. Secretaría Distrital de Desarrollo Económico.  
* Banco Interamericano de Desarrollo. (2021). Informe anual del Banco Interamericano de Desarrollo 2021: Reseña del año. [https://doi.org/10.18235/0004187](https://doi.org/10.18235/0004187)  
* BBVA Research. (2024). Las micro, pequeñas y medianas empresas en Colombia. [https://www.bbvaresearch.com](https://www.bbvaresearch.com/)  
* Cámara Colombiana de Comercio Electrónico. (2023). Hacia la transformación digital de las MiPymes en Colombia. [https://www.ccce.org.co](https://www.ccce.org.co/)  
* Centro Nacional de Consultoría & iNNpulsa Colombia. (2024). Estudio de transformación digital en mipymes colombianas. iNNpulsa Colombia.  
* Departamento Administrativo Nacional de Estadística. (2021). Encuesta de micronegocios 2021\. DANE. [https://www.dane.gov.co](https://www.dane.gov.co/)  
* Departamento Administrativo Nacional de Estadística. (2022). Encuesta de micronegocios 2022\. DANE. [https://www.dane.gov.co](https://www.dane.gov.co/)  
* Departamento Administrativo Nacional de Estadística. (2023). Encuesta de micronegocios 2023: Trabajadores por cuenta propia. DANE. [https://www.dane.gov.co](https://www.dane.gov.co/)  
* Fedesoft. (2024). Informe de la industria de software y TI en Colombia 2024\. Federación Colombiana de la Industria de Software y TI.  
* Food and Agriculture Organization. (2019). The state of food and agriculture 2019: Moving forward on food loss and waste reduction. FAO. [https://www.fao.org](https://www.fao.org/)  
* GSMA. (2023). The mobile economy 2023\. GSMA Intelligence. [https://www.gsma.com](https://www.gsma.com/)  
* International Accounting Standards Board. (2023). NIIF para PYMES. IFRS Foundation.  
* Market Research Future. (2024). Software de gestión para PyMEs: Informe de mercado 2024-2028. Market Research Future.  
* Ministerio de Tecnologías de la Información y las Comunicaciones. (2023). Informe de digitalización de mipymes en Colombia. MinTIC.  
* Observatorio de Desarrollo Económico de Bogotá. (2025). Informe de dinámica empresarial en Bogotá 2024-2025. Secretaría Distrital de Desarrollo Económico.  
* Oracle. (2023, 21 de septiembre). What is ERP? [https://www.oracle.com/erp/what-is-erp/](https://www.oracle.com/erp/what-is-erp/)  
* Reyes, M. (2021). El canal tradicional en Colombia: Caracterización y tendencias. Fenalco.

### **NORMATIVIDAD COLOMBIANA**

* Congreso de Colombia. (1971). Decreto 410 de 1971 — Código de Comercio colombiano. Función Pública. [https://www.funcionpublica.gov.co](https://www.funcionpublica.gov.co/)  
* Congreso de Colombia. (1982). Ley 23 de 1982 — Sobre derechos de autor. Función Pública. [https://www.funcionpublica.gov.co](https://www.funcionpublica.gov.co/)  
* Congreso de Colombia. (1995). Ley 223 de 1995 — Régimen simplificado de tributación. Función Pública. [https://www.funcionpublica.gov.co](https://www.funcionpublica.gov.co/)  
* Congreso de Colombia. (1999). Ley 527 de 1999 — Por medio de la cual se define y reglamenta el acceso y uso de los mensajes de datos, del comercio electrónico y de las firmas digitales. Función Pública. [https://www.funcionpublica.gov.co](https://www.funcionpublica.gov.co/)  
* Congreso de Colombia. (2000). Ley 590 de 2000 — Por la cual se promueve el desarrollo de la micro, pequeña y mediana empresa colombiana. Función Pública. [https://www.funcionpublica.gov.co](https://www.funcionpublica.gov.co/)  
* Congreso de Colombia. (2004). Ley 905 de 2004 — Por medio de la cual se modifica la Ley 590 de 2000 sobre promoción del desarrollo de la micro, pequeña y mediana empresa colombiana. Función Pública. [https://www.funcionpublica.gov.co](https://www.funcionpublica.gov.co/)  
* Congreso de Colombia. (2008). Ley 1258 de 2008 — Por medio de la cual se crea la sociedad por acciones simplificada. Función Pública. [https://www.funcionpublica.gov.co](https://www.funcionpublica.gov.co/)  
* Congreso de Colombia. (2009). Ley 1273 de 2009 — Por medio de la cual se modifica el Código Penal, se crea un nuevo bien jurídico tutelado denominado "de la protección de la información y de los datos". Función Pública. [https://www.funcionpublica.gov.co](https://www.funcionpublica.gov.co/)  
* Congreso de Colombia. (2012). Ley 1581 de 2012 — Por la cual se dictan disposiciones generales para la protección de datos personales. Función Pública. [https://www.funcionpublica.gov.co](https://www.funcionpublica.gov.co/)  
* Presidencia de la República de Colombia. (2013). Decreto 1377 de 2013 — Por el cual se reglamenta la Ley 1581 de 2012\. Función Pública. [https://www.funcionpublica.gov.co](https://www.funcionpublica.gov.co/)  
* Superintendencia de Industria y Comercio. (2024). Decisión 486 de la Comunidad Andina — Régimen común sobre propiedad industrial. SIC.

### **RECURSOS WEB Y DOCUMENTOS TÉCNICOS**

* Acosta, L. (2022). Diseño de herramienta ofimática para el control de los inventarios en microempresas del sector comercial \[Tesis de grado, Universidad Tecnológica de Santander\]. Repositorio Institucional UTS. [http://repositorio.uts.edu.co:8080/xmlui/handle/123456789/10298](http://repositorio.uts.edu.co:8080/xmlui/handle/123456789/10298)  
* Alcívar, D., & Vásquez, F. A. (2018). Diseño de una herramienta de productividad: Sistema de inventario y facturación para microempresas y pequeñas empresas \[Tesis de grado, Universidad de Guayaquil\]. Repositorio Institucional UG. [http://repositorio.ug.edu.ec/handle/redug/29193](http://repositorio.ug.edu.ec/handle/redug/29193)  
* Beck, K., Beedle, M., van Bennekum, A., Cockburn, A., Cunningham, W., Fowler, M., Grenning, J., Highsmith, J., Hunt, A., Jeffries, R., Kern, J., Marick, B., Martin, R. C., Mellor, S., Schwaber, K., Sutherland, J., & Thomas, D. (2001). Manifesto for agile software development. Agile Alliance. [https://agilemanifesto.org](https://agilemanifesto.org/)  
* dichter & neira. (2024). StoreConnect AI: Soluciones de inteligencia artificial para retail. [https://www.dichter-neira.com](https://www.dichter-neira.com/)  
* Fielding, R. T. (2000). Architectural styles and the design of network-based software architectures \[Tesis doctoral, University of California, Irvine\]. [https://ics.uci.edu/\~fielding/pubs/dissertation/top.htm](https://ics.uci.edu/~fielding/pubs/dissertation/top.htm)  
* Gustavo, P. A. I., & Felipe, H. P. J. (2016). Aplicativo web para la gestión de inventarios en pequeñas empresas \[Trabajo de grado, Universidad Distrital Francisco José de Caldas\]. Repositorio Institucional UD. [https://repository.udistrital.edu.co/items/70b083ec-93c1-4ba5-9f83-bc650a222ac2](https://repository.udistrital.edu.co/items/70b083ec-93c1-4ba5-9f83-bc650a222ac2)  
* Hincapié Herrera, J. (2021). Modelo de planeación de demanda en retail usando H2O AutoML y Random Forest \[Tesis de pregrado, Universidad de Antioquia\]. Repositorio Institucional UdeA. [http://hdl.handle.net/10495/19929](http://hdl.handle.net/10495/19929)  
* Jiménez Jiménez, I. V., & Pérez Villamar, P. J. G. (2022). Propuesta de un sistema de gestión de inventario para mejorar la competitividad de la microempresa de distribuciones "Los Andes" ubicada en el cantón Tena \[Tesis de grado, Universidad Católica de Santiago de Guayaquil\]. Repositorio Institucional UCSG. [http://repositorio.ucsg.edu.ec/handle/3317/18126](http://repositorio.ucsg.edu.ec/handle/3317/18126)  
    
* Loa, J., & Wiratama, J. (2024). SKU-level inventory optimization integrating XGBoost and Odoo ERP. ResearchGate Preprints. [https://www.researchgate.net/publication/jurgen.loa](https://www.researchgate.net/publication/jurgen.loa)  
* Mahaal. (2024). Tendencias del comercio minorista en América Latina. [https://www.mahaal.com](https://www.mahaal.com/)  
* Microsip. (2023). Informe de gestión de inventarios en pequeñas empresas. [https://www.microsip.com](https://www.microsip.com/)  
* Moreno, L., Rodríguez, P., & Sánchez, M. (2024). Diseño de control de inventarios bajo metodología Scrum para tiendas locales. Revista del ITFIP. Dialnet.  
* MRPEasy. (s.f.). Inventory management challenges for small businesses. [https://www.mrpeasy.com](https://www.mrpeasy.com/)  
* Napse. (2024). El estado del comercio minorista en Colombia. [https://www.napse.com](https://www.napse.com/)  
* OpenAI. (2024). GPT-4o mini: Advancing cost-efficient intelligence. [https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/](https://openai.com/index/gpt-4o-mini-advancing-cost-efficient-intelligence/)  
* Treinta. (2024). Plataforma de control de inventario para tiendas. [https://www.treinta.co](https://www.treinta.co/)  
* Weavee. (2025). Tendencias de digitalización en el canal tradicional. [https://www.weavee.com](https://www.weavee.com/)  
* eWorkplace. (2023). Informe de supervivencia de microempresas en Colombia. [https://www.eworkplace.com](https://www.eworkplace.com/)

### **ARTÍCULOS DE PRENSA Y FUENTES PERIODÍSTICAS**

* Fenalco. (2021). Caracterización del tendero colombiano. Fenalco.  
* Fenalco. (2024). Boletín Fenaltiendas 2024\. Fenalco.  
* MinCIT. (2023). Informe de dinámica empresarial en Colombia 2023\. Ministerio de Comercio, Industria y Turismo.  
* SAC. (2023). Informe de la Sociedad de Agricultores de Colombia. Sociedad de Agricultores de Colombia.

### **HERRAMIENTAS Y RECURSOS TECNOLÓGICOS**

* Autocannon. (2024). Herramienta de benchmarking HTTP \[Software\]. [https://github.com/mcollina/autocannon](https://github.com/mcollina/autocannon)  
* ExcelJS. (2024). Librería para generación de archivos Excel en Node.js \[Software\]. [https://github.com/exceljs/exceljs](https://github.com/exceljs/exceljs)  
* Express. (2024). Framework web para Node.js \[Software\]. [https://expressjs.com](https://expressjs.com/)  
* Neon. (2024). PostgreSQL serverless en la nube \[Software\]. [https://neon.tech](https://neon.tech/)  
* node-cron. (2024). Librería de programación de tareas para Node.js \[Software\]. [https://github.com/node-cron/node-cron](https://github.com/node-cron/node-cron)  
* Nodemailer. (2024). Módulo para envío de correos en Node.js \[Software\]. [https://nodemailer.com](https://nodemailer.com/)  
* PDFKit. (2024). Librería para generación de PDF en Node.js \[Software\]. [https://pdfkit.org](https://pdfkit.org/)  
* Playwright. (2024). Framework de pruebas End-to-End \[Software\]. [https://playwright.dev](https://playwright.dev/)  
* PostgreSQL Global Development Group. (2024). PostgreSQL 15 \[Software\]. [https://www.postgresql.org](https://www.postgresql.org/)  
* React. (2024). Biblioteca de interfaces de usuario \[Software\]. [https://react.dev](https://react.dev/)  
* Recharts. (2024). Librería de gráficas para React \[Software\]. [https://recharts.org](https://recharts.org/)  
* Render. (2024). Plataforma de despliegue en la nube \[Software\]. [https://render.com](https://render.com/)  
* TailwindCSS. (2024). Framework de CSS utilitario \[Software\]. [https://tailwindcss.com](https://tailwindcss.com/)  
* Vite. (2024). Herramienta de construcción para frontend \[Software\]. [https://vitejs.dev](https://vitejs.dev/)  
* Vitest. (2024). Framework de pruebas unitarias \[Software\]. [https://vitest.dev](https://vitest.dev/)


[image1]: <data:image/png;base64,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>