import { Chip } from './componentes';
import { etiquetaAdopcion, fraccion, formatearDia, formatearPorcentaje } from './formato';

const COLOR_BARRA = { meta: 'bg-exito', regular: 'bg-ambar', baja: 'bg-peligro' };
// La barra de una semana en curso va en azul: todavía no se califica.

/** Una barra por semana de vida; la línea vertical marca la meta (80 %). */
const AdopcionSemanas = ({ semanas, meta }) => {
  if (!semanas.length) return <p className="text-sm font-bold text-slate-500">Todavía no hay semanas que medir.</p>;
  return (
    <ul className="space-y-4">
      {semanas.map((s) => {
        const { texto, tono } = etiquetaAdopcion(s.nivel, s.completa);
        return (
          <li key={s.semana}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <p className="text-sm font-bold text-tinta">
                Semana {s.semana} <span className="text-xs text-slate-500">({formatearDia(s.desde)} al {formatearDia(s.hasta)}{s.completa ? '' : ', en curso'})</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">{fraccion(s.dias_con_ventas, s.dias_apertura_semana)} días · {formatearPorcentaje(s.razon)}</span>
                <Chip tono={tono}>{texto}</Chip>
              </div>
            </div>
            <div
              className="relative h-3 rounded-full bg-slate-100 overflow-hidden" role="img"
              aria-label={`Semana ${s.semana}: ${formatearPorcentaje(s.razon)} de los días de apertura con ventas; la meta es ${formatearPorcentaje(meta)}`}
            >
              <div className={`h-full rounded-full ${s.completa ? (COLOR_BARRA[s.nivel] || 'bg-slate-300') : 'bg-azul/50'}`} style={{ width: `${Math.round(s.razon * 100)}%` }} />
              <div className="absolute top-0 bottom-0 w-0.5 bg-tinta/60" style={{ left: `${Math.round(meta * 100)}%` }} />
            </div>
          </li>
        );
      })}
      <li className="text-xs font-bold text-slate-500">La línea oscura marca la meta ({formatearPorcentaje(meta)}). Una semana en curso aún puede subir.</li>
    </ul>
  );
};

export default AdopcionSemanas;
