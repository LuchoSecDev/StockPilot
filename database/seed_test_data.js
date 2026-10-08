// database/seed_test_data.js
// Seeder de datos de prueba para PostgreSQL — Versión Monolito
// SOLO como comando (`npm run seed`); no hay ruta HTTP. TRUNCATE de toda la base + admin/admin123.
require('dotenv').config();
const { evaluarGuardiaSemilla } = require('./guardiaSemilla');

// La guardia va ANTES de cargar config/database.js: ese módulo se conecta y auto-migra apenas se
// importa, contra cualquier DATABASE_URL, así que hay que negarse antes de tocarlo.
const guardia = evaluarGuardiaSemilla(process.env.DATABASE_URL, { permitirBaseLocal: process.argv.includes('--base-local') });
if (!guardia.ok) {
    console.error(`❌ Semilla abortada: ${guardia.motivo}`);
    process.exit(1);
}

const db = require('../config/database');
const bcrypt = require('bcrypt');

// =============================================
// HELPERS
// =============================================
function dateStr(date) {
    return date.toISOString().split('T')[0];
}

function dateTimeStr(date) {
    return date.toISOString();
}

function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return dateStr(d);
}

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =============================================
// PRODUCTOS — 40 productos realistas
// =============================================
function getProductos() {
    return [
        { codigo: 'GR001', nombre: 'Arroz Diana 1Kg', categoria: 'Granos y cereales', subcategoria: 'Arroz', tipo: 'Grano', precio: 4500, costo: 3200, cantidad: 85, stock_min: 20, stock_max: 150, vencimiento: daysFromNow(180), frecuencia: 7, rotacion: 'A', stock_seguridad: 15, lead_time: 3 },
        { codigo: 'GR002', nombre: 'Arroz Roa 5Kg', categoria: 'Granos y cereales', subcategoria: 'Arroz', tipo: 'Grano', precio: 19500, costo: 14000, cantidad: 30, stock_min: 10, stock_max: 60, vencimiento: daysFromNow(180), frecuencia: 7, rotacion: 'A', stock_seguridad: 8, lead_time: 4 },
        { codigo: 'GR003', nombre: 'Lentejas 500g', categoria: 'Granos y cereales', subcategoria: 'Legumbres', tipo: 'Grano', precio: 3800, costo: 2600, cantidad: 45, stock_min: 15, stock_max: 80, vencimiento: daysFromNow(365), frecuencia: 14, rotacion: 'A', stock_seguridad: 10, lead_time: 5 },
        { codigo: 'GR006', nombre: 'Pasta Doria Espagueti 250g', categoria: 'Granos y cereales', subcategoria: 'Pastas', tipo: 'Pasta', precio: 2800, costo: 1800, cantidad: 60, stock_min: 20, stock_max: 100, vencimiento: daysFromNow(240), frecuencia: 7, rotacion: 'A', stock_seguridad: 15, lead_time: 3 },
        { codigo: 'LA001', nombre: 'Leche Alqueria Entera 1L', categoria: 'Lacteos', subcategoria: 'Leche', tipo: 'Bebida', precio: 4200, costo: 3100, cantidad: 3, stock_min: 15, stock_max: 60, vencimiento: daysFromNow(2), frecuencia: 3, rotacion: 'A', stock_seguridad: 12, lead_time: 2 },
        { codigo: 'LA003', nombre: 'Yogurt Alpina 1L', categoria: 'Lacteos', subcategoria: 'Yogurt', tipo: 'Bebida', precio: 5500, costo: 3800, cantidad: 5, stock_min: 8, stock_max: 30, vencimiento: daysFromNow(3), frecuencia: 5, rotacion: 'A', stock_seguridad: 5, lead_time: 2 },
        { codigo: 'BE001', nombre: 'Coca-Cola 350ml', categoria: 'Bebidas', subcategoria: 'Gaseosas', tipo: 'Bebida', precio: 2500, costo: 1700, cantidad: 120, stock_min: 30, stock_max: 100, vencimiento: daysFromNow(90), frecuencia: 3, rotacion: 'A', stock_seguridad: 24, lead_time: 2 },
        { codigo: 'BE004', nombre: 'Agua Cristal 600ml', categoria: 'Bebidas', subcategoria: 'Agua', tipo: 'Bebida', precio: 1500, costo: 800, cantidad: 150, stock_min: 40, stock_max: 120, vencimiento: daysFromNow(365), frecuencia: 3, rotacion: 'A', stock_seguridad: 30, lead_time: 1 },
        { codigo: 'AS001', nombre: 'Jabon Rey 300g', categoria: 'Aseo', subcategoria: 'Jabon', tipo: 'Limpieza', precio: 2200, costo: 1400, cantidad: 85, stock_min: 10, stock_max: 40, vencimiento: null, frecuencia: 30, rotacion: 'C', stock_seguridad: 12, lead_time: 5 },
        { codigo: 'SN001', nombre: 'Papas Margarita Natural 30g', categoria: 'Snacks', subcategoria: 'Papas', tipo: 'Snack', precio: 2000, costo: 1300, cantidad: 2, stock_min: 15, stock_max: 60, vencimiento: daysFromNow(60), frecuencia: 7, rotacion: 'A', stock_seguridad: 20, lead_time: 2 },
        { codigo: 'SN005', nombre: 'Chocoramo', categoria: 'Snacks', subcategoria: 'Ponques', tipo: 'Snack', precio: 2200, costo: 1500, cantidad: 4, stock_min: 10, stock_max: 40, vencimiento: daysFromNow(15), frecuencia: 7, rotacion: 'A', stock_seguridad: 12, lead_time: 2 },
        { codigo: 'BH001', nombre: 'Aceite Girasol 1L', categoria: 'Basicos hogar', subcategoria: 'Aceites', tipo: 'Aceite', precio: 9500, costo: 6800, cantidad: 18, stock_min: 8, stock_max: 30, vencimiento: daysFromNow(180), frecuencia: 14, rotacion: 'A', stock_seguridad: 6, lead_time: 5 },
        { codigo: 'BH004', nombre: 'Cafe Sello Rojo 250g', categoria: 'Basicos hogar', subcategoria: 'Cafe', tipo: 'Bebida', precio: 7800, costo: 5500, cantidad: 6, stock_min: 8, stock_max: 25, vencimiento: daysFromNow(120), frecuencia: 7, rotacion: 'A', stock_seguridad: 5, lead_time: 4 },
        { codigo: 'BH006', nombre: 'Huevos x30 unidades', categoria: 'Basicos hogar', subcategoria: 'Huevos', tipo: 'Proteina', precio: 16000, costo: 12000, cantidad: 10, stock_min: 5, stock_max: 20, vencimiento: daysFromNow(12), frecuencia: 7, rotacion: 'A', stock_seguridad: 5, lead_time: 2 },
        // Productos vencidos (para poblar el reporte de Auditoría de Merma)
        { codigo: 'VN001', nombre: 'Leche UHT Vencida 1L', categoria: 'Lacteos', subcategoria: 'Leche', tipo: 'Bebida', precio: 4200, costo: 3100, cantidad: 8, stock_min: 5, stock_max: 30, vencimiento: daysFromNow(-3), frecuencia: 3, rotacion: 'A', stock_seguridad: 5, lead_time: 2 },
        { codigo: 'VN002', nombre: 'Yogurt Vencido 200g', categoria: 'Lacteos', subcategoria: 'Yogurt', tipo: 'Bebida', precio: 2800, costo: 1900, cantidad: 12, stock_min: 5, stock_max: 40, vencimiento: daysFromNow(-7), frecuencia: 5, rotacion: 'A', stock_seguridad: 5, lead_time: 2 },
        { codigo: 'VN003', nombre: 'Pan Tajado Vencido 500g', categoria: 'Panaderia', subcategoria: 'Pan', tipo: 'Alimento', precio: 5500, costo: 3800, cantidad: 5, stock_min: 3, stock_max: 20, vencimiento: daysFromNow(-1), frecuencia: 2, rotacion: 'A', stock_seguridad: 3, lead_time: 1 },
        { codigo: 'VN004', nombre: 'Queso Crema Vencido 125g', categoria: 'Lacteos', subcategoria: 'Queso', tipo: 'Alimento', precio: 6200, costo: 4500, cantidad: 3, stock_min: 4, stock_max: 15, vencimiento: daysFromNow(-5), frecuencia: 7, rotacion: 'B', stock_seguridad: 3, lead_time: 2 },
    ];
}

