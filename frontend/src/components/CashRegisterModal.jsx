import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { X, Lock, Unlock, Landmark, Calculator, RotateCcw } from 'lucide-react';
import ErrorState from './common/ErrorState';
import { formatoPesos, montoContado, describirDiferencia, elArqueoCambio, lineasDelArqueo } from '../utils/arqueo';

// Cómo se pinta cada resultado del arqueo.
const ESTILO_DIFERENCIA = {
  cuadra: 'bg-emerald-50 text-exito',
  sobra: 'bg-amber-50 text-amber-800',
  falta: 'bg-rose-50 text-peligro',
};

const CashRegisterModal = ({ isOpen, onClose, onStatusChange }) => {
  const [session, setSession] = useState(null);
  // El cierre es en dos pasos: 1) el vendedor cuenta y declara, 2) ve el arqueo (cuánto debería haber y la
  // diferencia) y confirma o vuelve a contar. Mientras `arqueoPrevio` es null está en el paso 1.
  const [arqueoPrevio, setArqueoPrevio] = useState(null);
  // Sin esto, una consulta fallida (red, límite de peticiones) se veía igual que "no hay turno
  // abierto" y el modal ofrecía "Abrir Turno" aunque en realidad sí hubiera uno en curso.
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [montoApertura, setMontoApertura] = useState('');
  const [montoCierre, setMontoCierre] = useState('');
  const toast = useToast();

  const fetchSession = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await axios.get('/api/caja/sesion');
      if (res.data.active) {
        setSession(res.data.session);
        if (onStatusChange) onStatusChange(true);
      } else {
        setSession(null);
        if (onStatusChange) onStatusChange(false);
      }
    } catch (error) {
      console.error('Error fetching session:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSession();
      setMontoApertura('');
      setMontoCierre('');
      setArqueoPrevio(null);
    }
    // Solo al abrir el modal: fetchSession se recrea en cada render y onStatusChange viene del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleOpenRegister = async (e) => {
    e.preventDefault();
    if (montoApertura === '' || isNaN(parseFloat(montoApertura)) || parseFloat(montoApertura) < 0) {
      toast.error('Ingresa un monto válido de apertura (puede ser 0 o superior).');
      return;
    }
    try {
      setLoading(true);
      await axios.post('/api/caja/abrir', { monto_apertura: parseFloat(montoApertura) });
      toast.success('¡Caja abierta exitosamente! Listo para realizar ventas.');
      if (onStatusChange) onStatusChange(true);
      setMontoApertura('');
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al abrir caja.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 1 → 2: con lo que contó, pide el arqueo SIN cerrar nada ([K5]) para que el vendedor vea la diferencia.
  const handleVerArqueo = async (e) => {
    e.preventDefault();
    const monto = montoContado(montoCierre);
    if (monto === null) {
      toast.error('Ingresa el monto contado en tu cajón (0 o más).');
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post('/api/caja/arqueo-previo', { monto_cierre_declarado: monto });
      setArqueoPrevio(res.data.arqueo);
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo calcular el arqueo.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 2 → 1: vuelve a contar (lo escrito se conserva para corregirlo).
  const handleRecontar = () => setArqueoPrevio(null);

  // Paso 2: confirma. Se cierra con el MISMO monto que el vendedor vio en el arqueo.
  const handleConfirmarCierre = async () => {
    try {
      setLoading(true);
      const res = await axios.post('/api/caja/cerrar', { monto_cierre_declarado: arqueoPrevio.monto_cierre_declarado });
      const arqueo = res.data.arqueo;
      // Si entre la vista previa y el cierre se registró una venta o un egreso, el arqueo final es otro: se avisa.
      if (elArqueoCambio(arqueoPrevio, arqueo)) {
        toast.warning('Mientras revisabas se registró un movimiento: el arqueo final es distinto al que viste.');
      }
      const dif = describirDiferencia(arqueo.diferencia);
      if (dif.tipo === 'cuadra') {
        toast.success('Caja cerrada cuadradamente.');
      } else if (dif.tipo === 'sobra') {
        toast.success(`Caja cerrada con un sobrante de ${formatoPesos(arqueo.diferencia)}`);
      } else {
        toast.error(`Caja cerrada con un faltante de ${formatoPesos(Math.abs(arqueo.diferencia))}`);
      }
      setSession(null);
      setArqueoPrevio(null);
      if (onStatusChange) onStatusChange(false);
      onClose(); // Cerrar modal después de arqueo exitoso
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al cerrar caja.');
      // Cerrar no se puede repetir a ciegas: si la respuesta nunca llegó, se pregunta cómo quedó la caja.
      if (!error.response) fetchSession();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-tinta/45 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden border border-slate-100 relative">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
          <h3 className="titular text-2xl text-tinta">
            {loadError ? 'Caja' : session ? (arqueoPrevio ? 'Revisar Arqueo' : 'Cerrar Caja (Arqueo)') : 'Abrir Caja'}
          </h3>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-rose-50 text-slate-500 hover:text-rose-500 transition-colors shadow-sm">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-azul"></div>
            </div>
          ) : loadError ? (
            <ErrorState
              title="No pudimos consultar la caja"
              message="No sabemos si ya tienes un turno abierto, así que por seguridad no se ofrece abrir uno nuevo. Vuelve a intentarlo."
              onRetry={fetchSession}
            />
          ) : session && arqueoPrevio ? (
            <div className="space-y-6" data-testid="arqueo-previo">
              <div className="text-center">
                <Calculator size={48} className="mx-auto text-azul mb-3" />
                <p className="text-slate-500 font-bold">Esto es lo que debería haber en el cajón</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm space-y-2">
                {lineasDelArqueo(arqueoPrevio).map((linea) => (
                  <div key={linea.clave} className="flex justify-between text-slate-600">
                    <span>{linea.signo} {linea.etiqueta}</span>
                    <span className="font-bold text-tinta-2">{formatoPesos(linea.monto)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-tinta">
                  <span>Debería haber</span>
                  <span>{formatoPesos(arqueoPrevio.monto_cierre_calculado)}</span>
                </div>
                <div className="flex justify-between font-bold text-tinta">
                  <span>Tú contaste</span>
                  <span>{formatoPesos(arqueoPrevio.monto_cierre_declarado)}</span>
                </div>
              </div>

              {(() => {
                const dif = describirDiferencia(arqueoPrevio.diferencia);
                return (
                  <div className={`rounded-2xl p-4 text-center font-bold ${ESTILO_DIFERENCIA[dif.tipo]}`} role="status">
                    <p className="text-lg">{dif.titulo}</p>
                    <p className="text-sm">{dif.detalle}</p>
                  </div>
                );
              })()}

              <p className="text-xs text-slate-500">
                Solo cuentan las ventas en efectivo: las de tarjeta, transferencia y fiado no entran al cajón. Si se
                registra algo mientras revisas, el arqueo final puede cambiar.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRecontar}
                  disabled={loading}
                  className="flex-1 h-14 flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-tinta rounded-lg font-bold transition-all"
                >
                  <RotateCcw size={18} /> Recontar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarCierre}
                  disabled={loading}
                  className="flex-1 h-14 flex items-center justify-center gap-2 bg-peligro hover:bg-rose-500 text-white rounded-lg font-bold transition-all shadow-lg"
                >
                  <Lock size={18} /> Confirmar cierre
                </button>
              </div>
            </div>
          ) : session ? (
            <form onSubmit={handleVerArqueo} className="space-y-6">
              <div className="text-center mb-6">
                <Lock size={48} className="mx-auto text-rose-500 mb-4" />
                <p className="text-slate-500 font-bold">Sesión Abierta desde:</p>
                <p className="font-bold text-tinta">{new Date(session.fecha_apertura).toLocaleString('es-CO')}</p>
                <p className="text-slate-500 text-sm mt-2">Fondo inicial: <span className="font-bold text-tinta-2">${Number(session.monto_apertura).toLocaleString('es-CO')}</span></p>
                <div className="bg-rose-50 border border-peligro-suave p-3 rounded-2xl mt-3 text-xs text-peligro font-bold">
                   <p>💡 Nota: Los egresos registrados durante el turno se restarán automáticamente del monto esperado.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Efectivo Total en Cajón</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500">$</span>
                  <input
                    type="number"
                    value={montoCierre}
                    onChange={(e) => setMontoCierre(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 text-3xl font-bold text-tinta bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    placeholder="0"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 font-bold">Cuenta el dinero y escribe el total real. Después verás cuánto debería haber y la diferencia.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 flex items-center justify-center gap-3 bg-peligro hover:bg-rose-500 text-white rounded-lg font-bold text-lg transition-all shadow-lg"
              >
                <Calculator size={20} /> Ver Arqueo
              </button>
            </form>
          ) : (
            <form onSubmit={handleOpenRegister} className="space-y-6">
              <div className="text-center mb-6">
                <Unlock size={48} className="mx-auto text-emerald-500 mb-4" />
                <p className="text-slate-500 font-bold">No tienes ninguna caja abierta.</p>
                <p className="text-sm text-slate-500">Debes indicar con cuánto dinero base (sencillo/cambio) inicias tu turno.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Base de Caja Inicial</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500">$</span>
                  <input
                    type="number"
                    value={montoApertura}
                    onChange={(e) => setMontoApertura(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 text-3xl font-bold text-tinta bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="0"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 flex items-center justify-center gap-3 bg-exito hover:bg-emerald-500 text-white rounded-lg font-bold text-lg transition-all shadow-lg"
              >
                <Landmark size={20} /> Abrir Turno
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashRegisterModal;
