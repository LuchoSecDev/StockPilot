import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook para escuchar eventos de un lector de códigos de barras (pistola láser/USB).
 * 
 * @param {function} onScan - Callback que se ejecuta cuando se detecta un código válido.
 * @param {object} options - Opciones de configuración.
 * @param {number} options.delayThreshold - Tiempo máximo en milisegundos entre pulsaciones de tecla (default: 50ms).
 * @param {number} options.minLength - Longitud mínima del código para considerarlo válido (default: 4).
 */
const useBarcodeScanner = (onScan, options = {}) => {
  const { delayThreshold = 150, minLength = 4 } = options;
  
  const buffer = useRef('');
  const lastTimeStamp = useRef(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleKeyDown = useCallback((event) => {
    // Si el usuario está escribiendo en un input, textarea o un elemento con contenteditable, lo ignoramos.
    // Esto evita falsos positivos si alguien teclea muy rápido en un campo de texto normal.
    const activeElement = document.activeElement;
    if (activeElement) {
      const tagName = activeElement.tagName.toLowerCase();
      const isInput = tagName === 'input' || tagName === 'textarea';
      const isContentEditable = activeElement.isContentEditable;
      // Solo ignoramos si el input NO es de solo lectura.
      if ((isInput && !activeElement.readOnly) || isContentEditable) {
        return;
      }
    }

    const currentTime = event.timeStamp;
    
    // Si ha pasado mucho tiempo desde la última pulsación, reseteamos el buffer
    // ya que probablemente es un humano tecleando esporádicamente.
    if (lastTimeStamp.current && (currentTime - lastTimeStamp.current > delayThreshold)) {
      buffer.current = '';
    }

    lastTimeStamp.current = currentTime;

    // Cuando el escáner termina de leer, envía la tecla "Enter"
    if (event.key === 'Enter') {
      if (buffer.current.length >= minLength) {
        // Enviar el código capturado al callback
        if (onScanRef.current) {
          onScanRef.current(buffer.current);
        }
        // Prevenir el comportamiento por defecto del Enter (ej. enviar formularios accidentalmente)
        event.preventDefault();
      }
      buffer.current = '';
      return;
    }

    // Aceptamos cualquier carácter imprimible de longitud 1 (letras, números, símbolos)
    // Excluimos teclas de control (Shift, Control, Alt, Meta, etc.)
    if (event.key.length === 1) {
      buffer.current += event.key;
    }
  }, [delayThreshold, minLength]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

export default useBarcodeScanner;
