# Casos De Uso

**Proyecto:** StockPilot — Sistema de Gestión de Inventario Inteligente  
**Versión:** 2026  
**Última Actualización:** 23 de Septiembre de 2026 (revisión y corrección post unificación del motor de riesgo — plan 17/18)

---

## Paquete CU-01: Autenticación y Gestión de Usuarios

---

### CU-01.1 — Iniciar Sesión

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador, Colaborador                       |
| **Precondiciones** | El usuario debe estar registrado en el sistema   |
| **RF Relacionados**| RF-001, RF-004, RF-006, RF-061                   |

**Flujo Principal:**

1. El usuario accede a la página de login.
2. Ingresa su usuario/matrícula y contraseña.
3. Selecciona el rol operativo (Administrador o Colaborador).
4. Presiona "Ingresar al Sistema".
5. El sistema valida las credenciales contra el hash bcrypt almacenado.
6. Si no existe sesión activa previa para ese usuario, el sistema crea una nueva sesión del lado del servidor y redirige al Dashboard.
7. El sistema registra el ID de sesión en la tabla Usuarios (`session_id`).

**Flujos Alternativos:**

- **FA-1:** Credenciales incorrectas → El sistema muestra un toast de error sin revelar cuál dato falló.
- **FA-2:** Usuario selecciona "¿Olvidaste tu contraseña?" → Se redirige a CU-01.3.
- **FA-3:** Usuario selecciona "Volver al Inicio" → Se redirige a la Landing Page.
- **FA-4:** Ya existe una sesión activa para ese usuario en otro dispositivo → El sistema retorna el código `SESSION_ACTIVE`; el nuevo dispositivo muestra un aviso de conflicto con botón "Cerrar otra sesión e ingresar aquí". Si el usuario confirma (flag `force=true`), la sesión anterior se invalida y el dispositivo desplazado recibe "Has iniciado sesión en otro dispositivo" en su próxima solicitud.

**Postcondiciones:** Sesión activa creada; sesión anterior invalidada solo si el usuario eligió forzar el acceso; usuario redirigido al Dashboard.

---

### CU-01.2 — Registrar Usuario y Negocio

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Usuario no registrado                            |
| **Precondiciones** | Ninguna                                          |
| **RF Relacionados**| RF-002, RF-006                                   |

**Flujo Principal:**

1. El usuario accede al formulario de registro desde la Landing Page o el Login.
2. Completa datos personales: nombres, usuario, celular, correo electrónico.
3. Completa datos del negocio: nombre de tienda, dirección (opcional).
4. Ingresa y confirma la contraseña.
5. Presiona "Crear Mi Cuenta".
6. El sistema valida que no exista duplicado de usuario/correo.
7. El sistema almacena la contraseña con hash bcrypt y crea la tienda asociada.
8. Redirige al login.

**Flujos Alternativos:**

- **FA-1:** Usuario o correo duplicado → El sistema muestra error específico.
- **FA-2:** Contraseñas no coinciden → Validación en frontend impide envío.

**Postcondiciones:** Cuenta creada; tienda asociada registrada.

---

### CU-01.3 — Recuperar Contraseña

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Usuario registrado                               |
| **Precondiciones** | El usuario debe tener correo registrado           |
| **RF Relacionados**| RF-003                                           |

**Flujo Principal:**

1. El usuario accede a "¿Olvidaste tu contraseña?" desde el login.
2. Ingresa su correo electrónico.
3. El sistema envía un código de verificación de 6 dígitos al correo.
4. El usuario ingresa el código recibido.
5. El sistema valida el código y su vigencia (15 minutos).
6. El usuario ingresa y confirma la nueva contraseña.
7. El sistema actualiza el hash almacenado.

**Flujos Alternativos:**

- **FA-1:** Correo no registrado → El sistema responde genéricamente por seguridad ("Si el correo existe, se ha enviado un código").
- **FA-2:** Código incorrecto o expirado → Se permite reintentar.

**Postcondiciones:** Contraseña actualizada.

---

### CU-01.4 — Gestionar Perfil de Usuario

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador, Colaborador                       |
| **Precondiciones** | Sesión activa                                    |
| **RF Relacionados**| RF-005                                           |

**Flujo Principal:**

1. El usuario navega a la sección "Perfil".
2. Edita sus datos: nombre, género, correo, celular, nombre de usuario, foto de perfil (upload/cámara en Base64).
3. Presiona "Guardar Cambios".
4. El sistema actualiza los datos en la base de datos.

**Postcondiciones:** Datos del perfil actualizados.

---

### CU-01.5 — Gestionar Colaboradores

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa con rol Administrador               |
| **RF Relacionados**| RF-050, RF-051, RF-062                           |

**Flujo Principal:**

