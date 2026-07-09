// ============================================================
// Yene QR — AI Agent Config Service
// Loads per-tenant agent config from DB with caching & defaults
// ============================================================

import { db } from '@/lib/db';
import { AGENT_INFO, SUGGESTION_CATEGORIES } from '../types';
import type { AgentType } from '../types';

export interface ResolvedAgentConfig {
  agentType: AgentType;
  isEnabled: boolean;
  name: string;
  greeting: string;
  icon: string;
  color: string;
  temperature: number;
  maxToolIterations: number;
  maxTokens: number;
  customInstructions: string | null;
  enabledTools: string[] | null; // null = all tools enabled
  disabledTools: string[];
  suggestionCategories: string[];
  language: string;
  autoSuggest: boolean;
  autoSuggestInterval: number;
}

// In-memory cache with TTL
const configCache = new Map<string, { config: ResolvedAgentConfig; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the resolved agent config for a restaurant + agent type.
 * Merges DB config over hard-coded defaults. If no DB config exists,
 * returns the defaults (current hard-coded values) — backward compatible.
 */
export async function getAgentConfig(restaurantId: string, agentType: AgentType): Promise<ResolvedAgentConfig> {
  const cacheKey = `${restaurantId}:${agentType}`;
  const cached = configCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.config;
  }

  const dbConfig = await db.aIAgentConfig.findUnique({
    where: { restaurantId_agentType: { restaurantId, agentType } },
  });

  const defaults = AGENT_INFO[agentType];
  const defaultSuggestionCategories = SUGGESTION_CATEGORIES[agentType] as readonly string[];

  const resolved: ResolvedAgentConfig = {
    agentType,
    isEnabled: dbConfig?.isEnabled ?? true,
    name: dbConfig?.customName ?? defaults.name,
    greeting: dbConfig?.customGreeting ?? defaults.greeting,
    icon: dbConfig?.customIcon ?? defaults.icon,
    color: dbConfig?.customColor ?? defaults.color,
    temperature: dbConfig?.temperature ?? (agentType === 'customer' ? 0.8 : 0.6),
    maxToolIterations: dbConfig?.maxToolIterations ?? 5,
    maxTokens: dbConfig?.maxTokens ?? 2048,
    customInstructions: dbConfig?.customInstructions ?? null,
    enabledTools: dbConfig?.enabledTools ? JSON.parse(dbConfig.enabledTools) : null,
    disabledTools: dbConfig?.disabledTools ? JSON.parse(dbConfig.disabledTools) : [],
    suggestionCategories: dbConfig?.suggestionCategories
      ? JSON.parse(dbConfig.suggestionCategories)
      : [...defaultSuggestionCategories],
    language: dbConfig?.language ?? 'en',
    autoSuggest: dbConfig?.autoSuggest ?? false,
    autoSuggestInterval: dbConfig?.autoSuggestInterval ?? 60,
  };

  configCache.set(cacheKey, { config: resolved, expiresAt: Date.now() + CACHE_TTL });
  return resolved;
}

/**
 * Get the list of enabled agent types for a restaurant.
 * If no configs exist yet, all agents are enabled by default.
 */
export async function getEnabledAgentTypes(restaurantId: string): Promise<AgentType[]> {
  const configs = await db.aIAgentConfig.findMany({
    where: { restaurantId, isEnabled: true },
    select: { agentType: true },
  });
  // If no configs exist yet, all agents are enabled by default
  if (configs.length === 0) return ['owner', 'kitchen', 'waiter', 'customer'];
  return configs.map(c => c.agentType as AgentType);
}

/**
 * Invalidate the config cache for a specific restaurant (or all).
 */
export function invalidateConfigCache(restaurantId?: string): void {
  if (restaurantId) {
    for (const key of configCache.keys()) {
      if (key.startsWith(restaurantId)) configCache.delete(key);
    }
  } else {
    configCache.clear();
  }
}
