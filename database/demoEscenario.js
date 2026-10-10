/**
 * @file demoEscenario.js
 * @description Plan 25, fase 1. Escenario de la TIENDA DE DEMOSTRACIÓN que se le muestra al dueño de una tienda de barrio:
 * alertas de stock y de vencimiento, un pedido por aprobar, uno listo para enviar y uno por recibir, fiado y caja.
 *
 * Es una función PURA (sin base de datos, sin reloj, sin Math.random): recibe «hoy» y una semilla y devuelve datos
 * con fechas RELATIVAS a «hoy». Por eso hay que volver a sembrar el mismo día de la visita: un vencimiento «en 4 días»
 * deja de serlo mañana. Las cantidades de venta de los productos de alta rotación llevan un pequeño ruido que sale de
 * un generador con semilla (mulberry32): dos corridas con la misma semilla dan exactamente lo mismo.
 *
 * Cómo se provocan las alertas (la regla vive en models/Alert.js y services/inventory/reposicion.js; aquí no se copia,
 * solo se eligen números que la cumplan; tests/business_logic/demo_escenario.test.js lo comprueba con la regla real):
 *   - stock_critico / stock_bajo: los días de stock = floor(stock ÷ ventas por día de los últimos 30 días).
 *     Crítico si ≤ lead_time; «bajo» si ≤ lead_time + frecuencia_compra_dias.
 *   - vencimiento: faltan ≤ 30 días y quedan sobrantes = stock − floor(ventas por día de los últimos 7 × días que faltan).
 *   - sobrestock: stock > stock_maximo, sin ventas (clase C).
 * Ninguna venta cae en los días 0, 7 ni 30 hacia atrás (los bordes de las ventanas de 7 y 30 días: un desfase de
 * zona horaria entre Bogotá y el servidor las movería de ventana), y las horas van de 8 a 16 de Bogotá para no cruzar
 * la medianoche UTC.
 *
 * @module database/demoEscenario
 */

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_DE_HISTORIA = 28;
const DIA_BORDE_7 = 7;
const PRODUCTOS_POR_VENTA = 3;

