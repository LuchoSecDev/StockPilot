import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, Package, Calendar, ShieldCheck, Zap, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { textoInsignia } from '../utils/alertas';

const getSeverityStyles = (severity) => {
    switch (severity) {
        case 'critico': return 'bg-peligro-suave text-peligro border-rose-200';
        case 'advertencia': return 'bg-aviso-suave text-aviso border-amber-200';
        default: return 'bg-azul/10 text-azul border-azul/30';
    }
};

const getNotifStyles = (tipo, datos_json = {}) => {
    if (datos_json?.prioridad === 'urgente') {
        return 'bg-aviso-suave text-aviso border-ambar animate-pulse';
    }
    switch (tipo) {
        case 'egreso_aprobado': return 'bg-exito-suave text-exito border-emerald-200';
        case 'egreso_rechazado': return 'bg-peligro-suave text-peligro border-rose-200';
        case 'anuncio_admin': return 'bg-azul/10 text-azul border-azul/30';
        case 'orden_enviada': return 'bg-azul/10 text-azul border-azul/30';
        case 'cambio_precio': return 'bg-azul/10 text-azul border-azul/30';
        case 'meta_ventas': return 'bg-aviso-suave text-aviso border-amber-200';
        case 'discrepancia_caja': return 'bg-peligro-suave text-peligro border-rose-200';
        default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};

const getNotifIcon = (tipo) => {
    switch (tipo) {
        case 'egreso_aprobado': return <CheckCircle size={18} />;
        case 'egreso_rechazado': return <XCircle size={18} />;
        case 'anuncio_admin': return <Bell size={18} />;
        case 'orden_enviada': return <Package size={18} />;
        case 'cambio_precio': return <DollarSign size={18} />;
        case 'meta_ventas': return <Zap size={18} />;
        case 'discrepancia_caja': return <ShieldCheck size={18} />;
        default: return <Bell size={18} />;
    }
};

const NotificationCenter = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [alerts, setAlerts] = useState([]);
    const [userNotifs, setUserNotifs] = useState([]);
    const [stats, setStats] = useState({ total: 0, critico: 0 });
    const [userNotifCount, setUserNotifCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);
    const prevCountRef = useRef(null);
    const audioContextRef = useRef(null);
    useEffect(() => {
        const unlockAudio = () => {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                console.log('[Notificación] Audio desbloqueado por interacción');
            } else if (audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume();
            }
            // Una vez desbloqueado, podemos quitar el listener
            window.removeEventListener('click', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        return () => window.removeEventListener('click', unlockAudio);
    }, []);

    const playNotificationSound = (isCritical = false) => {
        const SOUND_URLS = {
            normal: '/sounds/normal.wav',
            critical: '/sounds/critica.wav'
        };

        const tryPlayFile = () => {
            const audio = new Audio(isCritical ? SOUND_URLS.critical : SOUND_URLS.normal);
            audio.volume = 1.0; // VOLUMEN AL MÁXIMO

            audio.play().catch(err => {
                console.warn('[Notificación] No se pudo reproducir el archivo MP3, usando sintetizador de respaldo:', err);
                playSynthesizedFallback(isCritical);
            });
        };

        // Sintetizador de respaldo (por si falla el internet o el archivo)
        const playSynthesizedFallback = (isCrit) => {
            if (!audioContextRef.current) {
                console.warn('[Notificación] AudioContext no inicializado, no se puede usar sintetizador.');
                return;
            }
            try {
                const ctx = audioContextRef.current;
                if (ctx.state === 'suspended') ctx.resume();
                const now = ctx.currentTime;
                const masterGain = ctx.createGain();
                masterGain.gain.setValueAtTime(1.0, now);
                masterGain.connect(ctx.destination);

                const osc = ctx.createOscillator();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(isCrit ? 440 : 880, now);
                osc.frequency.exponentialRampToValueAtTime(isCrit ? 110 : 220, now + 0.5);

                const g = ctx.createGain();
                g.gain.setValueAtTime(0.5, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

                osc.connect(g);
                g.connect(masterGain);
                osc.start(now);
                osc.stop(now + 0.5);
            } catch (e) { console.error(e); }
        };

        tryPlayFile();
    };

    const fetchNotifications = useCallback(async (signal) => {
        try {
            setLoading(true);
            const [statsRes, alertsRes, notifCountRes, notifsRes] = await Promise.all([
                axios.get('/api/alertas/stats', { ...(signal && { signal }) }),
                axios.get('/api/alertas', { ...(signal && { signal }) }), // TODAS las activas (antes: ?limit=5, y solo salían críticas)
                axios.get('/api/notificaciones/count', { ...(signal && { signal }) }),
                axios.get('/api/notificaciones?limit=5', { ...(signal && { signal }) })
            ]);
            if (signal && signal.aborted) return;

            let newAlertTotal = 0;
            if (statsRes.data.success) {
                newAlertTotal = statsRes.data.stats.total;
                setStats(statsRes.data.stats);
            }
            if (alertsRes.data.success) setAlerts(alertsRes.data.alerts);

            let newNotifCount = 0;
            let parsedNotifs = [];
            if (notifsRes.data.success) {
                parsedNotifs = (notifsRes.data.notifications || []).map(n => {
                    try {
                        return { ...n, datos_json: typeof n.datos_json === 'string' ? JSON.parse(n.datos_json) : n.datos_json };
                    } catch { return n; }
                });
                setUserNotifs(parsedNotifs);
            }

            if (notifCountRes.data.success) {
                newNotifCount = notifCountRes.data.count;
                setUserNotifCount(newNotifCount);
            }

            // Sound: play if total (alerts + user notifs) increased
            const combinedTotal = newAlertTotal + newNotifCount;
            if (prevCountRef.current !== null && combinedTotal > prevCountRef.current) {
                const hasCritical = (statsRes.data.success && statsRes.data.stats.critico > 0);
                const hasUrgent = parsedNotifs.some(n => n.datos_json?.prioridad === 'urgente');
                playNotificationSound(hasCritical || hasUrgent);
            }
            prevCountRef.current = combinedTotal;
        } catch (error) {
            if (axios.isCancel(error) || (signal && signal.aborted)) return;
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchNotifications(controller.signal);
        const interval = setInterval(() => fetchNotifications(controller.signal), 120000);
        return () => {
            clearInterval(interval);
            controller.abort();
        };
    }, [fetchNotifications]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Se desliza hacia la derecha (el lado del panel, y el que apunta hacia afuera de la pantalla)
    // y se desvanece; solo cuando termina la animación se marca leída de verdad y se quita de la lista.
    const NOTIF_EXIT_MS = 280;
    const [leavingIds, setLeavingIds] = useState(() => new Set());

    const handleMarkNotifRead = (id) => {
        if (leavingIds.has(id)) return;
        setLeavingIds(prev => new Set(prev).add(id));
        setTimeout(async () => {
            try {
                await axios.patch(`/api/notificaciones/${id}/read`);
            } catch (err) {
                console.error('Error marcando notificación como leída:', err);
            } finally {
                setUserNotifs(prev => prev.filter(n => n.id_notificacion !== id));
                setUserNotifCount(prev => Math.max(0, prev - 1));
                setLeavingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
            }
        }, NOTIF_EXIT_MS);
    };

    const handleMarkAllRead = () => {
        const ids = userNotifs.map(n => n.id_notificacion);
        if (ids.length === 0) return;
        setLeavingIds(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
        setTimeout(async () => {
            try {
                await axios.patch('/api/notificaciones/read-all');
            } catch (err) {
                console.error('Error marcando todas como leídas:', err);
            } finally {
                setUserNotifs([]);
                setUserNotifCount(0);
                setLeavingIds(new Set());
            }
        }, NOTIF_EXIT_MS);
    };

    const totalBadge = stats.total + userNotifCount;
    const hasUrgent = (stats.critico > 0) || userNotifs.some(n => n.datos_json?.prioridad === 'urgente');

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Icon Button */}
            <button
                onClick={() => {
                    const newOpen = !isOpen;
                    setIsOpen(newOpen);
                    if (newOpen) fetchNotifications();
                }}
                className={`relative w-12 h-12 flex items-center justify-center rounded-lg transition-colors transition-transform active:scale-90 shadow-lg border-2 
                ${isOpen ? 'bg-azul border-azul text-white' : 
                  (hasUrgent ? 'bg-peligro-suave border-rose-300 text-peligro hover:border-rose-400 animate-pulse' : 'bg-white border-slate-100 text-tinta-2 hover:border-azul/30')} 
                shadow-slate-200/50`}
                title="Centro de Alertas"
            >
                <div className={hasUrgent ? 'animate-bounce' : ''}>
                    <Bell size={20} />
                </div>
                {totalBadge > 0 && (
                    <span className={`absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 flex items-center justify-center text-xs font-bold text-white rounded-full border-2 shadow-md ${isOpen ? 'border-azul' : 'border-white'} ${hasUrgent ? 'bg-rose-500' : 'bg-ambar'}`}>
                        {textoInsignia(totalBadge)}
                    </span>
                )}
            </button>

            {/* Dropdown Panel - RENDERED AS PORTAL TO AVOID Z-INDEX ISSUES */}
            {isOpen && createPortal(
                <div
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="fixed top-16 right-4 sm:top-20 sm:right-12 w-[calc(100vw-2rem)] sm:w-96 bg-white/95 rounded-2xl shadow-[0_30px_70px_-15px_rgba(0,0,0,0.3)] border border-azul/20 overflow-hidden z-[9999] animate-in fade-in slide-in-from-top-4 duration-300 origin-top-right flex flex-col max-h-[calc(100vh-5rem)]"
                >
                    <div className="p-5 border-b border-azul/30 flex items-center justify-between bg-azul/10">
                        <h3 className="font-bold text-tinta text-xs">Notificaciones Activas</h3>
                        <span className="bg-azul px-3 py-1 rounded-full text-xs font-bold text-white shadow-md">
                            {totalBadge} Alertas
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-premium min-h-0">
                        {loading && alerts.length === 0 && userNotifs.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-10 h-10 border-4 border-azul border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-xs font-bold text-slate-500">Sincronizando IA...</p>
                            </div>
                        ) : (alerts.length > 0 || userNotifs.length > 0) ? (
                            <div className="divide-y divide-slate-50">
                                {/* === USER NOTIFICATIONS (egresos, etc.) === */}
                                {userNotifs.length > 0 && (
                                    <>
                                        <div className="px-5 pt-3 pb-1 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500">🔔 Mensajes para ti</span>
                                            {userNotifCount > 1 && (
                                                <button
                                                    onClick={handleMarkAllRead}
                                                    className="text-xs font-bold text-azul hover:text-azul transition-colors"
                                                >
                                                    Marcar todo leído
                                                </button>
                                            )}
                                        </div>
                                        {userNotifs.map((notif) => (
                                            <button
                                                key={`notif-${notif.id_notificacion}`}
                                                onClick={() => handleMarkNotifRead(notif.id_notificacion)}
                                                type="button"
                                                className={`w-full text-left p-5 hover:bg-white hover:shadow-inner cursor-pointer group border-l-4 border-transparent hover:border-azul transition-all duration-300 ease-in ${
                                                    leavingIds.has(notif.id_notificacion) ? 'translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'
                                                }`}
                                            >
                                                <div className="flex gap-4">
                                                    <div className={`shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center shadow-sm ${getNotifStyles(notif.tipo, notif.datos_json)}`}>
                                                        {getNotifIcon(notif.tipo)}
                                                    </div>
                                                    <div className="space-y-1 flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <p className="text-[12px] font-bold text-tinta leading-tight group-hover:text-azul transition-colors">
                                                                {notif.titulo}
                                                            </p>
                                                            <span className="text-xs font-bold text-slate-500 whitespace-nowrap ml-2">
                                                                {new Date(notif.fecha_creacion).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-500 leading-snug">
                                                            {notif.mensaje}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-2">
                                                            <span className="w-1 h-1 rounded-full bg-azul"></span>
                                                            <p className="text-xs font-bold text-azul">
                                                                Click para marcar leída
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                )}

                                {/* === STOCK / PRODUCT ALERTS === */}
                                {alerts.length > 0 && (
                                    <>
                                        {userNotifs.length > 0 && (
                                            <div className="px-5 pt-3 pb-1">
                                                <span className="text-xs font-bold text-slate-500">📦 Alertas de Inventario</span>
                                            </div>
                                        )}
                                        {alerts.map((alert) => {
                                            // Lógica de resolución inteligente
                                            const isStockAlert = alert.tipo.includes('stock') || alert.tipo.includes('rop');
                                            const targetPath = isStockAlert ? '/analisis-detallado' : '/alertas';

                                            return (
                                                <button
                                                    key={alert.id_alerta}
                                                    onClick={() => {
                                                        setIsOpen(false);
                                                        // Pequeño delay para asegurar que el navegador procese el cambio de estado antes de la transición de ruta
                                                        setTimeout(() => navigate(targetPath), 10);
                                                    }}
                                                    type="button"
                                                    className="w-full text-left p-5 hover:bg-white hover:shadow-inner transition-colors transition-shadow cursor-pointer group border-l-4 border-transparent hover:border-azul"
                                                >
                                                    <div className="flex gap-4">
                                                        <div className={`shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center shadow-sm ${getSeverityStyles(alert.severidad)}`}>
                                                            {alert.tipo.includes('vencimiento') ? <Calendar size={18} /> : <Package size={18} />}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-start">
                                                                <p className="text-[12px] font-bold text-tinta leading-tight group-hover:text-azul transition-colors">
                                                                    {alert.nombre_producto || 'Producto Desconocido'}
                                                                </p>
                                                                <span className="text-xs font-bold text-azul group-hover:translate-x-1 transition-transform">→</span>
                                                            </div>
                                                            <p className="text-xs font-bold text-slate-500 leading-snug lowercase first-letter:uppercase">
                                                                {alert.mensaje}
                                                            </p>
                                                            <div className="flex items-center gap-1.5 mt-2">
                                                                <span className="w-1 h-1 rounded-full bg-azul"></span>
                                                                <p className="text-xs font-bold text-slate-500">
                                                                    Resolución Sugerida: <span className="text-azul">{isStockAlert ? 'Reabastecer' : 'Promocionar'}</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="p-16 text-center">
                                <div className="text-5xl mb-4 grayscale opacity-50">🛡️</div>
                                <p className="text-xs font-bold text-tinta">Stock Blindado</p>
                                <p className="text-xs font-bold text-slate-500 mt-2">IA en vigilancia constante</p>
                            </div>
                        )}
                    </div>

                    <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOpen(false);
                            setTimeout(() => navigate('/alertas'), 10);
                        }}
                        className="w-full p-5 bg-azul text-xs font-bold text-white hover:bg-azul-hondo transition-colors shadow-inner relative z-50 cursor-pointer"
                    >
                        Ingresar al Centro de Control de Alertas ⚡
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};

export default NotificationCenter;
