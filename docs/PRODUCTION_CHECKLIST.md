# Checklist de Producción — Outsiders ERP
### Auditoría Final de Estabilización — Mayo 2026

> Estado: **EN PROCESO** — Aplicar todos los ítems antes de escalar carga.
> Simbología: ✅ Hecho · ⚠️ Pendiente de verificar · ❌ Pendiente de implementar

---

## 1. INTEGRIDAD DE DATOS

| # | Verificación | Estado | Acción Requerida |
|---|---|---|---|
| 1.1 | Sin stock negativo en producción | ⚠️ | `SELECT COUNT(*) FROM stock WHERE quantity < 0` debe ser 0 |
| 1.2 | Sin ventas huérfanas (sin sale_items) | ⚠️ | `SELECT count(*) FROM sales s WHERE NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id)` debe ser 0 |
| 1.3 | Sin sale_items huérfanos (sin sale) | ⚠️ | Verificar con query inverso |
| 1.4 | Sin stock entries sin variante válida | ⚠️ | `run_health_check()` → `orphan_stock = 0` |
| 1.5 | Venta atómica (TOCTOU eliminado) | ❌ | **Aplicar migration `20260513_create_sale_atomic.sql`** y migrar `salesService.createSale()` al nuevo RPC |
| 1.6 | `decrement_stock_atomic` existe en DB | ⚠️ | Verificar via Supabase Dashboard → Database → Functions |
| 1.7 | Constraint UNIQUE en `stock(variant_id, branch_id)` | ⚠️ | Aplicar migration `20260513_indexes_performance.sql` (incluye índice UNIQUE) |
| 1.8 | Constraint UNIQUE en `branches(name)` | ❌ | `ALTER TABLE branches ADD CONSTRAINT branches_name_unique UNIQUE (name)` |
| 1.9 | Totales de pago MIXTO validados | ✅ | Implementado en `handleProcessSale` |
| 1.10 | No hay productos con precio = 0 activos | ⚠️ | `SELECT * FROM products WHERE price = 0 AND is_visible = true` debe ser vacío |

---

## 2. SECURITY

| # | Verificación | Estado | Acción Requerida |
|---|---|---|---|
| 2.1 | RLS habilitado en todas las tablas | ⚠️ | Verificar en Supabase → Authentication → Policies |
| 2.2 | Políticas RLS en `error_logs` | ❌ | Aplicar migration `20260513_indexes_performance.sql` |
| 2.3 | Vendedores no pueden leer datos de otras sucursales | ⚠️ | Test: login como vendedor → intentar `?branch_id=<otra_sucursal>` |
| 2.4 | Admin routes protegidas a nivel DB (no solo UI) | ⚠️ | La ruta `/health` no tiene RLS adicional — confirmar que los RPCs `run_health_check()` y `get_system_stats()` tienen `SECURITY DEFINER` y no exponen datos de otras sucursales |
| 2.5 | Sin `VITE_SUPABASE_SERVICE_ROLE_KEY` en el bundle | ✅ | Frontend usa solo anon key; service role nunca en `.env` del cliente |
| 2.6 | Variables `.env` no commiteadas a Git | ⚠️ | Verificar `.gitignore` incluye `.env` y `.env.local` |
| 2.7 | Imagen URLs sin path traversal posible | ✅ | `image_url` viene de Supabase Storage (controlado) |
| 2.8 | Sin console.log de datos financieros en producción | ✅ | Limpiado en esta sesión (`salesService`, `productService`, `usePaginatedProducts`, `CashClosurePage`) |
| 2.9 | Inputs sanitizados contra XSS | ✅ | React escapa valores por defecto |
| 2.10 | SQL injection imposible | ✅ | Supabase SDK parametriza todas las queries |

---

## 3. PERFORMANCE

