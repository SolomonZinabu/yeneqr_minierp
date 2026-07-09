import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/admin/ai — Platform-wide AI statistics
export async function GET() {
  try {
    // Get AI-related feature flags
    const aiFlags = await db.platformFeatureFlag.findMany({
      where: { key: { startsWith: 'ai_' } },
    });
    
    const flagMap: Record<string, { enabled: boolean; config: string | null }> = {};
    for (const f of aiFlags) {
      flagMap[f.key] = { enabled: f.enabled, config: f.config };
    }

    // Get conversation stats
    const [totalConversations, totalMessages, totalActionLogs, totalSuggestions] = await Promise.all([
      db.aIConversation.count(),
      db.aIConversationMessage.count(),
      db.aIActionLog.count(),
      db.aISuggestion.count(),
    ]);

    // Per agent type breakdown
    const agentTypes = ['owner', 'kitchen', 'waiter', 'customer'] as const;
    const agentStats = await Promise.all(
      agentTypes.map(async (agentType) => {
        const [conversations, messages, suggestions] = await Promise.all([
          db.aIConversation.count({ where: { agentType } }),
          db.aIConversationMessage.count({
            where: { conversation: { agentType } },
          }),
          db.aISuggestion.count({ where: { agentType } }),
        ]);
        return { agentType, conversations, messages, suggestions };
      })
    );

    // Restaurants with AI enabled (have at least one enabled AIAgentConfig)
    const restaurantsWithAI = await db.aIAgentConfig.groupBy({
      by: ['restaurantId'],
      where: { isEnabled: true },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 15,
    });

    // Get restaurant names for top users
    const topRestaurantIds = restaurantsWithAI.map(r => r.restaurantId);
    const topRestaurants = await db.restaurant.findMany({
      where: { id: { in: topRestaurantIds } },
      select: { id: true, name: true, slug: true },
    });

    const topRestaurantsWithUsage = restaurantsWithAI.map(r => {
      const restaurant = topRestaurants.find(rr => rr.id === r.restaurantId);
      return {
        restaurantId: r.restaurantId,
        name: restaurant?.name || 'Unknown',
        slug: restaurant?.slug || '',
        configCount: r._count.id,
      };
    });

    // Total restaurants
    const totalRestaurants = await db.restaurant.count({ where: { isSuspended: false, isActive: true } });

    // Recent action logs
    const recentActionLogs = await db.aIActionLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        entityType: true,
        status: true,
        requiresConfirmation: true,
        confirmedBy: true,
        createdAt: true,
        restaurant: { select: { name: true } },
      },
    });

    // Parse global defaults from flags
    const globalDefaults = flagMap['ai_global_defaults']?.config
      ? JSON.parse(flagMap['ai_global_defaults'].config)
      : { temperature: 0.6, maxTokens: 2048, maxToolIterations: 5, disabledTools: [] };

    return NextResponse.json({
      flags: flagMap,
      stats: {
        totalConversations,
        totalMessages,
        totalActionLogs,
        totalSuggestions,
        totalRestaurants,
        restaurantsUsingAI: restaurantsWithAI.length,
        agentStats,
        topRestaurants: topRestaurantsWithUsage,
      },
      recentActionLogs,
      globalDefaults,
    });
  } catch (error: any) {
    console.error('Admin AI GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/ai — Update platform-wide AI settings
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { flags, globalDefaults } = body;

    // Update feature flags
    if (flags && typeof flags === 'object') {
      for (const [key, enabled] of Object.entries(flags)) {
        if (typeof enabled === 'boolean' && key.startsWith('ai_')) {
          await db.platformFeatureFlag.upsert({
            where: { key },
            update: { enabled },
            create: {
              key,
              name: key.replace(/ai_/g, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              enabled,
            },
          });
        }
      }
    }

    // Update global defaults
    if (globalDefaults && typeof globalDefaults === 'object') {
      await db.platformFeatureFlag.upsert({
        where: { key: 'ai_global_defaults' },
        update: { config: JSON.stringify(globalDefaults) },
        create: {
          key: 'ai_global_defaults',
          name: 'AI Global Defaults',
          enabled: true,
          config: JSON.stringify(globalDefaults),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin AI PATCH Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
