import { useState } from 'react';
import { PackagePlus, X } from 'lucide-react';

// Ventana mínima para que el Tendero registre una entrada de mercancía al escanear un producto que
// ya existe (matriz de roles P22-10, D1). No permite tocar precio, costo ni ningún otro dato del
// producto: solo suma stock por POST /api/inventario/entrada, que sí es del Tendero.
const SumarStockModal = ({ isOpen, onClose, producto, onSubmit, loading }) => {
  const [cantidad, setCantidad] = useState('');
  const [observacion, setObservacion] = useState('');
  const [error, setError] = useState(null);

  if (!isOpen || !producto) return null;

  const cantidadNum = parseInt(cantidad, 10);
  const stockActual = Number(producto.cantidad) || 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      setError('Ingresa una cantidad entera mayor que 0.');
      return;
    }
    setError(null);
    onSubmit({ id_producto: producto.id_producto, cantidad: cantidadNum, observacion: observacion.trim() });
  };

  return (
    <div className="fixed inset-0 bg-tinta/45 backdrop-blur-sm z-[120] flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden relative animate-scale-in border border-slate-100">
        <div className="px-6 py-5 flex justify-between items-center border-b border-slate-50">
          <div>
            <h3 className="titular text-lg text-tinta flex items-center gap-2">
              <PackagePlus className="text-exito w-5 h-5" /> Sumar stock
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-1">Entrada de mercancía</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div role="alert" className="bg-rose-50 border border-rose-200 text-peligro p-3 rounded-2xl text-xs font-bold">
              {error}
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-xs font-bold text-slate-500 mb-1">Producto</p>
            <p className="font-bold text-tinta">{producto.nombre_producto}</p>
            <p className="text-xs font-bold text-slate-500 mt-3">Stock actual</p>
            <p className="font-bold text-tinta tabular-nums">{stockActual.toLocaleString('es-CO')} ud</p>
          </div>

          <div>
            <label htmlFor="sumar-stock-cantidad" className="block text-xs font-semibold text-slate-600 mb-2">Unidades que llegaron</label>
            <input
              id="sumar-stock-cantidad"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              autoFocus
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-lg focus:ring-4 focus:ring-azul/10 focus:border-azul outline-none transition-all font-bold text-tinta-2"
              placeholder="Ej: 12"
            />
            {Number.isInteger(cantidadNum) && cantidadNum > 0 && (
              <p className="text-xs font-bold text-exito mt-2 tabular-nums">
                Quedará en {(stockActual + cantidadNum).toLocaleString('es-CO')} ud
              </p>
            )}
          </div>

          <div>
            <label htmlFor="sumar-stock-nota" className="block text-xs font-semibold text-slate-600 mb-2">Nota (opcional)</label>
            <input
              id="sumar-stock-nota"
              type="text"
              maxLength={200}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-lg focus:ring-4 focus:ring-azul/10 focus:border-azul outline-none transition-all font-medium text-sm text-tinta-2"
              placeholder="Ej: pedido del lunes"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-azul text-white font-bold py-4 rounded-lg hover:bg-azul-hondo active:scale-95 transition-all shadow-lg shadow-slate-900/10 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Sumar al inventario'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SumarStockModal;
