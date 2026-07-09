'use client';

// ============================================================
// Yene QR — Order Events Timeline Dialog
// ============================================================
// Wraps the GET /api/restaurants/{id}/orders/{orderId}/events endpoint.
// Shows a chronological audit trail of every status change, system
// auto-accept, cancellation, etc. for a given order.
//
// Used by the Orders view to give staff visibility into "what happened
// to this order" — especially useful for direct_to_kitchen orders
// (where the system performs the pending → accepted transition
// automatically) and for dispute resolution.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, History, RefreshCw, UserCheck, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface OrderEventData {
  id: string;
  orderId: string;
  restaurantId: string;
  branchId: string | null;
  event: string;
  fromStatus: string | null;
  toStatus: string | null;
  data: Record<string, unknown> | null;
  performedBy: string | null;
  performedByType: string | null;
  createdAt: string;
}

interface OrderInfo {
  id: string;
  orderNumber: string;
  status: string;
}

interface OrderEventsDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
  orderNumber?: string;
  restaurantId: string;
}

// Human-readable labels for event types
const EVENT_LABELS: Record<string, string> = {
  status_change: 'Status Change',
  item_added: 'Item Added',
  item_removed: 'Item Removed',
  item_modified: 'Item Modified',
  note_added: 'Note Added',
  payment_received: 'Payment Received',
  refund_issued: 'Refund Issued',
  waiter_assigned: 'Waiter Auto-Assigned',
  waiter_assignment_failed: 'Waiter Assignment Failed',
  waiter_unassigned: 'Waiter Unassigned',
  kitchen_station_routed: 'Routed to Kitchen Station',
};

// Human-readable explanations for the assignment reason field
const ASSIGNMENT_REASON_LABELS: Record<string, string> = {
  least_busy_among_assigned: 'Least busy among waiters assigned to this table',
  least_busy_in_branch: 'Least busy waiter in the branch (no table-specific assignments)',
  no_waiters_available: 'No active waiters available',
};

// Color-coded status badges
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  accepted: 'bg-blue-100 text-blue-800 border-blue-300',
  preparing: 'bg-purple-100 text-purple-800 border-purple-300',
  ready: 'bg-green-100 text-green-800 border-green-300',
  picked_up: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  served: 'bg-teal-100 text-teal-800 border-teal-300',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  completed: 'bg-gray-100 text-gray-800 border-gray-300',
  cancelled: 'bg-red-100 text-red-800 border-red-300',
};

