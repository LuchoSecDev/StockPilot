import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Store } from 'lucide-react';
import ErrorState from '../components/common/ErrorState';
import { api } from './api';
import { useCarga } from './useCarga';
import { Chip, Encabezado, Cargando, Seccion } from './componentes';
import ActivacionDetalle from './ActivacionDetalle';
import AdopcionSemanas from './AdopcionSemanas';
import MarcaDePrueba from './MarcaDePrueba';
import TablaBitacora from './TablaBitacora';
import { formatearFecha, haceCuanto } from './formato';

const Dato = ({ titulo, valor }) => (
  <div>
    <p className="text-xs font-bold text-slate-500">{titulo}</p>
    <p className="text-lg font-bold text-tinta">{valor}</p>
  </div>
);

const TiendaDetallePage = () => {
  const { id } = useParams();
  const { datos, error, cargando, recargar } = useCarga(() => api.tienda(id), [id]);

  if (cargando && !datos) return <Cargando />;
  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/interno/tiendas" className="inline-flex items-center gap-1 text-xs font-bold text-azul hover:underline"><ArrowLeft size={14} aria-hidden="true" /> Volver a las tiendas</Link>
        <ErrorState title="No pudimos cargar la tienda" message={error} onRetry={recargar} />
      </div>
    );
  }

  const { tienda, semanas, historial, metas } = datos;
  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/interno/tiendas" className="inline-flex items-center gap-1 text-xs font-bold text-azul hover:underline"><ArrowLeft size={14} aria-hidden="true" /> Volver a las tiendas</Link>

      <Encabezado
        icono={<Store size={20} aria-hidden="true" />}
        titulo={tienda.nombre}
        subtitulo={`${tienda.ciudad || 'Sin ciudad'} · registrada el ${formatearFecha(tienda.fecha_creacion)} · abre ${tienda.dias_apertura_semana} días a la semana`}
        acciones={
          <div className="flex gap-2">
            {tienda.es_prueba && <Chip tono="azul">Tienda de prueba</Chip>}
            {tienda.estado !== 'Activo' && <Chip tono="neutro">{tienda.estado}</Chip>}
          </div>
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Seccion titulo="Activación" descripcion={`${metas.umbral_productos} productos cargados y ventas en ${metas.umbral_dias_con_ventas} de los primeros 7 días`}>
          <ActivacionDetalle activacion={tienda.activacion} metas={metas} />
        </Seccion>
        <Seccion titulo="Adopción semanal" descripcion="Días con ventas ÷ días que la tienda abre a la semana">
          {tienda.es_prueba
            ? <p className="text-sm font-bold text-slate-500">Las tiendas de prueba no se miden.</p>
            : <AdopcionSemanas semanas={semanas} meta={metas.adopcion} />}
        </Seccion>
      </div>

      <Seccion titulo="Actividad" descripcion="Conteos y fechas. Sin montos ni detalle de lo vendido.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <Dato titulo="Ventas, últimos 7 días" valor={tienda.ventas_7d} />
          <Dato titulo="Ventas, últimos 30 días" valor={tienda.ventas_30d} />
          <Dato titulo="Días con ventas (30 días)" valor={tienda.dias_con_ventas_30d} />
          <Dato titulo="Última venta" valor={haceCuanto(tienda.ultima_venta)} />
          <Dato titulo="Último acceso" valor={haceCuanto(tienda.ultimo_acceso)} />
          <Dato titulo="Productos cargados" valor={tienda.productos} />
          <Dato titulo="Usuarios" valor={tienda.usuarios} />
          <Dato titulo="Aceptó la política de datos" valor={tienda.dueno_acepto_politica ? 'Sí' : 'No'} />
        </div>
      </Seccion>

      <Seccion titulo="Tienda de prueba">
        <MarcaDePrueba tienda={tienda} alCambiar={recargar} />
      </Seccion>

      <Seccion titulo="Historial de esta tienda" descripcion="Lo que el equipo ha consultado o cambiado sobre ella.">
        <TablaBitacora registros={historial} mostrarTienda={false} />
      </Seccion>
    </div>
  );
};

export default TiendaDetallePage;
