// controllers/reportController.js
const Report = require('../models/Report');
const excel = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../config/database');

class ReportController {
    static async createReport(req, res) {
        try {
            const { titulo, descripcion, fecha_reporte, creador, tipo, fecha_inicio, fecha_fin, force } = req.body;
            const id_tienda = req.session.tiendaId; // Fix #19

            if (!titulo || !descripcion || !fecha_reporte || !creador || !tipo) {
                return res.status(400).json({ success: false, error: "Todos los campos obligatorios deben estar presentes" });
            }

            // PRE-VALIDACION: Bloquear guardado si el rango de fechas no tiene datos
            let validationQuery = null;
            let validationParams = [id_tienda];
            const hasDates = fecha_inicio && fecha_fin;

            if (tipo === 'Inventario' && hasDates) {
                validationQuery = `SELECT COUNT(*) as count FROM Productos WHERE id_tienda = ? AND fecha_entrada::date BETWEEN ? AND ?`;
                validationParams.push(fecha_inicio, fecha_fin);
            } else if (tipo === 'Ventas' && hasDates) {
                validationQuery = `SELECT COUNT(*) as count FROM Ventas WHERE id_tienda = ? AND fecha_salida::date BETWEEN ? AND ?`;
                validationParams.push(fecha_inicio, fecha_fin);
            } else if ((tipo === 'Operativo' || tipo === 'Financiero') && hasDates) {
                validationQuery = `
                    SELECT COUNT(m.id_movimiento) as count 
                    FROM MovimientosStock m
                    JOIN Productos p ON m.id_producto = p.id_producto
                    WHERE p.id_tienda = ? AND m.fecha_movimiento::date BETWEEN ? AND ?
                `;
                validationParams.push(fecha_inicio, fecha_fin);
            }

            if (validationQuery && !force) {
                const check = await db.getAsync(validationQuery, validationParams);
                if (!check || parseInt(check.count) === 0) {
                    return res.status(409).json({
                        success: false,
                        requireConfirmation: true,
                        error: `Atención: No hay registros de movimientos para ${tipo} entre el ${fecha_inicio} y el ${fecha_fin}.\nEl documento de Excel descargable estará vacío.\n\n¿Desea crear este reporte de todos modos?`
                    });
                }
            }

            const reportId = await Report.create({
                titulo,
                descripcion,
                fecha_reporte,
                creador,
                tipo,
                fecha_inicio,
                fecha_fin,
                id_tienda
            });

            res.json({ success: true, id: reportId });
        } catch (error) {
            console.error('Error creando reporte:', error);
            res.status(500).json({ success: false, error: "Error guardando reporte" });
        }
    }

    static async getReports(req, res) {
        try {
            const id_tienda = req.session.tiendaId; // Fix #19
            const reportes = await Report.findByStore(id_tienda);
            res.json(reportes);
        } catch (error) {
            console.error('Error obteniendo reportes:', error);
            res.status(500).json({ success: false, error: "No se pudieron obtener los reportes" });
        }
    }

