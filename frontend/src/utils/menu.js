// Qué enlaces del menú lateral ve cada persona. Sin React ni íconos, para poder probarlo
// (tests/business_logic/menu_modo_basico.test.js). Sidebar.jsx le pone el ícono a cada enlace según su ruta.
//
// Dos ejes independientes:
//   - el ROL decide qué puede abrir (los enlaces `soloAdmin` no existen para el Colaborador);
//   - el MODO decide qué se muestra: 'avanzado' enseña todo lo del rol; 'basico' solo lo marcado `basico`.
// El modo básico OCULTA del menú, no bloquea la ruta (plan 19, 3.4.3, fase B): quien llegue a /reportes por un
// enlace directo la ve igual, porque la protección real de cada pantalla sigue siendo la del rol.

export const MODOS_INTERFAZ = ['basico', 'avanzado'];

/** Las 5 vistas del modo básico (plan 19, 3.4.2), más «Vista general», que es donde se ve cuánto se vendió. */
const ENLACES = [
  { to: '/dashboard',        text: 'Vista general',    basico: true },
  { to: '/ventas',           text: 'Punto de Venta',   basico: true },
  { to: '/productos',        text: 'Catálogo',         basico: true },
  // Solo del Administrador: armar, aprobar y recibir pedidos mueve dinero (la fase D, que se lo daría al Colaborador, queda para después).
  { to: '/pedir',            text: '¿Qué pido?',       soloAdmin: true, basico: true },
  { to: '/alertas',          text: 'Monitor Alertas',  basico: true },
  { to: '/tiendas',          text: 'Mi Tienda',        textoAdmin: 'Mis Tiendas' },
  { to: '/cartera',          text: 'Cartera (Fiados)', soloAdmin: true },
  { to: '/movimientos',      text: 'Movimientos',      soloAdmin: true, id: 'nav-movimientos' },
  { to: '/comunicados',      text: 'Comunicados',      soloAdmin: true },
  { to: '/proveedores',      text: 'Proveedores AI',   soloAdmin: true },
  { to: '/analitica-visual', text: 'Analítica Visual', soloAdmin: true, id: 'nav-analitica-visual' },
  { to: '/simulador',        text: 'Simulador AI',     soloAdmin: true, id: 'nav-simulador' },
  { to: '/reportes',         text: 'Generar Reportes', soloAdmin: true },
  { to: '/auditoria',        text: 'Auditoría AI',     soloAdmin: true },
  { to: '/aprendizaje',      text: 'Aprendizaje AI',   soloAdmin: true },
  { to: '/registro-tendero', text: 'Colaboradores',    soloAdmin: true, id: 'nav-registro-tendero' },
  { to: '/perfil',           text: 'Mi Perfil',        basico: true },
];

/**
 * @param {string|undefined} rol  'Administrador' o 'Tendero' (el Colaborador).
 * @param {string|undefined} modo 'basico' o 'avanzado'. Cualquier otro valor (sesión vieja, dato ausente) enseña el
 *                                menú completo: ante la duda no se esconde nada, para que nadie se sienta «encerrado».
 * @returns {{to: string, text: string, id?: string}[]}
 */
export function enlacesDelMenu(rol, modo) {
  const esAdmin = rol === 'Administrador';
  const reducido = modo === 'basico';
  return ENLACES
    .filter((e) => (esAdmin || !e.soloAdmin) && (!reducido || e.basico))
    .map(({ to, text, textoAdmin, id }) => ({ to, text: esAdmin && textoAdmin ? textoAdmin : text, ...(id && { id }) }));
}

/** El modo al que pasaría el interruptor desde el modo actual. */
export const modoOpuesto = (modo) => (modo === 'basico' ? 'avanzado' : 'basico');
