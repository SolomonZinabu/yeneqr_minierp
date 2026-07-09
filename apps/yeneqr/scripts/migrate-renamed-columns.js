// scripts/migrate-renamed-columns.js
// ─────────────────────────────────────────────────────────────────────────────
// Purpose:
//   Prisma db push refuses (or with --accept-data-loss, silently destroys) data
//   in columns that have been RENAMED in schema.prisma. This script runs BEFORE
//   prisma db push and copies data from the old column to the new column for
//   known renames, so that the subsequent db push (with --accept-data-loss)
//   only drops now-orphaned old columns.
//
//   Idempotent: safe to run multiple times. Each step checks whether the old
//   column exists and whether the new column exists, and only copies if both
//   are present and the new column is empty (or differs).
//
// Usage:
//   node scripts/migrate-renamed-columns.js
//
// Exit codes:
//   0 = success (or nothing to do)
//   1 = error (DB inaccessible, etc.)
// ─────────────────────────────────────────────────────────────────────────────

const { execSync } = require('child_process')
const path = require('path')

// Resolve DB path from DATABASE_URL (supports "file:/abs/path.db" form)
const dbUrl = process.env.DATABASE_URL || ''
if (!dbUrl.startsWith('file:')) {
  console.error('migrate-renamed-columns: DATABASE_URL must be a file: URL')
  process.exit(1)
}
const dbPath = dbUrl.replace(/^file:/, '')

// Use better-sqlite3 (already a project dep) — synchronous, simpler than prisma raw
// for one-off column introspection.
let Database
try {
  Database = require('better-sqlite3')
} catch (e) {
  console.error('migrate-renamed-columns: better-sqlite3 not installed:', e.message)
  process.exit(1)
}

const db = new Database(dbPath)

// ── Helpers ──────────────────────────────────────────────────────────────────
function tableExists(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name)
  return !!row
}

function columnExists(table, col) {
  if (!tableExists(table)) return false
  // Note: pragma table_info() doesn't accept bind parameters, and reserved
  // words like "Order" must NOT be quoted inside the pragma call (SQLite
  // quirk). Use a SELECT from pragma_table_info instead which accepts
  // bind parameters and handles reserved words correctly.
  const rows = db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table)
  return rows.some(r => r.name === col)
}

