import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Store, Check, X } from 'lucide-react';
import ErrorState from '../components/common/ErrorState';
import { api } from './api';
import { useCarga } from './useCarga';
import { Chip, TarjetaKpi, Encabezado, Cargando } from './componentes';
import {
  formatearPorcentaje, fraccion, formatearFecha, haceCuanto, etiquetaActivacion, etiquetaAdopcion, resumirTiendas
} from './formato';

const CeldaAdopcion = ({ adopcion }) => {
  if (!adopcion) return <span className="text-slate-400">—</span>;
  const { texto, tono } = etiquetaAdopcion(adopcion.nivel, adopcion.completa);
  return (
    <div className="space-y-1">
      <Chip tono={tono}>{texto}</Chip>
      <p className="text-xs font-bold text-slate-500">
        {fraccion(adopcion.dias_con_ventas, adopcion.dias_apertura_semana)} días · {formatearPorcentaje(adopcion.razon)} · sem. {adopcion.semana}{adopcion.completa ? '' : ' (en curso)'}
      </p>
    </div>
  );
};

const CeldaActivacion = ({ activacion }) => {
  if (!activacion) return <span className="text-slate-400">—</span>;
  const { texto, tono } = etiquetaActivacion(activacion.estado);
  return (
    <div className="space-y-1">
      <Chip tono={tono}>{texto}</Chip>
      <p className="text-xs font-bold text-slate-500">{activacion.productos_cargados} productos · {fraccion(activacion.dias_con_ventas_7d, 7)} días</p>
    </div>
  );
};

const TiendasPage = () => {
  const [verPrueba, setVerPrueba] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const { datos, error, cargando, recargar } = useCarga(() => api.tiendas(verPrueba), [verPrueba]);

  const tiendas = useMemo(() => datos?.tiendas ?? [], [datos]);
  const metas = datos?.metas;
  const resumen = useMemo(() => resumirTiendas(tiendas), [tiendas]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? tiendas.filter(t => `${t.nombre} ${t.ciudad || ''}`.toLowerCase().includes(q)) : tiendas;
  }, [tiendas, busqueda]);

  const tasaActivacion = resumen.total ? resumen.activadas / resumen.total : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <Encabezado
        icono={<Store size={20} aria-hidden="true" />}
        titulo="Tiendas del piloto"
        subtitulo="Solo conteos, fechas y estados. Nunca montos, productos ni datos de clientes."
      />

      {cargando && !datos && <Cargando />}
      {error && <ErrorState title="No pudimos cargar las tiendas" message={error} onRetry={recargar} />}

      {datos && metas && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <TarjetaKpi titulo="Tiendas del piloto" valor={resumen.total} detalle={`${resumen.en_curso} con la ventana de activación abierta`} />
            <TarjetaKpi
              titulo="Activadas" valor={fraccion(resumen.activadas, resumen.total)}
              detalle={`Meta: ${formatearPorcentaje(metas.activacion)} de los registros (${metas.umbral_productos} productos y ventas en ${metas.umbral_dias_con_ventas} de 7 días)`}
              tono={tasaActivacion !== null && tasaActivacion >= metas.activacion ? 'exito' : 'neutro'}
            />
            <TarjetaKpi
              titulo="Adopción en la meta" valor={fraccion(resumen.adopcion_en_meta, resumen.adopcion_evaluadas)}
              detalle={`Meta: ${formatearPorcentaje(metas.adopcion)} de los días de apertura con ventas (semanas completas)`}
              tono={resumen.adopcion_evaluadas > 0 && resumen.adopcion_en_meta === resumen.adopcion_evaluadas ? 'exito' : 'neutro'}
            />
            <TarjetaKpi
              titulo="Sin ventas en 7 días" valor={resumen.sin_ventas_7d}
              detalle={resumen.politica_pendiente ? `${resumen.politica_pendiente} sin aceptar la política de datos` : 'Todas aceptaron la política de datos'}
              tono={resumen.sin_ventas_7d > 0 ? 'aviso' : 'neutro'}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <input
              type="search" aria-label="Buscar tienda" placeholder="Buscar por nombre o ciudad…" value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full sm:w-72 p-3 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:border-azul outline-none"
            />
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
              <input type="checkbox" checked={verPrueba} onChange={(e) => setVerPrueba(e.target.checked)} className="w-4 h-4 accent-azul" />
              Mostrar también las tiendas de prueba del equipo
            </label>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-xs font-bold text-slate-500">
                  <tr>
                    <th className="p-4">Tienda</th>
                    <th className="p-4">Activación</th>
                    <th className="p-4">Adopción</th>
                    <th className="p-4 hidden md:table-cell">Ventas (conteo)</th>
                    <th className="p-4 hidden lg:table-cell">Última venta</th>
                    <th className="p-4 hidden lg:table-cell">Último acceso</th>
                    <th className="p-4 hidden md:table-cell text-center">Política</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-sm font-bold text-slate-500">
                        {tiendas.length === 0
                          ? 'Aún no hay tiendas del piloto registradas. Las del equipo (de prueba) están ocultas.'
                          : 'Ninguna tienda coincide con la búsqueda.'}
                      </td>
                    </tr>
                  )}
                  {visibles.map((t) => (
                    <tr key={t.id_tienda} className="hover:bg-slate-50/60">
                      <td className="p-4 align-top">
                        <Link to={`/interno/tiendas/${t.id_tienda}`} className="font-bold text-azul hover:underline">{t.nombre}</Link>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">{t.ciudad || 'Sin ciudad'} · registrada {formatearFecha(t.fecha_creacion)}</p>
                        <div className="flex gap-1.5 mt-1">
                          {t.es_prueba && <Chip tono="azul">Prueba</Chip>}
                          {t.estado !== 'Activo' && <Chip tono="neutro">{t.estado}</Chip>}
                        </div>
                      </td>
                      <td className="p-4 align-top"><CeldaActivacion activacion={t.activacion} /></td>
                      <td className="p-4 align-top"><CeldaAdopcion adopcion={t.adopcion} /></td>
                      <td className="p-4 align-top hidden md:table-cell text-sm font-bold text-slate-600">
                        7 días: {t.ventas_7d}<br />30 días: {t.ventas_30d}
                      </td>
                      <td className="p-4 align-top hidden lg:table-cell text-sm font-bold text-slate-600">{haceCuanto(t.ultima_venta)}</td>
                      <td className="p-4 align-top hidden lg:table-cell text-sm font-bold text-slate-600">{haceCuanto(t.ultimo_acceso)}</td>
                      <td className="p-4 align-top hidden md:table-cell text-center">
                        {t.dueno_acepto_politica
                          ? <Check size={18} className="inline text-exito" aria-label="Aceptó la política de datos" />
                          : <X size={18} className="inline text-peligro" aria-label="No ha aceptado la política de datos" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TiendasPage;
