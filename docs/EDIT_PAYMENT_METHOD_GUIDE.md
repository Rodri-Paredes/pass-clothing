# Funcionalidad: Editar Método de Pago de Ventas

## Descripción
Se ha implementado la funcionalidad para modificar el método de pago de una venta ya registrada. Esto permite corregir errores cuando se seleccionó un método incorrecto al momento de realizar la venta.

## Características

### 1. **Edición de Método de Pago**
- Permite cambiar entre EFECTIVO, QR, TARJETA y MIXTO
- Soporta pagos mixtos con desglose de montos
- Actualiza automáticamente el flujo de caja

### 2. **Integración con Flujo de Caja**
- Los movimientos de caja se actualizan automáticamente cuando se cambia el método de pago
- Se eliminan los movimientos antiguos y se crean los nuevos
- Funciona tanto con cajas abiertas como cerradas

## Cómo Usar

### Paso 1: Ver Detalle de Venta
1. Ve a la página de **Ventas**
2. En el historial de ventas, haz clic en cualquier venta para ver su detalle

### Paso 2: Editar Método de Pago
1. En el modal de detalle de venta, verás el método de pago actual
2. Haz clic en el ícono de **editar** (lápiz) junto al método de pago
3. Se abrirá un modal con las opciones de pago

### Paso 3: Seleccionar Nuevo Método
1. Elige el nuevo método de pago:
   - **Efectivo**: Pago completo en efectivo
   - **QR**: Pago completo por QR
   - **Tarjeta**: Pago completo con tarjeta
   - **Mixto**: Combinación de métodos

### Paso 4: Completar Detalles (solo para pago mixto)
Si seleccionas **Mixto**:
1. Ingresa los montos para cada método de pago
2. El sistema verifica que la suma coincida con el total de la venta
3. No podrás guardar si los montos no coinciden

### Paso 5: Guardar Cambios
1. Haz clic en **"Guardar Cambios"**
2. El sistema actualizará:
   - El método de pago de la venta
   - Los movimientos en el flujo de caja
   - El historial de ventas

## Casos de Uso

### Ejemplo 1: Cambio Simple
**Situación**: Se registró una venta como EFECTIVO pero fue QR

**Solución**:
1. Abrir detalle de la venta
2. Clic en editar método de pago
3. Seleccionar QR
4. Guardar

### Ejemplo 2: Cambio a Pago Mixto
**Situación**: Se registró como EFECTIVO pero el cliente pagó $50 en efectivo y $50 con QR

**Solución**:
1. Abrir detalle de la venta (Total: $100)
2. Clic en editar método de pago
3. Seleccionar MIXTO
4. Ingresar:
   - Efectivo: $50
   - QR: $50
   - Tarjeta: $0
5. Verificar que el total sea $100
6. Guardar

### Ejemplo 3: Corrección de Mixto a Simple
**Situación**: Se registró como MIXTO pero en realidad fue todo QR

**Solución**:
1. Abrir detalle de la venta
2. Clic en editar método de pago
3. Seleccionar QR
4. Guardar (los detalles de pago mixto se eliminan automáticamente)

## Validaciones

### El sistema valida:
- ✅ Para pago mixto, la suma de los montos debe ser igual al total de la venta
- ✅ Los montos no pueden ser negativos
- ✅ El usuario debe tener permisos para la sucursal de la venta

## Impacto en el Sistema

### Flujo de Caja
- Los movimientos se actualizan automáticamente mediante un trigger en la base de datos
- Se eliminan los movimientos antiguos relacionados con la venta
- Se crean nuevos movimientos con el método actualizado
- Funciona con cajas abiertas y cerradas

### Historial
- La venta mantiene su fecha y hora original
- El total de la venta no cambia
- Solo se actualiza el campo `payment_type` y `payment_details`

## Archivos Modificados

### Base de Datos
- `supabase/migrations/20250124_update_payment_method_cash_flow.sql`
  - Función y trigger para actualizar movimientos de caja

### Backend/Servicios
- `src/services/salesService.ts`
  - Nuevo método: `updatePaymentMethod()`

### Estado Global
- `src/store/salesStore.ts`
  - Nuevo método: `updatePaymentMethod()`

### Componentes UI
- `src/components/sales/EditPaymentMethodModal.tsx`
  - Modal para editar método de pago

### Páginas
- `src/pages/SalesPage.tsx`
  - Integración del botón de edición
  - Manejo del modal de edición

## Permisos
- Los **administradores** pueden editar ventas de cualquier sucursal
- Los **vendedores** pueden editar ventas de su sucursal asignada

## Notas Importantes

⚠️ **Advertencias**:
- Los cambios en el método de pago son permanentes
- No hay un historial de cambios (considera agregarlo si es necesario)
- La edición no requiere confirmación adicional

💡 **Recomendaciones**:
- Usa esta función con cuidado
- Verifica el método de pago correcto antes de guardar
- En caso de dudas, consulta el detalle de la venta antes de editar

## Migración de Base de Datos

Para aplicar esta funcionalidad, ejecuta la migración:

```sql
-- Archivo: 20250124_update_payment_method_cash_flow.sql
-- Esta migración crea el trigger automático para actualizar
-- los movimientos de caja cuando se modifica el método de pago
```

Asegúrate de ejecutar esta migración en tu base de datos Supabase antes de usar la funcionalidad.
