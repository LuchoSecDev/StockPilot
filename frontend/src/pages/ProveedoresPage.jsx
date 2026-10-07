import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { useProveedoresPage } from '../hooks/useProveedoresPage';
import { useAuth } from '../context/AuthContext';

import ProveedorGrid from '../components/proveedores/ProveedorGrid';
import ProveedorFormModal from '../components/proveedores/ProveedorFormModal';
import SmartOrderModal from '../components/proveedores/SmartOrderModal';
import OrdenesHistory from '../components/proveedores/OrdenesHistory';
import PaymentModal from '../components/proveedores/PaymentModal';
import ConfirmDialog from '../components/common/ConfirmDialog';

const ProveedoresPage = () => {
  const { require2FA } = useAuth();
  const {
    proveedores, loading,
    showOrderModal, setShowOrderModal, selectedSupplier,
    forecastData, smartCart, setSmartCart, riskEval, isForecastLoading, isConsultingAI, isSubmitting,
    ordenesHistory, loadingHistory, showHistoryDetail, setShowHistoryDetail, ordenDetail,
    showSupplierModal, setShowSupplierModal, supplierFormData, setSupplierFormData,
    isEditingSupplier, supplierLoading, supplierToDelete, setSupplierToDelete,
    isSendingEmail, emailMessage, setEmailMessage,
    showPaymentModal, setShowPaymentModal, paymentData, manualAmount, setManualAmount, isPaying,
    
    fetchOrderDetail, submitFinalOrder, handleSendToSupplier,
    handleRegisterPayment, confirmPayment, handleOpenSupplierModal, handleSaveSupplier,
    handleDeleteSupplier, handleOpenForecast, requestCopilot, handleToggleItem, handleEditQty, handleUpdateEstado,
    savingItem, handleEditOrderItem, handleRemoveOrderItem, completandoOrden, handleCompletarRecepcion
  } = useProveedoresPage();

  // Desde el Consejero IA: /proveedores?orden=ID abre el detalle de ese borrador (una sola vez)
  const [searchParams] = useSearchParams();
  const ordenPedida = Number(searchParams.get('orden'));
  const yaAbierta = useRef(false);
  useEffect(() => {
    if (!ordenPedida || yaAbierta.current || loadingHistory) return;
    const orden = ordenesHistory.find((o) => o.id_orden === ordenPedida);
    if (orden) {
      yaAbierta.current = true;
      fetchOrderDetail(orden);
    }
  }, [ordenPedida, ordenesHistory, loadingHistory, fetchOrderDetail]);

  return (
    <div className="pb-32 space-y-8 animate-fade-in">
      
      {/* HEADER PREMIUM */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-azul/10 text-azul rounded-lg flex items-center justify-center shadow-inner border border-azul/30">
              <Building2 size={20} />
            </div>
            <h1 className="titular text-4xl text-tinta">Red de Proveedores</h1>
          </div>
          <p className="text-sm font-bold text-slate-500 max-w-xl">
            Gestiona tus compras apoyado en el Copiloto IA. Revisa qué productos necesitas pedir y genera tus órdenes de abastecimiento al instante.
          </p>
        </div>
        
        <button 
          onClick={() => {
            if (require2FA && require2FA('Debes configurar la autenticación 2FA antes de registrar proveedores.')) return;
            handleOpenSupplierModal();
          }}
          className="bg-azul hover:bg-azul-hondo text-white px-8 py-4 rounded-lg text-xs font-bold shadow-lg transition-colors transition-shadow transition-transform flex items-center gap-2 active:scale-95 z-20"
        >
          <Plus size={14} /> Registrar Proveedor
        </button>
      </div>

      <ProveedorGrid 
        proveedores={proveedores} 
        loading={loading} 
        onEdit={(p) => {
          if (require2FA && require2FA('Debes configurar la autenticación 2FA antes de editar proveedores.')) return;
          handleOpenSupplierModal(p);
        }} 
        onDelete={(p) => {
          if (require2FA && require2FA('Debes configurar la autenticación 2FA antes de inhabilitar proveedores.')) return;
          setSupplierToDelete(p);
        }} 
        onForecast={handleOpenForecast} 
      />

      <SmartOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        supplier={selectedSupplier}
        smartCart={smartCart}
        forecastData={forecastData}
        riskEval={riskEval}
        isForecastLoading={isForecastLoading}
        isConsultingAI={isConsultingAI}
        isSubmitting={isSubmitting}
        handleToggleItem={handleToggleItem}
        handleEditQty={handleEditQty}
        submitFinalOrder={submitFinalOrder}
        requestCopilot={requestCopilot}
        setSmartCart={setSmartCart}
      />

      <OrdenesHistory
        ordenesHistory={ordenesHistory}
        loadingHistory={loadingHistory}
        showHistoryDetail={showHistoryDetail}
        setShowHistoryDetail={setShowHistoryDetail}
        ordenDetail={ordenDetail}
        fetchOrderDetail={fetchOrderDetail}
        handleRegisterPayment={handleRegisterPayment}
        handleSendToSupplier={handleSendToSupplier}
        isSendingEmail={isSendingEmail}
        emailMessage={emailMessage}
        setEmailMessage={setEmailMessage}
        onUpdateEstado={handleUpdateEstado}
        savingItem={savingItem}
        onEditItem={handleEditOrderItem}
        onRemoveItem={handleRemoveOrderItem}
        completandoOrden={completandoOrden}
        onCompletarRecepcion={handleCompletarRecepcion}
      />

      <ProveedorFormModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSubmit={handleSaveSupplier}
        isEditing={isEditingSupplier}
        loading={supplierLoading}
        formData={supplierFormData}
        setFormData={setSupplierFormData}
      />

      <ConfirmDialog
        isOpen={!!supplierToDelete}
        title="¿Confirmas la baja?"
        message={<>Vas a inhabilitar a <span className="text-peligro">{supplierToDelete?.nombre_empresa}</span>. Se mantendrá el registro histórico pero no podrás vincularlo a nuevos productos.</>}
        highlightColor="rose"
        confirmText="Sí, inhabilitar ahora"
        cancelText="No, mantener activo"
        onConfirm={handleDeleteSupplier}
        onCancel={() => setSupplierToDelete(null)}
        loading={supplierLoading}
        icon="alert"
      />

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        paymentData={paymentData}
        manualAmount={manualAmount}
        setManualAmount={setManualAmount}
        isPaying={isPaying}
        confirmPayment={confirmPayment}
      />

    </div>
  );
};

export default ProveedoresPage;
