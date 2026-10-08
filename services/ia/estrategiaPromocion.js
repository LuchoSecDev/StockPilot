/**
 * @file estrategiaPromocion.js
 * @description Aplica a un producto la estrategia de precio que el dueño aceptó: baja el precio,
 * guarda el precio original (para restaurarlo al terminar la promoción), deja el cambio en el
 * historial de precios y lo registra en la auditoría de IA. Todo en UNA transacción: o se hace
 * completo o no se hace nada.
 *
 * @module services/ia/estrategiaPromocion
 */
const db = require('../../config/database');
const { RecursoNoEncontradoError } = require('../errores');
const { registrarEnArchivo } = require('./auditoriaIA');

const DURACION_POR_DEFECTO_DIAS = 7;

/**
 * @param {number} tiendaId
 * @param {Object} estrategia
 * @param {number} estrategia.idProducto
 * @param {number} estrategia.nuevoPrecio
 * @param {number|string} [estrategia.duracionDias] - Si falta o no es válido, 7.
 * @param {string} [estrategia.razon]
 * @param {string} [estrategia.tipo]
 * @returns {Promise<{success: true, message: string}>}
 * @throws {RecursoNoEncontradoError} Si el producto no existe o es de otra tienda.
 */
async function aplicarEstrategiaPromocion(tiendaId, { idProducto, nuevoPrecio, duracionDias, razon, tipo }) {
  const actual = await db.getAsync(
    'SELECT precio, nombre_producto FROM Productos WHERE id_producto = ? AND id_tienda = ?',
    [idProducto, tiendaId]
  );
  if (!actual) throw new RecursoNoEncontradoError('Producto no encontrado');

  const precioAnterior = actual.precio;
  const fechaFin = new Date();
  fechaFin.setDate(fechaFin.getDate() + (parseInt(duracionDias) || DURACION_POR_DEFECTO_DIAS));
  const fechaFinTexto = fechaFin.toISOString().split('T')[0];

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Guarda el precio original solo si no hay ya uno guardado (promociones encadenadas).
    await client.query(
      `UPDATE Productos
       SET precio = ?,
           precio_original = COALESCE(precio_original, ?),
           fecha_fin_promocion = ?
       WHERE id_producto = ?`,
      [nuevoPrecio, precioAnterior, fechaFinTexto, idProducto]
    );

    await client.query(
      `INSERT INTO Historial_Precios (id_producto, precio_anterior, precio_nuevo, motivo)
       VALUES (?, ?, ?, ?)`,
      [idProducto, precioAnterior, nuevoPrecio, `Estrategia IA: ${tipo} - ${razon}`]
    );

    await client.query(
      `INSERT INTO Auditoria_IA (id_tienda, id_orden, prompt_utilizado, datos_base_json, sugerencia_ia_json, impacto_decision, razon_ia)
       VALUES (?, NULL, ?, ?, ?, ?, ?)`,
      [
        tiendaId,
        'Ejecución Estrategia Directa',
        JSON.stringify([{ id: idProducto, product: actual.nombre_producto, base: precioAnterior }]),
        JSON.stringify([{
          id: idProducto,
          product: actual.nombre_producto,
          adjustment: `${Math.round(((nuevoPrecio - precioAnterior) / precioAnterior) * 100)}%`,
          final: nuevoPrecio,
          reason: razon
        }]),
        'ESTRATEGIA APLICADA',
        `Ajuste de precio automático: ${razon}`
      ]
    );
    registrarEnArchivo(tiendaId, null, `Ajuste de precio automático: ${razon}`, 'ESTRATEGIA APLICADA');

    await client.query('COMMIT');
    return { success: true, message: 'Estrategia aplicada con éxito y registrada en auditoría.' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { aplicarEstrategiaPromocion };
