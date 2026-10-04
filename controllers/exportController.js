// controllers/exportController.js
const fs = require('fs');
const path = require('path');
const excel = require('exceljs');
const Sale = require('../models/Sale');
const Report = require('../models/Report');

// Carpeta de trabajo de los archivos exportados. Es TEMPORAL: cada archivo se borra apenas se descarga
// (y los que nadie descargó, pasada una hora) porque en producción el disco es efímero y porque cada
// archivo contiene datos de UNA tienda. `EXPORTS_DIR` permite a las pruebas usar una carpeta temporal.
const EXPORTS_DIR = process.env.EXPORTS_DIR || path.join(__dirname, '..', 'exports');
const EDAD_MAXIMA_MS = 60 * 60 * 1000;

// ventas_t<id_tienda>_<fecha>_<hora>_<sufijo>.xlsx | reportes_t<id_tienda>_...csv
// El id de la tienda va DENTRO del nombre para poder comprobarlo al descargar (hallazgo C6: antes todas
// las tiendas compartían la carpeta y cualquier usuario listaba y descargaba los archivos de las demás).
const PATRON_ARCHIVO = /^(ventas|reportes)_t(\d+)_[0-9A-Za-z_-]+\.(xlsx|csv)$/;

function nombreExport(tipo, id_tienda, extension) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T');
    const sufijo = Math.random().toString(36).substring(2, 8);
    return `${tipo}_t${id_tienda}_${timestamp[0]}_${timestamp[1].substring(0, 8)}_${sufijo}.${extension}`;
}

// Borra los exports (con el formato nuevo) que nadie descargó en la última hora. Los archivos con
// nombre antiguo o ajenos a este formato NO se tocan.
function limpiarExportsViejos() {
    try {
        const limite = Date.now() - EDAD_MAXIMA_MS;
        for (const f of fs.readdirSync(EXPORTS_DIR)) {
            if (!PATRON_ARCHIVO.test(f)) continue;
            const ruta = path.join(EXPORTS_DIR, f);
            if (fs.statSync(ruta).mtimeMs < limite) fs.unlinkSync(ruta);
        }
    } catch (error) {
        console.warn('No se pudo limpiar la carpeta de exports:', error.message);
    }
}

// Asegurar que la carpeta exports existe
if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

class ExportController {
    /**
     * Exporta las ventas de la tienda del usuario a CSV
     * y guarda el archivo en la carpeta exports/
     */
    static async exportSales(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const ventas = await Sale.findByStore(id_tienda);

            if (!ventas || ventas.length === 0) {
                return res.status(404).json({ success: false, error: 'No hay ventas para exportar' });
            }

            // Generar contenido Excel
            const workbook = new excel.Workbook();
            const worksheet = workbook.addWorksheet('Historial de Ventas');
            
            worksheet.columns = [
                { header: 'Descripción del Producto', key: 'producto', width: 40 },
                { header: 'Categoría Comercial', key: 'categoria', width: 25 },
                { header: 'Unidades Vendidas', key: 'cantidad', width: 20 },
                { header: 'Ingreso Bruto ($)', key: 'precio_total', width: 20 },
                { header: 'Fecha de Transacción', key: 'fecha', width: 25 }
            ];
            
            // Apply header styling
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
            worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            ventas.forEach(v => {
                worksheet.addRow({
                    producto: v.nombre_producto,
                    categoria: v.categoria,
                    cantidad: v.cantidad,
                    precio_total: v.precio_total,
                    fecha: v.fecha_salida
                });
            });

            limpiarExportsViejos();
            const filename = nombreExport('ventas', id_tienda, 'xlsx');
            const filePath = path.join(EXPORTS_DIR, filename);

            // Guardar archivo
            await workbook.xlsx.writeFile(filePath);

            res.json({
                success: true,
                message: `Archivo exportado correctamente`,
                filename: filename,
                path: `exports/${filename}`,
                totalRegistros: ventas.length
            });
        } catch (error) {
            console.error('Error exportando ventas:', error);
            res.status(500).json({ success: false, error: 'Error exportando ventas' });
        }
    }

    /**
     * Exporta los reportes de la tienda del usuario a CSV
     * y guarda el archivo en la carpeta exports/
     */
    static async exportReports(req, res) {
        try {
            const id_tienda = req.session.tiendaId;
            const reportes = await Report.findByStore(id_tienda);

            if (!reportes || reportes.length === 0) {
                return res.status(404).json({ success: false, error: 'No hay reportes para exportar' });
            }

            // Generar contenido CSV
            const headers = 'ID,Título,Descripción,Fecha,Creador,Tipo,Fecha de Creación\n';
            const rows = reportes.map(r => {
                const titulo = (r.titulo || '').replace(/"/g, '""');
                const descripcion = (r.descripcion || '').replace(/"/g, '""');
                const creador = (r.creador || '').replace(/"/g, '""');
                const tipo = (r.tipo || '').replace(/"/g, '""');
                return `${r.id},"${titulo}","${descripcion}","${r.fecha_reporte}","${creador}","${tipo}","${r.creado_en || ''}"`;
            }).join('\n');

            const csvContent = headers + rows;

            limpiarExportsViejos();
            const filename = nombreExport('reportes', id_tienda, 'csv');
            const filePath = path.join(EXPORTS_DIR, filename);

            // Guardar archivo
            fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf8');

            res.json({
                success: true,
                message: `Archivo exportado correctamente`,
                filename: filename,
                path: `exports/${filename}`,
                totalRegistros: reportes.length
            });
        } catch (error) {
            console.error('Error exportando reportes:', error);
            res.status(500).json({ success: false, error: 'Error exportando reportes' });
        }
    }

    /**
     * Descarga un archivo exportado y lo borra en cuanto termina de enviarse.
     * Solo se sirve si el nombre tiene el formato esperado Y su id de tienda es el de la sesión;
     * en cualquier otro caso (formato antiguo, otra tienda, inexistente) responde 404 sin distinguirlos.
     */
    static async downloadExport(req, res) {
        try {
            const filename = req.params.filename;
            const coincide = PATRON_ARCHIVO.exec(filename);
            if (!coincide || Number(coincide[2]) !== Number(req.session.tiendaId)) {
                return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
            }

            const filePath = path.join(EXPORTS_DIR, filename);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ success: false, error: 'Archivo no encontrado' });
            }

            res.download(filePath, filename, (err) => {
                if (err) {
                    // Si la descarga se cortó, el archivo queda y lo barre limpiarExportsViejos() más tarde.
                    console.error('Error enviando archivo exportado:', err.message);
                    return;
                }
                fs.unlink(filePath, () => {});
            });
        } catch (error) {
            console.error('Error descargando archivo:', error);
            res.status(500).json({ success: false, error: 'Error descargando archivo' });
        }
    }
}

module.exports = ExportController;
