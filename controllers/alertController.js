const Alert = require('../models/Alert');

const alertController = {
  // Dispara el recálculo (suele invocarse manualmente o por cron en el futuro)
  generateAlerts: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId; 
      const cantidadGeneradas = await Alert.generate(tiendaId);
      res.json({ success: true, generadas: cantidadGeneradas });
    } catch (e) {
      console.error('Error generando alertas:', e);
      res.status(500).json({ success: false, error: 'Hubo un error al ejecutar el motor de reglas.' });
    }
  },

  // Plan 17, O8: simula lo que generate() escribiría, sin tocar la base de datos — para revisar el
  // impacto de un cambio al motor antes de confiar en él, o auditar el estado actual a mano.
  dryRun: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      const diff = await Alert.dryRun(tiendaId);
      res.json({ success: true, ...diff });
    } catch (e) {
      console.error('Error en dry-run de alertas:', e);
      res.status(500).json({ success: false, error: 'Error al simular el motor de reglas.' });
    }
  },

  // Obtiene la lista visible de alertas activas
  getActiveAlerts: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      const filters = {};
      if (req.query.tipo) filters.tipo = req.query.tipo;
      if (req.query.severidad) filters.severidad = req.query.severidad;

      const alerts = await Alert.findActive(tiendaId, filters, req.query.limit);
      res.json({ success: true, alerts, data: alerts });
    } catch (e) {
      console.error('Error obteniendo alertas:', e);
      res.status(500).json({ success: false, error: 'Error al consultar las alertas.' });
    }
  },

  // Obtiene los conteos agregados para la navegación
  getStats: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      const stats = await Alert.getStats(tiendaId);
      res.json({ success: true, stats });
    } catch (e) {
      console.error('Error analizando stats:', e);
      res.status(500).json({ success: false, error: 'Error obteniendo resúmen de alertas.' });
    }
  },

  // Marca una alerta como resuelta
  resolveAlert: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      const alertaId = req.params.id;
      // Un id que no es numérico, o que no existe en ESTA tienda, es un 404 (antes respondía 200 sin
      // haber hecho nada, y con texto daba un 500 de la base).
      const resultado = /^\d+$/.test(alertaId) ? await Alert.resolve(alertaId, tiendaId) : null;
      if (!resultado || !resultado.changes) {
        return res.status(404).json({ success: false, error: 'Alerta no encontrada' });
      }
      res.json({ success: true, message: 'Alerta archivada.' });
    } catch {
      res.status(500).json({ success: false, error: 'Error al archivar la alerta.' });
    }
  }
};

module.exports = alertController;
