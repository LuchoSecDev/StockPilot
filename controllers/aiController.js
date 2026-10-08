/**
 * @file aiController.js
 * @description Capa HTTP del motor de inteligencia de negocios: valida la sesión, lee los
 * parámetros, llama al servicio que corresponde y traduce el resultado (o el error) a una
 * respuesta. NO contiene SQL ni lógica de negocio: eso vive en `services/ia/` (lo que usa
 * OpenAI) y `services/inventory/` (el análisis matemático). Regla para este archivo: si un
 * método necesita más que leer `req`, llamar a UN servicio y responder, esa lógica va a un servicio.
 *
 * @module controllers/aiController
 */
const { safeError } = require('../utils/securityUtils');
const { logger } = require('../utils/logger');
const { IANoConfiguradaError, RecursoNoEncontradoError } = require('../services/errores');
const { obtenerRecomendaciones } = require('../services/ia/recomendaciones');
const { obtenerSugerenciasPromociones } = require('../services/ia/promociones');
const { aplicarEstrategiaPromocion } = require('../services/ia/estrategiaPromocion');
const { evaluarRiesgoCliente } = require('../services/ia/riesgoCliente');
const { normalizarDiasCobertura } = require('../services/inventory/analisisInventario');
const { obtenerSnapshotAnalitico } = require('../services/inventory/snapshotAnalitico');
const { obtenerTendenciaPrecios } = require('../services/inventory/tendenciaPrecios');
const { sugerirUmbralesProducto } = require('../services/inventory/umbralesProducto');

/** Lo que ve el Dashboard cuando el Consejero no pudo calcular (la pantalla no se rompe). */
const RECOMENDACION_DE_MANTENIMIENTO = {
  product: 'Inventario Gral',
  base: 'Check ROP',
  adjustment: '0%',
  final: 'N/A',
  reason: 'Motor IA en mantenimiento. Use el análisis de riesgo detallado.',
  confidence: 100,
  trend: 'estable'
};

const aiController = {
  /** GET /api/ia/recommendations — Consejero IA del dashboard. Degrada con un aviso si la IA falla. */
  getDashboardRecommendations: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      if (!tiendaId) {
        return res.status(401).json({ error: 'Sesión inválida o expirada. Por favor, inicie sesión nuevamente.' });
      }

      const { cached, recomendaciones } = await obtenerRecomendaciones(tiendaId);
      res.json({ cached, recommendations: recomendaciones });
    } catch (error) {
      if (error instanceof IANoConfiguradaError) return res.status(500).json({ error: error.message });

      logger.error({ err: error }, 'Auditor: error generando recomendaciones de IA');
      res.json({ cached: false, error: true, recommendations: [{ ...RECOMENDACION_DE_MANTENIMIENTO }] });
    }
  },

  /** GET /api/ia/snapshot?dias=N — análisis ABC/ROP sin IA. `dias` (7 a 90) fija la cobertura objetivo. */
  getAnalyticalSnapshot: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      if (!tiendaId) return res.status(401).json({ error: 'No autorizado' });

      const data = await obtenerSnapshotAnalitico(tiendaId, normalizarDiasCobertura(req.query.dias));
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: safeError(e, 'Error en análisis de inventario') });
    }
  },

  /** GET /api/ia/promotions — promociones sugeridas para productos estancados o por vencer. */
  getPromotionSuggestions: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      if (!tiendaId) return res.status(401).json({ error: 'No autorizado' });

      const { cached, promociones, sinCandidatos } = await obtenerSugerenciasPromociones(tiendaId);
      if (sinCandidatos) return res.json({ success: true, promotions: [] });
      res.json({ cached, promotions: promociones });
    } catch (error) {
      logger.error({ err: error }, 'Error generando sugerencias de promoción');
      res.status(500).json({ error: safeError(error, 'Error generando sugerencias de promoción') });
    }
  },

  /** POST /api/ia/apply-strategy — aplica una estrategia de precio aceptada por el dueño. */
  applyPromotionStrategy: async (req, res) => {
    try {
      const { id_producto, nuevo_precio, duration_days, razon, tipo } = req.body;
      if (!id_producto || !nuevo_precio) {
        return res.status(400).json({ error: 'Datos incompletos' });
      }

      const resultado = await aplicarEstrategiaPromocion(req.session.tiendaId, {
        idProducto: id_producto,
        nuevoPrecio: nuevo_precio,
        duracionDias: duration_days,
        razon,
        tipo
      });
      res.json(resultado);
    } catch (error) {
      if (error instanceof RecursoNoEncontradoError) return res.status(404).json({ error: error.message });

      logger.error({ err: error }, 'Error aplicando estrategia IA');
      res.status(500).json({ error: safeError(error, 'Error aplicando estrategia') });
    }
  },

  /** GET /api/ia/price-trend — historial de cambios de precio para la gráfica. */
  getPriceTrend: async (req, res) => {
    try {
      const trend = await obtenerTendenciaPrecios(req.session.tiendaId);
      res.json({ success: true, trend });
    } catch (e) {
      res.status(500).json({ error: safeError(e, 'Error obteniendo tendencia de precios') });
    }
  },

  /** GET /api/ia/suggest-alerts?id_producto=X&categoria=Y&id_proveedor=Z — umbrales de stock sugeridos. */
  suggestStockAlerts: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      if (!tiendaId) return res.status(401).json({ error: 'Sesión inválida' });

      const { id_producto, categoria, id_proveedor } = req.query;
      const suggestions = await sugerirUmbralesProducto(tiendaId, {
        idProducto: id_producto,
        categoria,
        idProveedor: id_proveedor
      });
      res.json({ success: true, suggestions });
    } catch (e) {
      logger.error({ err: e }, 'Error calculando sugerencias de stock');
      res.status(500).json({ error: safeError(e, 'Error calculando sugerencias de stock') });
    }
  },

  /** GET /api/ia/assess-risk/:id_cliente — riesgo crediticio de un cliente según sus fiados y abonos. */
  assessClientRisk: async (req, res) => {
    try {
      const tiendaId = req.session.tiendaId;
      if (!tiendaId) return res.status(401).json({ error: 'Sesión inválida' });

      const { esFallback, analisis } = await evaluarRiesgoCliente(tiendaId, req.params.id_cliente);
      res.json({ success: true, error: esFallback, analisis });
    } catch (e) {
      if (e instanceof IANoConfiguradaError) return res.status(500).json({ error: e.message });
      if (e instanceof RecursoNoEncontradoError) return res.status(404).json({ error: e.message });

      logger.error({ err: e }, 'Error evaluando riesgo del cliente con IA');
      res.status(500).json({ error: safeError(e, 'Error evaluando riesgo del cliente con IA') });
    }
  }
};

module.exports = aiController;
