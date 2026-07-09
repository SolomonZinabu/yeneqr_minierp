'use client';

// ============================================================
// Yene QR — Waiter Dashboard View
// ============================================================
// Shows waiters their assigned tables, orders ready for pickup,
// active deliveries, and waiter calls — all in real-time.

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
import { api } from '@/lib/api-client';
import { useBranchChange } from '@/hooks/use-branch-change';
import { formatCents } from '@/lib/money';
import { useRealtime } from '@/lib/use-realtime';
import { playNewOrderSound, playOrderReadySound } from '@/lib/sounds';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  HandMetal,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  AlertCircle,
  MessageSquare,
  Receipt,
  Users,
  ClipboardList,
  Scale,
  Zap,
  ArrowRightLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission, PERMISSIONS } from '@/lib/auth';
import { StaffOrderForm } from '@/components/dashboard/staff-order-form';
import { useI18n } from '@/hooks/useI18n';

type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'served' | 'completed' | 'cancelled';

interface OrderItemData {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  priceCents: number;
  specialInstructions?: string | null;
  kitchenStatus: string;
  menuItemImage?: string | null;
}

interface WaiterOrderData {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  tableId: string;
  type?: string; // 'dine_in' or 'takeaway'
  specialInstructions?: string | null;
  createdAt: string;
  totalAmountCents: number;
  table?: { id: string; number: string | number } | null;
  items?: OrderItemData[];
}

interface WaiterCallData {
  id: string;
  tableId: string;
  requestType: string;
  message?: string | null;
  status: string;
  createdAt: string;
  table?: { id: string; number: string | number } | null;
}

interface AssignmentData {
  id: string;
  userId: string;
  branchId: string;
  role: string;
  assignedTableIds: string[];
  user?: { id: string; name: string } | null;
}

interface WaiterWorkloadData {
  userId: string;
  name: string;
  phone: string | null;
  avatar: string | null;
  branchId: string;
  entryId?: string;
  shiftName?: string;
  assignedTableIds: string[];
  activeOrderCount: number;
  totalLoad: number;
}

interface WorkloadSummary {
  waiters: WaiterWorkloadData[];
  unassignedTables: { id: string; number: string | number }[];
  totalTables: number;
  assignedTables: number;
  source: 'shift' | 'staff_assignment';
}

const orderStatusConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType }> = {
  ready: { color: 'text-green-700 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800', icon: ShoppingBag },
  picked_up: { color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-800', icon: Truck },
  pending: { color: 'text-yellow-700 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800', icon: Clock },
  accepted: { color: 'text-cyan-700 dark:text-cyan-400', bgColor: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800', icon: CheckCircle2 },
  preparing: { color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', icon: UtensilsCrossed },
  served: { color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
};

function getElapsedMinutes(startTime: string): number {
  const start = new Date(startTime).getTime();
  const now = new Date().getTime();
  return Math.floor((now - start) / 60000);
}

function TimerBadge({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const update = () => {
      const start = new Date(startTime).getTime();
      const now = new Date().getTime();
      const diffMs = now - start;
      const mins = Math.floor(diffMs / 60000);
      setElapsed(`${mins}m`);
      setIsUrgent(mins >= 5); // 5 min = urgent for ready orders
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className={`text-xs font-mono ${isUrgent ? 'text-red-600 dark:text-red-400 font-bold' : 'text-muted-foreground'}`}>
      <Clock className="h-3 w-3 inline mr-0.5" />
      {elapsed}
    </span>
  );
}

// ─── Order Card for Waiter ──────────────────────────────────────

function WaiterOrderCard({
  order,
  restaurantId,
  onUpdated,
  highlight,
  t,
  getOrderStatusLabel,
}: {
  order: WaiterOrderData;
  restaurantId: string;
  onUpdated: () => void;
  highlight: boolean;
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string;
  getOrderStatusLabel: (status: string) => string;
}) {
  const [updating, setUpdating] = useState(false);
  const config = orderStatusConfig[order.status] || orderStatusConfig.pending;
  const ConfigIcon = config.icon;

  const isTakeaway = order.type === 'takeaway';
  const tableNum = isTakeaway ? 'TAKEAWAY' : (order.table ? String(order.table.number) : '—');
  const items = order.items || [];

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    try {
      setUpdating(true);
      await api.put(`/api/restaurants/${restaurantId}/orders/${order.id}`, {
        status: newStatus,
      });
      toast.success(newStatus === 'picked_up'
        ? (isTakeaway
          ? `Order ${order.orderNumber} is ready for customer pickup!`
          : `Picked up order ${order.orderNumber} — deliver to Table ${tableNum}!`)
        : (isTakeaway
          ? `Order ${order.orderNumber} handed over to customer!`
          : `Delivered order ${order.orderNumber} to Table ${tableNum}!`)
      );
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update';
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className={`border-2 ${config.bgColor} ${highlight ? 'animate-pulse-once' : ''}`}>
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.bgColor}`}>
              <ConfigIcon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                {order.orderNumber}
                <Badge variant="outline" className={`text-[10px] border-0 ${config.bgColor} ${config.color}`}>
                  {getOrderStatusLabel(order.status)}
                </Badge>
                <Badge variant="outline" className={`text-[10px] border-0 ${
                  isTakeaway
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {isTakeaway ? '🥡 Takeaway' : '🍽️ Dine-in'}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isTakeaway ? (
                  <span className="font-bold text-amber-600 dark:text-amber-400">🥡 TAKEAWAY</span>
                ) : (
                  <>{t('dashboard.table_label', 'Table')} <span className="font-bold text-foreground">{tableNum}</span></>
                )}
                <span className="mx-1">·</span>
                {items.length} {items.length !== 1 ? t('kitchen.items', 'items') : t('kitchen.item', 'item')}
                <span className="mx-1">·</span>
                {formatCents(order.totalAmountCents)}
              </p>
            </div>
          </div>
          <TimerBadge startTime={order.createdAt} />
        </div>
        {order.specialInstructions && (
          <div className="flex items-start gap-1 mt-1 rounded bg-yellow-50 dark:bg-yellow-900/20 p-1.5">
            <AlertCircle className="h-3 w-3 text-yellow-600 shrink-0 mt-0.5" />
            <span className="text-[11px] text-yellow-700 dark:text-yellow-300">{order.specialInstructions}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {/* Items summary */}
        <div className="space-y-1">
          {items.slice(0, 4).map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs">
              <span className="truncate">{item.name} x{item.quantity}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">{item.kitchenStatus}</Badge>
            </div>
          ))}
          {items.length > 4 && (
            <p className="text-[10px] text-muted-foreground">+{items.length - 4} more items</p>
          )}
        </div>

        {/* Action Buttons */}
        {order.status === 'ready' && (
          <Button
            className={`w-full text-white gap-2 ${isTakeaway ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={() => handleStatusUpdate('picked_up')}
            disabled={updating}
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : isTakeaway ? <ShoppingBag className="h-4 w-4" /> : <HandMetal className="h-4 w-4" />}
            {isTakeaway ? '🥡 Ready for Pickup' : `${t('waiter.pick_up_deliver', 'Pick Up & Deliver')} — ${t('dashboard.table_label', 'Table')} ${tableNum}`}
          </Button>
        )}
        {order.status === 'picked_up' && (
          <Button
            className={`w-full text-white gap-2 ${isTakeaway ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
            onClick={() => handleStatusUpdate('served')}
            disabled={updating}
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isTakeaway ? '✅ Handed Over to Customer' : `${t('waiter.mark_delivered', 'Mark Delivered')} — ${t('dashboard.table_label', 'Table')} ${tableNum}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Waiter Call Card ───────────────────────────────────────────

function WaiterCallCard({
  call,
  restaurantId,
  onUpdated,
  t,
}: {
  call: WaiterCallData;
  restaurantId: string;
  onUpdated: () => void;
  t: (key: string, fallbackOrParams?: string | Record<string, string | number>, params?: Record<string, string | number>) => string;
}) {
  const [updating, setUpdating] = useState(false);
  const tableNum = call.table ? String(call.table.number) : '—';

  const getRequestLabel = (requestType: string): { label: string; icon: React.ElementType } => {
    switch (requestType) {
      case 'call_waiter':
        return { label: t('waiter.call_waiter', 'Call Waiter'), icon: BellRing };
      case 'request_bill':
        return { label: t('waiter.request_bill', 'Request Bill'), icon: Receipt };
      case 'request_menu':
        return { label: t('waiter.request_menu', 'Request Menu'), icon: UtensilsCrossed };
      case 'custom':
        return { label: t('waiter.custom_request', 'Custom Request'), icon: MessageSquare };
      default:
        return { label: t('waiter.call_waiter', 'Call Waiter'), icon: BellRing };
    }
  };

  const { label, icon: CallIcon } = getRequestLabel(call.requestType);

  const handleAcknowledge = async () => {
    try {
      setUpdating(true);
      await api.put(`/api/restaurants/${restaurantId}/waiter-calls/${call.id}`, {
        status: 'acknowledged',
      });
      toast.success(`Acknowledged call from Table ${tableNum}`);
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to acknowledge';
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleResolve = async () => {
    try {
      setUpdating(true);
      await api.put(`/api/restaurants/${restaurantId}/waiter-calls/${call.id}`, {
        status: 'resolved',
      });
      toast.success(`Resolved call from Table ${tableNum}`);
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve';
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 shrink-0">
            <CallIcon className="h-4 w-4 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{label}</span>
              <Badge variant="outline" className="text-[10px]">
                {t('dashboard.table_label', 'Table')} {tableNum}
              </Badge>
            </div>
            {call.message && (
              <p className="text-xs text-muted-foreground truncate">{call.message}</p>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            {call.status === 'pending' && (
              <Button
                size="sm"
                className="h-7 text-xs bg-orange-600 hover:bg-orange-700"
                onClick={handleAcknowledge}
                disabled={updating}
              >
                {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {t('waiter.on_my_way', 'On My Way')}
              </Button>
            )}
            {call.status === 'acknowledged' && (
              <Button
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700"
                onClick={handleResolve}
                disabled={updating}
              >
                {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {t('waiter.resolved', 'Resolved')}
              </Button>
            )}
            {call.status === 'resolved' && (
              <Badge className="text-[10px] bg-green-100 text-green-700 border-0">{t('waiter.done', 'Done')}</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Waiter View ───────────────────────────────────────────

export function WaiterView() {
  const { user } = useAppStore();
  const selectedBranchId = useAppStore((s) => s.selectedBranchId);
  const branchChangeVersion = useAppStore((s) => s.branchChangeVersion);
  const restaurantId = user?.restaurantId || '';
  const userRole = user?.role || '';
  const { t } = useI18n(restaurantId);

  const [orders, setOrders] = useState<WaiterOrderData[]>([]);
  const [calls, setCalls] = useState<WaiterCallData[]>([]);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [workload, setWorkload] = useState<WorkloadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const previousReadyIdsRef = useRef<Set<string>>(new Set());

  const fetchOrdersRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchCallsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchAssignmentsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const fetchWorkloadRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[WaiterView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setOrders([]);
    setCalls([]);
    setAssignments([]);
    setWorkload(null);
    fetchOrdersRef.current?.();
    fetchCallsRef.current?.();
    fetchAssignmentsRef.current?.();
    fetchWorkloadRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  const assignedTableIds = assignments
    .filter((a) => a.userId === user?.id)
    .flatMap((a) => a.assignedTableIds);

  // Stable reference for useCallback dependencies — avoid re-creating on every render
  const assignedTableIdsKey = assignedTableIds.slice().sort().join(',')

  // ── Order Status Label Helper ─────────────────────────────
  const getOrderStatusLabel = useCallback(
    (status: string): string => {
      const map: Record<string, string> = {
        ready: t('waiter.ready_for_pickup', 'Ready for Pickup'),
        picked_up: t('waiter.on_its_way', 'On Its Way'),
        pending: t('order.status.pending', 'Pending'),
        accepted: t('waiter.accepted', 'Confirmed'),
        preparing: t('order.status.preparing', 'Preparing'),
        served: t('waiter.served', 'Served'),
      };
      return map[status] || status;
    },
    [t]
  );

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      // Phase 4.3: pass branchId to scope orders to the current branch.
      // Previously fetched ALL active orders restaurant-wide, then filtered
      // client-side by assigned table IDs — which meant a brief cross-branch
      // data flash before filtering, plus over-fetching.
      const branchId = useAppStore.getState().selectedBranchId;
      const res = await api.get<{ data: WaiterOrderData[] }>(`/api/restaurants/${restaurantId}/orders`, { status: 'active', ...(branchId ? { branchId } : {}) });
      const allOrders = res.data || [];

      // Filter to waiter-relevant statuses (in-progress + ready for action)
      const activeStatuses = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served']
      const waiterOrders = allOrders.filter(
        (o) => activeStatuses.includes(o.status)
      );

      // Filter by assigned tables (if assignments exist)
      const filtered = assignedTableIds.length > 0
        ? waiterOrders.filter((o) => assignedTableIds.includes(o.tableId))
        : waiterOrders; // If no assignments, show all

      // Detect new "ready" orders
      const currentReadyIds = new Set(
        filtered.filter((o) => o.status === 'ready').map((o) => o.id)
      );
      const newIds = new Set<string>();
      currentReadyIds.forEach((id) => {
        if (!previousReadyIdsRef.current.has(id)) {
          newIds.add(id);
        }
      });

      if (newIds.size > 0 && previousReadyIdsRef.current.size > 0) {
        setNewOrderIds(newIds);
        setTimeout(() => {
          setNewOrderIds((prev) => {
            const next = new Set(prev);
            newIds.forEach((id) => next.delete(id));
            return next;
          });
        }, 5000);
      }

      previousReadyIdsRef.current = currentReadyIds;
      setOrders(filtered);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [restaurantId, assignedTableIdsKey]); // Use stable key instead of .join() in deps

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchOrdersRef.current = fetchOrders; }, [fetchOrders]);

  const fetchCalls = useCallback(async () => {
    if (!restaurantId) return;
    try {
      // Phase 4.3: pass branchId to scope calls to the current branch.
      const branchId = useAppStore.getState().selectedBranchId;
      const res = await api.get<{ data: WaiterCallData[] }>(
        `/api/restaurants/${restaurantId}/waiter-calls`,
        { status: 'pending,acknowledged', ...(branchId ? { branchId } : {}) }
      );
      const allCalls = res.data || [];
      // Filter by assigned tables
      const filtered = assignedTableIds.length > 0
        ? allCalls.filter((c) => assignedTableIds.includes(c.tableId))
        : allCalls;
      setCalls(filtered);
    } catch {
      // Silently handle
    }
  }, [restaurantId, assignedTableIdsKey]); // Use stable key instead of .join() in deps

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchCallsRef.current = fetchCalls; }, [fetchCalls]);

  const fetchAssignments = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await api.get<{ data: AssignmentData[] }>(
        `/api/restaurants/${restaurantId}/staff-assignments`,
        { role: 'waiter' }
      );
      setAssignments(res.data || []);
    } catch {
      // Staff assignments may not be set up yet — that's fine
      setAssignments([]);
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchAssignmentsRef.current = fetchAssignments; }, [fetchAssignments]);

  const fetchWorkload = useCallback(async () => {
    const branchId = useAppStore.getState().selectedBranchId;
    if (!restaurantId || !branchId) return;
    try {
      const res = await api.get<{ data: WorkloadSummary }>(
        `/api/restaurants/${restaurantId}/waiter-assignments`,
        { branchId }
      );
      setWorkload(res.data || null);
    } catch {
      setWorkload(null);
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchWorkloadRef.current = fetchWorkload; }, [fetchWorkload]);

  const handleAutoAssign = async () => {
    const branchId = useAppStore.getState().selectedBranchId;
    if (!restaurantId || !branchId) return;
    try {
      setAutoAssigning(true);
      const res = await api.post<{ data: { assignmentsMade: number; changes: Array<{ waiterName: string; newTableIds: string[] }> } }>(
        `/api/restaurants/${restaurantId}/waiter-assignments`,
        { branchId }
      );
      const made = res.data?.assignmentsMade ?? 0;
      if (made > 0) {
        toast.success(`Auto-assigned ${made} unassigned table${made !== 1 ? 's' : ''} to least-busy waiters`);
      } else {
        toast.info('All tables are already assigned');
      }
      fetchWorkload();
      fetchAssignments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to auto-assign';
      toast.error(msg);
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleRebalance = async () => {
    const branchId = useAppStore.getState().selectedBranchId;
    if (!restaurantId || !branchId) return;
    try {
      setRebalancing(true);
      const res = await api.patch<{ data: { waitersAffected: number; changes: Array<{ waiterName: string; previousTableIds: string[]; newTableIds: string[] }> } }>(
        `/api/restaurants/${restaurantId}/waiter-assignments`,
        { branchId }
      );
      const affected = res.data?.waitersAffected ?? 0;
      if (affected > 0) {
        toast.success(`Rebalanced tables across ${affected} waiter${affected !== 1 ? 's' : ''}`);
      } else {
        toast.info('Tables are already evenly distributed');
      }
      fetchWorkload();
      fetchAssignments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to rebalance';
      toast.error(msg);
    } finally {
      setRebalancing(false);
    }
  };

  const [authToken, setAuthToken] = useState<string | undefined>()
  useEffect(() => { setAuthToken(localStorage.getItem('yeneqr_token') || undefined) }, [])

  // Real-time SSE connection
  const { connected: realtimeConnected } = useRealtime({
    restaurantId,
    token: authToken,
    enabled: !!restaurantId,
    onEvent: (event) => {
      if (event.type === 'waiter_order_ready') {
        // A new order is ready for pickup — refresh and play sound
        if (soundEnabled) playOrderReadySound();
        fetchOrders();
      }
      if (event.type === 'order_status_changed') {
        fetchOrders();
      }
      if (event.type === 'waiter_call') {
        if (soundEnabled) playNewOrderSound();
        fetchCalls();
      }
      if (event.type === 'new_order') {
        // A new order came in — kitchen will handle it, but we refresh
        fetchOrders();
      }
    },
  });

  // Fetch assignments first, then orders (which depend on assignments)
  useEffect(() => {
    fetchAssignments();
    fetchWorkload();
  }, [fetchAssignments, fetchWorkload, selectedBranchId, branchChangeVersion]);

  useEffect(() => {
    fetchOrders();
    fetchCalls();
    const interval = setInterval(() => {
      fetchOrders();
      fetchCalls();
    }, 15000); // 15s polling fallback
    return () => clearInterval(interval);
  }, [fetchOrders, fetchCalls]);

  const preparingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'accepted' || o.status === 'preparing');
  const readyOrders = orders.filter((o) => o.status === 'ready');
  const readyTakeawayOrders = orders.filter((o) => o.status === 'ready' && o.type === 'takeaway');
  const pickedUpOrders = orders.filter((o) => o.status === 'picked_up');
  const servedOrders = orders.filter((o) => o.status === 'served');
  const pendingCalls = calls.filter((c) => c.status === 'pending');
  const acknowledgedCalls = calls.filter((c) => c.status === 'acknowledged');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">{t('waiter.loading', 'Loading waiter dashboard...')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            {t('waiter.title', 'Waiter Dashboard')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {assignedTableIds.length > 0
              ? `Your tables: ${assignedTableIds.length} assigned`
              : 'All tables (no assignments set up — assign tables in Staff management)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
            {realtimeConnected ? t('waiter.live', 'Live') : t('waiter.polling', 'Polling')}
          </div>
          <Button
            variant={soundEnabled ? 'default' : 'outline'}
            size="sm"
            className="gap-1"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            {soundEnabled ? t('waiter.sound_on', 'Sound On') : t('waiter.sound_off', 'Sound Off')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => { fetchOrders(); fetchCalls(); }}>
            <RefreshCw className="h-3 w-3" />
            {t('dashboard.refresh', 'Refresh')}
          </Button>
          {hasPermission(userRole, PERMISSIONS.ORDER_CREATE.key) && (
            <Button size="sm" className="gap-1" onClick={() => setShowCreateOrder(true)}>
              <ClipboardList className="h-3 w-3" />
              {t('dashboard.new_order', 'New Order')}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <UtensilsCrossed className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{preparingOrders.length}</p>
              <p className="text-[11px] text-muted-foreground">{t('waiter.in_progress', 'In Progress')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <ShoppingBag className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{readyOrders.length}</p>
              <p className="text-[11px] text-muted-foreground">{t('waiter.ready_for_pickup', 'Ready for Pickup')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <ShoppingBag className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{readyTakeawayOrders.length}</p>
              <p className="text-[11px] text-muted-foreground">🥡 Takeaway Ready</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pickedUpOrders.length}</p>
              <p className="text-[11px] text-muted-foreground">{t('waiter.on_its_way', 'On Its Way')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Bell className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCalls.length}</p>
              <p className="text-[11px] text-muted-foreground">{t('waiter.calls_pending', 'Calls Pending')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <BellRing className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{acknowledgedCalls.length}</p>
              <p className="text-[11px] text-muted-foreground">{t('waiter.acknowledged', 'Acknowledged')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Waiter Workload & Assignment Management ─── */}
      {hasPermission(userRole, PERMISSIONS.STAFF_VIEW.key) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Scale className="h-4 w-4 text-violet-600" />
              {t('waiter.workload_balance', 'Workload Balance')}
              {workload && (
                <Badge variant="outline" className="text-[10px]">
                  {workload.source === 'shift' ? '🔄 Shift-based' : '📋 Staff Assignments'}
                </Badge>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {workload && workload.unassignedTables.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={handleAutoAssign}
                  disabled={autoAssigning || rebalancing}
                >
                  {autoAssigning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Auto-Assign ({workload.unassignedTables.length} unassigned)
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={handleRebalance}
                disabled={rebalancing || autoAssigning || !workload || workload.waiters.length < 2}
                title={!workload || workload.waiters.length < 2 ? 'Need at least 2 waiters to rebalance' : 'Redistribute tables evenly across all waiters'}
              >
                {rebalancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightLeft className="h-3 w-3" />}
                {t('waiter.rebalance_tables', 'Rebalance Tables')}
              </Button>
            </div>
          </div>

          {/* Workload bars */}
          {workload && workload.waiters.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {workload.waiters
                .sort((a, b) => a.totalLoad - b.totalLoad)
                .map((w) => {
                  const maxLoad = Math.max(...workload.waiters.map(x => x.totalLoad), 1);
                  const loadPercent = Math.round((w.totalLoad / maxLoad) * 100);
                  const isCurrentUser = w.userId === user?.id;
                  const isOverloaded = w.totalLoad > workload.totalTables / workload.waiters.length + 2;
                  return (
                    <Card key={w.userId} className={`${isCurrentUser ? 'border-primary/50 bg-primary/5' : ''} ${isOverloaded ? 'border-orange-300 dark:border-orange-800' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} text-xs font-semibold`}>
                            {w.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {w.name}
                              {isCurrentUser && <span className="text-[10px] text-muted-foreground ml-1">(you)</span>}
                            </p>
                            {w.shiftName && (
                              <p className="text-[10px] text-muted-foreground">{w.shiftName}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${isOverloaded ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                              {w.totalLoad}
                            </p>
                            <p className="text-[9px] text-muted-foreground">load</p>
                          </div>
                        </div>
                        {/* Load bar */}
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${
                              loadPercent > 80 ? 'bg-red-500' :
                              loadPercent > 60 ? 'bg-orange-500' :
                              loadPercent > 40 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${loadPercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{w.assignedTableIds.length} table{w.assignedTableIds.length !== 1 ? 's' : ''}</span>
                          <span>{w.activeOrderCount} active order{w.activeOrderCount !== 1 ? 's' : ''}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-6">
                <Users className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">{t('waiter.no_active_waiters', 'No active waiters found for this branch')}</p>
                <p className="text-xs text-muted-foreground">Waiters need to clock into a shift or have staff assignments configured</p>
              </CardContent>
            </Card>
          )}

          {/* Unassigned tables alert */}
          {workload && workload.unassignedTables.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {workload.unassignedTables.length} unassigned table{workload.unassignedTables.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Tables {workload.unassignedTables.map(t => t.number).join(', ')} have no waiter assigned. 
                Click "Auto-Assign" to distribute them to the least-busy waiters.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── In Progress Section (read-only) ─── */}
      {preparingOrders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-orange-600" />
            {t('waiter.in_progress', 'In Progress')}
            <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px]">{preparingOrders.length}</Badge>
            <span className="text-[10px] text-muted-foreground font-normal ml-1">(read-only — kitchen is preparing)</span>
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {preparingOrders.map((order) => (
              <WaiterOrderCard
                key={order.id}
                order={order}
                restaurantId={restaurantId}
                onUpdated={fetchOrders}
                highlight={false}
                t={t}
                getOrderStatusLabel={getOrderStatusLabel}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Ready for Pickup Section ─── */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-green-600" />
          {t('waiter.ready_for_pickup', 'Ready for Pickup')}
          {readyOrders.length > 0 && (
            <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">{readyOrders.length}</Badge>
          )}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {readyOrders.map((order) => (
            <WaiterOrderCard
              key={order.id}
              order={order}
              restaurantId={restaurantId}
              onUpdated={fetchOrders}
              highlight={newOrderIds.has(order.id)}
              t={t}
              getOrderStatusLabel={getOrderStatusLabel}
            />
          ))}
        </div>
        {readyOrders.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">{t('waiter.no_ready_orders', 'No orders ready for pickup')}</p>
              <p className="text-xs text-muted-foreground">{t('waiter.sound_notification_hint', "You'll hear a sound when an order is ready")}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─── On Its Way Section ─── */}
      {pickedUpOrders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Truck className="h-4 w-4 text-blue-600" />
            {t('waiter.on_its_way', 'On Its Way')}
            <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">{pickedUpOrders.length}</Badge>
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pickedUpOrders.map((order) => (
              <WaiterOrderCard
                key={order.id}
                order={order}
                restaurantId={restaurantId}
                onUpdated={fetchOrders}
                highlight={false}
                t={t}
                getOrderStatusLabel={getOrderStatusLabel}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Served Section ─── */}
      {servedOrders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {t('waiter.served', 'Served')}
            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">{servedOrders.length}</Badge>
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {servedOrders.map((order) => (
              <WaiterOrderCard
                key={order.id}
                order={order}
                restaurantId={restaurantId}
                onUpdated={fetchOrders}
                highlight={false}
                t={t}
                getOrderStatusLabel={getOrderStatusLabel}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Waiter Calls Section ─── */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Bell className="h-4 w-4 text-orange-600" />
          {t('waiter.table_calls', 'Table Calls')}
          {pendingCalls.length > 0 && (
            <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px] animate-pulse">{pendingCalls.length}</Badge>
          )}
        </h3>
        <div className="space-y-2">
          {calls.map((call) => (
            <WaiterCallCard
              key={call.id}
              call={call}
              restaurantId={restaurantId}
              onUpdated={fetchCalls}
              t={t}
            />
          ))}
          {calls.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-6">
                <Bell className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">{t('waiter.no_table_calls', 'No active table calls')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Staff Order Form — Create order on behalf of customer */}
      <StaffOrderForm
        open={showCreateOrder}
        onClose={() => setShowCreateOrder(false)}
        onOrderCreated={fetchOrders}
        restaurantId={restaurantId}
        userRole={userRole}
      />
    </div>
  );
}
