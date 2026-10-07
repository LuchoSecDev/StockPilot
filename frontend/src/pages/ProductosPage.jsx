import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Plus, UploadCloud, ScanBarcode } from 'lucide-react';

import { useProductosPage } from '../hooks/useProductosPage';
import CustomSelect from '../components/CustomSelect';
import ConfirmDialog from '../components/common/ConfirmDialog';
import ProductTable from '../components/productos/ProductTable';
import ProductFormModal from '../components/productos/ProductFormModal';
import PromoManualModal from '../components/productos/PromoManualModal';
import SumarStockModal from '../components/productos/SumarStockModal';
import { useState } from 'react';
import { SYNC_EVENTS, emitSyncEvent } from '../utils/stockSync';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const ProductosPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const toast = useToast();
  const { require2FA } = useAuth();
  
  const {
    isAdmin, loading, loadError, recargarProductos, productos, categorias, alert, setAlert,
    filtroTexto, setFiltroTexto, filtroCategoria, setFiltroCategoria, filtroEstado, setFiltroEstado,
    uploadLoading, handleFileUpload,
    modalOpen, editMode, formLoading, formData, proveedores, handleOpenModal, handleCloseModal, handleSubmitProducto,
    toggleModalOpen, setToggleModalOpen, toggleProducto, setToggleProducto, toggleLoading, submitToggleEstado,
    sumarStockProducto, setSumarStockProducto, sumarStockLoading, submitSumarStock,
    linkModalOpen, setLinkModalOpen, linkBarcodeCode, submitLinkBarcode, openNewProductWithBarcode,
    eliminarModalOpen, setEliminarModalOpen, eliminarProductoSel, setEliminarProductoSel, eliminarLoading, submitEliminar
  } = useProductosPage();

  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [promoProducto, setPromoProducto] = useState(null);

  const handleOpenPromo = (producto) => {
    if (require2FA && require2FA('Debes configurar la autenticación 2FA antes de activar ofertas.')) return;
    setPromoProducto(producto);
    setPromoModalOpen(true);
  };

  const handlePromoSuccess = () => {
    setPromoModalOpen(false);
    toast.success(`¡Promoción aplicada! La IA registró tu decisión.`);
    
    // Trigger un refetch de los productos disparando el evento de sincronización en lugar de recargar la página.
    if (promoProducto?.id_producto) {
      emitSyncEvent(SYNC_EVENTS.PRODUCT_MODIFIED, { id: promoProducto.id_producto });
    }
  };

  return (
    <div className="animate-fade-in pb-12 space-y-8">
      {/* Alerta Global Premium */}
      {alert.show && (
        <button 
          type="button"
          onClick={() => navigate('/alertas')}
          className={`w-full text-left group relative flex flex-col md:flex-row items-center gap-6 p-8 rounded-lg mb-10 shadow-lg border animate-fade-in cursor-pointer transition-colors transition-transform transition-shadow transform outline-none focus:ring-4 focus:ring-azul/50 ${alert.isCritical ? 'bg-rose-50/80 border-peligro-suave text-rose-800' : 'bg-amber-50/80 border-aviso-suave text-amber-800'}`}
        >
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border-2 ${alert.isCritical ? 'bg-peligro-suave border-white text-peligro' : 'bg-aviso-suave border-white text-aviso rotate-12'}`}>
            {alert.isCritical ? <AlertCircle size={32} /> : <AlertTriangle size={32} />}
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="titular text-xl mb-1">{alert.title}</h4>
            <p className="font-bold text-sm opacity-80 leading-relaxed max-w-2xl">{alert.message}</p>
          </div>
          <div className="flex items-center gap-4">
             <span className="hidden md:inline-block text-xs font-bold bg-white/50 px-4 py-2 rounded-2xl">Revisar Ahora →</span>
             <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setAlert({ ...alert, show: false }); }} 
                className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors transition-transform font-bold text-2xl active:scale-90 outline-none focus:ring-2 focus:ring-azul/30"
                title="Cerrar"
                aria-label="Cerrar alerta"
             >
                &times;
             </button>
          </div>
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-6 md:pb-8">
        <div>
          <h2 className="titular text-2xl sm:text-3xl md:text-4xl text-tinta">Tus Productos</h2>
          <p className="text-slate-500 font-bold text-xs mt-1">Listado completo de lo que vendes</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <input 
                type="file" 
                accept=".csv, .xlsx" 
                style={{ display: 'none' }} 
                ref={fileInputRef} 
                onChange={(e) => handleFileUpload(e.target.files[0])} 
              />
              <button 
                onClick={() => {
                  if (require2FA && require2FA('Debes configurar la autenticación 2FA antes de importar productos.')) return;
                  fileInputRef.current?.click();
                }} 
                disabled={uploadLoading}
                className={`bg-white hover:bg-slate-50 text-azul border border-azul/30 py-3 px-6 rounded-lg text-xs font-bold shadow-sm transition-colors transition-transform transition-shadow flex items-center gap-2 active:scale-95 ${uploadLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <UploadCloud size={14} /> {uploadLoading ? 'Cargando...' : 'Importar'}
              </button>
              <button onClick={() => handleOpenModal()} className="bg-azul hover:bg-azul-hondo text-white py-3 px-6 rounded-lg text-xs font-bold shadow-lg transition-colors transition-transform transition-shadow flex items-center gap-2 active:scale-95">
                <Plus size={14} /> Registrar Producto
              </button>
            </>
          )}
        </div>
      </div>

      {/* Top Bar (Filtros) */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
          <input type="text" aria-label="Buscar código o nombre" placeholder="Buscar código o nombre..." value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)} className="w-full sm:flex-1 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:border-azul outline-none" />
          <CustomSelect
            value={filtroCategoria}
            onChange={val => setFiltroCategoria(val)}
            placeholder="Todas las categorías"
            options={[
              { value: '', label: 'Todas las categorías' },
              ...categorias.map(c => ({ value: c, label: c }))
            ]}
            className="w-full sm:flex-1 sm:min-w-[160px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus-within:border-azul text-tinta"
          />
          <CustomSelect
            value={filtroEstado}
            onChange={val => setFiltroEstado(val)}
            placeholder="Estado: Todos"
            options={[
              { value: '', label: 'Estado: Todos' },
              { value: 'Disponible', label: 'Operativo' },
              { value: 'Inactivo', label: 'Suspendido' }
            ]}
            className="w-full sm:flex-1 sm:min-w-[140px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus-within:border-azul text-tinta"
          />
      </div>

      <ProductTable
        productos={productos}
        loading={loading}
        loadError={loadError}
        onRetry={recargarProductos}
        isAdmin={isAdmin}
        onEdit={(p) => handleOpenModal(p)}
        onToggleStatus={(p) => {
          if (require2FA && require2FA('Debes configurar la autenticación 2FA antes de cambiar el estado de un producto.')) return;
          setToggleProducto(p);
          setToggleModalOpen(true);
        }}
        onDelete={(p) => {
          if (require2FA && require2FA('Debes configurar la autenticación 2FA antes de eliminar productos.')) return;
          setEliminarProductoSel(p);
          setEliminarModalOpen(true);
        }}
        onPromote={handleOpenPromo}
      />

      <ProductFormModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmitProducto}
        initialData={formData}
        editMode={editMode}
        isAdmin={isAdmin}
        proveedores={proveedores}
        loading={formLoading}
        categorias={categorias}
        productos={productos}
      />

      {/* Modal de Vinculación de Código de Barras */}
      {linkModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-tinta/45 backdrop-blur-sm" onClick={() => setLinkModalOpen(false)}></div>
          <div className="bg-white rounded-2xl p-6 md:p-8 w-full max-w-lg shadow-lg relative z-10 animate-scale-in">
             <h3 className="titular text-2xl text-tinta mb-4">Código Escaneado</h3>
             <p className="text-slate-600 font-bold mb-6">Hemos detectado el código <span className="bg-slate-100 text-tinta px-2 py-1 rounded font-mono">{linkBarcodeCode}</span>, pero no está registrado.</p>
             
             <div className="space-y-4">
                {isAdmin ? (
                  <>
                  <button onClick={() => openNewProductWithBarcode(linkBarcodeCode)} className="w-full text-left p-4 rounded-lg border-2 border-azul/30 bg-azul/10 hover:bg-azul/10 hover:border-azul/30 transition-colors group">
                     <h4 className="font-bold text-azul text-sm mb-1 group-hover:text-azul">Crear Producto Nuevo</h4>
                     <p className="text-xs font-bold text-azul">Usar este EAN para registrar un artículo que no existe en el sistema.</p>
                  </button>
                
                  <div className="relative flex items-center py-2">
                     <div className="flex-grow border-t border-slate-200"></div>
                     <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-bold">O Vincular</span>
                     <div className="flex-grow border-t border-slate-200"></div>
                  </div>
                  </>
                ) : (
                  <p role="note" className="p-4 rounded-2xl border-2 border-aviso-suave bg-amber-50/60 text-xs font-bold text-amber-800 leading-relaxed">
                    Este producto es nuevo. Pídele al administrador que lo registre. Si ya existe con otro código, vincúlalo abajo.
                  </p>
                )}

                <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50">
                   <label className="block text-xs font-semibold text-slate-600 ml-1 mb-2">Selecciona un producto existente</label>
                   <CustomSelect
                      value=""
                      onChange={(val) => {
                         if(val) submitLinkBarcode(val, linkBarcodeCode);
                      }}
                      placeholder="Buscar producto..."
                      options={[
                        { value: '', label: 'Seleccione para vincular...' },
                        ...productos.map(p => ({ value: p.id_producto, label: `${p.nombre_producto} (SKU: ${p.codigo})` }))
                      ]}
                      className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus-within:border-azul text-tinta"
                   />
                   <p className="text-xs text-slate-500 mt-2 font-bold leading-tight">Asignará el EAN escaneado al producto seleccionado para futuros escaneos.</p>
                </div>
             </div>
             
             <button onClick={() => setLinkModalOpen(false)} className="w-full mt-6 py-3 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={toggleModalOpen}
        title="Estado del Producto"
        message={<>Vas a cambiar a estado <strong className={`${toggleProducto?.estado === 'Disponible' ? 'text-aviso' : 'text-exito'}`}>{toggleProducto?.estado === 'Disponible' ? 'Pausado' : 'Activo'}</strong> el siguiente producto:</>}
        highlightText={toggleProducto?.nombre_producto}
        highlightColor={toggleProducto?.estado === 'Disponible' ? 'amber' : 'emerald'}
        confirmText={toggleProducto?.estado === 'Disponible' ? 'Confirmar Pausa' : 'Confirmar Reactivación'}
        onConfirm={submitToggleEstado}
        onCancel={() => setToggleModalOpen(false)}
        loading={toggleLoading}
        icon={toggleProducto?.estado === 'Disponible' ? 'pause' : 'check'}
      />

      <ConfirmDialog
        isOpen={eliminarModalOpen}
        title="Eliminar Producto"
        message={<>Vas a eliminar permanentemente este producto. Esta acción <span className="text-peligro font-bold underline decoration-2 underline-offset-2">no se puede deshacer</span>.</>}
        highlightText={eliminarProductoSel?.nombre_producto}
        highlightColor="rose"
        confirmText="Borrar Definitivamente"
        onConfirm={submitEliminar}
        onCancel={() => setEliminarModalOpen(false)}
        loading={eliminarLoading}
        icon="trash"
      />

      <SumarStockModal
        isOpen={!!sumarStockProducto}
        onClose={() => setSumarStockProducto(null)}
        producto={sumarStockProducto}
        onSubmit={submitSumarStock}
        loading={sumarStockLoading}
      />

      <PromoManualModal
        isOpen={promoModalOpen}
        onClose={() => setPromoModalOpen(false)}
        product={promoProducto}
        onPromoSuccess={handlePromoSuccess}
      />
    </div>
  );
};

export default ProductosPage;
