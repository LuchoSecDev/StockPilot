-- ==========================================
-- STOCKPILOT - ESQUEMA POSTGRESQL COMPLETO
-- ==========================================

-- 0. Limpieza (Opcional, útil para desarrollo)
-- DROP TABLE IF EXISTS session CASCADE;
-- DROP TABLE IF EXISTS Alertas CASCADE;
-- DROP TABLE IF EXISTS Feedback_IA CASCADE;
-- DROP TABLE IF EXISTS Auditoria_IA CASCADE;
-- DROP TABLE IF EXISTS reportes CASCADE;
-- DROP TABLE IF EXISTS VentasProductos CASCADE;
-- DROP TABLE IF EXISTS Ventas CASCADE;
-- DROP TABLE IF EXISTS MovimientosStock CASCADE;
-- DROP TABLE IF EXISTS Historial_Precios CASCADE;
-- DROP TABLE IF EXISTS Ordenes_Detalle CASCADE;
-- DROP TABLE IF EXISTS Ordenes_Compra CASCADE;
-- DROP TABLE IF EXISTS Productos CASCADE;
-- DROP TABLE IF EXISTS Proveedores CASCADE;
-- DROP TABLE IF EXISTS Usuarios CASCADE;
-- DROP TABLE IF EXISTS Tienda CASCADE;

-- 1. TABLA TIENDA
CREATE TABLE IF NOT EXISTS Tienda (
    id_tienda SERIAL PRIMARY KEY,
    nombre_establecimiento VARCHAR(255) NOT NULL,
    direccion VARCHAR(255),
    anio_creacion INTEGER,
    estado VARCHAR(50) DEFAULT 'Activo',
    documento VARCHAR(50),
    razon_social VARCHAR(255),
    celular VARCHAR(20),
    ciudad VARCHAR(100),
    -- Sin REFERENCES aquí a propósito: Usuarios todavía no existe en este punto del script, y
    -- Usuarios.id_tienda (abajo) referencia a Tienda — son circulares. La FK se agrega con
    -- ALTER TABLE después de crear ambas tablas (plan 20, Nivel 2, bug encontrado al intentar
    -- correr este script contra una base nueva: antes fallaba con "no existe la relación usuarios").
    id_propietario INTEGER,
    limite_egreso_tendero NUMERIC(15, 2) DEFAULT 150000
);

-- 2. TABLA USUARIOS
CREATE TABLE IF NOT EXISTS Usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nombres VARCHAR(255) NOT NULL,
    genero VARCHAR(50),
    correo VARCHAR(255) UNIQUE NOT NULL,
    celular VARCHAR(20),
    rol VARCHAR(50) NOT NULL,
    usuario VARCHAR(100) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id_tienda INTEGER NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    session_id VARCHAR(255),
    session_id_app VARCHAR(255), -- candado de sesión del canal «app»; session_id es el del canal web
    foto_url TEXT,
    cambio_clave_forzoso BOOLEAN DEFAULT FALSE,
    reset_token VARCHAR(255),
    reset_expires VARCHAR(100),
    two_factor_secret VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    fecha_aceptacion_politica_datos TIMESTAMP WITH TIME ZONE
);

-- Cierra la dependencia circular Tienda <-> Usuarios de arriba: recién acá pueden existir las dos.
-- PostgreSQL no soporta "ADD CONSTRAINT IF NOT EXISTS"; se verifica a mano para que el script
-- siga siendo idempotente (se puede correr varias veces, como el resto de este archivo).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_tienda_propietario'
    ) THEN
        ALTER TABLE Tienda
            ADD CONSTRAINT fk_tienda_propietario
            FOREIGN KEY (id_propietario) REFERENCES Usuarios(id_usuario) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. TABLA PROVEEDORES
