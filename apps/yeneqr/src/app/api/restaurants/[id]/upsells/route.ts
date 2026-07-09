// Phase 4.2 — AI Upsells & Cross-Sells
// GET /api/restaurants/[id]/upsells?itemIds=id1,id2
// Returns "Frequently Ordered Together" + "Customers Also Ordered"
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
    const itemIds = searchParams.get('itemIds')?.split(',').filter(Boolean) || []

    if (itemIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Find orders that contain the specified items
    const ordersWithItems = await db.orderItem.findMany({
      where: { menuItemId: { in: itemIds }, order: { restaurantId } },
      select: { orderId: true },
      distinct: ['orderId'],
    })

    const orderIds = ordersWithItems.map(oi => oi.orderId)

    if (orderIds.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Find other items in those orders (cross-sell)
    const coOrderedItems = await db.orderItem.findMany({
      where: { orderId: { in: orderIds }, menuItemId: { notIn: itemIds } },
      select: { menuItemId: true, name: true },
    })

    // Count frequency
    const frequency: Record<string, { name: string; count: number }> = {}
    for (const item of coOrderedItems) {
      if (!frequency[item.menuItemId]) {
        frequency[item.menuItemId] = { name: item.name, count: 0 }
      }
      frequency[item.menuItemId].count++
    }

    // Sort by frequency, get top 5
    const topItems = Object.entries(frequency)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)

    if (topItems.length === 0) {
      // Fallback: try AI suggestion
      const aiEnabled = await isAIFeatureEnabled(restaurantId, 'upsell')
      if (aiEnabled) {
        const currentItems = await db.menuItem.findMany({
          where: { id: { in: itemIds } },
          select: { name: true },
        })
        const allItems = await db.menuItem.findMany({
          where: { restaurantId, isAvailable: true, id: { notIn: itemIds } },
          select: { id: true, name: true, priceCents: true, image: true },
          take: 50,
        })

        const result = await aiChatCompletion({
          messages: [
            { role: 'system', content: 'You are a restaurant upsell engine. Given the items a customer is ordering, suggest 3 complementary items from the menu. Return ONLY a JSON array of item names.' },
            { role: 'user', content: `Ordering: ${currentItems.map(i => i.name).join(', ')}\nAvailable: ${allItems.map(i => i.name).join(', ')}` },
          ],
          temperature: 0.5,
          maxTokens: 150,
        }, restaurantId)

        if (result.content) {
          try {
            const suggestedNames = JSON.parse(result.content) as string[]
            const matched = allItems.filter(i => suggestedNames.some(sn => i.name.toLowerCase().includes(sn.toLowerCase()) || sn.toLowerCase().includes(i.name.toLowerCase()))).slice(0, 3)
            return NextResponse.json({ data: matched, source: 'ai' })
          } catch { /* fall through */ }
        }
      }

      // Final fallback: popular items
      const popular = await db.menuItem.findMany({
        where: { restaurantId, isAvailable: true, isPopular: true, id: { notIn: itemIds } },
        select: { id: true, name: true, priceCents: true, image: true },
        take: 3,
      })
      return NextResponse.json({ data: popular, source: 'popular' })
    }

    // Fetch full item data for the top co-ordered items
    const topItemIds = topItems.map(([id]) => id)
    const items = await db.menuItem.findMany({
      where: { id: { in: topItemIds } },
      select: { id: true, name: true, nameAm: true, priceCents: true, image: true },
    })

    // Sort by frequency
    const sortedItems = topItemIds
      .map(id => items.find(i => i.id === id))
      .filter(Boolean)
      .map(item => ({ ...item, orderCount: frequency[item!.id].count }))

    return NextResponse.json({ data: sortedItems, source: 'frequently_ordered' })
  } catch (error) {
    console.error('[UPSELLS]', error)
    return NextResponse.json({ error: 'Failed to get upsells' }, { status: 500 })
  }
}
