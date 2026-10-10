# Propuesta: verificar que el pago de una venta sí se recibió

**Estado:** propuesta registrada el 4-oct-2026. **Actualización (9-oct-2026): la opción 2 (resumen por método de pago) se implementó el 5-oct** con el arqueo previo `[K5]` y el desglose en `[K3]` (plan 24, P24-04). Las opciones 1, 3 y 4 siguen sin implementar (P24-06). **Decisión de Luis (4-oct-2026): por ahora el sistema confía en lo que el Tendero registra.** Este documento deja anotado el problema y las opciones para retomarlo si la visita o el piloto muestran que hace falta.

## 1. El problema
StockPilot no está conectado a ningún banco, datáfono ni billetera. Una venta es una **declaración del Tendero**: «vendí esto y me pagaron así». El sistema no puede saber, por sí solo, si el dinero se recibió realmente.

## 2. Cómo se controla hoy (VERIFICADO leyendo el código y las pruebas del contrato)

| Método | Qué registra el sistema | Cómo se detecta un error o un fraude |
|---|---|---|
| **Efectivo** | Monto recibido y cambio | En el **cierre de caja** (`[K3]`): el sistema calcula cuánto debería haber (apertura + ventas en efectivo + abonos en efectivo − egresos) y lo compara con lo que el Tendero cuenta. La diferencia queda registrada y, si es significativa, genera una notificación. |
| **Tarjeta** y **Transferencia** | Solo el texto «Tarjeta» o «Transferencia» | **Nada automático.** El arqueo solo suma ventas en «Efectivo» (`models/CashRegister.js`), así que estas ventas no se contrastan con nada. |
| **Fiado** | Una deuda pendiente del cliente | El saldo del cliente (ventas fiadas menos abonos). Los abonos los registra solo el Administrador. |

Hallazgos:
- La venta **no guarda ninguna referencia del pago** (número de aprobación del datáfono, comprobante de la transferencia).
- No existe un reporte que sume las ventas **por método de pago**, salvo el arqueo de efectivo. El listado de ventas de la API (`[V3]`) tampoco incluye el método.
- Hoy el Administrador tendría que comparar a mano contra el reporte del datáfono o el extracto bancario, y el sistema no le facilita esa comparación.
- Riesgo concreto: un Tendero puede registrar una venta como «Transferencia» sin haberla recibido, y nada en el sistema lo señalaría.

## 3. Opciones (de menor a mayor esfuerzo)

| # | Opción | Qué cambia | Efecto en la app |
|---|---|---|---|
| 1 | **Referencia de pago opcional** en Tarjeta y Transferencia (últimos dígitos, número de aprobación) guardada con la venta | Una columna nueva en `Ventas` y un campo opcional en `[V2]` | Compatible: un campo nuevo opcional no rompe la app. La app lo mostraría como un campo más al cobrar. |
| 2 | **Resumen por método de pago** en el cierre de caja y para el Administrador: cuánto se vendió por Efectivo, Tarjeta y Transferencia en el turno o en el día | Un endpoint o campos nuevos en el arqueo `[K3]` y una vista web | Compatible (campos nuevos). Permite comparar el total de tarjeta y transferencia contra el datáfono y el banco al cerrar. |
| 3 | **Foto del comprobante**, como ya existe con los egresos | Una columna y validación de imagen | Cabe en el mismo tope de ~750 KB (ver `[K4]`); pesa más en la app y en el celular. |
| 4 | **Integración con pasarelas de pago** (Nequi, Daviplata u otras) | Proyecto aparte: contratos, seguridad, costos | Es lo único que **confirma de verdad** el pago. No es para el piloto. |

## 4. Recomendación (si se decide actuar)
Opciones **1 y 2**: son pequeñas, no rompen la app y dan al Administrador algo concreto con lo que comparar. Cualquier cambio de este tipo debe entrar **antes del arranque del piloto**, porque durante las 6 semanas la API se congela (plan 22, sección 5, bloque D). Seguiría la regla del contrato: código, prueba y documento en el mismo commit.

## 5. Cuándo retomarlo
- Si en la **visita a las tiendas** (plan 22, bloque B) los dueños dicen que cobran mucho por tarjeta o transferencia y desconfían de lo que registran sus empleados.
- Si durante el **piloto** aparecen diferencias entre lo vendido por esos métodos y lo que llega al banco.
- Pregunta para la visita: **¿qué porcentaje de las ventas es en efectivo, y cómo comparan hoy lo registrado contra el datáfono o el banco?**
