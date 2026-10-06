import { useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { pendienteDeLinea, quedaraFaltante } from '../../utils/pedir';

// «Llegó ahora» arranca en lo que falta (lo más común: llegó todo). El servidor espera el total recibido y suma solo la
// diferencia, así que registrar dos veces no duplica el stock.
const FormularioDeRecepcion = ({ orden, lineas, ocupado, onRecibir, onListo, onCancelar }) => {
  // Los valores iniciales salen de las líneas; cuando las líneas cambian (se recarga el detalle) el padre vuelve a
  // montar este formulario con otra `key`, así que no hace falta un efecto que reinicie el estado.
  const [llegadas, setLlegadas] = useState(() => Object.fromEntries(lineas.map((l) => [l.id_producto, String(pendienteDeLinea(l))])));
  const [cerrarConFaltante, setCerrarConFaltante] = useState(false);
  const [excesos, setExcesos] = useState(null); // null = sin exceso por confirmar
  const [motivo, setMotivo] = useState('');
  const enCurso = ocupado === `recibir-${orden.id_orden}`;

  const registrar = async (confirmandoExceso) => {
    const r = await onRecibir(orden.id_orden, lineas, llegadas, {
      cerrarConFaltante: cerrarConFaltante && quedaraFaltante(lineas, llegadas),
      confirmarExceso: confirmandoExceso,
      motivo,
    });
    if (r.requiereConfirmacion) setExcesos(r.excesos);
    if (r.ok) onListo();
  };

  return (
    <div className="mt-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 text-left">
            <th className="py-1 font-bold">Producto</th>
            <th className="py-1 font-bold text-right">Pedido</th>
            <th className="py-1 font-bold text-right">Ya llegó</th>
            <th className="py-1 font-bold text-right">Llegó ahora</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lineas.map((l) => (
            <tr key={l.id_producto}>
              <td className="py-2 font-bold text-tinta">{l.nombre_producto}</td>
              <td className="py-2 text-right">{l.cantidad_final}</td>
              <td className="py-2 text-right">{Number(l.cantidad_recibida || 0)}</td>
              <td className="py-2 text-right">
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={`Llegó de ${l.nombre_producto}`}
                  value={llegadas[l.id_producto] ?? ''}
                  onChange={(e) => setLlegadas((prev) => ({ ...prev, [l.id_producto]: e.target.value }))}
                  className="w-20 p-1.5 text-right text-sm font-bold text-tinta bg-white border border-slate-200 rounded-lg outline-none focus:border-azul"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {quedaraFaltante(lineas, llegadas) && (
        <label className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600">
          <input type="checkbox" checked={cerrarConFaltante} onChange={(e) => setCerrarConFaltante(e.target.checked)} />
          Cerrar el pedido aunque falte mercancía (el resto no va a llegar)
        </label>
      )}

      {excesos ? (
        <div role="alertdialog" aria-label="Confirmar que se recibió más de lo pedido" className="mt-4 p-4 rounded-2xl bg-aviso-suave border border-aviso/30">
          <p className="text-sm font-bold text-tinta">Escribiste más de lo que se pidió:</p>
          <ul className="mt-1 text-xs text-slate-700 list-disc pl-5">
            {excesos.map((x) => <li key={x.id_producto}>{x.nombre}: pedido {x.pedido}, recibido {x.recibido} (+{x.exceso})</li>)}
          </ul>
          <label htmlFor={`motivo-${orden.id_orden}`} className="mt-3 block text-xs font-bold text-slate-600">¿Por qué llegó de más? (mínimo 5 letras)</label>
          <textarea
            id={`motivo-${orden.id_orden}`}
            value={motivo}
            maxLength={200}
            onChange={(e) => setMotivo(e.target.value)}
            className="mt-1 w-full p-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-azul"
            rows={2}
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setExcesos(null)} className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg">Volver a corregir</button>
            <button type="button" disabled={enCurso || motivo.trim().length < 5} onClick={() => registrar(true)} className="text-xs font-bold text-white bg-azul hover:bg-azul-hondo disabled:opacity-50 px-3 py-2 rounded-lg">Registrar lo de más</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={ocupado !== null} onClick={() => registrar(false)} className="text-xs font-bold text-white bg-exito hover:opacity-90 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
            {enCurso ? 'Registrando…' : 'Confirmar recepción'}
          </button>
          <button type="button" onClick={onCancelar} className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg">Cancelar</button>
        </div>
      )}
    </div>
  );
};

// Un pedido aprobado al que le falta mercancía.
const PedidoPorRecibir = ({ orden, lineas, ocupado, onCargarDetalle, onRecibir }) => {
  const [abierto, setAbierto] = useState(false);

  const abrir = () => {
    setAbierto(true);
    if (!lineas) onCargarDetalle(orden.id_orden);
  };
  // Cambia cuando cambia lo ya recibido, para que el formulario vuelva a arrancar con lo que de verdad falta.
  const firma = lineas ? lineas.map((l) => `${l.id_producto}:${l.cantidad_recibida}`).join('|') : 'cargando';

  return (
    <article className="bg-white border border-slate-100 rounded-2xl shadow-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="titular text-lg text-tinta">Pedido #{orden.id_orden} · {orden.proveedor_nombre}</h3>
          <p className="text-xs text-slate-500 font-bold">{orden.estado === 'Parcial' ? 'Llegó una parte; falta el resto' : 'Aprobado, esperando la mercancía'}</p>
        </div>
        {!abierto && (
          <button type="button" onClick={abrir} className="flex items-center gap-2 text-xs font-bold text-white bg-azul hover:bg-azul-hondo px-4 py-2 rounded-lg transition-colors">
            <PackageCheck size={14} /> ¿Llegó el pedido? Registrar
          </button>
        )}
      </div>

      {abierto && (lineas
        ? <FormularioDeRecepcion key={firma} orden={orden} lineas={lineas} ocupado={ocupado} onRecibir={onRecibir} onListo={() => setAbierto(false)} onCancelar={() => setAbierto(false)} />
        : <p className="mt-4 text-xs text-slate-500">Cargando…</p>)}
    </article>
  );
};

export default PedidoPorRecibir;
