import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { useInterno } from './InternoContext';
import { mensajeDeError } from './api';

/** Acceso del equipo en DOS pasos: usuario y contraseña, y luego el código de Google Authenticator (obligatorio). */
const InternoLoginPage = () => {
  const { iniciarSesion, verificarCodigo } = useInterno();
  const navegar = useNavigate();
  const [paso, setPaso] = useState('clave');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviarClave = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await iniciarSesion(usuario.trim(), password);
      setPassword('');
      setPaso('codigo');
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo iniciar sesión. Intenta de nuevo.'));
    } finally {
      setEnviando(false);
    }
  };

  const enviarCodigo = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await verificarCodigo(codigo);
      navegar('/interno/tiendas', { replace: true });
    } catch (err) {
      setError(mensajeDeError(err, 'No se pudo verificar el código. Intenta de nuevo.'));
      setCodigo('');
      // Si el intento de entrada caducó, el servidor ya no tiene el paso 1: se vuelve a empezar.
      if (err?.response?.status === 401 && /de nuevo/i.test(err.response.data?.error || '')) setPaso('clave');
    } finally {
      setEnviando(false);
    }
  };

  const campo = 'w-full p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:border-azul outline-none';

  return (
    <div className="min-h-screen bg-papel flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-sm p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="w-14 h-14 bg-azul/10 text-azul rounded-full flex items-center justify-center mx-auto mb-4">
          {paso === 'clave' ? <KeyRound size={26} aria-hidden="true" /> : <ShieldCheck size={26} aria-hidden="true" />}
        </div>
        <h1 className="titular text-2xl text-tinta text-center">Panel interno</h1>
        <p className="text-xs font-bold text-slate-500 text-center mt-1 mb-6">
          {paso === 'clave' ? 'Solo para el equipo de StockPilot.' : 'Escribe el código de 6 dígitos de Google Authenticator.'}
        </p>

        {error && <p role="alert" className="mb-4 p-3 rounded-lg bg-peligro-suave text-peligro text-xs font-bold">{error}</p>}

        {paso === 'clave' ? (
          <form onSubmit={enviarClave} className="space-y-4">
            <div>
              <label htmlFor="interno-usuario" className="text-xs font-bold text-slate-600 ml-1">Usuario</label>
              <input id="interno-usuario" className={campo} type="text" autoComplete="username" required value={usuario} onChange={(e) => setUsuario(e.target.value)} />
            </div>
            <div>
              <label htmlFor="interno-clave" className="text-xs font-bold text-slate-600 ml-1">Contraseña</label>
              <input id="interno-clave" className={campo} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" disabled={enviando} className="w-full py-4 bg-azul hover:bg-azul-hondo text-white rounded-lg text-xs font-bold shadow-lg transition-colors disabled:opacity-50">
              {enviando ? 'Verificando…' : 'Continuar'}
            </button>
          </form>
        ) : (
          <form onSubmit={enviarCodigo} className="space-y-4">
            <div>
              <label htmlFor="interno-codigo" className="text-xs font-bold text-slate-600 ml-1">Código de 6 dígitos</label>
              <input
                id="interno-codigo" className={`${campo} text-center text-2xl tracking-widest`} type="text" inputMode="numeric"
                autoComplete="one-time-code" maxLength={6} required autoFocus placeholder="000000" value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button type="submit" disabled={enviando || codigo.length !== 6} className="w-full py-4 bg-azul hover:bg-azul-hondo text-white rounded-lg text-xs font-bold shadow-lg transition-colors disabled:opacity-50">
              {enviando ? 'Verificando…' : 'Entrar'}
            </button>
            <button type="button" onClick={() => { setPaso('clave'); setError(''); setCodigo(''); }} className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 font-bold">
              Volver
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default InternoLoginPage;
