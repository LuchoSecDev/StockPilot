const Product = require('../models/Product');
const ProductFactory = require('../models/products/ProductFactory');
const { safeError, verifyProductOwnership } = require('../utils/securityUtils');
const ExcelJS = require('exceljs');
const stream = require('stream');
const Notification = require('../models/Notification');
const Alert = require('../models/Alert');
const db = require('../config/database');
const { calcularReposicion } = require('../services/inventory/reposicion');
const { leerEntradasMotor } = require('../services/inventory/entradasMotor');
const { ocultarDatosDeMargen } = require('../utils/datosDeMargen');

class ProductController {
    static async bulkUpload(req, res) {
        try {
            const tiendaId = req.session.tiendaId;
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No se subió ningún archivo' });
            }

            const workbook = new ExcelJS.Workbook();
            const originalName = req.file.originalname.toLowerCase();
            
            if (originalName.endsWith('.csv')) {
                const bufferStream = new stream.PassThrough();
                bufferStream.end(req.file.buffer);
                await workbook.csv.read(bufferStream);
            } else if (originalName.endsWith('.xlsx')) {
                await workbook.xlsx.load(req.file.buffer);
            } else {
                return res.status(400).json({ success: false, error: 'Formato no soportado. Usa .csv o .xlsx' });
            }

            const worksheet = workbook.worksheets[0];
            if (!worksheet) return res.status(400).json({ success: false, error: 'El archivo está vacío' });

            let headerRow = null;
            let colIndexes = {};
            
            worksheet.eachRow((row) => {
                if (!headerRow && row.hasValues) {
                    headerRow = row;
                    row.eachCell((cell, colNumber) => {
                        const val = cell.value ? cell.value.toString().trim().toLowerCase() : '';
                        if (val.includes('codigo') || val.includes('código') || val === 'sku') colIndexes.codigo = colNumber;
                        if (val.includes('nombre') || val.includes('descripcion') || val.includes('descripción')) colIndexes.nombre = colNumber;
                        if (val.includes('precio') || val === 'pvp') colIndexes.precio = colNumber;
                        if (val.includes('costo') || val === 'valor unitario') colIndexes.costo_compra = colNumber;
                        if (val.includes('cantidad') || val === 'stock') colIndexes.cantidad = colNumber;
                        if (val.includes('categoria') || val.includes('categoría')) colIndexes.categoria = colNumber;
                    });
                }
            });

            if (!colIndexes.codigo || !colIndexes.nombre) {
                return res.status(400).json({ success: false, error: 'El archivo debe contener columnas para "Código" y "Nombre"' });
            }

            let successCount = 0;
            let warnings = [];
            const promises = [];

            worksheet.eachRow((row, rowNumber) => {
                if (row === headerRow) return;

                const codigo = row.getCell(colIndexes.codigo)?.value?.toString().trim();
                const nombre = row.getCell(colIndexes.nombre)?.value?.toString().trim();
                const precio = parseFloat(row.getCell(colIndexes.precio)?.value) || 0;
                const costo_compra = parseFloat(row.getCell(colIndexes.costo_compra)?.value) || 0;
                const cantidad = parseInt(row.getCell(colIndexes.cantidad)?.value) || 0;
                const categoria = row.getCell(colIndexes.categoria)?.value?.toString().trim() || 'General';

                if (!codigo || !nombre) {
                    warnings.push(`Fila ${rowNumber}: Ignorada. Falta Código o Nombre.`);
                    return;
                }

                if (precio < 0 || costo_compra < 0 || cantidad < 0) {
                     warnings.push(`Fila ${rowNumber}: Ignorada. Valores numéricos negativos.`);
                     return;
                }

                try {
                    const productInstance = ProductFactory.create({
                        codigo,
                        nombre_producto: nombre,
                        precio,
                        costo_compra,
                        cantidad,
                        categoria,
                        tipo_producto: 'General',
                        id_tienda: tiendaId
                    });

                    const validation = productInstance.validate();
                    if (!validation.valid) {
                        warnings.push(`Fila ${rowNumber}: ${validation.error}`);
                        return;
                    }

                    // 🛡️ IDOR y Prevención de Duplicados: Verificar si el producto ya existe para esta tienda específica
                    const pRecord = productInstance.toDBRecord();
                    const existingTask = Product.findByBarcode(tiendaId, pRecord.codigo).then(existing => {
                        if (existing) {
                            // Actualizar el producto si ya existe para esta tienda
                            return Product.update(existing.id_producto, pRecord).then(() => {
                                successCount++;
                            });
                        } else {
                            // Crear solo si no existe
                            return Product.create(pRecord).then(() => {
                                successCount++;
                            });
                        }
                    }).catch(err => {
                        warnings.push(`Fila ${rowNumber}: Error al procesar (${err.message})`);
                    });
                    promises.push(existingTask);
                } catch (err) {
                    warnings.push(`Fila ${rowNumber}: Error (${err.message})`);
                }
            });

            await Promise.allSettled(promises);

            res.json({
                success: true,
                message: 'Carga masiva completada',
                processed: successCount,
                warnings: warnings
            });

        } catch (error) {
            console.error('Error en carga masiva:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error interno procesando el archivo') });
        }
    }

    static async getProducts(req, res) {
        try {
            const tiendaId = req.session.tiendaId;
            const [productos, entradasMotor] = await Promise.all([
                Product.findByStore(tiendaId),
                leerEntradasMotor(db, tiendaId), // clase ABC de toda la tienda (solo productos 'Disponible')
            ]);
            const claseABCPorProducto = new Map(entradasMotor.map((e) => [e.id_producto, e.claseABC]));

            // Plan 17, Fase 2: el backend decide el nivel de stock (antes cada componente del
            // frontend lo recalculaba a su manera, con resultados distintos entre sí). No se quita
            // ningún campo viejo, solo se agregan nivel_stock/urgencia.
            const productosConNivel = productos.map((p) => {
                const rep = calcularReposicion({
                    ventasDia7: p.velocity_7d,
                    ventasDia30: p.velocity,
                    claseABC: claseABCPorProducto.get(p.id_producto) || 'C', // pausados: sin ranking de ingresos, se asume el default de la columna
                    stock: p.cantidad,
                    stockSeguridad: p.stock_seguridad,
                    stockMinimo: p.stock_minimo,
                    leadTime: p.lead_time,
                    frecuenciaCompraDias: p.frecuencia_compra_dias,
                });
                return { ...p, nivel_stock: rep.nivel, urgencia: rep.urgencia };
            });

            res.json(ocultarDatosDeMargen(productosConNivel, req.session.rol));
        } catch (error) {
            console.error('Error obteniendo productos:', error);
            res.status(500).json({ success: false, error: 'Error al obtener productos' });
        }
    }

    static async getProduct(req, res) {
        try {
            const productId = req.params.id;
            const tiendaId = req.session.tiendaId;
            const producto = await Product.findById(productId);
            
            if (!producto || producto.id_tienda !== tiendaId) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }
            
            res.json(ocultarDatosDeMargen(producto, req.session.rol));
        } catch (error) {
            console.error('Error obteniendo producto:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error al obtener producto') });
        }
    }

    static async createProduct(req, res) {
        try {
            const tiendaId = req.session.tiendaId;
            
            const {
                codigo, codigo_barras, nombre_producto, categoria, subcategoria, tipo_producto,
                precio, cantidad, stock_minimo, stock_maximo, fecha_vencimiento,
                frecuencia_compra_dias, costo_compra, stock_seguridad, lead_time,
                id_proveedor
            } = req.body;

            const productInstance = ProductFactory.create({
                codigo, codigo_barras, nombre_producto, categoria, subcategoria, tipo_producto,
                precio, cantidad, stock_minimo, stock_maximo, fecha_vencimiento,
                frecuencia_compra_dias, costo_compra, stock_seguridad, lead_time,
                id_proveedor,
                id_tienda: tiendaId
            });

            // Validación específica según el tipo de producto
            const validation = productInstance.validate();
            if (!validation.valid) {
                return res.status(400).json({ success: false, error: validation.error });
            }

            // Guardamos el registro limpio en la base de datos
            await Product.create(productInstance.toDBRecord());

            // Plan 17, Fase 4 (hallazgo O2): antes las alertas solo se regeneraban tras una venta, así
            // que un producto creado ya crítico (o con stock_seguridad/frecuencia de compra que lo
            // ponen así) no aparecía en Monitor Alertas hasta la primera venta. Fire-and-forget: no debe
            // bloquear la respuesta ni fallar el registro si la regeneración tiene un problema.
            Alert.generate(tiendaId).catch(e => console.error('Error regenerando alertas post-creación:', e));

            res.json({ success: true, message: "Producto registrado correctamente" });
        } catch (error) {
            console.error('Error creando producto:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error al crear producto') });
        }
    }

    static async updateProduct(req, res) {
        try {
            const productId = req.params.id;
            const tiendaId = req.session.tiendaId;

            // 🛡️ IDOR: Verificar que el producto pertenece a la tienda del usuario
            const ownership = await verifyProductOwnership(productId, tiendaId);
            if (!ownership) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }
            
            const productoActual = await Product.findById(productId);
            const precioAnterior = parseFloat(productoActual.precio);

            const {
                codigo, codigo_barras, nombre_producto, categoria, subcategoria, tipo_producto,
                precio, cantidad, stock_minimo, stock_maximo, fecha_vencimiento,
                frecuencia_compra_dias, costo_compra, stock_seguridad, lead_time,
                id_proveedor
            } = req.body;

            const precioNuevo = parseFloat(precio);

            const productInstance = ProductFactory.create({
                codigo, codigo_barras, nombre_producto, categoria, subcategoria, tipo_producto,
                precio, cantidad, stock_minimo, stock_maximo, fecha_vencimiento,
                frecuencia_compra_dias, costo_compra, stock_seguridad, lead_time,
                id_proveedor
            });
            const validation = productInstance.validate();
            
            if (!validation.valid) {
                return res.status(400).json({ success: false, error: validation.error });
            }

            const success = await Product.update(productId, productInstance.toDBRecord());
            
            if (!success) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            if (precioAnterior !== precioNuevo) {
                const tenderos = await db.allAsync(
                    'SELECT id_usuario FROM Usuarios WHERE id_tienda = ? AND rol = ?', [tiendaId, 'Tendero']
                );
                for (const t of tenderos) {
                    await Notification.create({
                        id_usuario: t.id_usuario,
                        id_tienda: tiendaId,
                        tipo: 'cambio_precio',
                        titulo: '🏷️ Actualización de Precio',
                        mensaje: `El precio de "${nombre_producto}" cambió de $${precioAnterior.toLocaleString('es-CO')} a $${precioNuevo.toLocaleString('es-CO')}.`,
                        datos_json: JSON.stringify({ id_producto: productId, precio_anterior: precioAnterior, precio_nuevo: precioNuevo })
                    });
                }
            }

            // Plan 17, Fase 4 (hallazgo O2): editar stock_seguridad, stock_minimo, lead_time o
            // frecuencia_compra_dias cambia si el producto debería estar en alerta, sin que medie
            // ninguna venta. Fire-and-forget, igual que tras una venta.
            Alert.generate(tiendaId).catch(e => console.error('Error regenerando alertas post-edición:', e));

            res.json({ success: true, message: "Producto actualizado correctamente" });
        } catch (error) {
            console.error('Error actualizando producto:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error al actualizar producto') });
        }
    }

    static async applyManualPromotion(req, res) {
        try {
            const tiendaId = req.session.tiendaId;
            const { id_producto, descuento_porcentaje, motivo } = req.body;
            
            if (!id_producto || !descuento_porcentaje) {
                return res.status(400).json({ success: false, error: 'Datos incompletos.' });
            }

            const ownership = await verifyProductOwnership(id_producto, tiendaId);
            if (!ownership) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            const productoActual = await Product.findById(id_producto);
            const precioAnterior = parseFloat(productoActual.precio);
            
            // Calcular nuevo precio
            const descuento = parseFloat(descuento_porcentaje);
            const precioNuevo = Math.round(precioAnterior - (precioAnterior * (descuento / 100)));

            // Registrar la promoción manual
            await db.runAsync(`
                INSERT INTO Promociones_Manuales (id_producto, id_tienda, descuento_porcentaje, precio_anterior, precio_nuevo, motivo)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id_producto, tiendaId, descuento, precioAnterior, precioNuevo, motivo]);

            // Actualizar precio del producto de forma segura
            await Product.updatePrice(id_producto, precioNuevo);

            // Notificar a tenderos
            const tenderos = await db.allAsync(
                'SELECT id_usuario FROM Usuarios WHERE id_tienda = ? AND rol = ?', [tiendaId, 'Tendero']
            );
            for (const t of tenderos) {
                await Notification.create({
                    id_usuario: t.id_usuario,
                    id_tienda: tiendaId,
                    tipo: 'cambio_precio',
                    titulo: '🌟 Promoción Aplicada',
                    mensaje: `El precio de "${productoActual.nombre_producto}" cambió de $${precioAnterior.toLocaleString('es-CO')} a $${precioNuevo.toLocaleString('es-CO')} por descuento del ${descuento}%.`,
                    datos_json: JSON.stringify({ id_producto: id_producto, precio_anterior: precioAnterior, precio_nuevo: precioNuevo, prioridad: 'normal' })
                });
            }

            res.json({ success: true, message: "Promoción aplicada correctamente", precio_nuevo: precioNuevo });
        } catch (error) {
            console.error('Error aplicando promoción manual:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error al aplicar promoción manual') });
        }
    }

    static async getByBarcode(req, res) {
        try {
            const barcode = req.params.code;
            const tiendaId = req.session.tiendaId;
            const producto = await Product.findByBarcode(tiendaId, barcode);
            
            if (!producto) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }
            
            res.json({ success: true, data: ocultarDatosDeMargen(producto, req.session.rol) });
        } catch (error) {
            console.error('Error buscando por código de barras:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error al buscar producto') });
        }
    }

    static async linkBarcode(req, res) {
        try {
            const productId = req.params.id;
            const tiendaId = req.session.tiendaId;

            // El código llega como texto (o número, si el escáner lo entrega así): se normaliza y se acota
            // al tamaño de la columna (VARCHAR(50)); antes uno más largo daba un 500 de la base.
            const crudo = req.body.codigo_barras;
            const codigo_barras = typeof crudo === 'string' || typeof crudo === 'number' ? String(crudo).trim() : '';
            if (!codigo_barras) {
                return res.status(400).json({ success: false, error: 'Código de barras es requerido' });
            }
            if (codigo_barras.length > 50) {
                return res.status(400).json({ success: false, error: 'El código de barras no puede tener más de 50 caracteres' });
            }

            // 🛡️ IDOR: Verificar propiedad
            const ownership = await verifyProductOwnership(productId, tiendaId);
            if (!ownership) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            const resultado = await Product.linkBarcode(productId, tiendaId, codigo_barras);

            if (resultado.estado === 'duplicado') {
                return res.status(409).json({
                    success: false,
                    code: 'BARCODE_DUPLICADO',
                    error: `Ese código ya pertenece a «${resultado.conflicto.nombre_producto}».`
                });
            }
            if (resultado.estado !== 'ok') {
                return res.status(404).json({ success: false, error: 'Error al vincular el código' });
            }

            res.json({ success: true, message: "Código vinculado correctamente" });
        } catch (error) {
            console.error('Error vinculando código:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error al vincular código') });
        }
    }

    static async toggleProductStatus(req, res) {
        try {
            const productId = req.params.id;
            const tiendaId = req.session.tiendaId;
            const estado = req.originalUrl.includes('inhabilitar') ? 'Inactivo' : 'Disponible';

            // 🛡️ IDOR: Verificar propiedad
            const ownership = await verifyProductOwnership(productId, tiendaId);
            if (!ownership) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            const success = await Product.toggleStatus(productId, estado);
            
            if (!success) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            const action = estado === 'Disponible' ? 'habilitado' : 'inhabilitado';
            res.json({ success: true, message: `Producto ${action} correctamente` });
        } catch (error) {
            console.error('Error cambiando estado de producto:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error al cambiar estado del producto') });
        }
    }

    static async deleteProduct(req, res) {
        try {
            const productId = req.params.id;
            const tiendaId = req.session.tiendaId;

            // 🛡️ IDOR: Verificar propiedad
            const ownership = await verifyProductOwnership(productId, tiendaId);
            if (!ownership) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            const success = await Product.delete(productId);
            
            if (!success) {
                return res.status(404).json({ success: false, error: 'Producto no encontrado' });
            }

            res.json({ success: true, message: "Producto eliminado" });
        } catch (error) {
            console.error('Error eliminando producto:', error);
            res.status(500).json({ success: false, error: safeError(error, 'Error al eliminar producto') });
        }
    }
}

module.exports = ProductController;