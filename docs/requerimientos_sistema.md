# Especificación de Requisitos de Software (IEEE 830)

**Proyecto:** StockPilot — Sistema de Gestión de Inventario Inteligente
**Versión:** 2026
**Última Actualización:** 23 de Septiembre de 2026 (revisión y corrección post unificación del motor de riesgo — plan 17/18)

---

## 1. Introducción

### 1.1 Propósito
El presente documento tiene como propósito definir las especificaciones funcionales y no funcionales para el desarrollo e iteración de **StockPilot**, un sistema web inteligente de gestión de inventarios y punto de venta (POS) para micro y medianas empresas.

### 1.2 Alcance
Esta especificación de requisitos abarca todas las funcionalidades de StockPilot, desde la gestión básica de productos y autenticación, hasta sus módulos avanzados de predicción de demanda mediante Inteligencia Artificial, control integral de sesiones de caja, y sistema de automatización de alertas.

### 1.3 Personal involucrado
- **Lucho:** Desarrollador Principal, Arquitecto de Software y Analista.

### 1.4 Definiciones, acrónimos y abreviaturas
- **POS (Point of Sale):** Punto de venta.
- **RF / RNF:** Requerimiento Funcional / No Funcional.
- **ABC / Pareto:** Clasificación de inventario basada en su impacto económico.
- **COP:** Pesos Colombianos.
- **Lead Time:** Tiempo de entrega del proveedor.

### 1.5 Referencias
- Estándar IEEE 830-1998 para Especificaciones de Requisitos de Software.
- Documento Base de Prácticas de Ingeniería de Sistemas.

### 1.6 Resumen
El documento se divide en tres partes: una descripción general del sistema (Sección 2), la definición de las interfaces de operación (Sección 3.1), y finalmente el listado exhaustivo de los 76 Requisitos Funcionales (2 de ellos retirados tras una revisión posterior, ver Módulos 6 y 9) y 18 Requisitos No Funcionales del producto.

---

## 2. Descripción General

### 2.1 Perspectiva del producto
StockPilot es una solución basada en la nube (arquitectura web cliente-servidor) desarrollada sobre Node.js, Express, React y PostgreSQL. Funciona de manera independiente y se concibe como una solución integral (ERP ligero) para comercios.

### 2.2 Funcionalidad del producto
El sistema centraliza las ventas (Caja Rápida), el inventario, los egresos de caja menor, las auditorías, las compras, y proyecta la demanda empleando inteligencia artificial, automatizando también el reporte periódico de métricas.

### 2.3 Características de los usuarios
- **Administrador:** Dueño o gerente del establecimiento. Control total sobre inventarios, caja, aprobación de egresos, auditorías IA y métricas.
- **Colaborador:** Vendedor o cajero. Permisos limitados a apertura/cierre de su propia caja, registro de ventas y reportes operativos básicos.

### 2.4 Restricciones
- El sistema requiere conexión permanente a internet para consultar a la base de datos (PostgreSQL) y la API de Inteligencia Artificial.
- Funciona exclusivamente a través de navegadores web modernos (Chrome, Firefox, Edge).

### 2.5 Suposiciones y dependencias
- Se asume que el usuario cuenta con dispositivos con cámara si desea escanear códigos de barras.
- Se depende de servicios de OpenAI para sugerencias y OpenFoodFacts para la consulta de productos por código.

---

## 3. Requisitos Específicos

### 3.1 Requisitos comunes de las interfaces
**3.1.1 Interfaces de usuario:** Interfaz tipo Dashboard administrativo con barra de navegación lateral y vistas dedicadas, completamente responsivo.
**3.1.2 Interfaces de hardware:** Adaptador de red y opcionalmente cámara (webcam o móvil) para escaneo de códigos de barras.
**3.1.3 Interfaces de software:** Navegador Web compatible con HTML5 y JavaScript.
**3.1.4 Interfaces de comunicación:** Comunicación HTTP/HTTPS estructurada en arquitectura RESTful (JSON).

---

## 3.2 Requerimientos Funcionales

---