CREATE TABLE IF NOT EXISTS Proveedores (
    id_proveedor SERIAL PRIMARY KEY,
    nombre_empresa VARCHAR(255) NOT NULL,
    nit VARCHAR(50) UNIQUE,
    contacto_nombre VARCHAR(255),
    contacto_principal VARCHAR(255),
    telefono VARCHAR(20),
    correo VARCHAR(255),
    email VARCHAR(255),
    direccion TEXT,
    id_tienda INTEGER NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    estado VARCHAR(20) DEFAULT 'Activo',
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA PRODUCTOS
CREATE TABLE IF NOT EXISTS Productos (
    id_producto SERIAL PRIMARY KEY,
    codigo VARCHAR(100),
    codigo_barras VARCHAR(50),
    nombre_producto VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    subcategoria VARCHAR(100),
    tipo_producto VARCHAR(100),
    precio NUMERIC(15, 2) DEFAULT 0,
    cantidad INTEGER DEFAULT 0,
    stock_minimo INTEGER DEFAULT 5,
    stock_maximo INTEGER DEFAULT 200,
    stock_seguridad INTEGER DEFAULT 0,
    lead_time INTEGER DEFAULT 3,
    fecha_entrada DATE DEFAULT CURRENT_DATE,
    fecha_salida TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50) DEFAULT 'Disponible',
    id_tienda INTEGER REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    id_proveedor INTEGER REFERENCES Proveedores(id_proveedor) ON DELETE SET NULL,
    fecha_vencimiento DATE,
    frecuencia_compra_dias INTEGER DEFAULT 7,
    costo_compra NUMERIC(15, 2) DEFAULT 0,
    clasificacion_abc VARCHAR(1) DEFAULT 'C',
    precio_original NUMERIC(15, 2),
    fecha_fin_promocion DATE
);

-- 5. TABLA MOVIMIENTOS DE STOCK
CREATE TABLE IF NOT EXISTS MovimientosStock (
    id_movimiento SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES Productos(id_producto) ON DELETE CASCADE,
    tipo_movimiento VARCHAR(50) NOT NULL, -- 'Entrada', 'Salida', 'Ajuste'
    cantidad INTEGER NOT NULL,
    stock_final INTEGER,
    fecha_movimiento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    observacion TEXT,
    id_usuario INTEGER REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
    id_tienda INTEGER REFERENCES Tienda(id_tienda) ON DELETE CASCADE
);
-- 5.5. TABLA SESION DE CAJA (Arqueo y Turnos)
CREATE TABLE IF NOT EXISTS SesionCaja (
    id_sesion SERIAL PRIMARY KEY,
    id_tienda INTEGER NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    id_vendedor INTEGER NOT NULL REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    monto_apertura NUMERIC(15, 2) NOT NULL DEFAULT 0,
    monto_cierre_declarado NUMERIC(15, 2),
    monto_cierre_calculado NUMERIC(15, 2),
    diferencia NUMERIC(15, 2),
    fecha_apertura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50) DEFAULT 'Abierta' -- 'Abierta', 'Cerrada'
);

