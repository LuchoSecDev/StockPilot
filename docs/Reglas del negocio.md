# **Requerimientos del negocio**

A grandes rasgos, se pueden definir los requerimientos del negocio, que consiste en permitir al sistema gestionar el inventario de múltiples tiendas de manera independiente, teniendo en cuenta lo siguiente:

* Se debe llevar un registro exacto de las entradas y salidas de productos.  
* El sistema debe procesar ventas y descontar el stock automáticamente.  
* Se debe alertar al tendero cuando un producto alcance su stock mínimo de seguridad.  
* Una Inteligencia Artificial debe analizar el inventario y sugerir órdenes de compra.  
* Se debe llevar un historial de auditoría de todas las decisiones tomadas por la IA.

Para mayor detalle: [Requerimientos Funcionales y No funcionales](https://docs.google.com/document/d/1fglyWGSbMchBE3ZA698ooMRNDfoekCkno5qMKWllC-I/edit?usp=drive_link)

# **Reglas del Negocio**

**RN01 — Tienda (Multitenencia)**

Toda la información debe estar separada y agrupada por establecimiento comercial. Una tienda es el eje central del sistema.

**RN02 — Usuario y Roles**

Un usuario debe pertenecer a una tienda y ocupar un rol específico (Ej: Administrador, Tendero). Un administrador puede gestionar toda la tienda, mientras que el tendero tiene permisos limitados (ventas). TIENDA 1 ───── N USUARIO

**RN03 — Proveedor**

Una tienda puede trabajar con diferentes proveedores de mercancía. TIENDA 1 ───── N PROVEEDOR

**RN04 — Producto**

Todo producto pertenece al catálogo de una tienda y puede tener un proveedor asignado. TIENDA 1 ───── N PRODUCTO, PROVEEDOR 1 ───── N PRODUCTO

**RN05 — Historial de Precios**

El precio de un producto puede fluctuar en el tiempo. Por motivos de trazabilidad financiera, cuando el precio de un producto cambia, se debe guardar un historial para saber en qué fecha varió el costo. PRODUCTO 1 ───── N HISTORIAL\_PRECIOS

**RN06 — Movimientos de Stock**

Para mantener la precisión del inventario, cada entrada, salida o ajuste manual de cantidad de un producto debe registrarse detalladamente junto con la fecha y el usuario responsable. PRODUCTO 1 ───── N MOVIMIENTOS\_STOCK, USUARIO 1 ───── N MOVIMIENTOS\_STOCK

**RN07 — Ventas**

Para cada venta se liquida un cobro total. Una venta es procesada por un usuario vendedor en una tienda específica. USUARIO 1 ───── N VENTAS, TIENDA 1 ───── N VENTAS

**RN08 — Detalle de Venta**

Una venta puede contener diferentes productos (conceptos de cobro) y un producto puede venderse muchas veces en ventas distintas. Se debe registrar la cantidad y el precio congelado en el momento exacto de la venta. VENTA 1 ───── N VENTAS\_PRODUCTOS y PRODUCTO 1 ───── N VENTAS\_PRODUCTOS

**RN09 — Alertas de Inventario**

Cuando el inventario de un producto desciende de su stock\_minimo, el sistema genera una alerta para que el tendero esté informado de que debe reabastecerse. PRODUCTO 1 ───── N ALERTAS

**RN10 — Órdenes de Compra**

La tienda realiza pedidos a proveedores para reabastecerse. Una orden puede tener sugerencias de la IA basadas en el historial de ventas. TIENDA 1 ───── N ORDENES\_COMPRA y PROVEEDOR 1 ───── N ORDENES\_COMPRA

**RN11 — Auditoría y Decisiones IA**

Toda decisión o recomendación generada por la Inteligencia Artificial (sobre cuánto comprar) debe auditarse para evaluar si su precisión fue correcta comparada con las ventas reales. ORDEN\_COMPRA 1 ───── N AUDITORIA\_IA y ORDEN\_COMPRA 1 ───── N FEEDBACK\_IA.

**RN12 — Caché de IA**

Las respuestas de la Inteligencia Artificial se almacenan en una caché persistente para evitar consultas repetidas al motor de IA y mejorar el rendimiento del sistema.

# **Sustantivos**

Inicialmente podemos identificar los siguientes sustantivos que se pueden convertir en entidades o tablas:

1. Tienda  
2. Usuario  
3. Administrador  
4. Tendero  
5. Producto  
6. Categoría  
7. Precio  
8. Proveedor  
9. Movimiento  
10. Venta  
11. Orden de Compra  
12. Alerta  
13. IA  
14. Auditoría  
15. Reporte  
16. Caché

# **Entidades / Tablas candidatas**

1. TIENDA  
2. USUARIO  
3. PROVEEDOR  
4. PRODUCTO  
5. HISTORIAL\_PRECIOS  
6. MOVIMIENTO\_STOCK  
7. VENTA  
8. VENTAS\_PRODUCTOS (Relación detalle)  
9. ALERTA  
10. ORDEN\_COMPRA  
11. ORDENES\_DETALLE  
12. AUDITORIA\_IA  
13. FEEDBACK\_IA  
14. REPORTE  
15. CACHE\_IA

# **Identificación de características**

* **Una tienda tiene:** id, nombre del establecimiento, dirección, año de creación, estado, documento, razón social, celular y ciudad.  
* **Un usuario tiene:** id, nombres, género, correo, celular, rol, usuario, contraseña, fecha de registro, id de la tienda, session\_id, foto\_url, cambio\_clave\_forzoso, reset\_token y reset\_expires.  
* **Un proveedor tiene:** id del proveedor, nombre de la empresa, nit, contacto nombre, contacto principal, teléfono, correo, email, dirección, id de la tienda, estado y fecha de registro.  
* **Un producto tiene:** id, código, nombre del producto, categoría, subcategoría, tipo de producto, precio, cantidad, stock mínimo, stock máximo, stock de seguridad, lead time, fecha de entrada, fecha de salida, estado, id de la tienda, id del proveedor, fecha de vencimiento, frecuencia de compra en días, costo de compra, clasificación ABC, precio original y fecha fin de promoción.  
* **Un movimiento de stock tiene:** id, id del producto, tipo de movimiento, cantidad, stock final, fecha del movimiento, observación, id de usuario e id de la tienda.  
* **Una venta tiene:** id, id del vendedor, id de la tienda, fecha de salida y precio total.  
* **Una venta de producto tiene:** id, id de la venta, id del producto, cantidad y precio unitario.  
* **Una orden de compra tiene:** id, id de la tienda, id del proveedor, id del usuario, fecha de creación, fecha de aprobación, estado, total estimado, presupuesto total, monto pagado, estado de pago, riesgo, notas y observaciones.  
* **Una orden detalle tiene:** id del detalle, id de la orden, id del producto, cantidad sugerida, cantidad final, costo unitario y sugerencia de la IA.  
* **Una alerta tiene:** id, id del producto, id de la tienda, tipo, severidad, mensaje, fecha de creación, resuelta, fecha de resolución y datos\_json.  
* **Una auditoría de IA tiene:** id, fecha de auditoría, id de la tienda, id de la orden, motor de IA, prompt utilizado, datos base en JSON, sugerencia de IA en JSON, impacto de la decisión y razón de la IA.  
* **Un feedback de la IA tiene:** id, id de la orden, id del producto, cantidad sugerida, ventas reales por periodo, factor de precisión y fecha de evaluación.  
* **Un historial de precios tiene:** id, id del producto, precio anterior, precio nuevo, fecha de cambio y motivo.  
* **Un reporte tiene:** id, título, descripción, fecha del reporte, creador, tipo, id de la tienda, fecha de inicio, fecha de fin y creado en.  
* **Una caché de IA tiene:** clave, data\_hash, datos en JSON y fecha de actualización.

# **Atributos /  campos**

| Entidad | Atributos | Tipo de dato |
| :---: | ----- | ----- |
| **Tienda** | id\_tienda | int |
|  | nombre\_establecimiento | varchar |
|  | direccion | varchar |
|  | anio\_creacion | int |
|  | estado | varchar |
|  | documento | varchar |
|  | razon\_social | varchar |
|  | celular | varchar |
|  | ciudad | varchar |
| **Usuarios** | id\_usuario | int |
|  | nombres | varchar |
|  | genero | varchar |
|  | correo | varchar |
|  | celular | varchar |
|  | rol | varchar |
|  | usuario | varchar |
|  | contrasena | varchar |
|  | fecha\_registro | timestamp |
|  | id\_tienda | int |
|  | session\_id | varchar |
|  | foto\_url | text |
|  | cambio\_clave\_forzoso | boolean |
|  | reset\_token | varchar |
|  | reset\_expires | varchar |
| **Proveedores** | id\_proveedor | int |
|  | nombre\_empresa | varchar |
|  | nit | varchar |
|  | contacto\_nombre | varchar |
|  | contacto\_principal | varchar |
|  | telefono | varchar |
|  | correo | varchar |
|  | email | varchar |
|  | direccion | text |
|  | id\_tienda | int |
|  | estado | varchar |
|  | fecha\_registro | timestamp |
| **Productos** | id\_producto | int |
|  | codigo | varchar |
|  | nombre\_producto | varchar |
|  | categoria | varchar |
|  | subcategoria | varchar |
|  | tipo\_producto | varchar |
|  | precio | numeric |
|  | cantidad | int |
|  | stock\_minimo | int |
|  | stock\_maximo | int |
|  | stock\_seguridad | int |
|  | lead\_time | int |
|  | fecha\_entrada | date |
|  | fecha\_salida | timestamp |
|  | estado | varchar |
|  | id\_tienda | int |
|  | id\_proveedor | int |
|  | fecha\_vencimiento | date |
|  | frecuencia\_compra\_dias | int |
|  | costo\_compra | numeric |
|  | clasificacion\_abc | varchar |
|  | precio\_original | numeric |
|  | fecha\_fin\_promocion | date |
| **MovimientosStock** | id\_movimiento | int |
|  | id\_producto | int |
|  | tipo\_movimiento | varchar |
|  | cantidad | int |
|  | stock\_final | int |
|  | fecha\_movimiento | timestamp |
|  | observacion | text |
|  | id\_usuario | int |
|  | id\_tienda | int |
| **Ventas** | id\_venta | int |
|  | id\_vendedor | int |
|  | id\_tienda | int |
|  | fecha\_salida | timestamp |
|  | precio\_total | numeric |
| **VentasProductos** | id | int |
|  | id\_venta | int |
|  | id\_producto | int |
|  | cantidad | int |
|  | precio\_unitario | numeric |
| **Ordenes\_Compra** | id\_orden | int |
|  | id\_tienda | int |
|  | id\_proveedor | int |
|  | id\_usuario | int |
|  | fecha\_creacion | timestamp |
|  | fecha\_aprobacion | timestamp |
|  | estado | varchar |
|  | total\_estimado | numeric |
|  | presupuesto\_total | numeric |
|  | monto\_pagado | numeric |
|  | estado\_pago | varchar |
|  | riesgo | varchar |
|  | notas | text |
|  | observaciones | text |
| **Ordenes\_Detalle** | id\_detalle | int |
|  | id\_orden | int |
|  | id\_producto | int |
|  | cantidad\_sugerida | int |
|  | cantidad\_final | int |
|  | costo\_unitario | numeric |
|  | sugerencia\_ia | int |
| **Alertas** | id\_alerta | int |
|  | id\_producto | int |
|  | id\_tienda | int |
|  | tipo | varchar |
|  | severidad | varchar |
|  | mensaje | text |
|  | fecha\_creacion | timestamp |
|  | resuelta | int |
|  | fecha\_resolucion | timestamp |
|  | datos\_json | text |
| **Auditoria\_IA** | id\_auditoria | int |
|  | fecha\_auditoria | timestamp |
|  | id\_tienda | int |
|  | id\_orden | int |
|  | motor\_ia | varchar |
|  | prompt\_utilizado | text |
|  | datos\_base\_json | text |
|  | sugerencia\_ia\_json | text |
|  | impacto\_decision | text |
|  | razon\_ia | text |
| **Feedback\_IA** | id\_feedback | int |
|  | id\_orden | int |
|  | id\_producto | int |
|  | cantidad\_sugerida | int |
|  | ventas\_reales\_periodo | int |
|  | factor\_precision | numeric |
|  | fecha\_evaluacion | timestamp |
| **Historial\_Precios** | id | int |
|  | id\_producto | int |
|  | precio\_anterior | numeric |
|  | precio\_nuevo | numeric |
|  | fecha\_cambio | timestamp |
|  | motivo | text |
| **Reportes** | id | int |
|  | titulo | varchar |
|  | descripcion | text |
|  | fecha\_reporte | date |
|  | creador | varchar |
|  | tipo | varchar |
|  | id\_tienda | int |
|  | fecha\_inicio | date |
|  | fecha\_fin | date |
|  | creado\_en | timestamp |
| **Cache\_IA** | clave | varchar |
|  | data\_hash | varchar |
|  | datos\_json | text |
|  | actualizado\_at | timestamp |

# **Identificación de verbos**

A continuación se relacionan los verbos encontrados en cada requerimiento funcional

| ID | Verbos / acciones identificadas | ID | Verbos / acciones identificadas |
| ----- | ----- | ----- | ----- |
| **RF-001** | permitir, iniciar sesión, asignar | **RF-032** | clasificar, establecer |
| **RF-002** | permitir, registrar, proporcionar | **RF-033** | almacenar, confirmar, corresponder |
| **RF-003** | permitir, recuperar, verificar, enviar | **RF-034** | permitir, consultar, visualizar, ajustar |
| **RF-004** | restringir, iniciar sesión | **RF-035** | generar, cubrir, estimar, abastecer |
| **RF-005** | permitir, actualizar | **RF-036** | generar, establecer, reponer |
| **RF-006** | almacenar | **RF-037** | generar, considerar, vencer, vender |
| **RF-007** | impedir, mantener | **RF-038** | generar, identificar, definir |
| **RF-008** | solicitar, cambiar, iniciar sesión, crear | **RF-039** | permitir, filtrar, marcar, resolver |
| **RF-009** | permitir, crear, consultar, actualizar, eliminar | **RF-040** | presentar, relacionar |
| **RF-010** | permitir, registrar | **RF-041** | presentar, generar, indicar, disponer |
| **RF-011** | clasificar | **RF-042** | presentar, seleccionar |
| **RF-012** | registrar, permitir, realizar | **RF-043** | mostrar, agotar, estimar, vencer |
| **RF-013** | presentar | **RF-044** | calcular, establecer |
| **RF-014** | permitir, registrar, asociar | **RF-045** | permitir, comparar, presentar, variar |
| **RF-015** | actualizar, confirmar | **RF-046** | permitir, generar, relacionar |
| **RF-016** | mostrar | **RF-047** | permitir, consultar, modificar, eliminar, solicitar, confirmar |
| **RF-017** | permitir, consultar, filtrar, buscar | **RF-048** | permitir, exportar, seleccionar |
| **RF-018** | permitir, registrar, indicar | **RF-049** | informar, existir, seleccionar, generar |
| **RF-019** | actualizar, registrar | **RF-050** | permitir, generar, asociar, incluir |
| **RF-020** | permitir, administrar, pertenecer | **RF-051** | permitir, crear, consultar, actualizar, eliminar |
| **RF-021** | mantener, separar | **RF-052** | permitir, asociar, facilitar, gestionar |
| **RF-022** | calcular | **RF-053** | permitir, registrar, consultar, actualizar, eliminar |
| **RF-023** | permitir, establecer | **RF-054** | restringir, administrar, contar |
| **RF-024** | identificar, comparar | **RF-055** | permitir, establecer, calcular |
| **RF-025** | estimar, basarse | **RF-056** | permitir, establecer, generar, ajustar |
| **RF-026** | calcular, usar | **RF-057** | permitir, convertir, aprobar |
| **RF-027** | generar, ajustar, analizar | **RF-058** | comparar, determinar, recomendar, reabastecer, adaptar |
| **RF-028** | registrar, generar, utilizar | **RF-059** | almacenar, utilizar |
| **RF-029** | generar, sugerir, identificar, priorizar | **RF-060** | presentar, generar |
| **RF-030** | permitir, modificar, sugerir, confirmar | **RF-061** | enviar, resumir |
| **RF-031** | permitir, incluir, excluir | **RF-062** | permitir, solicitar, enviar |

# **Relaciones y procesos**

| Relaciones | Procesos |
| ----- | ----- |
| Tienda \- Reportes | Proceso de generación y consulta de reportes de la tienda.  |
| Tienda \- Usuarios | Proceso de autenticación y control de acceso.  |
| Tienda \- Ventas | Proceso de gestión y registro de ventas de la tienda.  |
| Tienda \- MovimientosStock | Proceso de control de movimientos de inventario de la tienda.  |
| Tienda \- Productos | Proceso de gestión y control de productos de la tienda.  |
| Tienda \- Proveedores | Proceso de gestión de proveedores y abastecimiento de la tienda.  |
| Tienda \- Ordenes\_Compra | Proceso de gestión y seguimiento de órdenes de compra.  |
| Tienda \- Alertas | Proceso de generación y gestión de alertas de la tienda.  |
| Tienda \- Auditoria\_IA | Proceso de auditoría y seguimiento de las recomendaciones generadas por IA.  |
| Usuarios \- MovimientosStock | Proceso de registro y control del usuario responsable de los movimientos de inventario.  |
| Usuarios \- Ventas | Proceso de registro y control del usuario responsable de las ventas.  |
| Usuarios \- Ordenes\_Compra | Proceso de gestión de órdenes de compra por parte de los usuarios autorizados.  |
| Proveedores \- Productos | Proceso de asociación y gestión de productos por proveedor.  |
| Proveedores \- Ordenes\_Compra | Proceso de abastecimiento y generación de órdenes de compra a proveedores.  |
| Productos \- MovimientosStock | Proceso de Kárdex y auditoría de inventario.  |
| Productos \- VentasProductos | Proceso de facturación y salida de mercancía.  |
| Productos \- Ordenes\_Detalle | Proceso de detalle y planificación de productos para órdenes de compra.  |
| Productos \- Historial\_Precios | Proceso de registro y seguimiento histórico de precios de los productos.  |
| Productos \- Feedback\_IA | Proceso de evaluación de la precisión de las recomendaciones de reabastecimiento.  |
| Productos \- Alertas | Proceso de monitoreo y generación de alertas asociadas a productos.  |
| Ordenes\_Compra \- Ordenes\_Detalle | Proceso de composición y gestión del detalle de las órdenes de compra.  |
| Ordenes\_Compra \- Feedback\_IA | Proceso de reabastecimiento inteligente. |
| Ordenes\_Compra \- Auditoria\_IA | Proceso de auditoría y trazabilidad de las recomendaciones de IA aplicadas a las órdenes de compra.  |
| Ventas \- VentasProductos | Proceso de detalle de productos asociados a las ventas.  |

# **Cardinalidades**

| Relaciones | Cardinalidad |
| ----- | ----- |
| Tienda \- Reportes | Tienda (1) \- (N) Reportes (Una tienda tiene muchos reportes). |
| Tienda \- Usuarios | Tienda (1) \- (N) Usuarios (Una tienda tiene muchos usuarios). |
| Tienda \- Ventas | Tienda (1) \- (N) Ventas (Una tienda tiene muchas ventas). |
| Tienda \- MovimientosStock | Tienda (1) \- (N) MovimientosStock (Una tienda tiene muchos movimientos de stock) |
| Tienda \- Productos | Tienda (1) \- (N) Productos (Una tienda tiene muchos productos). |
| Tienda \- Proveedores | Tienda (1) \- (N) Proveedores (Una tienda tiene muchos proveedores). |
| Tienda \- Ordenes\_Compra | Tienda (1) \- (N) Ordenes\_Compra (Una tienda tiene muchas órdenes de compra). |
| Tienda \- Alertas | Tienda (1) \- (N) Alertas (Una tienda tiene muchas alertas). |
| Tienda \- Auditoria\_IA | Tienda (1) \- (N) Auditoria\_IA (Una tienda tiene muchas auditorías de la IA). |
| Usuarios \- MovimientosStock | Usuario (1) \- (N) MovimientosStock (Un usuario tiene muchos movimientos de stock) |
| Usuarios \- Ventas | Usuario (1) \- (N) Ventas (Un usuario puede generar muchas ventas) |
| Usuarios \- Ordenes\_Compra | Usuario (1) \- (N) Ordenes\_Compra (Un usuario puede emitir muchas órdenes de compra) |
| Proveedores \- Productos | Proveedor (1) \- (N) Productos (Un proveedor puede proveer muchos productos) |
| Proveedores \- Ordenes\_Compra | Proveedor (1) \- (N) Ordenes\_Compra (Un proveedor puede registrarse en muchas órdenes de compra) |
| Productos \- MovimientosStock | Producto (1) \- (N) MovimientosStock (Un producto puede tener muchos movimientos de stock) |
| Productos \- VentasProductos | Producto (1) \- (N) VentasProductos (Un producto puede estar en muchas ventas). |
| Productos \- Ordenes\_Detalle | Producto (1) \- (N) Ordenes\_Detalle (Un producto puede estar en muchos detalles de la orden) |
| Productos \- Historial\_Precios | Producto (1) \- (N) Historial\_Precios (Un producto puede tener muchos historiales de precio) |
| Productos \- Feedback\_IA | Producto (1) \- (N) Feedback\_IA (Un producto puede tener muchas retroalimentaciones de la IA) |
| Productos \- Alertas | Producto (1) \- (N) Alertas (Un producto puede tener muchas alertas) |
| Ordenes\_Compra \- Ordenes\_Detalle | Orden\_Compra  (1) \- (N) Ordenes\_Detalle (Una orden de compra puede estar en muchos detalles de la orden) |
| Ordenes\_Compra \- Feedback\_IA | Orden\_Compra (1) \- (N) Feedback\_IA (Una orden es retroalimentada por muchos registros de IA). |
| Ordenes\_Compra \- Auditoria\_IA | Orden\_Compra (1) \- (N) Auditoria\_IA (Una orden es auditada por muchos registros de IA). |
| Ventas \- VentasProductos | Venta (1) \- (N) VentasProductos (Una venta tiene muchos detalles). |

# **Claves primarias y foráneas**

| Claves primarias (Primary Key) |  |
| ----- | ----- |
| **Tabla donde aparece** | **Primary Key** |
| **Tienda** | id\_tienda |
| **Usuarios** | id\_usuario |
| **Proveedores** | id\_proveedor |
| **Productos** | id\_producto |
| **Ordenes\_Compra** | id\_orden |
| **Ventas** | id\_venta |
| **MovimientosStock** | id\_movimiento |
| **VentasProductos** | id |
| **Ordenes\_Detalle** | id\_detalle |
| **Historial\_Precios** | id |
| **Feedback\_IA** | id\_feedback |
| **Alertas** | id\_alerta |
| **Auditoria\_IA** | id\_auditoria |
| **Reportes** | id |
| **Cache\_IA** | clave |

| Claves foráneas (Foreign Key) |  |
| ----- | ----- |
| **Tabla donde aparece** | **Foreign Key** |
| **Usuarios** | id\_tienda |
| **Proveedores** | id\_tienda |
| **Productos** | id\_tienda |
|  | id\_proveedor |
| **Ordenes\_Compra** | id\_tienda |
|  | id\_proveedor  |
|  | id\_usuario |
| **Ventas** | id\_vendedor  |
|  | id\_tienda |
| **MovimientosStock** | id\_producto |
|  | id\_usuario  |
|  | id\_tienda |
| **VentasProductos** | id\_venta  |
|  | id\_producto |
| **Ordenes\_Detalle** | id\_orden  |
|  | id\_producto |
| **Historial\_Precios** | id\_producto |
| **Feedback\_IA** | id\_orden |
|  | id\_producto |
| **Alertas** | id\_producto |
|  | id\_tienda |
| **Auditoria\_IA** | id\_tienda |
|  | id\_orden |
| **Reportes** | id\_tienda |

# **Dependencias funcionales**

Las dependencias funcionales principales del modelo se establecen a partir de las claves primarias de cada entidad. En términos generales, cada clave primaria determina los demás atributos de su correspondiente entidad.

| Tabla | Dependencias funcionales |
| ----- | ----- |
| Tienda | **id\_tienda** → nombre\_establecimiento, direccion, anio\_creacion, estado, documento, razon\_social, celular, ciudad |
| Usuarios | **id\_usuario** → id\_tienda, nombres, genero, correo, celular, rol, usuario, contrasena, fecha\_registro, session\_id, foto\_url, cambio\_clave\_forzoso, reset\_token, reset\_expires |
| Proveedores | **id\_proveedor** → id\_tienda, nombre\_empresa, nit, contacto\_nombre, contacto\_principal, telefono, correo, email, direccion, estado, fecha\_registro |
| Productos | **id\_producto** → id\_tienda, id\_proveedor, codigo, nombre\_producto, categoria, subcategoria, tipo\_producto, precio, cantidad, stock\_minimo, stock\_maximo, stock\_seguridad, lead\_time, fecha\_entrada, fecha\_salida, estado, fecha\_vencimiento, frecuencia\_compra\_dias, costo\_compra, clasificacion\_abc, precio\_original, fecha\_fin\_promocion |
| Ordenes\_Compra | **id\_orden** → id\_tienda, id\_proveedor, id\_usuario, fecha\_creacion, fecha\_aprobacion, estado, total\_estimado, presupuesto\_total, monto\_pagado, estado\_pago, riesgo, notas, observaciones |
| Ventas | **id\_venta** → id\_vendedor, id\_tienda, fecha\_salida, precio\_total |
| MovimientosStock | **id\_movimiento** → id\_producto, id\_usuario, id\_tienda, tipo\_movimiento, cantidad, stock\_final, fecha\_movimiento, observacion |
| VentasProductos | **id** → id\_venta, id\_producto, cantidad, precio\_unitario |
| Ordenes\_Detalle | **id\_detalle** → id\_orden, id\_producto, cantidad\_sugerida, cantidad\_final, costo\_unitario, sugerencia\_ia |
| Historial\_Precios | **id** → id\_producto, precio\_anterior, precio\_nuevo, fecha\_cambio, motivo |
| Feedback\_IA | **id\_feedback** → id\_orden, id\_producto, cantidad\_sugerida, ventas\_reales\_periodo, factor\_precision, fecha\_evaluacion |
| Alertas | **id\_alerta** → id\_producto, id\_tienda, tipo, severidad, mensaje, fecha\_creacion, resuelta, fecha\_resolucion, datos\_json |
| Auditoria\_IA | **id\_auditoria** → id\_tienda, id\_orden, fecha\_auditoria, motor\_ia, prompt\_utilizado, datos\_base\_json, sugerencia\_ia\_json, impacto\_decision, razon\_ia |
| Reportes | **id** → titulo, descripcion, fecha\_reporte, creador, tipo, id\_tienda, fecha\_inicio, fecha\_fin, creado\_en |
| Cache\_IA | **clave** → data\_hash, datos\_json, actualizado\_at |

Estas dependencias permiten identificar que los atributos pertenecientes a una entidad dependen de su identificador correspondiente y no de atributos no clave de otras entidades.

# **Normalización**

La normalización de la base de datos tiene como objetivo organizar las entidades y sus atributos de manera que se reduzca la redundancia de información y se eviten problemas de inserción, actualización y eliminación de datos. Para este modelo se aplican las tres primeras formas normales: Primera Forma Normal (1FN), Segunda Forma Normal (2FN) y Tercera Forma Normal (3FN).

Primera Forma Normal (1FN)

La base de datos cumple con la **Primera Forma Normal** debido a que cada atributo contiene valores atómicos, es decir, cada campo almacena un único valor y no existen grupos repetitivos dentro de una misma entidad.

Las entidades se encuentran separadas de acuerdo con su función dentro del sistema. Por ejemplo, la información de las tiendas se almacena en **Tienda**, los usuarios en **Usuarios**, los productos en **Productos**, los proveedores en **Proveedores**, las ventas en **Ventas** y los movimientos de inventario en **MovimientosStock**.

De igual manera, las relaciones que pueden contener múltiples registros se manejan mediante entidades independientes. Por ejemplo, **VentasProductos** permite almacenar los diferentes productos asociados a una venta, mientras que **Ordenes\_Detalle** permite almacenar los productos incluidos en una orden de compra.

Por lo tanto, cada atributo posee un dominio definido y no se almacenan múltiples valores dentro de un mismo campo.

Segunda Forma Normal (2FN)

La Segunda Forma Normal establece que la relación debe encontrarse previamente en 1FN y que todos los atributos que no forman parte de la clave primaria deben depender completamente de dicha clave.

En el modelo propuesto, las entidades utilizan identificadores únicos como claves primarias, por ejemplo:

1. **Tienda:** id\_tienda  
2. **Usuarios:** id\_usuario  
3. **Proveedores:** id\_proveedor  
4. **Productos:** id\_producto  
5. **Ordenes\_Compra:** id\_orden  
6. **Ventas:** id\_venta  
7. **MovimientosStock:** id\_movimiento  
8. **VentasProductos:** id  
9. **Ordenes\_Detalle:** id\_detalle  
10. **Historial\_Precios:** id  
11. **Feedback\_IA:** id\_feedback  
12. **Alertas:** id\_alerta  
13. **Auditoria\_IA:** id\_auditoria  
14. **Reportes:** id  
15. **Cache\_IA:** clave

Al utilizar una clave primaria simple en cada entidad, los atributos no clave dependen de la totalidad de la clave primaria correspondiente. Por ejemplo, en **Productos**, los atributos **codigo**, **nombre\_producto**, **precio**, **cantidad** y **stock\_minimo** dependen de **id\_producto**.

De igual forma, en **VentasProductos**, los atributos **cantidad** y **precio\_unitario** dependen del registro identificado por **id**, mientras que **id\_venta** e **id\_producto** permiten establecer la relación entre la venta y el producto.

Por lo anterior, no se presentan dependencias parciales respecto de claves primarias compuestas.

Tercera Forma Normal (3FN)

La Tercera Forma Normal establece que la relación debe encontrarse en 2FN y que los atributos que no son clave no deben depender transitivamente de la clave primaria.

Para cumplir esta condición, la información correspondiente a cada entidad se mantiene separada. Por ejemplo, los datos propios de una tienda se almacenan en **Tienda**, mientras que los usuarios solamente mantienen la referencia mediante **id\_tienda**. De esta manera, no es necesario almacenar nuevamente el nombre o los demás datos de la tienda dentro de **Usuarios**.

De forma similar, **Productos** mantiene las referencias **id\_tienda** e **id\_proveedor** mediante claves foráneas, pero los datos propios de la tienda y del proveedor permanecen en sus respectivas entidades.

Esta separación permite evitar la duplicación de información y facilita las operaciones de actualización. Por ejemplo, si se modifica el nombre de una tienda, el cambio se realiza únicamente en la entidad Tienda y no en cada uno de los registros de Usuarios, Productos, Ventas u otras entidades relacionadas.

Resultado de la normalización

Como resultado, el modelo presenta una estructura organizada en entidades independientes relacionadas mediante claves primarias y foráneas. La aplicación de 1FN garantiza la atomicidad de los atributos, la 2FN evita dependencias parciales y la 3FN reduce las dependencias transitivas.

La normalización permite mantener la consistencia de la información y disminuir la redundancia, facilitando la gestión de productos, usuarios, proveedores, ventas, inventario, órdenes de compra, alertas y los componentes de análisis mediante IA.

# **Modelo Entidad-Relación**

[Modelo Entidad-Relación](https://mermaid.live/edit#pako:eNqtV11r2zAU_StBz2mJs3wtb6WlbJSxwj4eRsDcWEoialtGlszWNP99V47d2c6V05QF-mDdc6Sjc--V1D2LFBdsyVZ6lbo_oe8kbDUk7mOAv-9SpBwGLy9XV2o_-JFb0FLlg-VgxQyGxIrRyEetCiO40uJtYG4jU81bYMgL_aIKmeAIgr8ZFT2VDC22MjcafKSfiIe8gkIsn73Ir5qjzjy8VUmmoWRsccA_9U0sdD33GaTl0igtIfx8U8LBDXjhWmRKm8o9kUhTWVKjX1PRZ8wOooaTXUrDlo7nXSRhC2TaijW0RTWzTuY2KwH_FiIIxFpaRHItTpaq5u0zILcb3V6uTTpa0NYo0yi2kqtQpD3MWuadMBDH4riaimWEOT3H7SuaE_A9-rOG6KkuG1FAbM8u8QkbwhVbHD46905btmZWReBoL7QfkUoJXidNFZ9ypc33cP0NwiHETjhH9rjU4HbabF9_u59MzUDy0BxDjw_NWAE62oEepCpZaxGK3MA6RkuPtUYhHYSTEa4imzRpB7KlKW32GOwVl1OhSGktSDVaxdRwtZLfn_sHUn6zl6kdZHX8jMGYVpEDiZDmPaqqWvZoKqMeSXg7yq3qEVvzm5AUU6xlNMjKxusuGgF2AwfeHc_dmRUmMpXJm6wnjfV4cHI0UlYkryCPGUZmqoF668aaLpPy68omg_3JrQ4vajuFC3V20s5MaBQeUjSVd-y8UFFv0XVE-bzriLVY_J62PG7VVxpd5w89pzhlpHIQT0mcnnS16tJbd1jKpIN4Z0H3Fgy5p_oOojbFq5g_FWFut7gTDl5L3mV4ffVToqCM9XQfNZ6LopR5ed_1F3LrNibV1gCP4ERhNJRwYe673rZENW95StOmihN5LZskD937H2sjQ88UXbkbiJzwsu1yqdL_m__Td9n5E6JzEmCBOvW6B5JaUagL1LEh22IRsaXBR_2Q4VwJuE-2dyB8N-5Ugu8397DiYgM2NvimSg9IyyD9pVRSM7Wy2x1bbiDO8ctmHIyo_qN8hbjTVd8qmxq2DOazUTkJW-7Zb_wOguvReDpdTOaTWTBeBNMh-8OWs-B6FkxG49ni4-hDMJ4chuy5XHV0Pfs4mTjwbDodzefzxeEvNkTOyQ)  
