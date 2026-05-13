/**
 * Centralized formatters for the PASS Clothing ERP.
 * All monetary/numeric display should go through these utilities to ensure
 * consistent formatting across every screen (dashboard, ventas, caja, reportes).
 *
 * Bolivia locale conventions:
 *   Thousands separator: . (period)
 *   Decimal separator:   , (comma)
 *   Currency symbol:     Bs.
 *
 * Examples:
 *   fmtMoney(1000)        → "Bs. 1.000,00"
 *   fmtMoney(15000.5)     → "Bs. 15.000,50"
 *   fmtMoney(1250000)     → "Bs. 1.250.000,00"
 *   fmtNumber(1234567)    → "1.234.567"
 *   fmtPercent(15.5)      → "15,50%"
 *   fmtQty(1234)          → "1.234"
 */

// Locale that gives us  1.234,56  (period=thousands, comma=decimal)
const LOCALE = 'es-BO';

/** Shared base formatter for Bolivia numeric locale */
const decimalFmt = (decimals: number) =>
  new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const decimal2 = decimalFmt(2);
const decimal0 = decimalFmt(0);

// ────────────────────────────────────────────────────────────

/**
 * Full monetary amount with "Bs." prefix.
 * Use for: totals, revenues, prices in tables, cart totals, reports.
 * e.g. 15000.5 → "Bs. 15.000,50"
 */
export function fmtMoney(amount: number): string {
  if (!isFinite(amount)) return 'Bs. 0,00';
  return `Bs.\u00a0${decimal2.format(amount)}`;
}

/**
 * Monetary amount without "Bs." prefix — for tables aligned columns,
 * where the symbol is shown in the header or prefix element.
 * e.g. 15000.5 → "15.000,50"
 */
export function fmtMoneyRaw(amount: number): string {
  if (!isFinite(amount)) return '0,00';
  return decimal2.format(amount);
}

/**
 * Compact currency for tight spaces (stat cards, badges).
 * No decimals for round numbers. e.g. 15.000 Bs.
 */
export function fmtMoneyCompact(amount: number): string {
  if (!isFinite(amount)) return '0 Bs.';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M Bs.`;
  }
  if (abs >= 100_000) {
    return `${decimal0.format(amount)} Bs.`;
  }
  return `${decimal2.format(amount)} Bs.`;
}

/**
 * Integer quantity / count with thousands separator.
 * e.g. 1234 → "1.234"
 */
export function fmtQty(n: number): string {
  if (!isFinite(n)) return '0';
  return decimal0.format(Math.round(n));
}

/**
 * Generic large number with thousands separator (no currency).
 * e.g. 1234567 → "1.234.567"
 */
export function fmtNumber(n: number, decimals = 0): string {
  if (!isFinite(n)) return '0';
  return decimalFmt(decimals).format(n);
}

/**
 * Percentage display.
 * e.g. 15.5 → "15,50%"
 */
export function fmtPercent(n: number, decimals = 2): string {
  if (!isFinite(n)) return '0%';
  return `${decimalFmt(decimals).format(n)}%`;
}

/**
 * Floating point safe money addition (avoids 0.1 + 0.2 = 0.300000004).
 * Use for summing cart items, totals, etc.
 */
export function safeAdd(...values: number[]): number {
  return values.reduce((acc, v) => Math.round((acc + v) * 100) / 100, 0);
}

/**
 * Floating point safe subtraction.
 */
export function safeSub(a: number, b: number): number {
  return Math.round((a - b) * 100) / 100;
}

/**
 * Round to 2 decimal places (banker-safe).
 */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