### Módulo 1: Autenticación y Gestión de Usuarios

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-001 | El sistema debe permitir el inicio de sesión mediante usuario/matrícula, contraseña y rol operativo (Administrador o Colaborador)                                         | Alta      | ✅     |
| RF-002 | El sistema debe permitir el registro de nuevos usuarios con datos personales (nombre, correo, celular) y datos del negocio (nombre tienda, dirección)                    | Alta      | ✅     |
| RF-003 | El sistema debe ofrecer un flujo de recuperación de contraseña con verificación por código de 6 dígitos enviado al correo registrado                                     | Alta      | ✅     |
| RF-004 | El sistema debe proteger las rutas privadas, redirigiendo a login cuando no hay sesión activa                                                                            | Alta      | ✅     |
| RF-005 | El sistema debe permitir al usuario actualizar su perfil (nombre, género, correo, celular, nombre de usuario y foto de perfil en Base64)                                 | Media     | ✅     |
| RF-006 | El sistema debe almacenar las contraseñas con hash seguro (bcrypt, 10 salt rounds)                                                                                       | Alta      | ✅     |
| RF-061 | El sistema debe bloquear un segundo intento de inicio de sesión cuando ya existe una sesión activa para el mismo usuario, retornando el código `SESSION_ACTIVE` y presentando al nuevo dispositivo un aviso de conflicto con opción de forzar la entrada; si el usuario confirma, la sesión previa se invalida y el dispositivo anterior recibe el mensaje "Has iniciado sesión en otro dispositivo" | Alta | ✅ |
| RF-062 | El sistema debe forzar el cambio de contraseña en el primer inicio de sesión para usuarios de tipo Colaborador creados por el administrador                               | Alta      | ✅     |

---

### Módulo 2: Gestión de Productos

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-007 | El sistema debe permitir CRUD completo de productos (crear, leer, actualizar, eliminar) previniendo duplicados; al registrar, debe buscar coincidencias y cambiar al flujo de "Recepción de Inventario" si el producto ya existe | Alta      | ✅     |
| RF-008 | Cada producto debe registrar: código (SKU interno), código de barras (EAN/UPC), nombre, categoría, subcategoría, precio, costo, cantidad, stock mínimo, stock máximo, fecha de vencimiento, frecuencia de compra, stock de seguridad y lead time | Alta | ✅ |
| RF-009 | El sistema debe calcular y almacenar la clasificación ABC (Pareto) de cada producto según su contribución a los ingresos: A (80%), B (95%), C (100%)                     | Alta      | ✅     |
| RF-010 | El sistema debe registrar fechas de vencimiento y utilizarlas para generar alertas predictivas cruzadas con la velocidad de venta                                        | Alta      | ✅     |
| RF-011 | El sistema debe mostrar gráficos visuales (barras Pareto con % acumulado y donut de distribución) de la clasificación ABC de los productos en el Centro Analítico        | Media     | ✅     |
| RF-064 | El sistema debe consultar APIs externas (ej. Open Food Facts) al escanear un código de barras para autocompletar automáticamente el nombre y categoría de productos nuevos | Alta      | ✅     |
| RF-076 | El Catálogo debe mostrar el nivel de stock de cada producto (agotado, crítico, por reponer o suficiente) calculado por el mismo motor de reposición que usan el Dashboard, el Consejero IA, Proveedores y el Centro Analítico, evitando que un mismo producto se vea sano en una pantalla y en riesgo en otra | Alta | ✅ |

---

### Módulo 3: Gestión de Punto de Venta (POS) y Caja

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-012 | El sistema debe permitir el registro de ventas asociando productos, cantidades, precios unitarios y el **usuario vendedor**, descontando automáticamente del inventario | Alta      | ✅     |
| RF-013 | El sistema debe descontar automáticamente del inventario las cantidades vendidas al confirmar una venta                                                                   | Alta      | ✅     |
| RF-014 | El sistema debe mostrar un ranking de los productos más vendidos (Top Ventas) con cantidades e ingresos totales acumulados                                               | Media     | ✅     |
| RF-015 | El sistema debe unificar la experiencia de caja y reporte mostrando el historial completo de ventas dentro del Punto de Venta (y en módulo Reportes), exponiendo qué vendedor hizo cada transacción | Media     | ✅     |
| RF-065 | El Punto de Venta debe permitir agregar productos al carrito mediante escaneo estricto de código o búsqueda predictiva tecleando nombre o fragmentos del SKU             | Alta      | ✅     |
| RF-066 | El sistema debe forzar al vendedor a abrir una sesión de caja antes de registrar ventas, requiriendo ingresar el monto de apertura inicial                               | Alta      | ✅     |
| RF-067 | El sistema debe permitir el registro de Egresos de Caja Menor, requiriendo un motivo, monto, categoría y, opcionalmente, la subida de una foto de soporte (evidencia)     | Alta      | ✅     |
| RF-068 | El sistema debe permitir a los usuarios con rol Administrador aprobar, rechazar o comentar los egresos registrados por los colaboradores desde el panel de Historial Egresos | Alta      | ✅     |
| RF-069 | El sistema debe registrar el cierre de la sesión de caja, requiriendo declarar el monto final físico, y calculando la diferencia automática respecto a ventas y egresos  | Alta      | ✅     |

