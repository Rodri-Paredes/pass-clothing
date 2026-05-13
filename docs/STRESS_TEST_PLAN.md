# Stress Test Plan — Outsiders ERP

## Objetivo
Validar el comportamiento del sistema bajo condiciones adversas antes de escalar el uso.  
Cada escenario incluye: **setup**, **pasos de ejecución**, **resultado esperado**, y **señal de fallo**.

---

## 1. Doble-click en Checkout

**Riesgo:** Dos ventas idénticas en la DB, stock decrementado dos veces.

**Setup:** Carrito con 1 unidad de stock disponible.

**Ejecución:**
1. Abrir DevTools → Network → Throttle a "Slow 3G"
2. Hacer click en "Procesar Venta" dos veces muy rápido (< 200ms entre clicks)
3. Observar red y estado del botón

**Esperado:**
- Solo 1 venta creada en `sales`
- `isProcessingRef.current` previene el segundo call
- Botón bloqueado visualmente después del primer click
- Stock decrementado solo 1 vez

**Señal de fallo:** 2 filas en `sales` con `created_at` < 1s de diferencia, stock en -1

---

## 2. Ventas Simultáneas — Mismo Producto, 2 Sucursales

**Riesgo:** No aplica directamente (stock es por sucursal), pero validar por si acaso.

**Setup:** Producto con stock 2 en Cochabamba.

**Ejecución:**
1. Abrir 2 sesiones del ERP en Cochabamba con el mismo vendedor
2. Añadir el mismo producto al carrito en ambas sesiones
3. Hacer click en "Procesar Venta" en ambas simultáneamente

**Esperado:**
- Ambas ventas se procesan si stock ≥ 2
- `decrement_stock_atomic` garantiza que quantity no baja de 0

**Señal de fallo:** Stock negativo en `SELECT quantity FROM stock WHERE variant_id = X AND branch_id = Y`

---

## 3. Ventas Simultáneas — Último Producto (Stock = 1)

**Riesgo crítico:** Dos clientes compran el último artículo al mismo tiempo.

**Setup:**
```sql
UPDATE stock SET quantity = 1 WHERE variant_id = '<id>' AND branch_id = '<id>';
```

**Ejecución:**
1. Abrir 2 sesiones con el mismo item en carrito
2. Click simultáneo en "Procesar Venta"
3. Revisar stock resultante

**Esperado:**
- Una venta procesada exitosamente
- La otra falla con "Stock insuficiente al momento de confirmar la venta"
- Stock = 0 (no negativo)
- Toast de error en la sesión que falló

**Señal de fallo:** Dos filas en `sale_items` con `variant_id = X`, stock = -1

**SQL para verificar:**
```sql
SELECT quantity FROM stock WHERE variant_id = '<id>' AND branch_id = '<id>';
-- Debe ser >= 0
```

---

## 4. Pérdida de Conexión Durante Venta

**Riesgo:** Venta a medias — sale creado pero items/stock no actualizados.

**Setup:** DevTools → Network → Offline durante la transacción.

**Ejecución:**
1. Agregar items al carrito
2. Click en "Procesar Venta"
3. Justo cuando la petición sale → Network → Offline
4. Esperar error
5. Volver a Online

**Esperado (estado actual — multi-step):**
- Toast de error "Venta fallida: ..."
- Posible orphaned sale en DB si `sales` insert completó antes del corte
- Stock **no** decrementado si `decrement_stock_atomic` no llegó

**Esperado (después de migrar a `create_sale_atomic`):**
- Toda la transacción hace rollback
- 0 filas huérfanas
- Toast de error limpio

**SQL de verificación:**
```sql
-- Buscar ventas sin sale_items (huérfanas)
SELECT s.id, s.total, s.created_at
FROM sales s
WHERE NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id)
ORDER BY s.created_at DESC
LIMIT 10;
```

---

## 5. Refresh de Página Durante Transacción

**Riesgo:** El usuario presiona F5 mientras se procesa el pago.

**Ejecución:**
1. Click en "Procesar Venta"
2. F5 inmediatamente
3. Verificar si la venta se completó en DB

**Esperado:**
- Si el request llegó al servidor y completó → venta existe en DB correctamente
- Si el request no llegó → nada en DB
- No hay estado a medias (transacciones son atómicas a nivel Supabase)
- Al volver a la página, el carrito está vacío (estado React no persiste)

---

## 6. Expiración de Sesión Durante Operación

**Riesgo:** JWT expirado → API calls retornan 401 → errores silenciosos o comportamiento indefinido.

**Ejecución:**
1. Iniciar sesión
2. Esperar expiración natural (~1h) **O** forzar manipulando el localStorage:
   ```js
   // En consola del navegador:
   const key = Object.keys(localStorage).find(k => k.includes('supabase.auth.token'));
   const session = JSON.parse(localStorage.getItem(key));
   session.access_token = 'expired_token';
   localStorage.setItem(key, JSON.stringify(session));
   ```
3. Intentar procesar una venta
4. Intentar cargar el dashboard

**Esperado:**
- `onAuthStateChange` detecta `SIGNED_OUT` → store limpiado
- App redirige a LoginPage automáticamente
- Toast de error informativo (no pantalla en blanco)

**Señal de fallo:** Pantalla vacía, spinner infinito, o error un-caught en consola.

---

## 7. Caja Cerrándose Durante una Venta

