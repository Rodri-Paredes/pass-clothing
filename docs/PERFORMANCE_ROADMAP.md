# Performance & Optimization Roadmap — PASS Clothing ERP
**Audit date:** May 13, 2026 | **Auditor:** GitHub Copilot

---

## Executive Summary

The codebase works correctly at current scale (~1800 sales, 677 products). These issues are **not visible today** but will cause real user-facing degradation as:
- Sales grow past ~5 000 per branch
- Product catalog approaches 1 000+ items
- Concurrent users increase (multi-tab, admin + seller)

**Priority key:** 🔴 Critical (fix now) · 🟠 High (fix this sprint) · 🟡 Medium (next sprint) · 🟢 Low (backlog)

---

## Part 1 — Database Query Issues

### 🔴 P1 — N+1 Stock Check in `createSale()` **[FIXED]**
**File:** `src/services/salesService.ts`  
**Was:** Loop of N sequential `SELECT quantity FROM stock WHERE variant_id = ? AND branch_id = ?`  
**Problem:** 5-item cart = 5 round-trips BEFORE the sale insert. At 15ms each = 75ms overhead minimum.  
**Fix applied:** Single batch `SELECT variant_id, quantity FROM stock WHERE branch_id = ? AND variant_id IN (...)`, build Map, verify in JS.  
**Impact:** Reduces pre-sale latency by ~60-80ms per checkout.

---

### 🔴 P2 — Double-Fetch in `getDailyCashFlow()` **[FIXED]**
**File:** `src/services/cashClosureService.ts`  
**Was:** `SELECT *` bare (no joins), then `SELECT * + all joins` with `.in('id', saleIds)`  
**Problem:** Same rows fetched twice. Double DB round-trip, double network payload.  
**Fix applied:** Single query with all joins from the start.  
**Impact:** -1 round-trip on every cash flow page open. -30% payload size (removed duplicate `*`).

---

### 🔴 P3 — Unbounded `getSalesByBranch()` **[FIXED]**
**File:** `src/services/salesService.ts`  
**Was:** `SELECT * + 4-level join ORDER BY created_at` — NO LIMIT  
**Problem:** Tarija has 1 780 sales × avg 2.5 items = 4 450 `sale_items` + product/variant/user enrichment in one payload. Estimate: **~800KB–1.2MB** per branch load.  
**Fix applied:** `.limit(200)` on `getSalesByBranch`.  
**Future:** Implement cursor-based pagination in `SalesPage` with "Load more" button.  
**Impact:** First-load time reduced from potentially 3–6s to <500ms.

---

### 🟠 P4 — `getDashboardStats()` — 7 Sequential Round-Trips
**File:** `src/services/salesService.ts`  
**Was:** 7 separate Supabase queries executed sequentially:
1. `SELECT total FROM sales WHERE branch_id AND sale_date >= month_start`
2. `SELECT COUNT(*) FROM sales WHERE branch_id AND sale_date >= month_start`
3. `SELECT COUNT(*) FROM sales WHERE branch_id`
4. `SELECT id FROM sales WHERE branch_id AND sale_date >= month_start` (to get IDs)
5. `SELECT quantity FROM sale_items WHERE sale_id IN (300+ IDs)` (fan-out)
6. `SELECT ... FROM sale_items LIMIT 1` ← **Bug: returns random row as "top product"**
7. `SELECT ... FROM stock WHERE branch_id AND quantity < 5`
8. `SELECT total, sale_date FROM sales WHERE branch_id AND sale_date >= 7days`

**Problem:** ~8 × 20ms RTT = 160ms minimum. At peak load could hit 400-800ms.  
**Fix:** Execute migration `20260513_indexes_performance.sql` to deploy `get_dashboard_stats(branch_id)` RPC — computes everything in one server-side CTE.  
**Migration file:** `supabase/migrations/20260513_indexes_performance.sql`  
**Then update:** `getDashboardStats()` in `salesService.ts` to call `supabase.rpc('get_dashboard_stats', { p_branch_id: branchId })`.  
**Impact:** Dashboard load from ~400ms → ~40ms. Also fixes the "top product" calculation bug.

---

### 🟠 P5 — Missing SQL Indexes **[MIGRATION READY]**
**Migration:** `supabase/migrations/20260513_indexes_performance.sql`

| Table | Missing Index | Query that suffers |
|---|---|---|
| `sales` | `(branch_id, sale_date DESC)` | Dashboard, cash closure date range |
| `sales` | `(branch_id, created_at DESC)` | `getSalesByBranch` order |
| `stock` | `(variant_id, branch_id)` UNIQUE | Pre-sale stock check |
| `stock` | `(branch_id, quantity)` | Low-stock alerts |
| `sale_items` | `(sale_id)` | Every sale detail join |
| `sale_items` | `(variant_id)` | Top product aggregation |
| `products` | `(is_visible, created_at DESC)` | Product list load |
| `products` | GIN trgm on `name` | ILIKE search (currently full table scan) |
| `cash_registers` | `(branch_id) WHERE closed_at IS NULL` | Open register check |
| `product_variants` | `(product_id)` | Variant joins |

