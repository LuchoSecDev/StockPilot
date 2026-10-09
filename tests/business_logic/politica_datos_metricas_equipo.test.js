import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Plan 22, 3.7 (P22-23). La política de datos debe decir, ANTES de la convocatoria, que el equipo consulta métricas
 * agregadas de cada tienda. El texto lo aprobó Luis tal cual; esta prueba lo fija para que nadie lo recorte sin querer
 * (un cambio de redacción aquí es un cambio legal, no de estilo). Se lee el JSX como texto porque el frontend no tiene
 * entorno de pruebas de componentes; se normaliza el espacio porque JSX parte las líneas.
 */
const RUTA = fileURLToPath(new URL('../../frontend/src/pages/PoliticaDatosPage.jsx', import.meta.url));
const texto = readFileSync(RUTA, 'utf8').replace(/\s+/g, ' ');

const PARRAFO_APROBADO =
  'Para operar y mejorar el servicio, el equipo de StockPilot consulta métricas agregadas de uso de cada tienda ' +
  '(fecha de registro, número de productos cargados, número de días con ventas y fecha del último acceso). ' +
  'Estas métricas no incluyen los montos de las ventas, los productos vendidos ni los datos de los clientes de la tienda. ' +
  'Cada consulta del equipo queda registrada.';

describe('Política de datos: métricas que consulta el equipo (plan 22, 3.7)', () => {
  it('incluye el párrafo aprobado, palabra por palabra', () => {
    expect(texto).toContain(PARRAFO_APROBADO);
  });

  it('el párrafo aparece una sola vez (no se duplicó al editar)', () => {
    expect(texto.split(PARRAFO_APROBADO).length - 1).toBe(1);
  });
});