1. El administrador navega al módulo "Registro Colaborador".
2. Completa el formulario: nombres, género, correo, celular, usuario, contraseña temporal.
3. Presiona "Registrar Empleado".
4. El sistema crea el usuario con rol Colaborador asociado a la tienda del admin, con bandera de cambio de clave forzoso activada.

**Flujos Alternativos:**

- **FA-1:** Editar colaborador existente → Se precarga el formulario y se actualiza.
- **FA-2:** Eliminar colaborador → Modal de confirmación → Se elimina.
- **FA-3:** Acceso sin rol admin → Redirección al Dashboard.
- **FA-4:** Primer login del colaborador → El sistema fuerza el cambio de contraseña antes de acceder al Dashboard.

**Postcondiciones:** Colaborador registrado/actualizado/eliminado; contraseña temporal asignada.

---

## Paquete CU-02: Gestión de Inventario

---

### CU-02.1 — Gestionar Productos (CRUD)

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador, Colaborador                       |
| **Precondiciones** | Sesión activa; al menos una tienda registrada     |
| **RF Relacionados**| RF-007, RF-008, RF-009, RF-010, RF-076           |

**Flujo Principal:**

1. El usuario navega al módulo "Productos".
2. Visualiza la tabla de productos con filtros por categoría y búsqueda; cada fila muestra su nivel de stock (agotado, crítico, por reponer o suficiente) calculado por el motor de reposición único.
3. Para **crear**: completa el formulario (código, nombre, categoría, subcategoría, precio, costo, cantidad, stock mínimo, stock máximo, fecha vencimiento, frecuencia compra, stock seguridad, lead time, proveedor) y presiona "Agregar".
   - *Nota:* Al ingresar el código de barras, el sistema realiza una consulta automática a bases de datos externas (ej. Open Food Facts) para autocompletar el nombre y categoría si el producto existe globalmente.
4. Para **editar**: selecciona un producto → se precargan los datos → edita → "Guardar".
5. Para **eliminar**: selecciona el producto → modal de confirmación → confirma.
6. El sistema recalcula la clasificación ABC automáticamente tras cada cambio.

**Flujos Alternativos:**

- **FA-1:** Producto existente al crear → Si el sistema detecta (mediante búsqueda predictiva o escáner) que el producto ya está en base de datos, el formulario cambia dinámicamente al modo "Recepción de Inventario" para sumar stock, evitando duplicados.

**Postcondiciones:** Producto creado/actualizado/eliminado o stock sumado; clasificación ABC recalculada.

---

### CU-02.2 — Registrar Movimiento de Inventario

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador, Colaborador                       |
| **Precondiciones** | Sesión activa; producto existente                 |
| **RF Relacionados**| RF-016, RF-017                                   |

**Flujo Principal:**

1. El usuario navega al módulo "Movimientos" (Kardex).
2. Lee las instrucciones del modal de ayuda para confirmar que su operación no es una venta (merma, entrada de proveedor, ajuste).
3. Registra un movimiento: tipo (Entrada/Salida/Ajuste), producto, cantidad, motivo.
4. Presiona "Registrar".
5. El sistema actualiza el stock actual del producto en tiempo real.
6. El movimiento queda trazado con fecha, usuario responsable (quién lo ejecutó) y tipo.

**Flujos Alternativos:**

- **FA-1:** Salida mayor al stock actual → El sistema impide la operación.

**Postcondiciones:** Stock actualizado; movimiento administrativo/manual registrado con trazabilidad.

---

### CU-02.3 — Gestionar Establecimiento

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa con rol Administrador               |
| **RF Relacionados**| RF-018, RF-019                                   |

**Flujo Principal:**

1. El administrador navega al módulo "Establecimiento".
2. Visualiza los datos del negocio registrado: nombre, dirección, razón social, documento, ciudad y celular de contacto.
3. Puede editar cualquiera de esos campos y guardar los cambios.
4. Todos los datos del sistema (productos, ventas, alertas, reportes) operan aislados dentro del contexto de este establecimiento.

**Flujos Alternativos:**

- **FA-1:** Campos inválidos o vacíos → El sistema muestra error de validación sin guardar.

**Postcondiciones:** Datos del establecimiento actualizados; aislamiento de datos garantizado por sesión.

---

### CU-02.4 — Visualizar Clasificación ABC

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa; productos con historial de ventas  |
| **RF Relacionados**| RF-009, RF-011                                   |

**Flujo Principal:**

1. El usuario navega al módulo "Análisis Detallado".
2. Visualiza la tabla con todos los productos clasificados (A, B, C) con su nivel de riesgo, velocidad de venta, stock actual vs. mínimo, proyección de agotamiento e ingresos.
3. En el Centro Analítico, visualiza gráficos de barras Pareto (ingresos + % acumulado) y donut de distribución porcentual por clase ABC.

**Postcondiciones:** Información analítica presentada al usuario.