/** Generador pseudoaleatorio con semilla (mulberry32). */
function crearGenerador(semilla) {
    let a = (Number(semilla) >>> 0) || 1;
    return function siguiente() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function validarHoy(hoy) {
    const ok = typeof hoy === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(hoy) && !Number.isNaN(Date.parse(`${hoy}T00:00:00Z`))
        && new Date(`${hoy}T00:00:00Z`).toISOString().slice(0, 10) === hoy;
    if (!ok) throw new Error(`armarEscenario: «hoy» debe ser una fecha ISO válida (YYYY-MM-DD); llegó ${JSON.stringify(hoy)}`);
}

/** Suma `n` días (puede ser negativo) a una fecha ISO. Aritmética en UTC puro: no depende de la zona horaria de la máquina. */
function sumarDias(iso, n) {
    return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
}

/** Bogotá no tiene horario de verano: siempre UTC−5. */
const instante = (dia, hora, minuto = 0) => `${dia}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-05:00`;

// Venta diaria: `base` unidades por día, de `desde` a `hasta` días atrás, con ruido de ± `ruido`. Venta puntual:
// `dias` = [[días atrás, cantidad], ...]. Sin `ventas`, el producto no se vende.
const diaria = (base, ruido = 0) => ({ diaria: { base, ruido } });
const puntual = (...dias) => ({ puntual: new Map(dias) });

/**
 * El catálogo. `venc` son días desde hoy (negativo = ya vencido). `prov` es 'A' (abarrotes; tiene correo) o 'B'
 * (lácteos y panadería; sin correo, para mostrar el camino «PDF / ya la envié»).
 */
const CATALOGO = [
    // --- Stock crítico: se agotan antes de que llegue el proveedor ---
    { clave: 'leche', nombre: 'Leche Alquería Entera 1L', categoria: 'Lácteos', subcategoria: 'Leche', tipo: 'Bebida', precio: 4200, costo: 3100, cantidad: 6, min: 15, max: 80, seg: 10, lead: 2, freq: 3, venc: 10, prov: 'B', ventas: diaria(8, 2) },
    { clave: 'huevos', nombre: 'Huevos x30 unidades', categoria: 'Básicos del hogar', subcategoria: 'Huevos', tipo: 'Proteína', precio: 16000, costo: 12000, cantidad: 5, min: 5, max: 25, seg: 4, lead: 2, freq: 5, venc: 12, prov: 'A', ventas: diaria(3, 1) },
    { clave: 'arroz', nombre: 'Arroz Diana 1Kg', categoria: 'Granos y cereales', subcategoria: 'Arroz', tipo: 'Grano', precio: 4500, costo: 3200, cantidad: 8, min: 20, max: 150, seg: 10, lead: 3, freq: 7, venc: 180, prov: 'A', ventas: diaria(5, 1) },
    { clave: 'aceite', nombre: 'Aceite Girasol 1L', categoria: 'Básicos del hogar', subcategoria: 'Aceites', tipo: 'Aceite', precio: 9500, costo: 6800, cantidad: 7, min: 8, max: 40, seg: 6, lead: 4, freq: 14, venc: 200, prov: 'A', ventas: diaria(2, 1) },
    // --- Stock bajo: hay que incluirlos en la próxima compra ---
    { clave: 'cafe', nombre: 'Café Sello Rojo 250g', categoria: 'Básicos del hogar', subcategoria: 'Café', tipo: 'Bebida', precio: 7800, costo: 5500, cantidad: 11, min: 8, max: 40, seg: 5, lead: 3, freq: 7, venc: 120, prov: 'A', ventas: diaria(2) },
    { clave: 'pasta', nombre: 'Pasta Doria Espagueti 250g', categoria: 'Granos y cereales', subcategoria: 'Pastas', tipo: 'Pasta', precio: 2800, costo: 1800, cantidad: 21, min: 15, max: 100, seg: 10, lead: 3, freq: 7, venc: 240, prov: 'A', ventas: diaria(4) },
    { clave: 'gaseosa', nombre: 'Coca-Cola 350ml', categoria: 'Bebidas', subcategoria: 'Gaseosas', tipo: 'Bebida', precio: 2500, costo: 1700, cantidad: 40, min: 30, max: 150, seg: 20, lead: 2, freq: 3, venc: 90, prov: 'A', ventas: diaria(10) },
    // --- Vencimiento crítico: vencen en menos de una semana y no se alcanzan a vender ---
    { clave: 'yogur', nombre: 'Yogurt Alpina 1L', categoria: 'Lácteos', subcategoria: 'Yogurt', tipo: 'Bebida', precio: 5500, costo: 3800, cantidad: 14, min: 5, max: 40, seg: 4, lead: 2, freq: 5, venc: 4, prov: 'B', ventas: puntual([2, 1], [5, 1], [9, 1], [14, 1], [21, 1]) },
    { clave: 'queso', nombre: 'Queso campesino 500g', categoria: 'Lácteos', subcategoria: 'Queso', tipo: 'Alimento', precio: 9800, costo: 7000, cantidad: 10, min: 4, max: 30, seg: 3, lead: 2, freq: 5, venc: 6, prov: 'B', ventas: puntual([3, 1], [10, 1], [15, 1], [24, 1]) },
    // --- Vencimiento próximo: vencen en 3 o 4 semanas y sobrarían unidades ---
    { clave: 'galletas', nombre: 'Galletas Saltín Noel', categoria: 'Snacks', subcategoria: 'Galletas', tipo: 'Snack', precio: 2800, costo: 1900, cantidad: 20, min: 8, max: 60, seg: 6, lead: 3, freq: 7, venc: 20, prov: 'A', ventas: puntual([2, 2], [5, 2], [10, 2], [16, 2], [22, 2]) },
    { clave: 'mermelada', nombre: 'Mermelada de guayaba 450g', categoria: 'Básicos del hogar', subcategoria: 'Dulces', tipo: 'Alimento', precio: 4800, costo: 3400, cantidad: 18, min: 6, max: 40, seg: 4, lead: 3, freq: 7, venc: 25, prov: 'A', ventas: puntual([3, 1], [6, 1], [12, 1], [19, 1], [26, 1]) },
    // --- Sobrestock: capital quieto, sin ventas ---
    { clave: 'jabon', nombre: 'Jabón de loza Axion 500g', categoria: 'Aseo', subcategoria: 'Jabón', tipo: 'Limpieza', precio: 3200, costo: 2100, cantidad: 60, min: 10, max: 40, seg: 8, lead: 4, freq: 14, venc: null, prov: 'A', ventas: null },
    // --- Ya vencidos (reporte de merma): no generan alerta ---
    { clave: 'lecheVencida', nombre: 'Leche UHT 1L (vencida)', categoria: 'Lácteos', subcategoria: 'Leche', tipo: 'Bebida', precio: 4200, costo: 3100, cantidad: 8, min: 3, max: 50, seg: 3, lead: 2, freq: 3, venc: -4, prov: 'B', ventas: null },
    { clave: 'panVencido', nombre: 'Pan tajado Bimbo 500g (vencido)', categoria: 'Panadería', subcategoria: 'Pan', tipo: 'Alimento', precio: 5500, costo: 3800, cantidad: 5, min: 3, max: 20, seg: 3, lead: 1, freq: 2, venc: -2, prov: 'B', ventas: null },
    // --- Sanos: tienen para varias semanas ---
    { clave: 'azucar', nombre: 'Azúcar Manuelita 1Kg', categoria: 'Granos y cereales', subcategoria: 'Azúcar', tipo: 'Grano', precio: 3600, costo: 2700, cantidad: 40, min: 15, max: 100, seg: 10, lead: 3, freq: 7, venc: 300, prov: 'A', ventas: diaria(3, 1) },
    { clave: 'sal', nombre: 'Sal Refisal 500g', categoria: 'Básicos del hogar', subcategoria: 'Sal', tipo: 'Condimento', precio: 1500, costo: 900, cantidad: 50, min: 15, max: 120, seg: 10, lead: 3, freq: 14, venc: 700, prov: 'A', ventas: diaria(1) },
    { clave: 'lentejas', nombre: 'Lentejas 500g', categoria: 'Granos y cereales', subcategoria: 'Legumbres', tipo: 'Grano', precio: 3800, costo: 2600, cantidad: 45, min: 15, max: 80, seg: 10, lead: 5, freq: 14, venc: 365, prov: 'A', ventas: diaria(1, 1) },
    { clave: 'arrozRoa', nombre: 'Arroz Roa 5Kg', categoria: 'Granos y cereales', subcategoria: 'Arroz', tipo: 'Grano', precio: 19500, costo: 14000, cantidad: 25, min: 8, max: 60, seg: 6, lead: 4, freq: 7, venc: 180, prov: 'A', ventas: diaria(1) },
    { clave: 'atun', nombre: 'Atún Van Camp 160g', categoria: 'Enlatados', subcategoria: 'Atún', tipo: 'Enlatado', precio: 5200, costo: 3700, cantidad: 36, min: 10, max: 100, seg: 8, lead: 3, freq: 14, venc: 500, prov: 'A', ventas: diaria(2, 1) },
    { clave: 'panela', nombre: 'Panela 500g', categoria: 'Granos y cereales', subcategoria: 'Panela', tipo: 'Grano', precio: 3400, costo: 2400, cantidad: 30, min: 10, max: 80, seg: 8, lead: 3, freq: 14, venc: 240, prov: 'A', ventas: diaria(1) },
    { clave: 'harina', nombre: 'Harina de trigo Haz de Oros 1Kg', categoria: 'Granos y cereales', subcategoria: 'Harinas', tipo: 'Grano', precio: 3100, costo: 2200, cantidad: 28, min: 10, max: 80, seg: 8, lead: 3, freq: 14, venc: 270, prov: 'A', ventas: diaria(1) },
    { clave: 'chocolate', nombre: 'Chocolate Corona 250g', categoria: 'Básicos del hogar', subcategoria: 'Chocolate', tipo: 'Bebida', precio: 6900, costo: 4900, cantidad: 22, min: 8, max: 60, seg: 5, lead: 3, freq: 14, venc: 300, prov: 'A', ventas: diaria(1) },
    { clave: 'papas', nombre: 'Papas Margarita Natural 30g', categoria: 'Snacks', subcategoria: 'Papas', tipo: 'Snack', precio: 2000, costo: 1300, cantidad: 70, min: 20, max: 160, seg: 15, lead: 2, freq: 7, venc: 90, prov: 'A', ventas: diaria(5, 2) },
    { clave: 'agua', nombre: 'Agua Cristal 600ml', categoria: 'Bebidas', subcategoria: 'Agua', tipo: 'Bebida', precio: 1500, costo: 800, cantidad: 120, min: 40, max: 250, seg: 30, lead: 1, freq: 3, venc: 365, prov: 'A', ventas: diaria(12, 3) },
    { clave: 'cerveza', nombre: 'Cerveza Poker 330ml', categoria: 'Bebidas', subcategoria: 'Cerveza', tipo: 'Bebida', precio: 2800, costo: 2100, cantidad: 90, min: 30, max: 200, seg: 24, lead: 2, freq: 5, venc: 180, prov: 'A', ventas: diaria(6, 2) },
    { clave: 'detergente', nombre: 'Detergente Fab 500g', categoria: 'Aseo', subcategoria: 'Detergente', tipo: 'Limpieza', precio: 4500, costo: 3200, cantidad: 30, min: 10, max: 60, seg: 8, lead: 4, freq: 14, venc: null, prov: 'A', ventas: diaria(1) },
    { clave: 'mantequilla', nombre: 'Mantequilla Alpina 250g', categoria: 'Lácteos', subcategoria: 'Mantequilla', tipo: 'Alimento', precio: 6200, costo: 4400, cantidad: 20, min: 6, max: 60, seg: 5, lead: 2, freq: 7, venc: 60, prov: 'B', ventas: diaria(1) },
    { clave: 'kumis', nombre: 'Kumis Alpina 1L', categoria: 'Lácteos', subcategoria: 'Kumis', tipo: 'Bebida', precio: 4800, costo: 3500, cantidad: 18, min: 6, max: 50, seg: 4, lead: 2, freq: 7, venc: 45, prov: 'B', ventas: diaria(1) },
];

// Fiado: ventas puntuales a clientes de confianza (los productos son de los «sanos», para no mover las alertas).
const FIADOS = [
    { cliente: 'marta', diasAtras: 9, hora: 15, items: [['arrozRoa', 1], ['lentejas', 2], ['azucar', 2]] },
    { cliente: 'marta', diasAtras: 3, hora: 15, items: [['atun', 2], ['panela', 1]] },
    { cliente: 'lucia', diasAtras: 4, hora: 15, items: [['harina', 2], ['sal', 3], ['detergente', 1]] },
];

const CLIENTES = [
    { clave: 'marta', nombre: 'Marta Rodríguez', celular: '3001112233', limite_credito: 150000 },
    { clave: 'jairo', nombre: 'Jairo Pardo', celular: '3004445566', limite_credito: 100000 },
    { clave: 'lucia', nombre: 'Lucía Gómez', celular: '3007778899', limite_credito: 80000 },
];

const ABONOS = [{ cliente: 'marta', diasAtras: 1, monto: 20000, metodo_pago: 'Efectivo', sesion: 'ayer' }];

/**
 * Pedidos: líneas por clave de producto y cantidad. El costo sale del catálogo. Cada pedido lleva productos DISTINTOS de los
 * que /pedir sugiere en vivo (arroz, aceite, huevos, leche) y de los del borrador: así la pantalla no sugiere pedir lo que ya
 * está pedido. El aprobado es una reposición rutinaria; el enviado, de lácteos sanos; el borrador, lo de «stock bajo».
 */
const PEDIDOS = [
    { clave: 'aprobada', proveedor: 'A', estado: 'Aprobada', diasAtras: 0, riesgo: 'Medio', lineas: [['azucar', 30, 'En esta compra'], ['atun', 24, 'En esta compra'], ['papas', 48, 'En esta compra']] },
    { clave: 'borrador', proveedor: 'A', estado: 'Borrador', diasAtras: 0, riesgo: 'Bajo', lineas: [['cafe', 20, 'En esta compra'], ['pasta', 40, 'En esta compra'], ['gaseosa', 60, 'En esta compra']] },
    { clave: 'enviada', proveedor: 'B', estado: 'Enviada', diasAtras: 2, riesgo: 'Medio', lineas: [['mantequilla', 18, 'En esta compra'], ['kumis', 12, 'En esta compra']] },
];

/**
 * @param {Object} opciones
 * @param {string} opciones.hoy - Fecha de Bogotá, ISO (YYYY-MM-DD).
 * @param {number} opciones.semilla - Semilla del generador de ruido.
 * @param {string} [opciones.correoProveedor] - Correo del proveedor A (D3 = B: un buzón del equipo). Si falta, un correo
 *   que no existe (@example.invalid): el envío fallaría y la demostración usa el PDF.
 * @returns {Object} Todos los datos del escenario (ver las claves del objeto devuelto).
 */
function armarEscenario({ hoy, semilla, correoProveedor } = {}) {
    validarHoy(hoy);
    const azar = crearGenerador(semilla);
    const dia = (diasAtras) => sumarDias(hoy, -diasAtras);

    const tienda = {
        nombre_establecimiento: 'Tienda Demo La Esperanza', direccion: 'Calle 45 # 12-30', ciudad: 'Bogotá',
        anio_creacion: 2021, celular: '3000000000', es_prueba: true, dias_apertura_semana: 7,
        fecha_creacion: instante(dia(30), 8)
    };
    const admin = {
        nombres: 'Administrador Demo', genero: 'Otro', correo: 'demo.admin@example.invalid', celular: '3000000000',
        usuario: 'demo', rol: 'Administrador'
    };
    const proveedores = [
        { clave: 'A', nombre_empresa: 'Distribuidora La Sabana', nit: '900123456-1', contacto_principal: 'Carlos Ruiz', telefono: '3101234567',
          email: correoProveedor || 'proveedor.demo@example.invalid', direccion: 'Carrera 30 # 10-20, Bogotá' },
        { clave: 'B', nombre_empresa: 'Lácteos y Panadería del Norte', nit: '900654321-2', contacto_principal: 'Ana Torres', telefono: '3207654321',
          email: null, direccion: 'Calle 80 # 50-10, Bogotá' }
    ];

    const productos = CATALOGO.map((c) => ({
        clave: c.clave, codigo: `DEMO-${c.clave.toUpperCase()}`, nombre: c.nombre, categoria: c.categoria, subcategoria: c.subcategoria,
        tipo: c.tipo, precio: c.precio, costo: c.costo, cantidad: c.cantidad, stock_minimo: c.min, stock_maximo: c.max,
        stock_seguridad: c.seg, lead_time: c.lead, frecuencia_compra_dias: c.freq,
        vencimiento: c.venc === null ? null : sumarDias(hoy, c.venc), proveedor: c.prov, fecha_entrada: dia(29)
    }));
    const porClave = new Map(productos.map((p) => [p.clave, p]));

    // --- Ventas de mostrador: un día a la vez, productos en el orden del catálogo, de a PRODUCTOS_POR_VENTA por venta ---
    const ventas = [];
    for (let d = DIAS_DE_HISTORIA; d >= 1; d--) {
        if (d === DIA_BORDE_7) continue; // borde de la ventana de 7 días
        const lineas = [];
        for (const c of CATALOGO) {
            if (!c.ventas) continue;
            let cantidad = 0;
            if (c.ventas.diaria) {
                const { base, ruido } = c.ventas.diaria;
                cantidad = Math.max(1, base + (ruido ? Math.floor(azar() * (2 * ruido + 1)) - ruido : 0));
            } else if (c.ventas.puntual.has(d)) {
                cantidad = c.ventas.puntual.get(d);
            }
            if (cantidad > 0) lineas.push({ producto: c.clave, cantidad });
        }
        for (let i = 0; i < lineas.length; i += PRODUCTOS_POR_VENTA) {
            const n = i / PRODUCTOS_POR_VENTA;
            ventas.push({ diasAtras: d, hora: 8 + (n % 9), items: lineas.slice(i, i + PRODUCTOS_POR_VENTA), metodo_pago: null, cliente: null });
        }
    }
    FIADOS.forEach((f) => ventas.push({
        diasAtras: f.diasAtras, hora: f.hora, metodo_pago: 'Fiado', cliente: f.cliente,
        items: f.items.map(([producto, cantidad]) => ({ producto, cantidad }))
    }));
    ventas.sort((a, b) => (b.diasAtras - a.diasAtras) || (a.hora - b.hora));

    ventas.forEach((v, i) => {
        v.id = i + 1;
        v.dia = dia(v.diasAtras);
        v.items = v.items.map((it) => ({ producto: it.producto, cantidad: it.cantidad, precio: porClave.get(it.producto).precio }));
        v.total = v.items.reduce((s, it) => s + it.cantidad * it.precio, 0);
        if (!v.metodo_pago) v.metodo_pago = v.id % 6 === 0 ? 'Transferencia' : (v.id % 5 === 0 ? 'Tarjeta' : 'Efectivo');
        v.estado_deuda = v.metodo_pago === 'Fiado' ? 'Pendiente' : 'Pagado';
        v.efectivo_recibido = v.metodo_pago === 'Efectivo' ? Math.ceil(v.total / 1000) * 1000 : 0;
        v.cambio_devuelto = v.metodo_pago === 'Efectivo' ? v.efectivo_recibido - v.total : 0;
        v.instante = instante(v.dia, v.hora, (v.id * 7) % 60);
        v.sesion = v.diasAtras === 1 ? 'ayer' : null;
    });

    // --- Caja de ayer, ya cerrada, con el arqueo calculado como lo hace models/CashRegister.calcularArqueo ---
    const abonos = ABONOS.map((a) => ({ cliente: a.cliente, monto: a.monto, metodo_pago: a.metodo_pago, dia: dia(a.diasAtras), instante: instante(dia(a.diasAtras), 12), sesion: a.sesion }));
    const egresos = [{
        sesion: 'ayer', monto: 12000, motivo: 'Hielo y bolsas para la tienda', categoria: 'Otro', estado: 'Aprobado', instante: instante(dia(1), 11)
    }];
    const efectivoVentas = ventas.filter((v) => v.sesion === 'ayer' && v.metodo_pago === 'Efectivo').reduce((s, v) => s + v.total, 0);
    const efectivoAbonos = abonos.filter((a) => a.sesion === 'ayer' && a.metodo_pago === 'Efectivo').reduce((s, a) => s + a.monto, 0);
    const totalEgresos = egresos.filter((e) => e.sesion === 'ayer' && e.estado !== 'Rechazado').reduce((s, e) => s + e.monto, 0);
    const monto_apertura = 50000;
    const monto_cierre_calculado = monto_apertura + efectivoVentas + efectivoAbonos - totalEgresos;
    const monto_cierre_declarado = monto_cierre_calculado - 1500; // faltan $1.500: así se ve cómo se muestra una diferencia
    const sesiones = [{
        clave: 'ayer', estado: 'Cerrada', monto_apertura, monto_cierre_calculado, monto_cierre_declarado,
        diferencia: monto_cierre_declarado - monto_cierre_calculado,
        fecha_apertura: instante(dia(1), 7, 30), fecha_cierre: instante(dia(1), 17, 45)
    }];

    // --- Pedidos ---
    const ordenes = PEDIDOS.map((o) => {
        const lineas = o.lineas.map(([producto, cantidad, urgencia]) => ({
            producto, cantidad_sugerida: cantidad, cantidad_final: cantidad, costo_unitario: porClave.get(producto).costo, urgencia
        }));
        const aprobada = o.estado !== 'Borrador';
        return {
            clave: o.clave, proveedor: o.proveedor, estado: o.estado, origen: 'consejero', riesgo: o.riesgo, lineas,
            presupuesto_total: lineas.reduce((s, l) => s + l.cantidad_final * l.costo_unitario, 0),
            fecha_creacion: instante(dia(o.diasAtras), 9), fecha_aprobacion: aprobada ? instante(dia(o.diasAtras), 9, 30) : null
        };
    });

    // --- Kardex: entrada inicial (hace 29 días) y una salida por cada línea vendida, con el saldo corriente ---
    const vendido = new Map(productos.map((p) => [p.clave, 0]));
    ventas.forEach((v) => v.items.forEach((it) => vendido.set(it.producto, vendido.get(it.producto) + it.cantidad)));
    const saldo = new Map();
    const movimientos = [];
    productos.forEach((p) => {
        const inicial = p.cantidad + vendido.get(p.clave);
        saldo.set(p.clave, inicial);
        movimientos.push({ producto: p.clave, tipo_movimiento: 'Entrada', cantidad: inicial, stock_final: inicial, instante: instante(dia(29), 8), venta: null, observacion: 'Inventario inicial' });
    });
    ventas.forEach((v) => v.items.forEach((it) => {
        const nuevo = saldo.get(it.producto) - it.cantidad;
        saldo.set(it.producto, nuevo);
        movimientos.push({ producto: it.producto, tipo_movimiento: 'Salida', cantidad: it.cantidad, stock_final: nuevo, instante: v.instante, venta: v.id, observacion: null });
    }));

    return {
        hoy, semilla, tienda, admin, proveedores, productos, clientes: CLIENTES.map((c) => ({ ...c })),
        ventas, abonos, sesiones, egresos, ordenes, movimientos
    };
}

module.exports = { armarEscenario };
