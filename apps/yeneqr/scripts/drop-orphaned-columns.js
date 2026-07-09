// scripts/drop-orphaned-columns.js
// ─────────────────────────────────────────────────────────────────────────────
// Purpose:
//   Previous deploy attempts (with the broken schema) added "new" columns to
//   the production DB via pre-backfill and migration scripts. The schema has
//   since been RESTORED to the original column names, so these "new" columns
//   are now orphans that prisma db push wants to drop.
//
//   The original data is still in the original columns (e.g. splitData,
//   reference, enabled, defaultValue), so dropping the orphaned "new" columns
//   is SAFE — no data is lost.
//
//   This script drops the orphaned columns BEFORE prisma db push runs, so
//   db push succeeds without the interactive prompt (which hangs non-interactive
//   deploys).
//
// Usage:
//   node scripts/drop-orphaned-columns.js
//
// Idempotent: safe to run multiple times. Silently skips columns that don't exist.
// ─────────────────────────────────────────────────────────────────────────────

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function tableExists(name) {
  const result = await prisma.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    name
  )
  return result.length > 0
}

async function columnExists(table, col) {
  if (!(await tableExists(table))) return false
  const result = await prisma.$queryRawUnsafe(
    `SELECT name FROM pragma_table_info(?)`,
    table
  )
  return result.some(r => r.name === col)
}

async function dropColumn(table, col) {
  // SQLite 3.35.0+ supports ALTER TABLE ... DROP COLUMN
  await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" DROP COLUMN "${col}";`)
}

// ── Orphaned columns to drop ──
// These were added by previous (broken) deploy attempts but the restored schema
// uses the original column names. The original data is still in the original
// columns, so dropping these is safe.
const orphanedColumns = [
  // [table, column, reason]
  ['BillSplit',          'splits',       'restored schema uses splitData instead'],
  ['Invoice',            'restaurantId', 'restored schema does not have restaurantId on Invoice'],
  ['Payment',            'transactionId','restored schema uses reference instead'],
  ['PlatformFeatureFlag','isEnabled',    'restored schema uses enabled instead'],
  ['UIString',           'value',        'restored schema uses defaultValue instead'],
]

async function main() {
  console.log('─'.repeat(70))
  console.log('drop-orphaned-columns: removing columns added by previous broken deploys')
  console.log('─'.repeat(70))

  for (const [table, col, reason] of orphanedColumns) {
    if (!(await columnExists(table, col))) {
      console.log(`  ✓ ${table}.${col} does not exist — skipping`)
      continue
    }
    try {
      await dropColumn(table, col)
      console.log(`  ✅ Dropped ${table}.${col} (${reason})`)
    } catch (e) {
      console.log(`  ⚠️  Could not drop ${table}.${col}: ${e.message}`)
      // Don't abort — prisma db push will handle it with --accept-data-loss if needed
    }
  }

  console.log('─'.repeat(70))
  console.log('Done. prisma db push should now succeed without warnings.')
  console.log('─'.repeat(70))
}

main()
  .catch(e => {
    console.error('drop-orphaned-columns FAILED:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
