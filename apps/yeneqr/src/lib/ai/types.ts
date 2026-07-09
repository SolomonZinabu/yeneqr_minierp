// ============================================================
// Yene QR — AI Agent Type Definitions
// ============================================================

export type AgentType = 'owner' | 'kitchen' | 'waiter' | 'customer';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}

export interface AIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required?: string[];
    };
  };
}

export interface AIToolResult {
  toolCallId: string;
  name: string;
  result: string;
  error?: string;
}

export interface AgentContext {
  restaurantId: string;
  branchId?: string;
  userId?: string;
  sessionId?: string;
  role: string;
  language: string;
  currentData?: Record<string, unknown>;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  agentType: string;
  status: string;
  lastMessageAt: Date;
  messageCount: number;
}

// Tool execution result
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  requiresConfirmation?: boolean;
  actionLogId?: string;
}

// Suggestion categories by agent type
export const SUGGESTION_CATEGORIES = {
  owner: [
    'menu_optimization',
    'demand_forecast',
    'pricing_strategy',
    'promotion_suggestion',
    'staff_insight',
    'financial_analysis',
    'customer_sentiment',
  ] as const,
  kitchen: [
    'prep_priority',
    'inventory_alert',
    'batch_suggestion',
    'allergen_warning',
    'substitution_suggestion',
  ] as const,
  waiter: [
    'upsell_opportunity',
    'table_attention',
    'order_status',
    'menu_knowledge',
  ] as const,
  customer: [
    'menu_recommendation',
    'dietary_assistance',
    'pairing_suggestion',
    'cuisine_education',
    'order_guidance',
  ] as const,
} as const;

// Agent display info
export const AGENT_INFO: Record<AgentType, {
  name: string;
  description: string;
  icon: string;
  color: string;
  greeting: string;
}> = {
  owner: {
    name: 'Yene Business AI',
    description: 'Your intelligent business partner — insights, analytics, and strategic recommendations',
    icon: '🧠',
    color: '#6366f1',
    greeting: 'Hello! I\'m your AI business assistant. I can help you analyze sales trends, optimize your menu, forecast demand, and make data-driven decisions. What would you like to explore today?',
  },
  kitchen: {
    name: 'Yene Kitchen AI',
    description: 'Your kitchen co-pilot — prep prioritization, inventory alerts, and cooking intelligence',
    icon: '👨‍🍳',
    color: '#f59e0b',
    greeting: 'Hey there! I\'m your kitchen AI assistant. I can help you prioritize orders, manage inventory, suggest batch cooking, and keep track of allergens. What do you need help with?',
  },
  waiter: {
    name: 'Yene Service AI',
    description: 'Your service companion — table management, upselling, and menu expertise',
    icon: '🍽️',
    color: '#10b981',
    greeting: 'Hi! I\'m your service AI assistant. I can help you manage tables, suggest upsells, check order statuses, and answer menu questions. How can I help you serve better?',
  },
  customer: {
    name: 'Yene Menu AI',
    description: 'Your personal dining guide — recommendations, dietary help, and cuisine discovery',
    icon: '✨',
    color: '#8b5cf6',
    greeting: 'Welcome! I\'m your AI dining assistant. I can help you find the perfect dish, check ingredients for allergens, suggest pairings, and explain any item on the menu. What sounds good to you?',
  },
};