---

### Módulo 4: Control de Movimientos de Inventario

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-016 | El sistema debe registrar entradas y salidas de stock con trazabilidad completa (fecha, tipo de movimiento, cantidad, observación y usuario responsable)                  | Alta      | ✅     |
| RF-017 | El sistema debe actualizar el stock del producto en tiempo real tras cada movimiento registrado                                                                          | Alta      | ✅     |

---

### Módulo 5: Gestión del Establecimiento

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-018 | El sistema debe permitir al administrador consultar y actualizar los datos del establecimiento registrado (nombre, dirección, razón social, documento, ciudad y celular de contacto) | Alta      | ✅     |
| RF-019 | Los datos de cada cuenta (productos, ventas, alertas, reportes) deben estar completamente aislados entre establecimientos, sin interferencia entre negocios distintos    | Alta      | ✅     |

---

### Módulo 6: Motor de Predicción de Demanda (IA)

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-020 | El sistema debe calcular la velocidad de venta promedio por producto en períodos de 7 y 30 días                                                                          | Alta      | ✅     |
| RF-021 | El sistema debe permitir al administrador ajustar el período de proyección de demanda (7-90 días) mediante slider en el Simulador de Escenarios, recalculando cantidades necesarias en tiempo real | Media | ✅ |
| RF-022 | El sistema debe identificar tendencias (alcista/bajista/estable) comparando la velocidad de 7 días contra la de 30 días                                                  | Alta      | ✅     |
| RF-023 | El sistema debe proyectar la fecha estimada de agotamiento de cada producto basándose en stock actual y velocidad de venta                                               | Alta      | ✅     |
| RF-024 | El sistema debe calcular el Punto de Reorden (ROP) usando la fórmula: (velocidad × lead_time) + stock_seguridad                                                         | Alta      | ✅     |
| RF-025 | El sistema debe integrar un modelo de IA (GPT-4o-mini) para generar ajustes porcentuales sobre las sugerencias matemáticas base, aplicando guardrails por clase ABC (A: ±100%, B: ±50%, C: ±20%) | Alta | ✅ |
| RF-026 | El sistema debe registrar todas las decisiones de IA en un log de auditoría (archivo ai_audit.log y tabla Auditoria_IA) con prompt, respuesta y razonamiento             | Alta      | ✅     |

---

### Módulo 7: Compras Sugeridas (Órdenes Inteligentes)

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-027 | El sistema debe generar automáticamente listas de compra con cantidades óptimas por proveedor, priorizando productos Clase A > B > C                                     | Alta      | ✅     |
| RF-028 | El sistema debe permitir al usuario editar manualmente las cantidades sugeridas antes de confirmar la orden                                                               | Alta      | ✅     |
| RF-029 | El sistema debe permitir incluir o excluir productos individuales de la orden mediante checkboxes                                                                         | Alta      | ✅     |
| RF-030 | El sistema debe evaluar el riesgo de cada orden (Bajo/Medio/Alto) basándose en presupuesto e ítems críticos                                                              | Alta      | ✅     |
| RF-031 | El sistema debe persistir las órdenes confirmadas en la base de datos con detalle de ítems, montos y registro de auditoría IA                                            | Alta      | ✅     |
| RF-032 | El sistema debe mostrar un historial de órdenes pasadas con opción de expandir cada una para ver el detalle de productos, cantidades base, ajuste IA y cantidad final    | Media     | ✅     |

---