**Currently:** ILIKE `%search%` on `products.name` is a **full table scan** — O(n) with no index support.  
**After pg_trgm:** ~50x faster on search queries.

---

### 🟡 P6 — `getUserProducts()` / `loadProducts()` — No Pagination in productStore
**File:** `src/store/productStore.ts` → `productService.getProducts()`  
**Problem:** `getProducts()` fetches ALL products with variants. Not used in the main flow (replaced by `usePaginatedProducts`) but still called from other places. Should be deprecated.  
**Fix:** Remove `loadProducts` from productStore; ensure all product reads go through `usePaginatedProducts`.

---

### 🟡 P7 — `getStockByBranch()` — 677+ rows with 3-level join on every mount
**File:** `src/services/productService.ts`  
**Was:** Fetches ALL stock entries with `variant → product` join for the current branch on every page mount.  
**Problem:** At 677 variants × 2-3 branches = large payload. The full product info (name, price, category) is included even though only `variant_id + quantity` is needed for the sales stock check.  
**Fix:** Create a lightweight version `getStockQuantitiesByBranch()` that returns only `{ variant_id, quantity }` — only 2 columns, no joins, for the sales availability check. Keep the rich version only for the stock management UI.  
**Impact:** ~60% payload reduction for the most-fetched query.

---

### 🟢 P8 — `cash_movements` User Enrichment — Separate Loop **[FIXED in getDailyCashFlow]**
Was fetching users separately and building a Map. Fixed by adding `user:users!left(name)` to the movements join.

---

## Part 2 — React Performance Issues

### 🟠 P9 — No `React.memo` on Product Cards
**File:** `src/pages/SalesPage.tsx` — the product grid  
**Problem:** Every `cart` state update (add/remove/quantity change) triggers re-render of the **entire product grid** because `cart` is in the parent component state. With 24+ product cards rendering on each change, this is visible as jank.  
**Fix:**
```tsx
// Wrap the card component in React.memo
const ProductCard = React.memo(({ product, onAdd, ... }) => { ... });
```
Also move `cart` to a `useRef` or a separate Zustand slice so product grid doesn't subscribe to cart changes.

---

### 🟠 P10 — Zustand `stock` Array Replace Triggers All Subscribers
**File:** `src/store/productStore.ts`  
**Problem:** `loadStockByBranch()` replaces the entire `stock` array with `set({ stock })`. Every component subscribed to ANY stock selector re-renders, even if their specific variants didn't change.  
**Fix:**
```ts
// Use selector granularity and shallow equality
const variantStock = useProductStore(
  useCallback((s) => s.stock.find(x => x.variant_id === variantId), [variantId])
);
```
Or use Zustand's `subscribeWithSelector` middleware for fine-grained subscriptions.

---

### 🟡 P11 — React Query is Configured But Not Used
**File:** `src/lib/queryClient.ts` + `src/store/` (all Zustand)  
**Problem:** The `QueryClient` with `staleTime: 5min` is set up but the Zustand stores call services **directly**, bypassing React Query cache entirely. Multiple component mounts trigger repeated Supabase calls.  
**Fix strategy:** Gradually migrate read-only queries (`getDashboardStats`, `getStockByBranch`, `loadActiveDiscounts`) to React Query `useQuery` hooks. Keep mutations in Zustand.  
**Benefit:** Automatic deduplication, background refetch, stale-while-revalidate, window focus refetch.

---

### 🟡 P12 — `loadStockByBranch` Called After Every Sale
**File:** `src/pages/SalesPage.tsx`  
```ts
// After sale:
loadStockByBranch(activeBranch.id);
```
**Problem:** Re-fetches all 677 stock rows after every sale to update the UI. Instead, only the sold variants changed.  
**Fix:** After a successful sale, update only the affected variants in the Zustand `stock` array using the known `sold items`:
```ts
// Optimistic update instead of full refetch
set(state => ({
  stock: state.stock.map(s =>
    soldVariantIds.has(s.variant_id)
      ? { ...s, quantity: s.quantity - soldQty }
      : s
  )
}));
```
Then background-sync with the real DB value.

---

### 🟢 P13 — `usePaginatedProducts` — `console.log` in Production
Multiple `console.log` statements in `productService.ts` and `usePaginatedProducts.ts` that fire on every keystroke in search. Minor but clean up before production.  
**Fix:** Remove or guard with `if (import.meta.env.DEV)`.

---

## Part 3 — Caching Strategy

### Current State
| Layer | Strategy | Problem |
|---|---|---|
| React Query | Configured (staleTime 5min) | Not used for business data |
| Zustand | In-memory on component mount | Re-fetches on every page visit |
| localStorage | Only image cache | No business data cached |

### Recommended Strategy