---

## Paquete CU-03: Ventas y Reportes

---

### CU-03.1 — Registrar Venta

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador, Colaborador                       |
| **Precondiciones** | Sesión activa; productos con stock > 0            |
| **RF Relacionados**| RF-012, RF-013, RF-015, RF-065                   |

**Flujo Principal:**

1. El usuario navega al módulo "Punto de Venta" (Caja Rápida).
2. Busca y selecciona los productos a vender utilizando búsqueda predictiva por texto, o mediante escaneo de código de barras (con cámara o pistola láser).
3. Indica la cantidad de cada producto en el carrito.
4. Presiona "Cobrar" y selecciona el método de pago.
5. El sistema descuenta automáticamente las cantidades del inventario.
6. La venta queda registrada con fecha, productos, cantidades, monto total y el **usuario vendedor** que realizó la transacción.
7. El usuario puede consultar el historial completo de ventas en la pestaña contigua "Historial", visualizando al vendedor responsable de cada transacción.

**Flujos Alternativos:**

- **FA-1:** Cantidad solicitada > stock disponible → Error; operación rechazada.

**Postcondiciones:** Venta registrada con trazabilidad de vendedor; stock descontado automáticamente; historial consultable con filtros.

---

### CU-03.2 — Consultar Top Ventas

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador, Colaborador                       |
| **Precondiciones** | Sesión activa; historial de ventas existente      |
| **RF Relacionados**| RF-014                                           |

**Flujo Principal:**

1. El usuario presiona "🏆 Top Ventas" en el módulo Ventas.
2. El sistema calcula y muestra un ranking de productos ordenados por cantidad vendida e ingresos.
3. El resultado se presenta en un modal con datos agregados.

**Postcondiciones:** Información de ranking presentada.

---

### CU-03.3 — Gestionar Reportes

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa                                    |
| **RF Relacionados**| RF-044, RF-045, RF-047                           |

**Flujo Principal:**

1. El usuario navega al módulo "Reportes".
2. Completa el formulario: título, clasificación (Inventario/Ventas/Financiero/Operativo), fecha de emisión, rango de evaluación, comentarios.
3. Presiona "Emitir Reporte".
4. El sistema verifica si existen datos en el rango seleccionado.
5. El reporte queda registrado en la base documental.

**Flujos Alternativos:**

- **FA-1:** Rango sin datos → El sistema muestra modal de advertencia y permite al usuario decidir si procede con el guardado igualmente.
- **FA-2:** Editar reporte → Se precargan datos → Actualiza.
- **FA-3:** Eliminar reporte → Modal de confirmación → Se elimina.

**Postcondiciones:** Reporte creado/actualizado/eliminado.

---

### CU-03.4 — Exportar Reporte a Excel

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Reporte existente con rango de datos válido       |
| **RF Relacionados**| RF-046                                           |

**Flujo Principal:**

1. El usuario localiza el reporte en la tabla.
2. Presiona el botón de descarga (⏬).
3. El sistema genera un archivo XLSX con los datos del rango configurado.
4. El navegador inicia la descarga automáticamente.

**Flujos Alternativos:**

- **FA-1:** Rango sin datos → Se muestra toast de error descriptivo.

**Postcondiciones:** Archivo Excel descargado.

---

### CU-03.5 — Descargar Auditoría de Merma (PDF)

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa; productos con fecha de vencimiento registrada |
| **RF Relacionados**| RF-058                                           |

**Flujo Principal:**

1. El usuario navega al módulo "Reportes".
2. En el panel lateral, localiza la sección "Auditoría de Merma".
3. Presiona "DESCARGAR REPORTE (PDF)".
4. El sistema consulta los productos vencidos de la tienda.
5. El sistema genera un documento PDF con: encabezado institucional, tabla de productos vencidos (producto, proveedor completo, cantidad, precio unitario, subtotal) y cálculo de pérdida financiera total en COP.
6. El navegador descarga automáticamente el archivo.

**Flujos Alternativos:**

- **FA-1:** Sin productos vencidos → Se muestra toast informativo.

**Postcondiciones:** Archivo PDF descargado con auditoría financiera de merma.

---

### CU-03.6 — Abrir y Cerrar Sesión de Caja

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador, Colaborador                       |
| **Precondiciones** | Sesión activa en el sistema                      |
| **RF Relacionados**| RF-066, RF-069                                   |

**Flujo Principal (Apertura):**

1. El usuario navega al módulo "Punto de Venta".
2. Si no tiene una sesión activa, el sistema muestra el modal de "Apertura de Caja".
3. El usuario ingresa el monto base (físico) con el que inicia el turno.
4. Presiona "Abrir Caja".
5. El sistema registra la apertura y habilita la vista de ventas.

**Flujo Principal (Cierre):**

