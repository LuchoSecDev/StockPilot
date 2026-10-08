# Diagrama de Entidad Relación (ERD) - StockPilot

Este es el diagrama de la base de datos de StockPilot, generado a partir de la estructura real de PostgreSQL. Puedes copiar este código y pegarlo en cualquier visor de Mermaid (como [Mermaid Live](https://mermaid.live/) o usarlo directamente aquí en GitHub/Markdown).

```mermaid
erDiagram
    Tienda ||--o{ Usuarios : "tiene"
    Tienda ||--o{ Proveedores : "tiene"
    Tienda ||--o{ Productos : "vende"
    Tienda ||--o{ MovimientosStock : "registra"
    Tienda ||--o{ Ventas : "realiza"
    Tienda ||--o{ Ordenes_Compra : "genera"
    Tienda ||--o{ Alertas : "genera"
    Tienda ||--o{ Auditoria_IA : "audita"
    Tienda ||--o{ reportes : "emite"
    Tienda ||--o{ SesionCaja : "gestiona"
    Tienda ||--o{ EgresosCaja : "registra"
    Tienda ||--o{ Clientes : "registra"
    Tienda ||--o{ Abonos : "registra"
    Tienda ||--o{ Promociones_Manuales : "registra"
    Tienda ||--o{ NotificacionesUsuario : "genera"

    Usuarios ||--o{ MovimientosStock : "hace"
    Usuarios ||--o{ Ventas : "vende"
    Usuarios ||--o{ Ordenes_Compra : "aprueba"
    Usuarios ||--o{ SesionCaja : "abre"
    Usuarios ||--o{ EgresosCaja : "gestiona"
    Usuarios ||--o{ Abonos : "recibe"
    Usuarios ||--o{ NotificacionesUsuario : "recibe"
    Usuarios ||--o{ Tienda : "es propietario de"

    Proveedores ||--o{ Productos : "provee"
    Proveedores ||--o{ Ordenes_Compra : "recibe"

    Productos ||--o{ MovimientosStock : "sufre"
    Productos ||--o{ VentasProductos : "incluido_en"
    Productos ||--o{ Ordenes_Detalle : "solicitado_en"
    Productos ||--o{ Alertas : "genera"
    Productos ||--o{ Feedback_IA : "evaluado_en"
    Productos ||--o{ Historial_Precios : "tiene"
    Productos ||--o{ Promociones_Manuales : "tiene"

    Ventas ||--|{ VentasProductos : "contiene"

    Ordenes_Compra ||--|{ Ordenes_Detalle : "contiene"
    Ordenes_Compra ||--o{ Auditoria_IA : "auditada_por"
    Ordenes_Compra ||--o{ Feedback_IA : "evaluada_por"

    SesionCaja ||--o{ Ventas : "contiene"
    SesionCaja ||--o{ EgresosCaja : "contiene"
    SesionCaja ||--o{ Abonos : "contiene"

    Clientes ||--o{ Ventas : "compra"
    Clientes ||--o{ Abonos : "paga"

    Tienda {
        int id_tienda PK
        varchar nombre_establecimiento
        varchar direccion
        int anio_creacion
        varchar estado
        varchar documento
        varchar razon_social
        varchar celular
        varchar ciudad
        int id_propietario FK
        numeric limite_egreso_tendero
    }

    Usuarios {
        int id_usuario PK
        varchar nombres
        varchar genero
        varchar correo
        varchar celular
        varchar rol
        varchar usuario
        varchar contrasena
        timestamp fecha_registro
        int id_tienda FK
        varchar session_id
        text foto_url
        boolean cambio_clave_forzoso
        varchar reset_token
        varchar reset_expires
        varchar two_factor_secret
        boolean two_factor_enabled
    }

    Proveedores {
        int id_proveedor PK
        varchar nombre_empresa
        varchar nit
        varchar contacto_nombre
        varchar contacto_principal
        varchar telefono
        varchar correo
        varchar email
        text direccion
        int id_tienda FK
        varchar estado
        timestamp fecha_registro
    }

    Productos {
        int id_producto PK
        varchar codigo
        varchar nombre_producto
        varchar categoria
        varchar subcategoria
        varchar tipo_producto
        numeric precio
        int cantidad
        int stock_minimo
        int stock_maximo
        int stock_seguridad
        int lead_time
        date fecha_entrada
        timestamp fecha_salida
        varchar estado
        int id_tienda FK
        int id_proveedor FK
        date fecha_vencimiento
        int frecuencia_compra_dias
        numeric costo_compra
        varchar clasificacion_abc
        numeric precio_original
        date fecha_fin_promocion
        varchar codigo_barras
    }

    MovimientosStock {
        int id_movimiento PK
        int id_producto FK
        varchar tipo_movimiento
        int cantidad
        int stock_final
        timestamp fecha_movimiento
        text observacion
        int id_usuario FK
        int id_tienda FK
    }

    Ventas {
        int id_venta PK
        int id_vendedor FK
        int id_tienda FK
        int id_sesion_caja FK
        int id_cliente FK
        timestamp fecha_salida
        numeric precio_total
        varchar metodo_pago
        numeric efectivo_recibido
        numeric cambio_devuelto
        varchar estado_deuda
    }

    VentasProductos {
        int id PK
        int id_venta FK
        int id_producto FK
        int cantidad
        numeric precio_unitario
    }

    Ordenes_Compra {
        int id_orden PK
        int id_tienda FK
        int id_proveedor FK
        int id_usuario FK
        timestamp fecha_creacion
        timestamp fecha_aprobacion
        varchar estado
        numeric total_estimado
        numeric presupuesto_total
        numeric monto_pagado
        varchar estado_pago
        varchar riesgo
        text notas
        text observaciones
        varchar origen
    }

    Ordenes_Detalle {
        int id_detalle PK
        int id_orden FK
        int id_producto FK
        int cantidad_sugerida
        int cantidad_final
        numeric costo_unitario
        int sugerencia_ia
        varchar urgencia
        boolean costo_estimado
        int cantidad_recibida
        int solicitado_por FK
    }

    Alertas {
        int id_alerta PK
        int id_producto FK
        int id_tienda FK
        varchar tipo
        varchar severidad
        text mensaje
        timestamp fecha_creacion
        int resuelta
        timestamp fecha_resolucion
        text datos_json
    }

    Auditoria_IA {
        int id_auditoria PK
        timestamp fecha_auditoria
        int id_tienda FK
        int id_orden FK
        varchar motor_ia
        text prompt_utilizado
        text datos_base_json
        text sugerencia_ia_json
        text impacto_decision
        text razon_ia
    }

    Feedback_IA {
        int id_feedback PK
        int id_orden FK
        int id_producto FK
        int cantidad_sugerida
        int ventas_reales_periodo
        numeric factor_precision
        timestamp fecha_evaluacion
        int dias_con_stock
        numeric error_absoluto
        numeric error_porcentual
        numeric bias
    }

    Historial_Precios {
        int id PK
        int id_producto FK
        numeric precio_anterior
        numeric precio_nuevo
        timestamp fecha_cambio
        text motivo
    }

    reportes {
        int id PK
        varchar titulo
        text descripcion
        date fecha_reporte
        varchar creador
        varchar tipo
        int id_tienda FK
        date fecha_inicio
        date fecha_fin
        timestamp creado_en
    }

    Cache_IA {
        varchar clave PK
        varchar data_hash
        text datos_json
        timestamp actualizado_at
    }

    SesionCaja {
        int id_sesion PK
        int id_tienda FK
        int id_vendedor FK
        numeric monto_apertura
        numeric monto_cierre_declarado
        numeric monto_cierre_calculado
        numeric diferencia
        varchar estado
        timestamp fecha_apertura
        timestamp fecha_cierre
    }

    EgresosCaja {
        int id_egreso PK
        int id_sesion_caja FK
        int id_tienda FK
        int id_usuario FK
        numeric monto
        varchar motivo
        varchar categoria
        text foto_soporte
        varchar estado
        int aprobado_por FK
        timestamp fecha_registro
        timestamp fecha_aprobacion
        text notas_admin
    }

    Clientes {
        int id_cliente PK
        int id_tienda FK
        varchar nombre
        varchar celular
        numeric limite_credito
        timestamp fecha_registro
    }

    Abonos {
        int id_abono PK
        int id_cliente FK
        int id_tienda FK
        int id_sesion_caja FK
        numeric monto
        varchar metodo_pago
        timestamp fecha_abono
        int id_usuario_recibe FK
    }

    Promociones_Manuales {
        int id_promocion PK
        int id_producto FK
        int id_tienda FK
        numeric descuento_porcentaje
        numeric precio_anterior
        numeric precio_nuevo
        varchar motivo
        timestamp fecha_creacion
    }

    NotificacionesUsuario {
        int id_notificacion PK
        int id_usuario FK
        int id_tienda FK
        varchar tipo
        varchar titulo
        text mensaje
        text datos_json
        int leida
        timestamp fecha_lectura
        timestamp fecha_creacion
    }
```
