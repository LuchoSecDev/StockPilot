import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { SYNC_EVENTS, subscribeToSync } from '../utils/stockSync';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { ShoppingCart, Check, Bot, Rocket, AlertCircle, TrendingUp, DollarSign, Target, Clock, Zap, BarChart2, AlertTriangle, CheckCircle2 } from 'lucide-react';

const DashboardPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.rol === 'Administrador';
  // Modo básico (plan 19, 3.4): sin las tarjetas de IA (Consejero y Estrategias de Venta) y sin pedirlas al servidor.
  // El piloto es corto y la IA necesita meses de historial para aprender (Feedback_IA), así que lo que se prueba es
  // el punto de venta, las alertas y el inventario; el pedido sugerido vive en /pedir, con el motor matemático.
  const esBasico = user?.modoInterfaz === 'basico';
  const storeKey = user?.tiendaId ?? 'default';
  const [stats, setStats] = useState({
    totalArticulos: 0,
    valorInventario: 0,
    alertasStock: 0,
    ventasMes: 0,
    alertasCriticas: 0,
    alertasAdvertencia: 0,
    utilidadPotencial: 0,
    margenPromedio: 0
  });
  const [recommendations, setRecommendations] = useState([]);
  // Borradores de orden de compra armados desde el Consejero (solo administrador)
  const [borradores, setBorradores] = useState({});
  const [pedidoEnCurso, setPedidoEnCurso] = useState(null); // id_producto | 'todo' | 'calmas'
  const [confirmarTodo, setConfirmarTodo] = useState(false);
  const [ultimosPedidos, setUltimosPedidos] = useState([]);
  // Proveedores para asignar a un producto que aún no tiene uno (Consejero → borrador)
  const [proveedoresList, setProveedoresList] = useState([]);
  const [eligiendoProveedor, setEligiendoProveedor] = useState(null); // id_producto en edición
  const [proveedorElegido, setProveedorElegido] = useState('');
  const [asignandoProveedor, setAsignandoProveedor] = useState(false);
  // Solicitudes del tendero al administrador (plan 13, Fase E): solo se recuerdan en esta sesión
  const [solicitudEnCurso, setSolicitudEnCurso] = useState(null); // id_producto
  const [solicitados, setSolicitados] = useState(() => new Set());
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [applyingStrategy, setApplyingStrategy] = useState(null);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [welcomeAlert, setWelcomeAlert] = useState(null);
  const [customDiscount, setCustomDiscount] = useState(0);

  const fetchDashboardData = useCallback(async (signal) => {
    // --- Fase 0: caché local para respuesta instantánea ---
    const cachedStats = localStorage.getItem(`stockpilot_stats_${storeKey}`);
    const cachedPromos = localStorage.getItem(`stockpilot_promos_${storeKey}`);
    const cachedRecs = localStorage.getItem(`stockpilot_recs_${storeKey}`);

    if (cachedStats) { setStats(JSON.parse(cachedStats)); setLoading(false); }
    if (!esBasico && cachedRecs) setRecommendations(JSON.parse(cachedRecs));
    if (!esBasico && cachedPromos) { setPromotions(JSON.parse(cachedPromos)); setLoadingPromos(false); }

    // --- Fase 1: stats SQL puros (~100–200ms), quita el spinner de inmediato ---
    try {
      const statsRes = await axios.get('/api/dashboard/stats', { ...(signal && { signal }) });
      if (signal && signal.aborted) return;
      setStats(statsRes.data);
      setLoading(false);
      localStorage.setItem(`stockpilot_stats_${storeKey}`, JSON.stringify(statsRes.data));

      // Disparar Alerta de Bienvenida Proactiva (sólo con datos frescos de red y una vez por sesión)
      const sessionKey = `notified_alerts_login_${storeKey}`;
      if (!sessionStorage.getItem(sessionKey) && statsRes.data.totalArticulos !== undefined) {
        if (statsRes.data.alertasCriticas > 0) {
          setWelcomeAlert({ type: 'critical', title: '¡ACCIÓN URGENTE!', message: `Tienes ${statsRes.data.alertasCriticas} productos en estado crítico o agotados. Revisa tu inventario inmediatamente para no perder ventas.`, icon: AlertTriangle });
        } else if (statsRes.data.alertasAdvertencia > 0) {
          setWelcomeAlert({ type: 'warning', title: 'PRECAUCIÓN', message: `Tienes ${statsRes.data.alertasAdvertencia} productos con poco stock. Te sugerimos reabastecer pronto.`, icon: AlertTriangle });
        } else if (statsRes.data.totalArticulos > 0) {
          setWelcomeAlert({ type: 'success', title: '¡TODO EN ORDEN!', message: 'Tu inventario está 100% saludable el día de hoy. ¡Excelente trabajo!', icon: CheckCircle2 });
        }
        sessionStorage.setItem(sessionKey, 'true');
      }

    } catch (error) {
      if (axios.isCancel(error) || (signal && signal.aborted)) return;
      console.error('Error fetching stats:', error);
      setLoading(false);
    }

    // --- Fase 2: IA en background, no bloquea las tarjetas de stats ---
    // En modo básico no se pide: ni se muestra, ni se paga la llamada a OpenAI, ni se escribe en la auditoría de IA.
    if (esBasico) {
      setLoadingPromos(false);
      return;
    }
    try {
      const [aiRes, promoRes] = await Promise.all([
        axios.get('/api/ia/recommendations', { ...(signal && { signal }) }),
        axios.get('/api/ia/promotions', { ...(signal && { signal }) }).catch(() => ({ data: { promotions: [] } }))
      ]);
      if (signal && signal.aborted) return;

      setRecommendations(aiRes.data.recommendations || []);
      if (isAdmin) {
        axios.get('/api/ordenes/borradores/resumen', { ...(signal && { signal }) })
          .then((r) => { if (!(signal && signal.aborted)) setBorradores(r.data.data || {}); })
          .catch(() => {});
        axios.get('/api/proveedores', { ...(signal && { signal }) })
          .then((r) => { if (!(signal && signal.aborted) && r.data.success) setProveedoresList(r.data.data || []); })
          .catch(() => {});
      }
      localStorage.setItem(`stockpilot_recs_${storeKey}`, JSON.stringify(aiRes.data.recommendations || []));

      setPromotions(promoRes.data.promotions || []);
      localStorage.setItem(`stockpilot_promos_${storeKey}`, JSON.stringify(promoRes.data.promotions || []));
    } catch (error) {
      if (axios.isCancel(error) || (signal && signal.aborted)) return;
      console.error('Error fetching AI data:', error);
    } finally {
      if (!signal || !signal.aborted) {
        setLoadingPromos(false);
      }
    }
  }, [storeKey, isAdmin, esBasico]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardData(controller.signal);

    const unsubscribe = subscribeToSync((event) => {
      if (
        event.type === SYNC_EVENTS.SALE_COMPLETED ||
        event.type === SYNC_EVENTS.STOCK_UPDATED ||
        event.type === SYNC_EVENTS.PRODUCT_MODIFIED
      ) {
        fetchDashboardData();
      }
    });

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [fetchDashboardData]);


  const handleApplyStrategy = (promo) => {
    if (!isAdmin) return; // aplicar estrategias de precio es solo del Administrador (P22-10, D3)
    setSelectedPromo(promo);
    setCustomDiscount(promo.discount || 0);
    setShowModal(true);
  };

  const confirmExecution = async () => {
    if (!selectedPromo || applyingStrategy) return;

    try {
      setApplyingStrategy(true);
      const nuevoPrecio = Math.round(selectedPromo.originalPrice * (1 - customDiscount / 100));
      const res = await axios.post('/api/ia/apply-strategy', {
        id_producto: selectedPromo.id,
        nuevo_precio: nuevoPrecio,
        duration_days: selectedPromo.duration_days,
        tipo: selectedPromo.type,
        razon: selectedPromo.reason
      });

      if (res.data.success) {
        toast.success(`✨ ¡Estrategia aplicada! El precio de "${selectedPromo.productName}" se ha actualizado.`);
        setShowModal(false);
        // En lugar de recargar todo (fetchDashboardData), actualizamos localmente
        setPromotions(prev => prev.filter(p => p.id !== selectedPromo.id));
      }
    } catch (error) {
      console.error('Error aplicando estrategia:', error);
      toast.error(error.response?.data?.error || 'Error al ejecutar la estrategia');
    } finally {
      setApplyingStrategy(false);
    }
  };

  // Recomendaciones que se pueden llevar a un pedido: traen producto y proveedor y aún no están en un borrador
  const esPedible = (rec) => rec.id_producto && rec.id_proveedor && Number.isFinite(Number(rec.final)) && Number(rec.final) > 0;
  // "Puede esperar": el stock alcanza para varios días aunque esté bajo el mínimo; van aparte y no entran al pedido general
  const urgentes = recommendations.filter((rec) => rec.urgencia !== 'Puede esperar').slice(0, 10);
  const calmas = recommendations.filter((rec) => rec.urgencia === 'Puede esperar').slice(0, 10);
  const calmasPedibles = calmas.filter((rec) => esPedible(rec) && !borradores[rec.id_producto]);
  const pendientesDePedido = urgentes.filter((rec) => esPedible(rec) && !borradores[rec.id_producto]);
  const resumenPedido = {
    proveedores: new Set(pendientesDePedido.map((r) => r.id_proveedor)).size,
    total: pendientesDePedido.reduce((acc, r) => acc + Number(r.final) * Number(r.costo_unitario || 0), 0),
  };

  const agregarAlPedido = async (lista, marca) => {
    setPedidoEnCurso(marca);
    try {
      const { data } = await axios.post('/api/ordenes/borrador/desde-consejero', {
        items: lista.map((r) => ({ id_producto: r.id_producto, cantidad: Number(r.final), base: Number(r.base), ajuste_ia: parseInt(String(r.adjustment ?? '0').replace(/[^0-9-]/g, ''), 10) || 0, urgencia: r.urgencia })),
      });
      const nuevos = {};
      for (const b of data.borradores) {
        for (const r of lista.filter((x) => x.id_proveedor === b.id_proveedor)) nuevos[r.id_producto] = { id_orden: b.id_orden, cantidad: Number(r.final), proveedor: b.proveedor };
      }
      setBorradores((prev) => ({ ...prev, ...nuevos }));
      setUltimosPedidos(data.borradores);
      if (data.sin_proveedor.length) toast.warning(`${data.sin_proveedor.length} producto(s) sin proveedor: asígnalo en Productos para poder pedirlo.`);
      if (data.borradores.length) toast.success(data.borradores.length === 1 ? `Agregado al pedido #${data.borradores[0].id_orden} (borrador).` : `Se armaron ${data.borradores.length} pedidos en borrador.`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo armar el pedido.');
    } finally {
      setPedidoEnCurso(null);
      setConfirmarTodo(false);
    }
  };

  // Producto sin proveedor: se asigna desde la propia tarjeta y de una vez se agrega al pedido
  const asignarProveedorYPedir = async (rec) => {
    if (!proveedorElegido) return toast.error('Elige un proveedor.');
    setAsignandoProveedor(true);
    try {
      await axios.patch(`/api/productos/${rec.id_producto}/proveedor`, { id_proveedor: Number(proveedorElegido) });
      const proveedor = proveedoresList.find((p) => p.id_proveedor === Number(proveedorElegido));
      const recConProveedor = { ...rec, id_proveedor: Number(proveedorElegido), proveedor: proveedor?.nombre_empresa };
      setRecommendations((prev) => prev.map((r) => r.id_producto === rec.id_producto ? recConProveedor : r));
      setEligiendoProveedor(null);
      setProveedorElegido('');
      await agregarAlPedido([recConProveedor], rec.id_producto);
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo asignar el proveedor.');
    } finally {
      setAsignandoProveedor(false);
    }
  };

  // El tendero no decide cantidades: pide la que ya calculó el Consejero y el administrador la revisa
  const solicitarAlAdmin = async (rec) => {
    setSolicitudEnCurso(rec.id_producto);
    try {
      await axios.post('/api/ordenes/borrador/solicitar', { id_producto: rec.id_producto, cantidad: Number(rec.final), urgencia: rec.urgencia });
      setSolicitados((prev) => new Set(prev).add(rec.id_producto));
      toast.success('Se avisó al administrador. Lo verá en Proveedores.');
    } catch (e) {
      if (e.response?.status === 409) {
        setSolicitados((prev) => new Set(prev).add(rec.id_producto));
        toast.info('Ya estaba pedido; el administrador lo revisará en Proveedores.');
      } else {
        toast.error(e.response?.data?.error || 'No se pudo enviar la solicitud.');
      }
    } finally {
      setSolicitudEnCurso(null);
    }
  };

  const chipUrgencia = (u) => (u === 'Pide hoy' ? 'bg-peligro-suave text-peligro border-peligro/30' : u === 'En esta compra' ? 'bg-aviso-suave text-aviso border-aviso/30' : 'bg-slate-100 text-slate-600 border-slate-200');

  const renderTarjeta = (rec) => (
                    <div key={rec.id || rec.product} className="bg-slate-50/70 border-4 border-azul p-5 rounded-2xl hover:border-azul-hondo hover:bg-azul/10 hover:shadow-md transition-all duration-200 group flex flex-col">
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <span className="text-tinta font-bold text-sm leading-tight flex-1">{rec.product}</span>
                        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded border ${rec.trend === 'alcista' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : rec.trend === 'bajista' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {rec.trend === 'alcista' ? 'ALTA DEMANDA' : rec.trend === 'bajista' ? 'BAJA ROTACIÓN' : 'DEMANDA ESTABLE'}
                        </span>
                      </div>
                      {rec.urgencia && (
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${chipUrgencia(rec.urgencia)}`}>{rec.urgencia}</span>
                          {rec.dias_para_agotar !== null && rec.dias_para_agotar !== undefined && (
                            <span className="text-xs font-bold text-slate-500">{rec.dias_para_agotar <= 0 ? 'Sin stock para hoy' : `Stock para ~${rec.dias_para_agotar} día(s)`}</span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-slate-600 mt-2 font-medium leading-relaxed">"{rec.reason}"</p>
                      <div className="mt-auto pt-4 border-t border-azul/30">
                        <div className="flex justify-between text-xs mb-2 font-bold">
                          <span className="text-slate-500">Sugerido: <b className="text-tinta text-base font-bold">+{rec.final}u</b></span>
                          <span className={getConfidenceColor(rec.confidence)}>Confianza: {rec.confidence}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                          <div
                            className={`h-full opacity-90 transition-colors duration-1000 ${rec.confidence >= 90 ? 'bg-exito' : 'bg-ambar'}`}
                            style={{ width: `${rec.confidence}%` }}
                          ></div>
                        </div>
                        {!isAdmin && rec.id_producto && (
                          solicitados.has(rec.id_producto) ? (
                            <p className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-exito bg-exito-suave border border-exito/20 rounded-lg px-3 py-2">
                              <Check size={14} /> Solicitado: el administrador lo verá en Proveedores
                            </p>
                          ) : rec.id_proveedor ? (
                            <button
                              type="button"
                              disabled={solicitudEnCurso !== null || !esPedible(rec)}
                              onClick={() => solicitarAlAdmin(rec)}
                              className="mt-3 w-full flex items-center justify-center gap-2 text-xs font-bold text-azul bg-azul/10 hover:bg-azul hover:text-white disabled:opacity-50 rounded-lg px-3 py-2 transition-colors"
                            >
                              <ShoppingCart size={14} /> Solicitar al Administrador
                            </button>
                          ) : (
                            <p className="mt-3 text-xs font-bold text-aviso">Sin proveedor asignado: pide al administrador que lo asigne.</p>
                          )
                        )}
                        {isAdmin && rec.id_producto && (
                          borradores[rec.id_producto] ? (
                            <Link to={`/proveedores?orden=${borradores[rec.id_producto].id_orden}`} className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-exito bg-exito-suave border border-exito/20 rounded-lg px-3 py-2 hover:bg-exito hover:text-white transition-colors">
                              <Check size={14} /> En borrador · Pedido #{borradores[rec.id_producto].id_orden}
                            </Link>
                          ) : rec.id_proveedor ? (
                            <button
                              type="button"
                              disabled={pedidoEnCurso !== null || !esPedible(rec)}
                              onClick={() => agregarAlPedido([rec], rec.id_producto)}
                              className="mt-3 w-full flex items-center justify-center gap-2 text-xs font-bold text-azul bg-azul/10 hover:bg-azul hover:text-white disabled:opacity-50 rounded-lg px-3 py-2 transition-colors"
                            >
                              <ShoppingCart size={14} /> Agregar al pedido de {rec.proveedor}
                            </button>
                          ) : eligiendoProveedor === rec.id_producto ? (
                            <div className="mt-3 flex flex-col gap-2">
                              <select
                                autoFocus
                                aria-label={`Proveedor para ${rec.product}`}
                                value={proveedorElegido}
                                onChange={(e) => setProveedorElegido(e.target.value)}
                                className="w-full p-2 text-xs font-bold text-tinta bg-white border border-slate-200 rounded-lg outline-none focus:border-azul"
                              >
                                <option value="">Elige un proveedor…</option>
                                {proveedoresList.map((p) => (
                                  <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre_empresa}</option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={asignandoProveedor || !proveedorElegido}
                                  onClick={() => asignarProveedorYPedir(rec)}
                                  className="flex-1 text-xs font-bold text-white bg-azul hover:bg-azul-hondo disabled:opacity-50 rounded-lg px-3 py-2 transition-colors"
                                >
                                  {asignandoProveedor ? 'Guardando…' : 'Asignar y pedir'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEligiendoProveedor(null); setProveedorElegido(''); }}
                                  className="text-xs font-bold text-slate-500 hover:text-tinta px-3 py-2"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setEligiendoProveedor(rec.id_producto); setProveedorElegido(''); }}
                              className="mt-3 w-full text-xs font-bold text-aviso bg-aviso-suave hover:bg-aviso hover:text-white rounded-lg px-3 py-2 transition-colors"
                            >
                              Sin proveedor asignado: elegir uno
                            </button>
                          )
                        )}
                      </div>
                    </div>
  );

  const getConfidenceColor = (score) => {
    if (score >= 90) return 'text-exito';
    if (score >= 70) return 'text-aviso';
    return 'text-peligro';
  };

  return (
    <div className="animate-fade-in space-y-6 pb-20">
      <header className="mb-10">
        <h1 className="titular text-2xl sm:text-3xl md:text-4xl text-tinta">Vista General</h1>
        <p className="text-slate-500 font-bold text-xs mt-1 decoration-azul underline underline-offset-8">Resumen Actual de tu Negocio</p>
      </header>

      {/* Métricas Principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Productos */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col justify-between min-w-0 overflow-hidden">
          <p className="text-xs font-bold text-slate-500 truncate" title="Productos">Productos</p>
          <div className="flex flex-wrap items-baseline justify-between mt-2 gap-x-2 gap-y-1">
            <p className="text-2xl lg:text-xl xl:text-3xl font-bold text-tinta whitespace-nowrap">{stats.totalArticulos || 0}</p>
            <span className="text-xs text-exito font-bold shrink-0">Catálogo</span>
          </div>
        </div>

        {/* Inversión */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col justify-between min-w-0 overflow-hidden">
          <p className="text-xs font-bold text-slate-500 truncate" title="Valor Inventario">Valor Inventario</p>
          <div className="flex flex-wrap items-baseline justify-between mt-2 gap-x-2 gap-y-1">
            <p className="text-xl sm:text-2xl lg:text-xl xl:text-2xl font-bold text-azul whitespace-nowrap" title={`$${Number(stats.valorInventario || 0).toLocaleString('es-CO')}`}>
              ${Number(stats.valorInventario || 0).toLocaleString('es-CO')}
            </p>
            <span className="text-xs text-slate-500 font-bold shrink-0">Valor Total</span>
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col justify-between min-w-0 overflow-hidden">
          <p className="text-xs font-bold text-slate-500 truncate" title="Alertas">Alertas</p>
          <div className="flex flex-wrap items-baseline justify-between mt-2 gap-x-2 gap-y-1">
            <p className={`text-2xl lg:text-xl xl:text-3xl font-bold whitespace-nowrap ${stats.alertasCriticas > 0 ? 'text-peligro' : 'text-exito'}`}>{stats.alertasCriticas || stats.alertasStock || 0}</p>
            <span className={`text-xs font-bold shrink-0 ${stats.alertasCriticas > 0 ? 'text-peligro animate-pulse' : 'text-exito'}`}>
              {stats.alertasCriticas > 0 ? 'URGENTE' : 'OK'}
            </span>
          </div>
        </div>

        {/* Ventas Hoy */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col justify-between min-w-0">
          <p className="text-xs font-bold text-slate-500 truncate">Ventas de Hoy</p>
          <div className="flex flex-wrap items-baseline justify-between mt-2 gap-x-2 gap-y-1">
            <p className="text-xl sm:text-2xl lg:text-xl xl:text-2xl font-bold text-exito whitespace-nowrap" title={`$${Number(stats.ventasHoy || 0).toLocaleString('es-CO')}`}>
              ${Number(stats.ventasHoy || 0).toLocaleString('es-CO')}
            </p>
            <div className="text-right shrink-0">
              <span className="block text-xs text-slate-500 font-bold">Total Mes</span>
              <span className="text-xs text-slate-500 font-bold">${Number(stats.ventasMes || 0).toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${esBasico ? '' : 'xl:grid-cols-3'} gap-4 md:gap-6`}>
        {!esBasico && (<>
        {/* Asistente Estratégico IA */}
        <section className="xl:col-span-2 bg-white rounded-2xl sm:rounded-2xl p-4 sm:p-6 md:p-8 text-tinta shadow-lg relative overflow-hidden border border-slate-100">
          <div className="absolute top-0 right-0 p-6 opacity-5 text-azul"><Bot size={96} /></div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 md:mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-azul text-white rounded-2xl flex items-center justify-center shadow-lg"><Rocket size={24} /></div>
                <div>
                  <h2 className="titular text-2xl text-tinta">Consejero IA</h2>
                  <p className="text-xs text-azul font-bold mt-1">Recomendaciones Inteligentes</p>
                </div>
              </div>
              {isAdmin && (
                <Link to="/analisis-detallado" className="text-xs font-bold text-azul bg-azul/10 px-4 py-2 rounded-2xl hover:bg-azul-hondo hover:text-white transition-colors">
                  Ver Más →
                </Link>
              )}
            </div>

            {isAdmin && pendientesDePedido.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-azul/5 border border-azul/20 rounded-2xl px-4 py-3">
                <p className="text-xs font-bold text-tinta">
                  {pendientesDePedido.length} sugerencia(s) listas para pedir · {resumenPedido.proveedores} proveedor(es) · <span className="text-azul">${Math.round(resumenPedido.total).toLocaleString('es-CO')}</span>
                </p>
                <button
                  type="button"
                  disabled={pedidoEnCurso !== null}
                  onClick={() => setConfirmarTodo(true)}
                  className="flex items-center gap-2 text-xs font-bold text-white bg-azul hover:bg-azul-hondo disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
                >
                  <ShoppingCart size={14} /> Armar pedido con todo lo sugerido
                </button>
              </div>
            )}
            {ultimosPedidos.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 bg-exito-suave border border-exito/20 rounded-2xl px-4 py-3 text-xs font-bold text-exito" role="status">
                <span>Borrador listo para revisar y enviar (no se envió nada al proveedor):</span>
                {ultimosPedidos.map((b) => (
                  <Link key={b.id_orden} to={`/proveedores?orden=${b.id_orden}`} className="underline underline-offset-2 hover:text-tinta">
                    Ver pedido #{b.id_orden} · {b.proveedor} →
                  </Link>
                ))}
              </div>
            )}

            <div className="flex-grow max-h-[340px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="h-24 bg-slate-100 rounded-2xl animate-pulse"></div>
                  <div className="h-24 bg-slate-100 rounded-2xl animate-pulse"></div>
                </div>
              ) : recommendations.length > 0 ? (
                <>
                  {urgentes.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {urgentes.map(renderTarjeta)}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-exito-suave rounded-2xl border border-exito/20">
                      <p className="text-exito text-sm font-bold">Nada urgente por pedir hoy</p>
                    </div>
                  )}
                  {calmas.length > 0 && (
                    <details className="mt-4 group/calmas">
                      <summary className="cursor-pointer select-none text-xs font-bold text-tinta bg-slate-100 hover:bg-slate-200 rounded-2xl px-4 py-3 transition-colors">
                        Para reponer con calma ({calmas.length}) <span className="text-slate-500 font-medium">· están bajo tu stock de seguridad pero te alcanzan para varios días</span>
                      </summary>
                      {isAdmin && calmasPedibles.length > 0 && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            disabled={pedidoEnCurso !== null}
                            onClick={() => agregarAlPedido(calmasPedibles, 'calmas')}
                            className="flex items-center gap-2 text-xs font-bold text-azul bg-azul/10 hover:bg-azul hover:text-white disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
                          >
                            <ShoppingCart size={14} /> Agregar estas {calmasPedibles.length} a un pedido
                          </button>
                        </div>
                      )}
                      <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {calmas.map(renderTarjeta)}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-500 text-sm font-bold">Sistemas Estables</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <ConfirmDialog
          isOpen={confirmarTodo}
          title="Armar pedido con todo lo sugerido"
          message={<>Se creará un borrador por proveedor ({resumenPedido.proveedores}) con {pendientesDePedido.length} producto(s), por un total estimado de <b>${Math.round(resumenPedido.total).toLocaleString('es-CO')}</b>. No se envía nada al proveedor: lo revisas y apruebas en Proveedores.</>}
          highlightColor="azul"
          confirmText="Sí, armar borrador"
          cancelText="Cancelar"
          onConfirm={() => agregarAlPedido(pendientesDePedido, 'todo')}
          onCancel={() => setConfirmarTodo(false)}
          loading={pedidoEnCurso === 'todo'}
          icon="check"
        />
        </>)}

        {/* Estado del Inventario */}
        <section className="bg-white rounded-2xl p-8 shadow-lg border border-slate-100 self-start">
          <h2 className="font-bold text-tinta text-xs mb-8 border-b border-slate-50 pb-4 flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-500" /> Estado del Inventario
          </h2>
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => navigate('/alertas')}
              className={`w-full text-left p-6 rounded-lg transition-colors transition-shadow transition-transform duration-300 cursor-pointer active:scale-[0.98] outline-none focus:ring-4 focus:ring-azul/50 ${stats.alertasCriticas > 0 ? 'bg-rose-50 border border-peligro-suave shadow-lg' : (stats.alertasAdvertencia > 0 ? 'bg-amber-50 border border-aviso-suave shadow-lg' : 'bg-emerald-50 border border-exito-suave hover:shadow-lg')}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-4 h-4 rounded-full ${stats.alertasCriticas > 0 ? 'bg-rose-500 animate-ping' : (stats.alertasAdvertencia > 0 ? 'bg-ambar animate-pulse' : 'bg-exito')}`}></div>
                <div>
                  <h3 className="font-bold text-base text-tinta">
                    {stats.alertasCriticas > 0 ? `${stats.alertasCriticas} Productos Agotados` : (stats.alertasAdvertencia > 0 ? `${stats.alertasAdvertencia} Próximos a Agotarse` : 'Inventario Óptimo')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    {stats.alertasCriticas > 0 ? 'Requieren reabastecimiento urgente' : (stats.alertasAdvertencia > 0 ? 'Cerca del stock mínimo' : 'Niveles de stock saludables')}
                  </p>
                </div>
              </div>
            </button>

            {user?.rol === 'Administrador' && (
              <button
                type="button"
                onClick={() => navigate('/analitica-visual')}
                className="w-full text-left bg-white p-6 rounded-lg shadow-lg border border-slate-100 cursor-pointer relative overflow-hidden group transition-transform outline-none focus:ring-4 focus:ring-azul/50"
              >
                <div className="absolute -top-1 -right-1 p-4 opacity-5 transition-transform text-azul"><BarChart2 size={40} /></div>
                <h4 className="titular text-xl mb-4 text-tinta">Centro<br /><span className="text-azul">Analítico</span></h4>
                <span className="text-xs font-bold uppercase tracking-wide bg-azul/10 text-azul px-3 py-1 rounded-full border border-azul/30 whitespace-nowrap">Ver Detalles →</span>
              </button>
            )}

            {/* Margen Promedio (Movido a Sidebar & Convertido a Blanco) */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col justify-between min-w-0 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 transition-transform text-tinta"><DollarSign size={40} /></div>
              <p className="text-xs font-bold text-slate-500 truncate relative z-10">Margen de Ganancia</p>
              <div className="flex flex-wrap items-end justify-between mt-2 gap-2 relative z-10">
                <p className="text-3xl font-bold text-tinta">
                  {stats.margenPromedio ? Number(stats.margenPromedio).toFixed(1) : 0}%
                </p>
                <div className="flex flex-col items-end mb-1">
                  <span className="text-xs text-slate-500 font-bold">Promedio General</span>
                  <div className="w-16 h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-ambar" style={{ width: `${stats.margenPromedio || 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Oportunidades de Promoción IA */}
      {!esBasico && (<>
      <section className="bg-white rounded-2xl p-8 text-tinta shadow-lg relative overflow-hidden border border-slate-100">
        <div className="absolute top-0 right-0 p-6 opacity-5 text-azul"><DollarSign size={96} /></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-azul text-white rounded-2xl flex items-center justify-center shadow-lg"><Target size={24} /></div>
            <div>
              <h2 className="titular text-2xl text-tinta">Estrategias de Venta</h2>
              <p className="text-xs text-azul font-bold mt-1">Sugerencias para optimizar la rotación e ingresos</p>
            </div>
          </div>

          {loadingPromos ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-56 bg-slate-100 rounded-2xl animate-pulse"></div>)}
            </div>
          ) : promotions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 auto-rows-fr">
              {promotions.map((promo) => (
                <div key={promo.id || promo.productName} className="bg-slate-50 border border-slate-200/80 p-6 rounded-2xl hover:bg-slate-100/80 transition-colors flex flex-col group h-full shadow-sm">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-azul">PROPUESTA IA</span>
                      <span className="text-xs font-bold bg-azul/10 text-azul px-2 py-0.5 rounded border border-azul/30 inline-flex items-center gap-1 w-fit uppercase tabular-nums">
                        <Target size={9} /> {promo.type === 'discount' ? 'Descuento Directo' : (promo.type === 'liquidation' ? 'Liquidación' : promo.type)}
                      </span>
                    </div>
                    <span className="text-xs font-bold bg-slate-200/60 px-2 py-0.5 rounded text-slate-600 flex items-center gap-1"><Clock size={9} /> {promo.duration_days}d</span>
                  </div>
                  <h3 className="titular text-xl text-tinta mb-2">
                    {promo.type === 'combo' && promo.complementary_name
                      ? `${promo.productName} + ${promo.complementary_name}`
                      : promo.productName}
                  </h3>
                  <p className="text-xs font-medium leading-relaxed mb-6 text-slate-600">"{promo.reason}"</p>

                  <div className="mt-auto space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-500">Dinero a Recuperar</p>
                        <p className="text-xl font-bold text-tinta">${promo.impact.toLocaleString()}</p>
                      </div>
                      <div className="w-12 h-12 bg-azul text-white rounded-2xl flex items-center justify-center font-bold text-xs shadow-md">-{promo.discount}%</div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleApplyStrategy(promo)}
                        disabled={applyingStrategy === promo.id}
                        className="w-full py-4 rounded-lg bg-azul text-white text-xs font-bold hover:bg-azul-hondo transition-colors shadow-lg active:scale-95"
                      >
                        {applyingStrategy === promo.id
                          ? <span className="flex items-center justify-center gap-1"><Zap size={12} /> Procesando...</span>
                          : <span className="flex items-center justify-center gap-1"><Target size={12} /> Activar Oferta</span>
                        }
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-500 text-sm font-bold">Mercado Estable • Sin sugerencias de descuento</p>
            </div>
          )}
        </div>
      </section>

      {/* STRATEGY MODAL */}
      {showModal && selectedPromo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-tinta/45 backdrop-blur-sm" onClick={() => setShowModal(false)} role="presentation" aria-hidden="true"></div>
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-lg relative z-10 overflow-hidden animate-in zoom-in-95 duration-200 text-tinta">
            <div className="bg-azul p-8 text-white relative">
              <div className="absolute top-0 right-0 p-8 opacity-10"><Target size={64} /></div>
              <h3 className="titular text-2xl">Activar Promoción</h3>
              <p className="text-xs font-bold text-white/80 mt-1">Detalles de la Sugerencia</p>
            </div>

            <div className="p-8 space-y-8">
              <div className="space-y-2 text-center sm:text-left">
                <p className="text-xs font-bold text-slate-500">Intervenir Producto</p>
                <p className="text-2xl font-bold text-tinta">{selectedPromo.productName}</p>
              </div>

              <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-100">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-500">Precio Hoy</p>
                  <p className="text-2xl font-bold text-slate-500 line-through opacity-60">${selectedPromo.originalPrice?.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-exito">Nuevo Precio</p>
                  <p className="text-3xl font-bold text-tinta border-b-2 border-emerald-500/50 pb-1 inline-block">
                    ${Math.round(selectedPromo.originalPrice * (1 - customDiscount / 100)).toLocaleString('es-CO')}
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-200/80 shadow-inner">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-slate-600">Ajustar Descuento</p>
                  <span className="text-[14px] font-bold text-azul bg-azul/10 px-3 py-1 rounded-2xl border border-azul/30">{customDiscount}% OFF</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="1"
                  value={customDiscount}
                  onChange={(e) => setCustomDiscount(Number(e.target.value))}
                  className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-azul focus:outline-none focus:ring-2 focus:ring-azul/50"
                />
                <div className="flex justify-between text-xs font-bold text-slate-500">
                  <span>0%</span>
                  <span className={customDiscount === selectedPromo.discount ? 'text-azul font-bold' : ''}>Sugerido IA: {selectedPromo.discount}%</span>
                  <span>90%</span>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex justify-between items-center">
                <p className="text-xs font-bold text-azul">Ahorro para el Cliente</p>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">-${Math.round(selectedPromo.originalPrice * (customDiscount / 100)).toLocaleString('es-CO')} COP</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => setShowModal(false)} className="flex-1 py-4 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
                <button
                  onClick={confirmExecution}
                  disabled={applyingStrategy}
                  className="flex-[1.5] bg-azul text-white py-4 rounded-lg text-xs font-bold hover:bg-azul-hondo transition-colors shadow-lg disabled:opacity-50"
                >
                  {applyingStrategy ? 'Procesando...' : 'Ejecutar Ahora'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>)}

      {/* WELCOME ALERT MODAL */}
      {welcomeAlert && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-500">
          <div className="absolute inset-0 bg-tinta/90 backdrop-blur-sm" onClick={() => setWelcomeAlert(null)}></div>
          <div className={`relative z-10 w-full max-w-xl rounded-2xl p-8 md:p-12 shadow-lg text-center transform animate-in zoom-in-95 duration-500 ${welcomeAlert.type === 'critical' ? 'bg-peligro text-white' :
              welcomeAlert.type === 'warning' ? 'bg-aviso text-white' :
                'bg-exito text-white'
            }`}>
            <div className="mx-auto w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <welcomeAlert.icon size={48} className="text-white drop-shadow-md" />
            </div>
            <h2 className="titular text-3xl md:text-5xl mb-4 drop-shadow-sm">{welcomeAlert.title}</h2>
            <p className="text-lg md:text-xl font-medium text-white/90 leading-relaxed mb-10">{welcomeAlert.message}</p>
            <button
              onClick={() => setWelcomeAlert(null)}
              className="w-full py-5 bg-menu hover:bg-slate-800 active:scale-95 text-white rounded-lg font-bold transition-all shadow-lg text-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
