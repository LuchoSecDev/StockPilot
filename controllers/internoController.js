/**
 * @file internoController.js
 * @description Capa HTTP del panel interno del equipo (`/api/interno/*`). Valida la entrada, llama a UN servicio y traduce
 * el resultado o el error a una respuesta. La lógica vive en `services/interno/`. Reglas de este archivo:
 *   - la entrada se valida aquí (tipos y largos) y NO se "sanea" la contraseña: sanitizar cambiaría lo que se escribió;
 *   - un intento fallido de entrada responde SIEMPRE lo mismo, sin revelar si el usuario existe;
 *   - cada consulta de métricas deja su rastro en la bitácora ANTES de responder (sin rastro no hay datos).
 *
 * @module controllers/internoController
 */
const equipo = require('../services/interno/equipo');
const metricas = require('../services/interno/metricas');
const bitacora = require('../services/interno/bitacora');
const { RecursoNoEncontradoError } = require('../services/errores');
const { safeError } = require('../utils/securityUtils');
const { logger } = require('../utils/logger');

const { ACCIONES } = bitacora;
const MENSAJE_CREDENCIALES = 'Usuario o contraseña incorrectos.';
const MENSAJE_CODIGO = 'Código incorrecto.';
const MINUTOS_PARA_EL_CODIGO = 5;
const LARGO_MAXIMO_CAMPO = 200;

const esTextoValido = (valor) => typeof valor === 'string' && valor.length > 0 && valor.length <= LARGO_MAXIMO_CAMPO;

/** Regenera el id de sesión (anti fijación de sesión) y vacía lo que hubiera: también expulsa a una sesión de tienda del mismo navegador. */
const regenerarSesion = (req) => new Promise((resolver, rechazar) => req.session.regenerate(err => (err ? rechazar(err) : resolver())));

const idDeLaRuta = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** Responde un error inesperado sin filtrar detalles internos. */
const responderError = (res, err, mensaje) => {
  logger.error({ err }, mensaje);
  return res.status(500).json({ success: false, error: safeError(err, mensaje) });
};