// =============================================
// GENERAR VENTAS REALISTAS
// =============================================
function generateSalesData(productos, tiendaId, vendedorId) {
    const ventas = [];
    const ventaConfig = { 'A': { probDiaria: 0.9, minCant: 2, maxCant: 8 }, 'B': { probDiaria: 0.4, minCant: 1, maxCant: 3 }, 'C': { probDiaria: 0.1, minCant: 1, maxCant: 2 } };

    for (let dia = 30; dia >= 1; dia--) {
        const fecha = daysAgo(dia);
        let itemsVenta = [];
        let totalVenta = 0;

        for (const prod of productos) {
            const config = ventaConfig[prod.rotacion] || ventaConfig['C'];
            if (Math.random() < config.probDiaria) {
                const cantidad = randomInt(config.minCant, config.maxCant);
                const subtotal = cantidad * prod.precio;
                totalVenta += subtotal;
                itemsVenta.push({ productoIndex: productos.indexOf(prod), cantidad, subtotal });
            }
        }

        if (itemsVenta.length > 0) {
            const fechaVenta = new Date(fecha);
            fechaVenta.setHours(randomInt(8, 19), randomInt(0, 59));
            ventas.push({ fecha: dateTimeStr(fechaVenta), vendedorId, tiendaId, total: totalVenta, items: itemsVenta });
        }
    }
    return ventas;
}

