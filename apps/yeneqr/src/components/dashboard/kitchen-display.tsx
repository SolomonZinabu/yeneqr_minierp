'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import { useRealtime } from '@/lib/use-realtime';
import { playNewOrderSound, playOrderReadySound, playUrgentSound } from '@/lib/sounds';
import {
  AlertCircle,
  Timer,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Play,
  Check,
  RefreshCw,
  ChefHat,
  Building2,
  ChevronDown,
  Ban,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { useKitchenTicketPrinter } from '@/components/dashboard/kitchen-ticket-printer';

// ============================================================
// Types — re-used from kitchen-view.tsx
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
  roundNumber?: number;
  modifierSelections?: { name: string; priceDelta: number }[];
  menuItemImage?: string | null;
  menuItemEmoji?: string | null;
  categoryName?: string | null;
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
// Auto-Categorization Logic — from kitchen-view.tsx
// ============================================================

const STATION_KEYWORDS: Record<string, string[]> = {
  Bar: ['drink', 'beverage', 'cocktail', 'beer', 'wine', 'coffee', 'tea', 'juice', 'soda', 'latte', 'espresso', 'cappuccino', 'mojito', 'margarita'],
  Grill: ['grill', 'steak', 'tibs', 'grilled', 'bbq', 'barbecue', 'roast', 'broil'],
  Salad: ['salad', 'appetizer', 'starter', 'soup', 'salad', 'antipasto'],
  Main: [],
};

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

function resolveItemStation(
  item: OrderItemData,
  stations: KitchenStationData[]
): string | null {
  if (item.kitchenStationId) return item.kitchenStationId;
  const stationType = autoAssignStationType(item.categoryName);
  if (stationType === 'Main') {
    const mainStation =
      stations.find((s) => s.type === 'general' || s.type === 'Main' || s.type === 'main') ||
      stations[0];
    return mainStation?.id || null;
  }
  const matchingStation =
    stations.find((s) => s.type.toLowerCase() === stationType.toLowerCase()) ||
    stations.find((s) => s.name.toLowerCase().includes(stationType.toLowerCase()));
  if (matchingStation) return matchingStation.id;
  return stations[0]?.id || null;
}

function getStationIcon(type: string): string {
  const icons: Record<string, string> = {
    grill: '🔥', wot: '🍲', drinks: '🍹', bar: '🍹',
    dessert: '🍰', desserts: '🍰', general: '🍳', main: '🍳',
    salad: '🥗', bakery: '🥖', seafood: '🦐', fry: '🍟',
  };
  return icons[type.toLowerCase()] || '🍳';
}

// ============================================================
// Timer Helpers
// ============================================================

function getElapsedMinutes(startTime: string): number {
  const start = new Date(startTime).getTime();
  const now = new Date().getTime();
  return Math.floor((now - start) / 60000);
}

// ============================================================
// Flattened Item — enriched with order context
// ============================================================

interface FlatKitchenItem {
  item: OrderItemData;
  orderId: string;
  orderNumber: string;
  tableName: string;
  orderCreatedAt: string;
  priority: string; // 'normal', 'rush', 'vip'
  roundNumber: number; // Which round this item belongs to
  stationId: string | null;
  stationType: string;
  readyAt: number | null; // timestamp when moved to ready
  orderType: string; // 'dine_in' or 'takeaway'
}

// ============================================================
// Aggregated Item — for "All Day" counts
// ============================================================

interface AggregatedItem {
  name: string;
  emoji: string | null;
  totalCount: number;
  stationType: string;
  items: FlatKitchenItem[];
}

// ============================================================
// KDSTimer — Big countdown/timer for KDS cards
// ============================================================

function KDSTimer({
  startTime,
  preparationStartTime,
}: {
  startTime: string;
  preparationStartTime?: string | null;
}) {
  const [elapsed, setElapsed] = useState('');
  const [minutes, setMinutes] = useState(0);
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
      className={`inline-flex items-center gap-1 text-sm font-mono px-2 py-1 rounded-md ${
        isOverdue
          ? 'bg-red-500/20 text-red-400 font-bold animate-pulse'
          : isWarning
            ? 'bg-yellow-500/20 text-yellow-400'
            : 'bg-green-500/20 text-green-400'
      }`}
    >
      <Timer className="h-4 w-4" />
      {elapsed}
      {isOverdue && <AlertCircle className="h-4 w-4 ml-1" />}
    </span>
  );
}

// ============================================================
// DoneCountdown — Shows seconds remaining before auto-hide
// ============================================================

