// Phase 5.2 — Predictive Ordering
// GET /api/restaurants/[id]/predictive-order?customerId=xxx
// AI pre-suggests likely order based on history
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm } from '@/lib/api-auth'
import { aiChatCompletion, isAIFeatureEnabled } from '@/lib/ai-provider'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    if (!customerId) {
      return NextResponse.json({ data: [], message: 'customerId required' })
    }

    // Get customer's past orders
    const pastOrders = await db.order.findMany({
      where: { restaurantId, customerId, status: { in: ['completed', 'served'] } },
      include: { items: { select: { name: true, quantity: true, priceCents: true } } },
      take: 10,
      orderBy: { createdAt: 'desc' },
    })

    if (pastOrders.length === 0) {
      return NextResponse.json({ data: [], message: 'No order history' })
    }

    // Get available items
    const availableItems = await db.menuItem.findMany({
      where: { restaurantId, isAvailable: true },
      select: { id: true, name: true, priceCents: true, image: true },
      take: 100,
    })

    // Try AI prediction
    const aiEnabled = await isAIFeatureEnabled(restaurantId, 'upsell')
    if (aiEnabled) {
      const orderHistory = pastOrders.flatMap(o => o.items.map(i => `${i.quantity}× ${i.name}`)).join(', ')
      const itemList = availableItems.map(i => `${i.id}:${i.name}`).join(', ')

      const result = await aiChatCompletion({
        messages: [
          { role: 'system', content: "You are a predictive ordering engine. Based on the customer's order history, predict what they are most likely to order next. Return a JSON array of objects with itemId, name, and quantity. Maximum 5 items." },
          { role: 'user', content: `Order history: ${orderHistory}\n\nAvailable items: ${itemList}` },
        ],
        temperature: 0.3,
        maxTokens: 300,
      }, restaurantId)

      if (result.content) {
        try {
          const predictions = JSON.parse(result.content) as Array<{ itemId: string; name: string; quantity: number }>
          // Validate items exist
          const valid = predictions.filter(p => availableItems.some(a => a.id === p.itemId))
          if (valid.length > 0) {
            return NextResponse.json({ data: valid, source: 'ai' })
          }
        } catch { /* fall through */ }
      }
    }

    // Fallback: most ordered items by this customer
    const itemFrequency: Record<string, { name: string; quantity: number; priceCents: number; count: number }> = {}
    for (const order of pastOrders) {
      for (const item of order.items) {
        const available = availableItems.find(a => a.name === item.name)
        if (!available) continue
        if (!itemFrequency[available.id]) {
          itemFrequency[available.id] = { name: item.name, quantity: item.quantity, priceCents: item.priceCents, count: 0 }
        }
        itemFrequency[available.id].count++
        itemFrequency[available.id].quantity = item.quantity
      }
    }

    const topItems = Object.entries(itemFrequency)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([itemId, data]) => ({ itemId, name: data.name, quantity: data.quantity, priceCents: data.priceCents }))

    return NextResponse.json({ data: topItems, source: 'history' })
  } catch (error) {
    console.error('[PREDICTIVE_ORDER]', error)
    return NextResponse.json({ error: 'Failed to predict order' }, { status: 500 })
  }
}
