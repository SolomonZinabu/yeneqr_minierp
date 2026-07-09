// ============================================================
// Yene QR — Customer AI Agent
// Menu concierge, dietary assistance, pairing suggestions
// ============================================================

import { BaseAgent } from './base-agent';
import type { AgentType, AIToolDefinition } from '../types';

export class CustomerAgent extends BaseAgent {
  readonly agentType: AgentType = 'customer';

  readonly systemPromptTemplate = `You are Yene Menu AI — a personal dining guide for restaurant customers using the Yene QR platform. You help customers discover, customize, and enjoy their meal with confidence.

## YOUR CAPABILITIES:
- **Personalized Recommendations**: Suggest dishes based on the customer's preferences, dietary restrictions, spice tolerance, and past orders
- **Dietary Assistance**: Filter menu items by allergens, vegetarian/vegan options, fasting items, and specific dietary needs
- **Ingredient Transparency**: Explain every ingredient in any dish, flag allergens, and suggest safe alternatives
- **Pairing Suggestions**: Recommend drinks, sides, and desserts that complement their chosen dishes
- **Cuisine Education**: Explain Ethiopian dishes, traditions, and dining customs in an engaging way
- **Order Customization**: Help customers modify dishes — remove ingredients, adjust spice levels, understand modifier options
- **Promotion Awareness**: Inform customers about active promotions, loyalty points, and special deals
- **Allergen Safety**: CRITICAL — always take allergen concerns seriously and double-check ingredients

## YOUR PERSONALITY:
- Warm and welcoming — like a knowledgeable friend who loves food
- Patient — explain things as many times as needed
- Culturally enthusiastic — share the beauty of Ethiopian cuisine
- Safety-conscious — never guess about allergens; always verify
- Helpful but not pushy — suggest but never pressure

## ALLERGEN SAFETY PROTOCOL (HIGHEST PRIORITY):
1. When a customer mentions ANY dietary restriction or allergy, immediately flag it
2. Cross-reference EVERY ingredient in suggested dishes against their restrictions
3. If uncertain about an ingredient, say "Let me double-check that for you" and use tools
4. Common allergens in Ethiopian food: gluten (injera/teff flour — generally safe for most gluten-sensitive, but contains gluten), dairy (ayib, butter/niter kibbeh), nuts (rare but possible in some sauces), eggs (in some dishes)
5. For severe allergies, suggest the safest options and note potential cross-contamination risks
6. NEVER say something is safe if you're not 100% certain

## ETHIOPIAN CUISINE GUIDE:
- **Injera**: Spongy sour flatbread made from teff flour — gluten-free teff varieties exist but most contain gluten. It's both the plate and the utensil.
- **Wot**: Rich stews — Doro Wot (chicken/egg), Key Wot (beef, spicy), Shiro (chickpea, vegetarian)
- **Tibs**: Sautéed meat dishes — beef, lamb, or fish with onions and spices
- **Kitfo**: Raw minced beef — can be served lean (partially cooked) or well-done
- **Firfir**: Shredded injera with spices and meat — great for breakfast
- **Shiro**: Chickpea flour stew — the most popular vegetarian/fasting dish
- **Ayib**: Fresh cottage cheese — mild, cooling, pairs with spicy dishes
- **Fasting (Tsige) Items**: Vegetable and legume dishes prepared without animal products — very common on Wed/Fri
- **Coffee Ceremony**: Traditional Ethiopian coffee — roasted, ground, and brewed at the table
- **Tej**: Honey wine — traditional alcoholic beverage

## DINING CUSTOMS TO EXPLAIN:
- Eating with right hand only (tradition)
- Gursha: feeding another person from your hand — gesture of affection
- Communal dining: everyone eats from shared injera platter
- Coffee ceremony takes 30+ minutes — it's an experience, not just a drink
`;

  readonly tools: AIToolDefinition[] = [
    {
      type: 'function',
      function: {
        name: 'get_menu_items',
        description: 'Search or filter menu items — by name, category, dietary tags, allergens, spice level, etc.',
        parameters: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'Search term to find menu items by name or description',
            },
            filter: {
              type: 'string',
              description: 'Filter type',
              enum: ['vegetarian', 'vegan', 'non_spicy', 'mild', 'spicy', 'popular', 'fast_prep', 'gluten_free', 'dairy_free', 'nut_free'],
            },
            excludeAllergens: {
              type: 'string',
              description: 'Comma-separated allergens to exclude (e.g., "gluten,dairy,nuts")',
            },
            category: {
              type: 'string',
              description: 'Menu category name to filter by',
            },
            maxPrice: {
              type: 'string',
              description: 'Maximum price in ETB',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_item_details',
        description: 'Get complete details about a specific menu item — full ingredient list, allergens, modifiers, calories, prep time, cultural notes',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'Name of the menu item',
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
        name: 'get_pairing_suggestions',
        description: 'Get pairing suggestions for a specific dish — complementary drinks, sides, and desserts',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'Name of the dish to get pairings for',
            },
            type: {
              type: 'string',
              description: 'Type of pairing suggestion',
              enum: ['drink', 'side', 'dessert', 'complete_meal'],
            },
          },
          required: ['itemName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'check_allergen_safety',
        description: 'Check if a dish is safe for specific dietary restrictions or allergies. Returns detailed allergen analysis.',
        parameters: {
          type: 'object',
          properties: {
            itemName: {
              type: 'string',
              description: 'Name of the dish to check',
            },
            allergens: {
              type: 'string',
              description: 'Comma-separated list of allergens/dietary restrictions to check (e.g., "gluten,dairy,nuts,egg,shellfish,soy")',
            },
            dietaryRestriction: {
              type: 'string',
              description: 'Dietary restriction type',
              enum: ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nut_free', 'halal', 'fasting_tsige'],
            },
          },
          required: ['itemName'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_active_promotions',
        description: 'Get currently active promotions and deals that the customer can take advantage of',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_recommendation',
        description: 'Get personalized dish recommendation based on preferences, mood, or specific criteria',
        parameters: {
          type: 'object',
          properties: {
            mood: {
              type: 'string',
              description: 'Customer mood or craving type',
              enum: ['adventurous', 'comfort_food', 'light', 'hearty', 'spicy', 'sweet', 'healthy', 'traditional'],
            },
            preference: {
              type: 'string',
              description: 'Specific preference or dietary need',
            },
            budget: {
              type: 'string',
              description: 'Budget range in ETB (e.g., "100-200")',
            },
            partySize: {
              type: 'string',
              description: 'Number of people dining',
            },
          },
        },
      },
    },
  ];

  protected getAdditionalInstructions(): string {
    return `
- ALWAYS prioritize allergen safety over everything else. If in doubt, check.
- When recommending dishes, consider: the customer's language preference, spice tolerance, dietary restrictions, and budget.
- Explain Ethiopian dishes in a way that's accessible to newcomers while respecting the culture.
- If the customer seems to be a tourist, offer to explain the dining customs.
- When discussing prices, always include the currency (ETB).
- Suggest the coffee ceremony as a cultural experience, not just a beverage.
- For groups, recommend sharing platters and family-style eating.
`;
  }
}
