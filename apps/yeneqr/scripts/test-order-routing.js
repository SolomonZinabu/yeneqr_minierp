// ============================================================
// Smoke test: order-routing resolver precedence
// ============================================================
// Replicates the resolver logic in plain JS so we can run it with node
// directly (no TS transpilation needed). Tests all 6 precedence cases.
// ============================================================

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const VALID_MODES = new Set(['waiter_first', 'direct_to_kitchen']);
const DEFAULT_ORDER_ROUTING = 'waiter_first';

function normalizeMode(value) {
  if (typeof value !== 'string') return null;
  return VALID_MODES.has(value) ? value : null;
}

// Mirror of resolveOrderRoutingMode in src/lib/order-routing.ts
async function resolveOrderRoutingMode(restaurantId, branchId) {
  // 1. Branch override
  const branchSettings = await prisma.branchSettings.findUnique({
    where: { branchId },
    select: { orderRouting: true },
  });
  const branchMode = normalizeMode(branchSettings?.orderRouting);
  if (branchMode) return branchMode;

  // 2. Restaurant JSON
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { settings: true },
  });
  if (restaurant?.settings) {
    try {
      const parsed = JSON.parse(restaurant.settings);
      const kitchen = parsed.kitchen;
      const restaurantMode = normalizeMode(kitchen?.orderRouting);
      if (restaurantMode) return restaurantMode;
    } catch {
      // fall through
    }
  }

  // 3. Default
  return DEFAULT_ORDER_ROUTING;
}

let passCount = 0;
let failCount = 0;

function check(name, actual, expected) {
  const ok = actual === expected;
  console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'} — ${name}`);
  console.log(`    expected: ${expected}`);
  console.log(`    actual:   ${actual}`);
  if (ok) passCount++; else failCount++;
}

async function main() {
  const rid = 'test-' + crypto.randomBytes(6).toString('hex');
  const restaurant = await prisma.restaurant.create({
    data: {
      id: rid,
      slug: 'test-' + rid,
      name: 'Order Routing Test',
      currency: 'ETB',
      taxRate: 0.15,
      settings: JSON.stringify({}),
    },
  });
  const branch = await prisma.branch.create({
    data: { restaurantId: rid, name: 'Test Branch', isMainBranch: true },
  });
  console.log('✓ Created test restaurant', rid, 'and branch', branch.id);
  console.log('');

  // Test 1: default
  let mode = await resolveOrderRoutingMode(rid, branch.id);
  console.log('Test 1 — no settings → expect waiter_first');
  check('default mode', mode, 'waiter_first');

  // Test 2: restaurant direct_to_kitchen
  await prisma.restaurant.update({
    where: { id: rid },
    data: { settings: JSON.stringify({ kitchen: { orderRouting: 'direct_to_kitchen' } }) },
  });
  mode = await resolveOrderRoutingMode(rid, branch.id);
  console.log('');
  console.log('Test 2 — restaurant.kitchen.orderRouting=direct_to_kitchen → expect direct_to_kitchen');
  check('restaurant-level override', mode, 'direct_to_kitchen');

  // Test 3: branch waiter_first beats restaurant direct_to_kitchen
  await prisma.branchSettings.create({
    data: { branchId: branch.id, orderRouting: 'waiter_first' },
  });
  mode = await resolveOrderRoutingMode(rid, branch.id);
  console.log('');
  console.log('Test 3 — branch=waiter_first + restaurant=direct_to_kitchen → expect waiter_first (branch wins)');
  check('branch override wins', mode, 'waiter_first');

  // Test 4: branch null inherits restaurant
  await prisma.branchSettings.update({
    where: { branchId: branch.id },
    data: { orderRouting: null },
  });
  mode = await resolveOrderRoutingMode(rid, branch.id);
  console.log('');
  console.log('Test 4 — branch=null + restaurant=direct_to_kitchen → expect direct_to_kitchen (inherit)');
  check('branch null inherits restaurant', mode, 'direct_to_kitchen');

  // Test 5: invalid restaurant value falls to default
  await prisma.restaurant.update({
    where: { id: rid },
    data: { settings: JSON.stringify({ kitchen: { orderRouting: 'bogus_value' } }) },
  });
  await prisma.branchSettings.delete({ where: { branchId: branch.id } });
  mode = await resolveOrderRoutingMode(rid, branch.id);
  console.log('');
  console.log('Test 5 — restaurant.kitchen.orderRouting=bogus → expect waiter_first (default)');
  check('invalid restaurant value falls to default', mode, 'waiter_first');

  // Test 6: invalid branch value falls back to restaurant
  await prisma.restaurant.update({
    where: { id: rid },
    data: { settings: JSON.stringify({ kitchen: { orderRouting: 'direct_to_kitchen' } }) },
  });
  await prisma.branchSettings.create({
    data: { branchId: branch.id, orderRouting: 'bogus_value' },
  });
  mode = await resolveOrderRoutingMode(rid, branch.id);
  console.log('');
  console.log('Test 6 — branch=bogus + restaurant=direct_to_kitchen → expect direct_to_kitchen (skip invalid branch)');
  check('invalid branch value falls back to restaurant', mode, 'direct_to_kitchen');

  console.log('');
  console.log('=========================================');
  console.log(`  RESULT: ${passCount} passed, ${failCount} failed`);
  console.log('=========================================');
  if (failCount > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.branchSettings.deleteMany({ where: { branch: { restaurantId: { startsWith: 'test-' } } } });
      await prisma.branch.deleteMany({ where: { restaurantId: { startsWith: 'test-' } } });
      await prisma.restaurant.deleteMany({ where: { id: { startsWith: 'test-' } } });
      console.log('');
      console.log('✓ Test data cleaned up');
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
    await prisma.$disconnect();
  });
