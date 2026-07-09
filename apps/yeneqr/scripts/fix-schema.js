// ============================================================
// YeneQR — Emergency Schema Fix Script
// Run this when prisma db push fails or when the database
// schema is out of sync with the Prisma schema.
//
// Usage:
//   node scripts/fix-schema.js
//   DATABASE_URL="file:./db/yeneqr.db" node scripts/fix-schema.js
//
// This script:
//   1. Checks for missing columns in the RestaurantUser table
//   2. Adds them via raw SQL (SQLite ALTER TABLE)
//   3. Verifies all critical columns exist
//   4. Is IDEMPOTENT — safe to run multiple times
// ============================================================

require('dotenv').config();
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env.production' });
}
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env.development' });
}
if (!process.env.DATABASE_URL) {
  // Fallback to known production path
  process.env.DATABASE_URL = 'file:/home/gelani-admin/.sol/YeneQR/db/yeneqr.db';
}

const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

// Define all columns that should exist on each table
// Format: { table: [{ name, type, defaultValue? }] }
const REQUIRED_COLUMNS = {
  RestaurantUser: [
    { name: 'permissions', type: 'TEXT', default: null },
    { name: 'additionalPermissions', type: 'TEXT', default: null },
    { name: 'revokedPermissions', type: 'TEXT', default: null },
    { name: 'twoFactorEnabled', type: 'BOOLEAN', default: '0' },
    { name: 'twoFactorSecret', type: 'TEXT', default: null },
    { name: 'twoFactorBackupCodes', type: 'TEXT', default: null },
  ],
  // branchId columns — nullable to allow existing rows
  OrderItem: [
    { name: 'branchId', type: 'TEXT', default: null },
  ],
  OrderEvent: [
    { name: 'branchId', type: 'TEXT', default: null },
  ],
  Refund: [
    { name: 'branchId', type: 'TEXT', default: null },
  ],
  Review: [
    { name: 'branchId', type: 'TEXT', default: null },
  ],
  Notification: [
    { name: 'branchId', type: 'TEXT', default: null },
  ],
  InventoryItem: [
    { name: 'branchId', type: 'TEXT', default: null },
  ],
  AuditLog: [
    { name: 'branchId', type: 'TEXT', default: null },
  ],
};

async function getExistingColumns(tableName) {
  try {
    const result = await prisma.$queryRawUnsafe(
      `PRAGMA table_info("${tableName}")`
    );
    return result.map(col => col.name);
  } catch (e) {
    console.log(`   Table "${tableName}" doesn't exist yet — will be created by prisma db push`);
    return null;
  }
}

