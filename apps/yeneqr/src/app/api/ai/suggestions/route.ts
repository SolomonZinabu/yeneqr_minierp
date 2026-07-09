// ============================================================
// Yene QR — AI Suggestions API Route
// Proactive AI suggestions for all user types
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/api-auth';
import { generateSuggestion } from '@/lib/ai/service';
import type { AgentType } from '@/lib/ai/types';

// GET — List suggestions for a restaurant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    const agentType = searchParams.get('agentType') as AgentType | null;
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
    }

    const where: any = {
      restaurantId,
      ...(agentType ? { agentType } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
    };

    const suggestions = await db.aISuggestion.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Suggestions GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create a new suggestion (from AI or manually)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantId,
      agentType,
      category,
      priority,
      title,
      description,
      data,
      actionType,
      actionParams,
      validUntil,
    } = body;

    if (!restaurantId || !agentType || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: restaurantId, agentType, title' },
        { status: 400 }
      );
    }

    const suggestion = await db.aISuggestion.create({
      data: {
        restaurantId,
        agentType,
        category: category || 'general',
        priority: priority || 'medium',
        title,
        description: description || '',
        data: data ? JSON.stringify(data) : undefined,
        actionType,
        actionParams: actionParams ? JSON.stringify(actionParams) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
      },
    });

    return NextResponse.json({ suggestion }, { status: 201 });
  } catch (error: any) {
    console.error('Suggestions POST Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — Accept, dismiss, or execute a suggestion
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { suggestionId, action, dismissedReason } = body;

    if (!suggestionId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: suggestionId, action' },
        { status: 400 }
      );
    }

    const authResult = getAuthContext(req);
    const userId = authResult?.userId;

    let data: any = {};
    switch (action) {
      case 'accept':
        data = { status: 'accepted', acceptedBy: userId, acceptedAt: new Date() };
        break;
      case 'dismiss':
        data = { status: 'dismissed', dismissedReason: dismissedReason || 'User dismissed' };
        break;
      case 'execute':
        data = { status: 'executed', acceptedBy: userId, acceptedAt: new Date() };
        break;
      default:
        return NextResponse.json({ error: 'Invalid action. Use: accept, dismiss, execute' }, { status: 400 });
    }

    const suggestion = await db.aISuggestion.update({
      where: { id: suggestionId },
      data,
    });

    return NextResponse.json({ suggestion });
  } catch (error: any) {
    console.error('Suggestions PATCH Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
