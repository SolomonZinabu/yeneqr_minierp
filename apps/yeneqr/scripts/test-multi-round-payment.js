// Test multi-round payment flow
// Verifies:
// 1. Place order (round 1) → payment charges full order total
// 2. Add round 2 → order total increases
// 3. Second payment charges only the REMAINING balance (not full new total)
// 4. Third payment on fully-paid order → rejected with 400

const BASE = 'http://localhost:3001'
const crypto = require('crypto')
const QR_SECRET = 'yene-qr-prod-hmac-2024-habesha-continental'

async function main() {
  const { PrismaClient } = require('@prisma/client')
  const p = new PrismaClient()

  // Clean up
  await p.order.deleteMany({ where: { tableId: 'tbl-floor-habesha-bole-0-1' } }).catch(() => {})
  console.log('✓ Cleaned up old orders')

  const restaurant = await p.restaurant.findFirst({ select: { id: true, slug: true, name: true, taxRate: true, serviceCharge: true, currency: true } })
  const table = await p.table.findFirst({ where: { branch: { restaurantId: restaurant.id } }, select: { id: true, number: true, branchId: true } })
  const branch = await p.branch.findUnique({ where: { id: table.branchId }, select: { id: true, name: true } })
  const menuItems = await p.menuItem.findMany({ where: { restaurantId: restaurant.id, isAvailable: true }, select: { id: true, name: true, priceCents: true }, take: 5 })
  const qrCode = await p.qRCode.findFirst({ where: { tableId: table.id }, select: { id: true, signature: true, payload: true } })

  let storedPayload = qrCode.payload
  if (typeof storedPayload === 'string') { try { storedPayload = JSON.parse(storedPayload) } catch {} }

  // Create session
  console.log('\n=== STEP 1: Create customer session ===')
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: storedPayload, signature: qrCode.signature }),
  })
  const sessionData = await sessionRes.json()
  if (!sessionRes.ok) { console.log('❌ Session failed:', sessionData); process.exit(1) }
  const token = sessionData.token
  console.log('✅ Session created')

  // Place round 1 order
  console.log('\n=== STEP 2: Place round 1 order ===')
  const orderBody = {
    branchId: branch.id,
    tableId: table.id,
    type: 'dine_in',
    guestCount: 2,
    items: [{
      menuItemId: menuItems[0].id,
      name: menuItems[0].name,
      nameAm: null,
      priceCents: menuItems[0].priceCents,
      quantity: 2,
      specialInstructions: null,
      modifiers: [],
    }],
    specialInstructions: '',
    discountAmount: 0,
    promotionId: null,
    loyaltyPointsUsed: 0,
    packagingChargeCents: 0,
  }
  const orderRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(orderBody),
  })
  const orderData = await orderRes.json()
  if (!orderRes.ok) { console.log('❌ Order failed:', orderData); process.exit(1) }
  const order = orderData.data || orderData
  console.log('✅ Round 1 order created')
  console.log('   orderTotalCents:', order.totalAmountCents)

  // Payment 1 — should charge full order total
  console.log('\n=== STEP 3: Payment 1 (cash, full order total) ===')
  const pay1Res = await fetch(`${BASE}/api/restaurants/${restaurant.id}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ orderId: order.id, method: 'cash', tipAmount: 0 }),
  })
  const pay1Data = await pay1Res.json()
  if (!pay1Res.ok) { console.log('❌ Payment 1 failed:', pay1Data); process.exit(1) }
  const pay1Amount = pay1Data.data.payment.amountCents
  console.log('✅ Payment 1 created')
  console.log('   amountCents charged:', pay1Amount)
  console.log('   orderTotalCents:', order.totalAmountCents)
  if (pay1Amount !== order.totalAmountCents) {
    console.log('❌ FAIL: Payment 1 should charge full order total, got', pay1Amount)
    process.exit(1)
  }
  console.log('   ✓ Correct: charged full order total')

  // Mark payment 1 as completed (simulate staff confirmation)
  await p.payment.update({ where: { id: pay1Data.data.payment.id }, data: { status: 'completed', paidAt: new Date() } })
  console.log('   ✓ Marked payment 1 as completed (staff confirmation)')

  // Add round 2
  console.log('\n=== STEP 4: Add round 2 ===')
  const roundBody = {
    items: [{
      menuItemId: menuItems[1].id,
      name: menuItems[1].name,
      nameAm: null,
      priceCents: menuItems[1].priceCents,
      quantity: 1,
      specialInstructions: null,
      modifierSelections: [],
    }],
  }
  const roundRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/orders/${order.id}/rounds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(roundBody),
  })
  const roundData = await roundRes.json()
  if (!roundRes.ok) { console.log('❌ Round 2 failed:', roundData); process.exit(1) }
  const roundResponse = roundData.data || roundData
  console.log('✅ Round 2 added')
  console.log('   newTotalCents:', roundResponse.newTotalCents)

  // Payment 2 — should charge ONLY the remaining balance (not full new total)
  console.log('\n=== STEP 5: Payment 2 (should charge remaining balance only) ===')
  const expectedRemaining = roundResponse.newTotalCents - pay1Amount
  console.log('   Expected remaining balance:', expectedRemaining, 'cents')
  const pay2Res = await fetch(`${BASE}/api/restaurants/${restaurant.id}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ orderId: order.id, method: 'cash', tipAmount: 0 }),
  })
  const pay2Data = await pay2Res.json()
  if (!pay2Res.ok) { console.log('❌ Payment 2 failed:', pay2Data); process.exit(1) }
  const pay2Amount = pay2Data.data.payment.amountCents
  console.log('✅ Payment 2 created')
  console.log('   amountCents charged:', pay2Amount)
  if (pay2Amount !== expectedRemaining) {
    console.log(`❌ FAIL: Payment 2 should charge ${expectedRemaining} (remaining), got ${pay2Amount}`)
    process.exit(1)
  }
  console.log('   ✓ Correct: charged only the remaining balance (not full new total)')

  // Mark payment 2 as completed
  await p.payment.update({ where: { id: pay2Data.data.payment.id }, data: { status: 'completed', paidAt: new Date() } })
  console.log('   ✓ Marked payment 2 as completed')

  // Payment 3 — order is now fully paid, should be rejected
  console.log('\n=== STEP 6: Payment 3 (order fully paid — should be rejected) ===')
  const pay3Res = await fetch(`${BASE}/api/restaurants/${restaurant.id}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ orderId: order.id, method: 'cash', tipAmount: 0 }),
  })
  const pay3Data = await pay3Res.json()
  if (pay3Res.ok) {
    console.log('❌ FAIL: Payment 3 should have been rejected (order fully paid), but succeeded')
    process.exit(1)
  }
  console.log('✅ Payment 3 correctly rejected:', pay3Data.error)

  // Verify order has 2 completed payments
  console.log('\n=== STEP 7: Verify order has 2 completed payments ===')
  const fetchRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/orders/${order.id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const fetchData = await fetchRes.json()
  const fetchedOrder = fetchData.data || fetchData
  const completedPayments = (fetchedOrder.payments || []).filter(p => p.status === 'completed')
  console.log('   Completed payments:', completedPayments.length)
  console.log('   Payment 1 amount:', completedPayments[0]?.amountCents, 'cents')
  console.log('   Payment 2 amount:', completedPayments[1]?.amountCents, 'cents')
  console.log('   Order total:', fetchedOrder.totalAmountCents, 'cents')
  const totalPaid = completedPayments.reduce((sum, p) => sum + p.amountCents, 0)
  console.log('   Total paid:', totalPaid, 'cents')
  if (totalPaid !== fetchedOrder.totalAmountCents) {
    console.log(`❌ FAIL: Total paid (${totalPaid}) should equal order total (${fetchedOrder.totalAmountCents})`)
    process.exit(1)
  }
  console.log('   ✓ Correct: total paid equals order total')

  console.log('\n✅✅✅ ALL PAYMENT TESTS PASSED')
  console.log('   - Round 1 payment: charged full order total ✓')
  console.log('   - Round 2 payment: charged only remaining balance ✓')
  console.log('   - Fully-paid order: rejected additional payment ✓')
  console.log('   - Total paid = order total ✓')

  await p.$disconnect()
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