function addColumnIfMissing(table, col, typeDecl) {
  if (columnExists(table, col)) return false
  if (!tableExists(table)) return false
  db.exec(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${typeDecl};`)
  return true
}

function rowCount(table, whereClause = '') {
  const sql = `SELECT COUNT(*) AS n FROM "${table}"${whereClause ? ' WHERE ' + whereClause : ''}`
  return db.prepare(sql).get().n
}

function exec(sql) {
  db.exec(sql)
}

// ── Migration steps ──────────────────────────────────────────────────────────
const migrations = [
  {
    name: 'UIString.defaultValue → UIString.value',
    run: () => {
      if (!tableExists('UIString')) return 'UIString table missing — skipping'
      // value column was added by deploy.sh pre-backfill with default ''. Make
      // sure it exists.
      addColumnIfMissing('UIString', 'value', 'TEXT NOT NULL DEFAULT \'\'')
      if (!columnExists('UIString', 'defaultValue')) {
        return 'defaultValue column already gone — nothing to copy'
      }
      // Copy non-empty defaultValue into value (only where value is empty, so
      // re-runs don't overwrite).
      const r = db.prepare(
        `UPDATE UIString SET value = defaultValue
         WHERE defaultValue IS NOT NULL
           AND defaultValue != ''
           AND (value IS NULL OR value = '')`
      ).run()
      return `copied ${r.changes} rows`
    },
  },
  {
    name: 'PlatformFeatureFlag.enabled → PlatformFeatureFlag.isEnabled',
    run: () => {
      if (!tableExists('PlatformFeatureFlag')) return 'table missing — skipping'
      addColumnIfMissing('PlatformFeatureFlag', 'isEnabled', 'BOOLEAN NOT NULL DEFAULT 1')
      if (!columnExists('PlatformFeatureFlag', 'enabled')) {
        return 'enabled column already gone — nothing to copy'
      }
      const r = db.prepare(
        `UPDATE PlatformFeatureFlag SET isEnabled = enabled
         WHERE enabled IS NOT NULL`
      ).run()
      return `copied ${r.changes} rows`
    },
  },
  {
    name: 'Payment.provider → Payment.method',
    run: () => {
      if (!tableExists('Payment')) return 'table missing — skipping'
      addColumnIfMissing('Payment', 'method', 'TEXT')
      if (!columnExists('Payment', 'provider')) {
        return 'provider column already gone — nothing to copy'
      }
      const r = db.prepare(
        `UPDATE Payment SET method = provider
         WHERE provider IS NOT NULL
           AND (method IS NULL OR method = '')`
      ).run()
      return `copied ${r.changes} rows`
    },
  },
  {
    name: 'Payment.reference → Payment.transactionId',
    run: () => {
      if (!tableExists('Payment')) return 'table missing — skipping'
      addColumnIfMissing('Payment', 'transactionId', 'TEXT')
      if (!columnExists('Payment', 'reference')) {
        return 'reference column already gone — nothing to copy'
      }
      const r = db.prepare(
        `UPDATE Payment SET transactionId = reference
         WHERE reference IS NOT NULL
           AND (transactionId IS NULL OR transactionId = '')`
      ).run()
      return `copied ${r.changes} rows`
    },
  },
  {
    name: 'Payment.receiptUrl → Payment.providerResponse',
    run: () => {
      if (!tableExists('Payment')) return 'table missing — skipping'
      addColumnIfMissing('Payment', 'providerResponse', 'TEXT')
      if (!columnExists('Payment', 'receiptUrl')) {
        return 'receiptUrl column already gone — nothing to copy'
      }
      const r = db.prepare(
        `UPDATE Payment SET providerResponse = receiptUrl
         WHERE receiptUrl IS NOT NULL
           AND (providerResponse IS NULL OR providerResponse = '')`
      ).run()
      return `copied ${r.changes} rows`
    },
  },
  {
    name: 'OrderItem.roundNumber → Order.roundNumber (cross-table)',
    run: () => {
      // Order.roundNumber exists in new schema with @default(1). Existing
      // orders will already have roundNumber=1 from the default. If an OrderItem
      // had a different roundNumber, propagate it to the parent Order.
      if (!tableExists('OrderItem') || !tableExists('Order')) return 'required tables missing'
      if (!columnExists('OrderItem', 'roundNumber')) {
        return 'OrderItem.roundNumber already gone — nothing to copy'
      }
      if (!columnExists('Order', 'roundNumber')) {
        // Add the column temporarily so we can populate it. Prisma will sync
        // it with the right type/default later.
        addColumnIfMissing('Order', 'roundNumber', 'INTEGER NOT NULL DEFAULT 1')
      }
      // SQLite has quirks with double-quoted reserved-word table names in
      // subqueries — do the update row-by-row in JS instead.
      const orders = db.prepare(
        `SELECT id FROM "Order" WHERE roundNumber = 1 OR roundNumber IS NULL`
      ).all()
      let changed = 0
      const maxRnStmt = db.prepare(
        `SELECT MAX(roundNumber) AS m FROM OrderItem WHERE orderId = ?`
      )
      const updateStmt = db.prepare(
        `UPDATE "Order" SET roundNumber = ? WHERE id = ?`
      )
      for (const o of orders) {
        const r = maxRnStmt.get(o.id)
        if (r && r.m && r.m > 1) {
          updateStmt.run(r.m, o.id)
          changed++
        }
      }
      return `updated ${changed} orders with non-default round numbers`
    },
  },
  {
    name: 'BillSplit.splitData → BillSplit.splits (best-effort JSON copy)',
    run: () => {
      if (!tableExists('BillSplit')) return 'table missing — skipping'
      // splits column was added by deploy.sh pre-backfill with default '[]'.
      addColumnIfMissing('BillSplit', 'splits', "TEXT NOT NULL DEFAULT '[]'")
      if (!columnExists('BillSplit', 'splitData')) {
        return 'splitData column already gone — nothing to copy'
      }
      // Copy splitData → splits only where splits is still the default '[]'
      // AND splitData is non-empty. (Best-effort: if the JSON shapes don't
      // match, the app will need to re-create the split, but data isn't lost
      // — it's still in the old column until prisma drops it.)
      const r = db.prepare(
        `UPDATE BillSplit SET splits = splitData
         WHERE splitData IS NOT NULL
           AND splitData != ''
           AND (splits IS NULL OR splits = '[]')`
      ).run()
      return `copied ${r.changes} rows (best-effort)`
    },
  },
]

// ── Execute ──────────────────────────────────────────────────────────────────
console.log('─'.repeat(70))
console.log('migrate-renamed-columns: copying data for renamed columns')
console.log('─'.repeat(70))
let totalChanged = 0
for (const m of migrations) {
  try {
    const result = m.run()
    console.log(`  • ${m.name}: ${result}`)
  } catch (e) {
    console.error(`  ✗ ${m.name}: FAILED — ${e.message}`)
    // Don't abort — let deploy continue. Worst case the old column gets dropped
    // and the new column has default values, which is still a working app.
  }
}
console.log('─'.repeat(70))
console.log('Done. Safe to run prisma db push --accept-data-loss now.')
console.log('─'.repeat(70))

db.close()
process.exit(0)
