## Actualización: Corrección definitiva de fechas y flujo de caja (America/La_Paz)

### Resumen
- Se corrigió el manejo de fechas para que TODO el sistema funcione en zona horaria America/La_Paz (UTC-4).
- Las ventas nocturnas (ej. 22:44) ahora aparecen en el mismo día del cierre y reportes.
- Se ordenaron cronológicamente los movimientos en el Flujo de Caja y se recalculan los saldos parciales correctamente.

### Problema detectado
- Ventas guardadas/interpretadas como UTC provocaban “corrimiento” al día siguiente en cierre y reportes (ej. 10/09 22:44 aparecía el 11/09).
- El Flujo de Caja mostraba saldos parciales erróneos por falta de orden cronológico al calcular el saldo acumulado.

### Solución técnica implementada
1) Inserción de ventas en hora local (Bolivia)
- Se dejó de usar `toISOString()` (UTC) al crear ventas.
- Ahora se guarda `sale_date` con offset explícito de Bolivia `-04:00`.

2) Filtros por día usando zona local en la base de datos
- Se crearon/actualizaron RPCs y funciones SQL que comparan por día con:
  - `(sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = p_day`
  - `(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/La_Paz')::date = p_day`

3) Alineación de front y back
- Servicios y página de Cierre de Caja ahora usan las RPCs de “día local” para listas, descuentos y pagos mixtos.
- En la UI del Flujo de Caja, las transacciones se ordenan por fecha/hora antes de calcular el saldo acumulado.

### Archivos modificados clave
- `src/services/salesService.ts`
  - Inserción de ventas con fecha local: guarda `YYYY-MM-DDTHH:mm:ss-04:00` en `sale_date`.

- `src/services/cashClosureService.ts`
  - `getDailyCashFlow`: usa `get_daily_sales_local` y `get_daily_cash_movements_local` (zona local) y enriquece datos (usuario/relaciones).
  - `getDailyReport`: obtiene ventas del día vía RPC de zona local y trae `sale_items` para estadísticas.

- `src/pages/CashClosurePage.tsx`
  - Listas (ventas/unidades) y métricas diarias basadas en ventas del día via RPC.
  - Descuentos: vuelve a sumar por venta del día (manteniendo lógica anterior), filtrando por ids del día local.
  - Pagos mixtos: vuelve a sumar componentes por venta del día (manteniendo lógica anterior), filtrando por ids del día local.
  - Flujo de Caja: ordena transacciones por timestamp y calcula saldo acumulado correcto.

- `supabase/migrations/20250911_fix_local_date_filters.sql`
  - Nuevas/actualizadas funciones:
    - `sum_total_sales(payment_type_param text, sale_date_param date, branch_id_param uuid)`
    - `count_sales(sale_date_param date, branch_id_param uuid)`
    - `count_products_sold(sale_date_param date, branch_id_param uuid)`
    - `sum_total_sales_card(sale_date_param date, branch_id_param uuid)`
    - `get_daily_report(branch_id_param uuid, report_date date)`
    - `get_sales_with_discounts(branch_id_param uuid, sale_date_param date)`
    - `get_mixed_payment_breakdown(branch_id_param uuid, sale_date_param date)`
    - `get_daily_sales_local(p_branch_id uuid, p_day date)`
    - `get_daily_cash_movements_local(p_branch_id uuid, p_day date)`
  - `DROP FUNCTION IF EXISTS ...` para evitar conflictos de firmas previas.

### Impacto
- Cierre de Caja y reportes diarios reflejan correctamente las ventas y movimientos del mismo día local.
- Saldos parciales coherentes en el Flujo de Caja.
- Sin cambios en la lógica de negocio fuera del manejo de fechas/orden.

### Cómo desplegar
1) Ejecutar la migración: `20250911_fix_local_date_filters.sql` en Supabase.
2) Redeploy del frontend.
3) Verificar que la inserción de ventas usa el nuevo formato con `-04:00`.

### Validación recomendada
- Registrar una venta el 10/09 a las 22:44 → Debe aparecer en el 10/09.
- Probar ventas a las 00:10 y 23:59 → Deben mantenerse en el día correcto.
- Registrar ingresos/egresos manuales y verificar orden y saldos parciales en Flujo de Caja.

### Notas
- La columna `sales.sale_date` es `timestamptz` (timestamp con zona). Por eso, las comparaciones por día usan `AT TIME ZONE` para normalizar a America/La_Paz.
- En caso de tener funciones personalizadas heredadas con firmas distintas, agregamos `DROP FUNCTION IF EXISTS ...` para limpiar antes de recrear.


