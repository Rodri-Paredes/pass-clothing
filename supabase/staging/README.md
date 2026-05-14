# STAGING ENVIRONMENT — Pass Clothing ERP

## Por qué necesitamos staging

Hasta ahora cada migración se aplicaba directamente a producción. Esto fue el origen de los incidentes:
- Hardening con RLS sin SECURITY DEFINER → ventas bloqueadas para vendedores
- Trigger de stock sin guard + create_sale_atomic sin guard → chk_stock_non_negative

**Regla de oro: STAGING PRIMERO, PRODUCCIÓN DESPUÉS.**

---

## Arquitectura

```
Local Dev (localhost)
       ↓
Supabase STAGING  ← Probar migraciones aquí
       ↓  (solo si pasa validate_ventas.sql)
Supabase PRODUCCIÓN
```

---

## Paso 1 — Crear proyecto Supabase Staging

1. Ir a https://supabase.com/dashboard
2. New project → nombre: `pass-clothing-staging`
3. Region: South America (más cercana)
4. Database password: guardar en gestor de contraseñas
5. Una vez creado, ir a **Settings → API** y copiar:
   - `SUPABASE_URL` (proyecto URL)
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## Paso 2 — Variables de entorno

Copiar `.env.staging.example` a `.env.staging` y completar con los valores reales del proyecto staging.

```bash
cp .env.staging.example .env.staging
# Editar .env.staging con los valores del proyecto staging
```

**JAMÁS commitear `.env.staging` — ya está en `.gitignore`.**

---

## Paso 3 — Clonar schema de producción a staging

```bash
# Exportar schema completo de producción (sin datos sensibles)
pg_dump \
  --schema-only \
  --no-owner \
  --no-acl \
  "postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres" \
  > /tmp/schema_prod.sql

# Aplicar a staging
psql \
  "postgresql://postgres:<STAGING_PASSWORD>@db.<STAGING_REF>.supabase.co:5432/postgres" \
  < /tmp/schema_prod.sql
```

O desde el Dashboard de Supabase:
- Settings → Database → Restore from backup (si está disponible en tu plan)

---

## Paso 4 — Clonar datos anónimos para pruebas

```sql
-- Ejecutar en Supabase SQL Editor de STAGING
-- Datos semilla mínimos para probar flujo de ventas

-- Sucursales
INSERT INTO branches (id, name, address) VALUES
  ('aaaaaaaa-1111-1111-1111-111111111111', 'Staging-Cochabamba', 'Test'),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'Staging-Tarija', 'Test')
ON CONFLICT (id) DO NOTHING;

-- Usuarios de prueba (crear via Supabase Auth Dashboard)
-- admin@staging.test / StgAdmin123!
-- vendedor@staging.test / StgVendedor123!

-- Producto de prueba
INSERT INTO products (id, name, price, category, is_visible) VALUES
  ('cccccccc-3333-3333-3333-333333333333', 'Producto Test', 100.00, 'TEST', true)
ON CONFLICT (id) DO NOTHING;

-- Variante de prueba
INSERT INTO product_variants (id, product_id, size) VALUES
  ('dddddddd-4444-4444-4444-444444444444', 'cccccccc-3333-3333-3333-333333333333', 'M')
ON CONFLICT (id) DO NOTHING;

-- Stock inicial para pruebas
INSERT INTO stock (variant_id, branch_id, quantity) VALUES
  ('dddddddd-4444-4444-4444-444444444444', 'aaaaaaaa-1111-1111-1111-111111111111', 100),
  ('dddddddd-4444-4444-4444-444444444444', 'bbbbbbbb-2222-2222-2222-222222222222', 100)
ON CONFLICT (variant_id, branch_id) DO UPDATE SET quantity = 100;
```

---

## Paso 5 — Flujo obligatorio para cada migración

```
1. Editar archivo en supabase/migrations/YYYYMMDD_nombre.sql
2. Ejecutar PRIMERO en staging (SQL Editor de staging)
3. Ejecutar validate_ventas.sql en staging — TODOS los checks deben pasar
4. Si pasa: ejecutar la misma migración en producción
5. Ejecutar validate_ventas.sql en producción — confirmar
6. Commit del archivo de migración al repositorio
```

---

## Paso 6 — Verificación manual de ventas (checklist)

Después de cada migración, verificar MANUALMENTE en staging:

### Como vendedor Cochabamba:
- [ ] Login con usuario vendedor-cocha
- [ ] Abrir caja con monto inicial
- [ ] Crear venta EFECTIVO (1 item)
- [ ] Verificar stock decrementó exactamente 1 unidad
- [ ] Verificar movimiento de caja registrado
- [ ] Crear venta QR
- [ ] Crear venta TARJETA
- [ ] Crear venta MIXTO (EFECTIVO + QR)
- [ ] Cierre de caja — verificar totales

### Como vendedor Tarija:
- [ ] Mismas pruebas que Cochabamba

### Como admin:
- [ ] Login admin
- [ ] Crear venta en ambas sucursales
- [ ] Ver Dashboard — stats correctas
- [ ] Acceso a Drops y Descuentos
- [ ] Gestión de usuarios

### Validación de stock:
- [ ] Stock antes de venta: N
- [ ] Stock después de venta: N-1 (exactamente)
- [ ] No hay doble decremento

---

## Paso 7 — Backup antes de migración grande

Antes de ejecutar una migración que modifica funciones críticas:

```bash
# Backup completo de producción
pg_dump \
  "postgresql://postgres:<PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres" \
  --format=custom \
  --file=/tmp/backup_prod_$(date +%Y%m%d_%H%M%S).dump

# Guardar en lugar seguro (no en el repo)
```

---

## Variables de entorno por ambiente

| Variable | Dev | Staging | Producción |
|---|---|---|---|
| `VITE_SUPABASE_URL` | localhost:54321 | staging URL | prod URL |
| `VITE_SUPABASE_ANON_KEY` | local anon key | staging anon key | prod anon key |
| `VITE_ENVIRONMENT` | `development` | `staging` | `production` |

---

## Estructura de archivos

```
supabase/
  migrations/          ← Todos los archivos de migración (commiteados)
  staging/
    README.md           ← Este archivo
    validate_ventas.sql ← Script de validación (10 checks)
    seed_staging.sql    ← Datos semilla para staging
.env.staging.example    ← Template (commiteado, sin valores reales)
.env.staging            ← Valores reales (en .gitignore)
.env.production         ← Valores reales (en .gitignore)
```

---

## Qué NUNCA hacer

- ❌ Aplicar migraciones directamente a producción sin probar en staging
- ❌ Commitear archivos `.env` con credenciales reales
- ❌ Usar la service_role key en el frontend
- ❌ Probar con usuarios reales en staging (usar datos de prueba)
- ❌ Hacer `git push --force` sin revisión
- ❌ Ejecutar scripts destructivos (DROP TABLE, DELETE sin WHERE) en producción

---

## Contacto / responsables

- Desarrollo: Rodrigo Paredes
- Cliente: Pass Clothing
- Supabase Dashboard: https://supabase.com/dashboard/project/nvkoustxdmrxhdrcozqz
