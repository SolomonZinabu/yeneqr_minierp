// scripts/migrate-game-dedup-keys.js
// ─────────────────────────────────────────────────────────────────────────────
// Backfills the new `dedupKey` column on GameLeaderboard and GameReward tables
// for existing rows, then merges duplicate leaderboard entries that belong to
// the same customer.
//
// Before this migration, the unique key was `sessionId`, which meant a customer
// who played across 5 visits showed up as 5 different leaderboard entries.
// After this migration:
//   - Rows with customerId → dedupKey = `customer:${customerId}`
//   - Rows without customerId but with sessionId → dedupKey = `session:${sessionId}`
//   - Rows with neither → dedupKey = `session:anonymous`
//   - Duplicate rows (same dedupKey+gameType+period) are merged into one,
//     keeping the best score, summing plays, averaging avgScore.
//
// Idempotent: safe to run multiple times.
// ─────────────────────────────────────────────────────────────────────────────

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function columnExists(table, col) {
  const result = await prisma.$queryRawUnsafe(
    `SELECT name FROM pragma_table_info(?)`,
    table
  )
  return result.some(r => r.name === col)
}

async function migrateLeaderboard() {
  console.log('─'.repeat(70))
  console.log('Migrating GameLeaderboard dedupKeys + merging duplicates')
  console.log('─'.repeat(70))

  const all = await prisma.gameLeaderboard.findMany()
  console.log(`  Found ${all.length} leaderboard rows`)

  // Group by [restaurantId, gameType, period, dedupKey] to find duplicates
  const groups = new Map()
  for (const entry of all) {
    // Compute dedupKey if missing
    let dedupKey = entry.dedupKey
    if (!dedupKey || dedupKey === 'session:anonymous') {
      if (entry.customerId) {
        dedupKey = `customer:${entry.customerId}`
      } else if (entry.sessionId) {
        dedupKey = `session:${entry.sessionId}`
      } else {
        dedupKey = 'session:anonymous'
      }
    }

    const groupKey = `${entry.restaurantId}|${entry.gameType}|${entry.period}|${dedupKey}`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { dedupKey, entries: [] })
    }
    groups.get(groupKey).entries.push(entry)
  }

  let mergedCount = 0
  let updatedCount = 0

  for (const [groupKey, group] of groups) {
    const { dedupKey, entries } = group

    if (entries.length === 1) {
      // Just update the dedupKey if it changed
      const entry = entries[0]
      if (entry.dedupKey !== dedupKey) {
        await prisma.gameLeaderboard.update({
          where: { id: entry.id },
          data: { dedupKey },
        })
        updatedCount++
      }
    } else {
      // Merge: keep the first entry, update it with merged stats, delete the rest
      const sorted = entries.sort((a, b) => b.bestScore - a.bestScore)
      const keeper = sorted[0]
      const duplicates = sorted.slice(1)

      const totalPlays = entries.reduce((sum, e) => sum + e.totalPlays, 0)
      const weightedAvg = entries.reduce((sum, e) => sum + e.avgScore * e.totalPlays, 0) / totalPlays

      await prisma.gameLeaderboard.update({
        where: { id: keeper.id },
        data: {
          dedupKey,
          bestScore: keeper.bestScore,
          totalPlays,
          avgScore: weightedAvg,
          customerId: keeper.customerId || entries.find(e => e.customerId)?.customerId || null,
          sessionId: keeper.sessionId || entries.find(e => e.sessionId)?.sessionId || null,
        },
      })

      // Delete duplicates
      for (const dup of duplicates) {
        await prisma.gameLeaderboard.delete({ where: { id: dup.id } })
      }
      mergedCount += duplicates.length
      updatedCount++
    }
  }

  console.log(`  ✅ Updated ${updatedCount} rows, merged ${mergedCount} duplicates`)

  // Recalculate ranks for all periods
  console.log('  Recalculating ranks...')
  const periods = await prisma.gameLeaderboard.findMany({
    select: { restaurantId: true, gameType: true, period: true },
    distinct: ['restaurantId', 'gameType', 'period'],
  })
  for (const p of periods) {
    const entries = await prisma.gameLeaderboard.findMany({
      where: { restaurantId: p.restaurantId, gameType: p.gameType, period: p.period },
      orderBy: { bestScore: 'desc' },
    })
    for (let i = 0; i < entries.length; i++) {
      await prisma.gameLeaderboard.update({
        where: { id: entries[i].id },
        data: { rank: i + 1 },
      })
    }
  }
  console.log(`  ✅ Ranks recalculated for ${periods.length} period+gameType combos`)
}

async function migrateRewards() {
  console.log('─'.repeat(70))
  console.log('Migrating GameReward dedupKeys')
  console.log('─'.repeat(70))

  const all = await prisma.gameReward.findMany()
  console.log(`  Found ${all.length} reward rows`)

  let updatedCount = 0
  for (const reward of all) {
    let dedupKey = reward.dedupKey
    if (!dedupKey || dedupKey === 'session:anonymous') {
      if (reward.customerId) {
        dedupKey = `customer:${reward.customerId}`
      } else if (reward.sessionId) {
        dedupKey = `session:${reward.sessionId}`
      } else {
        dedupKey = 'session:anonymous'
      }
    }
    if (reward.dedupKey !== dedupKey) {
      await prisma.gameReward.update({
        where: { id: reward.id },
        data: { dedupKey },
      })
      updatedCount++
    }
  }

  console.log(`  ✅ Updated ${updatedCount} reward rows`)
}

async function main() {
  // Ensure dedupKey columns exist before we try to use them
  const lbHasDedup = await columnExists('GameLeaderboard', 'dedupKey')
  const rwHasDedup = await columnExists('GameReward', 'dedupKey')
  if (!lbHasDedup || !rwHasDedup) {
    console.log('⚠️  dedupKey column missing — prisma db push will add it. Re-run this script after db push.')
    console.log('   (This is normal on first deploy with the new schema.)')
    return
  }

  await migrateLeaderboard()
  await migrateRewards()

  console.log('─'.repeat(70))
  console.log('✅ Migration complete.')
  console.log('─'.repeat(70))
}

main()
  .catch(e => {
    console.error('Migration FAILED:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