### Módulo 8: Alertas Inteligentes

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-033 | El sistema debe generar alertas automáticas de stock crítico cuando los días de inventario restantes sean menores al lead time del proveedor                              | Alta      | ✅     |
| RF-034 | El sistema debe generar alertas de advertencia cuando el stock se encuentre en la ventana ideal de reposición (entre lead time y lead time + frecuencia de compra)        | Alta      | ✅     |
| RF-035 | El sistema debe generar alertas de vencimiento (crítico ≤7 días, advertencia ≤30 días) cruzadas con la velocidad de venta para estimar unidades que quedarán invendibles | Alta      | ✅     |
| RF-036 | El sistema debe generar alertas de sobrestock cuando un producto Clase C exceda el stock máximo con más de 60 días de inventario                                         | Media     | ✅     |
| RF-037 | El sistema debe permitir al usuario filtrar alertas por severidad (Crítica, Advertencia, Sobrestock) y marcarlas como resueltas individualmente                           | Media     | ✅     |

---

### Módulo 9: Dashboard Inteligente y Centro Analítico (KPIs)

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-038 | El Dashboard debe mostrar en tiempo real: total artículos, valor total del inventario, alertas activas (con semáforo de color rojo/amarillo/verde) y ventas acumuladas    | Alta      | ✅     |
| RF-039 | El Dashboard debe mostrar las recomendaciones del Asistente Estratégico IA con producto, tendencia, ajuste sugerido y nivel de confianza                                 | Alta      | ✅     |
| RF-040 | El Dashboard debe mostrar un gráfico de barras del ritmo de caja (ventas) de los últimos 7 días                                                                         | Media     | ✅     |
| RF-041 | El Centro Analítico debe mostrar la proyección de agotamiento de los 10 productos más críticos, calculada por el mismo motor de reposición que usan Catálogo, Consejero IA y Proveedores | Media | ✅ |
| RF-042 | ~~El sistema debe calcular y exponer el nivel de servicio estimado como el porcentaje de productos cuyo stock actual supera el Punto de Reorden (ROP)~~ — **Retirado.** El endpoint `GET /api/dashboard/stats/advanced` que lo exponía no tenía ningún consumidor en el frontend (verificado con búsqueda exhaustiva); se eliminó en la unificación del motor de riesgo (ver `docs/planes/17_unificacion_motor_riesgo_inventario.md`, Fase 5) en vez de mantener una fórmula sin pantalla que la mostrara | Media | ❌ Retirado |
| RF-043 | ~~El sistema debe calcular una comparativa de ventas entre los últimos 30 días y los 30 días previos, exponiendo montos y variación porcentual~~ — **Retirado** por el mismo motivo que RF-042 (mismo endpoint sin consumidor) | Baja | ❌ Retirado |

---

### Módulo 10: Reportes y Exportación

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-044 | El sistema debe permitir crear reportes documentales con título, tipo (Inventario/Ventas/Financiero/Operativo), fecha de emisión y rango de evaluación                   | Alta      | ✅     |
| RF-045 | El sistema debe permitir editar y eliminar reportes existentes con confirmación mediante modal de seguridad                                                               | Media     | ✅     |
| RF-046 | El sistema debe exportar reportes a formato Excel (XLSX) con los datos del rango de fechas seleccionado                                                                  | Alta      | ✅     |
| RF-047 | El sistema debe mostrar un modal de advertencia cuando no existen datos en el rango seleccionado y permitir al usuario decidir si procede con el guardado               | Baja      | ✅     |
| RF-058 | El sistema debe generar un reporte PDF de auditoría de merma con todos los productos vencidos, incluyendo nombre del producto, proveedor completo, cantidad, precio unitario y cálculo automático de pérdida financiera total en pesos colombianos (COP) | Alta | ✅ |

---

### Módulo 11: Gestión de Proveedores

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-048 | El sistema debe permitir CRUD de proveedores (nombre empresa, contacto principal, email, teléfono, dirección)                                                            | Alta      | ✅     |
| RF-049 | El sistema debe vincular productos con proveedores mediante FK para calcular forecasts por proveedor y agrupar órdenes de compra                                         | Alta      | ✅     |
| RF-063 | El sistema debe permitir enviar una orden de compra aprobada al proveedor por correo electrónico con tabla de productos, cantidades y valores de referencia en COP, actualizando el estado de la orden a "Enviada" y configurando el replyTo al correo del administrador | Alta | ✅ |

---

### Módulo 12: Registro y Gestión de Colaboradores

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-050 | El administrador debe poder registrar, editar y eliminar usuarios de tipo Colaborador con datos de perfil completos (nombre, género, correo, celular, usuario, contraseña temporal) | Alta | ✅ |
| RF-051 | Solo los usuarios con rol Administrador deben tener acceso al módulo de registro de Colaboradores                                                                        | Alta      | ✅     |

