# Validación transaccional Fase 1 pendiente

La Fase 1 de CRM y estadísticas está desplegada con validación estructural de
esquema, RLS, RPCs, índices y build. Falta ejecutar una sesión controlada con
un usuario, sucursal y producto de prueba antes de considerar validados los
flujos transaccionales.

- Venta anónima y venta con cliente.
- Pagos EFECTIVO, QR, TARJETA y MIXTO.
- Stock disminuye exactamente una vez.
- Movimiento de caja único por venta.
- Idempotencia con `client_request_id` repetido.
- Rechazo por stock insuficiente sin efectos parciales.
- Estadísticas por categoría y talla con ventas nuevas, filtros, Top N + Otros
  y rangos en `America/La_Paz`.

No usar ventas reales ni productos activos para esta validación. Registrar los
IDs de prueba, el stock y caja antes/después, y conservar o revertir los datos
según sea seguro para el historial contable.
