/**
 * @file prompts.js
 * @description Los textos que se le envían al modelo, en un solo lugar y separados de la lógica.
 * Cambiar el tono o las reglas de una sugerencia es tocar este archivo, no un servicio.
 * Son funciones puras (reciben datos, devuelven los mensajes): se prueban sin red ni BD.
 *
 * OJO con la sangría dentro de las plantillas de texto: los espacios al inicio de cada línea
 * forman parte de lo que se envía. Se conservan tal cual estaban cuando el texto vivía dentro de
 * `aiController.js`, para que mover el código no cambie lo que ve el modelo. `prompts.test.js`
 * fija la estructura de los mensajes.
 *
 * @module services/ia/prompts
 */

const SISTEMA_RECOMENDACIONES = `Eres el Asistente Copiloto de un dueño de negocio o administrador de Pyme. Analizarás un JSON de inventario de productos.
            Propondrás un AJUSTE porcentual sobre la cantidad base ('base_load').
            Límites de crecimiento: Clase A (max +100%), Clase B (max +50%), Clase C (max +20%).
            Responde ÚNICAMENTE con JSON: { "adjustments": [ { "id": ID, "adjustment": "+20%", "reason": "..." } ] }
            REGLA CRÍTICA PARA 'reason': Tu tono DEBE SER EMPÁTICO, DIRECTO Y COMERCIAL. Cero palabras técnicas (evita: "ROP", "tendencia bajista", "velocidad", "Clase A", "conservador"). Escribe de 20 a 35 palabras dando una justificación de negocio al usuario. Ejemplo: 'Este producto se está moviendo lento hoy, pero siempre se vende. Recomiendo pedir un poco para evitar quedarnos en ceros.'`;

/**
 * Consejero del dashboard: ajuste porcentual sobre la cantidad base de cada producto crítico.
 * @param {Array<Object>} candidatos - Productos por reponer (salida de `seleccionarCandidatosReabastecimiento`).
 * @returns {Array<{role: string, content: string}>}
 */
function mensajesRecomendaciones(candidatos) {
  return [
    { role: 'system', content: SISTEMA_RECOMENDACIONES },
    { role: 'user', content: `Analiza y ajusta estos ítems críticos: ${JSON.stringify(candidatos)}` }
  ];
}

/**
 * Estratega comercial: una promoción por cada producto estancado o por vencer.
 * @param {Array<Object>} candidatos - Productos candidatos a promoción.
 * @param {string} [contextoDelDueno=''] - Bloque «EJEMPLOS DE DECISIONES DEL DUEÑO» (human-in-the-loop), o vacío.
 * @returns {Array<{role: string, content: string}>}
 */
function mensajesPromociones(candidatos, contextoDelDueno = '') {
  return [
    {
      role: 'system',
      content: `Eres un Experto en Retail y Estrategia de Ventas. Analizarás productos estancados o en riesgo de pérdida.
              Tu misión es proponer estrategias COMERCIALES (no logísticas).${contextoDelDueno}
              TIPOS PERMITIDOS: 'descuento', 'combo', '2x1', 'liquidacion'.
              REGLAS:
              - Descuento máximo: 30%.
              - Si el tipo es '2x1', el campo 'discount' DEBE SER 50 (porque el cliente paga 1 y lleva 2, es decir, ahorra el 50%).
              - Los 'combos' deben ser lógicos y estratégicos.
              - TONO: Consultivo, ejecutivo y analítico.
              - ESTILO: Escribe un párrafo fluido, natural y profesional de 35 a 50 palabras. NO uses etiquetas como '(Diagnóstico)' o '(Objetivo)'.
              - LÓGICA: Conecta la causa técnica (ej: baja rotación, sobrestock) con el beneficio estratégico (ej: recuperar liquidez, optimizar espacio) usando conectores naturales.
              - EJEMPLO: 'Dado que la rotación de [Producto] ha sido nula en los últimos 20 días, se sugiere este descuento para recuperar el capital inmovilizado y optimizar el espacio en estantería para productos de mayor demanda.'
              - EXTENSIÓN: Entre 35 y 50 palabras.
              - DURACIÓN: Sugiere una duración lógica en 'duration_days'.
              - COMBOS: Si es 'combo', identifica un producto afín y pon su nombre en 'complementary_name'.
              - COBERTURA OBLIGATORIA: Debes generar exactamente UNA sugerencia por CADA producto del array. No puedes omitir ninguno.
              - Responde ÚNICAMENTE JSON: { "promotions": [ { "id": ID, "type": "TIPO", "title": "Título corto", "reason": "Justificación profesional fluida", "duration_days": 15, "complementary_name": "Nombre o null", "discount": 15 } ] }`
    },
    {
      role: 'user',
      content: `Genera una estrategia promocional para CADA uno de estos ${candidatos.length} productos (uno por uno, sin omitir ninguno): ${JSON.stringify(candidatos)}`
    }
  ];
}

