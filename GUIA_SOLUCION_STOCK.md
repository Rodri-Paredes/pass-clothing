# 🔧 GUÍA DE IMPLEMENTACIÓN - Opción 2: Eliminar Triggers Automáticos

## 📝 Problema Identificado
El stock se está reduciendo automáticamente (probablemente el doble) porque:
- El código de aplicación (salesService.ts) resta el stock manualmente ✅
- Puede haber triggers en la base de datos que también restan stock automáticamente ❌

## 🎯 Solución: Eliminar Triggers Automáticos

### PASO 1: Ejecutar la Migración en Supabase

Tienes 2 opciones para ejecutar la migración:

#### **Opción A: Desde el Panel Web de Supabase (MÁS FÁCIL)**

1. Ve a tu proyecto en: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **SQL Editor** en el menú lateral
4. Copia y pega todo el contenido del archivo:
   ```
   supabase\migrations\20250114000000_fix_stock_double_reduction.sql
   ```
5. Haz clic en **Run** (o presiona Ctrl+Enter)
6. Verifica que aparezca el mensaje: ✅ Migración completada exitosamente

#### **Opción B: Desde la Terminal (requiere configuración)**

```powershell
# 1. Primero conectar tu proyecto (solo la primera vez)
supabase link --project-ref TU_PROJECT_REF

# 2. Luego ejecutar la migración
supabase db push
```

### PASO 2: Verificar el Código de Aplicación

El archivo `src\services\salesService.ts` ya tiene el código correcto para restar stock:

**Líneas 100-102:** (NO tocar, esto debe quedarse)
```typescript
for (const item of items) {
  await this.updateStockAfterSale(item.variantId, branchId, item.quantity);
}
```

**Líneas 107-145:** La función `updateStockAfterSale()` hace:
1. Lee el stock actual
2. Calcula el nuevo stock (actual - vendido)
3. Actualiza el stock en la base de datos

✅ **Este código está correcto y debe permanecer así.**

### PASO 3: Probar que Funciona

Después de ejecutar la migración:

1. **Registra una venta de prueba:**
   - Producto: 1 unidad
   - Verifica el stock ANTES de la venta
   - Registra la venta
   - Verifica el stock DESPUÉS de la venta

2. **El stock debe reducirse EXACTAMENTE en 1 unidad**
   - Si antes era 10, después debe ser 9 ✅
   - Si antes era 10 y ahora es 8, aún hay un problema ❌

### PASO 4: Si el Problema Persiste

Si después de la migración el stock todavía se reduce de más:

1. **Ejecuta este SQL en Supabase SQL Editor:**

```sql
-- Ver todos los triggers activos
SELECT 
  t.tgname AS "Trigger",
  c.relname AS "Tabla",
  pg_get_triggerdef(t.oid) AS "Definición"
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname IN ('sale_items', 'sales', 'stock')
  AND t.tgisinternal = false
ORDER BY c.relname, t.tgname;
```

2. **Comparte el resultado conmigo** y te ayudaré a identificar qué triggers quedan.

## 📊 Resumen de Cambios

### ❌ Lo que se ELIMINA:
- Todos los triggers automáticos que restan stock
- Funciones relacionadas que ya no se usan

### ✅ Lo que se MANTIENE:
- Función `update_stock_safe()` - Usada por el código de aplicación
- Código en `salesService.ts` - Resta stock manualmente
- Trigger `trigger_update_stock_updated_at_safe` - Solo actualiza `updated_at`

## 🔍 Cómo Verificar que Está Arreglado

Después de aplicar la migración, el flujo debe ser:

```
1. Usuario registra venta en la app
   ↓
2. App crea registro en tabla 'sales'
   ↓
3. App crea registros en tabla 'sale_items'
   ↓
4. App ejecuta updateStockAfterSale() para cada item
   ↓
5. Stock se reduce SOLO por el código de aplicación
   ↓
6. NO hay triggers que reduzcan stock automáticamente
```

## 💡 Prevención para el Futuro

**Regla de oro:** 
- Si el código de aplicación controla el stock → NO uses triggers automáticos
- Si usas triggers automáticos → NO controles stock desde el código

**Nosotros elegimos:** Control desde el código de aplicación ✅

---

## 🆘 Necesitas Ayuda?

Si tienes problemas al ejecutar esto, avísame y te ayudo paso a paso.