1. El usuario presiona el botón "Cerrar Caja".
2. El sistema muestra el modal de cierre.
3. El usuario declara el monto total en efectivo físico.
4. El sistema calcula la diferencia entre lo declarado y lo esperado (Apertura + Ventas Efectivo - Egresos).
5. El sistema registra el cierre y desactiva el POS hasta una nueva apertura.

**Postcondiciones:** Sesión de caja abierta/cerrada con registro de cuadre.

---

### CU-03.7 — Registrar y Gestionar Egresos de Caja Menor

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Colaborador, Administrador                       |
| **Precondiciones** | Sesión de caja abierta                           |
| **RF Relacionados**| RF-067, RF-068                                   |

**Flujo Principal (Registro):**

1. El usuario navega a "Caja Rápida" y selecciona la pestaña "Egresos/Caja Menor".
2. Completa: Categoría, Monto, Motivo y sube una Foto (opcional).
3. Presiona "Registrar Egreso".
4. El sistema asocia el egreso a la sesión de caja actual en estado "Pendiente".

**Flujo Principal (Gestión - Administrador):**

1. El Administrador navega a "Caja Rápida" > "Historial de Egresos".
2. Selecciona un egreso pendiente y evalúa el soporte fotográfico.
3. Puede "Aprobar" o "Rechazar", agregando notas opcionales.
4. El sistema actualiza el estado, afectando el cálculo final del cierre de caja si es aprobado.

**Postcondiciones:** Egreso registrado y/o procesado por un superior.

---

### CU-03.8 — Registrar Venta Fiada

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión de caja abierta, Carrito con productos    |
| **RF Relacionados**| RF-071, RF-072, RF-075                           |

**Flujo Principal:**

1. El Administrador navega a "Caja Rápida" y selecciona productos.
2. Al proceder al pago, selecciona el método "Fiado".
3. Selecciona un cliente registrado de la lista desplegable.
4. Presiona "Confirmar y Facturar".
5. El sistema registra la venta descontando el stock pero excluyendo el monto del cuadre de caja (Efectivo Esperado).
6. El sistema aumenta el saldo de la deuda del cliente por el valor total de la venta.

**Postcondiciones:** Venta registrada, inventario actualizado y deuda de cliente aumentada.

---

### CU-03.9 — Registrar Abono a Cartera

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión de caja abierta, Cliente con deuda previa |
| **RF Relacionados**| RF-072, RF-073, RF-074, RF-075                   |

**Flujo Principal:**

1. El Administrador navega a la sección de "Cartera / Fiados".
2. Selecciona a un cliente con saldo pendiente y hace clic en "Registrar Abono".
3. Ingresa el monto a pagar, seleccionando "Efectivo" como método de pago.
4. Confirma la operación.
5. El sistema descuenta el valor pagado de la deuda total del cliente.
6. El sistema suma el efectivo recibido a la sesión de caja activa actual.

**Postcondiciones:** Deuda de cliente reducida y monto esperado en caja incrementado.

---

## Paquete CU-04: Motor Predictivo e Inteligencia Artificial

---

### CU-04.1 — Consultar Dashboard Inteligente

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador, Colaborador                       |
| **Precondiciones** | Sesión activa                                    |
| **RF Relacionados**| RF-020, RF-023, RF-038, RF-039, RF-040, RF-041 |

**Flujo Principal:**

1. Tras iniciar sesión, el usuario visualiza el Dashboard principal con KPIs: total artículos, valor del inventario, alertas activas (semáforo rojo/amarillo/verde) y ventas acumuladas.
2. El sistema calcula la velocidad de venta promedio por producto en períodos de 7 y 30 días.
3. El sistema carga las recomendaciones del Asistente Estratégico IA (producto, tendencia, ajuste, confianza).
4. Se muestra el gráfico de barras "Ritmo de Caja" (ventas últimos 7 días).
5. El usuario puede navegar al Centro Analítico para ver: gráficos Pareto ABC, donut de distribución, mapa de riesgo logístico y proyección de agotamiento por producto (fecha estimada de agotamiento basada en stock actual y velocidad de venta).

**Postcondiciones:** Información analítica completa presentada para toma de decisiones.

**Nota de versión:** el paso 6 original de este caso de uso (KPIs de `getAdvancedStats`: pérdidas proyectadas por vencimiento, nivel de servicio y comparativa de ventas) se retiró — ese endpoint no tenía ningún consumidor real en el frontend. Ver RF-042/RF-043 en `requerimientos_sistema.md` para el detalle.

---

### CU-04.2 — Generar Alertas Inteligentes

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa; productos y ventas registrados     |
| **RF Relacionados**| RF-033, RF-034, RF-035, RF-036, RF-037           |

**Flujo Principal:**

