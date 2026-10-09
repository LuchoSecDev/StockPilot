import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import ErrorState from '../components/common/ErrorState';
import { api } from './api';
import { useCarga } from './useCarga';
import { Encabezado, Cargando, Seccion } from './componentes';
import TablaBitacora from './TablaBitacora';

const POR_PAGINA = 50;

const BitacoraPage = () => {
  const [pagina, setPagina] = useState(0);
  const { datos, error, cargando, recargar } = useCarga(() => api.bitacora({ limite: POR_PAGINA, desde: pagina * POR_PAGINA }), [pagina]);

  const total = datos?.total ?? 0;
  const ultimaPagina = Math.max(0, Math.ceil(total / POR_PAGINA) - 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <Encabezado
        icono={<ScrollText size={20} aria-hidden="true" />}
        titulo="Bitácora"
        subtitulo="Quién del equipo hizo qué y cuándo. Cada consulta de métricas queda registrada."
      />
      {cargando && !datos && <Cargando />}
      {error && <ErrorState title="No pudimos cargar la bitácora" message={error} onRetry={recargar} />}

      {datos && (
        <Seccion titulo={`${total} registro${total === 1 ? '' : 's'}`} descripcion="Lo más reciente primero. Los intentos fallidos de entrada aparecen resaltados.">
          <TablaBitacora registros={datos.registros} />
          {total > POR_PAGINA && (
            <div className="flex items-center justify-between mt-4">
              <button type="button" disabled={pagina === 0 || cargando} onClick={() => setPagina(pagina - 1)} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold disabled:opacity-40">Anteriores</button>
              <span className="text-xs font-bold text-slate-500">Página {pagina + 1} de {ultimaPagina + 1}</span>
              <button type="button" disabled={pagina >= ultimaPagina || cargando} onClick={() => setPagina(pagina + 1)} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold disabled:opacity-40">Siguientes</button>
            </div>
          )}
        </Seccion>
      )}
    </div>
  );
};

export default BitacoraPage;