---

### Módulo 13: Simulador de Escenarios de Compra

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-052 | El sistema debe permitir al usuario ajustar el parámetro "días de cobertura deseada" mediante un slider (7-90 días) y visualizar las cantidades necesarias por producto, calculadas por el mismo motor de reposición que usan el Consejero IA y Proveedores (clasificación ABC, tendencia y piso de stock mínimo/seguridad para productos sin historial de ventas), reemplazando el días × velocidad − stock fijo con un objetivo de cobertura ajustable por el slider | Alta | ✅ |
| RF-053 | El sistema debe permitir al usuario definir un presupuesto máximo y recalcular la lista mediante algoritmo greedy, priorizando productos Clase A y recortando desde Clase C cuando el costo total exceda el presupuesto | Alta | ✅ |
| RF-054 | El sistema debe permitir convertir el resultado de una simulación aprobada en una orden de compra real, seleccionando el proveedor y generando la orden con estado Borrador | Media | ✅ |

---

### Módulo 14: Retroalimentación IA y Aprendizaje Continuo

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-055 | El sistema debe comparar las cantidades sugeridas por la IA contra las ventas reales posteriores y calcular un factor de precisión por producto (ventas_reales / cantidad_sugerida), con período adaptativo de max(lead_time × 2, 14) días | Alta | ✅ |
| RF-056 | El sistema debe persistir el factor de precisión en la tabla Feedback_IA y aplicarlo como multiplicador en las siguientes sugerencias para mejorar progresivamente la exactitud, limitando el factor entre 0.2 y 3.0 | Alta | ✅ |
| RF-057 | El sistema debe mostrar un dashboard de Aprendizaje con nivel de acierto global (%), gráfica de evolución mensual, y tabla de rendimiento por producto con barras de precisión y veredicto (acertado / sugirió de más / sugirió de menos) | Media | ✅ |
| RF-070 | El sistema debe analizar productos con tendencia bajista, sobrestock o vencimiento próximo y generar sugerencias de promoción comercial (descuento, combo, 2x1, liquidación) mediante IA, priorizando los candidatos con vencimiento más próximo antes de enviarlos al modelo; adicionalmente, debe aplicar un fallback determinístico para garantizar cobertura del 100% de candidatos cuando el modelo omita alguno, mostrando todas las sugerencias en el Panel de Control con impacto financiero estimado | Media | ✅ |

---

### Módulo 15: Automatización y Comunicación Proactiva

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-059 | El sistema debe enviar automáticamente cada lunes a las 8:00 AM un correo electrónico HTML responsive a los administradores de cada tienda, con las estadísticas de alertas críticas, alertas de advertencia y las 5 alertas prioritarias activas | Alta | ✅ |
| RF-060 | El sistema debe permitir al administrador disparar manualmente el resumen semanal de alertas desde la interfaz de Reportes mediante el botón "Enviar Resumen Ahora", ejecutando la misma lógica del cron job pero solo para su tienda | Alta | ✅ |
| RF-064 | El sistema debe emitir una alerta sonora (chime digital) en tiempo real cada vez que se detecte un incremento en el contador de alertas activas durante el polling del Dashboard, utilizando archivos de audio locales y diferenciando tonos para alertas críticas y normales | Media | ✅ |

### Módulo 16: Gestión de Cartera y Fiados

| ID     | Descripción                                                                                                                                                              | Prioridad | Estado |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ |
| RF-071 | El sistema debe permitir registrar ventas como "Fiado", asociándolas obligatoriamente a un cliente y excluyendo dicho monto del efectivo esperado en caja                | Alta | ✅ |
| RF-072 | El sistema debe mantener un saldo pendiente general por cliente, calculado de forma dinámica como la suma de las compras fiadas menos la suma de los abonos pagados        | Alta | ✅ |
| RF-073 | El sistema debe permitir registrar abonos (pagos parciales o totales) al saldo de un cliente y sumar el dinero recibido en efectivo a la caja activa del usuario         | Alta | ✅ |
| RF-074 | El sistema debe contar con un motor de IA que evalúe el historial de pagos y compras fiadas del cliente para generar un nivel de riesgo, clasificación y sugerencia comercial | Alta | ✅ |
| RF-075 | El sistema debe bloquear el acceso a la interfaz de Cartera y al método de pago "Fiado" para el rol de Colaborador, siendo funcionalidad exclusiva del Administrador           | Alta | ✅ |

