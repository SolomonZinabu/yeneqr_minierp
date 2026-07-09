// ============================================================
// Yene QR — AI Provider Abstraction (Per-Restaurant, Owner-Controlled)
// ============================================================
// Each restaurant owner configures their own AI provider + API key.
// YeneQR does NOT pay for AI — each restaurant brings their own key.
//
// Supported providers:
//   - openai    → OpenAI API (gpt-4o-mini, gpt-4o, etc.)
//   - gemini    → Google Gemini API (FREE TIER available — gemini-1.5-flash)
//   - anthropic → Anthropic Claude API (claude-3-haiku, claude-3-sonnet)
//   - custom    → Any OpenAI-compatible API (self-hosted, LM Studio, etc.)
//   - none      → AI disabled (all features gracefully degrade)
//
// Configuration is stored per-restaurant in the Restaurant model:
//   aiProvider, aiApiKey, aiModel, aiBaseUrl,
//   aiEnabled (master switch),
//   aiTranslationEnabled, aiSuggestionsEnabled, aiChatEnabled, aiUpsellEnabled
//
// In the Z.ai sandbox (development only), falls back to z-ai-web-dev-sdk
// when no restaurant-level config is available.
// ============================================================

import { db } from '@/lib/db'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionParams {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
}

export interface ChatCompletionResult {
  content: string | null
  provider: string  // 'openai' | 'gemini' | 'anthropic' | 'custom' | 'z-ai' | 'none'
}

interface RestaurantAIConfig {
  aiProvider: string
  aiApiKey: string | null
  aiModel: string | null
  aiBaseUrl: string | null
  aiEnabled: boolean
  aiTranslationEnabled: boolean
  aiSuggestionsEnabled: boolean
  aiChatEnabled: boolean
  aiUpsellEnabled: boolean
}

/**
 * Fetch the AI configuration for a restaurant from the DB.
 * Returns null if the restaurant doesn't exist.
 */
export async function getRestaurantAIConfig(restaurantId: string): Promise<RestaurantAIConfig | null> {
  try {
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        aiProvider: true,
        aiApiKey: true,
        aiModel: true,
        aiBaseUrl: true,
        aiEnabled: true,
        aiTranslationEnabled: true,
        aiSuggestionsEnabled: true,
        aiChatEnabled: true,
        aiUpsellEnabled: true,
      },
    })
    return restaurant
  } catch {
    return null
  }
}

/**
 * Check if a specific AI feature is enabled for a restaurant.
 * Checks both the master switch (aiEnabled) and the feature-specific toggle.
 */
export async function isAIFeatureEnabled(
  restaurantId: string,
  feature: 'translation' | 'suggestions' | 'chat' | 'upsell'
): Promise<boolean> {
  const config = await getRestaurantAIConfig(restaurantId)
  if (!config || !config.aiEnabled || config.aiProvider === 'none') return false

  switch (feature) {
    case 'translation': return config.aiTranslationEnabled
    case 'suggestions': return config.aiSuggestionsEnabled
    case 'chat': return config.aiChatEnabled
    case 'upsell': return config.aiUpsellEnabled
    default: return false
  }
}

/**
 * Generate a chat completion using the restaurant's configured AI provider.
 * Falls back to Z.ai SDK in the sandbox (development only).
 * Returns { content: null, provider: 'none' } if AI is disabled.
 */
export async function aiChatCompletion(
  params: ChatCompletionParams,
  restaurantId?: string
): Promise<ChatCompletionResult> {
  const { messages, temperature = 0.3, maxTokens = 500 } = params

  // ── If restaurantId provided, use the restaurant's config ──
  if (restaurantId) {
    const config = await getRestaurantAIConfig(restaurantId)

    if (config && config.aiEnabled && config.aiProvider !== 'none' && config.aiApiKey) {
      const result = await callProvider(config, messages, temperature, maxTokens)
      if (result.content !== null) return result
    }
  }

  // ── Fallback: Z.ai SDK (sandbox/development only) ──
  // This ONLY works in the Z.ai preview environment. On production, it
  // silently fails and returns null — which is the correct behavior
  // when the restaurant owner hasn't configured an AI provider.
  if (process.env.NODE_ENV === 'development' && !process.env.OPENAI_API_KEY) {
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
      })
      const content = completion.choices[0]?.message?.content?.trim()
      return { content: content || null, provider: 'z-ai' }
    } catch {
      // Expected on production — Z.ai SDK not available
    }
  }

  return { content: null, provider: 'none' }
}

