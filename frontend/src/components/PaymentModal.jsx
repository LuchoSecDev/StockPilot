import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, CreditCard, Banknote, Landmark, CheckCircle2 } from 'lucide-react';
import CustomSelect from './CustomSelect';

const PaymentModal = ({ isOpen, onClose, total, onConfirm, loading, user }) => {
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [clientes, setClientes] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [loadingClientes, setLoadingClientes] = useState(false);

  
  useEffect(() => {
    if (isOpen) {
      setMetodoPago('Efectivo');
      setEfectivoRecibido('');
      setSelectedClient('');
      if (user?.rol === 'Administrador') {
        fetchClientes();
      }
    }
  }, [isOpen, user]);

  const fetchClientes = async () => {
    try {
      setLoadingClientes(true);

      const res = await axios.get('/api/clientes');
      setClientes(res.data.clientes || []);
    } catch (error) {
      console.error('Error cargando clientes', error);
    } finally {
      setLoadingClientes(false);
    }
  };

  useEffect(() => {
    if (metodoPago !== 'Efectivo') {
      setEfectivoRecibido('');
    }
  }, [metodoPago]);

  if (!isOpen) return null;

  const isFormValid = () => {
    if (metodoPago === 'Efectivo') {
      const recibido = parseFloat(efectivoRecibido) || 0;
      return recibido >= total;
    }
    if (metodoPago === 'Fiado') {
      return selectedClient !== '';
    }
    return true; // Para tarjetas o transferencias no hay validación de efectivo
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isFormValid()) {
      onConfirm({
        metodo_pago: metodoPago,
        efectivo_recibido: metodoPago === 'Efectivo' ? parseFloat(efectivoRecibido) : total,
        id_cliente: metodoPago === 'Fiado' ? selectedClient : null,
      });
    }
  };

  const metodos = [
    { id: 'Efectivo', icon: <Banknote size={24} />, color: 'text-exito', bg: 'bg-exito-suave', border: 'border-emerald-200' },
    { id: 'Tarjeta', icon: <CreditCard size={24} />, color: 'text-azul', bg: 'bg-azul/10', border: 'border-azul/30' },
    { id: 'Transferencia', icon: <Landmark size={24} />, color: 'text-azul', bg: 'bg-azul/10', border: 'border-azul/30' }
  ];

  if (user?.rol === 'Administrador') {
    metodos.push({ id: 'Fiado', icon: <Banknote size={24} />, color: 'text-aviso', bg: 'bg-aviso-suave', border: 'border-amber-200' });
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-tinta/45 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg overflow-hidden border border-slate-100">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
          <h3 className="titular text-2xl text-tinta">Completar Pago</h3>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-rose-50 text-slate-500 hover:text-rose-500 transition-colors shadow-sm">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 max-sm:p-5">
          <div className="text-center mb-8">
            <p className="text-slate-500 font-bold text-xs mb-2">Total a Cobrar</p>
            <p className="text-5xl max-sm:text-4xl font-bold text-azul">
              ${Number(total).toLocaleString('es-CO')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-3 gap-4 max-sm:gap-2">
              {metodos.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetodoPago(m.id)}
                  className={`flex flex-col items-center justify-center p-4 max-sm:p-2 rounded-lg border-2 transition-all ${
                    metodoPago === m.id
                      ? `${m.border} ${m.bg} shadow-md scale-105`
                      : 'border-slate-100 bg-white hover:bg-slate-50 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className={`${m.color} mb-2`}>{m.icon}</div>
                  <span className="font-bold text-xs max-sm:text-[11px] text-tinta-2">{m.id}</span>
                </button>
              ))}
            </div>

            {metodoPago === 'Efectivo' && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Efectivo Recibido</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-exito">$</span>
                    <input
                      type="number"
                      value={efectivoRecibido}
                      onChange={(e) => setEfectivoRecibido(e.target.value)}
                      className="w-full pl-10 pr-4 py-4 text-3xl font-bold text-tinta bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="0"
                      autoFocus
                    />
                  </div>
                </div>

                {parseFloat(efectivoRecibido) > 0 && (
                  <div className={`p-4 rounded-2xl border ${parseFloat(efectivoRecibido) >= total ? 'bg-emerald-50 border-exito-suave' : 'bg-rose-50 border-peligro-suave'}`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-bold text-xs ${parseFloat(efectivoRecibido) >= total ? 'text-exito' : 'text-peligro'}`}>
                        {parseFloat(efectivoRecibido) >= total ? 'Cambio a devolver' : 'Falta dinero'}
                      </span>
                      <span className={`text-2xl font-bold ${parseFloat(efectivoRecibido) >= total ? 'text-emerald-700' : 'text-rose-700'}`}>
                        ${Math.abs(parseFloat(efectivoRecibido) - total).toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {metodoPago === 'Fiado' && (
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Seleccionar Cliente</label>
                  {loadingClientes ? (
                    <div className="text-sm text-slate-500 font-medium animate-pulse">Cargando clientes...</div>
                  ) : (
                    <div className="h-12 border-2 border-slate-200 rounded-lg bg-slate-50 focus-within:border-azul focus-within:bg-white transition-all shadow-sm">
                      <CustomSelect
                        value={selectedClient}
                        onChange={(val) => setSelectedClient(val)}
                        placeholder="-- Selecciona un cliente --"
                        options={clientes.map(c => ({
                          value: String(c.id_cliente),
                          label: `${c.nombre} (Cupo: $${Number(c.limite_credito || 0).toLocaleString('es-CO')})`
                        }))}
                        className="px-4 text-tinta-2 font-bold h-full"
                      />
                    </div>
                  )}
                  {clientes.length === 0 && !loadingClientes && (
                    <p className="mt-2 text-xs font-bold text-peligro">No hay clientes registrados en cartera.</p>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!isFormValid() || loading}
              className="w-full h-16 flex items-center justify-center gap-3 bg-resaltador hover:bg-resaltador-hondo text-tinta ring-1 ring-tinta/25 rounded-lg font-bold text-lg transition-all disabled:bg-slate-200 disabled:text-slate-500 disabled:ring-0 disabled:cursor-not-allowed mt-8"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-tinta"></div>
              ) : (
                <>
                  <CheckCircle2 size={24} />
                  Confirmar y Facturar
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
