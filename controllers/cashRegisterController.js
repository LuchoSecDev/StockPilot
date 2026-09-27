const CashRegister = require('../models/CashRegister');
const Store = require('../models/Store');
const Notification = require('../models/Notification');
const db = require('../config/database');
const { evaluarDescuadreCaja } = require('../utils/cashRegisterHelpers');

class CashRegisterController {
    static async getCurrentSession(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const id_vendedor = req.session.userId;
            
            const session = await CashRegister.getCurrentSession(id_tienda, id_vendedor);
            
            if (session) {
                res.json({ active: true, session });
            } else {
                res.json({ active: false });
            }
        } catch (error) {
            console.error('Error fetching cash register session:', error);
            res.status(500).json({ error: 'Error interno del servidor al verificar caja' });
        }
    }

    static async openSession(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const id_vendedor = req.session.userId;
            const { monto_apertura } = req.body;

            // Verificar que no haya una caja abierta ya
            const activeSession = await CashRegister.getCurrentSession(id_tienda, id_vendedor);
            if (activeSession) {
                return res.status(400).json({ error: 'Ya tienes una sesión de caja abierta.' });
            }

            if (monto_apertura === undefined || monto_apertura < 0) {
                return res.status(400).json({ error: 'El monto de apertura no es válido.' });
            }

            const result = await CashRegister.openSession(id_tienda, id_vendedor, monto_apertura);
            res.json({ success: true, message: 'Caja abierta exitosamente', id_sesion: result.id_sesion });
        } catch (error) {
            console.error('Error opening cash register session:', error);
            res.status(500).json({ error: 'Error al abrir la caja' });
        }
    }

    static async closeSession(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const id_vendedor = req.session.userId;
            const { monto_cierre_declarado } = req.body;

            // Buscar sesión activa
            const activeSession = await CashRegister.getCurrentSession(id_tienda, id_vendedor);
            if (!activeSession) {
                return res.status(400).json({ error: 'No hay ninguna caja abierta para cerrar.' });
            }

            if (monto_cierre_declarado === undefined || monto_cierre_declarado < 0) {
                return res.status(400).json({ error: 'El monto de cierre declarado no es válido.' });
            }

            const arqueo = await CashRegister.closeSession(activeSession.id_sesion, monto_cierre_declarado);

            const { esSignificativo, titulo, mensaje } = evaluarDescuadreCaja(arqueo.diferencia);
            if (esSignificativo) {
                await Notification.create({
                    id_usuario: id_vendedor,
                    id_tienda,
                    tipo: 'descuadre_caja',
                    titulo,
                    mensaje,
                    datos_json: JSON.stringify({ diferencia: arqueo.diferencia, id_sesion: activeSession.id_sesion })
                });
            }

            res.json({ success: true, message: 'Caja cerrada exitosamente (Arqueo completo)', arqueo });
        } catch (error) {
            console.error('Error closing cash register session:', error);
            res.status(500).json({ error: 'Error al cerrar la caja' });
        }
    }

    static async getHistory(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const history = await CashRegister.getSessionsHistory(id_tienda);
            res.json({ success: true, history });
        } catch (error) {
            console.error('Error fetching cash register history:', error);
            res.status(500).json({ error: 'Error al obtener el historial de caja' });
        }
    }
    // ==========================================
    // CONTROLADORES DE EGRESOS / GASTOS MENORES
    // ==========================================

    static async registerExpense(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const id_usuario = req.session.userId;
            const { monto, motivo, categoria, foto_soporte } = req.body;

            const activeSession = await CashRegister.getCurrentSession(id_tienda, id_usuario);
            if (!activeSession) {
                return res.status(400).json({ error: 'No hay ninguna caja abierta. No puedes registrar gastos.' });
            }

            if (!monto || monto <= 0) {
                return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
            }

            if (!motivo || motivo.trim().length < 5) {
                return res.status(400).json({ error: 'Debes proporcionar un motivo válido (mínimo 5 caracteres).' });
            }

            // Validación de seguridad para foto_soporte
            if (foto_soporte) {
                // Verificar que sea JPEG o PNG
                if (!foto_soporte.startsWith('data:image/jpeg;base64,') && !foto_soporte.startsWith('data:image/png;base64,')) {
                    return res.status(400).json({ error: 'Formato de imagen no permitido. Solo se acepta JPG o PNG.' });
                }

                // Verificar tamaño (~2MB)
                // base64 ratio es 4:3. 2MB = 2097152 bytes. String max length: 2097152 * (4/3) = ~2796202
                if (foto_soporte.length > 2800000) {
                    return res.status(400).json({ error: 'La imagen supera el tamaño máximo permitido de 2MB.' });
                }
            }

            const userRole = req.session.rol || req.session.role;
            if (userRole === 'Tendero') {
                const store = await Store.findById(id_tienda);
                const maxLimite = store && store.limite_egreso_tendero !== undefined && store.limite_egreso_tendero !== null ? Number(store.limite_egreso_tendero) : 150000;
                if (monto > maxLimite) {
                    return res.status(400).json({ error: `Por seguridad, tu rol no permite registrar gastos mayores a $${maxLimite.toLocaleString('es-CO')}. Consulta al administrador.` });
                }
            }

            const data = {
                id_sesion_caja: activeSession.id_sesion,
                id_tienda,
                id_usuario,
                monto,
                motivo,
                categoria,
                foto_soporte
            };

            const result = await CashRegister.createExpense(data);
            res.json({ success: true, message: 'Egreso registrado correctamente.', id_egreso: result.lastID || result.id_egreso });

        } catch (error) {
            console.error('Error registrando egreso:', error);
            res.status(500).json({ error: 'Error al registrar el egreso.' });
        }
    }

    static async getExpenses(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const role = req.session.rol || req.session.role;

            if (role === 'Administrador' || role === 'Propietario') {
                // Admin ve todo el historial de la tienda
                const expenses = await CashRegister.getExpensesByStore(id_tienda);
                return res.json({ success: true, expenses });
            } else {
                // Tendero solo ve los de su sesión actual
                const activeSession = await CashRegister.getCurrentSession(id_tienda, req.session.userId);
                if (activeSession) {
                    const expenses = await CashRegister.getExpensesBySession(activeSession.id_sesion);
                    return res.json({ success: true, expenses });
                } else {
                    return res.json({ success: true, expenses: [] });
                }
            }
        } catch (error) {
            console.error('Error obteniendo egresos:', error);
            res.status(500).json({ error: 'Error al obtener egresos.' });
        }
    }

    static async approveExpense(req, res) {
        try {
            const id_egreso = req.params.id;
            const admin_id = req.session.userId;
            const id_tienda = req.session.tiendaId;
            
            // Obtener datos del egreso para notificar al tendero
            const egreso = await db.getAsync('SELECT id_usuario, monto, motivo FROM EgresosCaja WHERE id_egreso = ?', [id_egreso]);
            
            await CashRegister.approveExpense(id_egreso, admin_id);

            // Notificar al tendero que registró el egreso
            if (egreso && egreso.id_usuario !== admin_id) {
                try {
                    await Notification.create({
                        id_usuario: egreso.id_usuario,
                        id_tienda,
                        tipo: 'egreso_aprobado',
                        titulo: '✅ Egreso Aprobado',
                        mensaje: `Tu egreso de $${Number(egreso.monto).toLocaleString('es-CO')} (${egreso.motivo}) fue aprobado.`,
                        datos_json: { id_egreso, monto: egreso.monto }
                    });
                } catch (notifErr) {
                    console.warn('No se pudo crear notificación de aprobación:', notifErr.message);
                }
            }

            res.json({ success: true, message: 'Egreso aprobado.' });
        } catch (error) {
            console.error('Error aprobando egreso:', error);
            res.status(500).json({ error: 'Error al aprobar egreso.' });
        }
    }

    static async rejectExpense(req, res) {
        try {
            const id_egreso = req.params.id;
            const admin_id = req.session.userId;
            const id_tienda = req.session.tiendaId;
            const notas_admin = req.body.notas_admin || null;
            
            // Obtener datos del egreso para notificar al tendero
            const egreso = await db.getAsync('SELECT id_usuario, monto, motivo FROM EgresosCaja WHERE id_egreso = ?', [id_egreso]);
            
            await CashRegister.rejectExpense(id_egreso, admin_id, notas_admin);

            // Notificar al tendero que registró el egreso
            if (egreso && egreso.id_usuario !== admin_id) {
                try {
                    const notaMsg = notas_admin ? ` Motivo: "${notas_admin}"` : '';
                    await Notification.create({
                        id_usuario: egreso.id_usuario,
                        id_tienda,
                        tipo: 'egreso_rechazado',
                        titulo: '❌ Egreso Rechazado',
                        mensaje: `Tu egreso de $${Number(egreso.monto).toLocaleString('es-CO')} (${egreso.motivo}) fue rechazado.${notaMsg}`,
                        datos_json: { id_egreso, monto: egreso.monto, notas_admin }
                    });
                } catch (notifErr) {
                    console.warn('No se pudo crear notificación de rechazo:', notifErr.message);
                }
            }

            res.json({ success: true, message: 'Egreso rechazado.' });
        } catch (error) {
            console.error('Error rechazando egreso:', error);
            res.status(500).json({ error: 'Error al rechazar egreso.' });
        }
    }
}

module.exports = CashRegisterController;