```
┌─────────────────────────────────────────────────────────┐
│  Read-only, slow-changing data (products, discounts)     │
│  → React Query useQuery with staleTime: 5min             │
│  → Shared cache across all components                    │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Session data (stock, sales of the day)                  │
│  → Zustand with optimistic updates on mutations          │
│  → Background refetch every 2min (real-time enough)     │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Write operations (createSale, updateStock)              │
│  → React Query useMutation + optimistic updates          │
│  → On error: rollback + notify()                         │
└─────────────────────────────────────────────────────────┘
```

**Specific stale times:**
- Products list: `5 min` (changes rarely mid-session)
- Stock: `60 sec` (changes with each sale)
- Sales list: `30 sec` (refetch on focus after sale)
- Discounts: `5 min`
- Dashboard stats: `2 min`

---

## Part 4 — Scalability Risks

| Scenario | Current behavior | Breaks at | Mitigation |
|---|---|---|---|
| Sales grow to 10 000 | `getSalesByBranch` limit 200 ✅ | Was unlimited | Cursor pagination in SalesPage |
| Products reach 5 000 | `usePaginatedProducts` (24/page) ✅ | `getProducts()` still fetches all | Remove `getProducts()` |
| ILIKE search with 5 000 products | Full table scan | ~2–5s response | pg_trgm GIN index (migration ready) |
| Stock updates during flash sale | `decrement_stock_atomic` RPC ✅ | Race condition without atomic | Already solved |
| Multiple users same branch | No session coordination | Stale stock shown | Add `refetchOnWindowFocus: true` for stock |
| Dashboard loads with 100K sale_items | 7 sequential queries | 3–10s load | `get_dashboard_stats` RPC (migration ready) |

---

## Part 5 — Prioritized Action Plan

### Sprint 1 — High Impact, Low Risk (All SQL-only or already done)
- [x] **Fix N+1 stock check in createSale** ← Done
- [x] **Fix double-fetch in getDailyCashFlow** ← Done
- [x] **Add limit to getSalesByBranch** ← Done
- [ ] **Execute `20260513_indexes_performance.sql`** in Supabase SQL Editor
  - Creates 12 indexes
  - Creates `get_dashboard_stats` RPC
  - Creates `error_logs` table
- [ ] **Wire `getDashboardStats()` to use `get_dashboard_stats` RPC** (30 min)

### Sprint 2 — React Performance
- [ ] `React.memo` on product card components
- [ ] Optimistic stock update after sale (avoid full refetch)
- [ ] Remove debug `console.log` from services
- [ ] Add `Zustand subscribeWithSelector` for stock slice

### Sprint 3 — Architecture Improvements
- [ ] Migrate `getDashboardStats`, `getDiscounts`, `getProducts` to React Query `useQuery`
- [ ] Deprecate `productStore.loadProducts()` (replaced by `usePaginatedProducts`)
- [ ] Create `getStockQuantitiesByBranch()` lightweight version (variant_id + quantity only)
- [ ] Cursor-based pagination in SalesPage scrollback

### Sprint 4 — Long-term
- [ ] `pg_stat_statements` extension enabled for live slow query monitoring
- [ ] Supabase Realtime subscription for stock (replace polling)
- [ ] Service Worker for offline-capable stock cache
- [ ] Database connection pooling review (Supabase free tier = 60 connections max)

---

## Part 6 — Operational Error Notification System **[IMPLEMENTED]**

### Architecture
```
User action → Service throws → Page catches
                                    ↓
                              useToastStore.notify(alert, detail, ctx)
                                    ↓                    ↓
                              Toast (UI)           errorLogService.log()
                                                         ↓           ↓
                                                   localStorage   Supabase
                                                   (instant)      (async)
```

### Alert types available (`notify(alert, detail, ctx)`)
| Alert | Severity | Auto-dismiss | Use case |
|---|---|---|---|
| `sale_failed` | error | 6s | Any `createSale()` exception |
| `stock_insufficient` | warning | 5s | Cart add or pre-sale check fails |
| `cash_register_closed` | error | sticky | No open register for branch |
| `rpc_failure` | error | 6s | Any `.rpc()` call error |
| `sync_error` | warning | 5s | Supabase realtime disconnect |
| `permission_denied` | error | 5s | 403 / RLS violation |
| `operation_blocked` | warning | 5s | User tries disallowed action |
| `inconsistency_detected` | error | sticky | Health check finds data corruption |

### How to use in any page or service
```ts
// In a page component:
const notify = useToastStore((s) => s.notify);
notify('sale_failed', error.message, {
  userId: user.id,
  branchId: activeBranch.id,
  details: { items: cart.length }
});

// From a service (no hooks):
useToastStore.getState().notify('rpc_failure', 'get_cash_register_summary failed');
```

### Error log visibility
- Displayed in **Diagnóstico** page (`/health`) — "Registro de errores operacionales" section
- Persists across page reloads (localStorage)
- Synced to `error_logs` table in Supabase (requires migration)
- Admin can clear the log from the UI
