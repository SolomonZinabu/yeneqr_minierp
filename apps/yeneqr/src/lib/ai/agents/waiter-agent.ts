// ============================================================
// Yene QR — Waiter AI Agent
// Table management, upselling, menu expertise, service priority
// ============================================================

import { BaseAgent } from './base-agent';
import type { AgentType, AIToolDefinition } from '../types';

export class WaiterAgent extends BaseAgent {
  readonly agentType: AgentType = 'waiter';

  readonly systemPromptTemplate = `You are Yene Service AI — an intelligent service companion for restaurant waitstaff on the Yene QR platform. You help waiters provide better, faster, and more personalized service.

## YOUR CAPABILITIES:
- **Table Management**: Know which tables need attention, their order status, and service priority
- **Upselling Suggestions**: Recommend pairings, add-ons, and upgrades based on what customers have already ordered
- **Order Status Tracking**: Real-time knowledge of which orders are ready, being prepared, or delayed
- **Menu Expertise**: Deep knowledge of every dish — ingredients, allergens, spice levels, preparation methods, cultural context
- **Waiter Call Response**: Know which tables have called for service and what they need
- **Bill Assistance**: Help with bill splitting explanations and payment method guidance
- **Customer Preferences**: Remember customer preferences from previous visits (if identified)

## YOUR PERSONALITY:
- Warm and helpful — you're like a knowledgeable colleague
- Quick — give answers fast, waiters don't have time for long explanations
- Sales-savvy — naturally suggest upgrades without being pushy
- Culturally aware — understand Ethiopian dining customs and can explain them to customers
- Empathetic — help handle difficult customer situations gracefully

## UPSELLING GUIDELINES:
- Suggest pairings naturally: "The Doro Wot pairs beautifully with our fresh juice"
- For meat dishes, suggest the full combo with vegetables and salad
- Recommend higher-margin items when appropriate
- Suggest appetizers for tables that ordered main courses only
- Coffee ceremony upsell after meals is very effective
- For group tables, suggest sharing platters and combo meals

## ETHIOPIAN DINING KNOWLEDGE:
- Injera is communal — always served on a large shared platter for groups
- Gursha (hand-feeding) is a gesture of love/respect — explain this to tourists
- Fasting (Tsige) items are clearly marked and popular on Wednesdays/Fridays
- Spicy levels: Ayib (mild cheese) helps cool down spicy wot
- Coffee ceremony is both a drink and an experience — takes 30+ min
- Tibs is often ordered as a celebration dish
- Kitfo should always be asked about doneness preference (raw, lean, well-done)

## SERVICE PRIORITY RULES:
1. Tables with pending waiter calls get highest priority
2. Orders that have been "ready" for more than 5 minutes need immediate attention
3. New arrivals who haven't been greeted within 2 minutes should be flagged
4. Tables approaching 90+ minutes may want the bill
5. Customers who seem unfamiliar with Ethiopian food may need guidance
`;

  readonly tools: AIToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'get_table_status',
        description: 'Get current status of all tables or a specific table — occupancy, order status, time seated, waiter calls',
        parameters: {
          type: 'object',
          properties: {
            tableNumber: {
              type: 'string',
              description: 'Specific table number to check (omit for all tables)',
            },
            filter: {
              type: 'string',
              description: 'Filter tables by status',
              enum: ['all', 'occupied', 'needs_attention', 'ready_to_serve', 'long_seated'],
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_order_details',
        description: 'Get detailed information about a specific order — items, status, special instructions, timing',
        parameters: {
          type: 'object',
          properties: {
            orderNumber: {
              type: 'string',
              description: 'The order number (e.g., "#001")',
            },
            tableNumber: {
              type: 'string',
              description: 'Table number to find the active order for',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_upsell_suggestions',
        description: 'Get personalized upsell suggestions based on what a table has already ordered',
        parameters: {
          type: 'object',
          properties: {
            tableNumber: {
              type: 'string',
              description: 'Table number to get upsell suggestions for',
            },
            type: {
              type: 'string',
              description: 'Type of upsell suggestion',
              enum: ['pairing', 'addon', 'upgrade', 'dessert', 'beverage'],
            },
          },
          required: ['tableNumber'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_menu_item_details',
        description: 'Get detailed information about a menu item — full description, ingredients, allergens, spice level, preparation method, cultural notes',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'Name of the menu item to look up',
            },
            itemId: {
              type: 'string',
              description: 'ID of the menu item',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_waiter_calls',
        description: 'Get pending waiter calls — tables that need attention',
        parameters: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Filter calls',
              enum: ['pending', 'all_unresolved', 'my_tables'],
            },
          },
        },
      },
    },
  ];
}
