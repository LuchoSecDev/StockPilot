import { ShoppingCart, Truck } from 'lucide-react';
import { formatoPesos } from '../../utils/arqueo';

const chipUrgencia = (u) =>
  u === 'Pide hoy' ? 'bg-peligro-suave text-peligro border-peligro/30'
    : u === 'En esta compra' ? 'bg-aviso-suave text-aviso border-aviso/30'
      : 'bg-slate-100 text-slate-600 border-slate-200';

// Lo que sugiere el motor pedirle a UN proveedor. Armar el pedido solo crea un borrador: no se envía nada.
const GrupoPorPedir = ({ grupo, ocupado, onArmar }) => {
  const enCurso = ocupado === `armar-${grupo.id_proveedor}`;
  return (
    <article className="bg-white border border-slate-100 rounded-2xl shadow-lg p-5 flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 titular text-xl text-tinta"><Truck size={18} className="text-azul" /> {grupo.proveedor}</h3>
        <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${chipUrgencia(grupo.urgencia)}`}>{grupo.urgencia}</span>
      </header>

      <ul className="divide-y divide-slate-100">
        {grupo.items.map((i) => (
          <li key={i.id_producto} className="py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-tinta truncate">{i.nombre}</p>
              <p className="text-xs text-slate-500">
                {i.stock <= 0 ? 'Agotado' : `Quedan ${i.stock}`} · <span className={i.urgencia === 'Pide hoy' ? 'text-peligro font-bold' : ''}>{i.urgencia}</span>
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-azul">Pedir {i.cantidad}</p>
          </li>
        ))}
      </ul>

      <footer className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-600">
          Total estimado: <span className="text-tinta">{formatoPesos(Math.round(grupo.total))}</span>
          {grupo.hayCostosEstimados && <span className="font-medium text-slate-500"> · algunos costos son aproximados</span>}
        </p>
        <button
          type="button"
          disabled={ocupado !== null}
          onClick={() => onArmar(grupo)}
          className="flex items-center gap-2 text-xs font-bold text-white bg-azul hover:bg-azul-hondo disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
        >
          <ShoppingCart size={14} /> {enCurso ? 'Armando…' : 'Armar pedido'}
        </button>
      </footer>
    </article>
  );
};

export default GrupoPorPedir;
