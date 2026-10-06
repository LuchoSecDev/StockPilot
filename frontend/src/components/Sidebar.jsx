import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import {
  LayoutDashboard, ShoppingCart, Package, Bell, Store,
  ArrowLeftRight, Truck, TrendingDown, FlaskConical,
  FileText, ScanSearch, Brain, Users, User, LogOut,
  X, ChevronLeft, ChevronRight, Megaphone, Wallet, SlidersHorizontal, LayoutList, ClipboardList
} from 'lucide-react';
import { enlacesDelMenu, modoOpuesto } from '../utils/menu';

// Ícono de cada enlace según su ruta; qué enlaces se muestran lo decide utils/menu.js (rol + modo).
const ICONOS = {
  '/dashboard': LayoutDashboard, '/ventas': ShoppingCart, '/productos': Package, '/pedir': ClipboardList, '/alertas': Bell,
  '/tiendas': Store, '/cartera': Wallet, '/movimientos': ArrowLeftRight, '/comunicados': Megaphone,
  '/proveedores': Truck, '/analitica-visual': TrendingDown, '/simulador': FlaskConical, '/reportes': FileText,
  '/auditoria': ScanSearch, '/aprendizaje': Brain, '/registro-tendero': Users, '/perfil': User,
};

const Sidebar = () => {
  const { logout, user, switchStore, cambiarModoInterfaz } = useAuth();
  const [errorModo, setErrorModo] = useState('');
  const { isOpen, isCollapsed, toggleCollapse, closeSidebar } = useSidebar();
  const [alertCount, setAlertCount] = useState(0);
  const [tiendas, setTiendas] = useState([]);
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchAlerts = async () => {
      try {
        const { data } = await axios.get('/api/dashboard/stats', { signal: controller.signal });
        if (controller.signal.aborted) return;
        setAlertCount((data.alertasCriticas > 0) ? data.alertasCriticas : (data.alertasAdvertencia > 0) ? data.alertasAdvertencia : 0);
      } catch (err) {
        if (!axios.isCancel(err) && !controller.signal.aborted) {
          console.error('Error fetching alerts for sidebar', err);
        }
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (user?.rol === 'Administrador') {
      axios.get('/api/tiendas')
        .then(res => { if (res.data.success) setTiendas(res.data.tiendas); })
        .catch(err => console.error('Error fetching stores in sidebar', err));
    }
  }, [user?.tiendaId, user?.rol]);

  const links = enlacesDelMenu(user?.rol, user?.modoInterfaz).map((e) => ({ ...e, icon: ICONOS[e.to] }));

  const esBasico = user?.modoInterfaz === 'basico';
  const textoModo = esBasico ? 'Ver menú completo' : 'Ver menú simple';
  const IconoModo = esBasico ? SlidersHorizontal : LayoutList;

  const alternarModo = async () => {
    setErrorModo('');
    try {
      await cambiarModoInterfaz(modoOpuesto(user?.modoInterfaz));
    } catch (err) {
      setErrorModo(err.message);
    }
  };

  const sidebarWidth = isCollapsed ? 'w-20' : 'w-64';

  return (
    <>
      {/* Overlay Móvil */}
      {isOpen && (
        <div
          role="presentation"
          className="fixed inset-0 bg-tinta/45 backdrop-blur-sm z-[100] md:hidden transition-opacity"
          onClick={closeSidebar}
          onKeyDown={(e) => { if (e.key === 'Escape') closeSidebar(); }}
        />
      )}

      {/* Sidebar Principal */}
      <div data-surface="dark" className={`
        fixed left-0 top-0 h-screen z-40 max-md:z-[200]
        bg-menu text-white py-6 flex flex-col justify-between
        shadow-lg transition-[width,transform] duration-300 ease-in-out
        ${sidebarWidth}
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        ${isCollapsed ? 'items-center' : ''}
        shrink-0 overflow-visible
      `}>

        {/* Logo / Header */}
        <div className="flex flex-col items-center mb-10 px-4 relative shrink-0">

          {/* Cerrar — solo móvil */}
          <button
            onClick={closeSidebar}
            className="md:hidden absolute right-2 top-2 bg-rose-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform z-10"
          >
            <X size={14} />
          </button>

          {/* Colapsar — desktop */}
          <button
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
            className={`
              hidden md:flex absolute top-10 -right-4 w-8 h-8 rounded-full
              bg-resaltador hover:bg-resaltador-hondo text-tinta
              items-center justify-center transition-transform transition-colors shadow-md
              active:scale-90 border-2 border-menu z-[120]
            `}
            title={isCollapsed ? "Expandir" : "Colapsar"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>

          {/* Logo */}
          <div className="flex flex-col items-center w-full relative">
            <div className={`
              bg-white text-azul rounded-2xl flex items-center justify-center shadow-lg transition-[width,height,background-color,color]
              ${isCollapsed ? 'w-10 h-10' : 'w-16 h-16 mb-4'}
            `}>
              <Store size={isCollapsed ? 20 : 32} />
            </div>

            {!isCollapsed && (
              <div className="text-center animate-fade-in w-full">
                <h1 className="titular text-2xl text-white">StockPilot</h1>
                
                {/* Selector de tienda */}
                {user?.rol === 'Administrador' && tiendas.length > 0 ? (
                  <div className="mt-3 relative w-full">
                    <button 
                      onClick={() => setIsStoreDropdownOpen(!isStoreDropdownOpen)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white/10 border border-white/20 hover:bg-white/15 hover:border-white/40 rounded-lg transition-all shadow-inner group"
                    >
                      <div className="flex flex-col items-start overflow-hidden">
                        <span className="text-xs text-slate-200 font-bold leading-none">Tienda Activa</span>
                        <span className="text-xs font-bold text-white truncate max-w-[130px] leading-tight mt-0.5 group-hover:text-resaltador transition-colors">
                          {user?.tiendaNombre || 'Cargando...'}
                        </span>
                      </div>
                      <ChevronRight size={14} className={`text-slate-200 shrink-0 transition-transform duration-300 ${isStoreDropdownOpen ? 'rotate-90' : ''}`} />
                    </button>

                    {isStoreDropdownOpen && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-menu border border-white/20 rounded-2xl shadow-lg overflow-hidden z-[300] py-1 animate-fade-in">
                        {tiendas.map(t => (
                          <button
                            key={t.id_tienda}
                            onClick={async () => {
                              if (t.id_tienda !== user.tiendaId) {
                                await switchStore(t.id_tienda);
                              }
                              setIsStoreDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 ${t.id_tienda === user.tiendaId ? 'bg-white/10 text-white font-bold' : 'text-slate-100 hover:bg-white/10 hover:text-white'}`}
                          >
                            <Store size={12} className={t.id_tienda === user.tiendaId ? 'text-resaltador' : 'text-slate-500'} />
                            <span className="truncate">{t.nombre_establecimiento}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs font-bold text-white/90 mt-1">Inteligencia Stock</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-grow flex flex-col space-y-1 px-3 overflow-y-auto scrollbar-hide overflow-x-visible">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                id={link.id}
                onClick={() => { if (window.innerWidth < 768) closeSidebar(); }}
                className={({ isActive }) =>
                  `flex items-center group py-3 transition-colors transition-shadow duration-300 rounded-2xl relative mb-1 ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'
                  } ${isActive
                    ? 'border-l-4 border-resaltador bg-white/10 text-white font-bold'
                    : 'border-l-4 border-transparent text-white/90 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        size={18}
                        className={`shrink-0 transition-transform ${isActive ? 'opacity-100 scale-110' : 'opacity-100'}`}
                      />
                      {!isCollapsed && <span className="text-sm tracking-wide">{link.text}</span>}
                    </div>

                    {!isCollapsed && link.to === "/alertas" && alertCount > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold shadow-sm ${isActive ? 'bg-white text-azul' : 'bg-rose-500 text-white animate-pulse'}`}>
                        {alertCount}
                      </span>
                    )}

                    {isCollapsed && (
                      <div className="absolute left-full ml-4 px-3 py-2 bg-menu text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[200] border border-white/20 shadow-lg font-bold translate-x-1 group-hover:translate-x-0">
                        {link.text}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Interruptor del menú: siempre visible, para que nadie se sienta «encerrado» en el modo simple (plan 19, 3.4.1) */}
          <button
            id="nav-modo-interfaz"
            onClick={alternarModo}
            title={textoModo}
            aria-label={textoModo}
            className={`
              flex items-center gap-3 py-3 mt-4 rounded-lg shrink-0 transition-colors
              border border-white/20 text-white/90 hover:bg-white/10 hover:text-white
              ${isCollapsed ? 'justify-center px-0' : 'px-4'}
            `}
          >
            <IconoModo size={18} />
            {!isCollapsed && <span className="text-sm">{textoModo}</span>}
          </button>
          {errorModo && !isCollapsed && (
            <p role="alert" className="text-xs text-rose-200 px-4 mt-1">{errorModo}</p>
          )}

          <button
            onClick={logout}
            className={`
              flex items-center gap-3 py-3 transition-colors text-slate-100 hover:text-rose-300 hover:bg-rose-500/15 mt-2 rounded-lg shrink-0
              ${isCollapsed ? 'justify-center px-0' : 'px-4'}
            `}
          >
            <LogOut size={18} />
            {!isCollapsed && <span className="text-sm">Cerrar Sesión</span>}
          </button>
        </nav>

        {/* Footer */}
        <div className="p-4 shrink-0 mt-2 border-t border-white/10">
          <p className="text-xs text-slate-200 text-center font-bold">
            {isCollapsed ? 'v3.0' : 'StockPilot Project v3.0'}
          </p>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
