import { Routes, Route, Navigate } from 'react-router-dom';
import { InternoProvider, useInterno } from './InternoContext';
import InternoLayout from './InternoLayout';
import InternoLoginPage from './InternoLoginPage';
import TiendasPage from './TiendasPage';
import TiendaDetallePage from './TiendaDetallePage';
import EmbudoPage from './EmbudoPage';
import BitacoraPage from './BitacoraPage';
import { Cargando } from './componentes';

const Privada = ({ children }) => {
  const { equipo, cargando } = useInterno();
  if (cargando) return <Cargando texto="Comprobando tu sesión…" />;
  return equipo ? children : <Navigate to="/interno/login" replace />;
};

const Publica = ({ children }) => {
  const { equipo, cargando } = useInterno();
  if (cargando) return <Cargando texto="Comprobando tu sesión…" />;
  return equipo ? <Navigate to="/interno/tiendas" replace /> : children;
};

/**
 * Panel interno del equipo (plan 22). Se carga de forma diferida desde App.jsx: su código NO viaja en el bundle de las
 * tiendas. Vive bajo `/interno/*`, fuera del DashboardLayout y de las rutas protegidas de tienda.
 */
const InternoApp = () => (
  <InternoProvider>
    <Routes>
      <Route path="login" element={<Publica><InternoLoginPage /></Publica>} />
      <Route element={<Privada><InternoLayout /></Privada>}>
        <Route index element={<Navigate to="tiendas" replace />} />
        <Route path="tiendas" element={<TiendasPage />} />
        <Route path="tiendas/:id" element={<TiendaDetallePage />} />
        <Route path="embudo" element={<EmbudoPage />} />
        <Route path="bitacora" element={<BitacoraPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/interno" replace />} />
    </Routes>
  </InternoProvider>
);

export default InternoApp;