function DoneCountdown({ readyAt }: { readyAt: number }) {
  const HIDE_AFTER_MS = 30_000;
  const [remaining, setRemaining] = useState(
    Math.max(0, Math.ceil((HIDE_AFTER_MS - (Date.now() - readyAt)) / 1000))
  );

  useEffect(() => {
    const update = () => {
      const left = Math.max(0, Math.ceil((HIDE_AFTER_MS - (Date.now() - readyAt)) / 1000));
      setRemaining(left);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [readyAt]);

  if (remaining <= 0) return null;

  return (
    <span className="text-[11px] text-green-400/60 font-mono">
      {remaining}s
    </span>
  );
}

// ============================================================
// RemovedIngredients — Red badges for removed items
// ============================================================

function RemovedIngredients({ raw }: { raw: string }) {
  const parsed = useMemo(() => {
    try {
      const removed = JSON.parse(raw);
      if (!Array.isArray(removed) || removed.length === 0) return null;
      return removed;
    } catch {
      return null;
    }
  }, [raw]);

  if (!parsed) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {parsed.map((ri: { id: string; name: string; nameAm?: string }) => (
        <span
          key={ri.id}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30"
        >
          🚫 {ri.name}
        </span>
      ))}
    </div>
  );
}

// ============================================================
// KitchenItemCard — Big touch-friendly card for each item
// ============================================================

function KitchenItemCard({
  flatItem,
  restaurantId,
  onOptimisticUpdate,
  onEightySix,
  t,
}: {
  flatItem: FlatKitchenItem;
  restaurantId: string;
  onOptimisticUpdate: (itemId: string, newStatus: KitchenItemStatus, orderId: string) => void;
  onEightySix?: (itemId: string, menuItemId: string | null, itemName: string, orderId: string, branchId?: string) => void;
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string;
}) {
  const { item, orderNumber, tableName, orderCreatedAt } = flatItem;
  const status = item.kitchenStatus;

  const effectiveStart = item.preparationStartedAt || item.createdAt || orderCreatedAt;
  const minutes = getElapsedMinutes(effectiveStart);
  const isOverdue = (status === 'pending' || status === 'preparing') && minutes >= 20;
  const isWarning = (status === 'pending' || status === 'preparing') && minutes >= 10 && minutes < 20;

  // Determine card accent based on column + priority
  const priorityColor = flatItem.priority === 'vip'
    ? 'border-l-purple-500 ring-2 ring-purple-500/40'
    : flatItem.priority === 'rush'
      ? 'border-l-red-400 ring-1 ring-red-400/30'
      : ''
  const cardAccent =
    status === 'pending'
      ? `border-l-yellow-500 bg-slate-800 ${priorityColor}`
      : status === 'preparing'
        ? `border-l-orange-500 bg-slate-800 ${priorityColor}`
        : `border-l-green-500 bg-slate-800/60 ${priorityColor}`;

  const handleAction = () => {
    const newStatus: KitchenItemStatus = status === 'pending' ? 'preparing' : 'ready';
    onOptimisticUpdate(item.id, newStatus, flatItem.orderId);
  };

  return (
    <div
      className={`rounded-lg border-l-4 ${cardAccent} p-3 shadow-lg transition-all duration-200 ${
        isOverdue ? 'ring-2 ring-red-500/50 animate-kds-urgent' : isWarning ? 'ring-1 ring-yellow-500/30 animate-kds-warning' : ''
      } ${status === 'ready' ? 'opacity-80' : ''}`}
      data-item-id={item.id}
    >
      {/* Top row: Table/Type badge + SERVE/PACK + Order# + Timer */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {flatItem.orderType === 'takeaway' ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 text-white font-bold text-sm">
              🥡 PACK
            </span>
          ) : (
            <>
              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-slate-700 text-white font-bold text-base min-w-[44px] text-center">
                {tableName || '—'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-700 text-white font-bold text-sm">
                🍽️ SERVE
              </span>
            </>
          )}
          {flatItem.priority === 'vip' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-600 text-white font-bold text-xs animate-pulse">
              ⭐ VIP
            </span>
          )}
          {flatItem.priority === 'rush' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-600 text-white font-bold text-xs">
              🔥 RUSH
            </span>
          )}
          <span className="text-xs text-slate-400 font-mono">
            #{orderNumber}
          </span>
          {flatItem.roundNumber > 1 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-900/60 text-purple-300 border border-purple-700/50">
              R{flatItem.roundNumber}
            </span>
          )}
        </div>
        <KDSTimer
          startTime={item.createdAt || orderCreatedAt}
          preparationStartTime={status === 'preparing' ? item.preparationStartedAt : null}
        />
      </div>

      {/* Item name + quantity */}
      <div className="flex items-baseline gap-2 mb-1">
        {item.menuItemEmoji && (
          <span className="text-xl">{item.menuItemEmoji}</span>
        )}
        <span className="text-lg font-bold text-white leading-tight flex-1">
          {item.name}
        </span>
        <span className="text-2xl font-black text-white">
          ×{item.quantity}
        </span>
      </div>

      {/* Modifiers */}
      {item.modifierSelections && item.modifierSelections.length > 0 && (
        <div className="text-xs text-slate-400 mb-1">
          {item.modifierSelections.map((m) => m.name).join(', ')}
        </div>
      )}

      {/* Removed ingredients */}
      {item.removedIngredients && (
        <RemovedIngredients raw={item.removedIngredients} />
      )}

      {/* Special instructions */}
      {item.specialInstructions && (
        <div className="flex items-start gap-1.5 mt-1.5 rounded bg-orange-500/15 border border-orange-500/20 p-2">
          <AlertCircle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
          <span className="text-sm text-orange-300 font-medium">
            {item.specialInstructions}
          </span>
        </div>
      )}

      {/* Overdue / Warning badges */}
      {isOverdue && (
        <div className="mt-2">
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 border text-xs font-bold">
            OVERDUE
          </Badge>
        </div>
      )}
      {isWarning && !isOverdue && (
        <div className="mt-2">
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border text-xs font-bold">
            SLOW
          </Badge>
        </div>
      )}

      {/* DONE countdown */}
      {status === 'ready' && flatItem.readyAt && (
        <div className="mt-2 flex items-center gap-1">
          <DoneCountdown readyAt={flatItem.readyAt} />
        </div>
      )}

      {/* BIG ACTION BUTTON */}
      {(status === 'pending' || status === 'preparing') && (
        <button
          onClick={handleAction}
          className={`w-full mt-3 h-14 rounded-lg text-lg font-bold tracking-wide transition-all active:scale-[0.97] ${
            status === 'pending'
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {status === 'pending' ? (
              <>
                <Play className="h-5 w-5" />
                {t('kitchen.start', 'START')}
              </>
            ) : (
              <>
                <Check className="h-5 w-5" />
                {t('kitchen.ready', 'DONE')}
              </>
            )}
          </span>
        </button>
      )}

      {/* Phase R3: 86'd button — marks the item as unavailable + cancels this order item */}
      {(status === 'pending' || status === 'preparing') && onEightySix && item.menuItemId && (
        <button
          onClick={() => onEightySix(item.id, item.menuItemId, item.name, flatItem.orderId, flatItem.branchId)}
          className="w-full mt-1.5 h-8 rounded-lg text-xs font-bold tracking-wide transition-all active:scale-[0.97] bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-800/40"
          title="86'd — mark item as unavailable and cancel this order item"
        >
          <span className="flex items-center justify-center gap-1.5">
            <Ban className="h-3.5 w-3.5" />
            86'd
          </span>
        </button>
      )}
    </div>
  );
}

// ============================================================
// AggregatedItemCard — for "by item" view mode
// ============================================================

function AggregatedItemCard({
  agg,
  restaurantId,
  onOptimisticUpdate,
  t,
}: {
  agg: AggregatedItem;
  restaurantId: string;
  onOptimisticUpdate: (itemId: string, newStatus: KitchenItemStatus, orderId: string) => void;
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string;
}) {
  const stationIcon = getStationIcon(agg.stationType);

  const hasPending = agg.items.some((fi) => fi.item.kitchenStatus === 'pending');
  const hasPreparing = agg.items.some((fi) => fi.item.kitchenStatus === 'preparing');

  // Group by table for display
  const tableGroups = useMemo(() => {
    const groups = new Map<string, FlatKitchenItem[]>();
    for (const fi of agg.items) {
      const key = fi.tableName || '—';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(fi);
    }
    return groups;
  }, [agg.items]);

  const handleStartAll = () => {
    for (const fi of agg.items) {
      if (fi.item.kitchenStatus === 'pending') {
        onOptimisticUpdate(fi.item.id, 'preparing', fi.orderId);
      }
    }
  };

  const handleDoneAll = () => {
    for (const fi of agg.items) {
      if (fi.item.kitchenStatus === 'preparing') {
        onOptimisticUpdate(fi.item.id, 'ready', fi.orderId);
      }
    }
  };

  return (
    <div className="rounded-lg border-l-4 border-l-yellow-500 bg-slate-800 p-3 shadow-lg">
      {/* Item name + All Day count */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-lg">{stationIcon}</span>
        <span className="text-lg font-bold text-white flex-1">{agg.name}</span>
        <span className="text-2xl font-black text-yellow-400">×{agg.totalCount}</span>
      </div>

      {/* Table breakdown */}
      <div className="space-y-1 mb-2">
        {Array.from(tableGroups.entries()).map(([tableName, items]) => (
          <div key={tableName} className="flex items-center gap-2 text-sm">
            <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-white font-bold text-xs min-w-[32px] text-center ${items[0]?.orderType === 'takeaway' ? 'bg-amber-600' : 'bg-slate-700'}`}>
              {items[0]?.orderType === 'takeaway' ? '🥡 TAKEAWAY' : tableName}
            </span>
            <span className="text-slate-400">
              {items.length}× {items.map((fi) => `#${fi.orderNumber}`).join(', ')}
            </span>
          </div>
        ))}
      </div>

      {/* Start All / Done All */}
      {hasPending && (
        <button
          onClick={handleStartAll}
          className="w-full mt-1 h-12 rounded-lg text-base font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2"
        >
          <Play className="h-4 w-4" />
          {t('kitchen.start', 'START')} ALL ({agg.items.filter((fi) => fi.item.kitchenStatus === 'pending').length})
        </button>
      )}
      {hasPreparing && (
        <button
          onClick={handleDoneAll}
          className="w-full mt-1 h-12 rounded-lg text-base font-bold bg-green-500 hover:bg-green-600 text-white transition-all active:scale-[0.97] flex items-center justify-center gap-2"
        >
          <Check className="h-4 w-4" />
          {t('kitchen.ready', 'DONE')} ALL ({agg.items.filter((fi) => fi.item.kitchenStatus === 'preparing').length})
        </button>
      )}
    </div>
  );
}