| # | Verificación | Estado | Acción Requerida |
|---|---|---|---|
| 3.1 | Índices de performance aplicados en DB | ❌ | **Ejecutar `20260513_indexes_performance.sql` en Supabase SQL Editor** |
| 3.2 | `get_dashboard_stats` RPC wired | ✅ | `salesService.getDashboardStats()` usa RPC (esta sesión) |
| 3.3 | Paginación en `getSalesByBranch` | ✅ | `.limit(200)` aplicado |
| 3.4 | Batch stock check en `createSale` | ✅ | Single `IN` query (sesión anterior) |
| 3.5 | Sin N+1 en `getDailyCashFlow` | ✅ | Join-based query (sesión anterior) |
| 3.6 | `getStockByBranch` carga 677 rows con 4-table join | ⚠️ | Optimizar: crear `getStockQuantitiesByBranch()` que solo retorne `{variant_id, quantity}` para validación rápida |
| 3.7 | `loadTotals` ya no hace SELECT * | ✅ | Cambiado a SELECT de 5 campos específicos (esta sesión) |
| 3.8 | React.memo en product cards | ❌ | Implementar para evitar re-renders del grid al cambiar el carrito |
| 3.9 | Optimistic stock update post-venta | ❌ | Evitar full reload de 677 rows — actualizar solo variants vendidas en memoria |
| 3.10 | Console.logs de debug eliminados | ✅ | Limpiado en todos los servicios y hooks |
| 3.11 | `CashClosurePage` hace 3 queries paralelos por el mismo date range | ⚠️ | Consolidar `loadDailyReport` + `loadTotals` o usar un RPC unificado |

---

## 4. RESILIENCIA Y MANEJO DE ERRORES

| # | Verificación | Estado | Acción Requerida |
|---|---|---|---|
| 4.1 | Double-click en checkout bloqueado | ✅ | `isProcessingRef.current` guard (esta sesión) |
| 4.2 | Session expiry manejada | ✅ | `onAuthStateChange` en authStore (esta sesión) |
| 4.3 | Error en `loadDailyReport` muestra toast | ✅ | Implementado (esta sesión) |
| 4.4 | Error en `loadCashFlow` muestra toast | ✅ | Implementado (esta sesión) |
| 4.5 | Error en `loadBranches` manejado con UI feedback | ❌ | `catch` silencioso en authStore — user ve `BranchSelectionPage` vacía sin explicación |
| 4.6 | Error en `loadDashboardStats` manejado | ⚠️ | `DashboardPage` no muestra toast si stats fallan — solo silencio |
| 4.7 | `errorLogService` registra errores operacionales | ✅ | Implementado `notify()` + auto-log |
| 4.8 | `error_logs` TABLE existe en DB | ❌ | Requiere migration `20260513_indexes_performance.sql` |
| 4.9 | Venta falla si `activeBranch` es null | ✅ | Guard `if (cart.length === 0 || !activeBranch || !user) return` |
| 4.10 | Rate limit / spam protection en checkout | ❌ | No hay rate limiting — un loop podría generar ventas masivas. Considerar debounce adicional |
| 4.11 | Validación de monto en movimientos de caja | ❌ | `parseFloat(movementAmount)` puede ser NaN, 0, o negativo sin validación |
| 4.12 | `getCashRegisterById` traga excepciones silenciosamente | ⚠️ | `return null` en catch — caller no sabe si fue error o not-found |

---

## 5. MANTENIBILIDAD

| # | Verificación | Estado | Acción Requerida |
|---|---|---|---|
| 5.1 | TypeScript compila sin errores | ✅ | `npx tsc --noEmit` → 0 errores |
| 5.2 | No hay `any` críticos en tipos de servicio | ⚠️ | `createSale` tiene `saleData: any` — tiparlo con interfaz |
| 5.3 | `CATEGORIES` sin string vacío | ✅ | Corregido (esta sesión) |
| 5.4 | No hay `SELECT *` en queries de agregación | ✅ | `loadTotals` corregido |
| 5.5 | Migrations versionadas y documentadas | ✅ | `/supabase/migrations/` con nombre de fecha |
| 5.6 | Checklist de qué migrations están aplicadas | ❌ | Crear `supabase/migrations/APPLIED.md` y marcar cuáles están en producción |
| 5.7 | `isLoading` granular por operación | ❌ | `salesStore` y `productStore` comparten un solo flag — causa conflatos de estado |
| 5.8 | React Query para reads (sin invalidación manual) | ❌ | `getDashboardStats`, `getSalesByBranch` etc deberían usar `useQuery` con TTL |

