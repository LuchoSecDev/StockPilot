// utils/datosDeMargen.js
// Campos de un producto que revelan el margen del negocio (precio de costo y la clase ABC, que
// resume qué productos dejan más ingresos). Son del Administrador: se quitan de lo que se devuelve al
// Tendero (y por tanto al dispositivo de la app). Ningún componente de la interfaz del Tendero los usa.
const CAMPOS_DE_MARGEN = ['costo_compra', 'clasificacion_abc'];

/**
 * @param {object|object[]} producto Fila (o lista de filas) de Productos.
 * @param {string} [rol] req.session.rol. Solo 'Administrador' recibe los campos completos.
 * @returns {object|object[]} Copia sin los campos de margen si el rol no es Administrador.
 */
function ocultarDatosDeMargen(producto, rol) {
    if (rol === 'Administrador') return producto;
    const limpiar = (p) => {
        if (!p || typeof p !== 'object') return p;
        const copia = { ...p };
        for (const campo of CAMPOS_DE_MARGEN) delete copia[campo];
        return copia;
    };
    return Array.isArray(producto) ? producto.map(limpiar) : limpiar(producto);
}

module.exports = { ocultarDatosDeMargen, CAMPOS_DE_MARGEN };
