// ============================================================
// Yene QR — AI Context Builder
// Builds real-time restaurant context for AI agent prompts
// ============================================================

import { db } from '@/lib/db';
import type { AgentType, AgentContext } from '../types';

/**
 * Build comprehensive restaurant context for the AI agent's system prompt.
 * This is the "brain" that gives each agent real-time awareness of the restaurant state.
 */
export async function buildRestaurantContext(
  restaurantId: string,
  agentType: AgentType,
  context?: AgentContext
): Promise<string> {
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      branches: { where: { isActive: true }, take: 5 },
      menus: {
        where: { isActive: true },
        include: {
          categories: {
            where: { isActive: true },
            include: {
              items: {
                where: { isAvailable: true },
                include: {
                  modifierGroups: {
                    include: { options: { where: { isActive: true } } }
                  },
                  menuItemIngredients: {
                    include: { ingredient: true }
                  }
                },
                take: 50, // Limit to avoid context overflow
              }
            }
          }
        }
      }
    }
  });

  if (!restaurant) return 'Restaurant not found.';

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Get today's analytics
  const todayAnalytics = await db.analyticsDaily.findFirst({
    where: { restaurantId, date: { gte: new Date(todayStr) } },
  });

  // Get active orders count
  const activeOrders = await db.order.count({
    where: {
      restaurantId,
      status: { in: ['pending', 'accepted', 'preparing', 'ready'] },
    },
  });

  // Get recent reviews (last 7 days)
  const recentReviews = await db.review.findMany({
    where: {
      restaurantId,
      createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const avgRating = recentReviews.length > 0
    ? (recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length).toFixed(1)
    : 'N/A';

  // Build menu summary
  const menuItems: Array<{
    id: string;
    name: string;
    nameAm?: string | null;
    price: number;
    category: string;
    isPopular: boolean;
    isVegetarian: boolean;
    isSpicy: boolean;
    preparationTime: number;
    ingredients: string[];
    allergens: string[];
  }> = [];
  
  for (const menu of restaurant.menus) {
    for (const cat of menu.categories) {
      for (const item of cat.items) {
        const ingredientNames = item.menuItemIngredients.map(mi => mi.ingredient.name);
        const allergens = item.menuItemIngredients
          .flatMap(mi => mi.ingredient.allergens ? JSON.parse(mi.ingredient.allergens) as string[] : [])
          .filter((v, i, a) => a.indexOf(v) === i);
        
        menuItems.push({
          id: item.id,
          name: item.name,
          nameAm: item.nameAm,
          price: item.priceCents,
          category: cat.name,
          isPopular: item.isPopular,
          isVegetarian: item.isVegetarian,
          isSpicy: item.isSpicy,
          preparationTime: item.preparationTime,
          ingredients: ingredientNames,
          allergens,
        });
      }
    }
  }

  // Build context based on agent type
  const baseContext = `
## Restaurant: ${restaurant.name}
- Slug: ${restaurant.slug}
- Cuisine: ${restaurant.cuisineType || 'Ethiopian'}
- Currency: ${restaurant.currency}
- Tax Rate: ${(restaurant.taxRate * 100).toFixed(0)}%
- Language: ${restaurant.defaultLanguage}
- Address: ${restaurant.address || 'N/A'}
- Current Time: ${now.toISOString()}

## Branches (${restaurant.branches.length}):
${restaurant.branches.map(b => `- ${b.name} (${b.city || 'N/A'})`).join('\n')}

## Menu Overview:
- Total Items: ${menuItems.length}
- Categories: ${restaurant.menus.flatMap(m => m.categories).map(c => c.name).join(', ')}

## Today's Performance:
- Active Orders: ${activeOrders}
- Total Orders Today: ${todayAnalytics?.totalOrders || 0}
- Revenue Today: ${restaurant.currency} ${((todayAnalytics?.totalRevenueCents || 0) / 100).toFixed(2)}
- Avg Order Value: ${restaurant.currency} ${((todayAnalytics?.avgOrderValueCents || 0) / 100).toFixed(2)}
- Recent Rating (7d): ${avgRating}/5 (${recentReviews.length} reviews)

## Popular Items:
${menuItems.filter(i => i.isPopular).map(i => `- ${i.name} (${restaurant.currency} ${(i.price / 100).toFixed(2)})`).join('\n') || 'None marked as popular'}
`;

  // Add agent-specific context
  switch (agentType) {
    case 'owner':
      return baseContext + await buildOwnerContext(restaurantId, menuItems, todayAnalytics);
    case 'kitchen':
      return baseContext + await buildKitchenContext(restaurantId, context?.branchId);
    case 'waiter':
      return baseContext + await buildWaiterContext(restaurantId, context?.branchId);
    case 'customer':
      return baseContext + await buildCustomerContext(restaurantId, menuItems, context);
    default:
      return baseContext;
  }
}

async function buildOwnerContext(
  restaurantId: string,
  menuItems: Array<{ id: string; name: string; price: number; category: string; isPopular: boolean; ingredients: string[]; allergens: string[] }>,
  todayAnalytics: any
): Promise<string> {
  // Get 30-day analytics
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const monthlyAnalytics = await db.analyticsDaily.findMany({
    where: { restaurantId, date: { gte: thirtyDaysAgo } },
    orderBy: { date: 'desc' },
    take: 30,
  });

  const totalMonthlyRevenue = monthlyAnalytics.reduce((sum, a) => sum + a.totalRevenueCents, 0);
  const totalMonthlyOrders = monthlyAnalytics.reduce((sum, a) => sum + a.totalOrders, 0);
  const avgDailyRevenue = monthlyAnalytics.length > 0 ? totalMonthlyRevenue / monthlyAnalytics.length : 0;

  // Low stock inventory
  const lowStockItems = await db.inventoryItem.findMany({
    where: {
      restaurantId,
      isActive: true,
    },
    take: 50,
  });
  const actualLowStock = lowStockItems.filter(i => i.currentStock <= i.minimumStock);

  // Active promotions
  const activePromotions = await db.promotion.findMany({
    where: {
      restaurantId,
      isActive: true,
      validFrom: { lte: new Date() },
      validUntil: { gte: new Date() },
    },
  });

  // Customer stats
  const totalCustomers = await db.customer.count({
    where: {
      restaurantId
    }
  });

  return `
## Business Intelligence (Last 30 Days):
- Monthly Revenue: ETB ${(totalMonthlyRevenue / 100).toFixed(2)}
- Monthly Orders: ${totalMonthlyOrders}
- Average Daily Revenue: ETB ${(avgDailyRevenue / 100).toFixed(2)}
- Total Customers: ${totalCustomers}

## Menu Analysis:
${menuItems.slice(0, 30).map(i => `- ${i.name}: ETB ${(i.price / 100).toFixed(2)} | Cat: ${i.category} | Popular: ${i.isPopular ? 'Yes' : 'No'} | Allergens: ${i.allergens.length > 0 ? i.allergens.join(', ') : 'None'}`).join('\n')}

## Inventory Alerts (Low Stock):
${actualLowStock.length > 0 ? actualLowStock.map(i => `- ${i.name}: ${i.currentStock} ${i.unit} (min: ${i.minimumStock})`).join('\n') : 'No low stock alerts'}

## Active Promotions (${activePromotions.length}):
${activePromotions.map(p => `- ${p.name}: ${p.discountType === 'percentage' ? (p.discountValueCents / 100) + '%' : 'ETB ' + (p.discountValueCents / 100).toFixed(2)} off (${p.type})`).join('\n') || 'No active promotions'}
`;
}

async function buildKitchenContext(
  restaurantId: string,
  branchId?: string
): Promise<string> {
  // Get pending/preparing orders with items
  const activeOrders = await db.order.findMany({
    where: {
      restaurantId,
      ...(branchId ? { branchId } : {}),
      status: { in: ['pending', 'accepted', 'preparing'] },
    },
    include: {
      items: {
        include: {
          modifierSelections: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      table: { select: { number: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  // Get kitchen stations
  const stations = await db.kitchenStation.findMany({
    where: { branchId: restaurantId, isActive: true },
    take: 10,
  });

  // Low stock items
  const allInventory = await db.inventoryItem.findMany({
    where: {
      restaurantId,
      isActive: true,
    },
    take: 50,
  });
  const lowStockItems = allInventory.filter(i => i.currentStock <= i.minimumStock);

  const now = new Date();

  return `
## Kitchen Status:
- Active Orders: ${activeOrders.length}
- Kitchen Stations: ${stations.map(s => s.name).join(', ') || 'No stations configured'}

## Current Order Queue:
${activeOrders.map(o => {
  const elapsed = Math.round((now.getTime() - o.createdAt.getTime()) / 60000);
  const itemsByStatus = {
    pending: o.items.filter(i => i.kitchenStatus === 'pending').length,
    preparing: o.items.filter(i => i.kitchenStatus === 'preparing').length,
    ready: o.items.filter(i => i.kitchenStatus === 'ready').length,
  };
  return `Order #${o.orderNumber} (Table ${o.table.number}) | ${elapsed}m ago | Pending: ${itemsByStatus.pending} | Preparing: ${itemsByStatus.preparing} | Ready: ${itemsByStatus.ready}
${o.items.filter(i => i.kitchenStatus !== 'cancelled' && i.kitchenStatus !== 'ready').map(i => {
  const removed = i.removedIngredients ? JSON.parse(i.removedIngredients as string) : [];
  const mods = i.modifierSelections.map(m => m.name).join(', ');
  return `  - [${i.kitchenStatus.toUpperCase()}] ${i.name} x${i.quantity}${removed.length > 0 ? ' | NO: ' + removed.map((r: any) => r.name).join(', ') : ''}${mods ? ' | Mods: ' + mods : ''}${i.specialInstructions ? ' | NOTE: ' + i.specialInstructions : ''}`;
}).join('\n')}`;
}).join('\n\n') || 'No active orders right now.'}

## Inventory Alerts:
${lowStockItems.map(i => `- LOW: ${i.name} — ${i.currentStock} ${i.unit} remaining (min: ${i.minimumStock})`).join('\n') || 'All stock levels OK.'}
`;
}

async function buildWaiterContext(
  restaurantId: string,
  branchId?: string
): Promise<string> {
  // Active orders by table
  const activeOrders = await db.order.findMany({
    where: {
      restaurantId,
      ...(branchId ? { branchId } : {}),
      status: { in: ['pending', 'accepted', 'preparing', 'ready'] },
    },
    include: {
      items: { select: { name: true, kitchenStatus: true, quantity: true } },
      table: { select: { number: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Pending waiter calls
  const pendingCalls = await db.waiterCall.findMany({
    where: {
      restaurantId,
      ...(branchId ? { branchId } : {}),
      status: 'pending',
    },
    include: { table: { select: { number: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Table status
  const tables = await db.table.findMany({
    where: {
      branch: { restaurantId },
      isActive: true,
      ...(branchId ? { branchId } : {}),
    },
    select: { number: true, status: true, capacity: true },
    take: 30,
  });

  return `
## Service Status:
- Active Orders: ${activeOrders.length}
- Pending Waiter Calls: ${pendingCalls.length}

## Tables:
${tables.map(t => `- Table ${t.number}: ${t.status} (capacity: ${t.capacity})`).join('\n') || 'No tables configured'}

## Orders Needing Attention:
${activeOrders.filter(o => o.status === 'ready').map(o => `READY TO SERVE — Order #${o.orderNumber} (Table ${o.table.number})`).join('\n') || 'No orders ready for serving'}

## Pending Waiter Calls:
${pendingCalls.map(c => `- Table ${c.table.number}: ${c.requestType}${c.message ? ' — ' + c.message : ''}`).join('\n') || 'No pending calls'}

## Order Status Summary:
${activeOrders.map(o => `Order #${o.orderNumber} (Table ${o.table.number}) — ${o.status.toUpperCase()} — Items: ${o.items.map(i => `${i.name}(${i.kitchenStatus})`).join(', ')}`).join('\n') || 'No active orders'}
`;
}

async function buildCustomerContext(
  restaurantId: string,
  menuItems: Array<{ id: string; name: string; nameAm?: string | null; price: number; category: string; isPopular: boolean; isVegetarian: boolean; isSpicy: boolean; preparationTime: number; ingredients: string[]; allergens: string[] }>,
  context?: AgentContext
): Promise<string> {
  // Active promotions for customers
  const activePromotions = await db.promotion.findMany({
    where: {
      restaurantId,
      isActive: true,
      validFrom: { lte: new Date() },
      validUntil: { gte: new Date() },
    },
  });

  // Customer's previous orders if available
  let customerHistory = '';
  if (context?.sessionId) {
    const session = await db.customerSession.findUnique({
      where: { id: context.sessionId },
      include: {
        customer: {
          include: {
            orders: {
              where: { restaurantId },
              include: { items: { select: { name: true, quantity: true } } },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
            favorites: { include: { menuItem: { select: { name: true } } } },
          }
        }
      }
    });

    if (session?.customer) {
      customerHistory = `
## Customer Profile:
- Name: ${session.customer.name || 'Guest'}
- Loyalty Points: ${session.customer.loyaltyPoints}
- Previous Orders: ${session.customer.orders.length}
${session.customer.orders.map(o => `  - Order #${o.orderNumber}: ${o.items.map(i => `${i.name} x${i.quantity}`).join(', ')}`).join('\n')}
- Favorites: ${session.customer.favorites.map(f => f.menuItem.name).join(', ') || 'None'}
`;
    }
  }

  return `
## Full Menu:
${menuItems.map(i => {
  const tags = [
    i.isPopular ? 'Popular' : '',
    i.isVegetarian ? 'Vegetarian' : '',
    i.isSpicy ? 'Spicy' : '',
  ].filter(Boolean).join(', ');
  return `- ${i.name}${i.nameAm ? ` (${i.nameAm})` : ''}: ETB ${(i.price / 100).toFixed(2)} | ${i.category}${tags ? ' | ' + tags : ''} | Prep: ~${i.preparationTime}min | Ingredients: ${i.ingredients.join(', ')}${i.allergens.length > 0 ? ' | ALLERGENS: ' + i.allergens.join(', ') : ''}`;
}).join('\n')}

## Current Promotions:
${activePromotions.map(p => `- ${p.name}: ${p.discountType === 'percentage' ? (p.discountValueCents / 100) + '% off' : 'ETB ' + (p.discountValueCents / 100).toFixed(2) + ' off'}${p.code ? ' (Code: ' + p.code + ')' : ''}${p.minimumOrderCents > 0 ? ' | Min order: ETB ' + (p.minimumOrderCents / 100).toFixed(2) : ''}`).join('\n') || 'No current promotions'}

${customerHistory}
`;
}
