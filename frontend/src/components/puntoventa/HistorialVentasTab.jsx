import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { SYNC_EVENTS, subscribeToSync } from '../../utils/stockSync';
import { DollarSign, Package, Receipt, Trophy, Download, Rocket } from 'lucide-react';
import CustomDatePicker from '../CustomDatePicker';
import CustomSelect from '../CustomSelect';

const HistorialVentasTab = () => {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.rol === 'Administrador'; // exportar ventas es solo del Administrador (P22-10, D3)
  const [ventasOriginales, setVentasOriginales] = useState([]);
  const [statsServidor, setStatsServidor] = useState({ totalVentas: 0, totalProductos: 0, ventaPromedio: 0, productosUnicos: 0 });
  const [categorias, setCategorias] = useState([]);
  const [totalVentasServer, setTotalVentasServer] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroProducto, setFiltroProducto] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const [modalMasVendidos, setModalMasVendidos] = useState(false);
  const [topProductos, setTopProductos] = useState([]);

  const PAGE_SIZE = 100;

  const cargarVentasIniciales = useCallback(async (signal = null) => {
    setIsLoading(true);
    try {
      const [resVentas, resStats] = await Promise.all([
        axios.get(`/api/ventas?limit=${PAGE_SIZE}&offset=0`, { ...(signal && { signal }) }),
        axios.get('/api/ventas/stats', { ...(signal && { signal }) })
      ]);
      if (signal && signal.aborted) return;

      const dataVentas = resVentas.data.data || resVentas.data;
      const total = resVentas.data.total || dataVentas.length;

      setVentasOriginales(dataVentas);
      setTotalVentasServer(total);
      setCurrentOffset(dataVentas.length);
      setStatsServidor(resStats.data);

      const cats = Array.from(new Set(dataVentas.map(v => v.categoria)));
      setCategorias(cats);
    } catch (error) {
      if (axios.isCancel(error) || (signal && signal.aborted)) return;
      console.error('Error al cargar ventas iniciales', error);
    } finally {
      if (!signal || !signal.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    cargarVentasIniciales(controller.signal);

    const unsubscribe = subscribeToSync((event) => {
      if (event.type === SYNC_EVENTS.SALE_COMPLETED) {
        cargarVentasIniciales();
      }
    });

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [cargarVentasIniciales]);

  // TODO: paginación pendiente de conectar a un botón "cargar más" (hoy solo se carga la primera página).
  // eslint-disable-next-line no-unused-vars
  const cargarMasVentas = async () => {
    if (isLoading || currentOffset >= totalVentasServer) return;
    setIsLoading(true);
    try {
      const res = await axios.get(`/api/ventas?limit=${PAGE_SIZE}&offset=${currentOffset}`);
      const nuevasVentas = res.data.data || res.data;

      const combinadas = [...ventasOriginales, ...nuevasVentas];
      setVentasOriginales(combinadas);
      setCurrentOffset(prev => prev + nuevasVentas.length);

      const cats = Array.from(new Set(combinadas.map(v => v.categoria)));
      setCategorias(cats);
    } catch (error) {
      console.error('Error al cargar más ventas', error);
    } finally {
      setIsLoading(false);
    }
  };

  const ventasFiltradas = useMemo(() => {
    return ventasOriginales.filter(v => {
      const fechaStr = v.fecha_salida ? new Date(v.fecha_salida).toISOString().slice(0, 10) : '';
      return (
        (filtroFecha === '' || fechaStr.startsWith(filtroFecha)) &&
        (filtroProducto === '' || (v.nombre_producto || '').toLowerCase().includes(filtroProducto.toLowerCase())) &&
        (filtroCategoria === '' || v.categoria === filtroCategoria)
      );
    });
  }, [ventasOriginales, filtroFecha, filtroProducto, filtroCategoria]);

  const statsRender = useMemo(() => {
    if (filtroFecha || filtroProducto || filtroCategoria) {
      const totalVts = ventasFiltradas.reduce((sum, v) => sum + Number(v.precio_total), 0);
      const totalProds = ventasFiltradas.reduce((sum, v) => sum + Number(v.cantidad), 0);
      const vPromedio = ventasFiltradas.length ? totalVts / ventasFiltradas.length : 0;
      const pUnicos = new Set(ventasFiltradas.map(v => v.nombre_producto)).size;
      return { totalVentas: totalVts, totalProductos: totalProds, ventaPromedio: vPromedio, productosUnicos: pUnicos };
    }
    return statsServidor;
  }, [ventasFiltradas, statsServidor, filtroFecha, filtroProducto, filtroCategoria]);

  const formatearFecha = (fechaString) => {
    if (!fechaString) return '---';
    const fecha = new Date(fechaString);
    if (isNaN(fecha.getTime())) return '---';
    return fecha.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const abrirTopVendidos = async () => {
    try {
      const response = await axios.get('/api/ia/snapshot');
      const dataFull = response.data.data || [];

      if (dataFull.length === 0) {
        setTopProductos([]);
        setModalMasVendidos(true);
        return;
      }

      const maxRev = Math.max(...dataFull.map(item => item.revenue));
      const maxVel = Math.max(...dataFull.map(item => item.velocity));

      const ordenados = dataFull
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)
        .map(item => ({
          nombre: item.nombre,
          cantidad: Math.round(item.velocity * 30),
          total: item.revenue,
          categoria: item.category === 'A' ? 'Prioridad Alta' : (item.category === 'B' ? 'Prioridad Media' : 'Baja Rotación'),
          isTopRevenue: item.revenue === maxRev,
          isHighRotation: item.velocity === maxVel
        }));
      
      setTopProductos(ordenados);
      setModalMasVendidos(true);
    } catch {
      toast.error('No se pudo sincronizar el ranking con el motor IA');
    }
  };

  const exportarCSV = async () => {
    try {
      const response = await axios.post('/api/exportar/ventas');
      if (response.data.success) {
        window.location.href = `/api/exportar/descargar/${response.data.filename}`;
      }
    } catch {
      toast.error('Error al exportar ventas: Valida tu sesión.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: 'Ingresos Totales', value: `$${statsRender.totalVentas.toLocaleString('es-CO')}`, icon: <DollarSign size={28} />, color: 'text-exito', bg: 'bg-emerald-50' },
          { label: 'Productos Vendidos', value: statsRender.totalProductos.toLocaleString('es-CO'), icon: <Package size={28} />, color: 'text-azul', bg: 'bg-azul/10' },
          { label: 'Venta Promedio', value: `$${statsRender.ventaPromedio.toLocaleString('es-CO', {maximumFractionDigits:0})}`, icon: <Receipt size={28} />, color: 'text-aviso', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 flex items-center gap-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${stat.bg} ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-500 mb-1">{stat.label}</p>
              <h3 className={`titular text-2xl ${stat.color}`}>{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-between items-center">
        <div className="flex flex-col sm:flex-row w-full sm:w-auto flex-1 gap-3 sm:gap-4">
          <div className="w-full sm:flex-1 sm:max-w-[200px]">
            <CustomDatePicker
              value={filtroFecha}
              onChange={v => setFiltroFecha(v)}
              placeholder="Filtrar fecha..."
              align="left-flyout"
            />
          </div>
          <input
            type="text"
            placeholder="Buscar producto..."
            value={filtroProducto}
            onChange={e => setFiltroProducto(e.target.value)}
            className="w-full sm:flex-[2] p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold focus:border-azul outline-none"
          />
          <CustomSelect
            value={filtroCategoria}
            onChange={val => setFiltroCategoria(val)}
            placeholder="Todas las categorías"
            options={[
              { value: '', label: 'Todas las categorías' },
              ...categorias.map(c => ({ value: c, label: c }))
            ]}
            className="w-full sm:flex-1 sm:max-w-[220px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus-within:border-azul"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={abrirTopVendidos} className="flex-1 sm:flex-none bg-azul/10 hover:bg-azul-hondo text-azul hover:text-white py-4 px-6 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2">
            <Trophy size={16} /> Top
          </button>
          {isAdmin && (
            <button onClick={exportarCSV} className="flex-1 sm:flex-none bg-exito hover:bg-emerald-700 text-white py-4 px-6 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2">
               <Download size={16} /> Reporte
            </button>
          )}
        </div>
      </div>

      {/* Tabla Historial */}
      <div className="bg-white/70 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-menu text-xs font-bold text-white whitespace-nowrap">
                <th className="p-4 md:p-8">Producto</th>
                <th className="hidden lg:table-cell p-4 md:p-8">Categoría</th>
                <th className="p-4 md:p-8 text-center">Unidades</th>
                <th className="hidden sm:table-cell p-4 md:p-8 text-right">Precio</th>
                <th className="p-4 md:p-8 text-right">Total</th>
                <th className="p-4 md:p-8 text-center">Vendedor</th>
                <th className="hidden md:table-cell p-4 md:p-8 text-center">Fecha</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-50">
              {isLoading && ventasFiltradas.length === 0 ? (
                <tr><td colSpan="7" className="p-32 text-center text-slate-500 font-bold animate-pulse">Consultando Registros...</td></tr>
              ) : ventasFiltradas.length === 0 ? (
                <tr><td colSpan="7" className="p-32 text-center text-slate-500 font-bold">No hay transacciones.</td></tr>
              ) : (
                ventasFiltradas.map((v, idx) => {
                  const precioUnitario = v.precio_unitario || (v.precio_total / v.cantidad);
                  return (
                    <tr key={v.id_venta ? `${v.id_venta}-${idx}` : idx} className="hover:bg-azul/10">
                       <td className="p-8">
                         <p className="font-bold text-tinta text-sm">{v.nombre_producto}</p>
                         <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                           <span>{v.id_venta ? `VENTA #${String(v.id_venta).padStart(6, '0')}` : '---'}</span>
                           <span className="text-azul font-bold sm:hidden">• {v.nombre_vendedor || 'Admin'}</span>
                         </p>
                       </td>
                      <td className="hidden lg:table-cell p-8">
                         <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{v.categoria || 'S/N'}</span>
                      </td>
                      <td className="p-8 text-center font-bold text-tinta text-xl">{v.cantidad}</td>
                      <td className="hidden sm:table-cell p-8 text-right font-bold text-slate-500">${Number(precioUnitario).toLocaleString('es-CO')}</td>
                      <td className="p-8 text-right text-exito font-bold text-xl">${Number(v.precio_total).toLocaleString('es-CO')}</td>
                      <td className="p-8 text-center font-bold text-tinta-2 text-xs">
                         <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-tinta-2 rounded-2xl text-xs font-bold">
                           {v.nombre_vendedor || 'Admin'}
                         </span>
                      </td>
                      <td className="hidden md:table-cell p-8 text-center font-bold text-slate-600 text-xs">{formatearFecha(v.fecha_salida)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Top Vendidos */}
      {modalMasVendidos && (
        <div className="fixed inset-0 bg-tinta/45 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-lg overflow-hidden animate-scale-in">
            <div className="flex justify-between items-center p-8 border-b border-slate-100 bg-white">
              <div>
                 <h3 className="titular text-2xl text-tinta flex items-center gap-2"><Rocket size={24} /> Top Productos</h3>
              </div>
              <button onClick={() => setModalMasVendidos(false)} className="w-12 h-12 bg-slate-100 text-slate-500 rounded-lg hover:bg-peligro-suave hover:text-peligro flex items-center justify-center text-2xl transition-colors">&times;</button>
            </div>
            <div className="p-8 overflow-y-auto space-y-4">
              {topProductos.map((item, idx) => (
                  <div key={item.nombre} className="flex flex-col sm:flex-row justify-between items-center p-6 bg-slate-50 rounded-2xl border border-slate-100 gap-4">
                    <div className="flex items-center gap-6 w-full sm:w-auto">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl ${idx === 0 ? 'bg-aviso-suave text-aviso scale-110' : 'bg-slate-200 text-slate-600'}`}>
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                         <p className="font-bold text-tinta text-lg truncate">{item.nombre}</p>
                         <p className="text-xs font-bold text-slate-500">{item.categoria}</p>
                      </div>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto border-t border-slate-200 sm:border-0 pt-4 sm:pt-0">
                      <div className="font-bold text-tinta text-lg">{item.cantidad} <span className="text-xs text-slate-500">Und</span></div>
                      <div className="font-bold text-exito text-sm mt-1">${item.total.toLocaleString('es-CO')}</div>
                    </div>
                  </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistorialVentasTab;