// =============================================
// EJECUTAR SEEDER
// =============================================
async function seed() {
    console.log('🚀 Iniciando Seeder PostgreSQL...');
    
    try {
        // 1. Limpiar datos (TRUNCATE)
        const tables = ['Auditoria_IA', 'Feedback_IA', 'Historial_Precios', 'Ordenes_Detalle', 'Ordenes_Compra', 'VentasProductos', 'Ventas', 'MovimientosStock', 'reportes', 'Alertas', 'Productos', 'Proveedores', 'Usuarios', 'Tienda'];
        await db.pool.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
        console.log('  Tablas truncadas.');

        // 2. Tienda y Usuarios
        const tiendaResult = await db.runAsync('INSERT INTO Tienda (nombre_establecimiento, direccion, anio_creacion, estado) VALUES (?, ?, ?, ?) RETURNING id_tienda', ['Distribuidora La Esperanza', 'Kennedy, Bogota', 2020, 'Activo']);
        const tiendaId = tiendaResult.lastID;

        const hashAdmin = await bcrypt.hash('admin123', 10);
        const adminResult = await db.runAsync('INSERT INTO Usuarios (nombres, rol, usuario, contrasena, id_tienda, correo) VALUES (?, ?, ?, ?, ?, ?) RETURNING id_usuario', ['Carlos Admin', 'Administrador', 'admin', hashAdmin, tiendaId, 'admin@test.com']);
        const adminId = adminResult.lastID;

        const hashTendero = await bcrypt.hash('tendero123', 10);
        await db.runAsync('INSERT INTO Usuarios (nombres, rol, usuario, contrasena, id_tienda, correo) VALUES (?, ?, ?, ?, ?, ?) RETURNING id_usuario', ['Laura Tendero', 'Tendero', 'tendero', hashTendero, tiendaId, 'tendero@test.com']);

        // 3. Proveedores
        const provResult = await db.runAsync('INSERT INTO Proveedores (id_tienda, nombre_empresa) VALUES (?, ?) RETURNING id_proveedor', [tiendaId, 'Distribuidora Global']);
        const provId = provResult.lastID;

        // 4. Productos
        const productosData = getProductos();
        const productPromises = productosData.map(p => 
            db.runAsync(
                `INSERT INTO Productos (codigo, nombre_producto, categoria, subcategoria, tipo_producto, precio, cantidad, id_tienda, stock_minimo, stock_maximo, fecha_vencimiento, frecuencia_compra_dias, costo_compra, stock_seguridad, lead_time, id_proveedor)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id_producto`,
                [p.codigo, p.nombre, p.categoria, p.subcategoria, p.tipo, p.precio, p.cantidad, tiendaId, p.stock_min, p.stock_max, p.vencimiento, p.frecuencia, p.costo, p.stock_seguridad, p.lead_time, provId]
            )
        );
        const resArray = await Promise.all(productPromises);
        const productIds = resArray.map(r => r.lastID);

        // 5. Ventas e Historial
        const ventas = generateSalesData(productosData, tiendaId, adminId);
        const ventasPromises = ventas.map(async (v) => {
            const vRes = await db.runAsync('INSERT INTO Ventas (id_vendedor, id_tienda, fecha_salida, precio_total) VALUES (?, ?, ?, ?) RETURNING id_venta', [v.vendedorId, v.tiendaId, v.fecha, v.total]);
            const itemPromises = v.items.map(item => 
                db.runAsync('INSERT INTO VentasProductos (id_venta, id_producto, cantidad) VALUES (?, ?, ?)', [vRes.lastID, productIds[item.productoIndex], item.cantidad])
            );
            await Promise.all(itemPromises);
        });
        await Promise.all(ventasPromises);

        console.log('✅ Seeder completado con éxito.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en seeder:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    seed();
}