1. El motor de reglas se ejecuta automáticamente en segundo plano cada vez que cambia algo que puede afectar el stock: una venta, la creación o edición de un producto, recibir mercancía, o un movimiento manual (entrada/salida/ajuste). El usuario también puede navegar al "Centro de Alertas" y presionar "↻ Forzar Recálculo" para dispararlo manualmente.
2. Para cada producto, el motor evalúa 5 reglas usando el mismo cálculo de reposición (`calcularReposicion`) que usan el Catálogo, el Consejero IA y Proveedores, así que un producto no puede verse sano en una pantalla y en riesgo en otra:
   - **R1:** ¿La urgencia calculada es "Pide hoy" (sin stock, o quedan menos días de los que tarda el proveedor)? → Alerta Crítica de stock. Incluye el caso de un producto agotado sin ninguna venta registrada, que antes no generaba alerta.
   - **R2:** ¿La urgencia es "En esta compra" (alcanza para menos días que el lead time + la frecuencia de compra habitual del producto)? → Advertencia.
   - **R3:** ¿Vence en ≤7 días y sobrarán unidades? → Vencimiento Crítico.
   - **R4:** ¿Vence en ≤30 días y sobrarán unidades? → Vencimiento Advertencia.
   - **R5:** ¿Stock > máximo, Clase C, y >60 días de inventario? → Sobrestock.
3. Las alertas se actualizan en su lugar si ya estaban activas (conservando desde cuándo llevan activas) o se crean si son nuevas; las que ya no aplican se marcan resueltas. Todo corre dentro de una transacción con bloqueo por tienda, para que dos disparos casi simultáneos (dos ventas seguidas) no dupliquen alertas.
4. El usuario visualiza las alertas con filtros por severidad.
5. Puede marcar alertas como resueltas manualmente.

**Postcondiciones:** Alertas generadas, actualizadas o resueltas según el estado real del inventario; métricas de conteo actualizadas (contando productos distintos, no filas de alerta, y separando alertas de stock de las de vencimiento/sobrestock).

---

### CU-04.3 — Obtener Recomendaciones IA (Copiloto)

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Sistema (automático al cargar Dashboard)         |
| **Precondiciones** | API Key de OpenAI configurada; productos con ventas |
| **RF Relacionados**| RF-021, RF-022, RF-024, RF-025, RF-026           |

**Flujo Principal:**

1. El Dashboard solicita recomendaciones al endpoint /api/ia/recommendations.
2. El sistema calcula un hash MD5 de los datos actuales.
3. Si el hash coincide con el cache → devuelve cache (sin llamada a OpenAI).
4. Si cambió → procesa los datos: clasificación ABC, tendencia, ROP.
5. Envía los 5 productos más relevantes a GPT-4o-mini para ajuste porcentual.
6. Aplica guardrails (Clase A: max ±100%, B: ±50%, C: ±20%).
7. Registra la decisión en el log de auditoría.
8. Actualiza el cache y devuelve las recomendaciones al frontend.

**Flujos Alternativos:**

- **FA-1:** API Key no configurada → Retorna error descriptivo.
- **FA-2:** Respuesta IA inválida → Se muestra mensaje de mantenimiento.

**Postcondiciones:** Recomendaciones mostradas; decisión auditada.

---

## Paquete CU-05: Compras Inteligentes y Proveedores

---

### CU-05.1 — Gestionar Proveedores

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa                                    |
| **RF Relacionados**| RF-048, RF-049                                   |

**Flujo Principal:**

1. El usuario navega al módulo "Proveedores".
2. Visualiza los proveedores registrados con su conteo de productos vinculados.
3. Para crear: completa formulario (nombre empresa, contacto, email, teléfono, dirección) → "Guardar".
4. Los productos se vinculan a proveedores desde el módulo Productos.

**Postcondiciones:** Proveedor registrado; asociación con productos activa.

---

### CU-05.2 — Generar Orden de Compra Inteligente

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Proveedor seleccionado con productos vinculados que necesitan reposición |
| **RF Relacionados**| RF-027, RF-028, RF-029, RF-030, RF-031           |

**Flujo Principal:**

1. El usuario selecciona un proveedor y presiona "Generar Orden".
2. **Fase Matemática:** El sistema calcula velocidad 30d, ROP, clasificación ABC y cantidad sugerida por producto.
3. Se presenta la lista de productos que requieren reposición con cantidades base.
4. El usuario puede editar cantidades, seleccionar/deseleccionar ítems.
5. **Fase IA:** El usuario presiona "Consultar Copiloto IA".
6. El sistema envía los datos a GPT-4o-mini, recibe ajustes porcentuales.
7. Se aplican guardrails y se muestra el carrito final con recomendación IA.
8. **Fase de Riesgo:** El sistema evalúa el nivel de riesgo (Bajo/Medio/Alto).
9. El usuario revisa y presiona "Confirmar Orden".
10. La orden se persiste con detalle de ítems y registro de auditoría IA.

