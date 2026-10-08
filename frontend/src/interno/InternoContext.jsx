import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { api, renovarCsrf } from './api';

const InternoContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components -- el hook se exporta junto a su Provider (igual que AuthContext)
export const useInterno = () => useContext(InternoContext);

// Peticiones del panel que NO deben sacar al equipo de la pantalla si responden 401 (son las del propio acceso).
const RUTAS_DE_ACCESO = /\/api\/interno\/(login|2fa|logout|sesion)$/;

/**
 * Sesión del EQUIPO. Es independiente de AuthContext (la de las tiendas): son mundos distintos en el servidor y aquí
 * tampoco se mezclan.
 */
export function InternoProvider({ children }) {
  const [equipo, setEquipo] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    api.sesion()
      .then((r) => { if (vigente) setEquipo(r.autenticado ? r.equipo : null); })
      .catch(() => { if (vigente) setEquipo(null); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);

  // Si el servidor dice que la sesión del panel ya no vale (caducó, o desactivaron la cuenta), se vuelve al acceso.
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (respuesta) => respuesta,
      (error) => {
        const url = error.config?.url || '';
        if (error.response?.status === 401 && url.startsWith('/api/interno/') && !RUTAS_DE_ACCESO.test(url)) setEquipo(null);
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  /** Paso 1: usuario y contraseña. Devuelve { requiere2FA: true }; todavía NO hay sesión. */
  const iniciarSesion = useCallback(async (usuario, password) => {
    await renovarCsrf();
    const respuesta = await api.login(usuario, password);
    await renovarCsrf();
    return respuesta;
  }, []);

  /** Paso 2: el código de Google Authenticator. Aquí se abre la sesión. */
  const verificarCodigo = useCallback(async (token) => {
    const respuesta = await api.segundoFactor(token);
    await renovarCsrf();
    setEquipo(respuesta.equipo);
  }, []);

  const salir = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Aunque el servidor no responda, la pantalla sale: la sesión caduca sola.
    }
    setEquipo(null);
    await renovarCsrf().catch(() => {});
  }, []);

  const valor = useMemo(
    () => ({ equipo, cargando, iniciarSesion, verificarCodigo, salir }),
    [equipo, cargando, iniciarSesion, verificarCodigo, salir]
  );
  return <InternoContext.Provider value={valor}>{children}</InternoContext.Provider>;
}
