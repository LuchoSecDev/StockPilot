import { Link } from 'react-router-dom';
import { Chip } from './componentes';
import { formatearFechaHora, etiquetaAccion, esAccionDeAlerta } from './formato';

/** Resumen corto del detalle de un registro (sin mostrar JSON crudo). */
function describirDetalle(registro) {
  const d = registro.detalle;
  if (!d) return '';
  if (registro.accion === 'marcar_prueba') return d.a ? 'Marcada como de prueba' : 'Desmarcada como de prueba';
  if (registro.accion === 'login_fallido' && d.usuario) return `Usuario escrito: ${d.usuario}`;
  if (registro.accion === 'ver_tiendas') return d.incluirPrueba ? 'Incluyendo las de prueba' : '';
  return '';
}

/** Tabla de la bitácora del panel. `mostrarTienda` agrega la columna de la tienda sobre la que se actuó. */
const TablaBitacora = ({ registros, mostrarTienda = true }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left">
      <thead className="text-xs font-bold text-slate-500 bg-slate-50/50">
        <tr>
          <th className="p-3">Cuándo</th>
          <th className="p-3">Quién</th>
          <th className="p-3">Qué hizo</th>
          {mostrarTienda && <th className="p-3 hidden md:table-cell">Tienda</th>}
          <th className="p-3 hidden lg:table-cell">Desde</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {registros.length === 0 && (
          <tr><td colSpan={mostrarTienda ? 5 : 4} className="p-8 text-center text-sm font-bold text-slate-500">Sin registros.</td></tr>
        )}
        {registros.map((r) => (
          <tr key={r.id} className={esAccionDeAlerta(r.accion) ? 'bg-peligro-suave/40' : ''}>
            <td className="p-3 text-sm font-bold text-slate-600 whitespace-nowrap">{formatearFechaHora(r.fecha)}</td>
            <td className="p-3 text-sm font-bold text-tinta">{r.equipo || <span className="text-slate-400">Desconocido</span>}</td>
            <td className="p-3 text-sm font-bold text-slate-700">
              {esAccionDeAlerta(r.accion) ? <Chip tono="peligro">{etiquetaAccion(r.accion)}</Chip> : etiquetaAccion(r.accion)}
              {describirDetalle(r) && <p className="text-xs font-bold text-slate-500">{describirDetalle(r)}</p>}
            </td>
            {mostrarTienda && (
              <td className="p-3 text-sm font-bold hidden md:table-cell">
                {r.id_tienda ? <Link to={`/interno/tiendas/${r.id_tienda}`} className="text-azul hover:underline">#{r.id_tienda}</Link> : <span className="text-slate-400">—</span>}
              </td>
            )}
            <td className="p-3 text-xs font-bold text-slate-500 hidden lg:table-cell">{r.ip || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default TablaBitacora;
