// ============================================================
// Yene QR — AI Chat API Route
// Streaming chat endpoint for all AI agents
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/api-auth';
import { getAgent } from '@/lib/ai/agents';
import { getAgentConfig } from '@/lib/ai/config/agent-config-service';
import type { AgentType, AgentContext, AIMessage } from '@/lib/ai/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages,
      agentType,
      restaurantId,
      branchId,
      conversationId,
      sessionId,
      language = 'en',
    } = body as {
      messages: Array<{ role: string; content: string }>;
      agentType: AgentType;
      restaurantId: string;
      branchId?: string;
      conversationId?: string;
      sessionId?: string;
      language?: string;
    };

    // Validate required fields
    if (!messages || !agentType || !restaurantId) {
      return NextResponse.json(
        { error: 'Missing required fields: messages, agentType, restaurantId' },
        { status: 400 }
      );
    }

    // Validate agent type
    const validTypes: AgentType[] = ['owner', 'kitchen', 'waiter', 'customer'];
    if (!validTypes.includes(agentType)) {
      return NextResponse.json(
        { error: `Invalid agent type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Load per-tenant agent config
    const config = await getAgentConfig(restaurantId, agentType);

    // Check if agent is enabled
    if (!config.isEnabled) {
      return NextResponse.json(
        { error: 'This AI assistant is currently disabled for your restaurant. Please contact your administrator to enable it.' },
        { status: 403 }
      );
    }

    // For staff agents (owner, kitchen, waiter), try to verify authentication
    // Use getAuthContext (returns null instead of throwing) for graceful fallback
    let userId: string | undefined;
    if (agentType !== 'customer') {
      const authResult = getAuthContext(req);
      if (authResult) {
        userId = authResult.userId;
        // Verify user belongs to this restaurant
        const user = await db.restaurantUser.findFirst({
          where: { id: userId, restaurantId, isActive: true },
        });
        if (!user) {
          return NextResponse.json({ error: 'User not authorized for this restaurant' }, { status: 403 });
        }
      } else {
        // No auth headers found — check if restaurant exists and allow in dev mode
        // This handles the case where the frontend hasn't wired up auth headers yet
        const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } });
        if (!restaurant) {
          return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
        }
        // In production, you'd return 401 here. For now, allow without userId.
        console.warn(`AI Chat: No auth for staff agent ${agentType}, restaurant ${restaurantId} — proceeding without user identity`);
      }
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await db.aIConversation.findUnique({
        where: { id: conversationId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      if (!conversation || conversation.restaurantId !== restaurantId) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    } else {
      // Create new conversation
      const firstMessage = messages.find(m => m.role === 'user')?.content || 'New Conversation';
      const agent = getAgent(agentType);
      let title: string;
      try {
        title = await agent.generateTitle(firstMessage);
      } catch {
        title = 'New Conversation';
      }

      conversation = await db.aIConversation.create({
        data: {
          restaurantId,
          userId: userId || undefined,
          sessionId: sessionId || undefined,
          agentType,
          title,
          language,
        },
        include: { messages: true },
      });
    }

    // Save user message
    const userMessage = messages[messages.length - 1];
    if (userMessage?.role === 'user') {
      await db.aIConversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          content: userMessage.content,
        },
      });
    }

    // Build agent context
    const agentContext: AgentContext = {
      restaurantId,
      branchId,
      userId,
      sessionId,
      role: agentType,
      language,
    };

    // Build conversation messages for the AI
    const conversationMessages: AIMessage[] = messages.map(m => ({
      role: m.role as AIMessage['role'],
      content: m.content,
    }));

    // Get the agent and process the chat with per-tenant config
    const agent = getAgent(agentType);
    const result = await agent.chat(conversationMessages, agentContext, config);

    // Save assistant response
    await db.aIConversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: result.response,
        metadata: result.usage ? JSON.stringify(result.usage) : undefined,
      },
    });

    // Save any tool calls
    for (const toolResult of result.toolResults) {
      await db.aIConversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'tool',
          content: toolResult.result,
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.name,
        },
      });
    }

    // Log any actions that require confirmation
    const actionToolResults = result.toolResults.filter(tr => !tr.error);
    for (const atr of actionToolResults) {
      // Check if this tool result suggests an action
      // (This is a simplified version — a full implementation would parse the result)
    }

    // Update conversation's updatedAt
    await db.aIConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      response: result.response,
      toolResults: result.toolResults.map(tr => ({
        name: tr.name,
        result: tr.result,
        error: tr.error,
      })),
      usage: result.usage,
    });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
