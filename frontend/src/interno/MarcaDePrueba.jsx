import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { api, mensajeDeError } from './api';

/** Marca o desmarca una tienda como «de prueba del equipo»: las métricas del piloto dejan de contarla. Pide confirmación. */
const MarcaDePrueba = ({ tienda, alCambiar }) => {
  const toast = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const nuevoValor = !tienda.es_prueba;

  const aplicar = async () => {
    setGuardando(true);
    try {
      await api.marcarPrueba(tienda.id_tienda, nuevoValor);
      toast.success(nuevoValor ? 'Tienda marcada como de prueba' : 'Tienda incluida de nuevo en las métricas');
      setConfirmando(false);
      alCambiar();
    } catch (err) {
      toast.error(mensajeDeError(err, 'No se pudo cambiar la marca.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <p className="text-sm font-bold text-slate-600 max-w-xl">
        {tienda.es_prueba
          ? 'Esta tienda está marcada como de prueba: NO cuenta en la activación, la adopción ni el embudo.'
          : 'Marca las tiendas del equipo (QA, demostración) como de prueba para que no inflen las métricas del piloto.'}
      </p>
      <button
        type="button" onClick={() => setConfirmando(true)}
        className="flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-slate-200 hover:border-azul text-tinta rounded-lg text-xs font-bold transition-colors"
      >
        <FlaskConical size={14} aria-hidden="true" /> {tienda.es_prueba ? 'Volver a contarla en el piloto' : 'Marcar como tienda de prueba'}
      </button>
      <ConfirmDialog
        isOpen={confirmando} icon="check" highlightColor="azul" loading={guardando}
        title={nuevoValor ? '¿Marcar como tienda de prueba?' : '¿Contarla de nuevo en el piloto?'}
        message={nuevoValor
          ? 'Dejará de contar en las métricas del piloto. Puedes revertirlo cuando quieras.'
          : 'Volverá a contar en la activación, la adopción y el embudo.'}
        highlightText={tienda.nombre} confirmText="Confirmar" onConfirm={aplicar} onCancel={() => setConfirmando(false)}
      />
    </div>
  );
};

export default MarcaDePrueba;
