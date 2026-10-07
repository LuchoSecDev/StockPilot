import { describe, it, expect } from 'vitest';
import {
  requiereConfigurar2FAParaAccion,
  debeMostrarModal2FA,
  obtenerMensajeBloqueo2FA,
  ACCIONES_CRUD_RESTRINGIDAS
} from '../../frontend/src/utils/security2FA.js';

describe('Reglas de Seguridad y Validación 2FA en Acciones CRUD', () => {

  describe('requiereConfigurar2FAParaAccion', () => {
    it('debe permitir cualquier acción si el usuario no tiene needs2FASetup activo (ej. Tendero o Admin con 2FA)', () => {
      const userCon2FA = { id: 1, rol: 'Administrador', needs2FASetup: false };
      const tendero = { id: 2, rol: 'Tendero', needs2FASetup: false };

      ACCIONES_CRUD_RESTRINGIDAS.forEach(accion => {
        expect(requiereConfigurar2FAParaAccion(userCon2FA, accion)).toBe(false);
        expect(requiereConfigurar2FAParaAccion(tendero, accion)).toBe(false);
      });
    });

    it('debe permitir acciones si el usuario es null o undefined', () => {
      expect(requiereConfigurar2FAParaAccion(null, 'crear')).toBe(false);
      expect(requiereConfigurar2FAParaAccion(undefined, 'editar')).toBe(false);
    });

    it('debe bloquear y exigir 2FA en todas las acciones CRUD cuando needs2FASetup es true', () => {
      const adminSin2FA = { id: 1, rol: 'Administrador', needs2FASetup: true };

      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'crear')).toBe(true);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'editar')).toBe(true);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'eliminar')).toBe(true);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'importar')).toBe(true);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'estado')).toBe(true);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'vincular')).toBe(true);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'oferta')).toBe(true);
    });

    it('debe ser tolerante a mayúsculas y espacios en el nombre de la acción', () => {
      const adminSin2FA = { id: 1, rol: 'Administrador', needs2FASetup: true };

      expect(requiereConfigurar2FAParaAccion(adminSin2FA, '  CREAR  ')).toBe(true);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'ELIMINAR')).toBe(true);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'Estado')).toBe(true);
    });

    it('debe permitir acciones de solo lectura y navegación sin exigir 2FA', () => {
      const adminSin2FA = { id: 1, rol: 'Administrador', needs2FASetup: true };

      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'leer')).toBe(false);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'ver')).toBe(false);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'dashboard')).toBe(false);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'catalogo')).toBe(false);
      expect(requiereConfigurar2FAParaAccion(adminSin2FA, 'consultar')).toBe(false);
    });
  });

  describe('debeMostrarModal2FA', () => {
    it('debe mostrar el modal si el usuario requiere 2FA y NO ha sido descartado en la sesión', () => {
      const adminSin2FA = { id: 1, rol: 'Administrador', needs2FASetup: true };
      expect(debeMostrarModal2FA(adminSin2FA, false)).toBe(true);
    });

    it('no debe mostrar el modal si el usuario ya lo pospuso en la sesión actual', () => {
      const adminSin2FA = { id: 1, rol: 'Administrador', needs2FASetup: true };
      expect(debeMostrarModal2FA(adminSin2FA, true)).toBe(false);
    });

    it('no debe mostrar el modal si el usuario no requiere 2FA', () => {
      const adminCon2FA = { id: 1, rol: 'Administrador', needs2FASetup: false };
      expect(debeMostrarModal2FA(adminCon2FA, false)).toBe(false);
      expect(debeMostrarModal2FA(adminCon2FA, true)).toBe(false);
      expect(debeMostrarModal2FA(null, false)).toBe(false);
    });
  });

  describe('obtenerMensajeBloqueo2FA', () => {
    it('debe retornar mensajes específicos para cada acción CRUD', () => {
      expect(obtenerMensajeBloqueo2FA('crear')).toContain('registrar nuevos productos');
      expect(obtenerMensajeBloqueo2FA('editar')).toContain('editar productos');
      expect(obtenerMensajeBloqueo2FA('eliminar')).toContain('eliminar productos');
      expect(obtenerMensajeBloqueo2FA('importar')).toContain('importar productos');
      expect(obtenerMensajeBloqueo2FA('estado')).toContain('cambiar el estado');
      expect(obtenerMensajeBloqueo2FA('vincular')).toContain('vincular códigos');
      expect(obtenerMensajeBloqueo2FA('oferta')).toContain('activar ofertas');
    });

    it('debe retornar mensaje general cuando la acción es genérica o desconocida', () => {
      expect(obtenerMensajeBloqueo2FA('otra_cosa')).toContain('realizar modificaciones');
      expect(obtenerMensajeBloqueo2FA('')).toContain('realizar modificaciones');
    });
  });

});