**Flujos Alternativos:**

- **FA-1:** Sin productos que reponer → Mensaje informativo.
- **FA-2:** API IA no disponible → Se mantiene solo la sugerencia matemática.

**Postcondiciones:** Orden registrada; auditoría IA persistida.

---

### CU-05.3 — Consultar Historial de Órdenes

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa; órdenes previas existentes         |
| **RF Relacionados**| RF-032                                           |

**Flujo Principal:**

1. El usuario navega al panel "Historial de Órdenes" dentro de Proveedores.
2. Visualiza la lista de órdenes pasadas (proveedor, fecha, estado, riesgo, monto, responsable).
3. Puede expandir una orden para ver el detalle: productos, cantidad base, ajuste IA, cantidad final.

**Postcondiciones:** Información histórica presentada.

---

### CU-05.4 — Simular Escenarios de Compra

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa; productos con historial de ventas  |
| **RF Relacionados**| RF-021, RF-052, RF-053, RF-054                   |

**Flujo Principal:**

1. El usuario navega al módulo "Simulador de Escenarios".
2. El sistema carga todos los productos de la tienda con su stock actual, velocidad de venta y la cantidad recomendada por el motor de reposición para el objetivo de cobertura actual.
3. El usuario ajusta el slider de "Días de cobertura" (7-90 días).
4. El sistema vuelve a pedir la cantidad recomendada al backend (con un pequeño retraso para no saturar la consulta mientras se arrastra el slider), usando el mismo motor de reposición que Catálogo, Consejero IA y Proveedores con ese objetivo de cobertura — incluye el piso de stock mínimo/seguridad para productos sin ventas recientes, que antes siempre mostraban "Comprar: 0" aunque ya estuvieran marcados críticos.
5. El usuario ingresa el "Presupuesto máximo" de compra.
6. Si la suma excede el presupuesto, el algoritmo greedy prioriza Clase A y recorta desde Clase C.
7. El usuario puede incluir/excluir productos manualmente mediante checkboxes.
8. El usuario visualiza KPIs: costo total simulado, items incluidos, excluidos y % de uso del presupuesto.
9. Opcionalmente, presiona "Convertir en Orden Real" → selecciona proveedor → se genera orden con estado Borrador.

**Flujos Alternativos:**

- **FA-1:** Todos los productos están genuinamente abastecidos (incluyendo los que no tienen ventas recientes) → Tabla muestra "Comprar: 0 ud" para todos.
- **FA-2:** Sin productos del proveedor seleccionado en la simulación → Toast de advertencia.

**Postcondiciones:** Simulación visualizada; opcionalmente convertida en orden de compra real.

---

### CU-05.5 — Evaluar Precisión de Predicción IA

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa; órdenes aprobadas existentes       |
| **RF Relacionados**| RF-055, RF-056, RF-057                           |

**Flujo Principal:**

1. El usuario navega al módulo "Aprendizaje Inteligente".
2. Visualiza el nivel de acierto global (%), la gráfica de evolución mensual y la tabla de rendimiento por producto.
3. Presiona "Evaluar una orden".
4. Selecciona una orden aprobada del selector desplegable.
5. Presiona "Comparar sugerencia vs. realidad".
6. El sistema consulta las ventas reales desde la fecha de aprobación para cada producto de la orden.
7. Calcula el factor de precisión: ventas_reales / cantidad_sugerida (limitado entre 0.2 y 3.0).
8. Persiste el factor en la tabla Feedback_IA.
9. Muestra los resultados por producto: cantidad sugerida, cantidad vendida, % de acierto y veredicto.
10. Las métricas globales se actualizan automáticamente.

**Flujos Alternativos:**

- **FA-1:** Sin órdenes evaluables → Selector vacío con mensaje informativo.
- **FA-2:** Orden sin detalles → Error descriptivo.

**Postcondiciones:** Factor de precisión calculado y persistido; métricas de aprendizaje actualizadas; futuras predicciones ajustadas.

---

### CU-05.6 — Enviar Orden de Compra al Proveedor por Email

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa; orden en estado "Aprobada"; proveedor con email registrado; variables EMAIL_USER y EMAIL_PASS configuradas |
| **RF Relacionados**| RF-063                                           |

**Flujo Principal:**

1. El usuario abre el detalle de una orden con estado "Aprobada" desde el Historial de Órdenes.
2. El sistema muestra el detalle de la orden con un campo de texto para mensaje personalizado y el botón "📧 Enviar Orden al Proveedor por Email".
3. El usuario opcionalmente escribe un mensaje para el proveedor (ej: "Por favor confirmar disponibilidad y tiempo de entrega").
4. Presiona el botón de envío.
5. El sistema consulta los datos de la orden (productos, cantidades, valores de referencia), el email del proveedor y los datos de la tienda.
6. Genera un correo HTML responsive con: encabezado de la tienda, tabla de productos solicitados con cantidades y subtotales de referencia en COP, mensaje del comprador (si existe), y datos de contacto del administrador.
7. Envía el correo al email del proveedor usando nodemailer, configurando el campo `replyTo` con el correo del administrador para que las respuestas le lleguen directamente.
8. Actualiza el estado de la orden de "Aprobada" a "Enviada".
9. Muestra un toast de confirmación con el email destino.

