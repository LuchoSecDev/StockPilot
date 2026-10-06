import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { sugerenciasDePedido, cuerpoParaArmar, ordenesPorAprobar, ordenesPorRecibir, cuerpoDeRecepcion } from '../utils/pedir';

// Datos y acciones de la pantalla «¿Qué pido?» (/pedir, modo básico). Las reglas (qué se sugiere, cómo se arma el
// cuerpo de cada petición) están en utils/pedir.js, que es lo que tiene pruebas. Aquí solo se habla con el servidor.
// Todo viene del motor matemático: ninguna de estas rutas llama a un modelo de lenguaje.

const mensajeDe = (err, porDefecto) => err.response?.data?.error || porDefecto;

export default function usePedir() {
  const toast = useToast();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState([]);
  const [borradores, setBorradores] = useState({});
  const [historial, setHistorial] = useState([]);
  const [detalles, setDetalles] = useState({}); // id_orden -> líneas de la orden
  const [ocupado, setOcupado] = useState(null); // clave de la acción en curso, para deshabilitar su botón

  const cargar = useCallback(async (signal) => {
    try {
      const opciones = signal ? { signal } : {};
      const [snap, borr, hist] = await Promise.all([
        axios.get('/api/ia/snapshot', opciones),
        axios.get('/api/ordenes/borradores/resumen', opciones),
        axios.get('/api/ordenes/historial', opciones),
      ]);
      if (signal?.aborted) return;
      setSnapshot(snap.data.data || []);
      setBorradores(borr.data.data || {});
      setHistorial(hist.data.data || []);
      setError('');
    } catch (err) {
      if (axios.isCancel(err) || signal?.aborted) return;
      setError(mensajeDe(err, 'No se pudo cargar lo que hay por pedir. Revisa tu conexión e inténtalo de nuevo.'));
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    cargar(controller.signal);
    return () => controller.abort();
  }, [cargar]);

  const sugerencias = sugerenciasDePedido(snapshot, borradores);
  const porAprobar = ordenesPorAprobar(historial);
  const porRecibir = ordenesPorRecibir(historial);

  /** Crea (o suma a) el borrador del proveedor con lo que sugiere el motor. No envía nada al proveedor. */
  const armarPedido = async (grupo) => {
    setOcupado(`armar-${grupo.id_proveedor}`);
    try {
      const { data } = await axios.post('/api/ordenes/borrador/desde-consejero', cuerpoParaArmar(grupo.items));
      const b = data.borradores?.[0];
      toast.success(b ? `Pedido #${b.id_orden} armado para ${b.proveedor}. Revísalo y apruébalo abajo.` : 'No se armó ningún pedido.');
      setDetalles((d) => { const copia = { ...d }; if (b) delete copia[b.id_orden]; return copia; });
      await cargar();
      return true;
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo armar el pedido.'));
      return false;
    } finally {
      setOcupado(null);
    }
  };

  const cambiarEstado = async (idOrden, estado, textoExito) => {
    setOcupado(`estado-${idOrden}`);
    try {
      await axios.patch(`/api/ordenes/${idOrden}/estado`, { estado });
      toast.success(textoExito);
      await cargar();
      return true;
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo actualizar el pedido.'));
      return false;
    } finally {
      setOcupado(null);
    }
  };

  const aprobar = (idOrden) => cambiarEstado(idOrden, 'Aprobada', `Pedido #${idOrden} aprobado. Cuando llegue la mercancía, regístrala en «Por recibir».`);
  const descartar = (idOrden) => cambiarEstado(idOrden, 'Rechazada', `Pedido #${idOrden} descartado.`);

  const cargarDetalle = useCallback(async (idOrden) => {
    try {
      const { data } = await axios.get(`/api/ordenes/${idOrden}`);
      setDetalles((d) => ({ ...d, [idOrden]: data.data || [] }));
    } catch (err) {
      toast.error(mensajeDe(err, 'No se pudo cargar el detalle del pedido.'));
    }
  }, [toast]);

  /**
   * Registra lo que llegó. Devuelve { ok: true, estado } | { requiereConfirmacion: true, excesos } | { ok: false }.
   * El servidor espera el total recibido de cada línea; cuerpoDeRecepcion suma lo ya registrado con lo de ahora.
   */
  const recibir = async (idOrden, lineas, llegadas, opciones = {}) => {
    const armado = cuerpoDeRecepcion(lineas, llegadas, opciones);
    if (!armado.ok) { toast.error(armado.error); return { ok: false }; }
    setOcupado(`recibir-${idOrden}`);
    try {
      const { data } = await axios.post(`/api/ordenes/${idOrden}/completar`, armado.cuerpo);
      toast.success(data.estado === 'Completada' ? `Pedido #${idOrden} recibido completo. El stock ya está actualizado.` : `Recepción registrada. Al pedido #${idOrden} todavía le falta mercancía.`);
      setDetalles((d) => { const copia = { ...d }; delete copia[idOrden]; return copia; });
      await cargar();
      return { ok: true, estado: data.estado };
    } catch (err) {
      const d = err.response?.data;
      if (err.response?.status === 409 && d?.code === 'RECEPCION_EXCEDE_PEDIDO') return { requiereConfirmacion: true, excesos: d.excesos || [] };
      toast.error(mensajeDe(err, 'No se pudo registrar la recepción.'));
      return { ok: false };
    } finally {
      setOcupado(null);
    }
  };

  return { cargando, error, sugerencias, porAprobar, porRecibir, detalles, ocupado, recargar: cargar, armarPedido, aprobar, descartar, cargarDetalle, recibir };
}
