# Plan 04: Fase 3 - Flujo de Caja Menor, Posventa y Futura Facturación Electrónica

**Estado (revisado el 9-oct-2026):** Parcial. Vertiente A: los egresos de caja chica (punto 2) se implementaron con el plan 05; devoluciones, anulación y reimpresión siguen pendientes (P04-01 a P04-03). Vertiente B: trabajo futuro (P04-05).  
**Fecha:** 2026-09-17  

---

## 1. ¿Qué es la Fase 3 y de dónde surge?

En la evolución del sistema comercial de **StockPilot**, el flujo se dividió en etapas:

* **Fase 1 (Completada):** Modal de Cobro POS, Selección de Métodos de Pago, Cálculo de Cambio e Impresión de Ticket Térmico 80mm.
* **Fase 2 (Completada):** Sesiones de Caja (Apertura con base inicial, Cierre ciego, Arqueo de efectivo con cálculo de faltantes/sobrantes e Historial de Caja).
* **Fase 3 (Siguiente etapa):** Se compone de dos vertientes:

---

## 2. Componentes de la Fase 3

### Vertiente A: Operativa del Día a Día (Posventa y Caja Menor)

#### 1. Gestión de Posventa (Devoluciones y Anulaciones)
* **Devolución de Productos:**
  - Cuando un cliente regresa con un producto defectuoso o que desea cambiar.
  - El sistema debe reintegrar la cantidad al inventario (`stock + X`).
  - Debe reflejar la salida de dinero de la caja física (si se le devuelve efectivo) o generar un saldo/vale a favor.
* **Anulación de Tickets / Ventas:**
  - Posibilidad de anular una venta registrada por error (ej. se marcó doble o el cliente no tenía fondos al final).
  - Trazabilidad y auditoría: quién anuló la venta, motivo de la anulación y reajuste automático del arqueo esperado de la caja.
* **Reimpresión de Comprobantes:**
  - Desde el historial de ventas, reimprimir el ticket térmico en caso de que la impresora se haya quedado sin papel o el cliente lo vuelva a solicitar.

#### 2. Egresos y Gastos Menores de Caja Chica (Flujo de Caja Completo)
* Durante el día, de la gaveta de dinero sale plata no solo por devoluciones, sino por gastos operativos menores (ej. pago a repartidor de refrescos/proveedor menor en la puerta, compra de bolsas, insumos de limpieza).
* Si ese dinero sale de la caja sin registrarse, al final del turno el arqueo arrojará un **"Faltante"** engañoso.
* **Solución en Fase 3:** Botón de "Registrar Movimiento / Egreso de Caja" con monto y justificación, sumándose al balance de la sesión de caja activa.

---

### Vertiente B: Vertiente Fiscal (Facturación Electrónica Oficial)
* Generación de comprobantes fiscales legales (XML UBL 2.1, Código QR de validación tributaria y firma digital ante entidades como la DIAN).
* **Acuerdo de proyecto:** Como StockPilot está enfocado en microempresas/tiendas de barrio y para la presentación de tesis de grado, se acordó que la facturación electrónica oficial no es obligatoria para la demostración académica (se sustituye con el documento equivalente POS térmico implementado en Fase 1). Queda formulada en la arquitectura como trabajo futuro integrable mediante APIs de proveedores autorizados (ej. Facturapi, Alegra o Siigo).

> **Por verificar (9-oct-2026, P04-06):** que el tiquete térmico de `TicketPrinter.jsx` sirva como «documento equivalente POS». La Resolución DIAN 000165 de 2023 llevó el POS al formato electrónico, y las fuentes consultadas no coinciden sobre si la obligación alcanza a tiendas no responsables de IVA. Hasta consultarlo con el docente o un contador, en los documentos conviene llamarlo «comprobante de venta» y no «documento equivalente».
