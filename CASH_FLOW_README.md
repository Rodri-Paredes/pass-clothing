# 🏦 Sistema de Flujo de Caja

## 📋 Descripción General

El Sistema de Flujo de Caja es una funcionalidad completa que permite gestionar la apertura, cierre y control de movimientos de caja en cada sucursal. Garantiza la integridad financiera y el control preciso de los fondos.

## 🎯 Características Principales

### ✅ **Apertura de Caja**
- **Fondo inicial**: Registro del monto con el que se abre la caja
- **Usuario responsable**: Trazabilidad de quién abre la caja
- **Observaciones**: Notas opcionales sobre la apertura
- **Validación única**: Solo una caja abierta por sucursal

### ✅ **Control Automático de Ventas**
- **Registro automático**: Todas las ventas se registran automáticamente en la caja
- **Soporte mixto**: Manejo de pagos mixtos (efectivo + QR + tarjeta)
- **Trazabilidad completa**: Cada venta queda vinculada a la caja abierta

### ✅ **Movimientos Manuales**
- **Ingresos**: Depósitos, recargas, pagos adicionales
- **Egresos**: Retiros, pagos a proveedores, gastos
- **Múltiples métodos**: Efectivo, QR, Tarjeta
- **Descripción detallada**: Registro de la razón del movimiento

### ✅ **Cierre de Caja**
- **Conteo físico**: Registro del dinero real contado
- **Cálculo automático**: Diferencia entre esperado y real
- **Observaciones**: Notas sobre sobrantes o faltantes
- **Trazabilidad**: Usuario que cierra la caja

### ✅ **Reportes y Historial**
- **Historial completo**: Todas las cajas por fecha
- **Estadísticas en tiempo real**: Montos esperados vs reales
- **Movimientos detallados**: Lista completa de transacciones
- **Exportación**: Reportes para auditoría

## 🗄️ Estructura de Base de Datos

### Tabla `cash_registers`
```sql
- id: UUID (Primary Key)
- branch_id: UUID (Foreign Key)
- user_id: UUID (Foreign Key)
- status: 'ABIERTA' | 'CERRADA'
- opening_date: Timestamp
- opening_amount: Decimal
- opening_user_id: UUID
- opening_notes: Text
- closing_date: Timestamp
- closing_amount: Decimal
- closing_user_id: UUID
- closing_notes: Text
- expected_cash: Decimal
- expected_qr: Decimal
- expected_card: Decimal
- expected_total: Decimal
- cash_difference: Decimal
```

### Tabla `cash_movements`
```sql
- id: UUID (Primary Key)
- cash_register_id: UUID (Foreign Key)
- movement_type: 'INGRESO' | 'EGRESO'
- payment_type: 'EFECTIVO' | 'QR' | 'TARJETA' | 'MIXTO'
- amount: Decimal
- description: Text
- reference_id: UUID (Opcional)
- reference_type: Text (Opcional)
- user_id: UUID (Foreign Key)
- created_at: Timestamp
```

## 🔧 Funciones de Base de Datos

### `open_cash_register()`
- Abre una nueva caja en una sucursal
- Valida que no haya caja abierta
- Registra el movimiento inicial

### `close_cash_register()`
- Cierra la caja activa
- Calcula montos esperados vs reales
- Registra la diferencia

### `register_sale_movement()`
- Registra automáticamente las ventas en la caja
- Maneja pagos mixtos correctamente
- Se ejecuta mediante trigger

### `get_cash_register_summary()`
- Obtiene resumen completo de una caja
- Incluye estadísticas y totales

### `get_cash_movements()`
- Lista todos los movimientos de una caja
- Incluye información del usuario

## 🚀 Instalación

### 1. Ejecutar Migración
```sql
-- Ejecutar en Supabase SQL Editor
-- Archivo: supabase/migrations/20250821_cash_flow_system.sql
```

### 2. Verificar Funciones
```sql
-- Verificar que las funciones se crearon correctamente
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%cash%';
```

## 📱 Uso del Sistema

### Flujo Típico de Trabajo