/**
 * Call the configured AI provider's API.
 * Supports OpenAI, Gemini, Anthropic, and custom OpenAI-compatible endpoints.
 */
async function callProvider(
  config: RestaurantAIConfig,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number
): Promise<ChatCompletionResult> {
  const { aiProvider, aiApiKey, aiModel, aiBaseUrl } = config

  try {
    switch (aiProvider) {
      // ── OpenAI (or any OpenAI-compatible API) ──
      case 'openai':
      case 'custom': {
        const baseUrl = aiBaseUrl || 'https://api.openai.com/v1'
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiApiKey}`,
          },
          body: JSON.stringify({
            model: aiModel || 'gpt-4o-mini',
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(30000),
        })
        if (response.ok) {
          const data = await response.json()
          const content = data.choices?.[0]?.message?.content?.trim()
          return { content: content || null, provider: aiProvider }
        }
        console.error(`[AI_${aiProvider}] API error:`, response.status)
        return { content: null, provider: aiProvider }
      }

      // ── Google Gemini (free tier available) ──
      case 'gemini': {
        const model = aiModel || 'gemini-1.5-flash'
        const baseUrl = aiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta'
        const url = `${baseUrl}/models/${model}:generateContent?key=${aiApiKey}`

        // Convert messages to Gemini format
        const contents = messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens,
            },
          }),
          signal: AbortSignal.timeout(30000),
        })

        if (response.ok) {
          const data = await response.json()
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
          return { content: content || null, provider: 'gemini' }
        }
        console.error('[AI_GEMINI] API error:', response.status)
        return { content: null, provider: 'gemini' }
      }

      // ── Anthropic Claude ──
      case 'anthropic': {
        const baseUrl = aiBaseUrl || 'https://api.anthropic.com/v1'
        const model = aiModel || 'claude-3-5-haiku-20241022'

        // Extract system message
        const systemMsg = messages.find(m => m.role === 'system')?.content || ''
        const userMessages = messages.filter(m => m.role !== 'system')

        const response = await fetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': aiApiKey || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            system: systemMsg,
            messages: userMessages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            temperature,
            max_tokens: maxTokens,
          }),
          signal: AbortSignal.timeout(30000),
        })

        if (response.ok) {
          const data = await response.json()
          const content = data.content?.[0]?.text?.trim()
          return { content: content || null, provider: 'anthropic' }
        }
        console.error('[AI_ANTHROPIC] API error:', response.status)
        return { content: null, provider: 'anthropic' }
      }

      default:
        return { content: null, provider: 'none' }
    }
  } catch (err) {
    console.error(`[AI_${aiProvider}] Request failed:`, err)
    return { content: null, provider: aiProvider }
  }
}

/**
 * Convenience: translate text to a target language using AI.
 * Checks if translation feature is enabled for the restaurant first.
 * Returns null if AI is disabled or translation is off.
 */
export async function aiTranslate(
  text: string,
  targetLanguage: string,
  restaurantId?: string
): Promise<string | null> {
  if (!text || text.trim().length === 0) return null

  // Check if translation is enabled for this restaurant
  if (restaurantId) {
    const enabled = await isAIFeatureEnabled(restaurantId, 'translation')
    if (!enabled) return null
  }

  const langNames: Record<string, string> = {
    am: 'Amharic (አማርኛ)',
    om: 'Oromo (Afaan Oromoo)',
    ti: 'Tigrinya (ትግርኛ)',
    so: 'Somali (Soomaali)',
    aa: 'Afar (Afaraf)',
    sid: 'Sidama (Sidaamu Afo)',
    ar: 'Arabic (العربية)',
    it: 'Italian (Italiano)',
    zh: 'Chinese (中文)',
    fr: 'French (Français)',
    hi: 'Hindi (हिन्दी)',
    ml: 'Malayalam (മലയാളം)',
    en: 'English',
  }

  const langName = langNames[targetLanguage] || targetLanguage

  const result = await aiChatCompletion({
    messages: [
      {
        role: 'system',
        content: `You are a professional restaurant menu translator. Translate the given text into ${langName}. Return ONLY the translation, no explanations. If the text is already in ${langName}, return it as-is. Keep food names recognizable — use transliteration for proper nouns.`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
    temperature: 0.2,
    maxTokens: 200,
  }, restaurantId)

  return result.content
}
