import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import { SYNC_EVENTS, emitSyncEvent } from '../../utils/stockSync';
import { DollarSign, Search, Minus, Plus, X, CreditCard, ShoppingCart } from 'lucide-react';
import useBarcodeScanner from '../../hooks/useBarcodeScanner';
import { useReactToPrint } from 'react-to-print';
import PaymentModal from '../PaymentModal';
import TicketPrinter from '../TicketPrinter';
import ExpenseModal from '../ExpenseModal';

const CajaRapidaTab = ({ isSessionActive, setIsCashRegisterOpen, user }) => {
  const toast = useToast();
  const [cart, setCart] = useState([]);
  const [loadingPay, setLoadingPay] = useState(false);
  
  // Payment and Ticket State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const ticketRef = useRef();

  // Expense State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
    documentTitle: 'Ticket_Venta',
    onAfterPrint: () => {
       setTicketData(null);
       setCart([]);
    }
  });

  // Nuevo estado para búsqueda predictiva
  const [allProducts, setAllProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    // Cargar todos los productos al montar la pestaña para la búsqueda rápida
    const fetchProducts = async () => {
      try {
        const { data } = await axios.get('/api/productos');
        setAllProducts(data);
      } catch (error) {
        console.error("Error al cargar productos para búsqueda", error);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return allProducts.filter(p => 
      p.nombre_producto?.toLowerCase().includes(term) || 
      (p.codigo && p.codigo.toLowerCase().includes(term))
    ).slice(0, 8); // Limitar a 8 resultados para no saturar la pantalla
  }, [searchTerm, allProducts]);

  const addToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id_producto === product.id_producto);
      if (existing) {
        if (existing.cantidadCart + 1 > product.cantidad) {
          toast.error('Stock insuficiente en bodega.');
          return prev;
        }
        return prev.map(item => item.id_producto === product.id_producto ? { ...item, cantidadCart: item.cantidadCart + 1 } : item);
      }
      if (product.cantidad < 1) {
        toast.error('Producto agotado.');
        return prev;
      }
      return [{ ...product, cantidadCart: 1 }, ...prev];
    });
  }, [toast]);

  const handleSelectProduct = (product) => {
    if (product.estado !== 'Disponible') {
      toast.error(`El producto ${product.nombre_producto} no está disponible.`);
      return;
    }
    addToCart(product);
    toast.success(`Añadido: ${product.nombre_producto}`);
    setSearchTerm('');
    setShowResults(false);
  };

  // Escanear código de barras para añadir al carrito
  const handleBarcodeScan = useCallback(async (code) => {
    if (!code) return;
    try {
      // Buscar en el backend el producto por barcode o SKU
      const res = await axios.get(`/api/productos/barcode/${code}`);
      const product = res.data.data;
      if (product) {
        if (product.estado !== 'Disponible') {
          toast.error(`El producto ${product.nombre_producto} no está disponible.`);
          return;
        }
        addToCart(product);
        toast.success(`Añadido: ${product.nombre_producto}`);
      }
    } catch {
      toast.error('Producto no encontrado en la base de datos.');
    }
  }, [toast, addToCart]);

  useBarcodeScanner(handleBarcodeScan);

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id_producto === id) {
        const newQ = item.cantidadCart + delta;
        if (newQ > item.cantidad) {
          toast.error('Stock insuficiente.');
          return item;
        }
        if (newQ < 1) return item;
        return { ...item, cantidadCart: newQ };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id_producto !== id));
  };

  const cartTotal = cart.reduce((acc, item) => acc + ((item.precio || item.precio_unitario || 0) * item.cantidadCart), 0);
  const cartItemsCount = cart.reduce((acc, item) => acc + item.cantidadCart, 0);
  const totalCart = cartTotal;

  const handleOpenPayment = () => {
    if (!isSessionActive) {
      toast.error('Debes abrir la caja antes de poder cobrar.');
      setIsCashRegisterOpen(true);
      return;
    }
    if (cart.length === 0) return;
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async (paymentDetails) => {
    setLoadingPay(true);
    try {
      const items = cart.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidadCart }));
      const payload = { 
        items, 
        metodo_pago: paymentDetails.metodo_pago, 
        efectivo_recibido: paymentDetails.efectivo_recibido,
        id_cliente: paymentDetails.id_cliente
      };
      const response = await axios.post('/api/registrar-venta-carrito', payload);
      toast.success('Venta procesada exitosamente.');
      setIsPaymentModalOpen(false);
      
      // Emitir eventos
      items.forEach(i => emitSyncEvent(SYNC_EVENTS.SALE_COMPLETED, { id: i.id_producto }));
      
      // Preparar e imprimir ticket
      setTicketData({
        items: cart,
        total: totalCart,
        id_venta: response.data.id_venta,
        metodo_pago: paymentDetails.metodo_pago,
        efectivo_recibido: paymentDetails.efectivo_recibido,
        cambio_devuelto: paymentDetails.efectivo_recibido >= totalCart ? paymentDetails.efectivo_recibido - totalCart : 0,
        id_cliente: paymentDetails.id_cliente,
        fecha: new Date()
      });
      setTimeout(() => {
        handlePrint();
      }, 500);

    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al procesar la venta.');
    } finally {
      setLoadingPay(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Columna Izquierda: Escaneo y Carrito */}
      <div className="lg:col-span-2 space-y-6">
        {/* Acciones de escaneo y búsqueda */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between relative z-20">
           <div className="flex-1 w-full relative">
             <h3 className="titular text-xl text-tinta mb-2">Buscar o Escanear Producto</h3>
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                 <Search size={18} className="text-slate-400" />
               </div>
               <input
                 type="text"
                 placeholder="Escribe el nombre o código, o escanea..."
                 className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-tinta-2 focus:outline-none focus:border-azul focus:ring-2 focus:ring-azul/30 transition-all"
                 value={searchTerm}
                 onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowResults(true);
                 }}
                 onFocus={() => setShowResults(true)}
                 onBlur={() => setTimeout(() => setShowResults(false), 200)}
               />
               
               {/* Dropdown de resultados */}
               {showResults && searchTerm && (
                 <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden max-h-64 overflow-y-auto">
                   {filteredProducts.length > 0 ? (
                     filteredProducts.map(p => (
                       <button
                         key={p.id_producto}
                         onMouseDown={() => handleSelectProduct(p)}
                         className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 flex justify-between items-center transition-colors"
                       >
                         <div>
                           <p className="font-bold text-tinta-2 text-sm">{p.nombre_producto}</p>
                           <p className="text-xs text-slate-500">{p.codigo || 'SIN CÓDIGO'} • Stock: {p.cantidad}</p>
                         </div>
                         <span className="font-bold text-azul">${Number(p.precio_venta || p.precio_unitario || p.precio || 0).toLocaleString('es-CO')}</span>
                       </button>
                     ))
                   ) : (
                     <div className="px-4 py-6 text-center text-slate-500 text-sm font-bold">
                       No se encontraron productos
                     </div>
                   )}
                 </div>
               )}
             </div>
           </div>
           <div className="flex w-full sm:w-auto gap-2 mt-auto">
             <button 
               type="button"
               onClick={() => {
                 if (!isSessionActive) {
                   toast.error('Debes abrir la caja antes de registrar un egreso.');
                   setIsCashRegisterOpen(true);
                   return;
                 }
                 setIsExpenseModalOpen(true);
               }} 
               className="w-full sm:w-auto h-12 bg-rose-50 hover:bg-rose-500 text-peligro hover:text-white border border-peligro-suave px-4 rounded-lg text-xs font-bold shadow-sm transition-colors transition-transform flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap"
             >
               <DollarSign size={16} /> Egreso
             </button>
           </div>
        </div>

        {/* Tabla Carrito */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
           <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
             <h3 className="font-bold text-tinta-2">Items Actuales</h3>
             <span className="bg-azul/10 text-azul px-3 py-1 rounded-full text-xs font-bold">{cart.length} Productos</span>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 mt-20">
                  <ShoppingCart size={48} className="opacity-20" />
                  <p className="font-bold text-xs">El carrito está vacío</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id_producto} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow gap-4">
                     <div className="flex-1 w-full">
                       <p className="font-bold text-tinta text-sm">{item.nombre_producto}</p>
                       <p className="text-xs font-bold text-slate-500">Stock disponible: {item.cantidad}</p>
                     </div>
                     <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-2">
                       <p className="font-bold text-azul text-lg">${Number(item.precio || item.precio_unitario || 0).toLocaleString('es-CO')}</p>
                       <div className="flex items-center bg-slate-50 rounded-2xl border border-slate-200">
                          <button onClick={() => updateQuantity(item.id_producto, -1)} className="p-2 text-slate-500 hover:text-rose-500 transition-colors"><Minus size={16} /></button>
                          <span className="w-8 text-center font-bold text-tinta-2">{item.cantidadCart}</span>
                          <button onClick={() => updateQuantity(item.id_producto, 1)} className="p-2 text-slate-500 hover:text-emerald-500 transition-colors"><Plus size={16} /></button>
                       </div>
                       <p className="font-bold text-exito text-lg min-w-[100px] max-sm:min-w-0 text-right">${((item.precio || item.precio_unitario || 0) * item.cantidadCart).toLocaleString('es-CO')}</p>
                       <button onClick={() => removeFromCart(item.id_producto)} className="p-2 text-rose-300 hover:text-peligro bg-rose-50 rounded-lg transition-colors max-sm:ml-auto"><X size={16} /></button>
                     </div>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>

      {/* Columna Derecha: Resumen de Pago */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 flex flex-col text-tinta relative overflow-hidden">
         {/* Fondo decorativo */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
         
         <div className="flex justify-between items-center mb-8 relative z-10">
           <h2 className="titular text-3xl text-tinta">Resumen</h2>
         </div>
         
         <div className="flex-1 space-y-6 relative z-10">
           <div className="flex justify-between items-center pb-4 border-b border-slate-100">
             <span className="text-slate-500 font-bold text-xs">Subtotal</span>
             <span className="font-bold text-xl text-tinta">${cartTotal.toLocaleString('es-CO')}</span>
           </div>
           <div className="flex justify-between items-center pb-4 border-b border-slate-100">
             <span className="text-slate-500 font-bold text-xs">Total Items</span>
             <span className="font-bold text-xl text-tinta">{cartItemsCount}</span>
           </div>
           <div className="flex justify-between items-center pt-4">
             <span className="text-slate-600 font-bold text-sm">Total a Pagar</span>
             <span className="font-bold text-4xl text-exito">${cartTotal.toLocaleString('es-CO')}</span>
           </div>
         </div>

         <div className="mt-8 relative z-10">
           <button 
             onClick={handleOpenPayment}
             disabled={cart.length === 0 || loadingPay}
             className="w-full bg-resaltador hover:bg-resaltador-hondo text-tinta ring-1 ring-tinta/25 disabled:bg-slate-200 disabled:text-slate-500 disabled:ring-0 disabled:cursor-not-allowed p-5 rounded-lg font-bold flex items-center justify-center gap-3 transition-colors active:scale-95 shadow-lg"
           >
             {loadingPay ? 'Procesando...' : <><CreditCard size={20} /> Cobrar</>}
           </button>
         </div>
      </div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        total={totalCart}
        onConfirm={handleConfirmPayment}
        loading={loadingPay}
        user={user}
      />

      <TicketPrinter 
        ref={ticketRef}
        ticketData={ticketData}
      />

      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onExpenseRegistered={() => {
            // Se puede agregar lógica opcional aquí después de registrar el gasto
        }}
        user={user}
      />
    </div>
  );
};

export default CajaRapidaTab;