**Flujos Alternativos:**

- **FA-1:** Proveedor sin email registrado → Toast de error: "Este proveedor no tiene un correo electrónico registrado. Edita sus datos y agrega un email antes de enviar."
- **FA-2:** Error SMTP al enviar → Toast de error con mensaje descriptivo; el estado de la orden no se modifica.
- **FA-3:** Orden sin productos en el detalle → Error: "La orden no tiene productos."

**Postcondiciones:** Correo HTML enviado al proveedor; estado de la orden actualizado a "Enviada"; badge visual actualizado en el historial.

---

### CU-05.7 — Obtener Sugerencias de Promoción Comercial (IA)

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa; productos con historial de ventas; API Key de OpenAI configurada |
| **RF Relacionados**| RF-070                                           |

**Flujo Principal:**

1. El usuario accede al Dashboard principal.
2. El sistema analiza automáticamente los productos de la tienda y detecta candidatos con: tendencia bajista (velocidad 7d < 70% de la velocidad 30d), sobrestock (stock > 50 unidades y velocidad < 1 ud/día), o vencimiento próximo (< 30 días). Los candidatos se ordenan por urgencia de vencimiento (días restantes ASC) antes de seleccionar los 10 prioritarios.
3. Si existen candidatos, el sistema los envía a GPT-4o-mini con un prompt de estrategia comercial que exige cobertura obligatoria de todos los productos incluidos.
4. La IA genera sugerencias con tipo de promoción (descuento, combo, 2x1 o liquidación), descuento sugerido, justificación profesional, duración y producto complementario (para combos).
5. El sistema aplica un fallback determinístico para cualquier candidato no cubierto por el modelo, asignando una estrategia basada en reglas según causa (vencimiento crítico ≤10 días → liquidación 25%; vencimiento próximo ≤30 días → descuento 15%; sobrestock → combo 10%; baja rotación general → descuento 15%), garantizando cobertura del 100% de los candidatos.
6. El sistema calcula el impacto financiero estimado: precio con descuento y capital a liberar.
7. Las sugerencias se presentan en la sección "Oportunidades de Promoción IA" del Dashboard con impacto financiero, desplazables verticalmente si superan el espacio visible.
8. El usuario puede presionar "Activar Promoción" para aplicar la estrategia: el sistema actualiza el precio del producto, guarda el precio original para restauración automática, registra en el historial de precios y audita la decisión de IA.

**Flujos Alternativos:**

- **FA-1:** Sin productos candidatos → La sección muestra "Mercado Estable • Sin sugerencias de descuento".
- **FA-2:** API Key no configurada o error de IA → Sección no se renderiza.
- **FA-3:** Promoción con fecha de fin expirada → El sistema restaura automáticamente el precio original mediante cron diario (00:05 AM).
- **FA-4:** El modelo de IA omite uno o más candidatos → El fallback determinístico cubre los productos omitidos con estrategias basadas en reglas antes de entregar la respuesta al cliente.

**Postcondiciones:** Sugerencias de promoción presentadas con impacto financiero; opcionalmente, estrategia aplicada con precio actualizado, auditoría registrada y restauración automática programada.

---

## Paquete CU-06: Automatización y Comunicación Proactiva

---

### CU-06.1 — Enviar Resumen Semanal Automático

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Sistema (cron job automático)                    |
| **Precondiciones** | Variables de entorno EMAIL_USER y EMAIL_PASS configuradas; alertas activas en al menos una tienda |
| **RF Relacionados**| RF-059                                           |

**Flujo Principal:**

1. Cada lunes a las 8:00 AM, el cron job (node-cron) se activa automáticamente.
2. El sistema obtiene todas las tiendas activas de la base de datos.
3. Para cada tienda con alertas no resueltas:
   - a. Calcula estadísticas: cantidad de alertas críticas y de advertencia.
   - b. Obtiene las 5 alertas prioritarias más recientes con detalle (producto, mensaje, severidad).
   - c. Identifica los usuarios con rol Administrador o Dueño que tengan correo registrado.
4. Construye un correo HTML responsive con el resumen ejecutivo (estadísticas + alertas prioritarias + enlace al Centro de Alertas).
5. Envía el correo vía SMTP (nodemailer).
6. Registra en consola del servidor el resultado del envío (tienda, cantidad de admins notificados).

