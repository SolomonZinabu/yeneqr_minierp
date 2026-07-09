// Reproduce the 403 "Forbidden — insufficient permission" bug
// Steps:
// 1. Create customer session (gets JWT)
// 2. Decode JWT to verify type='customer'
// 3. Call GET /api/restaurants/{id}/orders?tableId=X&status=active (the active order recovery call)
// 4. Call POST /api/restaurants/{id}/orders (place order)
// 5. Call POST /api/restaurants/{id}/orders/{orderId}/rounds (add to order)
// 6. Report which step fails with 403

const BASE = 'http://localhost:3001'
const jwt = require('jsonwebtoken')

async function main() {
  const { PrismaClient } = require('@prisma/client')
  const p = new PrismaClient()

  await p.order.deleteMany({ where: { tableId: 'tbl-floor-habesha-bole-0-1' } })

  const restaurant = await p.restaurant.findFirst({ select: { id: true, slug: true } })
  const table = await p.table.findFirst({ where: { branch: { restaurantId: restaurant.id } }, select: { id: true, number: true, branchId: true } })
  const branch = await p.branch.findUnique({ where: { id: table.branchId }, select: { id: true, name: true } })
  const menuItems = await p.menuItem.findMany({ where: { restaurantId: restaurant.id, isAvailable: true }, select: { id: true, name: true, priceCents: true }, take: 3 })
  const qrCode = await p.qRCode.findFirst({ where: { tableId: table.id }, select: { id: true, signature: true, payload: true } })

  let storedPayload = qrCode.payload
  if (typeof storedPayload === 'string') { try { storedPayload = JSON.parse(storedPayload) } catch {} }

  // Step 1: Create session
  console.log('=== STEP 1: Create customer session ===')
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: storedPayload, signature: qrCode.signature }),
  })
  const sessionData = await sessionRes.json()
  if (!sessionRes.ok) { console.log('❌ Session failed:', sessionData); process.exit(1) }
  const token = sessionData.token
  console.log('✅ Session created')

  // Step 2: Decode JWT
  console.log('\n=== STEP 2: Decode JWT to verify type ===')
  const decoded = jwt.decode(token)
  console.log('Decoded JWT:', JSON.stringify(decoded, null, 2))

  // Step 3: GET /orders?tableId=X&status=active (this is what the menu page calls on load)
  console.log('\n=== STEP 3: GET /api/restaurants/{id}/orders?tableId=X&status=active ===')
  const ordersListRes = await fetch(
    `${BASE}/api/restaurants/${restaurant.id}/orders?tableId=${table.id}&status=active`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  console.log('Status:', ordersListRes.status)
  const ordersListData = await ordersListRes.json()
  if (!ordersListRes.ok) {
    console.log('❌ FAILED:', JSON.stringify(ordersListData, null, 2))
  } else {
    console.log('✅ Success, orders found:', (ordersListData.data || ordersListData.orders || []).length)
  }

  // Step 4: POST /orders (place order)
  console.log('\n=== STEP 4: POST /api/restaurants/{id}/orders (place order) ===')
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
      quantity: 1,
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
  console.log('Status:', orderRes.status)
  const orderData = await orderRes.json()
  if (!orderRes.ok) {
    console.log('❌ FAILED:', JSON.stringify(orderData, null, 2))
    process.exit(1)
  }
  const order = orderData.data || orderData
  console.log('✅ Order created:', order.id, 'status:', order.status)

  // Step 5: POST /orders/{orderId}/rounds (add to order)
  console.log('\n=== STEP 5: POST /api/restaurants/{id}/orders/{orderId}/rounds (add to order) ===')
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
  console.log('Status:', roundRes.status)
  const roundData = await roundRes.json()
  if (!roundRes.ok) {
    console.log('❌ FAILED:', JSON.stringify(roundData, null, 2))
  } else {
    console.log('✅ Round added:', JSON.stringify(roundData.data || roundData, null, 2))
  }

  await p.$disconnect()
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
