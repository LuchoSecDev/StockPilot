import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useInterno } from './InternoContext';

const ENLACES = [
  { a: '/interno/tiendas', texto: 'Tiendas' },
  { a: '/interno/embudo', texto: 'Embudo' },
  { a: '/interno/bitacora', texto: 'Bitácora' }
];

/** Marco del panel: su propia barra de navegación (no usa el menú lateral de las tiendas). */
const InternoLayout = () => {
  const { equipo, salir } = useInterno();
  const navegar = useNavigate();

  // Es una herramienta interna: que ningún buscador la indexe y que la pestaña se distinga de la app de las tiendas.
  useEffect(() => {
    const anterior = document.title;
    document.title = 'Panel interno — StockPilot';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.title = anterior; meta.remove(); };
  }, []);

  const cerrar = async () => {
    await salir();
    navegar('/interno/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-papel">
      <header className="bg-menu text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="titular text-lg">StockPilot <span className="font-normal opacity-70">· Panel interno</span></span>
          <nav aria-label="Secciones del panel" className="flex gap-1 flex-1">
            {ENLACES.map(({ a, texto }) => (
              <NavLink
                key={a} to={a}
                className={({ isActive }) => `px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`}
              >
                {texto}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="opacity-80">{equipo?.nombre}</span>
            <button type="button" onClick={cerrar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <LogOut size={14} aria-hidden="true" /> Salir
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-24">
        <Outlet />
      </main>
    </div>
  );
};

export default InternoLayout;