**Riesgo:** Se cierra la caja mientras un vendedor está procesando una venta. La venta debería procesarse aunque no haya registro de caja activa, o fallar con mensaje claro.

**Ejecución:**
1. Admin cierra la caja en sucursal X (CashClosurePage → cerrar caja)
2. Simultáneamente, vendedor en sucursal X procesa una venta

**Casos a validar:**
- a) La venta completa antes del cierre → OK
- b) La venta intenta completar después del cierre → depende de si hay restricción FK en sales → cash_registers
- c) Intentar agregar movimiento de caja con caja cerrada → error manejado

**SQL para verificar:**
```sql
-- Ver si hay ventas sin caja activa en el momento de la venta
SELECT s.id, s.created_at, s.branch_id
FROM sales s
WHERE NOT EXISTS (
  SELECT 1 FROM cash_registers cr
  WHERE cr.branch_id = s.branch_id
    AND cr.opened_at <= s.created_at
    AND (cr.closed_at IS NULL OR cr.closed_at >= s.created_at)
)
ORDER BY s.created_at DESC;
```

---

## 8. Stock Llegando a 0 Simultáneamente desde 3 Clientes

**Setup:**
```sql
UPDATE stock SET quantity = 3 WHERE variant_id = '<id>' AND branch_id = '<id>';
```

**Ejecución:**
1. Abrir 3 tabs, una por vendedor simulado (o 3 máquinas)
2. Cada una añade 1 unidad del mismo producto
3. Click simultáneo

**Esperado:**
- 3 ventas exitosas, stock = 0
- Si una llega tarde y stock < 1 → error limpio
- Nunca stock negativo

---

## 9. Fallo de RPC (Supabase Function Error)

**Ejecución:**
```sql
-- Temporalmente romper la función:
DROP FUNCTION IF EXISTS decrement_stock_atomic(UUID, UUID, INTEGER);
```
1. Intentar procesar una venta
2. Observar comportamiento

**Esperado:**
- Toast `rpc_failure: Error al actualizar el stock`
- Error registrado en `errorLogService` con categoría `rpc`
- **No** quedan orphaned sales gracias a `create_sale_atomic` (post-migración)

**Restaurar:**
```sql
-- Restore from migration file
```

---

## 10. Timeout de Red (Slow Connection)

**Ejecución:**
1. DevTools → Network → "Slow 3G" (10kb/s)
2. Navegar a Punto de Venta → cargar productos
3. Procesar una venta
4. Cargar el Dashboard

**Esperado:**
- Productos cargan con skeleton/loading states
- Venta espera máximo 30s antes de timeout del browser
- Sin estados colgados si el usuario navega a otra página
- No hay `isLoading` infinito

---

## 11. Usuario Trabajando en Dos Pestañas Simultáneamente

**Riesgo:** Estado desincronizado — stock actualizado en tab A, tab B muestra datos viejos.

**Ejecución:**
1. Tab A: Procesar venta de 5 unidades de Producto X
2. Tab B (misma sesión): intentar vender 5 unidades de Producto X (antes de recargar)
3. Observar cuál sucede primero a nivel DB

**Esperado (estado actual sin Realtime):**
- Tab B hace validación local con stock stale
- Al procesar, `decrement_stock_atomic` RPC falla si stock = 0
- Toast de error correcto en Tab B

**Mejora recomendada:** Supabase Realtime para stock updates entre tabs.

---

## 12. Datos Corruptos / XSS Via Input

**Ejecución:**
1. En campo de búsqueda de productos, ingresar: `<script>alert(1)</script>`
2. En campo de notas de venta: ingresar `'; DROP TABLE sales; --`
3. En campo de descripción de movimiento de caja: ingresar HTML
4. En campo de monto: ingresar `-1`, `0`, `NaN`, `999999999`

**Esperado:**
- React escapa automáticamente valores en JSX (XSS mitigado por framework)
- Supabase parameteriza todas las queries (SQL injection imposible via client SDK)
- Validación de monto rechaza valores negativos/NaN
- Toast de error informativo

**Señal de alerta:** Si `<script>` se ejecuta → XSS real. Si texto SQL aparece como error Supabase → injection gap.

---

## 13. Load Test: 50 Ventas en Secuencia Rápida

**Propósito:** Validar que el acumulado de stock decrements es correcto y no hay drift.

**Setup:**
```sql
UPDATE stock SET quantity = 100 WHERE variant_id = '<id>' AND branch_id = '<id>';
```

**Ejecución (en browser console):**
```js
// Simular 50 ventas vía supabase client
let successes = 0;
for (let i = 0; i < 50; i++) {
  const { data, error } = await supabase.rpc('decrement_stock_atomic', {
    p_variant_id: '<variant_id>',
    p_branch_id: '<branch_id>',
    p_quantity: 1
  });
  if (data) successes++;
}
console.log('Successes:', successes); // Should be 50
```

**Verificar:**
```sql
SELECT quantity FROM stock WHERE variant_id = '<id>' AND branch_id = '<id>';
-- Should be 50 (100 - 50)
```

---

## Herramientas de Verficación Post-Test

```sql
-- 1. Stock negativo (debe ser 0)
SELECT COUNT(*) FROM stock WHERE quantity < 0;

-- 2. Ventas huérfanas (sin items)
SELECT COUNT(*) FROM sales s
WHERE NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id);

-- 3. Items sin venta
SELECT COUNT(*) FROM sale_items si
WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.id = si.sale_id);

-- 4. Run full health check
SELECT run_health_check();
```
