import { useState, useEffect, useCallback } from 'react';
import { mensajeDeError } from './api';

/**
 * Carga datos al montar y cuando cambien las dependencias, sin pisar una respuesta nueva con una vieja
 * (si cambian las dependencias a mitad de camino, la respuesta anterior se descarta).
 * @param {() => Promise<any>} cargar
 * @param {Array} dependencias
 * @returns {{datos: any, error: string|null, cargando: boolean, recargar: () => void}}
 */
export function useCarga(cargar, dependencias = []) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((previo) => ({ ...previo, cargando: true, error: null }));
    cargar()
      .then((datos) => { if (vigente) setEstado({ datos, error: null, cargando: false }); })
      .catch((err) => { if (vigente) setEstado({ datos: null, error: mensajeDeError(err, 'No se pudo cargar la información.'), cargando: false }); });
    return () => { vigente = false; };
    // `cargar` es una función nueva en cada render: lo que cuenta son las dependencias que pasa quien llama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  return { ...estado, recargar };
}
