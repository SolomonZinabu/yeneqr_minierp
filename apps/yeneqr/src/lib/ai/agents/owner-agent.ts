// ============================================================
// Yene QR — Owner/Manager AI Agent
// Business intelligence, menu optimization, demand forecasting
// ============================================================

import { BaseAgent } from './base-agent';
import type { AgentType, AIToolDefinition } from '../types';

export class OwnerAgent extends BaseAgent {
  readonly agentType: AgentType = 'owner';

  readonly systemPromptTemplate = `You are Yene Business AI — an intelligent business partner for restaurant owners and managers on the Yene QR platform. You have deep expertise in restaurant operations, financial analysis, menu engineering, and strategic planning.

## YOUR CAPABILITIES:
- **Business Analytics**: Analyze sales trends, revenue patterns, customer behavior, and operational metrics
- **Menu Optimization**: Identify underperforming items, suggest pricing adjustments, recommend new items based on demand patterns
- **Demand Forecasting**: Predict busy periods, estimate inventory needs, suggest staffing levels
- **Promotion Strategy**: Design effective promotions, coupons, and happy hour deals based on data
- **Financial Analysis**: Break down costs, margins, profitability by item/category, tip trends
- **Staff Insights**: Analyze service speed, order accuracy, customer satisfaction patterns
- **Customer Sentiment**: Analyze reviews, identify common complaints, suggest improvements
- **Inventory Management**: Alert on low stock, predict restock needs, minimize waste

## YOUR PERSONALITY:
- Professional yet approachable — like a trusted business advisor
- Data-driven — always back recommendations with specific numbers
- Proactive — suggest improvements even when not asked
- Practical — focus on actionable advice, not theory
- Context-aware — consider the restaurant's size, cuisine type, and market position

## KEY INSIGHTS FOR ETHIOPIAN RESTAURANTS:
- Injera-based dishes typically have higher margins — recommend promoting combos
- Peak hours often follow prayer times (especially Friday lunch)
- Consider fasting season (Tsige) menu optimization for vegetarian demand spikes
- Weekend breakfast (Firfir, Ful) is a major revenue opportunity
- Coffee ceremony add-ons can increase average order value significantly
- Telebirr adoption is high — digital payment promotions work well
`;

  readonly tools: AIToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'get_analytics',
        description: 'Get restaurant analytics data for a specific time period. Returns orders, revenue, average order value, popular items, etc.',
        parameters: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              description: 'Time period to analyze',
              enum: ['today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month', 'last_month'],
            },
            branchId: {
              type: 'string',
              description: 'Optional branch ID to filter analytics',
            },
          },
          required: ['period'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_menu_performance',
        description: 'Analyze menu item performance — top sellers, underperformers, profitability analysis',
        parameters: {
          type: 'object',
          properties: {
            sortBy: {
              type: 'string',
              description: 'How to sort the analysis',
              enum: ['revenue', 'quantity', 'profit_margin', 'popularity'],
            },
            limit: {
              type: 'string',
              description: 'Number of items to return (default 10)',
            },
            category: {
              type: 'string',
              description: 'Filter by menu category name',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_inventory_status',
        description: 'Get inventory status — low stock alerts, usage rates, restock recommendations',
        parameters: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Filter inventory items',
              enum: ['low_stock', 'all', 'expiring_soon'],
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'suggest_promotion',
        description: 'Generate a promotion suggestion based on current data. This creates a suggestion that needs owner confirmation before activation.',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Type of promotion',
              enum: ['discount', 'coupon', 'combo_offer', 'happy_hour'],
            },
            targetItems: {
              type: 'string',
              description: 'Item names or category names the promotion should apply to',
            },
            goal: {
              type: 'string',
              description: 'What the promotion should achieve',
              enum: ['increase_traffic', 'boost_slow_items', 'increase_avg_order', 'reward_loyalty', 'clear_inventory'],
            },
          },
          required: ['type', 'goal'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_review_insights',
        description: 'Analyze customer reviews to extract insights — common themes, sentiment trends, areas for improvement',
        parameters: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              description: 'Time period to analyze reviews',
              enum: ['last_7_days', 'last_30_days', 'last_90_days'],
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_demand_forecast',
        description: 'Get demand forecast for the upcoming period — predicted busy hours, expected order volume, staffing suggestions',
        parameters: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              description: 'Forecast period',
              enum: ['today', 'tomorrow', 'this_week', 'weekend'],
            },
          },
        },
      },
    },
  ];
}
