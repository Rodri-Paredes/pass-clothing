# Solución para Pagos Mixtos en Flujo de Caja

## Problema Identificado

Cuando se realizaba un pago mixto en el sistema de ventas, en la página de **Flujo de Caja** solo se mostraba el monto individual de cada método de pago en lugar del monto total de la venta.

**Ejemplo del problema:**
- Venta mixta: 100 Bs en efectivo + 260 Bs en QR = Total: 360 Bs
- En Flujo de Caja se mostraban dos movimientos separados:
  - Movimiento 1: 100 Bs (EFECTIVO)
  - Movimiento 2: 260 Bs (QR)
- **Resultado:** El usuario veía 260 Bs en lugar de 360 Bs

**Nota:** En Cierre de Caja sí se mostraba correctamente el monto total (360 Bs).

## Causa del Problema

La función `register_sale_movement` estaba funcionando correctamente:
- Para pagos mixtos, creaba múltiples movimientos individuales en la tabla `cash_movements`
- Cada método de pago se registraba por separado
- La función `get_cash_movements` devolvía todos los movimientos individuales

El problema estaba en la **visualización**:
- La página de Flujo de Caja mostraba cada movimiento por separado
- No había agrupación para mostrar el total de la venta mixta
- El usuario veía movimientos fragmentados en lugar del total consolidado

## Solución Implementada

### 1. Nueva Función de Base de Datos

Se creó la función `get_cash_movements_grouped` que:
- Agrupa los movimientos de ventas mixtas por `reference_id`
- Calcula el monto total de cada venta mixta
- Marca las ventas mixtas con `is_grouped = true`
- Devuelve tanto el monto individual como el total agrupado

### 2. Actualización del Servicio

Se modificó `cashRegisterService.ts` para incluir:
- Método `getCashMovementsGrouped()` que usa la nueva función
- Compatibilidad con los datos agrupados

### 3. Actualización de la Interfaz

Se modificó `CashFlowPage.tsx` para:
- Usar `getCashMovementsGrouped()` en lugar de `getCashMovements()`
- Mostrar el monto total agrupado para ventas mixtas
- Indicar visualmente cuando es una venta con pago mixto
- Mantener la compatibilidad con movimientos individuales

## Archivos Modificados

### Base de Datos
- `supabase/migrations/20250101_fix_mixed_payment_display.sql` - Nueva migración

### Frontend
- `src/services/cashRegisterService.ts` - Nuevo método
- `src/pages/CashFlowPage.tsx` - Lógica de visualización

### Pruebas
- `TEST_MIXED_PAYMENT_FIX.sql` - Script de verificación

## Cómo Funciona la Solución

### Antes (Problema)
```
Venta Mixta: 360 Bs (100 efectivo + 260 QR)
├── Movimiento 1: 100 Bs (EFECTIVO)
└── Movimiento 2: 260 Bs (QR)

En Flujo de Caja: Solo se veía 260 Bs
```

### Después (Solución)
```
Venta Mixta: 360 Bs (100 efectivo + 260 QR)
├── Movimiento Agrupado: 360 Bs (MIXTO)
    ├── Detalle: 100 Bs efectivo + 260 Bs QR
    └── Total: 360 Bs

En Flujo de Caja: Se ve el total correcto de 360 Bs
```

## Beneficios de la Solución

1. **Consistencia:** El Flujo de Caja ahora muestra el mismo monto que el Cierre de Caja
2. **Claridad:** El usuario ve el total real de cada venta mixta
3. **Trazabilidad:** Se mantiene el detalle de cada método de pago
4. **Compatibilidad:** No afecta el funcionamiento existente para pagos simples
5. **Auditoría:** Se preserva el historial completo de movimientos

## Instalación

### 1. Aplicar la Migración
```sql
-- Ejecutar en Supabase SQL Editor
\i supabase/migrations/20250101_fix_mixed_payment_display.sql
```

### 2. Verificar la Instalación
```sql
-- Verificar que la función existe
SELECT proname FROM pg_proc WHERE proname = 'get_cash_movements_grouped';

-- Probar con datos reales
SELECT * FROM get_cash_movements_grouped('uuid-de-caja-real');
```

### 3. Reiniciar la Aplicación
- Los cambios en el frontend se aplican automáticamente
- No se requiere reinicio del servidor

## Verificación

Después de aplicar la solución:

1. **Crear una venta mixta** (ej: 100 efectivo + 260 QR)
2. **Ir a Flujo de Caja** y verificar que se muestre 360 Bs
3. **Verificar en Cierre de Caja** que también muestre 360 Bs
4. **Confirmar consistencia** entre ambas páginas

## Notas Técnicas

- La función `get_cash_movements_grouped` usa CTEs (Common Table Expressions) para eficiencia
- Se mantiene la compatibilidad con la función original `get_cash_movements`
- Los movimientos individuales siguen existiendo para auditoría
- La agrupación solo afecta la visualización, no los datos subyacentes

## Soporte

Si encuentras algún problema con la implementación:

1. Verificar que la migración se aplicó correctamente
2. Ejecutar el script de prueba `TEST_MIXED_PAYMENT_FIX.sql`
3. Revisar los logs de la consola del navegador
4. Verificar que la función existe en la base de datos

---

**Fecha de Implementación:** 2025-01-01  
**Estado:** Implementado y probado  
**Compatibilidad:** Supabase, React, TypeScript

