import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import PuntoVentaPage from './pages/PuntoVentaPage';
import CarteraPage from './pages/CarteraPage';
import MovimientosPage from './pages/MovimientosPage';
import ProductosPage from './pages/ProductosPage';
import ReportesPage from './pages/ReportesPage';
import TiendasPage from './pages/TiendasPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import AnalisisDetalladoPage from './pages/AnalisisDetalladoPage';
import RegistroTenderoPage from './pages/RegistroTenderoPage';
import ComunicadosPage from './pages/ComunicadosPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import LandingPage from './pages/LandingPage';
import RegisterPage from './pages/RegisterPage';
import PoliticaDatosPage from './pages/PoliticaDatosPage';
import ProveedoresPage from './pages/ProveedoresPage';
import PedirPage from './pages/PedirPage';
import AlertasPage from './pages/AlertasPage';
import AuditoriaPage from './pages/AuditoriaPage';
const AnalyticsDashboardPage = lazy(() => import('./pages/AnalyticsDashboardPage'));
import SimuladorPage from './pages/SimuladorPage';
const AprendizajePage = lazy(() => import('./pages/AprendizajePage'));
// Panel interno del equipo (plan 22): su código no viaja en el bundle de las tiendas.
const InternoApp = lazy(() => import('./interno/InternoApp'));
import ForcePasswordPage from './pages/ForcePasswordPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SidebarProvider } from './context/SidebarContext';

// Rutas protegidas
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.cambioClaveForzoso) {
    return <Navigate to="/activacion-cuenta" replace />;
  }
  return children;
};

// Rutas públicas (redirigen al dashboard si ya hay sesión)
const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  if (user) {
    if (user.cambioClaveForzoso) {
      return <Navigate to="/activacion-cuenta" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Rutas exclusivas para Administrador
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user || user.rol !== 'Administrador') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Ruta especial para el flujo forzado
const ForceChangeRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.cambioClaveForzoso) return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  return (
    <ToastProvider>
    <AuthProvider>
      <SidebarProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } />
          
          <Route path="/forgot-password" element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          } />

          <Route path="/register" element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          } />

          {/* Pública sin importar sesión: enlazada desde el registro y desde el pie de la Landing */}
          <Route path="/politica-datos" element={<PoliticaDatosPage />} />

          {/* Redirigir la raíz a la Landing Page (es pública, pero si hay sesión irá al Dashboard) */}
          <Route path="/" element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          } />

          {/* Panel interno del equipo: sesión propia, fuera del layout y de las rutas protegidas de tienda */}
          <Route path="/interno/*" element={<Suspense fallback={<div className="p-10 text-center animate-pulse text-azul font-bold text-xs">Cargando panel interno...</div>}><InternoApp /></Suspense>} />

          {/* Ruta Especial: Activación de Cuenta Obligatoria */}
          <Route path="/activacion-cuenta" element={
            <ForceChangeRoute>
              <ForcePasswordPage />
            </ForceChangeRoute>
          } />
          
          {/* Rutas Privadas con Layout del Dashboard */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ventas" element={<PuntoVentaPage />} />
            <Route path="/productos" element={<ProductosPage />} />
            <Route path="/alertas" element={<AlertasPage />} />
            <Route path="/tiendas" element={<TiendasPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            {/* Rutas exclusivas de Administrador */}
            <Route path="/cartera" element={<AdminRoute><CarteraPage /></AdminRoute>} />
            <Route path="/movimientos" element={<AdminRoute><MovimientosPage /></AdminRoute>} />
            <Route path="/proveedores" element={<AdminRoute><ProveedoresPage /></AdminRoute>} />
            <Route path="/pedir" element={<AdminRoute><PedirPage /></AdminRoute>} />
            <Route path="/analitica-visual" element={<AdminRoute><Suspense fallback={<div className="p-10 text-center animate-pulse text-azul font-bold text-xs">Cargando módulo de analítica...</div>}><AnalyticsDashboardPage /></Suspense></AdminRoute>} />
            <Route path="/analisis-detallado" element={<AdminRoute><AnalisisDetalladoPage /></AdminRoute>} />
            <Route path="/comunicados" element={<AdminRoute><ComunicadosPage /></AdminRoute>} />
            <Route path="/simulador" element={<AdminRoute><SimuladorPage /></AdminRoute>} />
            <Route path="/reportes" element={<AdminRoute><ReportesPage /></AdminRoute>} />
            <Route path="/auditoria" element={<AdminRoute><AuditoriaPage /></AdminRoute>} />
            <Route path="/aprendizaje" element={<AdminRoute><Suspense fallback={<div className="p-10 text-center animate-pulse text-azul font-bold text-xs">Cargando módulo de IA...</div>}><AprendizajePage /></Suspense></AdminRoute>} />
            <Route path="/registro-tendero" element={<AdminRoute><RegistroTenderoPage /></AdminRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
      </SidebarProvider>
    </AuthProvider>
    </ToastProvider>
  );
}

export default App;
