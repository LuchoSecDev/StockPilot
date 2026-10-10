import { useState } from 'react';
import { ScrollText, Mail, Banknote, AlertTriangle, Loader2, Trash2, Copy, FileDown, Check, PackageCheck, User } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';

/** Texto plano del pedido, para copiar y enviar por WhatsApp cuando el proveedor no tiene correo. */
function textoPedido(orden, items) {
  const lineas = items.map((d) => `- ${d.nombre_producto}: ${d.cantidad_final} ud`).join('\n');
  return `Pedido #${orden.id_orden} — ${orden.proveedor_nombre}\n${lineas}\n\nTotal estimado: $${Number(orden.presupuesto_total || 0).toLocaleString('es-CO')}`;
}

const OrdenesHistory = ({
  ordenesHistory,
  loadingHistory,
  showHistoryDetail,
  setShowHistoryDetail,
  ordenDetail,
  fetchOrderDetail,
  handleRegisterPayment,
  handleSendToSupplier,
  isSendingEmail,
  emailMessage,
  setEmailMessage,
  onUpdateEstado,
  savingItem,
  onEditItem,
  onRemoveItem,
  completandoOrden,
  onCompletarRecepcion
}) => {
  const toast = useToast();
  const [qtyDraft, setQtyDraft] = useState({});
  const [mostrarRecepcion, setMostrarRecepcion] = useState(false);
  const [recepcionDraft, setRecepcionDraft] = useState({});
  const [cerrarConFaltante, setCerrarConFaltante] = useState(false);
  // Exceso pendiente de confirmar (lista que devuelve el servidor) y el motivo que escribe el administrador.
  const [excesos, setExcesos] = useState(null);
  const [motivoExceso, setMotivoExceso] = useState('');
  const esBorrador = showHistoryDetail?.estado === 'Borrador';
  const sePuedeRecibir = ['Aprobada', 'Enviada', 'Parcial'].includes(showHistoryDetail?.estado);

  const reiniciarRecepcion = () => {
    setMostrarRecepcion(false);
    setRecepcionDraft({});
    setCerrarConFaltante(false);
    setExcesos(null);
    setMotivoExceso('');
  };

  const cerrarDetalle = () => {
    setShowHistoryDetail(null);
    setQtyDraft({});
    reiniciarRecepcion();
  };

  const copiarPedido = async () => {
    try {
      await navigator.clipboard.writeText(textoPedido(showHistoryDetail, ordenDetail));
      toast.success('Pedido copiado. Puedes pegarlo en WhatsApp o donde lo necesites.');
    } catch {
      toast.error('No se pudo copiar. Selecciona y copia el texto manualmente.');
    }
  };

  /**
   * Envía el TOTAL recibido de cada producto. Si el servidor pide confirmar que se recibió más de lo
   * pedido (no guardó nada), se muestra el panel del motivo; con `confirmando` se reenvía con el motivo.
   */
  const confirmarRecepcion = async (confirmando = false) => {
    const cuerpo = {
      items: ordenDetail.map((det) => ({
        id_producto: det.id_producto,
        cantidad_recibida: Number(recepcionDraft[det.id_producto] ?? det.cantidad_final),
      })),
      cerrar_con_faltante: cerrarConFaltante,
    };
    if (confirmando) {
      cuerpo.confirmar_exceso = true;
      cuerpo.motivo = motivoExceso.trim();
    }
    const resultado = await onCompletarRecepcion(showHistoryDetail.id_orden, cuerpo);
    if (resultado?.requiereConfirmacion) setExcesos(resultado.excesos);
    else if (resultado?.ok) reiniciarRecepcion();
  };
  return (
    <div className="relative z-10 pt-10 border-t border-slate-100">
      <div className="flex items-center gap-2 mb-6">
        <ScrollText size={24} className="text-tinta-2" />
        <h2 className="titular text-2xl text-tinta">Historial de Órdenes a Proveedores</h2>
      </div>
      
      {loadingHistory ? (
        <div className="h-40 bg-white rounded-2xl animate-pulse"></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[860px]">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold text-slate-500">
                <th className="p-5">Fecha</th>
                <th className="p-5">Proveedor</th>
                <th className="p-5">Alerta</th>
                <th className="p-5">Costo Total</th>
                <th className="p-5">Saldo Pendiente</th>
                <th className="p-5">Estado Logístico</th>
                <th className="p-5">Estado de Pago</th>
                <th className="p-5 text-right max-md:sticky max-md:right-0 max-md:bg-slate-50">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ordenesHistory.map(o => (
                <tr key={o.id_orden} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-5 text-xs font-bold text-slate-500">{new Date(o.fecha_creacion).toLocaleDateString()}</td>
                  <td className="p-5 text-sm font-bold text-tinta">{o.proveedor_nombre}</td>
                  <td className="p-5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${o.riesgo === 'Alto' ? 'bg-peligro-suave text-peligro' : (o.riesgo === 'Medio' ? 'bg-aviso-suave text-aviso' : 'bg-exito-suave text-exito')}`}>
                      {o.riesgo}
                    </span>
                  </td>
                  <td className="p-5 text-sm font-bold text-tinta-2">${o.presupuesto_total.toLocaleString()}</td>
                  <td className="p-5">
                    <span className={`text-sm font-bold ${o.saldo_pendiente > 0 ? 'text-peligro' : 'text-exito'}`}>
                      ${(o.saldo_pendiente || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="p-5">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      o.estado === 'Aprobada' ? 'bg-emerald-50 text-exito' : 
                      o.estado === 'Rechazada' ? 'bg-rose-50 text-peligro' : 
                      o.estado === 'Enviada' ? 'bg-azul/10 text-azul' : 
                      'bg-amber-50 text-aviso'
                    }`}>
                      {o.estado === 'Enviada' ? <span className="flex items-center gap-1"><Mail size={12} /> Enviada</span> : o.estado}
                    </span>
                  </td>
                  <td className="p-5">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      o.estado_pago === 'Pagado' ? 'bg-exito-suave text-exito' : 
                      o.estado_pago === 'Abonado' ? 'bg-aviso-suave text-aviso' : 
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {o.estado_pago || 'Pendiente Pago'}
                    </span>
                  </td>
                  <td className="p-5 text-right flex items-center justify-end gap-4 max-md:sticky max-md:right-0 max-md:bg-white max-md:shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)]">
                    {o.saldo_pendiente > 0 && (
                      <button
                        onClick={() => handleRegisterPayment(o.id_orden, o.presupuesto_total, o.monto_pagado)}
                        className="text-xs font-bold text-exito hover:text-emerald-800 border-b border-emerald-200 flex items-center gap-1"
                      >
                        <Banknote size={12} /> Pagar
                      </button>
                    )}
                    <button 
                      onClick={() => fetchOrderDetail(o)}
                      className="text-xs font-bold text-azul hover:text-azul"
                    >
                      Revisar Pedido →
                    </button>
                  </td>
                </tr>
              ))}
              {ordenesHistory.length === 0 && (
                <tr><td colSpan="6" className="p-10 text-center text-sm font-bold text-slate-500">No hay órdenes registradas aún.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {showHistoryDetail && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-tinta/45 backdrop-blur-sm" role="presentation" aria-hidden="true" onClick={cerrarDetalle}></div>
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-lg relative z-10 overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="titular text-xl text-tinta">Detalle de Orden #{showHistoryDetail.id_orden}</h2>
              <button onClick={cerrarDetalle} aria-label="Cerrar detalle" className="text-2xl text-slate-500 hover:text-rose-500 transition-colors">×</button>
            </div>

            {/* Metadata de la orden */}
            <div className="px-6 pt-5 pb-3 grid grid-cols-3 max-sm:grid-cols-2 gap-3">
              <div className="col-span-3 max-sm:col-span-2 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <p className="text-xs font-bold text-slate-500">Proveedor</p>
                <p className="text-sm font-bold text-tinta mt-1">{showHistoryDetail.proveedor_nombre}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <p className="text-xs font-bold text-slate-500">Fecha</p>
                <p className="text-sm font-bold text-tinta mt-1">{(() => { const r = (showHistoryDetail.fecha_creacion || '').split('T')[0]; const [y,m,d] = r.split('-'); return (y && m && d) ? `${d}/${m}/${y}` : r; })()}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                <p className="text-xs font-bold text-slate-500">Presupuesto</p>
                <p className="text-sm font-bold text-tinta mt-1">${showHistoryDetail.presupuesto_total?.toLocaleString()}</p>
              </div>
              <div className={`rounded-2xl p-3 border max-sm:col-span-2 ${showHistoryDetail.estado === 'Aprobada' ? 'bg-emerald-50 border-emerald-200' : showHistoryDetail.estado === 'Rechazada' ? 'bg-rose-50 border-rose-200' : showHistoryDetail.estado === 'Enviada' ? 'bg-azul/10 border-azul/30' : 'bg-amber-50 border-amber-200'}`}>
                <p className="text-xs font-bold text-slate-500">Estado</p>
                <p className={`text-sm font-bold mt-1 flex items-center gap-1 ${showHistoryDetail.estado === 'Aprobada' ? 'text-exito' : showHistoryDetail.estado === 'Rechazada' ? 'text-peligro' : showHistoryDetail.estado === 'Enviada' ? 'text-azul' : 'text-aviso'}`}>{showHistoryDetail.estado === 'Enviada' ? <><Mail size={14} /> Enviada</> : showHistoryDetail.estado}</p>
              </div>
            </div>

            <div className="px-6 pb-6 max-h-[40vh] overflow-y-auto scrollbar-premium">
              <div className="space-y-3">
                {ordenDetail.map(det => (
                  <div key={det.id_detalle} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-sm font-bold text-tinta flex items-center gap-2 flex-wrap">
                        {det.nombre_producto}
                        {det.solicitado_por_nombre && (
                          <span className="text-xs font-bold text-azul bg-azul/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <User size={10} /> Solicitado por {det.solicitado_por_nombre}
                          </span>
                        )}
                      </p>
                      {!esBorrador && !mostrarRecepcion && <p className="text-xs font-bold text-slate-500">Base: {det.cantidad_sugerida ?? det.cantidad_final} ud → Final: <span className="text-exito">{det.cantidad_final} ud</span></p>}
                      {mostrarRecepcion && <p className="text-xs font-bold text-slate-500">Pedido: {det.cantidad_final} ud</p>}
                      {det.cantidad_recibida !== null && det.cantidad_recibida !== undefined && (
                        <p className="text-xs font-bold text-slate-500">Recibido{mostrarRecepcion ? ' hasta ahora' : ''}: <span className={Number(det.cantidad_recibida) < det.cantidad_final ? 'text-aviso' : Number(det.cantidad_recibida) > det.cantidad_final ? 'text-azul' : 'text-exito'}>{det.cantidad_recibida} ud</span></p>
                      )}
                    </div>
                    {mostrarRecepcion ? (
                      <input
                        type="number"
                        min={Number(det.cantidad_recibida) || 0}
                        disabled={!!excesos}
                        aria-label={`Total recibido de ${det.nombre_producto}`}
                        value={recepcionDraft[det.id_producto] ?? det.cantidad_final}
                        onChange={(e) => setRecepcionDraft((prev) => ({ ...prev, [det.id_producto]: e.target.value }))}
                        className="w-20 p-2 text-sm font-bold text-tinta text-center bg-white border border-slate-200 rounded-lg outline-none focus:border-azul"
                      />
                    ) : esBorrador ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          aria-label={`Cantidad de ${det.nombre_producto}`}
                          value={qtyDraft[det.id_producto] ?? det.cantidad_final}
                          onChange={(e) => setQtyDraft((prev) => ({ ...prev, [det.id_producto]: e.target.value }))}
                          className="w-20 p-2 text-sm font-bold text-tinta text-center bg-white border border-slate-200 rounded-lg outline-none focus:border-azul"
                        />
                        <button
                          type="button"
                          disabled={savingItem === det.id_producto || Number(qtyDraft[det.id_producto] ?? det.cantidad_final) === det.cantidad_final}
                          onClick={() => onEditItem(showHistoryDetail.id_orden, det.id_producto, qtyDraft[det.id_producto])}
                          className="text-xs font-bold text-azul bg-azul/10 hover:bg-azul hover:text-white disabled:opacity-40 px-3 py-2 rounded-lg transition-colors"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          aria-label={`Quitar ${det.nombre_producto} del pedido`}
                          disabled={savingItem === det.id_producto}
                          onClick={() => onRemoveItem(showHistoryDetail.id_orden, det.id_producto)}
                          className="text-peligro hover:bg-rose-50 disabled:opacity-40 p-2 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-500">Ajuste IA</p>
                        <p className="text-sm font-bold text-azul">{Number(det.sugerencia_ia) ? `${det.sugerencia_ia > 0 ? '+' : ''}${det.sugerencia_ia}%` : 'Sin ajuste'}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones de Revisión (solo para Pendiente/Borrador) */}
            {(showHistoryDetail.estado === 'Pendiente' || showHistoryDetail.estado === 'Borrador') && (
              <div className="p-5 border-t border-slate-100 bg-amber-50/50 flex gap-3 justify-end items-center">
                <span className="text-xs font-bold text-aviso mr-auto flex items-center gap-2">
                  <AlertTriangle size={14} /> Esta orden requiere su aprobación
                </span>
                <button
                  onClick={() => onUpdateEstado(showHistoryDetail.id_orden, 'Rechazada')}
                  className="px-6 py-3 rounded-lg text-xs font-bold bg-peligro-suave text-peligro hover:bg-rose-500 hover:text-white border border-rose-200 transition-colors transition-transform active:scale-95"
                >
                  ✕ Rechazar
                </button>
                <button
                  onClick={() => onUpdateEstado(showHistoryDetail.id_orden, 'Aprobada')}
                  className="px-6 py-3 rounded-lg text-xs font-bold bg-exito text-white hover:bg-emerald-700 shadow-lg transition-colors transition-shadow transition-transform active:scale-95"
                >
                  ✓ Autorizar Pedido
                </button>
              </div>
            )}

            {/* Estado final (para órdenes ya aprobadas o rechazadas) */}
            {showHistoryDetail.estado === 'Aprobada' && showHistoryDetail.proveedor_email && (
              <div className="p-5 border-t border-exito-suave bg-emerald-50 space-y-4">
                <div className="text-center">
                  <span className="text-xs font-bold text-exito">✓ Orden aprobada — Lista para enviar</span>
                </div>
                <div className="space-y-3">
                  <textarea
                    value={emailMessage}
                    onChange={e => setEmailMessage(e.target.value)}
                    placeholder="Mensaje para el proveedor (opcional). Ej: Por favor confirmar disponibilidad y tiempo de entrega."
                    aria-label="Mensaje para el proveedor"
                    className="w-full p-4 bg-white border border-emerald-200 rounded-lg text-sm text-tinta-2 outline-none focus:border-emerald-500 resize-none placeholder:text-slate-500"
                    rows={2}
                  />
                  <button
                    onClick={() => handleSendToSupplier(showHistoryDetail.id_orden)}
                    disabled={isSendingEmail}
                    className="w-full py-4 bg-azul hover:bg-azul-hondo text-white rounded-lg text-xs font-bold shadow-lg transition-colors transition-shadow transition-transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingEmail ? (
                      <><Loader2 size={16} className="animate-spin" /> Enviando correo...</>
                    ) : (
                      <><Mail size={16} /> Enviar Orden al Proveedor por Email</>
                    )}
                  </button>
                </div>
              </div>
            )}
            {/* Proveedor sin correo: el administrador la envía por su cuenta y marca "Enviada" a mano */}
            {showHistoryDetail.estado === 'Aprobada' && !showHistoryDetail.proveedor_email && (
              <div className="p-5 border-t border-aviso-suave bg-amber-50 space-y-3">
                <p className="text-xs font-bold text-aviso flex items-center gap-2">
                  <AlertTriangle size={14} /> {showHistoryDetail.proveedor_nombre} no tiene correo registrado: envíala por tu cuenta (WhatsApp, impresa) y márcala como enviada.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={copiarPedido}
                    className="flex-1 py-3 bg-white border border-aviso/30 text-aviso hover:bg-aviso hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy size={14} /> Copiar como texto
                  </button>
                  <a
                    href={`/api/ordenes/${showHistoryDetail.id_orden}/pdf`}
                    className="flex-1 py-3 bg-white border border-aviso/30 text-aviso hover:bg-aviso hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <FileDown size={14} /> Descargar PDF
                  </a>
                </div>
                <button
                  onClick={() => onUpdateEstado(showHistoryDetail.id_orden, 'Enviada')}
                  className="w-full py-3 bg-azul hover:bg-azul-hondo text-white rounded-lg text-xs font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={14} /> Ya la envié: marcar como enviada
                </button>
              </div>
            )}
            {showHistoryDetail.estado === 'Enviada' && (
              <div className="p-4 border-t border-azul/30 bg-azul/10 text-center">
                <span className="text-xs font-bold text-azul flex items-center justify-center gap-2"><Mail size={12} /> Orden enviada al proveedor por correo electrónico</span>
              </div>
            )}
            {showHistoryDetail.estado === 'Rechazada' && (
              <div className="p-4 border-t border-peligro-suave bg-rose-50 text-center">
                <span className="text-xs font-bold text-peligro">✕ Orden rechazada</span>
              </div>
            )}

            {/* Recepción de mercancía: cierra la orden y suma el stock recibido (plan 13, Fase E) */}
            {sePuedeRecibir && !mostrarRecepcion && (
              <div className="p-5 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={() => setMostrarRecepcion(true)}
                  className="w-full py-4 bg-tinta hover:bg-menu text-white rounded-lg text-xs font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                >
                  <PackageCheck size={16} /> ¿Llegó el pedido? Registrar recepción
                </button>
              </div>
            )}
            {sePuedeRecibir && mostrarRecepcion && !excesos && (
              <div className="p-5 border-t border-slate-100 bg-slate-50 space-y-3">
                <p className="text-xs font-bold text-tinta flex items-center gap-2">
                  <PackageCheck size={14} /> Escribe el total recibido de cada producto, contando lo que ya registraste (ya viene con la cantidad pedida).
                </p>
                <p className="text-xs text-slate-500">Si llega menos, la orden queda «Parcial»: lo recibido se suma al inventario y lo que falte sigue pendiente para registrarlo cuando llegue.</p>
                <label className="flex items-start gap-2 text-xs text-tinta-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cerrarConFaltante}
                    onChange={(e) => setCerrarConFaltante(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>Cerrar la orden aunque falte mercancía (doy por perdido lo que no llegó).</span>
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={reiniciarRecepcion}
                    className="flex-1 py-3 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-500 hover:text-tinta transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => confirmarRecepcion(false)}
                    disabled={completandoOrden}
                    className="flex-1 py-3 rounded-lg text-xs font-bold bg-exito text-white hover:bg-emerald-700 shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {completandoOrden ? (<><Loader2 size={14} className="animate-spin" /> Confirmando...</>) : (<><Check size={14} /> Confirmar recepción</>)}
                  </button>
                </div>
              </div>
            )}
            {/* El servidor no guardó nada: se recibió más de lo pedido y hay que confirmarlo con un motivo. */}
            {sePuedeRecibir && mostrarRecepcion && excesos && (
              <div className="p-5 border-t border-aviso/30 bg-aviso-suave space-y-3" role="alertdialog" aria-label="Confirmar que se recibió más de lo pedido">
                <p className="text-xs font-bold text-aviso flex items-center gap-2">
                  <AlertTriangle size={14} /> Recibiste más de lo pedido. Todavía no se guardó nada.
                </p>
                <ul className="text-xs text-tinta-2 space-y-1">
                  {excesos.map((x) => (
                    <li key={x.id_producto}><span className="font-bold">{x.nombre}</span>: pedido {x.pedido} ud, recibido {x.recibido} ud (+{x.exceso})</li>
                  ))}
                </ul>
                <label className="block text-xs font-bold text-tinta" htmlFor="motivo-exceso">Motivo (obligatorio, mínimo 5 caracteres)</label>
                <textarea
                  id="motivo-exceso"
                  value={motivoExceso}
                  onChange={(e) => setMotivoExceso(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder="Ej: El proveedor mandó una caja extra de regalo."
                  className="w-full p-3 bg-white border border-aviso/30 rounded-lg text-sm text-tinta-2 outline-none focus:border-azul resize-none placeholder:text-slate-500"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setExcesos(null); setMotivoExceso(''); }}
                    className="flex-1 py-3 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-500 hover:text-tinta transition-colors"
                  >
                    Volver a corregir
                  </button>
                  <button
                    onClick={() => confirmarRecepcion(true)}
                    disabled={completandoOrden || motivoExceso.trim().length < 5}
                    className="flex-1 py-3 rounded-lg text-xs font-bold bg-exito text-white hover:bg-emerald-700 shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {completandoOrden ? (<><Loader2 size={14} className="animate-spin" /> Confirmando...</>) : (<><Check size={14} /> Registrar el exceso</>)}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default OrdenesHistory;
