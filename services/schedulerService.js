const cron = require('node-cron');
const db = require('../config/database');
const Alert = require('../models/Alert');
const transporter = require('../config/mailer');
const { createBackup, debeProgramarRespaldoLocal } = require('../utils/backup');

// Función reutilizable para enviar el resumen (usada por cron y por disparo manual)
const runWeeklySummary = async (targetTiendaId = null) => {
    console.log('📧 [Scheduler] Iniciando envío de Resumen de Alertas...');
    
    try {
        let tiendas;
        if (targetTiendaId) {
            tiendas = await db.allAsync('SELECT * FROM Tienda WHERE id_tienda = ?', [targetTiendaId]);
        } else {
            tiendas = await db.allAsync('SELECT * FROM Tienda');
        }
        
        let enviados = 0;
        for (const tienda of tiendas) {
            const stats = await Alert.getStats(tienda.id_tienda);
            
            const criticalAlerts = await db.allAsync(`
                SELECT p.nombre_producto, a.mensaje, a.severidad, a.fecha_creacion
                FROM Alertas a
                JOIN Productos p ON a.id_producto = p.id_producto
                WHERE p.id_tienda = ? AND a.resuelta = 0
                ORDER BY a.fecha_creacion DESC
                LIMIT 5
            `, [tienda.id_tienda]);

            if (stats.total === 0) {
                console.log(`[Scheduler] Tienda ${tienda.nombre_establecimiento}: Sin alertas pendientes. Saltando email.`);
                continue;
            }

            const recipients = await db.allAsync(`
                SELECT correo, nombres FROM Usuarios 
                WHERE id_tienda = ? AND (rol = 'Administrador' OR rol = 'Dueño')
                AND correo IS NOT NULL AND correo != ''
            `, [tienda.id_tienda]);

            if (recipients.length === 0) continue;

            const adminEmails = recipients.map(r => r.correo).join(', ');
            
            const mailOptions = {
                from: `"StockPilot AI Core" <${process.env.EMAIL_USER}>`,
                to: adminEmails,
                subject: `📊 Resumen Semanal de Inventario - ${tienda.nombre_establecimiento}`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                        <div style="background-color: #4f46e5; padding: 30px; text-align: center; color: white;">
                            <h1 style="margin: 0; font-size: 24px; letter-spacing: -0.025em;">StockPilot AI</h1>
                            <p style="margin: 5px 0 0 0; opacity: 0.8; font-size: 14px;">Resumen Ejecutivo de Inventario</p>
                        </div>
                        
                        <div style="padding: 30px;">
                            <h2 style="color: #1e293b; font-size: 18px; margin-top: 0;">Hola, Equipo de ${tienda.nombre_establecimiento}</h2>
                            <p style="line-height: 1.6;">Aquí tienes el estado actual de tu negocio para empezar la semana con claridad:</p>
                            
                            <div style="display: flex; gap: 10px; margin: 25px 0;">
                                <div style="flex: 1; background: #fff1f2; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #fecdd3;">
                                    <span style="display: block; font-size: 20px; font-weight: bold; color: #e11d48;">${stats.critico}</span>
                                    <span style="font-size: 11px; text-transform: uppercase; color: #9f1239; font-weight: bold;">Críticos</span>
                                </div>
                                <div style="flex: 1; background: #fffbeb; border-radius: 8px; padding: 15px; text-align: center; border: 1px solid #fef3c7;">
                                    <span style="display: block; font-size: 20px; font-weight: bold; color: #d97706;">${stats.total - stats.critico}</span>
                                    <span style="font-size: 11px; text-transform: uppercase; color: #92400e; font-weight: bold;">Advertencias</span>
                                </div>
                            </div>

                            <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 15px;">Alertas Prioritarias:</h3>
                            <ul style="list-style: none; padding: 0; margin: 0;">
                                ${criticalAlerts.map(a => `
                                    <li style="padding: 12px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center;">
                                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${a.severidad === 'critico' ? '#ef4444' : '#f59e0b'}; margin-right: 12px;"></span>
                                        <div>
                                            <strong style="font-size: 14px; color: #1e293b;">${a.nombre_producto}</strong>
                                            <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${a.mensaje}</p>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>

                            <div style="margin-top: 30px; text-align: center;">
                                <a href="${process.env.APP_URL || 'http://localhost:5173'}/alertas" 
                                   style="background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                                    Resolver todas las alertas →
                                </a>
                            </div>
                        </div>
                        
                        <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
                            <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                                Este es un mensaje automático de StockPilot. Por favor, no respondas a este correo.
                            </p>
                        </div>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            enviados++;
            console.log(`[Scheduler] Reporte semanal enviado a: ${tienda.nombre_establecimiento} (${recipients.length} admins)`);
        }
        return { success: true, enviados };
    } catch (error) {
        console.error('❌ [Scheduler] Error en el envío:', error);
        throw error;
    }
};

/**
 * Revisa productos con promociones vencidas y restaura su precio original.
 */
const runDailyPriceReversion = async () => {
    console.log('⏳ [Scheduler] Iniciando revisión de reversión de precios...');
    try {
        const expiredProducts = await db.allAsync(`
            SELECT id_producto, id_tienda, nombre_producto, precio_original 
            FROM Productos 
            WHERE fecha_fin_promocion IS NOT NULL 
            AND fecha_fin_promocion <= CURRENT_DATE
        `);

        if (expiredProducts.length === 0) {
            console.log('[Scheduler] No hay precios por revertir hoy.');
            return;
        }

        for (const prod of expiredProducts) {
            const client = await db.getClient();
            try {
                await client.query('BEGIN');
                
                // 1. Restaurar precio
                await client.query(
                    'UPDATE Productos SET precio = precio_original, precio_original = NULL, fecha_fin_promocion = NULL WHERE id_producto = $1',
                    [prod.id_producto]
                );

                // 2. Notificar al sistema
                await client.query(
                    `INSERT INTO Alertas (id_producto, id_tienda, tipo, severidad, mensaje, resuelta)
                     VALUES ($1, $2, 'reversion_precio', 'info', $3, 0)`,
                    [prod.id_producto, prod.id_tienda, `Promoción finalizada. El precio de ${prod.nombre_producto} se ha restaurado automáticamente.`]
                );

                // 3. Registrar en historial
                await client.query(
                    'INSERT INTO Historial_Precios (id_producto, precio_anterior, precio_nuevo, motivo) VALUES ($1, $2, $3, $4)',
                    [prod.id_producto, 0, prod.precio_original, 'Restauración automática post-promoción']
                );

                await client.query('COMMIT');
                console.log(`[Scheduler] Precio restaurado: ${prod.nombre_producto}`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`[Scheduler] Error revirtiendo ${prod.nombre_producto}:`, err);
            } finally {
                client.release();
            }
        }
    } catch (error) {
        console.error('❌ [Scheduler] Error en reversión diaria:', error);
    }
};
/**
 * Evalúa automáticamente la precisión de la IA para las órdenes elegibles.
 */
const runDailyAIEvaluation = async () => {
    console.log('🤖 [Scheduler] Iniciando evaluación diaria de IA...');
    try {
        const feedbackController = require('../controllers/feedbackController');
        
        // Obtener órdenes de todas las tiendas de los últimos 60 días
        const query = `
            SELECT o.id_orden, o.id_tienda
            FROM Ordenes_Compra o
            WHERE o.estado IN ('Aprobada', 'Completada', 'Parcial')
              AND COALESCE(o.fecha_aprobacion, o.fecha_creacion) >= CURRENT_DATE - INTERVAL '60 days'
        `;
        const ordenes = await db.allAsync(query);

        if (ordenes.length === 0) {
            console.log('[Scheduler] No hay órdenes pendientes para evaluar IA.');
            return;
        }

        let evaluadas = 0;
        await Promise.all(ordenes.map(async (orden) => {
            try {
                await feedbackController.evaluateOrderInternal(orden.id_orden);
                evaluadas++;
            } catch (err) {
                console.error(`[Scheduler] Error evaluando orden ${orden.id_orden}:`, err.message);
            }
        }));
        console.log(`[Scheduler] Evaluación IA finalizada. ${evaluadas} órdenes procesadas.`);
    } catch (error) {
        console.error('❌ [Scheduler] Error en evaluación IA diaria:', error);
    }
};

const startScheduler = () => {
    // Resumen semanal: Lunes 8:00 AM
    cron.schedule('0 8 * * 1', () => runWeeklySummary());
    
    // Reversión de precios: Diario a las 00:05 AM
    cron.schedule('5 0 * * *', () => runDailyPriceReversion());

    // Evaluación de Inteligencia Artificial: Diario a las 03:00 AM
    cron.schedule('0 3 * * *', () => runDailyAIEvaluation());

    // Respaldo de PostgreSQL (pg_dump): Diario a las 02:00 AM. Ver debeProgramarRespaldoLocal()
    // en utils/backup.js — en producción no se programa (el respaldo real es el workflow de
    // GitHub Actions, ver docs/restaurar_respaldo.md).
    if (debeProgramarRespaldoLocal()) {
        cron.schedule('0 2 * * *', () => createBackup());
    }

    // Ejecución inmediata al arranque para limpiar promociones que vencieron mientras el servidor estaba apagado
    runDailyPriceReversion();

    console.log('✅ [Scheduler] Servicio de automatización (Diario/Semanal) activado.');
};

module.exports = { startScheduler, runWeeklySummary, runDailyAIEvaluation, createBackup };
