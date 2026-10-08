// app.js - VERSIÓN MVC COMPLETA
require('dotenv').config();

// Validación temprana de variables de entorno obligatorias
if (!process.env.SESSION_SECRET) {
    console.error('❌ FATAL: SESSION_SECRET no está definido en las variables de entorno.');
    console.error('   Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
}

const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression'); // 🚀 Nuevo: Compresión para Producción
const { manejadorErrores } = require('./middleware/errorHandler');
const { csrfSync } = require('csrf-sync');
const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] || req.headers['X-CSRF-Token']
});
const { logger, requestLogger } = require('./utils/logger');
const { globalLimiter, authLimiter, aiLimiter, twoFactorLimiter, twoFactorSetupLimiter, resetCodeLimiter, forgotEmailLimiter, forgotIpLimiter, internoLoginLimiter, internoSegundoFactorLimiter } = require('./middleware/rateLimiter');
const { requireAdmin2FAConfigurado } = require('./middleware/twoFactor');

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const reportRoutes = require('./routes/reportRoutes');
const tenderoRoutes = require('./routes/tenderoRoutes');
const cashRegisterRoutes = require('./routes/cashRegisterRoutes');
const exportRoutes = require('./routes/exportRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const aiRoutes = require('./routes/aiRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const ordenBorradorRoutes = require('./routes/ordenBorradorRoutes');
const alertRoutes = require('./routes/alertRoutes');
const auditRoutes = require('./routes/auditRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const internoRoutes = require('./routes/internoRoutes');
const scheduler = require('./services/schedulerService');

const app = express();
const PORT = process.env.PORT || 3001;

// 🛡️ REQUISITO PARA CLOUD (Railway/Heroku): Confiar en el proxy inverso
app.set('trust proxy', 1);

// Orígenes permitidos: leer desde env, con fallback para desarrollo local
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174'];

console.log('📍 Origins permitidos:', allowedOrigins);

// 🛡️ SEGURIDAD: Bloquear métodos HTTP no deseados (ej. TRACE, TRACK)
const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];
app.use((req, res, next) => {
    if (!allowedMethods.includes(req.method)) {
        return res.status(405).send('Method Not Allowed');
    }
    next();
});

// 🛡️ SEGURIDAD: Configuración de Helmet (Cabeceras de respuesta seguras — OWASP A05)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'", ...allowedOrigins]
        }
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // 🛡️ HSTS: Forzar HTTPS durante 1 año + incluir subdominios
    hsts: {
        maxAge: 31536000, // 1 año en segundos
        includeSubDomains: true,
        preload: true
    },
    // 🛡️ Referrer-Policy explícito
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// 🛡️ SEGURIDAD: Permissions-Policy (restringir APIs del navegador)
app.use((req, res, next) => {
    // Se permite la cámara para la funcionalidad de escaneo de QR/Barcode en Producción
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
    next();
});

// 🛡️ SEGURIDAD: Cache-Control para respuestas de API (no cachear datos sensibles)
app.use('/api/', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    next();
});

// Configuración del servidor
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(compression()); // 🚀 Habilitar compresión GZIP/Brotli para todas las respuestas (ahorro ~70% de ancho de banda)

// 🛡️ LOGGING: Registrar todas las peticiones HTTP (OWASP A09)
app.use(requestLogger);

const pgSession = require('connect-pg-simple')(session);
const db = require('./config/database');
const redisClient = require('./config/redis');
const { RedisStore } = require('connect-redis');

// Fallback dinámico: Redis si está configurado, si no Postgres.
const sessionStore = redisClient 
    ? new RedisStore({ client: redisClient }) 
    : new pgSession({
        pool: db.pool,                // Usar el pool de conexiones de Postgres
        tableName: 'session',         // Se creará automáticamente o mediante init_pg.sql
        createTableIfMissing: true    // Auto-creación de tabla de sesiones
    });

// 🛡️ SEGURIDAD: Configuración de Sesión Hardened
app.use(session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, 
    rolling: true, // 🛡️ Idle Timeout: Renueva la cookie en cada request, expirará si hay inactividad
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        httpOnly: true, 
        maxAge: 1000 * 60 * 30, // 30 minutos
        sameSite: 'strict' 
    }
}));

// 🛡️ SEGURIDAD: Límite de peticiones (aplicado después de session para identificar por usuario)
app.use('/api/', globalLimiter);

// 🛡️ SEGURIDAD: Configuración CSRF global
app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: generateToken(req) });
});
// Excluimos rutas de autenticación tempranas donde aún no hay sesión establecida.
app.use('/api/', (req, res, next) => {
    const publicPaths = ['/login', '/registro', '/2fa/verify'];
    if (publicPaths.includes(req.path)) {
        return next();
    }
    csrfSynchronisedProtection(req, res, next);
});

