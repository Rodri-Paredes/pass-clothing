/**
 * Error Log Service
 * - Captures operational errors with category and severity
 * - Persists to localStorage (offline-capable, instant)
 * - Fires-and-forgets to Supabase error_logs table (requires migration 20260513_indexes_performance.sql)
 * - Exposes an in-memory ring-buffer accessible from the Health Dashboard
 */
import { supabase } from '../lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ErrorLevel = 'critical' | 'error' | 'warning';

export type ErrorCategory =
  | 'sale'
  | 'stock'
  | 'cash_register'
  | 'sync'
  | 'rpc'
  | 'permission'
  | 'auth'
  | 'inconsistency'
  | 'unknown';

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: ErrorLevel;
  category: ErrorCategory;
  message: string;
  details?: Record<string, unknown>;
  userId?: string;
  branchId?: string;
  sessionId: string;
  resolved: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'erp_error_log';
const MAX_LOCAL_ENTRIES = 200;
const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadFromStorage(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ErrorLogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(entries: ErrorLogEntry[]): void {
  try {
    // Keep only the most recent MAX_LOCAL_ENTRIES
    const trimmed = entries.slice(-MAX_LOCAL_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or disabled — silently skip
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

class ErrorLogService {
  private _entries: ErrorLogEntry[] = loadFromStorage();

  /** Subscribe to log changes (poll or wrap in a store if needed) */
  get entries(): Readonly<ErrorLogEntry[]> {
    return this._entries;
  }

  /** Returns the N most recent entries */
  getRecent(limit = 50): ErrorLogEntry[] {
    return this._entries.slice(-limit).reverse();
  }

  /** Returns entries for a specific category */
  getByCategory(category: ErrorCategory): ErrorLogEntry[] {
    return this._entries.filter((e) => e.category === category).reverse();
  }

  /** Count unresolved critical + error level entries */
  get unresolvedCount(): number {
    return this._entries.filter((e) => !e.resolved && e.level !== 'warning').length;
  }

  /**
   * Log an operational error.
   * Saves locally first (sync), then persists to DB (async fire-and-forget).
   */
  log(
    level: ErrorLevel,
    category: ErrorCategory,
    message: string,
    options: {
      details?: Record<string, unknown>;
      userId?: string;
      branchId?: string;
    } = {}
  ): ErrorLogEntry {
    const entry: ErrorLogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details: options.details,
      userId: options.userId,
      branchId: options.branchId,
      sessionId: SESSION_ID,
      resolved: false,
    };

    // 1. Add to in-memory ring buffer
    this._entries = [...this._entries, entry];
    if (this._entries.length > MAX_LOCAL_ENTRIES) {
      this._entries = this._entries.slice(-MAX_LOCAL_ENTRIES);
    }

    // 2. Persist to localStorage synchronously
    saveToStorage(this._entries);

    // 3. Fire-and-forget to Supabase (do NOT await — never blocks the UI)
    this._persistToSupabase(entry);

    return entry;
  }

  /** Convenience shortcuts */
  critical(category: ErrorCategory, message: string, opts?: Parameters<ErrorLogService['log']>[3]) {
    return this.log('critical', category, message, opts);
  }
  error(category: ErrorCategory, message: string, opts?: Parameters<ErrorLogService['log']>[3]) {
    return this.log('error', category, message, opts);
  }
  warning(category: ErrorCategory, message: string, opts?: Parameters<ErrorLogService['log']>[3]) {
    return this.log('warning', category, message, opts);
  }

  /** Mark an entry as resolved */
  resolve(id: string): void {
    this._entries = this._entries.map((e) =>
      e.id === id ? { ...e, resolved: true } : e
    );
    saveToStorage(this._entries);
  }

  /** Clear all local logs (admin action) */
  clearLocal(): void {
    this._entries = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  private async _persistToSupabase(entry: ErrorLogEntry): Promise<void> {
    try {
      await supabase.from('error_logs').insert({
        level: entry.level,
        category: entry.category,
        message: entry.message,
        details: entry.details ?? null,
        user_id: entry.userId ?? null,
        branch_id: entry.branchId ?? null,
        session_id: entry.sessionId,
      });
    } catch {
      // Never throw — DB persistence is best-effort, localStorage is the source of truth
    }
  }
}

// Export singleton
export const errorLogService = new ErrorLogService();
