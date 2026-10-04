# Ejemplos de petición y respuesta de la API de la app del Tendero

Cada archivo `.json` de esta carpeta es **una llamada real** al servidor (la petición completa y su respuesta), con datos de una tienda inventada. Sirven para ver cómo es cada llamada y para **simular el servidor en las pruebas de la app** sin depender de que Render esté despierto. La referencia oficial sigue siendo `docs/contrato_api_app_tendero.md`.

## Cómo leerlos
- El nombre es `NN_ID_descripcion.json`. `NN` es el orden dentro del flujo, e `ID` es el del contrato (`S2`, `V2`, `K4`…).
- Cada archivo tiene `descripcion`, `peticion` (método, ruta, cabeceras y cuerpo) y `respuesta` (estado, cabeceras relevantes y cuerpo).
- `01` a `29` son un turno completo de un Tendero en orden: sesión, caja, catálogo, venta, egreso, recepción y cierre. Los ids de venta, producto o cliente que aparecen salen de ese flujo.
- `40` a `44` son el segundo factor del Administrador. `50` y `51` son el primer inicio de sesión con contraseña temporal.

## Qué NO son
- **No son datos reales.** La tienda, los productos y las personas son inventados.
- Lo que cambia en cada ejecución aparece como marcador: `<token CSRF: …>`, `<valor opaco>` en la cookie, `<contraseña>`, y una fecha fija (`2026-10-04T15:30:00.000Z`) en todos los campos de fecha. La app nunca debe depender de esos valores.
- La cookie de ejemplo no lleva `Secure` porque se generó en local; en el servidor desplegado sí lo lleva.
- No incluyen alertas ni notificaciones (`A1`, `A2`, `O1`, `O2`), cuyo contenido genera el motor en segundo plano y no es repetible. Para esos endpoints, ver el contrato.

## Cómo se mantienen al día
Los genera y vigila la prueba `tests/integration/ejemplos_app_tendero.test.js`. Si la API cambia, esa prueba **falla**: significa que un ejemplo ya no es verdad. El cambio se acuerda primero en el contrato; después se regeneran los ejemplos con

```bash
npx vitest run --config vitest.integration.config.js tests/integration/ejemplos_app_tendero.test.js -u
```

y se revisa en el diff qué cambió antes de commitear.
