import { describe, it, expect } from 'vitest';
import {
  mensajesRecomendaciones, mensajesPromociones, contextoPromocionesDelDueno, mensajesRiesgoCliente
} from '../../services/ia/prompts.js';

describe('mensajesRecomendaciones', () => {
  const candidatos = [{ id: 1, nombre: 'Arroz', base_load: 10 }];
  const [sistema, usuario] = mensajesRecomendaciones(candidatos);

  it('envía un mensaje de sistema y uno de usuario', () => {
    expect(sistema.role).toBe('system');
    expect(usuario.role).toBe('user');
  });

  it('el sistema fija los límites por clase y el formato de respuesta', () => {
    expect(sistema.content).toContain('Clase A (max +100%), Clase B (max +50%), Clase C (max +20%)');
    expect(sistema.content).toContain('"adjustments"');
  });

  it('el usuario lleva los productos críticos como JSON', () => {
    expect(usuario.content).toContain(JSON.stringify(candidatos));
  });
});

describe('mensajesPromociones', () => {
  const candidatos = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it('incluye el contexto del dueño dentro del mensaje de sistema', () => {
    const [sistema] = mensajesPromociones(candidatos, '\n\nEJEMPLOS DE DECISIONES DEL DUEÑO: ...');
    expect(sistema.content).toContain('EJEMPLOS DE DECISIONES DEL DUEÑO');
  });

  it('sin contexto del dueño no deja rastro ("undefined") en el texto', () => {
    const [sistema] = mensajesPromociones(candidatos);
    expect(sistema.content).not.toContain('undefined');
  });

  it('exige una sugerencia por cada producto y limita el descuento', () => {
    const [sistema, usuario] = mensajesPromociones(candidatos);
    expect(sistema.content).toContain('UNA sugerencia por CADA producto');
    expect(sistema.content).toContain('Descuento máximo: 30%');
    expect(usuario.content).toContain('estos 3 productos');
    expect(usuario.content).toContain(JSON.stringify(candidatos));
  });
});

describe('contextoPromocionesDelDueno', () => {
  it('sin ejemplos devuelve cadena vacía', () => {
    expect(contextoPromocionesDelDueno([])).toBe('');
    expect(contextoPromocionesDelDueno(null)).toBe('');
    expect(contextoPromocionesDelDueno(undefined)).toBe('');
  });

  it('lista cada decisión previa del dueño', () => {
    const texto = contextoPromocionesDelDueno([
      { nombre_producto: 'Pan', categoria: 'Panadería', descuento_porcentaje: 30, motivo: 'Se vence mañana' },
      { nombre_producto: 'Jugo', categoria: 'Bebidas', descuento_porcentaje: 10, motivo: 'Poca rotación' }
    ]);
    expect(texto).toContain('EJEMPLOS DE DECISIONES DEL DUEÑO');
    expect(texto).toContain('Producto: "Pan", Categoria: Panadería, Descuento Aplicado: 30%. Motivo del dueño: "Se vence mañana"');
    expect(texto).toContain('Producto: "Jugo"');
  });
});

describe('mensajesRiesgoCliente', () => {
  const historial = { id_cliente: 4, total_compras_fiadas: 50000, saldo_pendiente_actual: 20000 };
  const { messages, userPrompt } = mensajesRiesgoCliente(historial);

  it('devuelve el prompt de usuario aparte porque también se guarda en la auditoría', () => {
    expect(messages[1].content).toBe(userPrompt);
  });

  it('envía exactamente el historial que recibe (el servicio decide qué datos entran)', () => {
    expect(userPrompt).toContain(JSON.stringify(historial, null, 2));
  });

  it('pide un perfil y un riesgo con valores cerrados', () => {
    expect(messages[0].content).toContain('"Buen Pagador" | "Regular" | "Mal Pagador" | "Cliente Nuevo"');
    expect(messages[0].content).toContain('"Bajo" | "Medio" | "Alto" | "Evaluando"');
  });
});
