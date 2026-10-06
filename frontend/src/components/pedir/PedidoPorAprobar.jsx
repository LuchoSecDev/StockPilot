import { useState } from 'react';
import { Check, X } from 'lucide-react';
import ConfirmDialog from '../common/ConfirmDialog';
import { formatoPesos } from '../../utils/arqueo';

// Un pedido en borrador que espera la decisión del dueño. Aprobar NO lo envía al proveedor: lo deja listo para que
// el dueño lo haga (llamada, WhatsApp…) y, cuando llegue la mercancía, la registre en «Por recibir».
const PedidoPorAprobar = ({ orden, lineas, ocupado, onCargarDetalle, onAprobar, onDescartar }) => {
  const [abierto, setAbierto] = useState(false);
  const [confirmar, setConfirmar] = useState(null); // 'aprobar' | 'descartar'
  const enCurso = ocupado === `estado-${orden.id_orden}`;

  const alternar = () => {
    if (!abierto && !lineas) onCargarDetalle(orden.id_orden);
    setAbierto(!abierto);
  };

  return (
    <article className="bg-white border border-slate-100 rounded-2xl shadow-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="titular text-lg text-tinta">Pedido #{orden.id_orden} · {orden.proveedor_nombre}</h3>
          <p className="text-xs text-slate-500 font-bold">{orden.items_count} producto(s) · {formatoPesos(Math.round(orden.presupuesto_total))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={alternar} className="text-xs font-bold text-azul bg-azul/10 hover:bg-azul hover:text-white px-3 py-2 rounded-lg transition-colors">
            {abierto ? 'Ocultar productos' : 'Ver productos'}
          </button>
          <button type="button" disabled={ocupado !== null} onClick={() => setConfirmar('descartar')} className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors">
            <X size={14} /> Descartar
          </button>
          <button type="button" disabled={ocupado !== null} onClick={() => setConfirmar('aprobar')} className="flex items-center gap-1 text-xs font-bold text-white bg-exito hover:opacity-90 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors">
            <Check size={14} /> Aprobar pedido
          </button>
        </div>
      </div>

      {abierto && (
        <ul className="mt-4 divide-y divide-slate-100">
          {!lineas && <li className="py-2 text-xs text-slate-500">Cargando…</li>}
          {(lineas || []).map((l) => (
            <li key={l.id_producto} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-tinta truncate">{l.nombre_producto}</span>
              <span className="shrink-0 font-bold text-azul">{l.cantidad_final} u.</span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={confirmar === 'aprobar'}
        title="Aprobar el pedido"
        message={<>Aprobar deja el pedido #{orden.id_orden} listo. <b>No se envía nada al proveedor</b>: tú se lo pides y, cuando llegue la mercancía, la registras en «Por recibir».</>}
        highlightColor="azul"
        confirmText="Sí, aprobar"
        cancelText="Todavía no"
        onConfirm={async () => { await onAprobar(orden.id_orden); setConfirmar(null); }}
        onCancel={() => setConfirmar(null)}
        loading={enCurso}
        icon="check"
      />
      <ConfirmDialog
        isOpen={confirmar === 'descartar'}
        title="Descartar el pedido"
        message={<>Se descarta el pedido #{orden.id_orden}. Los productos vuelven a aparecer en «Por pedir» si siguen haciendo falta.</>}
        highlightColor="rose"
        confirmText="Sí, descartar"
        cancelText="Volver"
        onConfirm={async () => { await onDescartar(orden.id_orden); setConfirmar(null); }}
        onCancel={() => setConfirmar(null)}
        loading={enCurso}
      />
    </article>
  );
};

export default PedidoPorAprobar;
