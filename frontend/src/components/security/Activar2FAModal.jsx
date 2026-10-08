import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

/**
 * Activación de la verificación en dos pasos (QR + código de 6 dígitos).
 * Se abre desde el aviso del encabezado (voluntario) o cuando el servidor rechaza una escritura
 * por falta de 2FA (`mensajeBloqueo` trae lo que respondió el servidor).
 */
const Activar2FAModal = ({ abierto, mensajeBloqueo = '', onCerrar }) => {
  const toast = useToast();
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [totpToken, setTotpToken] = useState('');

  // El secreto se genera al abrir el aviso, no al cargar cada pantalla: así no se escribe en la base
  // de datos sin que la persona lo haya pedido.
  useEffect(() => {
    if (!abierto || qrCodeUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.post('/api/2fa/generate');
        if (data.success && !cancelled) setQrCodeUrl(data.qrCode);
      } catch {
        if (!cancelled) toast.error('Error generando configuración 2FA');
      }
    })();
    return () => { cancelled = true; };
  }, [abierto, qrCodeUrl, toast]);

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/2fa/verify', { token: totpToken });
      toast.success('2FA Habilitado con éxito');
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código incorrecto');
    }
  };

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 bg-tinta/95 backdrop-blur-sm z-[9999] flex items-center justify-center p-6">
      <form onSubmit={handleVerify} className="bg-white w-full max-w-md p-10 rounded-2xl shadow-lg animate-scale-in text-center">
        <div className="w-16 h-16 bg-azul/10 text-azul rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield size={32} />
        </div>
        <h2 className="titular text-2xl text-tinta mb-2">
          {mensajeBloqueo ? 'Activa la verificación en dos pasos' : 'Protege tu cuenta'}
        </h2>
        <p className="text-xs text-slate-500 font-bold mb-6 leading-relaxed">
          {mensajeBloqueo
            || 'La verificación en dos pasos es opcional por ahora: evita que alguien entre a tu cuenta solo con tu contraseña.'}
          <br />
          1. Descarga Google Authenticator.<br />
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
          onClick={onCerrar}
          className="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-700 font-bold transition-colors"
        >
          Configurar más tarde
        </button>
      </form>
    </div>
  );
};

export default Activar2FAModal;
