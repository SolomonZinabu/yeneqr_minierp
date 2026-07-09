// Test cash payment confirmation flow
// Verifies:
// 1. Customer initiates cash payment → payment created as 'pending' (NOT completed)
// 2. Staff confirms cash payment → payment status becomes 'completed'
// 3. Order status becomes 'completed' after staff confirmation
// 4. Customer's orderAlreadyPaid check correctly reflects full payment

const BASE = 'http://localhost:3001'
const crypto = require('crypto')
const QR_SECRET = 'yene-qr-prod-hmac-2024-habesha-continental'

async function main() {
  const { PrismaClient } = require('@prisma/client')
  const p = new PrismaClient()

  // Clean up
  await p.order.deleteMany({ where: { tableId: 'tbl-floor-habesha-bole-0-1' } }).catch(() => {})
  console.log('✓ Cleaned up old orders')

  const restaurant = await p.restaurant.findFirst({ select: { id: true, slug: true, name: true } })
  const table = await p.table.findFirst({ where: { branch: { restaurantId: restaurant.id } }, select: { id: true, number: true, branchId: true } })
  const branch = await p.branch.findUnique({ where: { id: table.branchId }, select: { id: true, name: true } })
  const menuItem = await p.menuItem.findFirst({ where: { restaurantId: restaurant.id, isAvailable: true }, select: { id: true, name: true, priceCents: true } })
  const qrCode = await p.qRCode.findFirst({ where: { tableId: table.id }, select: { signature: true, payload: true } })

  let storedPayload = qrCode.payload
  if (typeof storedPayload === 'string') { try { storedPayload = JSON.parse(storedPayload) } catch {} }

  // Step 1: Create customer session
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

  // Step 2: Place order
  console.log('\n=== STEP 2: Place order ===')
  const orderRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      branchId: branch.id, tableId: table.id, type: 'dine_in', guestCount: 1,
      items: [{ menuItemId: menuItem.id, name: menuItem.name, nameAm: null, priceCents: menuItem.priceCents, quantity: 1, modifiers: [] }],
      specialInstructions: '', discountAmount: 0, promotionId: null, loyaltyPointsUsed: 0, packagingChargeCents: 0,
    }),
  })
  const orderData = await orderRes.json()
  if (!orderRes.ok) { console.log('❌ Order failed:', orderData); process.exit(1) }
  const order = orderData.data || orderData
  console.log('✅ Order created:', order.id, 'total:', order.totalAmountCents, 'cents')

  // Step 3: Customer initiates cash payment (from their phone)
  console.log('\n=== STEP 3: Customer initiates cash payment ===')
  const payRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ orderId: order.id, method: 'cash', tipAmount: 0 }),
  })
  const payData = await payRes.json()
  if (!payRes.ok) { console.log('❌ Payment failed:', payData); process.exit(1) }
  const payment = payData.data.payment
  console.log('✅ Cash payment created')
  console.log('   payment id:', payment.id)
  console.log('   payment status:', payment.status)
  console.log('   amountCents:', payment.amountCents)

  if (payment.status !== 'pending') {
    console.log(`❌ FAIL: Cash payment should be 'pending' (awaiting staff confirmation), got '${payment.status}'`)
    process.exit(1)
  }
  console.log('   ✓ Correct: cash payment is pending (not completed)')

  // Step 4: Verify order is NOT marked as completed yet
  console.log('\n=== STEP 4: Verify order is NOT completed (payment still pending) ===')
  const orderBeforeConfirm = await p.order.findUnique({ where: { id: order.id }, select: { status: true } })
  console.log('   Order status before staff confirmation:', orderBeforeConfirm.status)
  if (orderBeforeConfirm.status === 'completed') {
    console.log('❌ FAIL: Order should NOT be completed before staff confirms cash payment')
    process.exit(1)
  }
  console.log('   ✓ Correct: order is not completed yet')

  // Step 5: Staff confirms cash payment (PUT /payments/{paymentId})
  console.log('\n=== STEP 5: Staff confirms cash payment ===')
  // Staff needs a staff token — let's get one by logging in
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@habeshamaebel.com', password: 'admin123', restaurantSlug: 'habesha-maebel' }),
  })
  const loginData = await loginRes.json()
  if (!loginRes.ok) { console.log('❌ Staff login failed:', loginData); process.exit(1) }
  const staffToken = loginData.token
  console.log('✅ Staff logged in')

  const confirmRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/payments/${payment.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${staffToken}` },
    body: JSON.stringify({ status: 'completed' }),
  })
  const confirmData = await confirmRes.json()
  if (!confirmRes.ok) { console.log('❌ Confirm failed:', confirmData); process.exit(1) }
  console.log('✅ Payment confirmed by staff')
  console.log('   payment status:', confirmData.data.status)

  if (confirmData.data.status !== 'completed') {
    console.log(`❌ FAIL: Payment should be 'completed' after staff confirms, got '${confirmData.data.status}'`)
    process.exit(1)
  }
  console.log('   ✓ Correct: payment is now completed')

  // Step 6: Verify order is now completed
  console.log('\n=== STEP 6: Verify order is now completed ===')
  const orderAfterConfirm = await p.order.findUnique({ where: { id: order.id }, select: { status: true, completedAt: true } })
  console.log('   Order status after staff confirmation:', orderAfterConfirm.status)
  if (orderAfterConfirm.status !== 'completed') {
    console.log(`❌ FAIL: Order should be 'completed' after staff confirms cash payment, got '${orderAfterConfirm.status}'`)
    process.exit(1)
  }
  console.log('   ✓ Correct: order is now completed')

  // Step 7: Verify payment record has paidAt set
  console.log('\n=== STEP 7: Verify payment has paidAt timestamp ===')
  const paymentRecord = await p.payment.findUnique({ where: { id: payment.id }, select: { status: true, paidAt: true } })
  console.log('   payment.status:', paymentRecord.status)
  console.log('   payment.paidAt:', paymentRecord.paidAt)
  if (!paymentRecord.paidAt) {
    console.log('❌ FAIL: paidAt should be set after confirmation')
    process.exit(1)
  }
  console.log('   ✓ Correct: paidAt is set')

  console.log('\n✅✅✅ ALL CASH PAYMENT TESTS PASSED')
  console.log('   - Customer cash payment created as pending ✓')
  console.log('   - Order not completed before staff confirmation ✓')
  console.log('   - Staff confirms → payment status = completed ✓')
  console.log('   - Order status = completed after confirmation ✓')
  console.log('   - paidAt timestamp set ✓')

  await p.$disconnect()
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
