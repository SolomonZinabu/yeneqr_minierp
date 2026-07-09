// ============================================================
// Yene QR — AI Service Layer
// Central service for all AI interactions.
// Uses the per-restaurant provider abstraction (src/lib/ai-provider.ts).
// Each restaurant owner configures their own AI provider + API key.
// YeneQR does NOT pay for AI — each restaurant brings their own key.
// ============================================================

import { aiChatCompletion } from '@/lib/ai-provider';
import type { AIMessage, AIToolDefinition } from './types';

export interface AIChatOptions {
  messages: AIMessage[];
  systemPrompt: string;
  tools?: AIToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIChatResult {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Send a chat completion request to the AI model.
 * Uses the restaurant's configured AI provider (per-restaurant config).
 * Falls back to Z.ai SDK in sandbox (development only).
 */
export async function aiChat(options: AIChatOptions, restaurantId?: string): Promise<AIChatResult> {
  const systemMessage = { role: 'system' as const, content: options.systemPrompt };
  const allMessages = [systemMessage, ...options.messages];

  const result = await aiChatCompletion({
    messages: allMessages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2048,
  }, restaurantId);

  return {
    content: result.content || '',
  };
}

/**
 * Generate a smart conversation title from the first message.
 * Uses the restaurant's configured AI provider.
 */
export async function generateConversationTitle(firstMessage: string, restaurantId?: string): Promise<string> {
  const result = await aiChatCompletion({
    messages: [
      { role: 'system', content: 'Generate a short 3-6 word title for a conversation that starts with this message. Return ONLY the title, nothing else. No quotes.' },
      { role: 'user', content: firstMessage },
    ],
    temperature: 0.3,
    maxTokens: 30,
  }, restaurantId);

  return result.content || 'New Conversation';
}

/**
 * Generate AI-powered suggestions based on restaurant data.
 * Uses the restaurant's configured AI provider.
 */
export async function generateSuggestion(
  agentType: string,
  category: string,
  context: string,
  restaurantId?: string
): Promise<{ title: string; description: string; actionType?: string; actionParams?: Record<string, unknown> }> {
  const result = await aiChatCompletion({
    messages: [
      {
        role: 'system',
        content: `You are an AI assistant for a restaurant management system. Generate a specific, actionable suggestion for a ${agentType} role in the ${category} category. Return a JSON object with: title (short), description (detailed), actionType (optional action to take), actionParams (optional parameters for the action). Return ONLY valid JSON.`
      },
      { role: 'user', content: context },
    ],
    temperature: 0.8,
    maxTokens: 500,
  }, restaurantId);

  const content = result.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    return { title: 'Suggestion', description: content };
  }
}