/**
 * Bloque de ejemplos de promociones manuales previas del dueño, para que la IA aprenda su estilo.
 * @param {Array<{nombre_producto: string, categoria: string, descuento_porcentaje: number, motivo: string}>} promocionesManuales
 * @returns {string} Cadena vacía si no hay ejemplos.
 */
function contextoPromocionesDelDueno(promocionesManuales) {
  if (!promocionesManuales || promocionesManuales.length === 0) return '';
  return '\n\nEJEMPLOS DE DECISIONES DEL DUEÑO (Aprende de su estilo para sugerir descuentos similares):\n' +
    promocionesManuales
      .map(mp => `- Producto: "${mp.nombre_producto}", Categoria: ${mp.categoria}, Descuento Aplicado: ${mp.descuento_porcentaje}%. Motivo del dueño: "${mp.motivo}"`)
      .join('\n');
}

const SISTEMA_RIESGO_CLIENTE = `Eres el 'Motor de Inteligencia de Negocios' de StockPilot. Tu tarea es analizar el historial de créditos (fiados) y abonos de un cliente de una tienda de barrio.
Tus respuestas deben estar en formato JSON con la siguiente estructura:
{
  "perfil": "Buen Pagador" | "Regular" | "Mal Pagador" | "Cliente Nuevo",
  "riesgo": "Bajo" | "Medio" | "Alto" | "Evaluando",
  "razon": "Explicación de 1 a 2 oraciones de por qué se asignó este perfil, basándose en su frecuencia de pago y saldo acumulado. ATENCIÓN: Si el cliente tiene 1 o 2 compras fiadas muy recientes y aún no ha abonado, clasifícalo como 'Cliente Nuevo' y riesgo 'Evaluando', NO como 'Mal Pagador'.",
  "sugerencia": "Ej: Limitar crédito, ofrecer descuentos por pronto pago, etc."
}`;

/**
 * Evaluador de riesgo crediticio. Recibe SOLO el historial de pagos (sin nombre ni celular del
 * cliente: Ley 1581; lo fija `ia_privacidad.test.js`).
 * @param {Object} historial - Totales y fechas de fiados y abonos.
 * @returns {{messages: Array<{role: string, content: string}>, userPrompt: string}} `userPrompt`
 *   se devuelve aparte porque también se guarda en la auditoría.
 */
function mensajesRiesgoCliente(historial) {
  const userPrompt = `Analiza este historial crediticio y determina el riesgo:\n${JSON.stringify(historial, null, 2)}`;
  return {
    messages: [
      { role: 'system', content: SISTEMA_RIESGO_CLIENTE },
      { role: 'user', content: userPrompt }
    ],
    userPrompt
  };
}

module.exports = { mensajesRecomendaciones, mensajesPromociones, contextoPromocionesDelDueno, mensajesRiesgoCliente };
