import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SYNC_EVENTS, emitSyncEvent, subscribeToSync } from '../utils/stockSync';
import { fetchProductFromOpenFoodFacts } from '../utils/openFoodFacts';
import useBarcodeScanner from './useBarcodeScanner';

export const useProductosPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.rol === 'Administrador';

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [categorias, setCategorias] = useState([]);

  // Alerta Global de Stock
    // Alerta Global de Stock
    const [alert, setAlert] = useState({ show: false, title: '', message: '', isCritical: false });

  // Modal Agregar / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState(null);
  const [proveedores, setProveedores] = useState([]);

  // Modales antiguos removidos

  // Modal Confirmar Toggle Estado
  const [toggleModalOpen, setToggleModalOpen] = useState(false);
  const [toggleProducto, setToggleProducto] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Modal Eliminar
  const [eliminarModalOpen, setEliminarModalOpen] = useState(false);
  const [eliminarProductoSel, setEliminarProductoSel] = useState(null);
  const [eliminarLoading, setEliminarLoading] = useState(false);

  // Modal Vincular Código de Barras
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkBarcodeCode, setLinkBarcodeCode] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  // Modal «Sumar stock» (Tendero: al escanear un producto que ya existe; matriz de roles P22-10, D1)
  const [sumarStockProducto, setSumarStockProducto] = useState(null);
  const [sumarStockLoading, setSumarStockLoading] = useState(false);

  // Upload
  const [uploadLoading, setUploadLoading] = useState(false);

  const fetchProveedores = useCallback(async (signal = null) => {
    try {
      const res = await axios.get('/api/proveedores', { ...(signal && { signal }) });
      if (signal && signal.aborted) return;
      if (res.data.success) setProveedores(res.data.data);
    } catch (e) {
      if (axios.isCancel(e) || (signal && signal.aborted)) return;
      console.error('Error cargando proveedores:', e);
    }
  }, []);

  // Antes este banner calculaba su propio umbral (distinto al de Monitor Alertas, al del Consejero
  // y al de la etiqueta de cada fila), así que podía mostrar un número distinto al de esas otras
  // pantallas para la misma tienda. Ahora lee las alertas reales (las mismas de la campanita y de
  // Monitor Alertas), para que el número siempre coincida en toda la app.
  const verificarAlertas = useCallback(async (signal = null) => {
    try {
      const { data } = await axios.get('/api/alertas', { ...(signal && { signal }) });
      if (signal && signal.aborted) return;
      const alertas = data.alerts || data.data || [];
      const nombresPorSeveridad = (severidad) =>
        Array.from(new Set(alertas.filter(a => a.severidad === severidad).map(a => a.nombre_producto)));

      const criticos = nombresPorSeveridad('critico');
      const advertencias = nombresPorSeveridad('advertencia');

      if (criticos.length > 0) {
        setAlert({
          show: true,
          title: '¡Riesgo de Quiebre Inminente!',
          message: `${criticos.length} producto(s) en nivel crítico (${criticos.slice(0, 3).join(', ')}${criticos.length > 3 ? '...' : ''}).`,
          isCritical: true
        });
      } else if (advertencias.length > 0) {
        setAlert({
          show: true,
          title: 'Atención Sugerida',
          message: `Es recomendable solicitar stock para ${advertencias.length} producto(s).`,
          isCritical: false
        });
      } else {
        setAlert({ show: false, title: '', message: '', isCritical: false });
      }
    } catch (e) {
      if (axios.isCancel(e) || (signal && signal.aborted)) return;
      console.error('Error cargando alertas para el banner:', e);
    }
  }, []);

  const cargarProductos = useCallback(async (signal = null) => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await axios.get('/api/productos', { ...(signal && { signal }) });
      if (signal && signal.aborted) return;
      setProductos(data);

      const cats = Array.from(new Set(data.flatMap(p => p.categoria ? [p.categoria] : [])));
      setCategorias(cats);
      verificarAlertas(signal);
    } catch (error) {
      if (axios.isCancel(error) || (signal && signal.aborted)) return;
      setLoadError(true);
      toast.error('No se pudieron cargar los productos');
    } finally {
      if (!signal || !signal.aborted) {
        setLoading(false);
      }
    }
  }, [toast, verificarAlertas]);

  useEffect(() => {
    const controller = new AbortController();
    cargarProductos(controller.signal);
    fetchProveedores(controller.signal);

    const unsubscribe = subscribeToSync((event) => {
      if (
        event.type === SYNC_EVENTS.STOCK_UPDATED || 
        event.type === SYNC_EVENTS.SALE_COMPLETED || 
        event.type === SYNC_EVENTS.PRODUCT_MODIFIED
      ) {
        cargarProductos();
      }
    });

    return () => {
      unsubscribe();
      controller.abort();
    };
  }, [cargarProductos, fetchProveedores]);

  const handleFileUpload = async (file) => {
    if (!file) return;
    const uploadFormData = new FormData();
    uploadFormData.append('file', file);
    setUploadLoading(true);
    try {
      const res = await axios.post('/api/productos/bulk', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success(`Se importaron ${res.data.processed} productos`);
        if (res.data.warnings && res.data.warnings.length > 0) {
          console.warn("Advertencias de carga masiva:", res.data.warnings);
          toast.error(`Se omitieron ${res.data.warnings.length} filas incompletas.`);
        }
        cargarProductos();
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error subiendo archivo');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleOpenModal = (producto = null) => {
    if (producto) {
      setEditMode(true);
      setFormData(producto);
    } else {
      setEditMode(false);
      setFormData(null);
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormData(null);
  };

  const handleSubmitProducto = async (data) => {
    if (formLoading) return;
    setFormLoading(true);
    try {
      if (data.isStockAddition) {
        // Entrada rápida de mercancía: registra en Kardex y actualiza stock en bodega
        await axios.post('/api/inventario/entrada', {
          id_producto: data.id_producto,
          cantidad: parseInt(data.cantidadAAgregar, 10),
          observacion: data.observacion || 'Recepción de mercancía (Entrada rápida)'
        });

        // Si además el usuario actualizó el precio de venta u otros campos:
        if (data.precio_unitario && Number(data.precio_unitario) !== Number(data.precioAnterior)) {
          await axios.put(`/api/productos/${data.id_producto}`, data);
        }

        toast.success(`¡Inventario ingresado exitosamente! (+${data.cantidadAAgregar} ud)`);
        emitSyncEvent(SYNC_EVENTS.STOCK_UPDATED, { id: data.id_producto });
      } else if (editMode) {
        await axios.put(`/api/productos/${data.id_producto}`, data);
        toast.success('Producto actualizado');
        emitSyncEvent(SYNC_EVENTS.PRODUCT_MODIFIED, { id: data.id_producto });
      } else {
        await axios.post('/api/productos/admin', data);
        toast.success('Producto creado');
        emitSyncEvent(SYNC_EVENTS.PRODUCT_MODIFIED, { id: data.id_producto });
      }
      handleCloseModal();
      cargarProductos();
    } catch (err) {
      toast.error(`${err.response?.data?.error || err.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  const submitEliminar = async () => {
    if (eliminarLoading) return;
    setEliminarLoading(true);
    try {
      await axios.delete(`/api/productos/${eliminarProductoSel.id_producto}`);
      toast.success('Producto eliminado permanentemente');
      setEliminarModalOpen(false);
      cargarProductos();
      emitSyncEvent(SYNC_EVENTS.PRODUCT_MODIFIED, { id: eliminarProductoSel.id_producto });
    } catch (err) {
      toast.error(`${err.response?.data?.error || err.message}`);
    } finally {
      setEliminarLoading(false);
    }
  };

  const submitToggleEstado = async () => {
    if (toggleLoading) return;
    setToggleLoading(true);
    try {
      const nuevoEstado = toggleProducto.estado === 'Disponible' ? 'Inactivo' : 'Disponible';
      const action = nuevoEstado === 'Inactivo' ? 'inhabilitar' : 'habilitar';
      await axios.put(`/api/productos/${action}/${toggleProducto.id_producto}`);
      toast.success(`Producto marcado como ${nuevoEstado}`);
      setToggleModalOpen(false);
      cargarProductos();
      emitSyncEvent(SYNC_EVENTS.PRODUCT_MODIFIED, { id: toggleProducto.id_producto });
    } catch (err) {
      toast.error(`${err.response?.data?.error || err.message}`);
    } finally {
      setToggleLoading(false);
    }
  };

  const submitLinkBarcode = async (productId, barcode) => {
    if (linkLoading) return;
    setLinkLoading(true);
    try {
      await axios.put(`/api/productos/${productId}/link-barcode`, { codigo_barras: barcode });
      toast.success('Código de barras vinculado con éxito');
      setLinkModalOpen(false);
      setLinkBarcodeCode('');
      cargarProductos();
      emitSyncEvent(SYNC_EVENTS.PRODUCT_MODIFIED, { id: productId });
    } catch (err) {
      toast.error(`${err.response?.data?.error || err.message}`);
    } finally {
      setLinkLoading(false);
    }
  };

  const submitSumarStock = async ({ id_producto, cantidad, observacion }) => {
    if (sumarStockLoading) return;
    setSumarStockLoading(true);
    try {
      await axios.post('/api/inventario/entrada', {
        id_producto,
        cantidad,
        observacion: observacion || 'Recepción de mercancía (Entrada rápida)'
      });
      toast.success(`¡Inventario ingresado exitosamente! (+${cantidad} ud)`);
      emitSyncEvent(SYNC_EVENTS.STOCK_UPDATED, { id: id_producto });
      setSumarStockProducto(null);
      cargarProductos();
    } catch (err) {
      toast.error(`${err.response?.data?.error || err.message}`);
    } finally {
      setSumarStockLoading(false);
    }
  };

  const handleBarcodeScan = async (code) => {
    if (!code) return;
    if (modalOpen && !editMode) return;
    if (sumarStockProducto) return;
    
    // Buscar primero por codigo_barras, luego por codigo
    const existingProduct = productos.find(p => p.codigo_barras === code || p.codigo === code);
    
    if (existingProduct && !isAdmin) {
      // Tendero: el escaneo solo le permite sumar stock (no editar precio ni datos del producto)
      setSumarStockProducto(existingProduct);
      toast.success(`Producto encontrado: ${existingProduct.nombre_producto}`);
    } else if (existingProduct) {
      // Si el producto existe, abrir modal de edición (ya no venta)
      setEditMode(true);
      setFormData(existingProduct);
      setModalOpen(true);
      toast.success(`Producto encontrado: ${existingProduct.nombre_producto}`);
    } else {
      // Si no existe, sugerir vinculación o creación
      setLinkBarcodeCode(code);
      setLinkModalOpen(true);
    }
  };

  // Función para continuar con la creación de un nuevo producto (se llama desde el modal Link)
  const openNewProductWithBarcode = async (code) => {
      if (!isAdmin) return; // crear productos es solo del Administrador (P22-10, D1)
      setLinkModalOpen(false);
      toast.info('Buscando detalles del producto...');
      const apiData = await fetchProductFromOpenFoodFacts(code);
      
      setFormData({
        id_producto: '',
        codigo: '',
        codigo_barras: code,
        nombre_producto: apiData ? apiData.nombre_producto : '',
        categoria: apiData ? apiData.categoria : '',
        subcategoria: '',
        tipo_producto: '',
        precio_unitario: '',
        cantidad: '',
        stock_minimo: '5',
        stock_seguridad: '0',
        lead_time: '3',
        fecha_vencimiento: '',
        id_proveedor: ''
      });
      
      setEditMode(false);
      setModalOpen(true);
      
      if (apiData) {
        toast.success('¡Datos autocompletados mágicamente!');
      } else {
        toast.info('Producto nuevo. Por favor ingresa los detalles.');
      }
  };

  // El scanner local de teclado llama a handleBarcodeScan
  useBarcodeScanner(handleBarcodeScan);

  const listRender = useMemo(() => {
    const filtered = productos.filter(p => {
      const matchText = p.nombre_producto.toLowerCase().includes(filtroTexto.toLowerCase()) || 
                        (p.codigo && p.codigo.toLowerCase().includes(filtroTexto.toLowerCase()));
      const matchCat = filtroCategoria === '' || p.categoria === filtroCategoria;
      const matchEst = filtroEstado === '' || p.estado === filtroEstado;
      return matchText && matchCat && matchEst;
    });

    return filtered.sort((a, b) => {
      if (a.estado !== b.estado) {
        return a.estado === 'Disponible' ? -1 : 1;
      }
      // Nivel calculado en el backend (plan 17): agotado (stock 0) / critico / reponer / ok.
      const pesos = { agotado: 1, critico: 2, reponer: 3, ok: 4 };
      const pesoA = pesos[a.nivel_stock] ?? 4;
      const pesoB = pesos[b.nivel_stock] ?? 4;

      if (pesoA !== pesoB) {
        return pesoA - pesoB;
      }
      return a.nombre_producto.localeCompare(b.nombre_producto);
    });
  }, [productos, filtroTexto, filtroCategoria, filtroEstado]);

  return {
    isAdmin,
    loading,
    loadError,
    recargarProductos: () => cargarProductos(),
    productos: listRender,
    categorias,
    alert,
    setAlert,
    
    // Filtros
    filtroTexto, setFiltroTexto,
    filtroCategoria, setFiltroCategoria,
    filtroEstado, setFiltroEstado,

    // Carga Masiva
    uploadLoading,
    handleFileUpload,

    // Modales de UI
    handleBarcodeScan,

    // Product Modal
    modalOpen, editMode, formLoading, formData, proveedores,
    handleOpenModal, handleCloseModal, handleSubmitProducto,

    // Modales eliminados (Venta, Stock) ya no se exportan

    // Toggle Modal
    toggleModalOpen, setToggleModalOpen, toggleProducto, setToggleProducto, toggleLoading, submitToggleEstado,

    // Sumar stock (Tendero)
    sumarStockProducto, setSumarStockProducto, sumarStockLoading, submitSumarStock,

    // Link Barcode Modal
    linkModalOpen, setLinkModalOpen, linkBarcodeCode, linkLoading, submitLinkBarcode, openNewProductWithBarcode,

    // Eliminar Modal
    eliminarModalOpen, setEliminarModalOpen, eliminarProductoSel, setEliminarProductoSel, eliminarLoading, submitEliminar
  };
};
