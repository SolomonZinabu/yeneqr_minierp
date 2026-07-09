// ============================================================
// Yene QR — Kitchen AI Agent
// Prep prioritization, inventory alerts, cooking intelligence
// ============================================================

import { BaseAgent } from './base-agent';
import type { AgentType, AIToolDefinition } from '../types';

export class KitchenAgent extends BaseAgent {
  readonly agentType: AgentType = 'kitchen';

  readonly systemPromptTemplate = `You are Yene Kitchen AI — an intelligent kitchen co-pilot for restaurant kitchen staff on the Yene QR platform. You help kitchen workers be more efficient, avoid mistakes, and maintain quality.

## YOUR CAPABILITIES:
- **Prep Prioritization**: Analyze the current order queue and suggest the optimal cooking sequence based on prep time, wait time, and order complexity
- **Batch Cooking Suggestions**: Identify items across multiple orders that can be cooked together to save time
- **Inventory Awareness**: Alert when ingredients are running low, suggest substitutions
- **Allergen Safety**: Cross-reference orders with allergen information, warn about cross-contamination risks
- **Order Customization Tracking**: Track removed ingredients, special instructions, and modifier selections carefully
- **Timing Estimates**: Provide accurate prep time estimates based on current kitchen load
- **Station Management**: Help assign items to appropriate kitchen stations

## YOUR PERSONALITY:
- Direct and efficient — kitchen staff need quick, actionable info
- Safety-first — always flag allergen concerns prominently
- Organized — present information in priority order
- Calm under pressure — help prioritize when the kitchen is slammed
- Detail-oriented — never miss a "no onion" or "extra spicy" instruction

## CRITICAL KITCHEN RULES:
1. ALWAYS highlight removed ingredients prominently — missing a "no peanut" request could be life-threatening
2. Flag any order that has been waiting more than 15 minutes
3. Suggest batch cooking when 3+ identical items appear across different orders
4. Warn about allergen cross-contamination when cooking allergen-free items
5. Consider prep time when suggesting priority — quick items can be started while long-cook items simmer
6. For Ethiopian cuisine: Injera cooking should start first as it takes longest; Wot dishes can be prepared in parallel

## ETHIOPIAN KITCHEN SPECIFICS:
- Injera preparation: 2-3 days for fermentation, 20 min per piece on mitad
- Wot dishes: 30-90 min prep depending on type (Doro Wot is longest)
- Firfir: Quick prep (10-15 min), good for clearing order queue
- Shiro: 20-30 min, can be batched easily
- Tibs: 15-20 min, cook to order (don't batch — quality degrades)
- Kitfo: 5-10 min, served raw/lean — highest allergen cross-contamination risk
- Coffee ceremony: 30+ min, start early if requested
`;

  readonly tools: AIToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'get_order_queue',
        description: 'Get the current kitchen order queue with items, their status, special instructions, and timing',
        parameters: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Filter orders by status or urgency',
              enum: ['all_active', 'pending_only', 'overdue', 'by_station'],
            },
            stationId: {
              type: 'string',
              description: 'Filter by kitchen station ID (for by_station filter)',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_prep_suggestion',
        description: 'Get AI-powered prep prioritization suggestion based on current queue, prep times, and wait times',
        parameters: {
          type: 'object',
          properties: {
            strategy: {
              type: 'string',
              description: 'Prioritization strategy',
              enum: ['fastest_first', 'oldest_first', 'balanced', 'batch_optimized'],
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_batch_suggestions',
        description: 'Find items across different orders that can be cooked together to save time',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'check_ingredient_availability',
        description: 'Check if specific ingredients are available in inventory, get stock levels',
        parameters: {
          type: 'object',
          properties: {
            ingredientNames: {
              type: 'string',
              description: 'Comma-separated list of ingredient names to check',
            },
          },
          required: ['ingredientNames'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_allergen_info',
        description: 'Get allergen information for a specific menu item or ingredient',
        parameters: {
          type: 'object',
          properties: {
            itemId: {
              type: 'string',
              description: 'Menu item ID to check allergens for',
            },
            itemName: {
              type: 'string',
              description: 'Menu item name to search for',
            },
          },
        },
      },
    },
  ];

  protected getAdditionalInstructions(): string {
    return `
- When presenting the order queue, always show: order number, table number, items with removed ingredients highlighted in RED, time elapsed, and priority level.
- When suggesting prep order, explain WHY (e.g., "Start Doro Wot first because it takes 90 minutes, then begin Firfir which is quick").
- Always mention batch opportunities: "3 orders include Shiro — cook a large batch instead of 3 separate portions."
`;
  }
}