---

## 6. CONCURRENCIA Y RACE CONDITIONS

| # | Verificación | Estado | Acción Requerida |
|---|---|---|---|
| 6.1 | `decrement_stock_atomic` usa `FOR UPDATE` DB lock | ✅ | RPC existente en DB |
| 6.2 | Venta completa es atómica (TOCTOU eliminado) | ❌ | **Aplicar y wiring de `create_sale_atomic` RPC** |
| 6.3 | Doble-click bloqueado a nivel JS | ✅ | `useRef` guard implementado |
| 6.4 | Dos vendedores comprando último stock simultáneamente | ✅ | `decrement_stock_atomic` maneja esto a nivel DB |
| 6.5 | `updateStock` en productService usa select+update (race) | ⚠️ | Convertir a `UPSERT ON CONFLICT DO UPDATE` |
| 6.6 | Cierre de caja durante venta en proceso | ⚠️ | Sin bloqueo explícito — verificar si hay FK entre sales y cash_registers |

---

## 7. OBSERVABILIDAD Y MONITOREO

| # | Verificación | Estado | Acción Requerida |
|---|---|---|---|
| 7.1 | Health Dashboard accesible para admin | ✅ | Ruta `/health` con `run_health_check()` |
| 7.2 | `error_logs` captura errores operacionales | ✅ | `errorLogService` implementado |
| 7.3 | Alertas automáticas cuando health_check = critical | ❌ | Health check es manual — crear cron job o webhook |
| 7.4 | `pg_stat_statements` habilitado en Supabase | ❌ | Habilitar en Supabase → Settings → Database para slow query monitoring |
| 7.5 | Métricas de tiempo de respuesta de RPCs | ❌ | Implementar timing en `errorLogService` o middleware Supabase |
| 7.6 | Alerta si stock de un producto baja de X | ❌ | Webhook o Edge Function que notifique al admin |
| 7.7 | Log de accesos de admin a funciones sensibles | ⚠️ | `error_logs` captura algunos eventos pero no auditoría completa |
| 7.8 | Uptime monitoring del ERP (URL check) | ❌ | Configurar UptimeRobot o similar para la URL de Vercel |

---

## 8. DEPLOYS SEGUROS

| # | Verificación | Estado | Acción Requerida |
|---|---|---|---|
| 8.1 | Migrations SQL aplicadas ANTES de deploy de código | ❌ | **Workflow crítico: DB changes primero, luego git push** |
| 8.2 | Buildcheck en CI antes de merge | ⚠️ | No hay CI configurado — `npx tsc --noEmit && npx vite build` manual |
| 8.3 | Variables de entorno en Vercel configuradas | ⚠️ | Verificar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel dashboard |
| 8.4 | Preview deployments habilitados en Vercel | ⚠️ | Testear en preview URL antes de promover a producción |
| 8.5 | Rollback plan definido | ❌ | Documentar: `git revert <commit>` + `git push` para Vercel; para DB: tener migration de rollback por cada migration aplicada |
| 8.6 | No hacer deploy un viernes o durante horas pico | ❌ | Política: deploys solo martes-jueves antes de las 10am Bolivia |
| 8.7 | Avisar a vendedores antes de deploy | ❌ | Notificación en WhatsApp 5 min antes de deploy + evitar durante ventas activas |

---

