/**
 * Reglas de negocio y seguridad para autenticación de dos factores (2FA) en acciones CRUD.
 */

export const ACCIONES_CRUD_RESTRINGIDAS = [
  'crear',
  'editar',
  'eliminar',
  'importar',
  'estado',
  'vincular',
  'oferta'
];

/**
 * Determina si una acción específica requiere obligatoriamente que el usuario configure 2FA.
 * 
 * @param {Object|null} user - Datos del usuario en sesión.
 * @param {string} accion - Tipo de acción intentada ('crear', 'editar', 'eliminar', 'importar', 'estado', 'vincular', 'oferta', 'leer', etc.).
 * @returns {boolean} - true si la acción está bloqueada por falta de 2FA.
 */
export function requiereConfigurar2FAParaAccion(user, accion = 'crear') {
  if (!user || !user.needs2FASetup) {
    return false;
  }
  const accionNormalizada = String(accion || '').trim().toLowerCase();
  return ACCIONES_CRUD_RESTRINGIDAS.includes(accionNormalizada);
}

/**
 * Determina si se debe desplegar el modal de 2FA.
 * 
 * @param {Object|null} user - Datos del usuario en sesión.
 * @param {boolean} descartadoEnSesion - Indica si el usuario ya pospuso el 2FA en esta sesión de navegación.
 * @returns {boolean} - true si debe mostrarse el modal.
 */
export function debeMostrarModal2FA(user, descartadoEnSesion = false) {
  if (!user || !user.needs2FASetup) {
    return false;
  }
  return !descartadoEnSesion;
}

/**
 * Genera el mensaje descriptivo cuando una acción es bloqueada por no tener 2FA.
 * 
 * @param {string} accion - Tipo de acción.
 * @returns {string} - Mensaje claro para el usuario.
 */
export function obtenerMensajeBloqueo2FA(accion = '') {
  const normalizada = String(accion || '').trim().toLowerCase();
  switch (normalizada) {
    case 'crear':
      return 'Debes configurar la autenticación 2FA antes de registrar nuevos productos o registros.';
    case 'editar':
      return 'Debes configurar la autenticación 2FA antes de editar productos o registros.';
    case 'eliminar':
      return 'Debes configurar la autenticación 2FA antes de eliminar productos o registros.';
    case 'importar':
      return 'Debes configurar la autenticación 2FA antes de importar productos.';
    case 'estado':
      return 'Debes configurar la autenticación 2FA antes de cambiar el estado de un producto.';
    case 'vincular':
      return 'Debes configurar la autenticación 2FA antes de vincular códigos de barra.';
    case 'oferta':
      return 'Debes configurar la autenticación 2FA antes de activar ofertas.';
    default:
      return 'Debes configurar la autenticación de dos factores (2FA) antes de realizar modificaciones.';
  }
}