// 🛡️ SEGURIDAD: Límite drástico en endpoints críticos (Fuerza Bruta)
app.use('/api/login', authLimiter);
app.use('/api/registro', authLimiter);
app.use('/api/forgot-password', authLimiter);
// Pedir el código de recuperación: 3 por correo y 10 por IP cada 15 min (cuentan todas las peticiones).
app.use('/api/forgot-password', forgotEmailLimiter, forgotIpLimiter);
app.use('/api/reset-password', authLimiter);
// Código de recuperación: 5 intentos fallidos por correo en 15 min, compartidos entre los dos endpoints que lo comprueban.
app.use('/api/verify-reset-code', resetCodeLimiter);
app.use('/api/reset-password', resetCodeLimiter);
app.use('/api/2fa/verify', twoFactorLimiter);
app.use('/api/2fa/generate', twoFactorSetupLimiter);
app.use('/api/2fa/disable', twoFactorSetupLimiter);
app.use('/api/interno/login', internoLoginLimiter);
app.use('/api/interno/2fa', internoSegundoFactorLimiter);

// 🛡️ SEGURIDAD: política de 2FA del Administrador (apagada por defecto; ver middleware/twoFactor.js)
app.use('/api/', requireAdmin2FAConfigurado);

// Usar rutas
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ia', aiLimiter, aiRoutes);
// Panel interno del equipo (plan 22): sesión y rutas aparte de las de tienda. Antes de los routers montados en '/' y de '/api'.
app.use('/api/interno', internoRoutes);
app.use('/', authRoutes);
app.use('/', storeRoutes);
app.use('/', cashRegisterRoutes);
app.use('/', productRoutes);
app.use('/', saleRoutes);
app.use('/', reportRoutes);
app.use('/', tenderoRoutes);
app.use('/', exportRoutes);
app.use('/', inventoryRoutes);
app.use('/', ordenBorradorRoutes); // antes que supplierRoutes: /api/ordenes/borradores/resumen no debe caer en /api/ordenes/:ordenId
app.use('/', supplierRoutes);
app.use('/api/alertas', alertRoutes);
app.use('/api/auditoria', auditRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/notificaciones', notificationRoutes);
app.use('/api', clienteRoutes);

// 🛡️ SEGURIDAD: Servir el Frontend en PRODUCCIÓN
if (process.env.NODE_ENV === 'production') {
    const frontendDistPath = path.join(__dirname, 'frontend', 'dist');
    app.use(express.static(frontendDistPath));

    // Si no es una ruta de API, devuelve el index.html de React (Manejador SPA)
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(frontendDistPath, 'index.html'));
        }
    });
}

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

// Manejo de errores global (middleware/errorHandler.js)
app.use(manejadorErrores);

// Manejo de rechazos no controlados
process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, '❌ RECHAZO NO MANEJADO');
});

// ✅ ARRANQUE RESILIENTE PARA WINDOWS + NODEMON
let retries = 0;
const MAX_RETRIES = 5;

function startServer(port) {
    const server = app.listen(port);

    server.on('listening', async () => {
        retries = 0; // Reset en caso de éxito
        console.log('✅ Servidor MVC corriendo en puerto ' + port);
        console.log('📁 Arquitectura MVC completada exitosamente');
        console.log('📍 Orígenes CORS permitidos:', allowedOrigins.join(', '));
    });

    // Cierre limpio para nodemon y terminación de proceso en Windows
    const handleShutdown = () => {
        server.close(() => {
            process.exit(0);
        });
    };
    process.once('SIGINT', handleShutdown);
    process.once('SIGTERM', handleShutdown);
    process.once('SIGUSR2', () => {
        server.close(() => {
            process.kill(process.pid, 'SIGUSR2');
        });
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            retries++;
            if (retries === 1) {
                console.log(`⏳ Puerto ${port} ocupado. Liberando puerto automáticamente con kill-port...`);
                try {
                    const killPort = require('kill-port');
                    killPort(port).catch(() => {}).finally(() => {
                        setTimeout(() => startServer(port), 600);
                    });
                    return;
                } catch {
                    // Fallback a reintentos normales si kill-port no está presente
                }
            }

            if (retries <= MAX_RETRIES) {
                console.log(`⏳ Puerto ${port} ocupado. Reintentando... (intento ${retries}/${MAX_RETRIES})`);
                setTimeout(() => startServer(port), 1200);
            } else {
                console.log(`❌ No se pudo obtener el puerto ${port} después de ${MAX_RETRIES} intentos.`);
                process.exit(1);
            }
        } else {
            console.log('❌ Error de servidor:', err.message);
            process.exit(1);
        }
    });
}

// 🛡️ VALIDACIÓN ESTRICTA EN PRODUCCIÓN ANTES DE ARRANCAR
if (process.env.NODE_ENV === 'production') {
    const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET', 'OPENAI_API_KEY'];
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if (missingVars.length > 0) {
        console.error('❌ FATAL (PRODUCCIÓN): Faltan las siguientes variables de entorno críticas:', missingVars.join(', '));
        console.error('   El servidor se detendrá por seguridad. Configúralas en tu entorno de despliegue (ej. Render/Railway).');
        process.exit(1);
    }
}

// Solo abrir un puerto real y arrancar los cron jobs cuando este archivo se ejecuta directamente
// (`node app.js`, `npm start`, `npm run dev`) — no cuando una prueba de integración lo importa con
// `require('../../app')` para usarlo con supertest (plan 20, Nivel 2). `require.main === module`
// es `true` exactamente en los mismos casos que antes corrían este bloque sin condición.
if (require.main === module) {
    // Iniciar planeador de tareas automáticas (Cron Jobs)
    scheduler.startScheduler();
    startServer(PORT);
}

module.exports = app;