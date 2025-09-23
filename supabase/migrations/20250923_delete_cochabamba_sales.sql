-- MIGRACIÓN: Eliminación de ventas de Cochabamba y movimientos relacionados
-- Fecha: 2025-09-23
-- Nota: Esta migración borra definitivamente ventas de prueba en la sucursal Cochabamba

BEGIN;

-- 1) Verificar impacto (opcional)
-- SELECT COUNT(*) AS total_sales, COALESCE(SUM(total),0) AS total_amount
-- FROM sales
-- WHERE branch_id = '8fb0375f-1572-40fb-9085-e836af8d5ae9';

-- 2) Borrar movimientos de caja asociados a ventas de esta sucursal
DELETE FROM cash_movements cm
USING cash_registers cr
WHERE cm.cash_register_id = cr.id
  AND cr.branch_id = '8fb0375f-1572-40fb-9085-e836af8d5ae9'
  AND cm.reference_type = 'SALE'
  AND cm.reference_id IN (
    SELECT id FROM sales WHERE branch_id = '8fb0375f-1572-40fb-9085-e836af8d5ae9'
  );

-- 3) Borrar items de venta primero (por FK con sales)
DELETE FROM sale_items
WHERE sale_id IN (
  SELECT id FROM sales WHERE branch_id = '8fb0375f-1572-40fb-9085-e836af8d5ae9'
);

-- 4) Borrar ventas
DELETE FROM sales
WHERE branch_id = '8fb0375f-1572-40fb-9085-e836af8d5ae9';

COMMIT;


