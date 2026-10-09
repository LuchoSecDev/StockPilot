/** Piezas visuales compartidas por las pantallas del panel interno. */

const TONOS = {
  exito: 'bg-exito-suave text-exito border-exito/20',
  aviso: 'bg-aviso-suave text-aviso border-aviso/20',
  peligro: 'bg-peligro-suave text-peligro border-peligro/20',
  neutro: 'bg-slate-100 text-slate-600 border-slate-200',
  azul: 'bg-azul/10 text-azul border-azul/20'
};

/** Etiqueta de estado. Lleva siempre TEXTO (el color solo no basta para quien no distingue colores). */
export const Chip = ({ tono = 'neutro', children }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-bold whitespace-nowrap ${TONOS[tono] || TONOS.neutro}`}>
    {children}
  </span>
);

/** Tarjeta de indicador: un número grande, su título y una línea de contexto (meta, base de cálculo). */
export const TarjetaKpi = ({ titulo, valor, detalle, tono = 'neutro' }) => (
  <div className={`rounded-lg border-2 p-4 bg-white ${tono === 'neutro' ? 'border-slate-100' : TONOS[tono]}`}>
    <p className="text-xs font-bold text-slate-500">{titulo}</p>
    <p className="text-3xl font-bold text-tinta mt-1">{valor}</p>
    {detalle && <p className="text-xs font-bold text-slate-500 mt-1">{detalle}</p>}
  </div>
);

/** Encabezado de pantalla, con el mismo aspecto que las del resto de la app. */
export const Encabezado = ({ icono, titulo, subtitulo, acciones }) => (
  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
    <div>
      <div className="flex items-center gap-3 mb-1">
        {icono && <div className="w-10 h-10 bg-azul/10 text-azul rounded-lg flex items-center justify-center">{icono}</div>}
        <h1 className="titular text-2xl sm:text-3xl text-tinta">{titulo}</h1>
      </div>
      {subtitulo && <p className="text-sm font-bold text-slate-600">{subtitulo}</p>}
    </div>
    {acciones}
  </div>
);

export const Cargando = ({ texto = 'Cargando…' }) => (
  <div role="status" className="py-16 text-center text-sm font-bold text-slate-500 animate-pulse">{texto}</div>
);

/** Recuadro blanco con título, para agrupar un bloque de información. */
export const Seccion = ({ titulo, descripcion, children }) => (
  <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
    <h2 className="titular text-lg text-tinta">{titulo}</h2>
    {descripcion && <p className="text-xs font-bold text-slate-500 mt-1">{descripcion}</p>}
    <div className="mt-4">{children}</div>
  </section>
);
