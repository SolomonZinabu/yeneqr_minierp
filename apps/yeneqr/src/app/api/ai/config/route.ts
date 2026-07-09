// ============================================================
// Yene QR — AI Agent Configuration API Route
// CRUD for per-tenant AI agent settings
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAgentConfig, invalidateConfigCache } from '@/lib/ai/config/agent-config-service';
import { AGENT_INFO, SUGGESTION_CATEGORIES } from '@/lib/ai/types';
import type { AgentType } from '@/lib/ai/types';

// GET /api/ai/config?restaurantId=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
    }

    // Get all configs for this restaurant
    const dbConfigs = await db.aIAgentConfig.findMany({
      where: { restaurantId },
    });

    // Build complete config for all 4 agent types, using defaults where no DB config exists
    const agentTypes: AgentType[] = ['owner', 'kitchen', 'waiter', 'customer'];
    const configs = await Promise.all(
      agentTypes.map(async (agentType) => {
        const resolved = await getAgentConfig(restaurantId, agentType);
        const dbConfig = dbConfigs.find(c => c.agentType === agentType);
        return {
          agentType,
          ...resolved,
          // Include DB-level fields for editing
          dbId: dbConfig?.id ?? null,
          hasCustomConfig: !!dbConfig,
        };
      })
    );

    return NextResponse.json({ configs });
  } catch (error: any) {
    console.error('AI Config GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/ai/config
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, agentType, ...updates } = body;

    if (!restaurantId || !agentType) {
      return NextResponse.json({ error: 'restaurantId and agentType are required' }, { status: 400 });
    }

    // Validate agentType
    if (!['owner', 'kitchen', 'waiter', 'customer'].includes(agentType)) {
      return NextResponse.json({ error: 'Invalid agentType' }, { status: 400 });
    }

    // Prepare update data - only allow certain fields
    const allowedFields = [
      'isEnabled', 'customName', 'customGreeting', 'customIcon', 'customColor',
      'customInstructions', 'temperature', 'maxToolIterations', 'maxTokens',
      'enabledTools', 'disabledTools', 'suggestionCategories', 'language',
      'autoSuggest', 'autoSuggestInterval',
    ];

    const data: Record<string, any> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        // JSON stringify array/object fields
        if (['enabledTools', 'disabledTools', 'suggestionCategories'].includes(field)) {
          data[field] = JSON.stringify(updates[field]);
        } else {
          data[field] = updates[field];
        }
      }
    }

    // Upsert the config
    const config = await db.aIAgentConfig.upsert({
      where: { restaurantId_agentType: { restaurantId, agentType } },
      update: data,
      create: {
        restaurantId,
        agentType,
        ...data,
      },
    });

    // Invalidate cache
    invalidateConfigCache(restaurantId);

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('AI Config PATCH Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/ai/config/reset — Reset agent config to defaults
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, agentType } = body;

    if (!restaurantId || !agentType) {
      return NextResponse.json({ error: 'restaurantId and agentType are required' }, { status: 400 });
    }

    // Delete the custom config, reverting to defaults
    await db.aIAgentConfig.deleteMany({
      where: { restaurantId, agentType },
    });

    invalidateConfigCache(restaurantId);

    return NextResponse.json({ success: true, message: 'Config reset to defaults' });
  } catch (error: any) {
    console.error('AI Config POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