const internoController = {
  /** POST /api/interno/login — paso 1: usuario y contraseña. NO da acceso: queda pendiente el código. */
  login: async (req, res) => {
    try {
      const { usuario, password } = req.body || {};
      if (!esTextoValido(usuario) || !esTextoValido(password)) {
        return res.status(400).json({ success: false, error: 'Escribe tu usuario y tu contraseña.' });
      }

      const miembro = await equipo.autenticar(usuario, password);
      if (!miembro) {
        await bitacora.registrarSinFallar({ accion: ACCIONES.LOGIN_FALLIDO, ip: req.ip, detalle: { usuario: usuario.slice(0, 100) } });
        return res.status(401).json({ success: false, error: MENSAJE_CREDENCIALES });
      }

      await regenerarSesion(req);
      req.session.internoPendiente = { idEquipo: miembro.id_equipo, hasta: Date.now() + MINUTOS_PARA_EL_CODIGO * 60_000 };
      return res.json({ success: true, requiere2FA: true });
    } catch (err) {
      return responderError(res, err, 'Error al iniciar sesión en el panel interno');
    }
  },

  /** POST /api/interno/2fa — paso 2: el código de Google Authenticator. Solo aquí se abre la sesión del equipo. */
  segundoFactor: async (req, res) => {
    try {
      const pendiente = req.session?.internoPendiente;
      if (!pendiente || pendiente.hasta < Date.now()) {
        return res.status(401).json({ success: false, error: 'Inicia sesión de nuevo.' });
      }

      const { token } = req.body || {};
      if (!esTextoValido(token)) return res.status(400).json({ success: false, error: 'Escribe el código de 6 dígitos.' });

      const idEquipo = pendiente.idEquipo;
      if (!(await equipo.aceptarSegundoFactor(idEquipo, token))) {
        await bitacora.registrarSinFallar({ idEquipo, accion: ACCIONES.SEGUNDO_FACTOR_FALLIDO, ip: req.ip });
        return res.status(401).json({ success: false, error: MENSAJE_CODIGO });
      }

      const miembro = await equipo.obtenerActivo(idEquipo);
      if (!miembro) return res.status(401).json({ success: false, error: 'Inicia sesión de nuevo.' });

      await bitacora.registrar({ idEquipo, accion: ACCIONES.LOGIN_OK, ip: req.ip });
      await regenerarSesion(req);
      req.session.interno = { idEquipo: miembro.id_equipo, nombre: miembro.nombre };
      return res.json({ success: true, equipo: { nombre: miembro.nombre } });
    } catch (err) {
      return responderError(res, err, 'Error al verificar el segundo factor');
    }
  },

  /** POST /api/interno/logout */
  logout: async (req, res) => {
    try {
      const idEquipo = req.session?.interno?.idEquipo;
      if (idEquipo) await bitacora.registrarSinFallar({ idEquipo, accion: ACCIONES.LOGOUT, ip: req.ip });
      await new Promise(resolver => (req.session ? req.session.destroy(() => resolver()) : resolver()));
      res.clearCookie('connect.sid');
      return res.json({ success: true });
    } catch (err) {
      return responderError(res, err, 'Error al cerrar la sesión del panel interno');
    }
  },

  /** GET /api/interno/sesion — para que la pantalla sepa si hay sesión (200 en ambos casos: no es un error no estar dentro). */
  sesion: async (req, res) => {
    const idEquipo = req.session?.interno?.idEquipo;
    if (req.session?.userId || !idEquipo) return res.json({ autenticado: false });
    try {
      const miembro = await equipo.obtenerActivo(idEquipo);
      return res.json(miembro ? { autenticado: true, equipo: { nombre: miembro.nombre } } : { autenticado: false });
    } catch (err) {
      return responderError(res, err, 'Error al consultar la sesión del panel interno');
    }
  },

  /** GET /api/interno/tiendas?incluirPrueba=true */
  tiendas: async (req, res) => {
    try {
      const incluirPrueba = req.query.incluirPrueba === 'true';
      await bitacora.registrar({ idEquipo: req.equipo.id_equipo, accion: ACCIONES.VER_TIENDAS, ip: req.ip, detalle: { incluirPrueba } });
      return res.json({ success: true, ...(await metricas.listarTiendas({ incluirPrueba })) });
    } catch (err) {
      return responderError(res, err, 'Error al consultar las tiendas');
    }
  },

  /** GET /api/interno/tiendas/:id */
  tienda: async (req, res) => {
    try {
      const idTienda = idDeLaRuta(req);
      if (!idTienda) return res.status(400).json({ success: false, error: 'Tienda no válida.' });

      const detalle = await metricas.detalleTienda(idTienda);
      await bitacora.registrar({ idEquipo: req.equipo.id_equipo, accion: ACCIONES.VER_TIENDA, idTienda, ip: req.ip });
      return res.json({ success: true, ...detalle });
    } catch (err) {
      if (err instanceof RecursoNoEncontradoError) return res.status(404).json({ success: false, error: err.message });
      return responderError(res, err, 'Error al consultar la tienda');
    }
  },

  /** GET /api/interno/embudo */
  embudo: async (req, res) => {
    try {
      await bitacora.registrar({ idEquipo: req.equipo.id_equipo, accion: ACCIONES.VER_EMBUDO, ip: req.ip });
      return res.json({ success: true, ...(await metricas.embudo()) });
    } catch (err) {
      return responderError(res, err, 'Error al consultar el embudo');
    }
  },

  /** GET /api/interno/bitacora?limite=50&desde=0 */
  bitacora: async (req, res) => {
    try {
      await bitacora.registrar({ idEquipo: req.equipo.id_equipo, accion: ACCIONES.VER_BITACORA, ip: req.ip });
      return res.json({ success: true, ...(await bitacora.listar({ limite: req.query.limite, desde: req.query.desde })) });
    } catch (err) {
      return responderError(res, err, 'Error al consultar la bitácora');
    }
  },

  /** PUT /api/interno/tiendas/:id/es-prueba  { esPrueba: boolean } */
  marcarPrueba: async (req, res) => {
    try {
      const idTienda = idDeLaRuta(req);
      if (!idTienda) return res.status(400).json({ success: false, error: 'Tienda no válida.' });
      const esPrueba = req.body?.esPrueba;
      if (typeof esPrueba !== 'boolean') return res.status(400).json({ success: false, error: 'esPrueba debe ser verdadero o falso.' });

      const resultado = await metricas.marcarPrueba({ idTienda, esPrueba, idEquipo: req.equipo.id_equipo, ip: req.ip });
      return res.json({ success: true, ...resultado });
    } catch (err) {
      if (err instanceof RecursoNoEncontradoError) return res.status(404).json({ success: false, error: err.message });
      return responderError(res, err, 'Error al marcar la tienda');
    }
  }
};

module.exports = internoController;