// ============================================================
// Sound Alert Hook
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
// Fullscreen Hook — uses Fullscreen API when available
// ============================================================

function useFullscreenMode() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fallback: just toggle the visual state
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  return { isFullscreen, toggleFullscreen };
}

// ============================================================
// Main KitchenDisplay Component
// ============================================================

export function KitchenDisplay() {
  const { kitchenStation, setKitchenStation, user, selectedBranchId, setSelectedBranchId: setGlobalBranchId, branchChangeVersion } = useAppStore();
  const restaurantId = user?.restaurantId || '';
  const { t } = useI18n(restaurantId);
  const { printTicket } = useKitchenTicketPrinter(restaurantId);

  // ── State ───────────────────────────────────────────────────
  const [orders, setOrders] = useState<KitchenOrderData[]>([]);
  const [stations, setStations] = useState<KitchenStationData[]>([]);
  const [kitchenBranches, setKitchenBranches] = useState<{id: string; name: string; isMainBranch: boolean}[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [kdsMode, setKdsMode] = useState(false); // full-screen KDS overlay
  const [viewMode, setViewMode] = useState<'by_order' | 'by_item'>('by_order');
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const previousOrderIdsRef = useRef<Set<string>>(new Set());
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, KitchenItemStatus>>(new Map());
  const readyTimestampsRef = useRef<Map<string, number>>(new Map()); // itemId → timestamp when moved to ready
  const urgentCheckRef = useRef<NodeJS.Timeout | null>(null);

  const { toggleFullscreen } = useFullscreenMode();
  const { playIfActive } = useSoundAlerts(soundEnabled);

  // ── Branch change handler (DOM event + store version) ──────
  // This is the PRIMARY mechanism to re-fetch data when branch changes.
  // It uses a custom DOM event + store version counter, which is more
  // reliable than useEffect deps alone for cross-component updates.
  // The ref lets the callback call fetchOrders/fetchStations even though
  // they're defined later in the component.
  const fetchOrdersRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchStationsRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[KitchenDisplay] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setOrders([]);
    setStations([]);
    previousOrderIdsRef.current = new Set();
    // Directly trigger fetch — don't wait for useEffect
    fetchOrdersRef.current?.();
    fetchStationsRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // ── Persist KDS mode preference ─────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('kds_fullscreen');
    if (saved === 'true') setKdsMode(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('kds_fullscreen', String(kdsMode));
  }, [kdsMode]);

  // ── Fetch Orders ────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      // Read selectedBranchId from store at call time to avoid stale closures
      const currentBranchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = { status: 'active' };
      if (currentBranchId) params.branchId = currentBranchId;
      console.log('[KitchenDisplay] fetchOrders called, branchId:', currentBranchId, 'params:', params);
      const res = await api.get<{ data: KitchenOrderData[] }>(
        `/api/restaurants/${restaurantId}/orders`,
        params
      );
      const allOrders = res.data || [];
      const kitchenOrders = allOrders.filter(
        (o) =>
          o.status === 'pending' ||
          o.status === 'accepted' ||
          o.status === 'preparing' ||
          o.status === 'ready' ||
          o.status === 'picked_up'
      );

      // Detect new orders
      const currentIds = new Set(kitchenOrders.map((o) => o.id));
      const hasNew = kitchenOrders.some((o) => !previousOrderIdsRef.current.has(o.id));

      if (hasNew && previousOrderIdsRef.current.size > 0) {
        playIfActive(playNewOrderSound);
        setNewOrderFlash(true);
        setTimeout(() => setNewOrderFlash(false), 5000);
      }

      previousOrderIdsRef.current = currentIds;
      setOrders(kitchenOrders);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId, playIfActive]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchOrdersRef.current = fetchOrders; }, [fetchOrders]);

  // ── Fetch Stations ──────────────────────────────────────────
  const fetchStations = useCallback(async () => {
    if (!restaurantId) return;
    try {
      // Read selectedBranchId from store at call time to avoid stale closures
      const currentBranchId = useAppStore.getState().selectedBranchId;
      const params: Record<string, string> = { isActive: 'true' };
      if (currentBranchId) params.branchId = currentBranchId;
      const res = await api.get<{ data: KitchenStationData[] }>(
        `/api/restaurants/${restaurantId}/kitchen-stations`,
        params
      );
      setStations(res.data || []);
    } catch {
      // silently handle
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchStationsRef.current = fetchStations; }, [fetchStations]);

  // ── Fetch Branches for in-KDS branch selector ──────────────
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
    console.log('[KitchenDisplay] branch changed to:', selectedBranchId);
    setLoading(true);
    setOrders([]);
    setStations([]);
    previousOrderIdsRef.current = new Set();
  }, [selectedBranchId]);

  // ── Real-time Connection ────────────────────────────────────
  const [authToken, setAuthToken] = useState<string | undefined>();
  useEffect(() => {
    setAuthToken(localStorage.getItem('yeneqr_token') || undefined);
  }, []);

  useRealtime({
    restaurantId,
    token: authToken,
    enabled: !!restaurantId,
    onEvent: (event) => {
      if (event.type === 'new_order') {
        if (soundEnabled) playNewOrderSound();
        setNewOrderFlash(true);
        setTimeout(() => setNewOrderFlash(false), 5000);
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

  // ── Initial load ────────────────────────────────────────────
  useEffect(() => {
    fetchOrders();
    fetchStations();
  }, [fetchOrders, fetchStations, selectedBranchId, branchChangeVersion]);

  // ── Auto-refresh every 30s ──────────────────────────────────
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders, selectedBranchId, branchChangeVersion]);

  // ── Urgent check (overdue items) ────────────────────────────
  useEffect(() => {
    const check = () => {
      const now = new Date().getTime();
      let hasOverdue = false;
      let hasWarning = false;
      for (const order of orders) {
        for (const item of order.items || []) {
          const effectiveStatus = optimisticUpdates.get(item.id) || item.kitchenStatus;
          if (effectiveStatus === 'pending' || effectiveStatus === 'preparing') {
            const start = new Date(item.preparationStartedAt || item.createdAt || order.createdAt).getTime();
            const elapsed = now - start;
            if (elapsed >= 20 * 60 * 1000) {
              hasOverdue = true;
            } else if (elapsed >= 10 * 60 * 1000) {
              hasWarning = true;
            }
          }
        }
      }
      if (hasOverdue) {
        playUrgentSound();
      } else if (hasWarning) {
        // Less aggressive sound for warning-level
        playNewOrderSound();
      }
    };
    // Check every 30s — more frequent than before
    urgentCheckRef.current = setInterval(check, 30000);
    return () => {
      if (urgentCheckRef.current) clearInterval(urgentCheckRef.current);
    };
  }, [orders, optimisticUpdates]);

  // ── Station Resolution ──────────────────────────────────────
  const itemStationMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const order of orders) {
      for (const item of order.items || []) {
        map.set(item.id, resolveItemStation(item, stations));
      }
    }
    return map;
  }, [orders, stations]);

  // ── Flatten items with order context ────────────────────────
  const flatItems = useMemo(() => {
    const result: FlatKitchenItem[] = [];
    for (const order of orders) {
      for (const item of order.items || []) {
        const effectiveStatus = optimisticUpdates.get(item.id) || item.kitchenStatus;
        // Only show kitchen-active items
        if (effectiveStatus === 'served' || effectiveStatus === 'cancelled') continue;

        const stationId = itemStationMap.get(item.id) || null;
        const stationType = stationId
          ? (stations.find((s) => s.id === stationId)?.type || autoAssignStationType(item.categoryName))
          : autoAssignStationType(item.categoryName);

        // Track ready timestamps
        const existingReadyAt = readyTimestampsRef.current.get(item.id) || null;
        let readyAt: number | null = existingReadyAt;
        if (effectiveStatus === 'ready' && !readyAt) {
          readyAt = Date.now();
          readyTimestampsRef.current.set(item.id, readyAt);
        } else if (effectiveStatus !== 'ready' && readyAt) {
          readyTimestampsRef.current.delete(item.id);
          readyAt = null;
        }

        // Auto-hide: skip items that have been ready for >30s
        if (effectiveStatus === 'ready' && readyAt && Date.now() - readyAt > 30_000) {
          continue;
        }

        result.push({
          item: { ...item, kitchenStatus: effectiveStatus },
          orderId: order.id,
          orderNumber: order.orderNumber,
          tableName: order.table ? `${order.table.number}` : (order.type === 'takeaway' ? 'TAKEAWAY' : '—'),
          orderCreatedAt: order.createdAt,
          priority: (order as any).priority || 'normal',
          roundNumber: item.roundNumber || (order as any).roundNumber || 1,
          stationId,
          stationType,
          readyAt,
          orderType: order.type || 'dine_in',
        });
      }
    }
    return result;
  }, [orders, stations, itemStationMap, optimisticUpdates]);

  // ── Station-filtered items ──────────────────────────────────
  const filteredItems = useMemo(() => {
    if (kitchenStation === 'all') return flatItems;
    return flatItems.filter((fi) => fi.stationId === kitchenStation);
  }, [flatItems, kitchenStation]);

  // ── Categorize into columns ─────────────────────────────────
  const newItems = useMemo(() =>
    filteredItems
      .filter((fi) => fi.item.kitchenStatus === 'pending')
      .sort((a, b) => {
        // Priority sorting: vip > rush > normal, then by time
        const priorityOrder = { vip: 0, rush: 1, normal: 2 }
        const aP = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2
        const bP = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2
        if (aP !== bP) return aP - bP
        return new Date(a.orderCreatedAt).getTime() - new Date(b.orderCreatedAt).getTime()
      }),
    [filteredItems]
  );

  const firingItems = useMemo(() =>
    filteredItems
      .filter((fi) => fi.item.kitchenStatus === 'preparing')
      .sort((a, b) => {
        const aStart = a.item.preparationStartedAt || a.orderCreatedAt;
        const bStart = b.item.preparationStartedAt || b.orderCreatedAt;
        return new Date(aStart).getTime() - new Date(bStart).getTime();
      }),
    [filteredItems]
  );

  const doneItems = useMemo(() =>
    filteredItems
      .filter((fi) => fi.item.kitchenStatus === 'ready')
      .sort((a, b) => (a.readyAt || 0) - (b.readyAt || 0)),
    [filteredItems]
  );

  // ── All Day Aggregation ─────────────────────────────────────
  const aggregatedItems = useMemo(() => {
    const activeItems = filteredItems.filter(
      (fi) => fi.item.kitchenStatus === 'pending' || fi.item.kitchenStatus === 'preparing'
    );
    const groups = new Map<string, AggregatedItem>();
    for (const fi of activeItems) {
      const key = fi.item.name;
      if (!groups.has(key)) {
        groups.set(key, {
          name: fi.item.name,
          emoji: fi.item.menuItemEmoji || null,
          totalCount: 0,
          stationType: fi.stationType,
          items: [],
        });
      }
      const group = groups.get(key)!;
      group.totalCount += fi.item.quantity;
      group.items.push(fi);
    }
    return Array.from(groups.values()).sort((a, b) => b.totalCount - a.totalCount);
  }, [filteredItems]);

  // ── Station counts for summary bar ──────────────────────────
  const stationCounts = useMemo(() => {
    const counts: Record<string, { name: string; type: string; count: number }> = {};
    for (const fi of filteredItems) {
      if (fi.item.kitchenStatus === 'pending' || fi.item.kitchenStatus === 'preparing') {
        const key = fi.stationId || fi.stationType;
        if (!counts[key]) {
          const station = stations.find((s) => s.id === fi.stationId);
          counts[key] = {
            name: station?.name || fi.stationType,
            type: fi.stationType,
            count: 0,
          };
        }
        counts[key].count += fi.item.quantity;
      }
    }
    return Object.values(counts);
  }, [filteredItems, stations]);

  // ── Optimistic Update Handler ───────────────────────────────
  const handleOptimisticUpdate = useCallback(
    (itemId: string, newStatus: KitchenItemStatus, orderId: string) => {
      // Immediately update local state
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.set(itemId, newStatus);
        return next;
      });

      // Track ready timestamp
      if (newStatus === 'ready') {
        readyTimestampsRef.current.set(itemId, Date.now());
        playOrderReadySound();
      }

      // Fire and forget API call — rollback on failure
      api
        .patch(
          `/api/restaurants/${restaurantId}/orders/${orderId}/items/${itemId}`,
          { kitchenStatus: newStatus }
        )
        .then(() => {
          // Clear optimistic state (the next fetchOrders will confirm)
          setOptimisticUpdates((prev) => {
            const next = new Map(prev);
            next.delete(itemId);
            return next;
          });
          fetchOrders();
        })
        .catch(() => {
          // Rollback
          const originalItem = orders
            .find((o) => o.id === orderId)
            ?.items?.find((i) => i.id === itemId);
          if (originalItem) {
            setOptimisticUpdates((prev) => {
              const next = new Map(prev);
              next.delete(itemId);
              return next;
            });
            if (newStatus === 'ready') {
              readyTimestampsRef.current.delete(itemId);
            }
          }
          toast.error('Update failed — please try again');
        });
    },
    [restaurantId, orders, fetchOrders]
  );

  // Phase R3: 86'd handler — cancels the order item + marks the menu item unavailable
  const handleEightySix = useCallback(
    async (itemId: string, menuItemId: string | null, itemName: string, orderId: string, branchId?: string) => {
      if (!menuItemId) {
        toast.error('Cannot 86 this item — no menu item linked');
        return;
      }

      // Optimistically remove the item from the KDS
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.set(itemId, 'cancelled');
        return next;
      });

      try {
        // 1. Cancel the order item (kitchenStatus = cancelled)
        await api.patch(
          `/api/restaurants/${restaurantId}/orders/${orderId}/items/${itemId}`,
          { kitchenStatus: 'cancelled' }
        );

        // 2. Mark the menu item as unavailable via branch override (branch-scoped 86'd)
        // Uses the branch-overrides API so it only 86's at THIS branch, not restaurant-wide
        if (branchId) {
          await api.put(
            `/api/restaurants/${restaurantId}/items/${menuItemId}/branch-overrides`,
            { branchId, isAvailable: false, notes: `86'd from kitchen at ${new Date().toLocaleTimeString()}` }
          );
        } else {
          // Fallback: restaurant-wide 86'd if no branch context
          await api.put(
            `/api/restaurants/${restaurantId}/items/${menuItemId}`,
            { isAvailable: false }
          );
        }

        toast.success(`86'd: ${itemName} — marked unavailable and order item cancelled`);

        // Clear optimistic state + refresh
        setOptimisticUpdates((prev) => {
          const next = new Map(prev);
          next.delete(itemId);
          return next;
        });
        fetchOrders();
      } catch {
        // Rollback optimistic update
        setOptimisticUpdates((prev) => {
          const next = new Map(prev);
          next.delete(itemId);
          return next;
        });
        toast.error('Failed to 86 item — please try again');
      }
    },
    [restaurantId, fetchOrders]
  );

  // ── Keyboard Shortcuts ──────────────────────────────────────
  const allActiveItems = useMemo(() => {
    return [...newItems, ...firingItems];
  }, [newItems, firingItems]);

  const handleKeyboardSpace = useCallback(() => {
    if (!focusedItemId) {
      const firstPending = allActiveItems.find((fi) => fi.item.kitchenStatus === 'pending');
      if (firstPending) setFocusedItemId(firstPending.item.id);
      return;
    }
    const focused = allActiveItems.find((fi) => fi.item.id === focusedItemId);
    if (focused && focused.item.kitchenStatus === 'pending') {
      handleOptimisticUpdate(focused.item.id, 'preparing', focused.orderId);
    }
  }, [focusedItemId, allActiveItems, handleOptimisticUpdate]);

  const handleKeyboardEnter = useCallback(() => {
    if (!focusedItemId) return;
    const focused = allActiveItems.find((fi) => fi.item.id === focusedItemId);
    if (focused && focused.item.kitchenStatus === 'preparing') {
      handleOptimisticUpdate(focused.item.id, 'ready', focused.orderId);
      // Move focus to next item
      const idx = allActiveItems.findIndex((fi) => fi.item.id === focusedItemId);
      if (idx < allActiveItems.length - 1) {
        setFocusedItemId(allActiveItems[idx + 1].item.id);
      } else {
        setFocusedItemId(null);
      }
    }
  }, [focusedItemId, allActiveItems, handleOptimisticUpdate]);

  const handleKeyboardEscape = useCallback(() => {
    setFocusedItemId(null);
  }, []);

  useKitchenKeyboardShortcuts({
    onSpace: handleKeyboardSpace,
    onEnter: handleKeyboardEnter,
    onEscape: handleKeyboardEscape,
    enabled: kdsMode,
  });

  // ── Column header component ────────────────────────────────
  const ColumnHeader = ({
    title,
    count,
    accent,
    flash,
  }: {
    title: string;
    count: number;
    accent: string;
    flash?: boolean;
  }) => (
    <div
      className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${accent} ${
        flash ? 'animate-pulse' : ''
      }`}
    >
      <h2 className="text-base font-bold tracking-wide uppercase">{title}</h2>
      <span className="inline-flex items-center justify-center min-w-[28px] h-7 rounded-full bg-white/20 text-white font-bold text-sm">
        {count}
      </span>
    </div>
  );

  // ── Loading state ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="text-sm">{t('kitchen.loading', 'Loading kitchen...')}</span>
        </div>
      </div>
    );
  }

  // ── KDS Content (shared between normal and fullscreen) ──────
  const kdsContent = (
    <div className="flex flex-col h-full bg-slate-900 text-white">
      {/* ── Top Bar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 border-b border-slate-800 shrink-0">
        {/* Branch Selector (syncs with global header) */}
        {kitchenBranches.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors bg-slate-800 text-emerald-400 hover:text-white hover:bg-slate-700 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {kitchenBranches.find(b => b.id === selectedBranchId)?.name || 'Branch'}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-slate-800 border-slate-700">
              {kitchenBranches.map((branch) => (
                <DropdownMenuItem
                  key={branch.id}
                  onClick={() => setGlobalBranchId(branch.id)}
                  className={selectedBranchId === branch.id ? 'bg-slate-700 text-emerald-400' : 'text-slate-300'}
                >
                  {branch.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Station Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 scrollbar-hide">
          <button
            onClick={() => setKitchenStation('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              kitchenStation === 'all'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {t('kitchen.all_stations', 'All')}
          </button>
          {stations.map((station) => {
            const stationItemCount = filteredItems.filter(
              (fi) => fi.stationId === station.id && (fi.item.kitchenStatus === 'pending' || fi.item.kitchenStatus === 'preparing')
            ).length;
            return (
              <button
                key={station.id}
                onClick={() => setKitchenStation(station.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                  kitchenStation === station.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{getStationIcon(station.type)}</span>
                {station.name}
                {stationItemCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-orange-500 text-white text-[10px] font-bold">
                    {stationItemCount}
                  </span>
                )}
              </button>
            );
          })}
          {/* Virtual station tabs when no real stations */}
          {stations.length === 0 && Object.entries(
            filteredItems.reduce((acc, fi) => {
              if (fi.item.kitchenStatus === 'pending' || fi.item.kitchenStatus === 'preparing') {
                acc[fi.stationType] = (acc[fi.stationType] || 0) + fi.item.quantity;
              }
              return acc;
            }, {} as Record<string, number>)
          ).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setKitchenStation(type)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
                kitchenStation === type
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{getStationIcon(type)}</span>
              {type}
              {count > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-orange-500 text-white text-[10px] font-bold">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Order Type Counts — Dine-in vs Takeaway */}
        {(() => {
          const dineInCount = filteredItems.filter((fi) => fi.orderType !== 'takeaway' && (fi.item.kitchenStatus === 'pending' || fi.item.kitchenStatus === 'preparing')).length;
          const takeawayCount = filteredItems.filter((fi) => fi.orderType === 'takeaway' && (fi.item.kitchenStatus === 'pending' || fi.item.kitchenStatus === 'preparing')).length;
          return (dineInCount > 0 || takeawayCount > 0) ? (
            <div className="flex items-center gap-2 shrink-0">
              {dineInCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700 text-white text-xs font-bold">
                  🍽️ {dineInCount} SERVE
                </span>
              )}
              {takeawayCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-600 text-white text-xs font-bold">
                  🥡 {takeawayCount} PACK
                </span>
              )}
            </div>
          ) : null;
        })()}

        {/* View Mode Toggle */}
        <button
          onClick={() => setViewMode((v) => (v === 'by_order' ? 'by_item' : 'by_order'))}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors whitespace-nowrap"
        >
          {viewMode === 'by_order' ? '📋 By Order' : '🔥 By Item'}
        </button>

        {/* Sound Toggle */}
        <button
          onClick={() => setSoundEnabled((v) => !v)}
          className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={soundEnabled ? t('kitchen.sound_on', 'Sound On') : t('kitchen.sound_off', 'Sound Off')}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>

        {/* Refresh */}
        <button
          onClick={() => fetchOrders()}
          className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Phase R5: Print all active kitchen tickets */}
        <button
          onClick={() => {
            // Print the most recent active order's ticket
            const activeOrders = orders.filter((o) =>
              o.items.some((i) => i.kitchenStatus === 'pending' || i.kitchenStatus === 'preparing')
            );
            if (activeOrders.length > 0) {
              printTicket(activeOrders[0].id);
            } else {
              toast.info('No active orders to print');
            }
          }}
          className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Print kitchen ticket for the most recent active order"
        >
          <Printer className="h-4 w-4" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={() => {
            toggleFullscreen();
            setKdsMode((v) => !v);
          }}
          className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={kdsMode ? 'Exit Full Screen' : 'Full Screen KDS'}
        >
          {kdsMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* ── All Day Summary Bar ──────────────────────────────── */}
      {stationCounts.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-slate-950/60 border-b border-slate-800 shrink-0 overflow-x-auto scrollbar-hide">
          <span className="text-sm font-bold text-slate-300 whitespace-nowrap">🔥 All Day:</span>
          {stationCounts.map((sc) => (
            <span
              key={sc.name}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 text-sm whitespace-nowrap"
            >
              <span>{getStationIcon(sc.type)}</span>
              <span className="text-slate-300">{sc.name}:</span>
              <span className="font-bold text-white">{sc.count}</span>
              <span className="text-slate-500 text-xs">{sc.count === 1 ? 'item' : 'items'}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Main Content Area ────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'by_item' ? (
          /* ── By Item View ──────────────────────────────────── */
          <div className="h-full overflow-y-auto p-3 space-y-2 custom-scrollbar-dark">
            {aggregatedItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-lg">{t('kitchen.no_orders', 'No active kitchen orders')}</p>
                </div>
              </div>
            ) : (
              aggregatedItems.map((agg) => (
                <AggregatedItemCard
                  key={agg.name}
                  agg={agg}
                  restaurantId={restaurantId}
                  onOptimisticUpdate={handleOptimisticUpdate}
                  t={t}
                />
              ))
            )}
          </div>
        ) : (
          /* ── 3-Column Kanban View ──────────────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 sm:gap-0 h-full">
            {/* NEW Column */}
            <div className="flex flex-col sm:border-r border-slate-800 border-b sm:border-b-0">
              <ColumnHeader
                title="NEW"
                count={newItems.length}
                accent="bg-yellow-600"
                flash={newOrderFlash}
              />
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar-dark bg-slate-900/50">
                {newItems.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
                    No new items
                  </div>
                ) : (
                  newItems.map((fi) => (
                    <KitchenItemCard
                      key={fi.item.id}
                      flatItem={fi}
                      restaurantId={restaurantId}
                      onOptimisticUpdate={handleOptimisticUpdate}
                      onEightySix={handleEightySix}
                      t={t}
                    />
                  ))
                )}
              </div>
            </div>

            {/* FIRING Column */}
            <div className="flex flex-col sm:border-r border-slate-800 border-b sm:border-b-0">
              <ColumnHeader
                title="FIRING"
                count={firingItems.length}
                accent="bg-orange-600"
              />
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar-dark bg-slate-900/50">
                {firingItems.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
                    Nothing firing
                  </div>
                ) : (
                  firingItems.map((fi) => (
                    <KitchenItemCard
                      key={fi.item.id}
                      flatItem={fi}
                      restaurantId={restaurantId}
                      onOptimisticUpdate={handleOptimisticUpdate}
                      onEightySix={handleEightySix}
                      t={t}
                    />
                  ))
                )}
              </div>
            </div>

            {/* DONE Column */}
            <div className="flex flex-col">
              <ColumnHeader
                title="DONE"
                count={doneItems.length}
                accent="bg-green-600"
              />
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar-dark bg-slate-900/50">
                {doneItems.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
                    Nothing done yet
                  </div>
                ) : (
                  doneItems.map((fi) => (
                    <KitchenItemCard
                      key={fi.item.id}
                      flatItem={fi}
                      restaurantId={restaurantId}
                      onOptimisticUpdate={handleOptimisticUpdate}
                      t={t}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Keyboard Shortcut Hint (bottom bar) ──────────────── */}
      {kdsMode && (
        <div className="flex items-center justify-center gap-6 px-3 py-1.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-500 shrink-0">
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">Space</kbd> Start</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">Enter</kbd> Done</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">Esc</kbd> Deselect</span>
          <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400 font-mono">F</kbd> Full Screen</span>
        </div>
      )}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────
  // In KDS full-screen mode, we overlay the entire viewport
  if (kdsMode) {
    return (
      <div className="fixed inset-0 z-50">
        {kdsContent}
      </div>
    );
  }

  // In normal dashboard mode, render as a panel with a KDS toggle button
  return (
    <div className="relative h-full">
      {/* KDS Mode Toggle — top right */}
      <div className="absolute top-0 right-0 z-10">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
          onClick={() => {
            setKdsMode(true);
            toggleFullscreen();
          }}
        >
          <Maximize2 className="h-4 w-4" />
          Full Screen KDS
        </Button>
      </div>

      {/* KDS Content (same component, no overlay) */}
      <div className="h-[calc(100vh-10rem)] rounded-xl overflow-hidden border border-slate-800">
        {kdsContent}
      </div>
    </div>
  );
}
