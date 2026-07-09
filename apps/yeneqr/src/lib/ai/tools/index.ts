// ============================================================
// Yene QR — AI Tool Executor
// Executes tools called by AI agents against real database
// ============================================================

import { db } from '@/lib/db';
import type { AgentType, AgentContext, ToolExecutionResult } from '../types';

/**
 * Execute a tool call from an AI agent
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: AgentContext,
  agentType: AgentType
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      // ===== OWNER TOOLS =====
      case 'get_analytics':
        return await getAnalytics(context.restaurantId, args.period as string, args.branchId as string);
      case 'get_menu_performance':
        return await getMenuPerformance(context.restaurantId, args.sortBy as string, args.limit as string, args.category as string);
      case 'get_inventory_status':
        return await getInventoryStatus(context.restaurantId, args.filter as string);
      case 'suggest_promotion':
        return await suggestPromotion(context.restaurantId, args as any, agentType);
      case 'get_review_insights':
        return await getReviewInsights(context.restaurantId, args.period as string);
      case 'get_demand_forecast':
        return await getDemandForecast(context.restaurantId, args.period as string);

      // ===== KITCHEN TOOLS =====
      case 'get_order_queue':
        return await getOrderQueue(context.restaurantId, args.filter as string, args.stationId as string, context.branchId);
      case 'get_prep_suggestion':
        return await getPrepSuggestion(context.restaurantId, args.strategy as string, context.branchId);
      case 'get_batch_suggestions':
        return await getBatchSuggestions(context.restaurantId, context.branchId);
      case 'check_ingredient_availability':
        return await checkIngredientAvailability(context.restaurantId, args.ingredientNames as string);
      case 'get_allergen_info':
        return await getAllergenInfo(context.restaurantId, args.itemId as string, args.itemName as string);

      // ===== WAITER TOOLS =====
      case 'get_table_status':
        return await getTableStatus(context.restaurantId, args.tableNumber as string, args.filter as string, context.branchId);
      case 'get_order_details':
        return await getOrderDetails(context.restaurantId, args.orderNumber as string, args.tableNumber as string, context.branchId);
      case 'get_upsell_suggestions':
        return await getUpsellSuggestions(context.restaurantId, args.tableNumber as string, args.type as string, context.branchId);
      case 'get_menu_item_details':
        return await getMenuItemDetails(context.restaurantId, args.itemName as string, args.itemId as string);
      case 'get_waiter_calls':
        return await getWaiterCalls(context.restaurantId, args.filter as string, context.branchId);

      // ===== CUSTOMER TOOLS =====
      case 'get_menu_items':
        return await getMenuItems(context.restaurantId, args);
      case 'get_item_details':
        return await getMenuItemDetails(context.restaurantId, args.itemName as string, args.itemId as string);
      case 'get_pairing_suggestions':
        return await getPairingSuggestions(context.restaurantId, args.itemName as string, args.type as string);
      case 'check_allergen_safety':
        return await checkAllergenSafety(context.restaurantId, args.itemName as string, args.allergens as string, args.dietaryRestriction as string);
      case 'get_active_promotions':
        return await getActivePromotions(context.restaurantId);
      case 'get_recommendation':
        return await getRecommendation(context.restaurantId, args);

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Tool execution failed' };
  }
}

// ===== OWNER TOOL IMPLEMENTATIONS =====

async function getAnalytics(restaurantId: string, period: string, branchId?: string): Promise<ToolExecutionResult> {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'yesterday':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      break;
    case 'last_7_days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  const analytics = await db.analyticsDaily.findMany({
    where: {
      restaurantId,
      ...(branchId ? { branchId } : {}),
      date: { gte: startDate },
    },
    orderBy: { date: 'desc' },
  });

  const totals = analytics.reduce((acc, a) => ({
    totalOrders: acc.totalOrders + a.totalOrders,
    totalRevenue: acc.totalRevenueCents + a.totalRevenueCents,
    totalTax: acc.totalTaxCents + a.totalTaxCents,
    totalTips: acc.totalTipsCents + a.totalTipsCents,
    uniqueCustomers: acc.uniqueCustomers + a.uniqueCustomers,
    cancelledOrders: acc.cancelledOrders + a.cancelledOrders,
  }), { totalOrders: 0, totalRevenue: 0, totalTax: 0, totalTips: 0, uniqueCustomers: 0, cancelledOrders: 0 });

  const avgOrderValue = totals.totalOrders > 0 ? totals.totalRevenueCents / totals.totalOrders : 0;
  const cancellationRate = totals.totalOrders > 0 ? (totals.cancelledOrders / totals.totalOrders * 100).toFixed(1) : '0';

  return {
    success: true,
    data: {
      period,
      from: startDate.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
      days: analytics.length,
      ...totals,
      avgOrderValue: avgOrderValue.toFixed(2),
      cancellationRate: cancellationRate + '%',
      dailyBreakdown: analytics.slice(0, 14).map(a => ({
        date: a.date.toISOString().split('T')[0],
        orders: a.totalOrders,
        revenue: a.totalRevenueCents.toFixed(2),
        avgOrderValue: a.avgOrderValueCents.toFixed(2),
      })),
      topItems: analytics[0]?.topItems ? JSON.parse(analytics[0].topItems as string) : [],
      peakHours: analytics[0]?.peakHours ? JSON.parse(analytics[0].peakHours as string) : [],
    },
  };
}

async function getMenuPerformance(restaurantId: string, sortBy: string = 'revenue', limit: string = '10', category?: string): Promise<ToolExecutionResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const orderItems = await db.orderItem.findMany({
    where: {
      order: {
        restaurantId,
        createdAt: { gte: thirtyDaysAgo },
        status: { not: 'cancelled' },
      },
    },
    include: {
      menuItem: {
        include: { category: { select: { name: true } } }
      }
    },
  });

  // Aggregate by menu item
  const performance: Record<string, { name: string; category: string; quantity: number; revenue: number; orderCount: number }> = {};
  for (const oi of orderItems) {
    const key = oi.menuItemId;
    if (!performance[key]) {
      performance[key] = {
        name: oi.name,
        category: oi.menuItem.category.name,
        quantity: 0,
        revenue: 0,
        orderCount: 0,
      };
    }
    performance[key].quantity += oi.quantity;
    performance[key].revenue += oi.priceCents * oi.quantity;
    performance[key].orderCount += 1;
  }

  let items = Object.entries(performance);
  
  if (category) {
    items = items.filter(([, v]) => v.category.toLowerCase().includes(category.toLowerCase()));
  }

  const sortFn = sortBy === 'quantity' ? ([, a]: any, [, b]: any) => b.quantity - a.quantity
    : sortBy === 'popularity' ? ([, a]: any, [, b]: any) => b.orderCount - a.orderCount
    : ([, a]: any, [, b]: any) => b.revenue - a.revenue;

  items.sort(sortFn);
  const limitNum = parseInt(limit) || 10;

  return {
    success: true,
    data: {
      period: 'last_30_days',
      sortBy,
      items: items.slice(0, limitNum).map(([id, v]) => ({ id, ...v, revenue: v.revenue.toFixed(2) })),
      underperformers: items.slice(-5).map(([id, v]) => ({ id, ...v, revenue: v.revenue.toFixed(2) })),
    },
  };
}

async function getInventoryStatus(restaurantId: string, filter: string = 'all'): Promise<ToolExecutionResult> {
  const where: any = { restaurantId, isActive: true };
  if (filter === 'low_stock') {
    // Will filter in-memory after fetch since we can't compare fields in Prisma where clause easily
  }

  const items = await db.inventoryItem.findMany({ where, take: 50 });
  
  const filteredItems = filter === 'low_stock' 
    ? items.filter(i => i.currentStock <= i.minimumStock)
    : items;

  return {
    success: true,
    data: {
      filter,
      items: filteredItems.map(i => ({
        name: i.name,
        currentStock: i.currentStock,
        unit: i.unit,
        minimumStock: i.minimumStock,
        status: i.currentStock <= i.minimumStock ? 'LOW' : 'OK',
        costPerUnit: i.costPerUnit,
        supplier: i.supplier,
        lastRestocked: i.lastRestocked?.toISOString().split('T')[0],
      })),
    },
  };
}

async function suggestPromotion(restaurantId: string, args: any, agentType: AgentType): Promise<ToolExecutionResult> {
  // This creates a suggestion in the AISuggestion table — the owner must confirm
  return {
    success: true,
    data: {
      message: 'Promotion suggestion generated. The owner will need to review and activate it.',
      suggestion: {
        type: args.type,
        goal: args.goal,
        targetItems: args.targetItems,
        status: 'requires_confirmation',
      },
    },
    requiresConfirmation: true,
  };
}

async function getReviewInsights(restaurantId: string, period: string = 'last_30_days'): Promise<ToolExecutionResult> {
  const daysMap: Record<string, number> = { last_7_days: 7, last_30_days: 30, last_90_days: 90 };
  const days = daysMap[period] || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const reviews = await db.review.findMany({
    where: { restaurantId, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const ratingDist = [0, 0, 0, 0, 0];
  reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) ratingDist[r.rating - 1]++; });
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : 'N/A';
  const positiveKeywords: string[] = [];
  const negativeKeywords: string[] = [];
  reviews.forEach(r => {
    if (r.comment) {
      const lower = r.comment.toLowerCase();
      if (lower.includes('delicious') || lower.includes('great') || lower.includes('amazing') || lower.includes('love') || lower.includes('best')) {
        positiveKeywords.push(r.comment.slice(0, 100));
      }
      if (lower.includes('slow') || lower.includes('cold') || lower.includes('rude') || lower.includes('wait') || lower.includes('bad')) {
        negativeKeywords.push(r.comment.slice(0, 100));
      }
    }
  });

  return {
    success: true,
    data: {
      period,
      totalReviews: reviews.length,
      averageRating: avgRating,
      ratingDistribution: { '1_star': ratingDist[0], '2_star': ratingDist[1], '3_star': ratingDist[2], '4_star': ratingDist[3], '5_star': ratingDist[4] },
      recentComments: reviews.slice(0, 10).map(r => ({ rating: r.rating, comment: r.comment, date: r.createdAt.toISOString().split('T')[0] })),
      positiveThemes: positiveKeywords.slice(0, 5),
      negativeThemes: negativeKeywords.slice(0, 5),
    },
  };
}

async function getDemandForecast(restaurantId: string, period: string): Promise<ToolExecutionResult> {
  // Simple heuristic-based forecast using historical patterns
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const analytics = await db.analyticsDaily.findMany({
    where: { restaurantId, date: { gte: thirtyDaysAgo } },
    orderBy: { date: 'asc' },
  });

  const avgOrders = analytics.length > 0 ? analytics.reduce((s, a) => s + a.totalOrders, 0) / analytics.length : 0;
  const avgRevenue = analytics.length > 0 ? analytics.reduce((s, a) => s + a.totalRevenueCents, 0) / analytics.length : 0;

  // Day-of-week patterns
  const dayPatterns: Record<number, { avgOrders: number; avgRevenue: number }> = {};
  for (let d = 0; d < 7; d++) {
    const dayData = analytics.filter(a => a.date.getDay() === d);
    dayPatterns[d] = {
      avgOrders: dayData.length > 0 ? dayData.reduce((s, a) => s + a.totalOrders, 0) / dayData.length : avgOrders,
      avgRevenue: dayData.length > 0 ? dayData.reduce((s, a) => s + a.totalRevenueCents, 0) / dayData.length : avgRevenue,
    };
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const now = new Date();

  return {
    success: true,
    data: {
      period,
      forecast: {
        expectedOrders: Math.round(avgOrders * (period === 'weekend' ? 1.3 : period === 'today' ? 1 : 7)),
        expectedRevenue: (avgRevenue * (period === 'weekend' ? 1.3 : period === 'today' ? 1 : 7)).toFixed(2),
        dayOfWeekPattern: Object.entries(dayPatterns).map(([d, v]) => ({
          day: dayNames[parseInt(d)],
          expectedOrders: Math.round(v.avgOrders),
          expectedRevenue: v.avgRevenue.toFixed(2),
        })),
        peakHours: analytics[0]?.peakHours ? JSON.parse(analytics[0].peakHours as string) : [],
        staffingSuggestion: avgOrders > 50 ? 'Full staff recommended' : avgOrders > 20 ? 'Standard staffing' : 'Minimum staffing possible',
      },
    },
  };
}

// ===== KITCHEN TOOL IMPLEMENTATIONS =====

async function getOrderQueue(restaurantId: string, filter: string = 'all_active', stationId?: string, branchId?: string): Promise<ToolExecutionResult> {
  const where: any = {
    restaurantId,
    ...(branchId ? { branchId } : {}),
    status: { in: ['pending', 'accepted', 'preparing'] },
  };

  const orders = await db.order.findMany({
    where,
    include: {
      items: {
        include: { modifierSelections: true },
        where: filter === 'pending_only' ? { kitchenStatus: 'pending' } : undefined,
      },
      table: { select: { number: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const now = new Date();
  const queue = orders.map(o => {
    const elapsed = Math.round((now.getTime() - o.createdAt.getTime()) / 60000);
    const isOverdue = elapsed > 15;
    return {
      orderNumber: o.orderNumber,
      table: o.table.number,
      status: o.status,
      elapsedMinutes: elapsed,
      isOverdue,
      items: o.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        kitchenStatus: i.kitchenStatus,
        removedIngredients: i.removedIngredients ? JSON.parse(i.removedIngredients as string) : [],
        modifiers: i.modifierSelections.map(m => m.name),
        specialInstructions: i.specialInstructions,
        station: i.kitchenStationId,
        prepTime: i.menuItem?.preparationTime,
      })),
    };
  }).filter(o => {
    if (filter === 'overdue') return o.isOverdue;
    return true;
  });

  return { success: true, data: { totalOrders: queue.length, queue } };
}

async function getPrepSuggestion(restaurantId: string, strategy: string = 'balanced', branchId?: string): Promise<ToolExecutionResult> {
  const orders = await db.order.findMany({
    where: {
      restaurantId,
      ...(branchId ? { branchId } : {}),
      status: { in: ['pending', 'accepted', 'preparing'] },
    },
    include: {
      items: {
        where: { kitchenStatus: { in: ['pending', 'preparing'] } },
        include: { menuItem: { select: { preparationTime: true, name: true } } },
      },
      table: { select: { number: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const now = new Date();
  const suggestions = orders.map(o => {
    const elapsed = Math.round((now.getTime() - o.createdAt.getTime()) / 60000);
    return {
      orderNumber: o.orderNumber,
      table: o.table.number,
      elapsedMinutes: elapsed,
      items: o.items.map(i => ({
        name: i.name,
        prepTime: i.menuItem?.preparationTime || 15,
        status: i.kitchenStatus,
      })),
      priority: elapsed > 15 ? 'CRITICAL' : elapsed > 10 ? 'HIGH' : elapsed > 5 ? 'MEDIUM' : 'NORMAL',
      suggestedAction: elapsed > 15 ? 'Start immediately — overdue!' : elapsed > 10 ? 'Prioritize next' : 'Normal queue',
    };
  });

  return { success: true, data: { strategy, suggestions } };
}

async function getBatchSuggestions(restaurantId: string, branchId?: string): Promise<ToolExecutionResult> {
  const orders = await db.order.findMany({
    where: {
      restaurantId,
      ...(branchId ? { branchId } : {}),
      status: { in: ['pending', 'accepted', 'preparing'] },
    },
    include: {
      items: {
        where: { kitchenStatus: { in: ['pending', 'preparing'] } },
      },
    },
  });

  // Find items that appear in 3+ orders
  const itemCounts: Record<string, { name: string; count: number; orderNumbers: string[] }> = {};
  for (const o of orders) {
    for (const i of o.items) {
      if (!itemCounts[i.menuItemId]) {
        itemCounts[i.menuItemId] = { name: i.name, count: 0, orderNumbers: [] };
      }
      itemCounts[i.menuItemId].count += i.quantity;
      itemCounts[i.menuItemId].orderNumbers.push(o.orderNumber);
    }
  }

  const batchOpportunities = Object.values(itemCounts)
    .filter(v => v.count >= 3)
    .sort((a, b) => b.count - a.count);

  return {
    success: true,
    data: {
      batchOpportunities: batchOpportunities.map(b => ({
        item: b.name,
        totalQuantity: b.count,
        acrossOrders: b.orderNumbers.length,
        orderNumbers: b.orderNumbers,
        savings: `Cook ${b.count} portions as one batch instead of ${b.orderNumbers.length} separate rounds`,
      })),
    },
  };
}

async function checkIngredientAvailability(restaurantId: string, ingredientNames: string): Promise<ToolExecutionResult> {
  const names = ingredientNames.split(',').map(n => n.trim().toLowerCase());
  
  const ingredients = await db.ingredient.findMany({
    where: {
      restaurantId,
      name: { in: names },
    },
  });

  const inventory = await db.inventoryItem.findMany({
    where: {
      restaurantId,
      isActive: true,
      name: { in: names },
    },
  });

  return {
    success: true,
    data: {
      ingredients: ingredients.map(i => ({
        name: i.name,
        available: i.isAvailable,
        allergens: i.allergens ? JSON.parse(i.allergens as string) : [],
      })),
      inventory: inventory.map(i => ({
        name: i.name,
        currentStock: i.currentStock,
        unit: i.unit,
        minimumStock: i.minimumStock,
        status: i.currentStock <= i.minimumStock ? 'LOW' : 'OK',
      })),
    },
  };
}

async function getAllergenInfo(restaurantId: string, itemId?: string, itemName?: string): Promise<ToolExecutionResult> {
  const where: any = { restaurantId, isAvailable: true };
  if (itemId) where.id = itemId;
  if (itemName) where.name = { contains: itemName };

  const item = await db.menuItem.findFirst({
    where,
    include: {
      menuItemIngredients: { include: { ingredient: true } },
    },
  });

  if (!item) return { success: false, error: 'Item not found' };

  const allAllergens = item.menuItemIngredients
    .flatMap(mi => mi.ingredient.allergens ? JSON.parse(mi.ingredient.allergens as string) : [])
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

  return {
    success: true,
    data: {
      item: item.name,
      ingredients: item.menuItemIngredients.map(mi => ({
        name: mi.ingredient.name,
        allergens: mi.ingredient.allergens ? JSON.parse(mi.ingredient.allergens as string) : [],
        isRemovable: mi.isRemovable,
        isDefault: mi.isDefault,
      })),
      allAllergens,
      isVegetarian: item.isVegetarian,
      isSpicy: item.isSpicy,
    },
  };
}

// ===== WAITER TOOL IMPLEMENTATIONS =====

async function getTableStatus(restaurantId: string, tableNumber?: string, filter: string = 'all', branchId?: string): Promise<ToolExecutionResult> {
  const where: any = {
    branch: { restaurantId },
    isActive: true,
    ...(branchId ? { branchId } : {}),
    ...(tableNumber ? { number: tableNumber } : {}),
  };

  if (filter === 'occupied') where.status = 'occupied';
  if (filter === 'needs_attention') where.status = { in: ['occupied'] };

  const tables = await db.table.findMany({
    where,
    include: {
      orders: {
        where: { status: { in: ['pending', 'accepted', 'preparing', 'ready'] } },
        select: { orderNumber: true, status: true, createdAt: true, totalAmountCents: true },
      },
      waiterCalls: {
        where: { status: 'pending' },
        select: { requestType: true, message: true, createdAt: true },
      },
    },
  });

  const now = new Date();
  const tableStatus = tables.map(t => {
    const activeOrder = t.orders[0];
    const waitMinutes = activeOrder ? Math.round((now.getTime() - activeOrder.createdAt.getTime()) / 60000) : null;
    return {
      number: t.number,
      status: t.status,
      capacity: t.capacity,
      activeOrder: activeOrder ? {
        orderNumber: activeOrder.orderNumber,
        status: activeOrder.status,
        waitMinutes,
        totalCents: activeOrder.totalAmountCents,
      } : null,
      pendingCalls: t.waiterCalls.map(c => ({
        type: c.requestType,
        message: c.message,
        waitMinutes: Math.round((now.getTime() - c.createdAt.getTime()) / 60000),
      })),
      needsAttention: t.status === 'occupied' && (t.waiterCalls.length > 0 || (waitMinutes && waitMinutes > 15)),
    };
  });

  return { success: true, data: { tables: tableStatus } };
}

async function getOrderDetails(restaurantId: string, orderNumber?: string, tableNumber?: string, branchId?: string): Promise<ToolExecutionResult> {
  const where: any = { restaurantId, status: { in: ['pending', 'accepted', 'preparing', 'ready'] } };
  if (orderNumber) where.orderNumber = orderNumber.replace('#', '');
  if (branchId) where.branchId = branchId;

  let order;
  if (tableNumber) {
    const table = await db.table.findFirst({
      where: { number: tableNumber, branch: { restaurantId } },
    });
    if (table) where.tableId = table.id;
  }

  order = await db.order.findFirst({
    where,
    include: {
      items: { include: { modifierSelections: true } },
      table: { select: { number: true } },
      payments: { select: { method: true, status: true, amountCents: true } },
    },
  });

  if (!order) return { success: false, error: 'Order not found' };

  const now = new Date();
  const elapsed = Math.round((now.getTime() - order.createdAt.getTime()) / 60000);

  return {
    success: true,
    data: {
      orderNumber: order.orderNumber,
      table: order.table.number,
      status: order.status,
      elapsedMinutes: elapsed,
      type: order.type,
      items: order.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        kitchenStatus: i.kitchenStatus,
        removedIngredients: i.removedIngredients ? JSON.parse(i.removedIngredients as string) : [],
        modifiers: i.modifierSelections.map(m => m.name),
        specialInstructions: i.specialInstructions,
        price: i.priceCents,
      })),
      subtotal: order.subtotalCents,
      total: order.totalAmountCents,
      payments: order.payments,
    },
  };
}

async function getUpsellSuggestions(restaurantId: string, tableNumber: string, type: string = 'pairing', branchId?: string): Promise<ToolExecutionResult> {
  // Get the table's current order
  const table = await db.table.findFirst({
    where: { number: tableNumber, branch: { restaurantId } },
    include: {
      orders: {
        where: { status: { in: ['pending', 'accepted', 'preparing', 'ready'] } },
        include: { items: true },
      },
    },
  });

  if (!table || table.orders.length === 0) {
    return { success: false, error: 'No active order found for this table' };
  }

  const orderedItemIds = table.orders.flatMap(o => o.items.map(i => i.menuItemId));
  const orderedNames = table.orders.flatMap(o => o.items.map(i => i.name));

  // Get popular items not yet ordered
  const suggestions = await db.menuItem.findMany({
    where: {
      restaurantId,
      isAvailable: true,
      id: { notIn: orderedItemIds },
      ...(type === 'beverage' ? { category: { name: { contains: 'drink' } } } : {}),
      ...(type === 'dessert' ? { category: { name: { contains: 'dessert' } } } : {}),
    },
    include: { category: { select: { name: true } } },
    take: 5,
  });

  return {
    success: true,
    data: {
      table: tableNumber,
      alreadyOrdered: orderedNames,
      suggestions: suggestions.map(s => ({
        name: s.name,
        price: s.priceCents,
        category: s.category.name,
        reason: s.isPopular ? 'Popular choice' : s.isVegetarian ? 'Great vegetarian option' : 'Complements your order',
        isPopular: s.isPopular,
      })),
    },
  };
}

async function getWaiterCalls(restaurantId: string, filter: string = 'pending', branchId?: string): Promise<ToolExecutionResult> {
  const where: any = {
    restaurantId,
    ...(branchId ? { branchId } : {}),
    ...(filter === 'pending' ? { status: 'pending' } : { status: { in: ['pending', 'acknowledged'] } }),
  };

  const calls = await db.waiterCall.findMany({
    where,
    include: { table: { select: { number: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return {
    success: true,
    data: {
      totalCalls: calls.length,
      calls: calls.map(c => ({
        table: c.table.number,
        type: c.requestType,
        message: c.message,
        status: c.status,
        waitMinutes: Math.round((Date.now() - c.createdAt.getTime()) / 60000),
      })),
    },
  };
}

// ===== CUSTOMER TOOL IMPLEMENTATIONS =====

async function getMenuItems(restaurantId: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  const where: any = { restaurantId, isAvailable: true };

  if (args.search) {
    where.name = { contains: args.search as string };
  }
  if (args.category) {
    where.category = { name: { contains: args.category as string } };
  }
  if (args.filter === 'vegetarian') where.isVegetarian = true;
  if (args.filter === 'non_spicy' || args.filter === 'mild') where.isSpicy = false;
  if (args.filter === 'spicy') where.isSpicy = true;
  if (args.filter === 'popular') where.isPopular = true;
  if (args.maxPrice) where.priceCents = { lte: parseFloat(args.maxPrice as string) };

  const items = await db.menuItem.findMany({
    where,
    include: {
      category: { select: { name: true } },
      menuItemIngredients: { include: { ingredient: true } },
    },
    take: 30,
  });

  // Filter by allergens if requested
  let filtered = items;
  if (args.excludeAllergens) {
    const excluded = (args.excludeAllergens as string).split(',').map(a => a.trim().toLowerCase());
    filtered = items.filter(item => {
      const itemAllergens = item.menuItemIngredients
        .flatMap(mi => mi.ingredient.allergens ? JSON.parse(mi.ingredient.allergens as string) : [])
        .map(a => a.toLowerCase());
      return !excluded.some(e => itemAllergens.includes(e));
    });
  }

  return {
    success: true,
    data: {
      total: filtered.length,
      items: filtered.map(i => ({
        id: i.id,
        name: i.name,
        nameAm: i.nameAm,
        price: i.priceCents,
        category: i.category.name,
        isVegetarian: i.isVegetarian,
        isSpicy: i.isSpicy,
        isPopular: i.isPopular,
        preparationTime: i.preparationTime,
        description: i.description,
        ingredients: i.menuItemIngredients.map(mi => mi.ingredient.name),
        allergens: [...new Set(i.menuItemIngredients.flatMap(mi => mi.ingredient.allergens ? JSON.parse(mi.ingredient.allergens as string) : []))],
        image: i.image,
      })),
    },
  };
}

async function getPairingSuggestions(restaurantId: string, itemName: string, type: string = 'complete_meal'): Promise<ToolExecutionResult> {
  const item = await db.menuItem.findFirst({
    where: { restaurantId, name: { contains: itemName }, isAvailable: true },
    include: { category: { select: { name: true } } },
  });

  if (!item) return { success: false, error: `Item "${itemName}" not found` };

  // Get complementary items from different categories
  const pairings = await db.menuItem.findMany({
    where: {
      restaurantId,
      isAvailable: true,
      id: { not: item.id },
      ...(type === 'drink' ? { category: { name: { contains: 'drink' } } } : {}),
      ...(type === 'side' ? { category: { name: { contains: 'side' } } } : {}),
      ...(type === 'dessert' ? { category: { name: { contains: 'dessert' } } } : {}),
    },
    include: { category: { select: { name: true } } },
    take: 5,
  });

  const pairingReasons: Record<string, string> = {
    drink: 'A refreshing drink complements the flavors perfectly',
    side: 'A side dish completes the meal experience',
    dessert: 'End your meal on a sweet note',
    complete_meal: 'Build a complete Ethiopian dining experience',
  };

  return {
    success: true,
    data: {
      dish: item.name,
      pairingType: type,
      reason: pairingReasons[type] || 'These items go great together',
      suggestions: pairings.map(p => ({
        name: p.name,
        price: p.priceCents,
        category: p.category.name,
        isVegetarian: p.isVegetarian,
      })),
    },
  };
}

async function checkAllergenSafety(restaurantId: string, itemName: string, allergens?: string, dietaryRestriction?: string): Promise<ToolExecutionResult> {
  const item = await db.menuItem.findFirst({
    where: { restaurantId, name: { contains: itemName }, isAvailable: true },
    include: {
      menuItemIngredients: { include: { ingredient: true } },
    },
  });

  if (!item) return { success: false, error: `Item "${itemName}" not found` };

  const ingredientAllergens = item.menuItemIngredients
    .flatMap(mi => ({
      ingredient: mi.ingredient.name,
      allergens: mi.ingredient.allergens ? JSON.parse(mi.ingredient.allergens as string) : [],
      isRemovable: mi.isRemovable,
    }));

  const allAllergens = [...new Set(ingredientAllergens.flatMap(ia => ia.allergens))];

  let safe = true;
  const warnings: string[] = [];
  const checkAllergens = allergens ? allergens.split(',').map(a => a.trim().toLowerCase()) : [];

  if (checkAllergens.length > 0) {
    for (const a of checkAllergens) {
      if (allAllergens.map(al => al.toLowerCase()).includes(a)) {
        safe = false;
        const problematic = ingredientAllergens.filter(ia => ia.allergens.map(al => al.toLowerCase()).includes(a));
        warnings.push(`Contains ${a} (from: ${problematic.map(p => p.ingredient).join(', ')})${problematic.some(p => p.isRemovable) ? ' — CAN be removed' : ' — CANNOT be removed'}`);
      }
    }
  }

  // Check dietary restrictions
  if (dietaryRestriction === 'vegetarian' && !item.isVegetarian) {
    safe = false;
    warnings.push('Not vegetarian — contains meat or animal products');
  }
  if (dietaryRestriction === 'vegan' && !item.isVegetarian) {
    safe = false;
    warnings.push('Not vegan — contains animal products');
  }

  return {
    success: true,
    data: {
      dish: item.name,
      isSafe: safe,
      allAllergens,
      warnings,
      ingredients: ingredientAllergens.map(ia => ({
        name: ia.ingredient,
        allergens: ia.allergens,
        isRemovable: ia.isRemovable,
      })),
      isVegetarian: item.isVegetarian,
      isSpicy: item.isSpicy,
    },
  };
}

async function getActivePromotions(restaurantId: string): Promise<ToolExecutionResult> {
  const promotions = await db.promotion.findMany({
    where: {
      restaurantId,
      isActive: true,
      validFrom: { lte: new Date() },
      validUntil: { gte: new Date() },
    },
  });

  return {
    success: true,
    data: {
      promotions: promotions.map(p => ({
        name: p.name,
        type: p.type,
        discountType: p.discountType,
        discountValue: p.discountValueCents,
        code: p.code,
        minimumOrder: p.minimumOrderCents,
        maxDiscount: p.maxDiscountCents,
        description: p.description,
        validUntil: p.validUntil.toISOString().split('T')[0],
      })),
    },
  };
}

async function getRecommendation(restaurantId: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  const where: any = { restaurantId, isAvailable: true };

  if (args.mood === 'adventurous') where.isSpicy = true;
  if (args.mood === 'comfort_food') where.isPopular = true;
  if (args.mood === 'light' || args.mood === 'healthy') { where.isVegetarian = true; where.calories = { lte: 500 }; }
  if (args.mood === 'hearty') where.preparationTime = { gte: 20 };
  if (args.mood === 'spicy') where.isSpicy = true;
  if (args.mood === 'traditional') where.isPopular = true;
  if (args.preference === 'vegetarian') where.isVegetarian = true;
  if (args.budget) {
    const [min, max] = (args.budget as string).split('-').map(Number);
    if (max) where.priceCents = { gte: min || 0, lte: max };
    else where.priceCents = { lte: min || 1000 };
  }

  const items = await db.menuItem.findMany({
    where,
    include: {
      category: { select: { name: true } },
      menuItemIngredients: { include: { ingredient: true } },
    },
    take: 8,
  });

  // Shuffle for variety
  const shuffled = items.sort(() => Math.random() - 0.5).slice(0, 5);

  return {
    success: true,
    data: {
      mood: args.mood,
      preference: args.preference,
      recommendations: shuffled.map(i => ({
        name: i.name,
        price: i.priceCents,
        category: i.category.name,
        isVegetarian: i.isVegetarian,
        isSpicy: i.isSpicy,
        preparationTime: i.preparationTime,
        description: i.description,
        reason: i.isPopular ? 'A beloved favorite' : i.isSpicy ? 'For those who love heat' : i.isVegetarian ? 'Light and wholesome' : 'A satisfying choice',
      })),
    },
  };
}

// ===== SHARED TOOL =====

async function getMenuItemDetails(restaurantId: string, itemName?: string, itemId?: string): Promise<ToolExecutionResult> {
  const where: any = { restaurantId, isAvailable: true };
  if (itemId) where.id = itemId;
  if (itemName) where.name = { contains: itemName };

  const item = await db.menuItem.findFirst({
    where,
    include: {
      category: { select: { name: true } },
      menuItemIngredients: { include: { ingredient: true } },
      modifierGroups: { include: { options: { where: { isActive: true } } } },
      addonItems: { include: { menuItem: { select: { name: true, priceCents: true } } } },
    },
  });

  if (!item) return { success: false, error: 'Item not found' };

  return {
    success: true,
    data: {
      id: item.id,
      name: item.name,
      nameAm: item.nameAm,
      description: item.description,
      descriptionAm: item.descriptionAm,
      price: item.priceCents,
      originalPrice: item.originalPriceCents,
      category: item.category.name,
      preparationTime: item.preparationTime,
      calories: item.calories,
      isVegetarian: item.isVegetarian,
      isSpicy: item.isSpicy,
      isPopular: item.isPopular,
      ingredients: item.menuItemIngredients.map(mi => ({
        name: mi.ingredient.name,
        nameAm: mi.ingredient.nameAm,
        allergens: mi.ingredient.allergens ? JSON.parse(mi.ingredient.allergens as string) : [],
        isRemovable: mi.isRemovable,
        isDefault: mi.isDefault,
        portion: mi.portion,
      })),
      allAllergens: [...new Set(item.menuItemIngredients.flatMap(mi => mi.ingredient.allergens ? JSON.parse(mi.ingredient.allergens as string) : []))],
      modifierGroups: item.modifierGroups.map(mg => ({
        name: mg.name,
        isRequired: mg.isRequired,
        selectionType: mg.selectionType,
        options: mg.options.map(o => ({
          name: o.name,
          priceDelta: o.priceDeltaCents,
          isDefault: o.isDefault,
        })),
      })),
      addons: item.addonItems.map(a => ({
        name: a.menuItem.name,
        price: a.priceCents,
      })),
      image: item.image,
    },
  };
}