-- 5.6. TABLA EGRESOS CAJA CHICA (Fase 3)
CREATE TABLE IF NOT EXISTS EgresosCaja (
    id_egreso SERIAL PRIMARY KEY,
    id_sesion_caja INTEGER NOT NULL REFERENCES SesionCaja(id_sesion) ON DELETE CASCADE,
    id_tienda INTEGER NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    id_usuario INTEGER NOT NULL REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
    monto NUMERIC(15, 2) NOT NULL,
    motivo TEXT NOT NULL,
    categoria VARCHAR(50) DEFAULT 'Otro',  -- 'Proveedor', 'Insumos', 'Transporte', 'Otro'
    foto_soporte TEXT,                      -- base64 de la imagen (max ~2MB)
    estado VARCHAR(50) DEFAULT 'Registrado', -- 'Registrado', 'Aprobado', 'Rechazado'
    aprobado_por INTEGER REFERENCES Usuarios(id_usuario) ON DELETE SET NULL,
    fecha_aprobacion TIMESTAMP WITH TIME ZONE,
    notas_admin TEXT,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_egresos_sesion ON EgresosCaja(id_sesion_caja);
CREATE INDEX IF NOT EXISTS idx_egresos_tienda ON EgresosCaja(id_tienda);

-- 5.7. TABLA CLIENTES (FIADOS)
CREATE TABLE IF NOT EXISTS Clientes (
    id_cliente SERIAL PRIMARY KEY,
    id_tienda INTEGER NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    celular VARCHAR(20),
    limite_credito NUMERIC(15, 2) DEFAULT 0,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_clientes_tienda ON Clientes(id_tienda);

-- 5.8. TABLA ABONOS (PAGOS DE FIADOS)
CREATE TABLE IF NOT EXISTS Abonos (
    id_abono SERIAL PRIMARY KEY,
    id_cliente INTEGER NOT NULL REFERENCES Clientes(id_cliente) ON DELETE CASCADE,
    id_tienda INTEGER NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    id_sesion_caja INTEGER REFERENCES SesionCaja(id_sesion) ON DELETE SET NULL,
    monto NUMERIC(15, 2) NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'Efectivo',
    fecha_abono TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id_usuario_recibe INTEGER REFERENCES Usuarios(id_usuario) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_abonos_cliente ON Abonos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_abonos_sesion ON Abonos(id_sesion_caja);

-- 6. TABLA VENTAS
CREATE TABLE IF NOT EXISTS Ventas (
    id_venta SERIAL PRIMARY KEY,
    id_vendedor INTEGER NOT NULL REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    id_tienda INTEGER NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    id_sesion_caja INTEGER REFERENCES SesionCaja(id_sesion) ON DELETE SET NULL,
    id_cliente INTEGER REFERENCES Clientes(id_cliente) ON DELETE SET NULL,
    fecha_salida TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    precio_total NUMERIC(15, 2) NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'Efectivo', -- 'Efectivo', 'Tarjeta', 'Transferencia', 'Fiado'
    estado_deuda VARCHAR(50) DEFAULT 'Pagado', -- 'Pagado', 'Pendiente'
    efectivo_recibido NUMERIC(15, 2) DEFAULT 0,
    cambio_devuelto NUMERIC(15, 2) DEFAULT 0
);

-- 7. TABLA VENTAS-PRODUCTOS
CREATE TABLE IF NOT EXISTS VentasProductos (
    id SERIAL PRIMARY KEY,
    id_venta INTEGER NOT NULL REFERENCES Ventas(id_venta) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES Productos(id_producto) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC(15, 2)
);

-- 8. TABLA ORDENES DE COMPRA
CREATE TABLE IF NOT EXISTS Ordenes_Compra (
    id_orden SERIAL PRIMARY KEY,
    id_tienda INTEGER NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    id_proveedor INTEGER NOT NULL REFERENCES Proveedores(id_proveedor) ON DELETE CASCADE,
    id_usuario INTEGER NOT NULL REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_aprobacion TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50) DEFAULT 'Borrador', -- 'Borrador', 'Enviada', 'Aprobada', 'Rechazada', 'Completada'
    total_estimado NUMERIC(15, 2) DEFAULT 0,
    presupuesto_total NUMERIC(15, 2) DEFAULT 0,
    monto_pagado NUMERIC(15, 2) DEFAULT 0,
    estado_pago VARCHAR(50) DEFAULT 'Pendiente',
    riesgo VARCHAR(50) DEFAULT 'Bajo',
    notas TEXT,
    observaciones TEXT,
    origen VARCHAR(30) DEFAULT 'manual' -- 'manual' | 'consejero' | 'simulador'
);

-- 9. TABLA ORDENES DETALLE
CREATE TABLE IF NOT EXISTS Ordenes_Detalle (
    id_detalle SERIAL PRIMARY KEY,
    id_orden INTEGER NOT NULL REFERENCES Ordenes_Compra(id_orden) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES Productos(id_producto) ON DELETE CASCADE,
    cantidad_sugerida INTEGER,
    cantidad_final INTEGER,
    costo_unitario NUMERIC(15, 2),
    sugerencia_ia INTEGER,
    urgencia VARCHAR(20),
    costo_estimado BOOLEAN DEFAULT FALSE,
    cantidad_recibida INTEGER,
    solicitado_por INTEGER REFERENCES Usuarios(id_usuario) ON DELETE SET NULL
);

-- 10. TABLA ALERTAS
CREATE TABLE IF NOT EXISTS Alertas (
    id_alerta SERIAL PRIMARY KEY,
    id_producto INTEGER REFERENCES Productos(id_producto) ON DELETE CASCADE,
    id_tienda INTEGER REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    tipo VARCHAR(50),
    severidad VARCHAR(50),
    mensaje TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resuelta INTEGER DEFAULT 0,
    fecha_resolucion TIMESTAMP WITH TIME ZONE,
    datos_json TEXT
);

-- 10b. TABLA NOTIFICACIONES DE USUARIO (egresos aprobados/rechazados, etc.)
CREATE TABLE IF NOT EXISTS NotificacionesUsuario (
    id_notificacion SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES Usuarios(id_usuario) ON DELETE CASCADE,
    id_tienda INTEGER REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    datos_json TEXT,
    leida INTEGER DEFAULT 0,
    fecha_lectura TIMESTAMP WITH TIME ZONE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. TABLA AUDITORIA IA
CREATE TABLE IF NOT EXISTS Auditoria_IA (
    id_auditoria SERIAL PRIMARY KEY,
    fecha_auditoria TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id_tienda INTEGER REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    id_orden INTEGER REFERENCES Ordenes_Compra(id_orden) ON DELETE SET NULL,
    motor_ia VARCHAR(100) DEFAULT 'gpt-4o-mini',
    prompt_utilizado TEXT,
    datos_base_json TEXT,
    sugerencia_ia_json TEXT,
    impacto_decision TEXT,
    razon_ia TEXT
);

-- 12. TABLA FEEDBACK IA
CREATE TABLE IF NOT EXISTS Feedback_IA (
    id_feedback SERIAL PRIMARY KEY,
    id_orden INTEGER NOT NULL REFERENCES Ordenes_Compra(id_orden) ON DELETE CASCADE,
    id_producto INTEGER NOT NULL REFERENCES Productos(id_producto) ON DELETE CASCADE,
    cantidad_sugerida INTEGER,
    ventas_reales_periodo INTEGER,
    factor_precision NUMERIC(10, 4),
    dias_con_stock INTEGER DEFAULT 0,
    error_absoluto NUMERIC(10, 4),
    error_porcentual NUMERIC(10, 4),
    bias NUMERIC(10, 4),
    fecha_evaluacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. TABLA PROMOCIONES MANUALES (Human-in-the-Loop)
CREATE TABLE IF NOT EXISTS Promociones_Manuales (
    id_promocion SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES Productos(id_producto) ON DELETE CASCADE,
    id_tienda INTEGER NOT NULL REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    descuento_porcentaje NUMERIC(5, 2) NOT NULL,
    precio_anterior NUMERIC(15, 2),
    precio_nuevo NUMERIC(15, 2),
    motivo VARCHAR(255),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. TABLA HISTORIAL PRECIOS
CREATE TABLE IF NOT EXISTS Historial_Precios (
    id SERIAL PRIMARY KEY,
    id_producto INTEGER NOT NULL REFERENCES Productos(id_producto) ON DELETE CASCADE,
    precio_anterior NUMERIC(15, 2),
    precio_nuevo NUMERIC(15, 2),
    fecha_cambio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    motivo TEXT
);

-- 14. TABLA REPORTES
CREATE TABLE IF NOT EXISTS reportes (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    fecha_reporte DATE NOT NULL,
    creador VARCHAR(255) NOT NULL,
    tipo VARCHAR(100),
    id_tienda INTEGER REFERENCES Tienda(id_tienda) ON DELETE CASCADE,
    fecha_inicio DATE,
    fecha_fin DATE,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. CACHÉ IA PERSISTENTE (sobrevive reinicios de Railway)
CREATE TABLE IF NOT EXISTS Cache_IA (
    clave VARCHAR(64) PRIMARY KEY,
    data_hash VARCHAR(32) NOT NULL,
    datos_json TEXT NOT NULL,
    actualizado_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. TABLA SESIONES (connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- ==========================================
-- 17. ÍNDICES DE RENDIMIENTO MULTI-TIENDA
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_productos_tienda ON Productos(id_tienda);
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON Productos(codigo);
CREATE INDEX IF NOT EXISTS idx_productos_tienda_estado ON Productos(id_tienda, estado);
CREATE INDEX IF NOT EXISTS idx_productos_tienda_nombre ON Productos(id_tienda, nombre_producto);
CREATE INDEX IF NOT EXISTS idx_productos_proveedor ON Productos(id_proveedor);

CREATE INDEX IF NOT EXISTS idx_ventas_tienda ON Ventas(id_tienda);
CREATE INDEX IF NOT EXISTS idx_ventas_tienda_fecha ON Ventas(id_tienda, fecha_salida DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_vendedor ON Ventas(id_vendedor);
CREATE INDEX IF NOT EXISTS idx_ventasprod_venta ON VentasProductos(id_venta);
CREATE INDEX IF NOT EXISTS idx_ventasprod_producto ON VentasProductos(id_producto);

CREATE INDEX IF NOT EXISTS idx_movimientos_tienda_fecha ON MovimientosStock(id_tienda, fecha_movimiento DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON MovimientosStock(id_producto);
CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON MovimientosStock(id_usuario);

CREATE INDEX IF NOT EXISTS idx_alertas_tienda_resuelta ON Alertas(id_tienda, resuelta);
CREATE INDEX IF NOT EXISTS idx_alertas_tienda_fecha ON Alertas(id_tienda, fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_producto ON Alertas(id_producto);

CREATE INDEX IF NOT EXISTS idx_notif_usuario ON NotificacionesUsuario(id_usuario, leida);

CREATE INDEX IF NOT EXISTS idx_ordenes_tienda ON Ordenes_Compra(id_tienda);
CREATE INDEX IF NOT EXISTS idx_ordenes_detalle_orden ON Ordenes_Detalle(id_orden);
CREATE INDEX IF NOT EXISTS idx_proveedores_tienda ON Proveedores(id_tienda);

CREATE INDEX IF NOT EXISTS idx_tienda_propietario ON Tienda(id_propietario);
CREATE INDEX IF NOT EXISTS idx_usuarios_tienda ON Usuarios(id_tienda);
CREATE INDEX IF NOT EXISTS idx_historial_producto ON Historial_Precios(id_producto);
CREATE INDEX IF NOT EXISTS idx_reportes_tienda ON reportes(id_tienda);
CREATE INDEX IF NOT EXISTS idx_auditoria_ia_tienda ON Auditoria_IA(id_tienda);

-- ==========================================
-- DATOS SEMILLA (Adaptados a ON CONFLICT)
-- ==========================================

INSERT INTO Tienda (id_tienda, nombre_establecimiento, direccion, anio_creacion, estado)
VALUES (1, 'Supermercado Central', 'Cra 12 # 8-90', 2018, 'Activo')
ON CONFLICT (id_tienda) DO NOTHING;

INSERT INTO Usuarios (id_usuario, nombres, genero, correo, celular, rol, usuario, contrasena, id_tienda)
VALUES (1, 'Carlos Pérez', 'Masculino', 'carlos@mail.com', '3001234567', 'Tendero', 'carlos', '$2b$10$5QFG27VJIG2OmYFHDAc8u.Wjt4IeZW6j30grtaep43RcxIKhp0S2G', 1)
ON CONFLICT (id_usuario) DO NOTHING;

-- ==========================================
-- SINCRONIZAR SECUENCIAS SERIAL
-- Necesario cuando se insertan filas con IDs explícitos: sin esto,
-- el próximo INSERT automático intenta usar id=1 y choca con duplicado.
-- ==========================================
SELECT setval(pg_get_serial_sequence('Tienda', 'id_tienda'), MAX(id_tienda)) FROM Tienda;
SELECT setval(pg_get_serial_sequence('Usuarios', 'id_usuario'), MAX(id_usuario)) FROM Usuarios;
