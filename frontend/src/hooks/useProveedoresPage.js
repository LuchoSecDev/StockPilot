import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';

export const useProveedoresPage = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  
  const [smartCart, setSmartCart] = useState(null); // Data if AI has been invoked
  const [riskEval, setRiskEval] = useState(null);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [isConsultingAI, setIsConsultingAI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // History state
  const [ordenesHistory, setOrdenesHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryDetail, setShowHistoryDetail] = useState(null);
  const [ordenDetail, setOrdenDetail] = useState([]);
  
  // Supplier CRUD state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierFormData, setSupplierFormData] = useState({
    id_proveedor: '',
    nombre_empresa: '',
    contacto_principal: '',
    email: '',
    telefono: '',
    direccion: ''
  });
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);

  // Email sending state
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');

  // Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({ ordenId: null, total: 0, currentPaid: 0 });
  const [manualAmount, setManualAmount] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  const toast = useToast();

  const fetchHistory = useCallback(async (signal = null) => {
    setLoadingHistory(true);
    try {
      const res = await axios.get('/api/ordenes/historial', { ...(signal && { signal }) });
      if (signal && signal.aborted) return;
      if (res.data.success) setOrdenesHistory(res.data.data);
    } catch (e) {
      if (axios.isCancel(e) || (signal && signal.aborted)) return;
      console.error('Error cargando historial:', e);
    } finally {
      if (!signal || !signal.aborted) {
        setLoadingHistory(false);
      }
    }
  }, []);

  const fetchProveedores = useCallback(async (signal = null) => {
    try {
      setLoading(true);
      const res = await axios.get('/api/proveedores', { ...(signal && { signal }) });
      if (signal && signal.aborted) return;
      if (res.data.success) {
        setProveedores(res.data.data);
      }
    } catch (e) {
      if (axios.isCancel(e) || (signal && signal.aborted)) return;
      toast.error('Error cargando la lista de proveedores');
    } finally {
      if (!signal || !signal.aborted) {
        setLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    fetchProveedores(controller.signal);
    fetchHistory(controller.signal);
    return () => controller.abort();
  }, [fetchProveedores, fetchHistory]);

  const handleOpenForecast = async (proveedor) => {
    setSelectedSupplier(proveedor);
    setSmartCart(null);
    setRiskEval(null);
    setForecastData([]);
    setIsForecastLoading(true);
    setShowOrderModal(true);
    try {
      const res = await axios.get(`/api/proveedores/${proveedor.id_proveedor}/forecast`);
      if (res.data.success) {
        setForecastData(res.data.recomendaciones_matematicas);
      }
    } catch {
      toast.error('Error calculando la demanda base');
    } finally {
      setIsForecastLoading(false);
    }
  };

  const requestCopilot = async () => {
    if (forecastData.length === 0) return toast.info('No hay productos críticos para recomendar.');
    
    setIsConsultingAI(true);
    try {
      const res = await axios.post(`/api/proveedores/${selectedSupplier.id_proveedor}/ai-copilot`, {
        recomendaciones_matematicas: forecastData,
        presupuesto_maximo: 5000000 // Presupuesto quemado para efectos de demo
      });
      if (res.data.success) {
        const cartWithFlags = res.data.carrito_inteligente.map(i => ({ ...i, incluido: true }));
        setSmartCart(cartWithFlags);
        setRiskEval(res.data.evaluacion_riesgo);
        toast.success('El Copiloto IA ha analizado el carrito exitosamente.');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Falló la consulta al Oráculo IA');
    } finally {
      setIsConsultingAI(false);
    }
  };

  const handleToggleItem = (productId) => {
    const updated = smartCart.map(item => 
      item.id_producto === productId ? { ...item, incluido: !item.incluido } : item
    );
    setSmartCart(updated);
    recalculateRisk(updated);
  };

  const handleEditQty = (productId, newQty) => {
    const qty = parseInt(newQty) || 0;
    const updated = smartCart.map(item => {
      if (item.id_producto === productId) {
        const unitCost = item.presupuesto_estimado_final / (item.sugerencia_final || 1);
        return { 
          ...item, 
          sugerencia_final: qty, 
          presupuesto_estimado_final: Math.round(qty * unitCost)
        };
      }
      return item;
    });
    setSmartCart(updated);
    recalculateRisk(updated);
  };

  const recalculateRisk = (currentCart) => {
    const included = currentCart.filter(i => i.incluido);
    const total = included.reduce((acc, curr) => acc + curr.presupuesto_estimado_final, 0);
    const criticalCount = included.filter(i => i.nivel_riesgo === 'critical').length;
    const mediumCount = included.filter(i => i.nivel_riesgo === 'medium').length;
    
    let level = 'Bajo';
    let reason = 'Optimizado manualmente.';
    
    if (total > 5000000) {
      level = 'Alto';
      reason = 'El costo total excede el presupuesto estratégico.';
    } else if (criticalCount > 0) {
      level = 'Alto';
      reason = `Contiene ${criticalCount} ítems con stock crítico. Requiere revisión urgente.`;
    } else if (mediumCount > 0) {
      level = 'Medio';
      reason = `Contiene ${mediumCount} ítems en alerta de agotamiento (Naranja). Requiere revisión manual.`;
    }

    setRiskEval({
      nivel: level,
      justificacion: reason,
      costo_total_estimado: total
    });
  };

  const fetchOrderDetail = async (orden) => {
    setShowHistoryDetail(orden);
    try {
      const res = await axios.get(`/api/ordenes/${orden.id_orden}`);
      if (res.data.success) setOrdenDetail(res.data.rows || res.data.data);
    } catch {
      toast.error('No se pudo cargar el detalle');
    }
  };

  const submitFinalOrder = async (sinIA = false) => {
    setIsSubmitting(true);
    try {
      let includedItems, riskData;

      if (sinIA || !smartCart) {
        includedItems = forecastData.map(i => ({
          ...i,
          sugerencia_final: i.cantidad_sugerida,
          calculo_base: i.cantidad_sugerida,
          ajuste_ia: '+0%',
          razon_ia: 'Orden manual sin optimización IA.',
          presupuesto_estimado_final: i.presupuesto_estimado,
          incluido: true
        }));
        riskData = {
          nivel: 'Bajo',
          justificacion: 'Orden manual generada sin análisis IA.',
          costo_total_estimado: forecastData.reduce((acc, i) => acc + i.presupuesto_estimado, 0)
        };
      } else {
        includedItems = smartCart.filter(i => i.incluido);
        riskData = riskEval;
      }

      if (includedItems.length === 0) return toast.error('Debe incluir al menos un producto.');

      const res = await axios.post(`/api/proveedores/${selectedSupplier.id_proveedor}/ordenes`, {
        carrito_final: includedItems,
        evaluacion_riesgo: riskData,
        estado_deseado: riskData.nivel === 'Bajo' ? 'Aprobada' : 'Pendiente'
      });
      if (res.data.success) {
        const ordenId = res.data.orden_id;
        if (riskData.nivel === 'Bajo') {
          try {
            await axios.post(`/api/ordenes/${ordenId}/enviar-proveedor`);
            toast.success(`Orden #${ordenId} aprobada y enviada al proveedor automáticamente.`);
          } catch {
            toast.success(`Orden #${ordenId} creada y aprobada.`);
            toast.warning('No se pudo enviar el email. Verifica que el proveedor tenga correo registrado.');
          }
        } else {
          toast.success(`Orden #${ordenId} enviada a revisión.`);
        }
        setShowOrderModal(false);
        fetchHistory();
      }
    } catch {
      toast.error('Ocurrió un error guardando la Orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendToSupplier = async (ordenId) => {
    setIsSendingEmail(true);
    try {
      const res = await axios.post(`/api/ordenes/${ordenId}/enviar-proveedor`, {
        mensaje_personalizado: emailMessage || ''
      });
      if (res.data.success) {
        toast.success(res.data.message);
        setEmailMessage('');
        setOrdenesHistory(prev => prev.map(o => o.id_orden === ordenId ? { ...o, estado: 'Enviada' } : o));
        if (showHistoryDetail && showHistoryDetail.id_orden === ordenId) {
          setShowHistoryDetail(prev => ({ ...prev, estado: 'Enviada' }));
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al enviar la orden por correo');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleRegisterPayment = (ordenId, total, currentPaid) => {
    const remaining = total - currentPaid;
    setPaymentData({ ordenId, total, currentPaid });
    setManualAmount(remaining.toString());
    setShowPaymentModal(true);
  };

  const confirmPayment = async (amount) => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return toast.error('Monto inválido.');
    
    setIsPaying(true);
    try {
      const res = await axios.post(`/api/proveedores/ordenes/${paymentData.ordenId}/pay`, { monto: amountNum });
      if (res.data.success) {
        toast.success(`Pago de $${amountNum.toLocaleString()} registrado con éxito.`);
        setShowPaymentModal(false);
        fetchHistory();
        fetchProveedores();
        if (showHistoryDetail && showHistoryDetail.id_orden === paymentData.ordenId) {
           setShowHistoryDetail(null);
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al registrar pago');
    } finally {
      setIsPaying(false);
    }
  };

  const handleUpdateEstado = async (ordenId, nuevoEstado) => {
    try {
      const res = await axios.patch(`/api/ordenes/${ordenId}/estado`, { estado: nuevoEstado });
      if (res.data.success) {
        if (nuevoEstado === 'Rechazada') toast.success('Orden rechazada correctamente.');
        else if (nuevoEstado === 'Aprobada') toast.success('¡Orden aprobada! Lista para enviar al proveedor.');
        else if (nuevoEstado === 'Enviada') toast.success('Orden marcada como enviada.');
        setShowHistoryDetail(null);
        fetchHistory();
      }
    } catch (e) {
      toast.error(e.response?.data?.error || `Error al ${nuevoEstado === 'Rechazada' ? 'rechazar' : 'aprobar'}`);
    }
  };

  const [savingItem, setSavingItem] = useState(null); // id_producto en edición/borrado

  // Solo aplica a órdenes en Borrador (endpoints de la Fase B del plan 13)
  const handleEditOrderItem = async (idOrden, idProducto, cantidad) => {
    const qty = parseInt(cantidad, 10);
    if (!Number.isInteger(qty) || qty <= 0) return toast.error('La cantidad debe ser un entero mayor a 0.');
    setSavingItem(idProducto);
    try {
      const res = await axios.patch(`/api/ordenes/${idOrden}/items/${idProducto}`, { cantidad: qty });
      if (res.data.success) {
        setOrdenDetail(prev => prev.map(d => d.id_producto === idProducto ? { ...d, cantidad_final: qty } : d));
        setOrdenesHistory(prev => prev.map(o => o.id_orden === idOrden ? { ...o, presupuesto_total: res.data.total } : o));
        setShowHistoryDetail(prev => prev && prev.id_orden === idOrden ? { ...prev, presupuesto_total: res.data.total } : prev);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo actualizar la cantidad.');
    } finally {
      setSavingItem(null);
    }
  };

  const handleRemoveOrderItem = async (idOrden, idProducto) => {
    setSavingItem(idProducto);
    try {
      const res = await axios.delete(`/api/ordenes/${idOrden}/items/${idProducto}`);
      if (res.data.success) {
        setOrdenDetail(prev => prev.filter(d => d.id_producto !== idProducto));
        if (res.data.eliminada) {
          toast.success('El borrador quedó vacío y se eliminó.');
          setShowHistoryDetail(null);
          fetchHistory();
        } else {
          setOrdenesHistory(prev => prev.map(o => o.id_orden === idOrden ? { ...o, presupuesto_total: res.data.total } : o));
          setShowHistoryDetail(prev => prev && prev.id_orden === idOrden ? { ...prev, presupuesto_total: res.data.total } : prev);
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo quitar el producto.');
    } finally {
      setSavingItem(null);
    }
  };

  const [completandoOrden, setCompletandoOrden] = useState(false);

  /**
   * Confirma la recepción de mercancía (plan 13, Fase E; regla P21-10 del plan 21): suma al inventario lo
   * recibido. `cuerpo` es { items: [{ id_producto, cantidad_recibida }], confirmar_exceso?, motivo?,
   * cerrar_con_faltante? }; la cantidad de cada línea es el TOTAL recibido hasta ahora.
   * Devuelve { ok: true } si se registró, { requiereConfirmacion: true, excesos } si el servidor pide
   * confirmar que se recibió más de lo pedido (no se guardó nada), o { ok: false } si falló.
   */
  const handleCompletarRecepcion = async (idOrden, cuerpo) => {
    setCompletandoOrden(true);
    try {
      const res = await axios.post(`/api/ordenes/${idOrden}/completar`, cuerpo);
      if (!res.data.success) return { ok: false };
      const faltan = res.data.pendientes?.length || 0;
      if (res.data.estado === 'Parcial') {
        toast.success(`Recepción parcial registrada: el inventario ya se actualizó y ${faltan === 1 ? 'falta 1 producto' : `faltan ${faltan} productos`} por llegar.`);
      } else {
        toast.success('Recepción completa: el inventario ya se actualizó.');
      }
      setShowHistoryDetail(null);
      fetchHistory();
      return { ok: true };
    } catch (e) {
      if (e.response?.status === 409 && e.response.data?.requiere_confirmacion) {
        return { requiereConfirmacion: true, excesos: e.response.data.excesos || [] };
      }
      toast.error(e.response?.data?.error || 'No se pudo confirmar la recepción.');
      return { ok: false };
    } finally {
      setCompletandoOrden(false);
    }
  };

  const handleOpenSupplierModal = (supplier = null) => {
    if (supplier) {
      setIsEditingSupplier(true);
      setSupplierFormData({
        id_proveedor: supplier.id_proveedor,
        nombre_empresa: supplier.nombre_empresa || '',
        contacto_principal: supplier.contacto_principal || '',
        email: supplier.email || '',
        telefono: supplier.telefono || '',
        direccion: supplier.direccion || ''
      });
    } else {
      setIsEditingSupplier(false);
      setSupplierFormData({
        id_proveedor: '',
        nombre_empresa: '',
        contacto_principal: '',
        email: '',
        telefono: '',
        direccion: ''
      });
    }
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = async (data) => {
    setSupplierLoading(true);
    try {
      if (isEditingSupplier) {
        await axios.put(`/api/proveedores/${data.id_proveedor}`, data);
        toast.success('Proveedor actualizado exitosamente');
      } else {
        await axios.post('/api/proveedores', data);
        toast.success('Nuevo proveedor registrado');
      }
      setShowSupplierModal(false);
      fetchProveedores();
    } catch {
      toast.error('Error al guardar el proveedor');
    } finally {
      setSupplierLoading(false);
    }
  };

  const handleDeleteSupplier = async () => {
    setSupplierLoading(true);
    try {
      await axios.delete(`/api/proveedores/${supplierToDelete.id_proveedor}`);
      toast.success('Proveedor inhabilitado');
      setSupplierToDelete(null);
      fetchProveedores();
    } catch {
      toast.error('No se pudo inhabilitar el proveedor');
    } finally {
      setSupplierLoading(false);
    }
  };

  return {
    proveedores,
    loading,
    showOrderModal, setShowOrderModal,
    selectedSupplier, setSelectedSupplier,
    forecastData, setForecastData,
    smartCart, setSmartCart,
    riskEval, setRiskEval,
    isForecastLoading, setIsForecastLoading,
    isConsultingAI, setIsConsultingAI,
    isSubmitting, setIsSubmitting,
    ordenesHistory, setOrdenesHistory,
    loadingHistory, setLoadingHistory,
    showHistoryDetail, setShowHistoryDetail,
    ordenDetail, setOrdenDetail,
    showSupplierModal, setShowSupplierModal,
    supplierFormData, setSupplierFormData,
    isEditingSupplier, setIsEditingSupplier,
    supplierLoading, setSupplierLoading,
    supplierToDelete, setSupplierToDelete,
    isSendingEmail, setIsSendingEmail,
    emailMessage, setEmailMessage,
    showPaymentModal, setShowPaymentModal,
    paymentData, setPaymentData,
    manualAmount, setManualAmount,
    isPaying, setIsPaying,
    
    // Acciones
    fetchHistory,
    fetchProveedores,
    handleOpenForecast,
    requestCopilot,
    handleToggleItem,
    handleEditQty,
    fetchOrderDetail,
    submitFinalOrder,
    handleSendToSupplier,
    handleRegisterPayment,
    confirmPayment,
    handleOpenSupplierModal,
    handleSaveSupplier,
    handleDeleteSupplier,
    handleUpdateEstado,
    savingItem,
    handleEditOrderItem,
    handleRemoveOrderItem,
    completandoOrden,
    handleCompletarRecepcion
  };
};