---

## 3.3 Requerimientos No Funcionales

---

### Rendimiento

| ID      | Descripción                                                                                                                                                             | Prioridad |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RNF-001 | El Dashboard debe cargar sus métricas en menos de 3 segundos tras la autenticación                                                                                      | Alta      |
| RNF-002 | Las consultas a la base de datos deben responder en menos de 500ms para operaciones CRUD estándar                                                                       | Alta      |
| RNF-003 | El sistema de caché de IA debe evitar llamadas redundantes a la API cuando los datos no han cambiado, utilizando comparación por hash MD5                               | Alta      |

---

### Seguridad

| ID      | Descripción                                                                                                                                                             | Prioridad |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RNF-004 | Las contraseñas deben almacenarse con hash bcrypt (mínimo 10 salt rounds)                                                                                               | Alta      |
| RNF-005 | Las sesiones deben gestionarse del lado del servidor con express-session e invalidarse al cerrar sesión                                                                  | Alta      |
| RNF-006 | Las rutas de API deben estar protegidas por middleware de autenticación (requireLogin), impidiendo acceso sin sesión activa                                              | Alta      |
| RNF-007 | Las llamadas a la API de OpenAI deben aplicar guardrails (clamping de ajustes por clase ABC) para evitar sugerencias extremas no controladas                             | Alta      |
| RNF-016 | El sistema debe impedir sesiones concurrentes del mismo usuario, dando prioridad a la sesión ya activa: el nuevo intento de login es bloqueado y solo procede si el usuario elige explícitamente desplazar la sesión existente; el dispositivo desplazado recibe notificación en su próxima petición | Alta |

---

### Usabilidad

| ID      | Descripción                                                                                                                                                             | Prioridad |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RNF-008 | La interfaz debe ser responsive, adaptándose a pantallas desde 375px (móvil) hasta 1920px (desktop)                                                                     | Alta      |
| RNF-009 | El sistema debe proporcionar feedback visual inmediato (toasts de éxito/error) tras cada acción del usuario (crear, editar, eliminar, enviar)                            | Alta      |
| RNF-010 | Los formularios deben validar campos requeridos del lado del cliente antes de enviar al servidor                                                                         | Media     |

---

### Disponibilidad y Compatibilidad

| ID      | Descripción                                                                                                                                                             | Prioridad |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RNF-011 | El sistema debe funcionar correctamente en Chrome, Edge y Firefox (últimas 2 versiones)                                                                                 | Alta      |
| RNF-012 | El servidor debe reiniciarse automáticamente ante cambios en desarrollo (Nodemon) sin perder datos persistidos en la base de datos PostgreSQL                                                | Media     |

---

### Mantenibilidad

| ID      | Descripción                                                                                                                                                             | Prioridad |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RNF-013 | El código debe seguir el patrón MVC con separación clara de rutas, controladores y modelos                                                                              | Alta      |
| RNF-014 | La base de datos debe soportar migraciones incrementales sin pérdida de datos existentes                                                                                | Alta      |
| RNF-015 | Las decisiones de la IA deben quedar registradas en log de auditoría (archivo + base de datos) para trazabilidad completa                                               | Alta      |

---

### Interoperabilidad

| ID      | Descripción                                                                                                                                                             | Prioridad |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| RNF-017 | El sistema de correo automatizado debe registrar en consola del servidor el resultado de cada envío (éxito con nombre de tienda y cantidad de admins, o error descriptivo) para trazabilidad | Media |
| RNF-018 | Los reportes PDF generados deben utilizar formato de moneda local colombiana (COP) y codificación compatible con caracteres en español                                   | Media     |

---

## 4. Resumen Estadístico

| Categoría          | Total | Implementados | Retirados | Planeados |
| ------------------ | ----- | -------------- | --------- | --------- |
| **Funcionales**    | 76    | 74 (97%)       | 2 (3%)    | 0 (0%)    |
| **No Funcionales** | 18    | 18 (100%)      | 0 (0%)    | 0 (0%)    |
| **Total**          | 94    | 92 (98%)       | 2 (2%)    | 0 (0%)    |

*Nota:* RF-042 y RF-043 se retiraron tras la unificación del motor de riesgo (ver Módulo 9): el endpoint que exponían no tenía consumidor en el frontend. Se conservan sus IDs en este documento como registro histórico en vez de renumerar el resto de los requisitos.