// Color-code actor type
const ACTOR_LABELS: Record<string, { label: string; color: string }> = {
  customer: { label: 'Customer', color: 'text-blue-600' },
  staff: { label: 'Staff', color: 'text-gray-700' },
  system: { label: 'System', color: 'text-purple-600' },
  super_admin: { label: 'Admin', color: 'text-red-600' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const secs = Math.max(1, Math.floor((now - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function OrderEventsDialog({
  open,
  onClose,
  orderId,
  orderNumber,
  restaurantId,
}: OrderEventsDialogProps) {
  const [events, setEvents] = useState<OrderEventData[]>([]);
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!orderId || !restaurantId) return;
    setLoading(true);
    try {
      const res = await api.get<{
        data: OrderEventData[];
        order: OrderInfo;
        pagination: { total: number };
      }>(`/api/restaurants/${restaurantId}/orders/${orderId}/events?limit=100`);
      setEvents(res.data || []);
      setOrder(res.order || null);
    } catch (err) {
      console.error('[ORDER_EVENTS_FETCH]', err);
      toast.error('Failed to load order events');
    } finally {
      setLoading(false);
    }
  }, [orderId, restaurantId]);

  useEffect(() => {
    if (open && orderId) {
      fetchEvents();
    } else {
      setEvents([]);
      setOrder(null);
    }
  }, [open, orderId, fetchEvents]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Order Timeline
            {order && (
              <span className="ml-1 text-muted-foreground font-normal">
                #{order.orderNumber}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">
            {events.length} event{events.length !== 1 ? 's' : ''} · most recent first
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={fetchEvents}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No events recorded for this order.
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              <ol className="space-y-3">
                {events.map((event, idx) => {
                  const isSystem = event.performedByType === 'system';
                  const actor = event.performedByType
                    ? ACTOR_LABELS[event.performedByType] || { label: event.performedByType, color: 'text-gray-700' }
                    : { label: 'Unknown', color: 'text-gray-400' };
                  const isStatusChange = event.event === 'status_change' && event.toStatus;
                  const isAutoAccept = event.data?.autoAccept === true || event.data?.reason === 'direct_to_kitchen_routing';
                  const isWaiterAssignment = event.event === 'waiter_assigned';
                  const isWaiterAssignmentFailed = event.event === 'waiter_assignment_failed';
                  const eventData = event.data || {};

                  return (
                    <li key={event.id} className="relative pl-10">
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-2 top-1 h-5 w-5 rounded-full border-2 border-background flex items-center justify-center ${
                          isSystem
                            ? isWaiterAssignment
                              ? 'bg-emerald-100'
                              : isWaiterAssignmentFailed
                              ? 'bg-red-100'
                              : 'bg-purple-100'
                            : isStatusChange
                            ? STATUS_COLORS[event.toStatus!]?.split(' ')[0] || 'bg-gray-100'
                            : 'bg-blue-100'
                        }`}
                      >
                        {isSystem && <span className="text-[10px]">⚙</span>}
                      </div>

                      <div className="rounded-lg border p-3 bg-card">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {EVENT_LABELS[event.event] || event.event.replace(/_/g, ' ')}
                            </span>
                            {isAutoAccept && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-purple-300 text-purple-700 bg-purple-50">
                                AUTO
                              </Badge>
                            )}
                            {isWaiterAssignment && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-emerald-300 text-emerald-700 bg-emerald-50">
                                ALGORITHM
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {timeAgo(event.createdAt)}
                          </span>
                        </div>

                        {/* Status transition */}
                        {isStatusChange && (
                          <div className="flex items-center gap-2 text-xs mb-1">
                            {event.fromStatus ? (
                              <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[event.fromStatus] || ''}`}>
                                {event.fromStatus}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">— new —</span>
                            )}
                            <span className="text-muted-foreground">→</span>
                            <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[event.toStatus!] || ''}`}>
                              {event.toStatus}
                            </Badge>
                          </div>
                        )}

                        {/* Waiter assignment block — shows the decision context */}
                        {isWaiterAssignment && eventData.waiterName && (
                          <div className="mt-1.5 space-y-1.5">
                            <div className="flex items-center gap-2 text-xs">
                              <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                {eventData.waiterName}
                              </span>
                              <span className="text-muted-foreground">selected</span>
                            </div>
                            {typeof eventData.reason === 'string' && (
                              <p className="text-[11px] text-muted-foreground pl-5">
                                {ASSIGNMENT_REASON_LABELS[eventData.reason] || eventData.reason}
                              </p>
                            )}
                            {/* Candidates comparison table */}
                            {Array.isArray(eventData.candidates) && eventData.candidates.length > 0 && (
                              <div className="mt-1.5 rounded-md border border-muted overflow-hidden">
                                <table className="w-full text-[10px]">
                                  <thead className="bg-muted/50">
                                    <tr>
                                      <th className="text-left py-1 px-2 font-medium">Waiter</th>
                                      <th className="text-right py-1 px-2 font-medium">Tables</th>
                                      <th className="text-right py-1 px-2 font-medium">Orders</th>
                                      <th className="text-right py-1 px-2 font-medium">Load</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {eventData.candidates.map((c: { userId: string; name: string; totalLoad: number; assignedTableCount: number; activeOrderCount: number; selected: boolean }, ci: number) => (
                                      <tr
                                        key={c.userId}
                                        className={c.selected ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}
                                      >
                                        <td className="py-1 px-2">
                                          {c.selected && <span className="text-emerald-600 mr-1">✓</span>}
                                          {c.name}
                                        </td>
                                        <td className="text-right py-1 px-2 text-muted-foreground">{c.assignedTableCount}</td>
                                        <td className="text-right py-1 px-2 text-muted-foreground">{c.activeOrderCount}</td>
                                        <td className={`text-right py-1 px-2 font-medium ${c.selected ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
                                          {c.totalLoad === Infinity ? '∞' : c.totalLoad}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Waiter assignment failed block */}
                        {isWaiterAssignmentFailed && (
                          <div className="mt-1.5 flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span>
                              {typeof eventData.message === 'string'
                                ? eventData.message
                                : 'No active waiters available for this table/branch. Order will need manual assignment.'}
                            </span>
                          </div>
                        )}

                        {/* Event data details (only show useful fields) — hide for waiter events (handled above) */}
                        {event.data && Object.keys(eventData).length > 0 && !isAutoAccept && !isWaiterAssignment && !isWaiterAssignmentFailed && (
                          <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
                            {typeof eventData.orderNumber === 'string' && (
                              <div>Order: {eventData.orderNumber}</div>
                            )}
                            {typeof eventData.itemCount === 'number' && (
                              <div>Items: {eventData.itemCount}</div>
                            )}
                            {typeof eventData.reason === 'string' && (
                              <div>Reason: {eventData.reason}</div>
                            )}
                            {typeof eventData.source === 'string' && (
                              <div>Source: {eventData.source}</div>
                            )}
                          </div>
                        )}

                        {/* Actor + timestamp */}
                        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                          <span className={actor.color}>● {actor.label}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground">{formatTime(event.createdAt)}</span>
                          {idx === 0 && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <Badge variant="secondary" className="text-[9px] h-4 px-1">LATEST</Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