**Flujos Alternativos:**

- **FA-1:** Tienda sin alertas activas → Se omite el envío para esa tienda.
- **FA-2:** Configuración SMTP inválida o ausente → Error registrado en logs del servidor.
- **FA-3:** Tienda sin administradores con correo registrado → Se omite la tienda.

**Postcondiciones:** Correos de resumen enviados a los administradores correspondientes.

---

### CU-06.2 — Enviar Resumen Manual

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Administrador                                    |
| **Precondiciones** | Sesión activa con rol Administrador; configuración SMTP válida en variables de entorno |
| **RF Relacionados**| RF-060                                           |

**Flujo Principal:**

1. El usuario navega al módulo "Reportes".
2. En el panel lateral, localiza el botón "📧 ENVIAR RESUMEN AHORA".
3. Presiona el botón.
4. El sistema ejecuta la misma lógica del resumen semanal (CU-06.1) pero restringida a la tienda del usuario autenticado.
5. Se muestra un toast con el resultado (éxito con cantidad de correos enviados, o error descriptivo).

**Flujos Alternativos:**

- **FA-1:** Sin alertas activas en la tienda → Resumen enviado con conteo en cero.
- **FA-2:** Error SMTP → Toast de error con mensaje descriptivo.

**Postcondiciones:** Correo de resumen enviado inmediatamente al administrador.

---

### CU-06.3 — Alerta Sonora en Tiempo Real

| Campo              | Detalle                                          |
| ------------------ | ------------------------------------------------ |
| **Actores**        | Sistema (Frontend), Usuario (Interacción inicial)|
| **Precondiciones** | Sesión activa; Usuario ha hecho clic al menos una vez en la página (para desbloqueo de audio); Archivos de audio configurados en el servidor |
| **RF Relacionados**| RF-064                                           |

**Flujo Principal:**

1. El sistema realiza el polling de alertas cada 2 minutos (o según configuración del Dashboard).
2. El sistema compara el total de alertas activas actual contra el total del ciclo anterior.
3. Si el total actual es mayor que el anterior, el sistema dispara el evento de sonido.
4. El sistema identifica la severidad de las nuevas alertas (si hay al menos una crítica).
5. Reproduce el archivo de audio correspondiente (`normal.wav` o `critica.wav`) al 100% de volumen.

**Flujos Alternativos:**

- **FA-1:** Navegador bloquea audio (sin interacción previa) → El sistema registra advertencia en consola y espera a la siguiente interacción del usuario para desbloquear el contexto de audio.
- **FA-2:** Error al cargar archivo de audio (404 o red) → El sistema utiliza el sintetizador de frecuencia manual (Web Audio API) como respaldo para asegurar que la notificación ocurra.

**Postcondiciones:** Notificación sonora emitida; el usuario es alertado auditivamente sobre nuevos riesgos de stock o vencimiento.

---

## Matriz de Trazabilidad CU ↔ RF

| Caso de Uso | Requerimientos Funcionales                        |
| ----------- | ------------------------------------------------ |
| CU-01.1     | RF-001, RF-004, RF-006, RF-061                   |
| CU-01.2     | RF-002, RF-006                                   |
| CU-01.3     | RF-003                                           |
| CU-01.4     | RF-005                                           |
| CU-01.5     | RF-050, RF-051, RF-062                           |
| CU-02.1     | RF-007, RF-008, RF-009, RF-010, RF-076           |
| CU-02.2     | RF-016, RF-017                                   |
| CU-02.3     | RF-018, RF-019                                   |
| CU-02.4     | RF-009, RF-011                                   |
| CU-03.1     | RF-012, RF-013, RF-015, RF-065                   |
| CU-03.2     | RF-014                                           |
| CU-03.3     | RF-044, RF-045, RF-047                           |
| CU-03.4     | RF-046                                           |
| CU-03.5     | RF-058                                           |
| CU-03.6     | RF-066, RF-069                                   |
| CU-03.7     | RF-067, RF-068                                   |
| CU-04.1     | RF-020, RF-023, RF-038, RF-039, RF-040, RF-041   |
| CU-04.2     | RF-033, RF-034, RF-035, RF-036, RF-037           |
| CU-04.3     | RF-021, RF-022, RF-024, RF-025, RF-026           |
| CU-05.1     | RF-048, RF-049                                   |
| CU-05.2     | RF-027, RF-028, RF-029, RF-030, RF-031           |
| CU-05.3     | RF-032                                           |
| CU-05.4     | RF-021, RF-052, RF-053, RF-054                   |
| CU-05.5     | RF-055, RF-056, RF-057                           |
| CU-05.6     | RF-063                                           |
| CU-05.7     | RF-070                                           |
| CU-06.1     | RF-059                                           |
| CU-06.2     | RF-060                                           |
| CU-06.3     | RF-064                                           |
