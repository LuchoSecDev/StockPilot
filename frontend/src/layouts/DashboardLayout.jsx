import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationCenter from '../components/NotificationCenter';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { useSidebar } from '../context/SidebarContext';
import { Store, Menu, X, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Activar2FAModal from '../components/security/Activar2FAModal';
import { EVENTO_2FA_REQUERIDO, debeMostrarAvisoDosFactores } from '../utils/security2FA';

const DashboardLayout = () => {
  const { toggleSidebar, isOpen, isCollapsed } = useSidebar();
  const { user } = useAuth();

  const marginLeft = isCollapsed ? 'md:ml-20' : 'md:ml-64';

  // Aviso de activación del 2FA: se abre al hacer clic en el aviso del encabezado (voluntario) o cuando el
  // servidor rechaza una escritura por falta de 2FA (trae su mensaje).
  const [abierto2FA, setAbierto2FA] = useState(false);
  const [mensajeBloqueo2FA, setMensajeBloqueo2FA] = useState('');

  useEffect(() => {
    const alRequerirDosFactores = (e) => {
      setMensajeBloqueo2FA(e.detail?.message || '');
      setAbierto2FA(true);
    };
    window.addEventListener(EVENTO_2FA_REQUERIDO, alRequerirDosFactores);
    return () => window.removeEventListener(EVENTO_2FA_REQUERIDO, alRequerirDosFactores);
  }, []);

  const abrirAvisoVoluntario2FA = () => {
    setMensajeBloqueo2FA('');
    setAbierto2FA(true);
  };

  const mostrarAviso2FA = debeMostrarAvisoDosFactores(user);

  return (
    <div className="flex w-full min-h-screen bg-papel overflow-x-hidden relative">
      
      {/* 📱 Mobile Top Bar (Only < 768px) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-azul text-white rounded-lg flex items-center justify-center shadow-md">
            <Store size={16} />
          </div>
          <span className="font-bold text-tinta text-sm underline decoration-azul underline-offset-4">StockPilot</span>
        </div>
        <div className="flex items-center gap-4">
          {mostrarAviso2FA && (
            <button
              type="button"
              onClick={abrirAvisoVoluntario2FA}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"
              title="Activa la verificación en dos pasos (recomendado)"
            >
              <Shield size={14} className="text-amber-600 animate-pulse" />
              <span>2FA</span>
            </button>
          )}
          <div className="mt-1">
            <NotificationCenter />
          </div>
          <button
            onClick={toggleSidebar}
            aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
            className="w-10 h-10 bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center border border-slate-200 active:scale-95 transition-transform"
          >
            {isOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Menú Lateral (FIJO) */}
      <Sidebar />

      {/* Area de Contenido Principal (Con margen reactivo para el sidebar fijo) */}
      <main className={`
        flex-grow relative min-h-screen transition-[margin] duration-300 ease-in-out
        ${marginLeft}
        ${isOpen ? 'hidden md:flex' : 'flex'} flex-col
        pt-16 md:pt-0
        grain-bg
      `}>
        {/* 🖥️ Desktop Header (Only md+) */}
        <header className="hidden md:flex items-center justify-end px-12 h-14 w-full z-[150] shrink-0">
            {mostrarAviso2FA && (
              <button
                type="button"
                onClick={abrirAvisoVoluntario2FA}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-sm transition-all cursor-pointer mr-4"
                title="Haz clic para activar la verificación en dos pasos"
              >
                <Shield size={14} className="text-amber-600 animate-pulse" />
                <span>Activa la verificación en 2 pasos (recomendado)</span>
              </button>
            )}
            <div className="mt-2">
              <NotificationCenter />
            </div>
        </header>

        {/* Contenedor Fluido */}
        <div className="p-4 md:p-8 lg:px-12 lg:pb-12 lg:pt-2 max-w-7xl xl:max-w-[1600px] mx-auto w-full flex-grow flex flex-col gap-8">
          <Outlet />
        </div>
      </main>

      {/* Botón Flotante de Scroll (Nivel Raíz para evitar estiramientos) */}
      <ScrollToTopButton />

      <Activar2FAModal abierto={abierto2FA && mostrarAviso2FA} mensajeBloqueo={mensajeBloqueo2FA} onCerrar={() => setAbierto2FA(false)} />
    </div>
  );
};

export default DashboardLayout;
