// Simulate the EXACT flow the menu page does:
// 1. POST /api/auth/session (creates session, returns JWT)
// 2. GET /api/restaurants/{id}/menus (loads menu)
// 3. POST /api/restaurants/{id}/orders (places order)
// 4. POST /api/restaurants/{id}/orders/{orderId}/rounds (add to order)
//
// This mimics what happens when a customer scans QR, adds items to cart, clicks Place Order,
// then adds more items and clicks "Add to Order".

const BASE = 'http://localhost:3001'
const crypto = require('crypto')
const QR_SECRET = 'yene-qr-prod-hmac-2024-habesha-continental'

async function main() {
  const { PrismaClient } = require('@prisma/client')
  const p = new PrismaClient()

  // Clean up any existing orders on this table
  await p.order.deleteMany({ where: { tableId: 'tbl-floor-habesha-bole-0-1' } })
  console.log('✓ Cleaned up old orders')

  const restaurant = await p.restaurant.findFirst({ select: { id: true, slug: true, name: true, taxRate: true, serviceCharge: true } })
  const table = await p.table.findFirst({ where: { branch: { restaurantId: restaurant.id } }, select: { id: true, number: true, branchId: true } })
  const branch = await p.branch.findUnique({ where: { id: table.branchId }, select: { id: true, name: true } })
  const menuItems = await p.menuItem.findMany({ where: { restaurantId: restaurant.id, isAvailable: true }, select: { id: true, name: true, nameAm: true, priceCents: true }, take: 5 })
  const qrCode = await p.qRCode.findFirst({ where: { tableId: table.id }, select: { id: true, signature: true, payload: true } })

  // Use stored payload + signature (so we pass cross-validation)
  let storedPayload = qrCode.payload
  if (typeof storedPayload === 'string') {
    try { storedPayload = JSON.parse(storedPayload) } catch {}
  }

  console.log('\n=== STEP 1: Create customer session (scan QR) ===')
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: storedPayload, signature: qrCode.signature }),
  })
  const sessionData = await sessionRes.json()
  if (!sessionRes.ok) {
    console.log('❌ Session failed:', sessionData)
    process.exit(1)
  }
  const sessionToken = sessionData.token
  const sessionBranch = sessionData.branch
  const sessionTable = sessionData.table
  console.log('✅ Session created')
  console.log('   branch from session:', sessionBranch?.id, sessionBranch?.name)
  console.log('   table from session:', sessionTable?.id, sessionTable?.number)

  console.log('\n=== STEP 2: Load menu ===')
  const menuRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/menus`, {
    headers: { 'Authorization': `Bearer ${sessionToken}` },
  })
  const menuData = await menuRes.json()
  console.log('✅ Menu loaded, items:', menuData.items?.length || menuData.categories?.length || 'n/a')

  console.log('\n=== STEP 3: Place initial order (simulating cart → Place Order) ===')
  // This is EXACTLY what placeOrder() in the menu page sends
  const cart = [
    { menuItem: menuItems[0], quantity: 2, totalPriceCents: menuItems[0].priceCents, selectedModifiers: [], specialInstructions: 'extra spicy', removedIngredients: [] },
    { menuItem: menuItems[1], quantity: 1, totalPriceCents: menuItems[1].priceCents, selectedModifiers: [], specialInstructions: '', removedIngredients: [] },
  ]
  const subtotal = cart.reduce((s, ci) => s + ci.totalPriceCents * ci.quantity, 0)
  const tax = Math.round(subtotal * (restaurant.taxRate || 0.15))
  const serviceCharge = Math.round(subtotal * (restaurant.serviceCharge || 0))

  // Build orderItems EXACTLY like placeOrder() does
  const orderItems = cart.map((ci) => {
    let instructions = ci.specialInstructions || ''
    if (ci.removedIngredients && ci.removedIngredients.length > 0) {
      const removeNote = `Remove: ${ci.removedIngredients.join(', ')}`
      instructions = instructions ? `${instructions}\n${removeNote}` : removeNote
    }
    return {
      menuItemId: ci.menuItem.id,
      name: ci.menuItem.name,
      nameAm: ci.menuItem.nameAm,
      priceCents: ci.totalPriceCents,
      quantity: ci.quantity,
      specialInstructions: instructions || null,
      modifiers: ci.selectedModifiers.map(({ group, option }) => ({
        modifierGroupId: group.id,
        modifierOptionId: option.id,
        name: option.name,
        priceDeltaCents: option.priceCents,
        quantity: 1,
      })),
    }
  })

  const orderBody = {
    branchId: sessionBranch?.id || null,  // ← this is what the menu page sends (branch?.id)
    tableId: sessionTable?.id || null,
    type: 'dine_in',
    guestCount: 2,
    items: orderItems,
    specialInstructions: '',
    discountAmount: 0,
    promotionId: null,
    loyaltyPointsUsed: 0,
    packagingChargeCents: 0,
  }

  console.log('POST body:', JSON.stringify(orderBody, null, 2))

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
    console.log('❌ ORDER CREATION FAILED:', orderRes.status, JSON.stringify(orderData, null, 2))
    process.exit(1)
  }
  const order = orderData.data || orderData
  console.log('✅ ORDER CREATED')
  console.log('   id:', order.id)
  console.log('   orderNumber:', order.orderNumber)
  console.log('   status:', order.status)
  console.log('   subtotalCents:', order.subtotalCents, '(expected:', subtotal, ')')
  console.log('   totalAmountCents:', order.totalAmountCents)

  console.log('\n=== STEP 4: Add round to order (Add to Order button) ===')
  // This is EXACTLY what addRoundToOrder() sends
  const roundCart = [
    { menuItem: menuItems[2], quantity: 1, totalPriceCents: menuItems[2].priceCents, selectedModifiers: [], specialInstructions: '', removedIngredients: [] },
  ]
  const roundItems = roundCart.map((ci) => {
    let instructions = ci.specialInstructions || ''
    if (ci.removedIngredients && ci.removedIngredients.length > 0) {
      const removeNote = `Remove: ${ci.removedIngredients.join(', ')}`
      instructions = instructions ? `${instructions}\n${removeNote}` : removeNote
    }
    return {
      menuItemId: ci.menuItem.id,
      name: ci.menuItem.name,
      nameAm: ci.menuItem.nameAm,
      priceCents: ci.totalPriceCents,
      quantity: ci.quantity,
      specialInstructions: instructions || null,
      modifierSelections: ci.selectedModifiers.map(({ group, option }) => ({
        modifierGroupId: group.id,
        modifierOptionId: option.id,
        name: option.name,
        priceDeltaCents: option.priceCents,
        quantity: 1,
      })),
    }
  })

  const roundBody = { items: roundItems }
  console.log('POST body:', JSON.stringify(roundBody, null, 2))

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
    console.log('❌ ADD ROUND FAILED:', roundRes.status, JSON.stringify(roundData, null, 2))
    process.exit(1)
  }
  const round = roundData.data || roundData
  console.log('✅ ROUND ADDED')
  console.log('   roundNumber:', round.roundNumber)
  console.log('   newTotalCents:', round.newTotalCents)

  console.log('\n=== STEP 5: Fetch order to verify all 3 items ===')
  const fetchRes = await fetch(`${BASE}/api/restaurants/${restaurant.id}/orders/${order.id}`, {
    headers: { 'Authorization': `Bearer ${sessionToken}` },
  })
  const fetchData = await fetchRes.json()
  if (!fetchRes.ok) {
    console.log('❌ FETCH FAILED:', fetchRes.status, fetchData)
    process.exit(1)
  }
  const fetchedOrder = fetchData.data || fetchData
  console.log('✅ ORDER VERIFIED')
  console.log('   total items:', fetchedOrder.items?.length, '(expected 3)')
  console.log('   items:', fetchedOrder.items?.map(i => `${i.name} x${i.quantity} (round ${i.roundNumber || 1})`).join(', '))

  if (fetchedOrder.items?.length !== 3) {
    console.log('\n❌ FAIL: Expected 3 items, got', fetchedOrder.items?.length)
    process.exit(1)
  }

  console.log('\n✅✅✅ FULL ORDER FLOW WORKS — order creation + add-to-order both succeed')
  await p.$disconnect()
  process.exit(0)
}

main().catch(e => {
  console.error('TEST ERROR:', e)
  process.exit(1)
})
