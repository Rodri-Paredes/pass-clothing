/**
 * Export production data from Supabase to SQL INSERT statements
 * Usage: node scripts/export_prod_data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const SUPABASE_URL = 'https://nvkoustxdmrxhdrcozqz.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52a291c3R4ZG1yeGhkcmNvenF6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUyMzEwNywiZXhwIjoyMDkxMDk5MTA3fQ.NGtbVY-ab2ennJ-7Z5M0Jc7fEj3F_aHt-KUa76VCpiQ';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Escape a value for SQL
function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function fetchAll(table, select = '*', order = 'created_at') {
  let all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(order, { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) { console.error(`Error fetching ${table}:`, error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`  ${table}: ${all.length} rows`);
  return all;
}

function toInserts(table, rows) {
  if (!rows.length) return `-- ${table}: 0 rows\n`;
  const cols = Object.keys(rows[0]);
  const lines = rows.map(row => {
    const vals = cols.map(c => sqlVal(row[c])).join(', ');
    return `(${vals})`;
  });
  // Split into chunks of 500 to avoid huge single statements
  const chunks = [];
  for (let i = 0; i < lines.length; i += 500) {
    chunks.push(lines.slice(i, i + 500));
  }
  return chunks.map(chunk =>
    `INSERT INTO ${table} (${cols.map(c => `"${c}"`).join(', ')}) VALUES\n${chunk.join(',\n')}\nON CONFLICT DO NOTHING;`
  ).join('\n\n');
}

async function main() {
  console.log('Exporting production data from Supabase...\n');

  // Export in FK-safe order
  const branches    = await fetchAll('branches', '*', 'created_at');
  const users       = await fetchAll('users', '*', 'created_at');
  const drops       = await fetchAll('drops', '*', 'created_at');
  const products    = await fetchAll('products', '*', 'created_at');
  const variants    = await fetchAll('product_variants', '*', 'created_at');
  const stock       = await fetchAll('stock', '*', 'created_at');
  const sales       = await fetchAll('sales', '*', 'sale_date');
  const saleItems   = await fetchAll('sale_items', '*', 'id');
  const cashRegs    = await fetchAll('cash_registers', '*', 'created_at');
  const cashMovs    = await fetchAll('cash_movements', '*', 'created_at');
  const dropProds   = await fetchAll('drop_products', '*', 'created_at');

  // Also need auth.users entries for FK constraint on users.id
  const authUserIds = [...new Set(users.map(u => u.id))];

  const sql = [
    '-- ============================================================',
    '-- PRODUCTION DATA EXPORT',
    `-- Exported: ${new Date().toISOString()}`,
    '-- ============================================================',
    '',
    'SET session_replication_role = replica; -- Disable FK checks during load',
    '',
    '-- Auth users (stub entries for FK)',
    authUserIds.map(id => `INSERT INTO auth.users (id) VALUES ('${id}') ON CONFLICT DO NOTHING;`).join('\n'),
    '',
    toInserts('branches', branches),
    '',
    toInserts('users', users),
    '',
    toInserts('drops', drops),
    '',
    toInserts('products', products),
    '',
    toInserts('product_variants', variants),
    '',
    toInserts('stock', stock),
    '',
    toInserts('sales', sales),
    '',
    toInserts('sale_items', saleItems),
    '',
    toInserts('cash_registers', cashRegs),
    '',
    toInserts('cash_movements', cashMovs),
    '',
    toInserts('drop_products', dropProds),
    '',
    'SET session_replication_role = DEFAULT; -- Re-enable FK checks',
    '',
    '-- Row counts for verification',
    `SELECT 'branches' AS tbl, COUNT(*) FROM branches UNION ALL`,
    `SELECT 'users', COUNT(*) FROM users UNION ALL`,
    `SELECT 'products', COUNT(*) FROM products UNION ALL`,
    `SELECT 'product_variants', COUNT(*) FROM product_variants UNION ALL`,
    `SELECT 'stock', COUNT(*) FROM stock UNION ALL`,
    `SELECT 'sales', COUNT(*) FROM sales UNION ALL`,
    `SELECT 'sale_items', COUNT(*) FROM sale_items UNION ALL`,
    `SELECT 'cash_registers', COUNT(*) FROM cash_registers UNION ALL`,
    `SELECT 'cash_movements', COUNT(*) FROM cash_movements`,
    `ORDER BY 1;`,
  ].join('\n');

  writeFileSync('scripts/prod_data.sql', sql, 'utf8');
  console.log('\n✅ Written to scripts/prod_data.sql');
  console.log(`   Total rows: branches(${branches.length}), users(${users.length}), products(${products.length}), variants(${variants.length}), stock(${stock.length}), sales(${sales.length}), sale_items(${saleItems.length})`);
}

main().catch(e => { console.error(e); process.exit(1); });