#### 1. **Apertura de Caja**
```
1. Ir a "Flujo de Caja" en el menú
2. Hacer clic en "Abrir Caja"
3. Ingresar monto inicial (ej: 200.00 Bs.)
4. Agregar observaciones opcionales
5. Confirmar apertura
```

#### 2. **Durante el Día**
```
- Las ventas se registran automáticamente
- Agregar movimientos manuales si es necesario:
  * Ingresos: Depósitos, recargas
  * Egresos: Pagos, retiros
```

#### 3. **Cierre de Caja**
```
1. Contar todo el dinero físico en caja
2. Hacer clic en "Cerrar Caja"
3. Ingresar monto contado
4. Revisar diferencia calculada
5. Agregar observaciones si hay diferencias
6. Confirmar cierre
```

## 📊 Dashboard de Control

### Estado de Caja
- **Indicador visual**: Verde (abierta) / Rojo (cerrada)
- **Información de apertura**: Usuario, fecha, hora
- **Montos esperados**: Desglosado por método de pago

### Ventas del Día
- **Total de ventas**: Monto total registrado
- **Desglose por método**: Efectivo, QR, Tarjeta
- **Actualización en tiempo real**

### Movimientos de Caja
- **Lista completa**: Todos los movimientos registrados
- **Filtros visuales**: Iconos por tipo y método
- **Información detallada**: Usuario, hora, descripción

## 🔒 Seguridad y Validaciones

### Validaciones de Apertura
- ✅ Solo una caja abierta por sucursal
- ✅ Monto inicial mayor o igual a 0
- ✅ Usuario autenticado y autorizado

### Validaciones de Cierre
- ✅ Solo cerrar cajas abiertas
- ✅ Monto contado mayor o igual a 0
- ✅ Cálculo automático de diferencias

### Validaciones de Movimientos
- ✅ Solo movimientos en cajas abiertas
- ✅ Montos positivos
- ✅ Descripción obligatoria
- ✅ Usuario responsable

## 📈 Reportes Disponibles

### Historial de Cajas
- **Filtro por fechas**: Rango personalizable
- **Información completa**: Apertura, cierre, diferencias
- **Estado visual**: Abierta/Cerrada con iconos

### Resumen de Caja
- **Montos esperados**: Desglosado por método
- **Diferencia calculada**: Automática
- **Total de movimientos**: Contador

### Movimientos Detallados
- **Lista cronológica**: Ordenados por fecha/hora
- **Filtros visuales**: Por tipo y método de pago
- **Información completa**: Usuario, descripción, monto

## 🛠️ Mantenimiento

### Verificación de Integridad
```sql
-- Verificar cajas sin cerrar
SELECT * FROM cash_registers WHERE status = 'ABIERTA';

-- Verificar movimientos sin caja
SELECT * FROM cash_movements cm
LEFT JOIN cash_registers cr ON cm.cash_register_id = cr.id
WHERE cr.id IS NULL;
```

### Limpieza de Datos
```sql
-- Eliminar movimientos huérfanos (si es necesario)
DELETE FROM cash_movements 
WHERE cash_register_id NOT IN (SELECT id FROM cash_registers);
```

## 🚨 Solución de Problemas

### Error: "Ya existe una caja abierta"
- **Causa**: Intento de abrir caja cuando ya hay una abierta
- **Solución**: Cerrar la caja existente primero

### Error: "No hay caja abierta en esta sucursal"
- **Causa**: Intento de registrar venta sin caja abierta
- **Solución**: Abrir caja antes de procesar ventas

### Diferencia en Cierre de Caja
- **Verificar**: Conteo físico vs registros del sistema
- **Revisar**: Movimientos manuales agregados
- **Documentar**: Observaciones en el cierre

## 📞 Soporte

Para problemas técnicos o consultas sobre el sistema de flujo de caja:

1. **Verificar logs**: Revisar consola del navegador
2. **Validar datos**: Verificar información en Supabase
3. **Documentar**: Registrar pasos para reproducir el problema

---

**¡El Sistema de Flujo de Caja está diseñado para garantizar el control financiero preciso y la trazabilidad completa de todos los movimientos!** 💰✨

