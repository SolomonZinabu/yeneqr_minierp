// ============================================================
// Yene QR — AI Conversations API Route
// CRUD for conversation history
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/api-auth';
import type { AgentType } from '@/lib/ai/types';

// GET — List conversations
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get('restaurantId');
    const agentType = searchParams.get('agentType') as AgentType | null;
    const sessionId = searchParams.get('sessionId');
    const status = searchParams.get('status') || 'active';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!restaurantId) {
      return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
    }

    // For staff agents, try to get auth (non-throwing)
    let userId: string | undefined;
    if (agentType !== 'customer') {
      const authResult = getAuthContext(req);
      userId = authResult?.userId;
    }

    const where: any = {
      restaurantId,
      status,
      ...(agentType ? { agentType } : {}),
      ...(userId ? { userId } : {}),
      ...(sessionId ? { sessionId } : {}),
    };

    const [conversations, total] = await Promise.all([
      db.aIConversation.findMany({
        where,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.aIConversation.count({ where }),
    ]);

    return NextResponse.json({
      conversations: conversations.map(c => ({
        id: c.id,
        title: c.title,
        agentType: c.agentType,
        status: c.status,
        language: c.language,
        messageCount: c._count.messages,
        lastMessage: c.messages[0]?.content?.slice(0, 100),
        lastMessageAt: c.updatedAt,
        createdAt: c.createdAt,
      })),
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('Conversations GET Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Archive a conversation
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    await db.aIConversation.update({
      where: { id: conversationId },
      data: { status: 'deleted' },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Conversations DELETE Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — Update conversation (archive, rename)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, title, status } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const data: any = {};
    if (title) data.title = title;
    if (status) data.status = status;

    const updated = await db.aIConversation.update({
      where: { id: conversationId },
      data,
    });

    return NextResponse.json({ success: true, conversation: updated });
  } catch (error: any) {
    console.error('Conversations PATCH Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