function addColumnViaSqlite(dbPath, tableName, column) {
  const defaultClause = column.default !== null
    ? ` DEFAULT ${column.default === null ? 'NULL' : (column.type === 'BOOLEAN' ? column.default : `'${column.default}'`)}`
    : '';

  const sql = `ALTER TABLE "${tableName}" ADD COLUMN "${column.name}" ${column.type}${defaultClause};`;

  try {
    execSync(`sqlite3 "${dbPath}" "${sql}"`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    // Column might already exist — that's OK
    if (e.stderr && e.stderr.toString().includes('duplicate column name')) {
      return false; // already exists
    }
    throw e;
  }
}

async function main() {
  console.log('🔧 YeneQR — Emergency Schema Fix\n');
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL}\n`);

  // Resolve database file path
  const dbUrl = process.env.DATABASE_URL;
  let dbPath;
  if (dbUrl.startsWith('file:')) {
    dbPath = dbUrl.slice(5);
    // Handle relative paths
    if (!path.isAbsolute(dbPath)) {
      dbPath = path.resolve(process.cwd(), dbPath);
    }
  } else {
    console.error('❌ Only SQLite (file:) DATABASE_URL is supported by this script');
    process.exit(1);
  }

  if (!fs.existsSync(dbPath)) {
    console.log(`   ⚠️  Database file not found at: ${dbPath}`);
    console.log('   Running prisma db push to create it...');
    try {
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
      console.log('   ✅ Database created via prisma db push');
    } catch (e) {
      console.error('   ❌ prisma db push also failed. Check your DATABASE_URL.');
      process.exit(1);
    }
  }

  console.log(`   Database file: ${dbPath}`);
  console.log(`   File exists: ${fs.existsSync(dbPath)}\n`);

  let totalFixed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const [tableName, columns] of Object.entries(REQUIRED_COLUMNS)) {
    console.log(`📋 Checking table: ${tableName}`);
    const existingColumns = await getExistingColumns(tableName);

    if (existingColumns === null) {
      console.log('   ⏭️  Table doesn\'t exist — skipping (will be created by prisma db push)\n');
      continue;
    }

    for (const column of columns) {
      if (existingColumns.includes(column.name)) {
        console.log(`   ✅ ${column.name} — already exists`);
        totalSkipped++;
      } else {
        console.log(`   ❌ ${column.name} — MISSING! Adding...`);
        try {
          const added = addColumnViaSqlite(dbPath, tableName, column);
          if (added) {
            console.log(`   ✅ ${column.name} — ADDED successfully`);
            totalFixed++;
          } else {
            console.log(`   ✅ ${column.name} — already exists (added by another process)`);
            totalSkipped++;
          }
        } catch (e) {
          console.error(`   ❌ Failed to add ${column.name}: ${e.message}`);
          totalErrors++;
        }
      }
    }
    console.log('');
  }

  // ── Backfill branchId from parent Order for existing rows ──
  console.log('🔄 Backfilling branchId from parent Order...');
  try {
    // OrderItem: set branchId from the parent Order's branchId
    const orderItemResult = await prisma.$executeRawUnsafe(`
      UPDATE OrderItem
      SET branchId = (SELECT branchId FROM Order WHERE Order.id = OrderItem.orderId)
      WHERE branchId IS NULL AND orderId IN (SELECT id FROM Order WHERE branchId IS NOT NULL)
    `);
    console.log(`   ✅ OrderItem: ${orderItemResult} rows updated`);

    // OrderEvent: set branchId from the parent Order's branchId
    const orderEventResult = await prisma.$executeRawUnsafe(`
      UPDATE OrderEvent
      SET branchId = (SELECT branchId FROM Order WHERE Order.id = OrderEvent.orderId)
      WHERE branchId IS NULL AND orderId IN (SELECT id FROM Order WHERE branchId IS NOT NULL)
    `);
    console.log(`   ✅ OrderEvent: ${orderEventResult} rows updated`);

    // Review: set branchId from the parent Order's branchId
    const reviewResult = await prisma.$executeRawUnsafe(`
      UPDATE Review
      SET branchId = (SELECT branchId FROM Order WHERE Order.id = Review.orderId)
      WHERE branchId IS NULL AND orderId IN (SELECT id FROM Order WHERE branchId IS NOT NULL)
    `);
    console.log(`   ✅ Review: ${reviewResult} rows updated`);

    // Refund: set branchId from the parent Payment's order's branchId
    try {
      const refundResult = await prisma.$executeRawUnsafe(`
        UPDATE Refund
        SET branchId = (SELECT branchId FROM Payment JOIN "Order" ON Payment.orderId = "Order".id WHERE Payment.id = Refund.paymentId)
        WHERE Refund.branchId IS NULL
      `);
      console.log(`   ✅ Refund: ${refundResult} rows updated`);
    } catch (e) {
      // Refund backfill is best-effort — Order table might be named differently
      console.log(`   ⏭️  Refund: backfill skipped (${e.message})`);
    }

    console.log('');
  } catch (e) {
    console.log(`   ⚠️  Backfill had issues (non-critical): ${e.message}`);
    console.log('   New orders will have branchId set correctly going forward.\n');
  }

  // Verify by running a test query
  console.log('🧪 Running verification query...');
  try {
    await prisma.restaurantUser.findFirst({
      select: { id: true, permissions: true, additionalPermissions: true, revokedPermissions: true }
    });
    console.log('   ✅ RestaurantUser query with permissions columns — SUCCESS\n');
  } catch (e) {
    console.error(`   ❌ Verification query failed: ${e.message}`);
    console.error('   The schema fix may not have worked. Try running: npx prisma db push --accept-data-loss\n');
    totalErrors++;
  }

  // Summary
  console.log('═'.repeat(50));
  console.log('📊 Schema Fix Summary:');
  console.log(`   Columns added:   ${totalFixed}`);
  console.log(`   Columns OK:      ${totalSkipped}`);
  console.log(`   Errors:          ${totalErrors}`);
  console.log('═'.repeat(50));

  if (totalErrors > 0) {
    console.log('\n⚠️  Some columns could not be added. Try running:');
    console.log('   npx prisma db push --accept-data-loss');
    process.exit(1);
  } else {
    console.log('\n✅ Schema is in sync! You can now start the application.');
  }
}

main()
  .catch(e => { console.error('❌ Fix failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
