// ============================================================
// YeneQR — Backfill OrderItem.branchId and OrderEvent.branchId
// from Order.branchId
// ============================================================
// Phase 5.1 of the multi-branch audit.
//
// OrderItem.branchId and OrderEvent.branchId were added as nullable
// "denormalized for branch-scoped queries" columns, but the code that
// creates OrderItems/OrderEvents doesn't always set them. This script
// backfills null values from the parent Order.branchId (which is
// required and always set).
//
// After running this, the columns can be made required in the Prisma
// schema (prisma db push).
//
// Usage:
//   DATABASE_URL="file:./db/yeneqr.db" node scripts/backfill-branch-ids.js
// ============================================================

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function backfillOrderItems() {
  // Find all OrderItems with null branchId, joined to their Order for the branchId
  const itemsToUpdate = await prisma.orderItem.findMany({
    where: { branchId: null },
    select: { id: true, orderId: true },
  })

  console.log(`[OrderItem] Found ${itemsToUpdate.length} rows with null branchId`)

  let updated = 0
  let skipped = 0

  for (const item of itemsToUpdate) {
    if (!item.orderId) {
      skipped++
      continue
    }
    const order = await prisma.order.findUnique({
      where: { id: item.orderId },
      select: { branchId: true },
    })
    if (!order || !order.branchId) {
      skipped++
      continue
    }
    await prisma.orderItem.update({
      where: { id: item.id },
      data: { branchId: order.branchId },
    })
    updated++
  }

  console.log(`[OrderItem] Updated ${updated}, skipped ${skipped}`)
  return updated
}

async function backfillOrderEvents() {
  const eventsToUpdate = await prisma.orderEvent.findMany({
    where: { branchId: null },
    select: { id: true, orderId: true },
  })

  console.log(`[OrderEvent] Found ${eventsToUpdate.length} rows with null branchId`)

  let updated = 0
  let skipped = 0

  for (const event of eventsToUpdate) {
    if (!event.orderId) {
      skipped++
      continue
    }
    const order = await prisma.order.findUnique({
      where: { id: event.orderId },
      select: { branchId: true },
    })
    if (!order || !order.branchId) {
      skipped++
      continue
    }
    await prisma.orderEvent.update({
      where: { id: event.id },
      data: { branchId: order.branchId },
    })
    updated++
  }

  console.log(`[OrderEvent] Updated ${updated}, skipped ${skipped}`)
  return updated
}

async function main() {
  console.log('🌱 YeneQR — Backfilling branchId on OrderItem and OrderEvent...\n')

  const itemsUpdated = await backfillOrderItems()
  const eventsUpdated = await backfillOrderEvents()

  console.log('\n══════════════════════════════════════════════════')
  console.log('✅ Backfill complete')
  console.log(`   OrderItem rows updated: ${itemsUpdated}`)
  console.log(`   OrderEvent rows updated: ${eventsUpdated}`)
  console.log('══════════════════════════════════════════════════')
  console.log('\nNext step: make branchId required in prisma/schema.prisma,')
  console.log('then run: npx prisma db push --accept-data-loss')
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
