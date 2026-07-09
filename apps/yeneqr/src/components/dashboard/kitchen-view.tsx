'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAppStore } from '@/lib/store';
import { api, formatCurrency } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import { useRealtime } from '@/lib/use-realtime';
import { playNewOrderSound, playOrderReadySound, playUrgentSound } from '@/lib/sounds';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChefHat,
  Clock,
  Flame,
  CheckCircle2,
  AlertCircle,
  Timer,
  Loader2,
  RefreshCw,
  Volume2,
  VolumeX,
  XCircle,
  Play,
  CheckCheck,
  Truck,
  Keyboard,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { AIChatWidget } from '@/components/ai/ai-chat-widget';
import { useI18n } from '@/hooks/useI18n';

// ============================================================
// Types
// ============================================================

type KitchenItemStatus = 'pending' | 'preparing' | 'ready' | 'picked_up' | 'served' | 'cancelled';
type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'served' | 'completed' | 'cancelled';

interface OrderItemData {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  specialInstructions?: string | null;
  removedIngredients?: string | null;
  kitchenStatus: KitchenItemStatus;
  kitchenStationId?: string | null;
  modifierSelections?: { name: string; priceDelta: number }[];
  menuItemImage?: string | null;
  menuItemEmoji?: string | null;
  categoryName?: string | null;
  menuItem?: { id: string; name: string; image: string | null; category?: { id: string; name: string } | null };
  preparationStartedAt?: string | null;
  preparationCompletedAt?: string | null;
  createdAt?: string;
}

interface KitchenOrderData {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  tableId: string;
  type?: string; // 'dine_in' or 'takeaway'
  specialInstructions?: string | null;
  createdAt: string;
  table?: { id: string; number: number } | null;
  items?: OrderItemData[];
}

interface KitchenStationData {
  id: string;
  branchId: string;
  name: string;
  nameI18n?: string | null;
  type: string;
  sortOrder: number;
  isActive: boolean;
  branch?: { id: string; name: string } | null;
}

// ============================================================
// Auto-Categorization Logic
// ============================================================

const STATION_KEYWORDS: Record<string, string[]> = {
  Bar: ['drink', 'beverage', 'cocktail', 'beer', 'wine', 'coffee', 'tea', 'juice', 'soda', 'latte', 'espresso', 'cappuccino', 'mojito', 'margarita'],
  Grill: ['grill', 'steak', 'tibs', 'grilled', 'bbq', 'barbecue', 'roast', 'broil'],
  Salad: ['salad', 'appetizer', 'starter', 'soup', 'salad', 'antipasto'],
  Main: [], // Default fallback
};

/**
 * Auto-assign a station type based on category name.
 * Returns a station type string: "Bar", "Grill", "Salad", or "Main"
 */
function autoAssignStationType(categoryName: string | null | undefined): string {
  if (!categoryName) return 'Main';
  const lower = categoryName.toLowerCase();
  for (const [stationType, keywords] of Object.entries(STATION_KEYWORDS)) {
    if (stationType === 'Main') continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      return stationType;
    }
  }
  return 'Main';
}

/**
 * Given an order item and the list of stations, determine which station
 * this item belongs to. Uses kitchenStationId if set, otherwise auto-categorizes.
 */
function resolveItemStation(
  item: OrderItemData,
  stations: KitchenStationData[]
): string | null {
  // If item already has a station assignment, use it
  if (item.kitchenStationId) {
    return item.kitchenStationId;
  }

  // Auto-categorize based on category name
  const stationType = autoAssignStationType(item.categoryName || item.menuItem?.category?.name);
  if (stationType === 'Main') {
    // Find a "general" or "main" type station, or the first station
    const mainStation =
      stations.find((s) => s.type === 'general' || s.type === 'Main' || s.type === 'main') ||
      stations[0];
    return mainStation?.id || null;
  }

  // Find a station matching the auto-assigned type
  const matchingStation =
    stations.find((s) => s.type.toLowerCase() === stationType.toLowerCase()) ||
    stations.find((s) => s.name.toLowerCase().includes(stationType.toLowerCase()));

  if (matchingStation) return matchingStation.id;

  // Fallback to first station
  return stations[0]?.id || null;
}

// ============================================================
// Station Icon Helper
// ============================================================

function getStationIcon(type: string): string {
  const icons: Record<string, string> = {
    grill: '🔥',
    wot: '🍲',
    drinks: '🍹',
    bar: '🍹',
    dessert: '🍰',
    desserts: '🍰',
    general: '🍳',
    main: '🍳',
    salad: '🥗',
    bakery: '🥖',
    seafood: '🦐',
    fry: '🍟',
  };
  return icons[type.toLowerCase()] || '🍳';
}

// ============================================================
// Kitchen Status Config
// ============================================================

const kitchenStatusConfig: Record<
  KitchenItemStatus,
  { color: string; bgColor: string }
