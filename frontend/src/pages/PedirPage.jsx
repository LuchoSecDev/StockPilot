import { Link } from 'react-router-dom';
import usePedir from '../hooks/usePedir';
import GrupoPorPedir from '../components/pedir/GrupoPorPedir';
import PedidoPorAprobar from '../components/pedir/PedidoPorAprobar';
import PedidoPorRecibir from '../components/pedir/PedidoPorRecibir';

// «¿Qué pido?» (modo básico, plan 19, 3.4.3 fase C). Tres pasos en una sola pantalla: pedir lo que se acaba, aprobar el
// pedido y registrar la mercancía cuando llega. Lo calcula el motor matemático con tus ventas y tu stock; no usa IA.
const Seccion = ({ titulo, ayuda, children }) => (
  <section className="space-y-4">
    <div>
      <h2 className="titular text-2xl text-tinta">{titulo}</h2>
      {ayuda && <p className="text-xs font-bold text-slate-500 mt-1">{ayuda}</p>}
    </div>
    {children}
  </section>
);

const Vacio = ({ children }) => (
  <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
    <p className="text-slate-500 text-sm font-bold">{children}</p>
  </div>
);

const PedirPage = () => {
  const { cargando, error, sugerencias, porAprobar, porRecibir, detalles, ocupado, recargar, armarPedido, aprobar, descartar, cargarDetalle, recibir } = usePedir();
  const { grupos, sinProveedor, sinCantidad, yaEnBorrador } = sugerencias;

  if (cargando) {
    return <div className="p-10 text-center animate-pulse text-azul font-bold text-xs">Calculando qué conviene pedir…</div>;
  }

  return (
    <div className="animate-fade-in space-y-10 pb-20">
      <header>
        <h1 className="titular text-2xl sm:text-3xl md:text-4xl text-tinta">¿Qué pido?</h1>
        <p className="text-slate-500 font-bold text-xs mt-1 decoration-azul underline underline-offset-8">Lo que se está acabando, calculado con tus ventas y tu stock</p>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-peligro-suave border border-peligro/30">
          <p className="text-sm font-bold text-peligro">{error}</p>
          <button type="button" onClick={() => recargar()} className="text-xs font-bold text-white bg-peligro px-4 py-2 rounded-lg">Reintentar</button>
        </div>
      )}

      <Seccion titulo="Por pedir" ayuda="Armar el pedido solo lo prepara: no se envía nada al proveedor hasta que tú lo hagas.">
        {grupos.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {grupos.map((g) => <GrupoPorPedir key={g.id_proveedor} grupo={g} ocupado={ocupado} onArmar={armarPedido} />)}
          </div>
        ) : (
          <Vacio>{yaEnBorrador > 0 ? 'Todo lo que hace falta ya está en un pedido por aprobar.' : 'Nada por pedir hoy. Tu inventario está cubierto.'}</Vacio>
        )}

        {sinProveedor.length > 0 && (
          <div className="p-4 rounded-2xl bg-aviso-suave border border-aviso/30 text-sm text-tinta">
            <p className="font-bold">{sinProveedor.length} producto(s) hacen falta pero no tienen proveedor:</p>
            <p className="text-xs mt-1">{sinProveedor.map((p) => `${p.nombre} (pedir ${p.cantidad})`).join(' · ')}</p>
            <p className="text-xs mt-2">Asígnales uno en el <Link to="/productos" className="font-bold underline">Catálogo</Link> para poder pedirlos.</p>
          </div>
        )}

        {sinCantidad.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-tinta">
            <p className="font-bold">{sinCantidad.length} producto(s) están agotados, pero todavía no se puede calcular cuánto pedir:</p>
            <p className="text-xs mt-1">{sinCantidad.map((p) => p.nombre).join(' · ')}</p>
            <p className="text-xs mt-2">No tienen ventas registradas ni un stock mínimo. Define el stock mínimo en el <Link to="/productos" className="font-bold underline">Catálogo</Link>.</p>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Pedidos por aprobar" ayuda="Revísalos y apruébalos cuando estés de acuerdo.">
        {porAprobar.length > 0 ? (
          <div className="space-y-4">
            {porAprobar.map((o) => (
              <PedidoPorAprobar key={o.id_orden} orden={o} lineas={detalles[o.id_orden]} ocupado={ocupado} onCargarDetalle={cargarDetalle} onAprobar={aprobar} onDescartar={descartar} />
            ))}
          </div>
        ) : <Vacio>No hay pedidos esperando tu aprobación.</Vacio>}
      </Seccion>

      <Seccion titulo="Por recibir" ayuda="Cuando llegue la mercancía, regístrala para que tu stock se actualice.">
        {porRecibir.length > 0 ? (
          <div className="space-y-4">
            {porRecibir.map((o) => (
              <PedidoPorRecibir key={o.id_orden} orden={o} lineas={detalles[o.id_orden]} ocupado={ocupado} onCargarDetalle={cargarDetalle} onRecibir={recibir} />
            ))}
          </div>
        ) : <Vacio>No hay pedidos esperando mercancía.</Vacio>}
      </Seccion>
    </div>
  );
};

export default PedirPage;
