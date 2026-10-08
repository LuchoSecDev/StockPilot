import { Funnel } from 'lucide-react';
import ErrorState from '../components/common/ErrorState';
import { api } from './api';
import { useCarga } from './useCarga';
import { Encabezado, Cargando, Seccion } from './componentes';
import { formatearPorcentaje, fraccion } from './formato';

/** Una etapa del embudo: barra proporcional al total de registros, con el conteo y (si hay base) el porcentaje. */
const Etapa = ({ titulo, descripcion, parte, total, tasa, meta }) => {
  const ancho = total > 0 ? Math.round((parte / total) * 100) : 0;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <p className="text-sm font-bold text-tinta">{titulo}</p>
        <p className="text-sm font-bold text-azul">
          {fraccion(parte, total)} <span className="text-slate-500">· {formatearPorcentaje(tasa)}</span>
        </p>
      </div>
      <div className="relative h-4 rounded-full bg-slate-100 overflow-hidden" role="img" aria-label={`${titulo}: ${fraccion(parte, total)}`}>
        <div className="h-full rounded-full bg-azul" style={{ width: `${ancho}%` }} />
        {meta !== undefined && <div className="absolute top-0 bottom-0 w-0.5 bg-tinta/60" style={{ left: `${Math.round(meta * 100)}%` }} />}
      </div>
      <p className="text-xs font-bold text-slate-500 mt-1">{descripcion}{meta !== undefined ? ` · La línea oscura marca la meta (${formatearPorcentaje(meta)}).` : ''}</p>
    </div>
  );
};

const EmbudoPage = () => {
  const { datos, error, cargando, recargar } = useCarga(() => api.embudo(), []);

  return (
    <div className="space-y-6 animate-fade-in">
      <Encabezado icono={<Funnel size={20} aria-hidden="true" />} titulo="Embudo del piloto" subtitulo="De los registros a las tiendas que siguen usando la app." />
      {cargando && !datos && <Cargando />}
      {error && <ErrorState title="No pudimos cargar el embudo" message={error} onRetry={recargar} />}

      {datos && (() => {
        const { embudo: e, metas } = datos;
        return (
          <>
            {e.registros > 0 && e.registros < 10 && (
              <p role="note" className="p-4 rounded-lg bg-aviso-suave text-aviso text-xs font-bold">
                Con {e.registros === 1 ? 'una sola tienda' : `solo ${e.registros} tiendas`} los porcentajes no son concluyentes: léelos como conteos («n de N»).
              </p>
            )}
            <Seccion titulo="Embudo" descripcion="Sin las tiendas marcadas como de prueba.">
              <div className="space-y-6">
                <Etapa titulo="Registros" descripcion="Tiendas del piloto registradas" parte={e.registros} total={e.registros} tasa={e.registros > 0 ? 1 : null} />
                <Etapa
                  titulo="Activadas"
                  descripcion={`${e.en_curso} con la ventana de 7 días abierta · ${e.no_activadas} no lograron activarse`}
                  parte={e.activadas} total={e.registros} tasa={e.tasa_activacion} meta={metas.activacion}
                />
                <Etapa
                  titulo={`Con uso en la semana ${e.semana_4.semana}`}
                  descripcion="Al menos un día con ventas, entre las tiendas que ya llegaron a esa semana"
                  parte={e.semana_4.con_uso} total={e.semana_4.alcanzaron} tasa={e.semana_4.tasa}
                />
              </div>
            </Seccion>
            <Seccion titulo="Adopción" descripcion="Tiendas cuya última semana COMPLETA llegó a la meta de días con ventas.">
              <Etapa
                titulo="Adopción en la meta" descripcion="Días con ventas ÷ días de apertura, por tienda"
                parte={e.adopcion.en_meta} total={e.adopcion.evaluadas} tasa={e.adopcion.tasa_en_meta} meta={metas.adopcion}
              />
            </Seccion>
            <Seccion titulo="Cómo se calcula">
              <ul className="text-xs font-bold text-slate-600 space-y-1.5 list-disc pl-5">
                <li><b>Activada:</b> al menos {metas.umbral_productos} productos cargados y ventas en al menos {metas.umbral_dias_con_ventas} de los primeros 7 días (día del registro incluido, hora de Bogotá).</li>
                <li><b>Adopción de una semana:</b> días con ventas ÷ días que la tienda abre a la semana, con tope de 100 %.</li>
                <li><b>Con uso en la semana {e.semana_4.semana}:</b> al menos un día con ventas entre los días 22 y 28 desde el registro. <i>Definición propuesta, pendiente de confirmar.</i></li>
              </ul>
            </Seccion>
          </>
        );
      })()}
    </div>
  );
};

export default EmbudoPage;