    static async updateReport(req, res) {
        try {
            const reportId = req.params.id;
            const { titulo, descripcion, fecha_reporte, creador, tipo, fecha_inicio, fecha_fin, force } = req.body;
            const id_tienda = req.session.tiendaId; // Fix #19
            if (!/^\d+$/.test(reportId)) return res.status(404).json({ success: false, error: "Reporte no encontrado" });

            // PRE-VALIDACION: Bloquear guardado si el rango de fechas no tiene datos
            let validationQuery = null;
            let validationParams = [id_tienda];
            const hasDates = fecha_inicio && fecha_fin;

            if (tipo === 'Inventario' && hasDates) {
                validationQuery = `SELECT COUNT(*) as count FROM Productos WHERE id_tienda = ? AND fecha_entrada::date BETWEEN ? AND ?`;
                validationParams.push(fecha_inicio, fecha_fin);
            } else if (tipo === 'Ventas' && hasDates) {
                validationQuery = `SELECT COUNT(*) as count FROM Ventas WHERE id_tienda = ? AND fecha_salida::date BETWEEN ? AND ?`;
                validationParams.push(fecha_inicio, fecha_fin);
            } else if ((tipo === 'Operativo' || tipo === 'Financiero') && hasDates) {
                validationQuery = `
                    SELECT COUNT(m.id_movimiento) as count 
                    FROM MovimientosStock m
                    JOIN Productos p ON m.id_producto = p.id_producto
                    WHERE p.id_tienda = ? AND m.fecha_movimiento::date BETWEEN ? AND ?
                `;
                validationParams.push(fecha_inicio, fecha_fin);
            }

            if (validationQuery && !force) {
                const check = await db.getAsync(validationQuery, validationParams);
                if (!check || parseInt(check.count) === 0) {
                    return res.status(409).json({
                        success: false,
                        requireConfirmation: true,
                        error: `Atención: No hay registros de movimientos para ${tipo} entre el ${fecha_inicio} y el ${fecha_fin}.\nEl documento de Excel descargable estará vacío.\n\n¿Desea guardar esta edición de todos modos?`
                    });
                }
            }

            const success = await Report.update(reportId, id_tienda, {
                titulo,
                descripcion,
                fecha_reporte,
                creador,
                tipo,
                fecha_inicio,
                fecha_fin
            });

            if (!success) {
                return res.status(404).json({ success: false, error: "Reporte no encontrado" });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error actualizando reporte:', error);
            res.status(500).json({ success: false, error: "Error actualizando reporte" });
        }
    }

    static async deleteReport(req, res) {
        try {
            const reportId = req.params.id;
            if (!/^\d+$/.test(reportId)) return res.status(404).json({ success: false, error: "Reporte no encontrado" });
            const success = await Report.delete(reportId, req.session.tiendaId);

            if (!success) {
                return res.status(404).json({ success: false, error: "Reporte no encontrado" });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error eliminando reporte:', error);
            res.status(500).json({ success: false, error: "Error eliminando el reporte" });
        }
    }

    static async downloadReport(req, res) {
        try {
            const reportId = req.params.id;
            if (!/^\d+$/.test(reportId)) return res.status(404).json({ success: false, error: "Reporte no encontrado" });
            const reporte = await Report.findById(reportId, req.session.tiendaId);
            
            if (!reporte) {
                return res.status(404).json({ success: false, error: "Reporte no encontrado" });
            }

            const workbook = new excel.Workbook();
            workbook.creator = reporte.creador;
            workbook.created = new Date();
            const sheet = workbook.addWorksheet(reporte.tipo || 'Reporte');

            let query = '';
            let params = [req.session.tiendaId];
            
            // Fechas seguras para SQL query (usando DATE nativo)
            const hasDates = reporte.fecha_inicio && reporte.fecha_fin;

            if (reporte.tipo === 'Inventario') {
                sheet.columns = [
                    { header: 'ID', key: 'id_producto', width: 10 },
                    { header: 'SKU / Código', key: 'codigo', width: 15 },
                    { header: 'Producto', key: 'nombre_producto', width: 35 },
                    { header: 'Categoría', key: 'categoria', width: 20 },
                    { header: 'Costo Unitario', key: 'costo_compra', width: 18 },
                    { header: 'Precio Público', key: 'precio', width: 18 },
                    { header: 'Ganancia Bruta', key: 'margen', width: 18 },
                    { header: 'Cantidad Disponible', key: 'cantidad', width: 20 },
                    { header: 'Piso de Reposición', key: 'stock_minimo', width: 18 },
                    { header: 'Tope Máximo', key: 'stock_maximo', width: 15 },
                    { header: 'Días de Envío', key: 'lead_time', width: 15 },
                    { header: 'Vencimiento', key: 'fecha_vencimiento', width: 20 },
                    { header: 'Estatus', key: 'estado', width: 15 }
                ];
                query = `SELECT *, (precio - costo_compra) as margen FROM Productos WHERE id_tienda = ?`;
                
                if (hasDates) {
                    query += ` AND fecha_entrada::date BETWEEN ? AND ?`;
                    params.push(reporte.fecha_inicio, reporte.fecha_fin);
                }
            } else if (reporte.tipo === 'Ventas') {
                sheet.columns = [
                    { header: 'Recibo #', key: 'id_venta', width: 15 },
                    { header: 'Fecha de Venta', key: 'fecha_salida', width: 25 },
                    { header: 'Artículo', key: 'producto', width: 35 },
                    { header: 'Unidades', key: 'cantidad_items', width: 15 },
                    { header: 'Precio Cobrado', key: 'precio_unitario', width: 20 },
                    { header: 'Subtotal Línea', key: 'subtotal', width: 20 },
                    { header: 'Total Ticket', key: 'precio_total', width: 20 },
                    { header: 'Atendido por', key: 'nombres', width: 25 }
                ];
                query = `
                    SELECT v.id_venta, v.fecha_salida, p.nombre_producto as producto, vp.cantidad as cantidad_items, 
                           COALESCE(vp.precio_unitario, p.precio) as precio_unitario, 
                           (vp.cantidad * COALESCE(vp.precio_unitario, p.precio)) as subtotal, 
                           v.precio_total, u.nombres
                    FROM Ventas v
                    JOIN VentasProductos vp ON v.id_venta = vp.id_venta
                    JOIN Productos p ON vp.id_producto = p.id_producto
                    LEFT JOIN Usuarios u ON v.id_vendedor = u.id_usuario
                    WHERE v.id_tienda = ?
                `;
                
                if (hasDates) {
                    query += ` AND v.fecha_salida::date BETWEEN ? AND ?`;
                    params.push(reporte.fecha_inicio, reporte.fecha_fin);
                }
                query += ` ORDER BY v.fecha_salida DESC`;
            } else if (reporte.tipo === 'Operativo' || reporte.tipo === 'Financiero') {
                const isFinanciero = reporte.tipo === 'Financiero';
                sheet.columns = [
                    { header: 'Transacción #', key: 'id_movimiento', width: 15 },
                    { header: 'Producto', key: 'producto', width: 35 },
                    { header: 'Tipo Movimiento', key: 'tipo_movimiento', width: 20 },
                    { header: 'Piezas Afectadas', key: 'cantidad', width: 18 },
                    { header: 'Inventario Final', key: 'stock_final', width: 20 },
                    { header: 'Fecha', key: 'fecha_movimiento', width: 25 },
                    ...(isFinanciero ? [
                        { header: 'Costo Unitario ($)', key: 'costo_compra', width: 18 },
                        { header: 'Valor Total ($)', key: 'valor_total', width: 20 }
                    ] : [
                        { header: 'Detalle / Comentario', key: 'observacion', width: 30 }
                    ]),
                    { header: 'Realizado por', key: 'nombres', width: 25 }
                ];
                query = `
                    SELECT m.*, p.nombre_producto as producto, u.nombres, p.costo_compra,
                           (ABS(m.cantidad) * p.costo_compra) as valor_total
                    FROM MovimientosStock m
                    JOIN Productos p ON m.id_producto = p.id_producto
                    LEFT JOIN Usuarios u ON m.id_usuario = u.id_usuario
                    WHERE p.id_tienda = ?
                `;
                if (hasDates) {
                    query += ` AND m.fecha_movimiento::date BETWEEN ? AND ?`;
                    params.push(reporte.fecha_inicio, reporte.fecha_fin);
                }
                query += ` ORDER BY m.fecha_movimiento DESC`;
            } else {
                sheet.columns = [{ header: 'Nota', key: 'nota', width: 50 }];
                sheet.addRow({ nota: 'Los reportes genéricos no tienen un volcado de tabla asignado.' });
            }

            if (query) {
                const data = await db.allAsync(query, params);
                data.forEach(row => sheet.addRow(row));
            }

            // UI del documento Excel (Cabecera color violeta acorde a la app)
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Reporte_${reporte.tipo}_${reporte.fecha_reporte}.xlsx"`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Error generando archivo Excel:', error);
        }
    }

    static async generateMermaPDF(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const query = `
                SELECT p.*, pr.nombre_empresa as proveedor
                FROM Productos p
                LEFT JOIN Proveedores pr ON p.id_proveedor = pr.id_proveedor
                WHERE p.id_tienda = ? 
                AND p.fecha_vencimiento IS NOT NULL 
                AND p.fecha_vencimiento::date < CURRENT_DATE
                AND p.cantidad > 0
                ORDER BY p.fecha_vencimiento ASC
            `;
            const products = await db.allAsync(query, [id_tienda]);

            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Merma_' + new Date().toISOString().split('T')[0] + '.pdf');
            doc.pipe(res);

            // Estilo StockPilot
            const primaryColor = '#4F46E5';
            const textColor = '#1F2937';
            const grayColor = '#9CA3AF';

            doc.fillColor(primaryColor).fontSize(26).text('StockPilot', { align: 'right' });
            doc.fillColor(textColor).fontSize(10).text('Control de Inventario Inteligente', { align: 'right' });
            doc.moveDown(1.5);

            doc.fillColor(textColor).fontSize(20).text('REPORTE DE MERMA Y PÉRDIDAS', { align: 'left' });
            doc.fontSize(10).fillColor(grayColor).text(`Generado el: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: true })}`, { align: 'left' });
            doc.moveDown(2);

            // Tabla
            const tableTop = 180;
            const cols = { sku: 50, item: 120, qty: 280, cost: 350, loss: 420, prov: 480 };

            doc.fontSize(10).fillColor(primaryColor);
            doc.text('SKU', cols.sku, tableTop);
            doc.text('Producto', cols.item, tableTop);
            doc.text('Unds', cols.qty, tableTop);
            doc.text('Costo Un.', cols.cost, tableTop);
            doc.text('Pérdida ($)', cols.loss, tableTop);
            doc.text('Proveedor', cols.prov, tableTop);

            doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).strokeColor('#E5E7EB').stroke();

            let y = tableTop + 25;
            let totalGeneralLoss = 0;

            doc.fontSize(9).fillColor(textColor);
            products.forEach(p => {
                const cantidad = Number(p.cantidad) || 0;
                const costo = Number(p.costo_compra) || 0;
                const loss = cantidad * costo;
                totalGeneralLoss += loss;

                doc.text(p.codigo || 'N/A', cols.sku, y);
                doc.text(p.nombre_producto?.substring(0, 25) || 'Sin nombre', cols.item, y);
                doc.text(cantidad.toString(), cols.qty, y);
                doc.text(`$${costo.toLocaleString('es-CO')}`, cols.cost, y);
                doc.text(`$${loss.toLocaleString('es-CO')}`, cols.loss, y);
                doc.text(p.proveedor?.substring(0, 35) || 'No asignado', cols.prov, y);

                y += 20;
                if (y > 750) { doc.addPage(); y = 50; }
            });

            doc.moveTo(50, y + 10).lineTo(550, y + 10).strokeColor(primaryColor).stroke();
            doc.moveDown(2);
            doc.fillColor(primaryColor).fontSize(14).text(`RESUMEN IMPACTO FINANCIERO:`, 280, y + 30);
            doc.fontSize(22).fillColor('#EF4444').text(`$${totalGeneralLoss.toLocaleString('es-CO')} COP`, 280, y + 50);
            
            doc.fontSize(8).fillColor(grayColor).text('Documento de control interno generado por StockPilot AI Core.', 50, 780, { align: 'center' });
            doc.end();

        } catch (error) {
            console.error('Error generando PDF de Merma:', error);
            res.status(500).json({ success: false, error: "Fallo al generar PDF" });
        }
    }
}

module.exports = ReportController;