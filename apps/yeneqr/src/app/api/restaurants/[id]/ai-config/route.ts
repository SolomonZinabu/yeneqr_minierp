// ============================================================
// Yene QR — AI Provider Configuration API
// ============================================================
// GET  /api/restaurants/[id]/ai-config — get current AI config
// PUT  /api/restaurants/[id]/ai-config — update AI config
//
// Restaurant owners configure their OWN AI provider + API key.
// YeneQR does NOT pay for AI — each restaurant brings their own key.
//
// Supported providers:
//   - none     → AI disabled (default)
//   - openai    → OpenAI API (paid, gpt-4o-mini ~$0.15/1M tokens)
//   - gemini    → Google Gemini API (FREE TIER: 15 req/min, 1500/day)
//   - anthropic → Anthropic Claude (paid, claude-3-haiku)
//   - custom    → Any OpenAI-compatible API (self-hosted, etc.)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        aiProvider: true,
        aiModel: true,
        aiBaseUrl: true,
        aiEnabled: true,
        aiTranslationEnabled: true,
        aiSuggestionsEnabled: true,
        aiChatEnabled: true,
        aiUpsellEnabled: true,
        // NOTE: aiApiKey is NOT returned for security — only a boolean
        aiApiKey: true,
      },
    })

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        ...restaurant,
        hasApiKey: !!restaurant.aiApiKey,
        aiApiKey: undefined, // Never expose the actual key
      }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[AI_CONFIG_GET]', error)
    return NextResponse.json({ error: 'Failed to fetch AI config' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'restaurant:manage', restaurantId)
    if (permErr) return permErr

    const body = await request.json()
    const {
      aiProvider,
      aiApiKey,
      aiModel,
      aiBaseUrl,
      aiEnabled,
      aiTranslationEnabled,
      aiSuggestionsEnabled,
      aiChatEnabled,
      aiUpsellEnabled,
    } = body

    // Validate provider
    const validProviders = ['none', 'openai', 'gemini', 'anthropic', 'custom']
    if (aiProvider && !validProviders.includes(aiProvider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      )
    }

    // Build update data (only update fields that are provided)
    const updateData: Record<string, unknown> = {}
    if (aiProvider !== undefined) updateData.aiProvider = aiProvider
    if (aiApiKey !== undefined) {
      // Empty string = clear the key; null = don't change; string = set new key
      updateData.aiApiKey = aiApiKey === '' ? null : aiApiKey
    }
    if (aiModel !== undefined) updateData.aiModel = aiModel || null
    if (aiBaseUrl !== undefined) updateData.aiBaseUrl = aiBaseUrl || null
    if (aiEnabled !== undefined) updateData.aiEnabled = aiEnabled
    if (aiTranslationEnabled !== undefined) updateData.aiTranslationEnabled = aiTranslationEnabled
    if (aiSuggestionsEnabled !== undefined) updateData.aiSuggestionsEnabled = aiSuggestionsEnabled
    if (aiChatEnabled !== undefined) updateData.aiChatEnabled = aiChatEnabled
    if (aiUpsellEnabled !== undefined) updateData.aiUpsellEnabled = aiUpsellEnabled

    // If provider is 'none', disable all features
    if (aiProvider === 'none') {
      updateData.aiEnabled = false
      updateData.aiTranslationEnabled = false
      updateData.aiSuggestionsEnabled = false
      updateData.aiChatEnabled = false
      updateData.aiUpsellEnabled = false
    }

    // If enabling AI but no API key is set, reject
    if (aiEnabled === true && aiProvider && aiProvider !== 'none') {
      const current = await db.restaurant.findUnique({
        where: { id: restaurantId },
        select: { aiApiKey: true },
      })
      if (!current?.aiApiKey && !aiApiKey) {
        return NextResponse.json(
          { error: 'Cannot enable AI without an API key. Please provide your provider API key.' },
          { status: 400 }
        )
      }
    }

    const updated = await db.restaurant.update({
      where: { id: restaurantId },
      data: updateData,
      select: {
        aiProvider: true,
        aiModel: true,
        aiBaseUrl: true,
        aiEnabled: true,
        aiTranslationEnabled: true,
        aiSuggestionsEnabled: true,
        aiChatEnabled: true,
        aiUpsellEnabled: true,
      },
    })

    return NextResponse.json({ data: { ...updated, hasApiKey: !!aiApiKey || !!updateData.aiApiKey } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[AI_CONFIG_PUT]', error)
    return NextResponse.json({ error: 'Failed to update AI config' }, { status: 500 })
  }
}
