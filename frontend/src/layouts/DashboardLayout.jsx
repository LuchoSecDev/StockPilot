import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import NotificationCenter from '../components/NotificationCenter';
import ScrollToTopButton from '../components/ScrollToTopButton';
import { useSidebar } from '../context/SidebarContext';
import { Store, Menu, X, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import axios from 'axios';

const DashboardLayout = () => {
  const { toggleSidebar, isOpen, isCollapsed } = useSidebar();
  const { user } = useAuth();
  const toast = useToast();
  
  const marginLeft = isCollapsed ? 'md:ml-20' : 'md:ml-64';

  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [dismissed2FA, setDismissed2FA] = useState(() => sessionStorage.getItem('dismissed2FA') === 'true');

  useEffect(() => {
    setDismissed2FA(sessionStorage.getItem('dismissed2FA') === 'true');
  }, [user?.userId]);

  useEffect(() => {
    const handleRequire2FA = (e) => {
      sessionStorage.removeItem('dismissed2FA');
      setDismissed2FA(false);
      if (e.detail?.message) {
        toast.warning(e.detail.message);
      }
    };
    window.addEventListener('require-2fa', handleRequire2FA);
    return () => window.removeEventListener('require-2fa', handleRequire2FA);
  }, [toast]);

  useEffect(() => {
    if (!user?.needs2FASetup || qrCodeUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.post('/api/2fa/generate');
        if (data.success && !cancelled) {
          setQrCodeUrl(data.qrCode);
        }
      } catch {
        if (!cancelled) toast.error('Error generando configuración 2FA');
      }
    })();
    return () => { cancelled = true; };
  }, [user?.needs2FASetup, qrCodeUrl, toast]);

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/2fa/verify', { token: totpToken });
      sessionStorage.removeItem('dismissed2FA');
      toast.success('2FA Habilitado con éxito');
      window.location.reload(); 
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código incorrecto');
    }
  };

  const renderForce2FA = () => {
    if (!user?.needs2FASetup || dismissed2FA) return null;
    return (
      <div className="fixed inset-0 bg-tinta/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-6">
        <form onSubmit={handleVerify2FA} className="bg-white w-full max-w-md p-10 rounded-2xl shadow-lg animate-scale-in text-center">
          <div className="w-16 h-16 bg-azul/10 text-azul rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield size={32} />
          </div>
          <h2 className="titular text-2xl text-tinta mb-2">Configurar Seguridad</h2>
          <p className="text-xs text-slate-500 font-bold mb-6 leading-relaxed">
            Como Administrador, es obligatorio configurar 2FA para crear, editar o eliminar registros.<br/>
            1. Descarga Google Authenticator.<br/>
            2. Escanea el código QR y digita el código de 6 dígitos.
          </p>

          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="Código QR 2FA" className="mx-auto w-48 h-48 border-4 border-slate-100 rounded-2xl mb-6 shadow-sm" />
          ) : (
            <div className="w-48 h-48 bg-slate-100 animate-pulse mx-auto rounded-2xl mb-6"></div>
          )}

          <div className="space-y-1 mb-8 text-left">
            <label htmlFor="totp-token-layout" className="text-xs font-bold text-slate-600 ml-1">3. Ingresa el código de 6 dígitos</label>
            <input
              id="totp-token-layout"
              type="text"
              maxLength="6"
              value={totpToken}
              required
              placeholder="000000"
              onChange={e => setTotpToken(e.target.value.replace(/\D/g, ''))}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-2xl font-bold focus:border-azul outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-azul hover:bg-azul-hondo text-white rounded-lg text-xs font-bold shadow-lg transition-colors"
          >
            Verificar y Activar
          </button>
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem('dismissed2FA', 'true');
              setDismissed2FA(true);
            }}
            className="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-700 font-bold transition-colors"
          >
            Configurar más tarde
          </button>
        </form>
      </div>
    );
  };

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
          {user?.needs2FASetup && dismissed2FA && (
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem('dismissed2FA');
                setDismissed2FA(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"
              title="2FA Pendiente: Se requiere para modificar registros"
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
            {user?.needs2FASetup && dismissed2FA && (
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('dismissed2FA');
                  setDismissed2FA(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-sm transition-all cursor-pointer mr-4"
                title="Haz clic para activar 2FA ahora"
              >
                <Shield size={14} className="text-amber-600 animate-pulse" />
                <span>2FA Pendiente (Requerido para modificar registros)</span>
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

      {/* Modal global forzado para Admins sin 2FA */}
      {renderForce2FA()}
    </div>
  );
};

export default DashboardLayout;
