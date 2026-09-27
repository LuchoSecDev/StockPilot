/**
 * @file aislamiento_multitienda.test.js
 * @description Flujo prioritario 5/7 (plan 20, Nivel 2): que una tienda nunca pueda ver ni
 * modificar los datos de otra, contra Postgres real. Complementa el chequeo puntual que ya
 * hace `cartera.test.js` (sección 8.10) sobre `clienteController`, cubriendo productos, ventas
 * y proveedores.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import db from '../../config/database.js';
import { limpiarBaseDePruebas } from './helpers/db.js';
import { crearUsuario, crearProducto, abrirCaja } from './helpers/fixtures.js';
import { iniciarSesion, obtenerCsrfToken } from './helpers/sesion.js';

beforeEach(async () => {
  await limpiarBaseDePruebas();
});

async function agenteLogueado(overrides = {}) {
  const datosUsuario = await crearUsuario(overrides);
  const agente = request.agent(app);
  await iniciarSesion(agente, datosUsuario);
  const csrfToken = await obtenerCsrfToken(agente);
  return { agente, csrfToken, ...datosUsuario };
}

async function crearProveedor(agente, csrfToken) {
  const res = await agente.post('/api/proveedores').set('X-CSRF-Token', csrfToken)
    .send({ nombre_empresa: 'Proveedor de Prueba', contacto_principal: 'Juan', email: 'prov@test.local', telefono: '3000000000', direccion: 'Calle 1' });
  return res.body.id;
}

describe('Aislamiento multi-tienda', () => {
  it('Productos: la lista de una tienda nunca incluye productos de otra', async () => {
    const tiendaA = await agenteLogueado();
    const tiendaB = await agenteLogueado();
    await crearProducto({ id_tienda: tiendaA.id_tienda, nombre_producto: 'Producto de A' });
    await crearProducto({ id_tienda: tiendaB.id_tienda, nombre_producto: 'Producto de B' });

    const listaA = await tiendaA.agente.get('/api/productos');
    const nombres = listaA.body.map(p => p.nombre_producto);
    expect(nombres).toContain('Producto de A');
    expect(nombres).not.toContain('Producto de B');
  });

  it('Productos: ver/editar/eliminar un producto de otra tienda por su ID da 404 (guard IDOR ya existente)', async () => {
    const tiendaA = await agenteLogueado({ rol: 'Administrador' });
    const tiendaB = await agenteLogueado({ rol: 'Administrador' });
    const idProductoDeA = await crearProducto({ id_tienda: tiendaA.id_tienda });

    const ver = await tiendaB.agente.get(`/api/productos/${idProductoDeA}`);
    expect(ver.status).toBe(404);

    const editar = await tiendaB.agente.put(`/api/productos/${idProductoDeA}`).set('X-CSRF-Token', tiendaB.csrfToken)
      .send({ codigo: 'X', nombre_producto: 'Hackeado', categoria: 'X', precio: 1, cantidad: 1, stock_minimo: 1 });
    expect(editar.status).toBe(404);

    const eliminar = await tiendaB.agente.delete(`/api/productos/${idProductoDeA}`).set('X-CSRF-Token', tiendaB.csrfToken);
    expect(eliminar.status).toBe(404);

    // Confirmamos que de verdad no se tocó nada, no solo que el HTTP dijo 404.
    const productoIntacto = await db.getAsync('SELECT nombre_producto, estado FROM Productos WHERE id_producto = ?', [idProductoDeA]);
    expect(productoIntacto.nombre_producto).not.toBe('Hackeado');
    expect(productoIntacto.estado).not.toBe('Inactivo');
  });

  it('Ventas: comprar un producto de otra tienda da 404, y el listado de ventas nunca mezcla tiendas', async () => {
    const tiendaA = await agenteLogueado({ rol: 'Tendero' });
    const tiendaB = await agenteLogueado({ rol: 'Tendero' });
    const idProductoDeA = await crearProducto({ id_tienda: tiendaA.id_tienda, cantidad: 10 });
    await abrirCaja(tiendaB.id_tienda, tiendaB.id_usuario);

    const compra = await tiendaB.agente.post('/api/registrar-venta').set('X-CSRF-Token', tiendaB.csrfToken)
      .send({ id_producto: idProductoDeA, cantidad: 1 });
    expect(compra.status).toBe(404);

    // El stock del producto de A no debe haberse movido.
    const productoIntacto = await db.getAsync('SELECT cantidad FROM Productos WHERE id_producto = ?', [idProductoDeA]);
    expect(productoIntacto.cantidad).toBe(10);

    const ventasDeB = await tiendaB.agente.get('/api/ventas');
    expect(ventasDeB.body.data.length).toBe(0);
  });

  it('Proveedores: actualizar el propio (misma tienda) sigue funcionando después del arreglo de la sección 8.12', async () => {
    const { agente, csrfToken } = await agenteLogueado({ rol: 'Administrador' });
    const idProveedor = await crearProveedor(agente, csrfToken);

    const editar = await agente.put(`/api/proveedores/${idProveedor}`).set('X-CSRF-Token', csrfToken)
      .send({ nombre_empresa: 'Nombre Actualizado', contacto_principal: 'Ana', email: 'ana@test.local', telefono: '3001112233', direccion: 'Calle 2' });
    expect(editar.status).toBe(200);
    expect(editar.body.success).toBe(true);

    const tras = await db.getAsync('SELECT nombre_empresa FROM Proveedores WHERE id_proveedor = ?', [idProveedor]);
    expect(tras.nombre_empresa).toBe('Nombre Actualizado');
  });

  it('Proveedores: la lista de una tienda nunca incluye proveedores de otra', async () => {
    const tiendaA = await agenteLogueado({ rol: 'Administrador' });
    const tiendaB = await agenteLogueado({ rol: 'Administrador' });
    await crearProveedor(tiendaA.agente, tiendaA.csrfToken);

    const listaB = await tiendaB.agente.get('/api/proveedores');
    expect(listaB.body.data).toEqual([]);
  });

  it('Proveedores: actualizar/eliminar el de otra tienda da 404 y no lo modifica (corregido, ver plan sección 8.12)', async () => {
    const tiendaA = await agenteLogueado({ rol: 'Administrador' });
    const tiendaB = await agenteLogueado({ rol: 'Administrador' });
    const idProveedorDeA = await crearProveedor(tiendaA.agente, tiendaA.csrfToken);
    expect(idProveedorDeA).toBeTruthy();

    const nombreOriginal = await db.getAsync('SELECT nombre_empresa, estado FROM Proveedores WHERE id_proveedor = ?', [idProveedorDeA]);

    const editar = await tiendaB.agente.put(`/api/proveedores/${idProveedorDeA}`).set('X-CSRF-Token', tiendaB.csrfToken)
      .send({ nombre_empresa: 'Hackeado', contacto_principal: 'X', email: 'x@x.com', telefono: '1', direccion: 'X' });
    const eliminar = await tiendaB.agente.delete(`/api/proveedores/${idProveedorDeA}`).set('X-CSRF-Token', tiendaB.csrfToken);

    // Antes ambos respondían success:true aunque no afectaran ninguna fila (hallazgo, ya corregido):
    // ahora revisan `changes` y devuelven 404 cuando el proveedor no es de la tienda del usuario.
    expect(editar.status).toBe(404);
    expect(editar.body.success).toBe(false);
    expect(eliminar.status).toBe(404);
    expect(eliminar.body.success).toBe(false);

    const tras = await db.getAsync('SELECT nombre_empresa, estado FROM Proveedores WHERE id_proveedor = ?', [idProveedorDeA]);
    expect(tras.nombre_empresa).toBe(nombreOriginal.nombre_empresa);
    expect(tras.estado).toBe(nombreOriginal.estado);
  });
});
