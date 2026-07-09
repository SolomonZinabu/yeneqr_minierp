// Phase 4.1 — AI Menu Personalization
// GET /api/restaurants/[id]/recommendations?customerId=xxx
// Returns AI-powered "Recommended for You" based on order history
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requireAuth, requirePerm, verifyBranchAccess } from '@/lib/api-auth'
import { aiChatCompletion, isAIFeatureEnabled } from '@/lib/ai-provider'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)

    // Require restaurant:view permission + restaurant scope.
    // Previously this route had NO auth at all — anyone on the internet
    // could call it with a restaurantId and get customer order history.
    const permErr = requirePerm(auth, 'restaurant:view', restaurantId)
    if (permErr) return permErr

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const branchId = searchParams.get('branchId') || undefined

    // Verify branch access (branch-scoped staff can only see their branch's
    // recommendations; customers must match their session branch)
    const branchErr = verifyBranchAccess(auth, branchId, restaurantId)
    if (branchErr) return branchErr

    // Get customer's order history
    const where: Record<string, unknown> = { restaurantId, status: { in: ['completed', 'served'] } }
    if (customerId) where.customerId = customerId
    if (branchId) where.branchId = branchId

    const pastOrders = await db.order.findMany({
      where,
      include: { items: { select: { name: true, menuItemId: true, quantity: true } } },
      take: 20,
      orderBy: { createdAt: 'desc' },
    })

    // Get all available menu items
    const availableItems = await db.menuItem.findMany({
      where: { restaurantId, isAvailable: true },
      select: { id: true, name: true, nameAm: true, priceCents: true, image: true, isPopular: true, isVegetarian: true, isSpicy: true, categoryId: true },
      take: 100,
    })

    if (availableItems.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // If customer has history, try AI personalization
    if (customerId && pastOrders.length > 0) {
      const aiEnabled = await isAIFeatureEnabled(restaurantId, 'upsell')
      if (aiEnabled) {
        const orderedItems = pastOrders.flatMap(o => o.items.map(i => i.name))
        const itemList = availableItems.map(i => i.name).join(', ')

        const result = await aiChatCompletion({
          messages: [
            { role: 'system', content: "You are a restaurant recommendation engine. Based on the customer's past orders, suggest 5 items they would likely enjoy from the available menu. Return ONLY a JSON array of item names, nothing else." },
            { role: 'user', content: `Past orders: ${orderedItems.join(', ')}\n\nAvailable items: ${itemList}` },
          ],
          temperature: 0.5,
          maxTokens: 200,
        }, restaurantId)

        if (result.content) {
          try {
            const recommendedNames = JSON.parse(result.content) as string[]
            const recommendations = availableItems
              .filter(i => recommendedNames.some(rn => rn.toLowerCase().includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(rn.toLowerCase())))
              .slice(0, 5)
            if (recommendations.length > 0) {
              return NextResponse.json({ data: recommendations, source: 'ai' })
            }
          } catch { /* fall through to popularity-based */ }
        }
      }
    }

    // Fallback: popularity-based recommendations
    const popular = availableItems.filter(i => i.isPopular).slice(0, 5)
    const recommendations = popular.length >= 3 ? popular : availableItems.slice(0, 5)
    return NextResponse.json({ data: recommendations, source: 'popular' })
  } catch (error) {
    console.error('[RECOMMENDATIONS]', error)
    return NextResponse.json({ error: 'Failed to get recommendations' }, { status: 500 })
  }
}
