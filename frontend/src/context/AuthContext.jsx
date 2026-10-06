import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import AppLoader from '../components/common/AppLoader';

// Ensure all requests send the session cookie through the Vite proxy
axios.defaults.withCredentials = true;

// Obtener token CSRF al cargar la app y configurarlo en axios
axios.get('/api/csrf-token').then(response => {
  if(response.data.csrfToken) {
    axios.defaults.headers.common['x-csrf-token'] = response.data.csrfToken;
  }
}).catch(err => console.warn("No se pudo obtener CSRF Token inicial", err));

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components -- el hook se exporta junto a su Provider
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // INTERCEPTOR GLOBAL DE SEGURIDAD
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          const isConcurrent = error.response.data?.code === 'CONCURRENT_SESSION';
          
          if (isConcurrent) {
             // Expulsión forzosa por seguridad concurrente
             setUser(null);
             window.location.href = '/login?reason=concurrent';
          } else if (user) {
             // Sesión expirada normal
             setUser(null);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [user]);

  const checkSession = useCallback(async (signal) => {
    try {
      const res = await axios.get('/api/session-info', { ...(signal && { signal }) });
      if (signal && signal.aborted) return;
      if (res.data && res.data.userId) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch (err) {
      if (axios.isCancel(err) || (signal && signal.aborted)) return;
      setUser(null);
    } finally {
      if (!signal || !signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    checkSession(controller.signal);
    return () => controller.abort();
  }, [checkSession]);

  const login = useCallback(async (identificador, password, force = false) => {
    try {
      const res = await axios.post('/api/login', { login: identificador, password, force });
      if (res.data.success) {
        // Renovar token CSRF ya que la sesión fue regenerada en el backend
        try {
          const csrfRes = await axios.get('/api/csrf-token');
          if (csrfRes.data?.csrfToken) {
            axios.defaults.headers.common['x-csrf-token'] = csrfRes.data.csrfToken;
          }
        } catch (e) {
          console.warn("No se pudo renovar el CSRF Token post-login", e);
        }

        if (res.data.require2FA) {
            return { require2FA: true };
        }
        await checkSession();
        return { success: true, user: res.data.user };
      } else {
        throw new Error(res.data.error || 'Error de inicio de sesión');
      }
    } catch (err) {
      const apiError = err.response?.data;
      if (apiError?.code === 'SESSION_ACTIVE') {
        const sessionError = new Error(apiError.error);
        sessionError.code = 'SESSION_ACTIVE';
        throw sessionError;
      }
      throw new Error(apiError?.error || err.message || 'Error de conexión');
    }
  }, [checkSession]);

  const verify2FA = useCallback(async (token) => {
      try {
          const res = await axios.post('/api/2fa/verify', { token });
          if (res.data.success) {
              await checkSession();
              return { success: true, user: res.data.user };
          }
          throw new Error(res.data.error || 'Código incorrecto');
      } catch (err) {
          throw new Error(err.response?.data?.error || err.message || 'Error validando 2FA');
      }
  }, [checkSession]);

  const logout = useCallback(async () => {
    try {
      await axios.post('/api/logout');
    } catch (err) {
      console.error('Error al cerrar sesión', err);
    } finally {
      setUser(null);
    }
  }, []);

  const switchStore = useCallback(async (tiendaId) => {
    try {
      const res = await axios.post(`/api/tiendas/switch/${tiendaId}`);
      if (res.data.success) {
        // Refrescar el estado del usuario para obtener el nuevo tiendaId y tiendaNombre
        await checkSession();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error al cambiar de tienda', err);
      throw new Error(err.response?.data?.error || 'Error al cambiar de tienda');
    }
  }, [checkSession]);

  // Cambia el menú de la propia cuenta ('basico' o 'avanzado'). El estado local solo se actualiza cuando el servidor
  // confirma: si falla (red, sesión vencida), el menú no cambia y la pantalla puede avisar con el error que se lanza.
  const cambiarModoInterfaz = useCallback(async (modo) => {
    try {
      const res = await axios.patch('/api/perfil/modo-interfaz', { modo });
      if (!res.data.success) throw new Error(res.data.error || 'No se pudo cambiar el modo');
      setUser((actual) => (actual ? { ...actual, modoInterfaz: res.data.modoInterfaz } : actual));
    } catch (err) {
      throw new Error(err.response?.data?.error || err.message || 'No se pudo cambiar el modo');
    }
  }, []);

  const value = useMemo(() => ({ user, login, verify2FA, logout, switchStore, cambiarModoInterfaz, loading, checkSession }), [user, login, verify2FA, logout, switchStore, cambiarModoInterfaz, loading, checkSession]);

  return (
    <AuthContext.Provider value={value}>
      {loading ? <AppLoader /> : children}
    </AuthContext.Provider>
  );
};