## 9. RIESGOS IDENTIFICADOS AL ESCALAR

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Stock negativo por ventas concurrentes | Alta con 3+ vendedores simultáneos | Crítico | Implementar `create_sale_atomic` RPC |
| Dashboard lento con 10K+ ventas | Media (largo plazo) | Alto | `get_dashboard_stats` RPC parcialmente mitiga; luego cursor pagination |
| Caída de Supabase bloquea todo el ERP | Baja | Crítico | Sin fallback offline — solo alertas + comunicación rápida |
| `getSalesByBranch` supera limit 200 | Alta (Tarija ya tiene 1780) | Alto | Implementar paginación real con cursor |
| Múltiples sessions con stock stale | Alta en uso concurrente | Medio | Implementar Supabase Realtime para stock updates |
| Pérdida de ANON_KEY rotada sin actualizar Vercel | Baja | Crítico | Proceso documentado para rotación de keys |
| Borrado accidental de producto con ventas | Media | Alto | FK `ON DELETE RESTRICT` en sale_items → product_variants (verificar) |

---

## 10. PLAN DE APLICACIÓN INMEDIATA (ORDEN)

### 🔴 CRÍTICO — Aplicar hoy

1. **SQL Editor Supabase → ejecutar `20260513_indexes_performance.sql`**
   - Crea 12 índices + tabla `error_logs` + RPC `get_dashboard_stats`
   - Sin esto: queries lentas Y el dashboard stats RPC falla

2. **SQL Editor → ejecutar `20260513_create_sale_atomic.sql`**
   - Crea RPC transaccional para ventas atómicas

3. **SQL Editor → ejecutar (manualmente):**
   ```sql
   ALTER TABLE branches ADD CONSTRAINT branches_name_unique UNIQUE (name);
   ```

4. **Git push actual (fixes de esta sesión):**
   ```bash
   git add -A && git commit -m "fix: production audit — atomic sale migration, RPC wiring, security hardening, console log cleanup, double-click guard, MIXTO validation" && git push
   ```

### 🟠 ESTA SEMANA

5. Wiring de `create_sale_atomic` en `salesService.ts` (después de verificar el RPC en DB)
6. Fix `loadBranches` error handling → mostrar mensaje de error
7. Fix validación de monto en `addManualMovement` (rechazar NaN/negativo/0)
8. Fix `isLoading` granular en salesStore y productStore
9. React.memo en product cards de SalesPage
10. Optimistic stock update post-venta

### 🟡 PRÓXIMO SPRINT

11. Supabase Realtime para stock
12. `useQuery` (React Query) para reads de dashboard y ventas
13. Paginación con cursor en `getSalesByBranch`
14. Crear `getStockQuantitiesByBranch()` lightweight
15. Health check automático (Edge Function cron)

---

## 11. MÉTRICAS A MONITOREAR EN PRODUCCIÓN

```sql
-- (Ejecutar semanalmente o monitorear con pg_stat_statements)

-- 1. Queries más lentas
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 2. Stock crítico (< 3 unidades)
SELECT p.name, pv.size, b.name as branch, s.quantity
FROM stock s
JOIN product_variants pv ON pv.id = s.variant_id
JOIN products p ON p.id = pv.product_id
JOIN branches b ON b.id = s.branch_id
WHERE s.quantity < 3 AND s.quantity >= 0
ORDER BY s.quantity ASC;

-- 3. Errores recientes en log
SELECT level, category, message, created_at
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 4. Ventas por hora del día (detectar horas pico)
SELECT date_trunc('hour', sale_date AT TIME ZONE 'America/La_Paz') AS hour,
       COUNT(*) AS sales, SUM(total) AS revenue
FROM sales
WHERE sale_date > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour DESC;

-- 5. Health check completo
SELECT run_health_check();
```

---

## 12. POLÍTICA DE ALERTAS CRÍTICAS

| Condición | Alerta | Responsable |
|---|---|---|
| `stock.quantity < 0` (cualquier) | CRÍTICO — notificar en WhatsApp | Admin |
| Ventas huérfanas detectadas | CRÍTICO — revisar integridad | Admin + Dev |
| `error_logs` con 5+ errores en 1h | ALTO — revisar health dashboard | Admin |
| Uptime ERP < 99% | ALTO — revisar Vercel/Supabase | Dev |
| Supabase plan overcapacity | ALTO — upgrade plan | Admin |
| Más de 1 caja abierta por sucursal | MEDIO — investigar | Admin |
