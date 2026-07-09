// Test order creation + add-to-order flow end-to-end
const BASE = 'http://localhost:3001'
const DATABASE_URL = 'file:/home/z/my-project/YeneQR/db/dev.db'
const crypto = require('crypto')

// QR_SECRET must match the value used by the server (env var or fallback in lib/qr-code.ts)
const QR_SECRET = process.env.QR_SECRET || 'yeneqr-qr-signing-secret-change-in-production-v2'

function signPayload(payload) {
  const data = `${payload.rid}:${payload.bid}:${payload.tid}:${payload.type}:${payload.iat}:${payload.exp || 'none'}`
  return crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex')
}

async function main() {
  const { PrismaClient } = require('@prisma/client')
  const p = new PrismaClient()

  // Get test data
  const restaurant = await p.restaurant.findFirst({ select: { id: true, slug: true, name: true } })
  const table = await p.table.findFirst({ where: { branch: { restaurantId: restaurant.id } }, select: { id: true, number: true, branchId: true } })
  const branch = await p.branch.findUnique({ where: { id: table.branchId }, select: { id: true, name: true } })
  const menuItems = await p.menuItem.findMany({ where: { restaurantId: restaurant.id, isAvailable: true }, select: { id: true, name: true, priceCents: true }, take: 3 })
  const qrCode = await p.qRCode.findFirst({ where: { tableId: table.id }, select: { id: true, signature: true, payload: true } })

  // Use the EXACT payload + signature stored in the DB (so we pass the cross-validation check)
  let storedPayload = qrCode?.payload
  let storedSignature = qrCode?.signature
  if (typeof storedPayload === 'string') {
    try { storedPayload = JSON.parse(storedPayload) } catch {}
  }
  console.log('Stored QR payload:', storedPayload)
  console.log('Stored signature:', storedSignature?.slice(0, 20) + '...')

  console.log('─'.repeat(70))
  console.log('TEST DATA')
  console.log('─'.repeat(70))
  console.log('Restaurant:', restaurant.id, restaurant.name)
  console.log('Branch:', branch.id, branch.name)
  console.log('Table:', table.id, '#'+table.number)
  console.log('Menu items:', menuItems.map(m => `${m.name} (${m.priceCents}c)`).join(', '))

  // Step 1: Create signed QR payload + customer session
  console.log('\n─'.repeat(70))
  console.log('STEP 1: Create customer session (simulated QR scan)')
  console.log('─'.repeat(70))

  const qrPayload = storedPayload || {
    rid: restaurant.id,
    bid: branch.id,
    tid: table.id,
    type: 'static',
    iat: Math.floor(Date.now() / 1000),
    exp: null,
  }
  const signature = storedSignature || signPayload(qrPayload)

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: qrPayload, signature }),
  })
  const sessionData = await sessionRes.json()
  if (!sessionRes.ok) {
    console.log('❌ Session creation failed:', sessionData)
    process.exit(1)
  }
  const sessionToken = sessionData.token
  console.log('✅ Session created, token:', sessionToken?.slice(0, 30) + '...')

  // Step 2: Create an order
  console.log('\n─'.repeat(70))
  console.log('STEP 2: Place initial order')
  console.log('─'.repeat(70))

  const orderBody = {
    branchId: branch.id,
    tableId: table.id,
    type: 'dine_in',
    guestCount: 2,
    items: [
      {
        menuItemId: menuItems[0].id,
        name: menuItems[0].name,
        nameAm: null,
        priceCents: menuItems[0].priceCents,
        quantity: 2,
        specialInstructions: 'extra spicy',
        modifiers: [],
      },
      {
        menuItemId: menuItems[1].id,
        name: menuItems[1].name,
        nameAm: null,
        priceCents: menuItems[1].priceCents,
        quantity: 1,
        specialInstructions: null,
        modifiers: [],
      },
    ],
    specialInstructions: '',
    discountAmount: 0,
    promotionId: null,
    loyaltyPointsUsed: 0,
    packagingChargeCents: 0,
  }
  const expectedSubtotal = menuItems[0].priceCents * 2 + menuItems[1].priceCents * 1
  console.log('POST /api/restaurants/' + restaurant.id + '/orders')
  console.log('Items:', orderBody.items.map(i => `${i.name} x${i.quantity} @ ${i.priceCents}c`).join(', '))
  console.log('Expected subtotal:', expectedSubtotal, 'cents')

  const orderRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(orderBody),
  })
  const orderData = await orderRes.json()
  if (!orderRes.ok) {
    console.log('❌ Order creation failed:', orderRes.status, JSON.stringify(orderData, null, 2))
    process.exit(1)
  }
  const order = orderData.data || orderData
  console.log('✅ Order created:')
  console.log('   id:', order.id)
  console.log('   orderNumber:', order.orderNumber)
  console.log('   status:', order.status)
  console.log('   subtotalCents:', order.subtotalCents)
  console.log('   totalAmountCents:', order.totalAmountCents)
  console.log('   items count:', order.items?.length)

  if (order.subtotalCents !== expectedSubtotal) {
    console.log(`⚠️  Subtotal mismatch: expected ${expectedSubtotal}, got ${order.subtotalCents}`)
  }

  // Step 3: Add round to order (the "Add to Order" flow)
  console.log('\n─'.repeat(70))
  console.log('STEP 3: Add round to existing order (Add to Order button)')
  console.log('─'.repeat(70))

  const roundBody = {
    items: [
      {
        menuItemId: menuItems[2].id,
        name: menuItems[2].name,
        nameAm: null,
        priceCents: menuItems[2].priceCents,
        quantity: 1,
        specialInstructions: null,
        modifierSelections: [],
      },
    ],
  }
  console.log('POST /api/restaurants/' + restaurant.id + '/orders/' + order.id + '/rounds')
  console.log('Items:', roundBody.items.map(i => `${i.name} x${i.quantity} @ ${i.priceCents}c`).join(', '))

  const roundRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/orders/${order.id}/rounds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(roundBody),
  })
  const roundData = await roundRes.json()
  if (!roundRes.ok) {
    console.log('❌ Add round failed:', roundRes.status, JSON.stringify(roundData, null, 2))
    process.exit(1)
  }
  const round = roundData.data || roundData
  console.log('✅ Round added:')
  console.log('   roundNumber:', round.roundNumber)
  console.log('   newTotalCents:', round.newTotalCents)
  console.log('   newItems:', round.newItems?.map(i => i.name).join(', '))

  // Step 4: Fetch the order back and verify
  console.log('\n─'.repeat(70))
  console.log('STEP 4: Verify order has all 3 items')
  console.log('─'.repeat(70))

  const fetchRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/orders/${order.id}`, {
    headers: { 'Authorization': `Bearer ${sessionToken}` },
  })
  const fetchData = await fetchRes.json()
  if (!fetchRes.ok) {
    console.log('❌ Fetch order failed:', fetchRes.status, JSON.stringify(fetchData, null, 2))
    process.exit(1)
  }
  const fetchedOrder = fetchData.data || fetchData
  console.log('✅ Order fetched:')
  console.log('   total items:', fetchedOrder.items?.length)
  console.log('   items:', fetchedOrder.items?.map(i => `${i.name} x${i.quantity} (round ${i.roundNumber || 1})`).join(', '))
  console.log('   totalAmountCents:', fetchedOrder.totalAmountCents)

  const expectedItems = 3
  if (fetchedOrder.items?.length !== expectedItems) {
    console.log(`\n❌ FAIL: Expected ${expectedItems} items, got ${fetchedOrder.items?.length}`)
    process.exit(1)
  }

  console.log('\n─'.repeat(70))
  console.log('✅ ALL TESTS PASSED — order creation + add-to-order works end-to-end')
  console.log('─'.repeat(70))

  await p.$disconnect()
  process.exit(0)
}

main().catch(e => {
  console.error('TEST ERROR:', e)
  process.exit(1)
})