> = {
  pending: {
    color: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
    bgColor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  preparing: {
    color: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
    bgColor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  ready: {
    color: 'border-green-400 bg-green-50 dark:bg-green-900/20',
    bgColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  picked_up: {
    color: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
    bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  served: {
    color: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  cancelled: {
    color: 'border-red-400 bg-red-50 dark:bg-red-900/20',
    bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
};

// ============================================================
// Timer Helpers
// ============================================================

function getElapsedMinutes(startTime: string): number {
  const start = new Date(startTime).getTime();
  const now = new Date().getTime();
  return Math.floor((now - start) / 60000);
}

function getTimerColorClass(minutes: number): string {
  if (minutes >= 20) return 'text-red-600 dark:text-red-400 font-bold';
  if (minutes >= 10) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

function getTimerBgClass(minutes: number): string {
  if (minutes >= 20) return 'bg-red-100 dark:bg-red-900/30';
  if (minutes >= 10) return 'bg-yellow-100 dark:bg-yellow-900/30';
  return 'bg-green-100 dark:bg-green-900/30';
}

// ============================================================
// TimerDisplay Component
// ============================================================

function TimerDisplay({
  startTime,
  preparationStartTime,
  label,
}: {
  startTime: string;
  preparationStartTime?: string | null;
  label?: string;
}) {
  const [elapsed, setElapsed] = useState('');
  const [minutes, setMinutes] = useState(0);

  // When preparationStartTime is available, use it as the timer source
  // This shows "time since preparation started" rather than "time since order created"
  const effectiveStart = preparationStartTime || startTime;

  useEffect(() => {
    const update = () => {
      const start = new Date(effectiveStart).getTime();
      const now = new Date().getTime();
      const diffMs = now - start;
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      setElapsed(`${mins}:${secs.toString().padStart(2, '0')}`);
      setMinutes(mins);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [effectiveStart]);

  const isOverdue = minutes >= 20;
  const isWarning = minutes >= 10 && minutes < 20;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded ${getTimerBgClass(minutes)} ${getTimerColorClass(minutes)}`}
      title={label || (preparationStartTime ? `Prep started: ${new Date(preparationStartTime).toLocaleTimeString()}` : `Created: ${new Date(startTime).toLocaleTimeString()}`)}
    >
      <Timer className={`h-3 w-3 ${isOverdue ? 'animate-pulse' : ''}`} />
      {label && <span className="text-[9px] opacity-70">{label}</span>}
      {elapsed}
      {isOverdue && <AlertCircle className="h-3 w-3" />}
      {isWarning && !isOverdue && <span className="text-[9px]">⚠</span>}
    </span>
  );
}

// ============================================================
// BumpBar Component — Quick action buttons for each item
// ============================================================

function BumpBar({
  item,
  updating,
  onStatusUpdate,
  t,
}: {
  item: OrderItemData;
  updating: boolean;
  onStatusUpdate: (itemId: string, newStatus: KitchenItemStatus) => void;
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string;
}) {
  const status = item.kitchenStatus;

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          className="h-7 text-xs gap-1 bg-orange-600 hover:bg-orange-700"
          onClick={() => onStatusUpdate(item.id, 'preparing')}
          disabled={updating}
          title={t('kitchen.start', 'Start')}
        >
          {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          {t('kitchen.start', 'Start')}
        </Button>
      </div>
    );
  }

  if (status === 'preparing') {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
          onClick={() => onStatusUpdate(item.id, 'ready')}
          disabled={updating}
          title={t('kitchen.ready', 'Ready')}
        >
          {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
          {t('kitchen.ready', 'Ready')}
        </Button>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
          onClick={() => onStatusUpdate(item.id, 'picked_up')}
          disabled={updating}
          title={t('kitchen.picked_up', 'Picked Up')}
        >
          {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
          {t('kitchen.picked_up', 'Picked Up')}
        </Button>
      </div>
    );
  }

  return null;
}

// ============================================================
// KitchenOrderCard Component
// ============================================================

function KitchenOrderCard({
  order,
  restaurantId,
  onUpdated,
  isNew,
  focusedItemId,
  stations,
  itemStationMap,
  selectedStation,
  t,
  getKitchenStatusLabel,
}: {
  order: KitchenOrderData;
  restaurantId: string;
  onUpdated: () => void;
  isNew: boolean;
  focusedItemId: string | null;
  stations: KitchenStationData[];
  itemStationMap: Map<string, string | null>;
  selectedStation: string;
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string;
  getKitchenStatusLabel: (status: KitchenItemStatus) => string;
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const items = order.items || [];
  const activeItems = items.filter(
    (i) => i.kitchenStatus !== 'served' && i.kitchenStatus !== 'cancelled'
  );

  // Filter items by selected station
  const stationFilteredItems = selectedStation === 'all'
    ? activeItems
    : activeItems.filter((item) => itemStationMap.get(item.id) === selectedStation);

  // ── Group items by station for station routing ──────────────
  const stationGroups = useMemo(() => {
    const groups = new Map<string, { station: KitchenStationData | null; items: OrderItemData[] }>();

    for (const item of stationFilteredItems) {
      const stationId = itemStationMap.get(item.id) || 'unassigned';
      if (!groups.has(stationId)) {
        const station = stations.find((s) => s.id === stationId) || null;
        groups.set(stationId, { station, items: [] });
      }
      groups.get(stationId)!.items.push(item);
    }

    return groups;
  }, [stationFilteredItems, stations, itemStationMap]);

  if (stationFilteredItems.length === 0) return null;

  const hasUrgent = stationFilteredItems.some((i) => i.kitchenStatus === 'pending');
  const allReady = stationFilteredItems.every(
    (i) => i.kitchenStatus === 'ready' || i.kitchenStatus === 'picked_up'
  );

  // Check for overdue items (>20 min pending)
  const hasOverdue = stationFilteredItems.some(
    (i) =>
      (i.kitchenStatus === 'pending' || i.kitchenStatus === 'preparing') &&
      getElapsedMinutes(order.createdAt) >= 20
  );

  // Check for warning items (>10 min pending)
  const hasWarning = !hasOverdue && stationFilteredItems.some(
    (i) =>
      (i.kitchenStatus === 'pending' || i.kitchenStatus === 'preparing') &&
      getElapsedMinutes(order.createdAt) >= 10
  );

  const handleItemStatusUpdate = async (itemId: string, newStatus: KitchenItemStatus) => {
    try {
      setUpdating(itemId);
      await api.patch(
        `/api/restaurants/${restaurantId}/orders/${order.id}/items/${itemId}`,
        { kitchenStatus: newStatus }
      );
      toast.success('Item status updated');
      if (newStatus === 'ready') {
        playOrderReadySound();
      }
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update';
      toast.error(msg);
    } finally {
      setUpdating(null);
    }
  };

  const handleBulkMarkReady = async () => {
    try {
      setBulkUpdating(true);
      const preparingItems = stationFilteredItems
        .filter((i) => i.kitchenStatus === 'preparing' || i.kitchenStatus === 'pending')
        .map((i) => i.id);

      if (preparingItems.length === 0) {
        toast.info('No items to mark ready');
        return;
      }

      await api.patch(
        `/api/restaurants/${restaurantId}/orders/${order.id}/items/bulk`,
        { itemIds: preparingItems, kitchenStatus: 'ready' }
      );
      toast.success(`${preparingItems.length} items marked ready`);
      playOrderReadySound();
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update';
      toast.error(msg);
    } finally {
      setBulkUpdating(false);
    }
  };

  // Items that can be bulk-marked ready
  const canBulkReady = stationFilteredItems.some(
    (i) => i.kitchenStatus === 'pending' || i.kitchenStatus === 'preparing'
  );

  return (
    <Card
      className={`border-l-4 ${
        allReady
          ? 'border-l-green-500'
          : hasOverdue
            ? 'border-l-red-500'
            : hasUrgent
              ? 'border-l-yellow-500'
              : 'border-l-orange-500'
      } ${isNew ? 'animate-pulse-once' : ''} ${hasOverdue ? 'animate-urgent-blink border-red-300 dark:border-red-800' : hasWarning ? 'animate-kds-warning' : ''}`}
    >
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">{order.orderNumber}</CardTitle>
            {order.type === 'takeaway' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 text-white font-bold text-xs">
                🥡 PACK
              </span>
            ) : (
              <>
                <Badge variant="outline" className="text-[10px]">
                  {order.table ? `${t('dashboard.table_label', 'Table')} ${order.table.number}` : '—'}
                </Badge>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold text-xs">
                  🍽️ SERVE
                </span>
              </>
            )}
          </div>
          <TimerDisplay startTime={order.createdAt} />
        </div>
        {order.specialInstructions && (
          <div className="flex items-start gap-1 mt-1 rounded bg-yellow-50 dark:bg-yellow-900/20 p-1.5">
            <AlertCircle className="h-3 w-3 text-yellow-600 shrink-0 mt-0.5" />
            <span className="text-[11px] text-yellow-700 dark:text-yellow-300">
              {order.specialInstructions}
            </span>
          </div>
        )}
        {/* Bulk "Mark All Ready" button */}
        {canBulkReady && (
          <div className="mt-2">
            <Button
              size="sm"
              className="w-full h-7 text-xs gap-1 bg-green-600 hover:bg-green-700"
              onClick={handleBulkMarkReady}
              disabled={bulkUpdating}
            >
              {bulkUpdating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              {t('kitchen.mark_all_ready', 'Mark All Ready')}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {Array.from(stationGroups.entries()).map(([stationId, group]) => {
          const stationName = group.station?.name || (stationId === 'unassigned' ? t('kitchen.unassigned', 'Unassigned') : autoAssignStationType(group.items[0]?.categoryName || group.items[0]?.menuItem?.category?.name));
          const stationType = group.station?.type || autoAssignStationType(group.items[0]?.categoryName || group.items[0]?.menuItem?.category?.name);
          const stationIcon = getStationIcon(stationType);
          const showStationHeader = stationGroups.size > 1;

          return (
            <div key={stationId}>
              {/* Station section header — only shown when there are multiple stations */}
              {showStationHeader && (
                <div className="flex items-center gap-1.5 mb-1.5 mt-1 px-1">
                  <span className="text-sm">{stationIcon}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {stationName}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    ({group.items.length} {group.items.length === 1 ? t('kitchen.item', 'item') : t('kitchen.items', 'items')})
                  </span>
                </div>
              )}
              {group.items.map((item) => {
                const config = kitchenStatusConfig[item.kitchenStatus];
                const itemOverdue =
                  (item.kitchenStatus === 'pending' || item.kitchenStatus === 'preparing') &&
                  getElapsedMinutes(item.preparationStartedAt || item.createdAt || order.createdAt) >= 20;
                const itemWarning =
                  (item.kitchenStatus === 'pending' || item.kitchenStatus === 'preparing') &&
                  getElapsedMinutes(item.preparationStartedAt || item.createdAt || order.createdAt) >= 10 &&
                  getElapsedMinutes(item.preparationStartedAt || item.createdAt || order.createdAt) < 20;
                const isFocused = focusedItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-2.5 mb-1.5 ${config.color} ${
                      itemOverdue
                        ? 'ring-2 ring-red-400 ring-offset-1'
                        : itemWarning
                          ? 'ring-1 ring-yellow-400 ring-offset-1'
                          : ''
                    } ${isFocused ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    data-item-id={item.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {(item.menuItem?.image || item.menuItemImage) ? (
                            <img
                              src={item.menuItem?.image || item.menuItemImage || ''}
                              alt={item.name}
                              className="w-8 h-8 rounded object-cover shrink-0"
                            />
                          ) : item.menuItemEmoji ? (
                            <span className="text-base shrink-0">{item.menuItemEmoji}</span>
                          ) : null}
                          <span className="text-sm font-medium">{item.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 border-0 ${config.bgColor}`}
                          >
                            {getKitchenStatusLabel(item.kitchenStatus)}
                          </Badge>
                          {itemOverdue && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
                              {t('kitchen.overdue', 'OVERDUE')}
                            </Badge>
                          )}
                          {itemWarning && !itemOverdue && (
                            <Badge className="text-[10px] px-1.5 py-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-0">
                              {t('kitchen.slow', 'SLOW')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                          {item.modifierSelections && item.modifierSelections.length > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              ({item.modifierSelections?.map((m) => m.name).join(', ')})
                            </span>
                          )}
                          {/* Item-level timer — uses preparationStartedAt when available, falls back to createdAt */}
                          {(item.kitchenStatus === 'pending' || item.kitchenStatus === 'preparing') && (
                            <TimerDisplay
                              startTime={item.createdAt || order.createdAt}
                              preparationStartTime={item.kitchenStatus === 'preparing' ? item.preparationStartedAt : null}
                              label={item.kitchenStatus === 'preparing' && item.preparationStartedAt ? 'Prep' : 'Wait'}
                            />
                          )}
                        </div>
                        {/* Removed Ingredients — CRITICAL for kitchen */}
                        {item.removedIngredients &&
                          (() => {
                            try {
                              const removed = JSON.parse(item.removedIngredients);
                              if (!Array.isArray(removed) || removed.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {removed.map((ri: { id: string; name: string; nameAm?: string }) => (
                                    <span
                                      key={ri.id}
                                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800"
                                    >
                                      🚫 {ri.name}
                                    </span>
                                  ))}
                                </div>
                              );
                            } catch {
                              return null;
                            }
                          })()}
                        {item.specialInstructions && (
                          <div className="flex items-start gap-1 mt-1 rounded bg-orange-50 dark:bg-orange-900/20 p-1">
                            <AlertCircle className="h-3 w-3 text-orange-600 shrink-0 mt-0.5" />
                            <span className="text-[10px] text-orange-700 dark:text-orange-300">
                              {item.specialInstructions}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Bump Bar — Status action buttons */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <BumpBar
                          item={item}
                          updating={updating === item.id}
                          onStatusUpdate={handleItemStatusUpdate}
                          t={t}
                        />
                        {(item.kitchenStatus === 'pending' || item.kitchenStatus === 'preparing') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] gap-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-1"
                            onClick={() => setCancelTarget({ id: item.id, name: item.name })}
                            disabled={updating === item.id}
                          >
                            <XCircle className="h-3 w-3" />
                            {t('common.cancel', 'Cancel')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </CardContent>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('kitchen.cancel_item', 'Cancel Item?')}</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel &quot;{cancelTarget?.name}&quot; from the order. This action cannot be
              undone and the kitchen will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('kitchen.keep_item', 'Keep Item')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (cancelTarget) {
                  handleItemStatusUpdate(cancelTarget.id, 'cancelled');
                  setCancelTarget(null);
                }
              }}
            >
              {t('kitchen.cancel_item_btn', 'Cancel Item')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ============================================================
// Sound Alert Hook — Web Audio API with active tab check
// ============================================================

function useSoundAlerts(enabled: boolean) {
  const isEnabledRef = useRef(enabled);
  const tabVisibleRef = useRef(true);

  useEffect(() => {
    isEnabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const handleVisibility = () => {
      tabVisibleRef.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const playIfActive = useCallback(
    (soundFn: () => void) => {
      if (enabled && tabVisibleRef.current) {
        soundFn();
      }
    },
    [enabled]
  );

  return { playIfActive };
}

// ============================================================
// Keyboard Shortcuts Hook
// ============================================================

function useKitchenKeyboardShortcuts({
  onSpace,
  onEnter,
  onEscape,
  enabled,
}: {
  onSpace: () => void;
  onEnter: () => void;
  onEscape: () => void;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        onSpace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onEnter();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSpace, onEnter, onEscape, enabled]);
}

// ============================================================
// Main KitchenView Component
// ============================================================

export function KitchenView() {
  const { kitchenStation, setKitchenStation, user, selectedBranchId, setSelectedBranchId: setGlobalBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';
  const { t } = useI18n(restaurantId);

  const [orders, setOrders] = useState<KitchenOrderData[]>([]);
  const [stations, setStations] = useState<KitchenStationData[]>([]);
  const [kitchenBranches, setKitchenBranches] = useState<{id: string; name: string; isMainBranch: boolean}[]>([]);
  const [loading, setLoading] = useState(true);
  const [stationsLoading, setStationsLoading] = useState(true);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState(true);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const urgentCheckRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOrdersRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchStationsRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[KitchenView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setOrders([]);
    setStations([]);
    previousOrderIdsRef.current = new Set();
    fetchOrdersRef.current?.();
    fetchStationsRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  const { playIfActive } = useSoundAlerts(soundEnabled);

  // ── Kitchen Status Label Helper ─────────────────────────────
  const getKitchenStatusLabel = useCallback(
    (status: KitchenItemStatus): string => {
      const map: Record<KitchenItemStatus, string> = {
        pending: t('order.status.pending', 'Pending'),
        preparing: t('order.status.preparing', 'Preparing'),
        ready: t('order.status.ready', 'Ready'),
        picked_up: t('order.status.picked_up', 'Picked Up'),
        served: t('order.status.served', 'Served'),
        cancelled: t('order.status.cancelled', 'Cancelled'),
      };
      return map[status] || status;
    },
    [t]
  );

  // ── Fetch Orders ────────────────────────────────────────────

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      // Read selectedBranchId from store at call time to avoid stale closures
      // (SSE events and intervals may call this with an outdated closure)
      const currentBranchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = { status: 'active' };
      if (currentBranchId) params.branchId = currentBranchId;
      const res = await api.get<{ data: KitchenOrderData[] }>(
        `/api/restaurants/${restaurantId}/orders`,
        params
      );
      const allOrders = res.data || [];
      // Filter to kitchen-relevant states
      const kitchenOrders = allOrders.filter(
        (o) =>
          o.status === 'pending' ||
          o.status === 'accepted' ||
          o.status === 'preparing' ||
          o.status === 'ready' ||
          o.status === 'picked_up'
      );

      // Detect new orders by comparing with previous set
      const currentIds = new Set(kitchenOrders.map((o) => o.id));
      const newIds = new Set<string>();
      kitchenOrders.forEach((o) => {
        if (!previousOrderIdsRef.current.has(o.id)) {
          newIds.add(o.id);
        }
      });

      if (newIds.size > 0 && previousOrderIdsRef.current.size > 0) {
        setNewOrderIds(newIds);
        // Play sound for new orders if enabled and tab is active
        playIfActive(playNewOrderSound);
        // Clear the "new" highlight after 3 seconds
        setTimeout(() => {
          setNewOrderIds((prev) => {
            const next = new Set(prev);
            newIds.forEach((id) => next.delete(id));
            return next;
          });
        }, 3000);
      }

      previousOrderIdsRef.current = currentIds;
      setOrders(kitchenOrders);
    } catch (err) {
      // Silently handle — show empty state
    } finally {
      setLoading(false);
    }
  }, [restaurantId, playIfActive]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchOrdersRef.current = fetchOrders; }, [fetchOrders]);

  // ── Fetch Kitchen Stations ──────────────────────────────────

  const fetchStations = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setStationsLoading(true);
      // Read selectedBranchId from store at call time to avoid stale closures
      const currentBranchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = { isActive: 'true' };
      if (currentBranchId) params.branchId = currentBranchId;
      const res = await api.get<{ data: KitchenStationData[] }>(
        `/api/restaurants/${restaurantId}/kitchen-stations`,
        params
      );
      setStations(res.data || []);
    } catch (err) {
      // Silently handle — stations will be empty
    } finally {
      setStationsLoading(false);
    }
  }, [restaurantId, selectedBranchId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchStationsRef.current = fetchStations; }, [fetchStations]);

  // ── Fetch Branches for in-view branch selector ──────────────
  useEffect(() => {
    if (!restaurantId) return;
    api.get<{data: {id: string; name: string; isMainBranch: boolean}[]}>(`/api/restaurants/${restaurantId}/branches`)
      .then(res => {
        const list = Array.isArray(res) ? res : (res.data || []);
        setKitchenBranches(list);
      })
      .catch(() => {});
  }, [restaurantId]);

  // ── Reset loading state when branch changes ──────────────
  useEffect(() => {
    setLoading(true);
    setOrders([]);
    setStations([]);
    previousOrderIdsRef.current = new Set(); // Reset new-order detection
  }, [selectedBranchId]);

  // ── Real-time Connection ────────────────────────────────────

  const [authToken, setAuthToken] = useState<string | undefined>();
  useEffect(() => {
    setAuthToken(localStorage.getItem('yeneqr_token') || undefined);
  }, []);

  const { connected: realtimeConnected } = useRealtime({
    restaurantId,
    token: authToken,
    enabled: !!restaurantId,
    onEvent: (event) => {
      if (event.type === 'new_order') {
        if (soundEnabled) playNewOrderSound();
        fetchOrders();
      }
      if (event.type === 'kitchen_item_updated') {
        fetchOrders();
      }
      if (event.type === 'order_status_changed') {
        fetchOrders();
      }
      if (event.type === 'waiter_order_ready') {
        fetchOrders();
      }
    },
  });

  // ── Station Resolution & Item Mapping ───────────────────────

  /**
   * Map each order item to its resolved station.
   * This uses auto-categorization when no station is assigned.
   */
  const itemStationMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const order of orders) {
      for (const item of order.items || []) {
        map.set(item.id, resolveItemStation(item, stations));
      }
    }
    return map;
  }, [orders, stations]);

  /**
   * Compute pending item counts per station for badge display.
   */
  const stationPendingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Initialize all stations with 0
    for (const station of stations) {
      counts[station.id] = 0;
    }
    // Count pending items per station
    for (const order of orders) {
      for (const item of order.items || []) {
        if (item.kitchenStatus === 'pending' || item.kitchenStatus === 'preparing') {
          const stationId = itemStationMap.get(item.id);
          if (stationId) {
            counts[stationId] = (counts[stationId] || 0) + 1;
          }
        }
      }
    }
    return counts;
  }, [orders, stations, itemStationMap]);

  /** Total pending count across all stations */
  const totalPendingCount = useMemo(() => {
    return Object.values(stationPendingCounts).reduce((sum, c) => sum + c, 0);
  }, [stationPendingCounts]);

  /**
   * Compute station type-based grouping for virtual stations
   * when no real stations exist yet.
   */
  const virtualStationGroups = useMemo(() => {
    const groups: Record<string, { type: string; name: string; count: number }> = {};
    for (const order of orders) {
      for (const item of order.items || []) {
        if (item.kitchenStatus === 'pending' || item.kitchenStatus === 'preparing') {
          const stationType = autoAssignStationType(item.categoryName || item.menuItem?.category?.name);
          if (!groups[stationType]) {
            groups[stationType] = {
              type: stationType,
              name: stationType,
              count: 0,
            };
          }
          groups[stationType].count++;
        }
      }
    }
    return groups;
  }, [orders]);

  // ── Filtered Orders by Station ──────────────────────────────

  const filteredOrders = useMemo(() => {
    if (kitchenStation === 'all') return orders;
    return orders.filter((order) =>
      (order.items || []).some((item) => itemStationMap.get(item.id) === kitchenStation)
    );
  }, [orders, kitchenStation, itemStationMap]);

  // ── Flat list of active items for keyboard navigation ───────

  const allActiveItems = useMemo(() => {
    const items: { itemId: string; orderId: string; kitchenStatus: KitchenItemStatus }[] = [];
    for (const order of filteredOrders) {
      for (const item of order.items || []) {
        if (
          item.kitchenStatus === 'pending' ||
          item.kitchenStatus === 'preparing' ||
          item.kitchenStatus === 'ready'
        ) {
          items.push({
            itemId: item.id,
            orderId: order.id,
            kitchenStatus: item.kitchenStatus,
          });
        }
      }
    }
    return items;
  }, [filteredOrders]);

  // ── Keyboard Shortcuts ──────────────────────────────────────

  const handleKeyboardSpace = useCallback(async () => {
    // Space = Start (mark focused item as preparing)
    if (!focusedItemId) {
      // Auto-focus first pending item
      const firstPending = allActiveItems.find((i) => i.kitchenStatus === 'pending');
      if (firstPending) setFocusedItemId(firstPending.itemId);
      return;
    }
    const focused = allActiveItems.find((i) => i.itemId === focusedItemId);
    if (focused && focused.kitchenStatus === 'pending') {
      try {
        await api.patch(
          `/api/restaurants/${restaurantId}/orders/${focused.orderId}/items/${focused.itemId}`,
          { kitchenStatus: 'preparing' }
        );
        toast.success('Item started');
        fetchOrders();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update';
        toast.error(msg);
      }
    }
  }, [focusedItemId, allActiveItems, restaurantId, fetchOrders]);

  const handleKeyboardEnter = useCallback(async () => {
    // Enter = Ready (mark focused item as ready)
    if (!focusedItemId) return;
    const focused = allActiveItems.find((i) => i.itemId === focusedItemId);
    if (focused && focused.kitchenStatus === 'preparing') {
      try {
        await api.patch(
          `/api/restaurants/${restaurantId}/orders/${focused.orderId}/items/${focused.itemId}`,
          { kitchenStatus: 'ready' }
        );
        toast.success('Item marked ready');
        playOrderReadySound();
        fetchOrders();
        // Move focus to next item
        const idx = allActiveItems.findIndex((i) => i.itemId === focusedItemId);
        if (idx < allActiveItems.length - 1) {
          setFocusedItemId(allActiveItems[idx + 1].itemId);
        } else {
          setFocusedItemId(null);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update';
        toast.error(msg);
      }
    }
  }, [focusedItemId, allActiveItems, restaurantId, fetchOrders]);

  const handleKeyboardEscape = useCallback(() => {
    // Escape = deselect / go back
    setFocusedItemId(null);
  }, []);

  useKitchenKeyboardShortcuts({
    onSpace: handleKeyboardSpace,
    onEnter: handleKeyboardEnter,
    onEscape: handleKeyboardEscape,
    enabled: keyboardShortcutsEnabled,
  });

  // ── Effects ─────────────────────────────────────────────────

  // Fetch stations once on mount and when branch changes
  useEffect(() => {
    fetchStations();
  }, [fetchStations, selectedBranchId, branchChangeVersion]);

  // Keep a slower poll (30s) as fallback
  // selectedBranchId is a direct dep so we re-fetch immediately when branch changes
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders, selectedBranchId, branchChangeVersion]);

  // Periodic urgent sound check for overdue orders (>20 min) and warning (>10 min)
  useEffect(() => {
    const checkUrgent = () => {
      if (!soundEnabled) return;
      let hasOverdue = false;
      let hasWarning = false;
      for (const o of orders) {
        const items = o.items || [];
        const hasPending = items.some(
          (i) => i.kitchenStatus === 'pending' || i.kitchenStatus === 'preparing'
        );
        if (hasPending) {
          const mins = getElapsedMinutes(o.createdAt);
          if (mins >= 20) hasOverdue = true;
          else if (mins >= 10) hasWarning = true;
        }
      }
      if (hasOverdue) {
        playUrgentSound();
      } else if (hasWarning) {
        playNewOrderSound();
      }
    };

    // Check every 30 seconds for overdue/warning items
    urgentCheckRef.current = setInterval(checkUrgent, 30000);
    return () => {
      if (urgentCheckRef.current) {
        clearInterval(urgentCheckRef.current);
      }
    };
  }, [orders, soundEnabled]);

  // ── Stats ───────────────────────────────────────────────────

  const allItems = orders.flatMap((o) => o.items || []);
  const pendingCount = orders.filter(
    (o) => allItems.filter((i) => i.kitchenStatus === 'pending').length > 0
  ).length;
  const preparingCount = orders.filter(
    (o) =>
      allItems.filter((i) => i.kitchenStatus === 'preparing').length > 0 &&
      allItems.filter((i) => i.kitchenStatus === 'pending').length === 0
  ).length;
  const readyCount = orders.filter(
    (o) =>
      (o.items || []).every(
        (i) => i.kitchenStatus === 'ready' || i.kitchenStatus === 'picked_up' || i.kitchenStatus === 'served'
      )
  ).length;

  // ── Loading State ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">{t('kitchen.loading', 'Loading kitchen...')}</span>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Stats Cards ──────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 min-w-0">
          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-[11px] text-muted-foreground">{t('order.status.pending', 'Pending')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Flame className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{preparingCount}</p>
                <p className="text-[11px] text-muted-foreground">{t('order.status.preparing', 'Preparing')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{readyCount}</p>
                <p className="text-[11px] text-muted-foreground">{t('order.status.ready', 'Ready')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex items-center gap-2">
          {/* Branch Selector (syncs with global header) */}
          {kitchenBranches.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Building2 className="h-3 w-3" />
                  {kitchenBranches.find(b => b.id === selectedBranchId)?.name || 'Branch'}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {kitchenBranches.map((branch) => (
                  <DropdownMenuItem
                    key={branch.id}
                    onClick={() => setGlobalBranchId(branch.id)}
                    className={selectedBranchId === branch.id ? 'bg-accent' : ''}
                  >
                    {branch.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Real-time connection indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}
            />
            {realtimeConnected ? t('kitchen.live', 'Live') : t('kitchen.polling', 'Polling')}
          </div>
          {/* Sound toggle */}
          <Button
            variant={soundEnabled ? 'default' : 'outline'}
            size="sm"
            className="gap-1"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            {soundEnabled ? t('kitchen.sound_on', 'Sound On') : t('kitchen.sound_off', 'Sound Off')}
          </Button>
          {/* Keyboard shortcuts toggle */}
          <Button
            variant={keyboardShortcutsEnabled ? 'default' : 'outline'}
            size="sm"
            className="gap-1"
            onClick={() => setKeyboardShortcutsEnabled(!keyboardShortcutsEnabled)}
            title="Toggle keyboard shortcuts: Space=Start, Enter=Ready, Esc=Deselect"
          >
            <Keyboard className="h-3 w-3" />
            {keyboardShortcutsEnabled ? 'Keys On' : 'Keys Off'}
          </Button>
          {/* Refresh button */}
          <Button variant="outline" size="sm" className="gap-1" onClick={fetchOrders}>
            <RefreshCw className="h-3 w-3" />
            {t('dashboard.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* ── Keyboard Shortcuts Help ──────────────────────────── */}
      {keyboardShortcutsEnabled && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5">
          <span className="font-medium">{t('kitchen.shortcuts', 'Shortcuts')}:</span>
          <span>
            <kbd className="px-1 py-0.5 bg-background rounded border text-[10px]">Space</kbd> = {t('kitchen.start', 'Start')}
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-background rounded border text-[10px]">Enter</kbd> = {t('kitchen.ready', 'Ready')}
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-background rounded border text-[10px]">Esc</kbd> = Deselect
          </span>
        </div>
      )}

      {/* ── Station Filter Tabs ──────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto flex-nowrap pb-1 sm:flex-wrap">
        {/* "All Orders" tab with total pending badge */}
        <Button
          variant={kitchenStation === 'all' ? 'default' : 'outline'}
          size="sm"
          className="text-xs h-8 gap-1.5"
          onClick={() => setKitchenStation('all')}
        >
          🏠 {t('kitchen.all_stations', 'All Stations')}
          {totalPendingCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-4 min-w-[1.25rem] text-[10px] px-1"
            >
              {totalPendingCount}
            </Badge>
          )}
        </Button>

        {stationsLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading stations...
          </div>
        ) : stations.length > 0 ? (
          // Show real stations with badge counts
          stations.map((station) => {
            const count = stationPendingCounts[station.id] || 0;
            return (
              <Button
                key={station.id}
                variant={kitchenStation === station.id ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-8 gap-1.5"
                onClick={() => setKitchenStation(station.id)}
              >
                {getStationIcon(station.type)} {station.name}
                {count > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 min-w-[1.25rem] text-[10px] px-1"
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })
        ) : (
          // Show virtual station groups when no real stations exist
          Object.entries(virtualStationGroups).map(([type, group]) => (
            <Button
              key={type}
              variant={kitchenStation === type ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => setKitchenStation(type)}
            >
              {getStationIcon(type)} {group.name}
              {group.count > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 min-w-[1.25rem] text-[10px] px-1"
                >
                  {group.count}
                </Badge>
              )}
            </Button>
          ))
        )}
      </div>

      {/* ── Kitchen Order Cards ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredOrders.map((order) => (
          <KitchenOrderCard
            key={order.id}
            order={order}
            restaurantId={restaurantId}
            onUpdated={fetchOrders}
            isNew={newOrderIds.has(order.id)}
            focusedItemId={focusedItemId}
            stations={stations}
            itemStationMap={itemStationMap}
            selectedStation={kitchenStation}
            t={t}
            getKitchenStatusLabel={getKitchenStatusLabel}
          />
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ChefHat className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              {kitchenStation === 'all'
                ? t('kitchen.no_orders', 'No active kitchen orders')
                : t('kitchen.no_station_orders', 'No orders for this station')}
            </p>
          </CardContent>
        </Card>
      )}

      <AIChatWidget
        agentType="kitchen"
        restaurantId={restaurantId}
        branchId={selectedBranchId}
        language="en"
      />
    </div>
  );
}
