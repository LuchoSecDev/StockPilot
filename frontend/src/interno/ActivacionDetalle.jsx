import { Check, X } from 'lucide-react';
import { Chip } from './componentes';
import { etiquetaActivacion, fraccion, formatearDia } from './formato';

const Requisito = ({ cumple, titulo, valor, nota }) => (
  <li className="flex items-start gap-3">
    <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${cumple ? 'bg-exito-suave text-exito' : 'bg-slate-100 text-slate-400'}`}>
      {cumple ? <Check size={14} aria-label="Cumple" /> : <X size={14} aria-label="Aún no cumple" />}
    </span>
    <div>
      <p className="text-sm font-bold text-tinta">{titulo}: <span className="text-azul">{valor}</span></p>
      {nota && <p className="text-xs font-bold text-slate-500">{nota}</p>}
    </div>
  </li>
);

/** La activación de una tienda como lista de verificación: qué le falta y por qué. */
const ActivacionDetalle = ({ activacion, metas }) => {
  if (!activacion) return <p className="text-sm font-bold text-slate-500">Las tiendas de prueba no se miden.</p>;
  const { texto, tono } = etiquetaActivacion(activacion.estado);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Chip tono={tono}>{texto}</Chip>
        <p className="text-xs font-bold text-slate-500">
          Desde el registro ({formatearDia(activacion.dia_registro)}) · ventana de 7 días {activacion.ventana_cerrada ? 'cerrada' : 'abierta'}
        </p>
      </div>
      <ul className="space-y-3">
        <Requisito
          cumple={activacion.productos_cargados >= metas.umbral_productos}
          titulo="Productos cargados" valor={fraccion(activacion.productos_cargados, metas.umbral_productos)}
          nota={`${activacion.productos_primeros_7d} de ellos cargados en los primeros 7 días`}
        />
        <Requisito
          cumple={activacion.dias_con_ventas_7d >= metas.umbral_dias_con_ventas}
          titulo="Días con ventas en los primeros 7" valor={fraccion(activacion.dias_con_ventas_7d, metas.umbral_dias_con_ventas)}
          nota="Cuenta días distintos (hora de Bogotá), no cantidad de ventas"
        />
      </ul>
    </div>
  );
};

export default ActivacionDetalle;
