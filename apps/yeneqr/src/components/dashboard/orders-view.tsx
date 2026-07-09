'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { useBranchChange } from '@/hooks/use-branch-change';
import { api, getTimeAgo } from '@/lib/api-client';
import { formatCents, toCents } from '@/lib/money';
import { useRealtime } from '@/lib/use-realtime';
import { ReceiptPrinter } from '@/components/dashboard/receipt-printer';
import { OrderEventsDialog } from '@/components/dashboard/order-events-dialog';
import {
  ShoppingCart,
  Clock,
  ChefHat,
  CheckCircle2,
  UtensilsCrossed,
  XCircle,
  ChevronRight,
  Loader2,
  RefreshCw,
  Split,
  Plus,
  Trash2,
  Users,
  Percent,
  HandCoins,
  Equal,
  ShoppingBag,
  ClipboardList,
  CreditCard,
  Banknote,
  Printer,
  AlertTriangle,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission, PERMISSIONS } from '@/lib/auth';
import { StaffOrderForm } from '@/components/dashboard/staff-order-form';
import { playOrderReadySound, playReminderSound } from '@/lib/sounds';

type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'served' | 'completed' | 'cancelled';
type KitchenItemStatus = 'pending' | 'preparing' | 'ready' | 'picked_up' | 'served' | 'cancelled';

interface OrderItemData {
  id: string;
  menuItemId: string;
  name: string;
  nameAm?: string | null;
  quantity: number;
  priceCents: number;
  specialInstructions?: string | null;
  removedIngredients?: string | null; // JSON: [{id,name,nameAm}]
  kitchenStatus: KitchenItemStatus;
  modifierSelections?: { name: string; priceDeltaCents: number }[];
  menuItemImage?: string | null;
  menuItemEmoji?: string | null;
  menuItem?: { id: string; name: string; image: string | null; category?: { id: string; name: string } | null };
}

interface OrderData {
  id: string;
  orderNumber: string;
  type: string;
  status: OrderStatus;
  tableId: string;
  branchId: string;
  sessionId?: string | null;
  customerId?: string | null;
  subtotalCents: number;
  taxAmountCents: number;
  serviceChargeCents: number;
  discountAmountCents: number;
  packagingChargeCents: number;
  totalAmountCents: number;
  specialInstructions?: string | null;
  roundNumber: number;
  priority?: string; // 'normal', 'rush', 'vip'
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
  table?: { id: string; number: number; status: string } | null;
  customer?: { id: string; name: string } | null;
  items?: OrderItemData[];
  events?: { id: string; status: string; createdAt: string }[];
  billSplits?: BillSplitData[];
  payments?: { id: string; amountCents: number; status: string; method: string; createdAt: string }[];
}

interface BillSplitData {
  id: string;
  splitType: string;
  totalAmountCents: number;
  paidAmountCents: number;
  status: string; // pending, partial, paid
  splitData: string; // JSON: [{name, amountCents, items?, percentage?}]
  payments: { id: string; amountCents: number; status: string; method: string }[];
  createdAt: string;
}

const statusConfig: Record<OrderStatus, { label: string; icon: React.ElementType; color: string; bgColor: string; description: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', description: 'Waiting for confirmation' },
  accepted: { label: 'Confirmed', icon: CheckCircle2, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', description: 'Order accepted' },
  preparing: { label: 'Preparing', icon: ChefHat, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', description: 'Kitchen is cooking' },
  ready: { label: 'Ready', icon: ShoppingCart, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30', description: 'Ready for pickup' },
  picked_up: { label: 'Picked Up', icon: ShoppingBag, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', description: 'On the way to table' },
  served: { label: 'Served', icon: UtensilsCrossed, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', description: 'Delivered to customer' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', description: 'Order finished' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', description: 'Order was cancelled' },
};

// Define what action buttons to show at each status
// This defines the natural flow: Walk-in → Walk-out
type ActionButton = {
  label: string;
  targetStatus: OrderStatus | null; // null = special action
  variant: 'default' | 'outline' | 'destructive';
  icon: React.ElementType;
  requiresReason?: boolean;
};

function getActionButtons(status: OrderStatus): ActionButton[] {
  switch (status) {
    case 'pending':
      return [
        { label: 'Accept Order', targetStatus: 'accepted', variant: 'default', icon: CheckCircle2 },
        { label: 'Cancel', targetStatus: 'cancelled', variant: 'destructive', icon: XCircle, requiresReason: true },
      ];
    case 'accepted':
      // Kitchen action — order is waiting for kitchen to start preparing
      // No waiter action needed; cancel still available for manager/owner
      return [
        { label: 'Cancel', targetStatus: 'cancelled', variant: 'destructive', icon: XCircle, requiresReason: true },
      ];
    case 'preparing':
      // Kitchen action — kitchen is cooking
      // No waiter action needed; cancel still available for manager/owner
      return [
        { label: 'Cancel', targetStatus: 'cancelled', variant: 'destructive', icon: XCircle, requiresReason: true },
      ];
    case 'ready':
      // Waiter picks up from kitchen
      return [
        { label: 'Pick Up Order', targetStatus: 'picked_up', variant: 'default', icon: ShoppingBag },
      ];
    case 'picked_up':
      return [
        { label: 'Mark Served', targetStatus: 'served', variant: 'default', icon: UtensilsCrossed },
      ];
    case 'served':
      return [
        { label: 'Mark as Paid', targetStatus: 'completed', variant: 'default', icon: CheckCircle2 },
      ];
    case 'completed':
      return [];
    case 'cancelled':
      return [];
    default:
      return [];
  }
}

// Show payment actions (Split Bill, Print Receipt) only after food is served
function canShowPaymentActions(status: OrderStatus): boolean {
  return ['served', 'paid', 'completed'].includes(status);
}

// Show kitchen ticket print before serving
function canShowKitchenTicket(status: OrderStatus): boolean {
  return ['accepted', 'preparing', 'ready'].includes(status);
}

// Show cancel button (only before food is served)
function canCancel(status: OrderStatus): boolean {
  return ['pending', 'accepted', 'preparing'].includes(status);
}

// Generate a kitchen ticket HTML for printing
function generateKitchenTicketHTML(order: OrderData): string {
  const items = order.items || [];
  const itemsHTML = items.map(item => {
    const removedHTML = item.removedIngredients ? (() => {
      try {
        const removed = JSON.parse(item.removedIngredients);
        if (!Array.isArray(removed) || removed.length === 0) return '';
        return `<div style="color:#c00;font-weight:bold;font-size:11px;margin-left:8px;">NO: ${removed.map((r: { name: string }) => r.name).join(', ')}</div>`;
      } catch { return ''; }
    })() : '';
    const modifiersHTML = item.modifierSelections && item.modifierSelections.length > 0
      ? `<div style="font-size:11px;color:#666;margin-left:8px;">${item.modifierSelections.map(m => m.name).join(', ')}</div>`
      : '';
    const notesHTML = item.specialInstructions
      ? `<div style="font-size:10px;color:#c00;margin-left:8px;font-style:italic;">Note: ${item.specialInstructions}</div>`
      : '';
    return `
      <div style="border-bottom:1px dashed #ccc;padding:6px 0;">
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:14px;font-weight:600;">${item.name}</span>
          <span style="font-size:14px;font-weight:600;">x${item.quantity}</span>
        </div>
        ${modifiersHTML}${removedHTML}${notesHTML}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Kitchen Ticket - ${order.orderNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; max-width: 280px; margin: 0 auto; padding: 12px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 8px; }
    .order-num { font-size: 22px; font-weight: bold; }
    .table-info { font-size: 14px; margin-top: 4px; }
    .type-badge { display: inline-block; background: #000; color: #fff; padding: 2px 8px; font-size: 11px; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="order-num">${order.orderNumber}</div>
    <div class="table-info">Table ${order.table?.number || 'N/A'}</div>
    <div class="type-badge" style="${order.type === 'take_away' || order.type === 'takeaway' ? 'background:#d97706;color:#fff;font-size:16px;font-weight:900;padding:6px 16px;letter-spacing:2px;' : 'background:#0284c7;color:#fff;font-size:16px;font-weight:900;padding:6px 16px;letter-spacing:2px;'}">${order.type === 'take_away' || order.type === 'takeaway' ? '🥡 PACK' : '🍽️ SERVE'}</div>
  </div>
  <div class="items">${itemsHTML}</div>
  <div style="text-align:center;margin-top:8px;font-size:10px;color:#999;">
    ${new Date().toLocaleTimeString()} — KITCHEN COPY
  </div>
</body>
</html>`;
}

const kitchenStatusColors: Record<KitchenItemStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  preparing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  picked_up: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  served: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const statusOrder: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served', 'paid', 'completed', 'cancelled'];

// ─── Bill Split Dialog ────────────────────────────────────────

type SplitType = 'equal' | 'items' | 'custom' | 'percentage';

let _splitPersonCounter = 0;
function newSplitUid() { return `sp-${++_splitPersonCounter}`; }

interface SplitPerson {
  uid: string;
  name: string;
  itemIds: string[];
  percentage: number;
  amount: number;
}

function BillSplitDialog({
  open,
  onClose,
  order,
  restaurantId,
}: {
  open: boolean;
  onClose: () => void;
  order: OrderData;
  restaurantId: string;
}) {
  const { t } = useI18n(restaurantId);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [people, setPeople] = useState<SplitPerson[]>([{ uid: newSplitUid(), name: 'Person 1', itemIds: [], percentage: 0, amount: 0 }]);
  const [saving, setSaving] = useState(false);

  const items = order.items || [];
  const totalAmountCents = order.totalAmountCents;

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSplitType('equal');
      setPeople([{ uid: newSplitUid(), name: 'Person 1', itemIds: [], percentage: 0, amount: 0 }]);
    }
  }, [open]);

  // Add person
  const addPerson = () => {
    setPeople((prev) => [...prev, { uid: newSplitUid(), name: `Person ${prev.length + 1}`, itemIds: [], percentage: 0, amount: 0 }]);
  };

  // Remove person
  const removePerson = (uid: string) => {
    if (people.length <= 1) return;
    setPeople((prev) => prev.filter((p) => p.uid !== uid));
  };

  // Update person name
  const updatePersonName = (uid: string, name: string) => {
    setPeople((prev) => prev.map((p) => (p.uid === uid ? { ...p, name } : p)));
  };

  // Toggle item assignment (for items split type)
  const toggleItemAssignment = (uid: string, itemId: string) => {
    setPeople((prev) =>
      prev.map((p) => {
        if (p.uid !== uid) return p;
        const hasItem = p.itemIds.includes(itemId);
        return {
          ...p,
          itemIds: hasItem ? p.itemIds.filter((id) => id !== itemId) : [...p.itemIds, itemId],
        };
      })
    );
  };

  // Update custom amount
  const updateCustomAmount = (uid: string, amount: number) => {
    setPeople((prev) => prev.map((p) => (p.uid === uid ? { ...p, amount } : p)));
  };

  // Update percentage
  const updatePercentage = (uid: string, percentage: number) => {
    setPeople((prev) => prev.map((p) => (p.uid === uid ? { ...p, percentage } : p)));
  };

  // Calculate amount per person for equal split (all in cents)
  const equalAmountCents = people.length > 0 ? Math.round(totalAmountCents / people.length) : 0;

  // Calculate amounts for items split (in cents)
  const getItemAmountCentsForPerson = (person: SplitPerson): number => {
    const itemTotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
    if (itemTotalCents === 0) return 0;
    const personSubtotalCents = person.itemIds.reduce((sum, itemId) => {
      const item = items.find((i) => i.id === itemId);
      return sum + (item ? item.priceCents * item.quantity : 0);
    }, 0);
    const ratio = personSubtotalCents / itemTotalCents;
    return Math.round(totalAmountCents * ratio);
  };

  // Calculate amounts for percentage split (in cents)
  const getPercentageAmountCents = (percentage: number): number => {
    return Math.round(totalAmountCents * percentage / 100);
  };

  // Total custom amounts (in cents — p.amount is ETB input, convert to cents)
  const customTotalCents = people.reduce((sum, p) => sum + toCents(p.amount || 0), 0);
  const customDiffCents = customTotalCents - totalAmountCents;

  // Total percentage
  const totalPercentage = people.reduce((sum, p) => sum + (p.percentage || 0), 0);

  // Handle save
  const handleSave = async () => {
    try {
      setSaving(true);

      let splits: { name: string; items?: string[]; percentage?: number; amount?: number }[] = [];

      switch (splitType) {
        case 'equal':
          splits = people.map((p) => ({ name: p.name }));
          break;
        case 'items':
          splits = people.map((p) => ({
            name: p.name,
            items: p.itemIds,
          }));
          break;
        case 'custom':
          if (Math.abs(customDiffCents) > 100) { // more than 1 ETB difference
            toast.error(`Amounts must sum to ${formatCents(totalAmountCents)}`);
            return;
          }
          splits = people.map((p) => ({
            name: p.name,
            amountCents: toCents(p.amount),
          }));
          break;
        case 'percentage':
          if (Math.abs(totalPercentage - 100) > 1) {
            toast.error('Percentages must sum to 100%');
            return;
          }
          splits = people.map((p) => ({
            name: p.name,
            percentage: p.percentage,
          }));
          break;
      }

      const res = await api.post(`/api/restaurants/${restaurantId}/orders/${order.id}/split`, {
        splitType,
        splits,
      });

      if (res) {
        toast.success('Bill split created successfully');
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create bill split';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const splitTypeOptions: { value: SplitType; label: string; icon: React.ElementType; description: string }[] = [
    { value: 'equal', label: 'Equal', icon: Equal, description: 'Split equally among people' },
    { value: 'items', label: 'By Items', icon: ShoppingCart, description: 'Assign items to each person' },
    { value: 'custom', label: 'Custom', icon: HandCoins, description: 'Enter amounts manually' },
    { value: 'percentage', label: 'Percentage', icon: Percent, description: 'Split by percentage' },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5 text-primary" />
            {t('dashboard.split_bill', 'Split Bill')} — {order.orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Order Total */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('dashboard.total', 'Total')}</span>
              <span className="font-bold text-primary">{formatCents(totalAmountCents)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{t('dashboard.subtotal', 'Subtotal')}: {formatCents(order.subtotalCents)}</span>
              <span>{t('dashboard.tax', 'Tax')}: {formatCents(order.taxAmountCents)}</span>
              {order.serviceChargeCents > 0 && <span>{t('dashboard.service_charge', 'Service Charge')}: {formatCents(order.serviceChargeCents)}</span>}
            </div>
          </div>

          {/* Split Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Split Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {splitTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSplitType(opt.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                    splitType === opt.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <opt.icon className={`h-4 w-4 ${splitType === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-xs font-medium">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* People List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">People ({people.length})</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addPerson}>
                <Plus className="h-3 w-3" />
                Add Person
              </Button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
              {people.map((person, index) => (
                <div key={person.uid} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </div>
                    <Input
                      value={person.name}
                      onChange={(e) => updatePersonName(person.uid, e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Name"
                    />
                    {people.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => removePerson(person.uid)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>

                  {/* Show amount per person based on split type */}
                  {splitType === 'equal' && (
                    <div className="flex justify-between text-sm pl-9">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-medium">{formatCents(equalAmountCents)}</span>
                    </div>
                  )}

                  {splitType === 'custom' && (
                    <div className="pl-9">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground shrink-0">Amount (ETB)</Label>
                        <Input
                          type="number"
                          value={person.amount || ''}
                          onChange={(e) => updateCustomAmount(person.uid, parseFloat(e.target.value) || 0)}
                          className="h-7 text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {splitType === 'percentage' && (
                    <div className="pl-9">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground shrink-0">Percentage</Label>
                        <Input
                          type="number"
                          value={person.percentage || ''}
                          onChange={(e) => updatePercentage(person.uid, parseFloat(e.target.value) || 0)}
                          className="h-7 text-sm w-20"
                          placeholder="0"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          = {formatCents(getPercentageAmountCents(person.percentage || 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Item Assignment (for items split) */}
          {splitType === 'items' && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assign Items to People</Label>
                <p className="text-xs text-muted-foreground">
                  Click items to assign them to the selected person. Each item can be assigned to one person.
                </p>
                <div className="space-y-2">
                  {/* Person selector */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {people.map((person) => (
                      <button
                        key={person.uid}
                        className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        {person.name}
                      </button>
                    ))}
                  </div>

                  {/* Items list with checkboxes per person */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-lg border p-2">
                        <span className="text-sm flex-1">{item.name} x{item.quantity}</span>
                        <span className="text-xs text-muted-foreground">{formatCents(item.priceCents * item.quantity)}</span>
                        <div className="flex gap-1">
                          {people.map((person, pIdx) => (
                            <button
                              key={person.uid}
                              onClick={() => toggleItemAssignment(person.uid, item.id)}
                              className={`h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                                person.itemIds.includes(item.id)
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-primary/20'
                              }`}
                              title={person.name}
                            >
                              {pIdx + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary per person */}
                  <div className="space-y-1 mt-2">
                    {people.map((person) => (
                      <div key={person.uid} className="flex justify-between text-xs rounded-lg bg-muted/50 p-2">
                        <span className="text-muted-foreground">
                          {person.name} ({person.itemIds.length} items)
                        </span>
                        <span className="font-medium">{formatCents(getItemAmountCentsForPerson(person))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Validation messages */}
          {splitType === 'custom' && customDiffCents !== 0 && (
            <div className={`text-xs p-2 rounded-lg ${Math.abs(customDiffCents) > 100 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
              {customDiffCents > 0
                ? `Amounts exceed total by ${formatCents(Math.abs(customDiffCents))}`
                : `Amounts are ${formatCents(Math.abs(customDiffCents))} short of total`}
            </div>
          )}

          {splitType === 'percentage' && totalPercentage !== 100 && (
            <div className={`text-xs p-2 rounded-lg ${Math.abs(totalPercentage - 100) > 1 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
              Percentages sum to {totalPercentage}% (must be 100%)
            </div>
          )}

          {/* Split Summary */}
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
            <p className="text-xs font-medium text-primary mb-2">Split Summary</p>
            <div className="space-y-1">
              {people.map((person) => (
                <div key={person.uid} className="flex justify-between text-xs">
                  <span>{person.name}</span>
                  <span className="font-medium">
                    {splitType === 'equal' && formatCents(equalAmountCents)}
                    {splitType === 'items' && formatCents(getItemAmountCentsForPerson(person))}
                    {splitType === 'custom' && formatCents(toCents(person.amount))}
                    {splitType === 'percentage' && formatCents(getPercentageAmountCents(person.percentage))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Split className="h-4 w-4 mr-2" />}
            Create Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Order Detail Sheet ────────────────────────────────────────

function OrderDetailSheet({ order, open, onClose, restaurantId, restaurantName, onUpdated }: {
  order: OrderData | null;
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName?: string;
  onUpdated: () => void;
}) {
  const { t } = useI18n(restaurantId);
  const [updating, setUpdating] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showEventsDialog, setShowEventsDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [billSplits, setBillSplits] = useState<BillSplitData[]>([]);
  const [loadingSplits, setLoadingSplits] = useState(false);
  const [markingPaidKey, setMarkingPaidKey] = useState<string | null>(null); // "billSplitId-splitIndex"

  const fetchBillSplits = useCallback(async () => {
    if (!order || !restaurantId) return;
    try {
      setLoadingSplits(true);
      const res = await api.get<{ data: { billSplits: BillSplitData[] } }>(`/api/restaurants/${restaurantId}/orders/${order.id}/split`);
      setBillSplits(res.data?.billSplits || []);
    } catch {
      // Silently handle — splits section will be empty
    } finally {
      setLoadingSplits(false);
    }
  }, [order, restaurantId]);

  // Fetch bill splits when sheet opens and payment actions are available
  useEffect(() => {
    if (open && order && canShowPaymentActions(order.status)) {
      fetchBillSplits();
    }
    if (!open) {
      setBillSplits([]);
    }
  }, [open, order, fetchBillSplits]);

  const handleMarkPortionPaid = async (billSplitId: string, splitIndex: number) => {
    if (!order) return;
    const key = `${billSplitId}-${splitIndex}`;
    try {
      setMarkingPaidKey(key);
      await api.patch(`/api/restaurants/${restaurantId}/orders/${order.id}/split`, {
        billSplitId,
        splitIndex,
        paid: true,
      });
      toast.success(t('dashboard.mark_paid_success', 'Marked as paid'));
      // Refresh splits and order data
      await fetchBillSplits();
      onUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('dashboard.mark_paid_error', 'Failed to mark as paid');
      toast.error(msg);
    } finally {
      setMarkingPaidKey(null);
    }
  };

  if (!order) return null;
  const config = statusConfig[order.status];

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t('order.status.pending', 'Pending'),
      accepted: t('order.status.accepted', 'Confirmed'),
      preparing: t('order.status.preparing', 'Preparing'),
      ready: t('order.status.ready', 'Ready'),
      picked_up: t('order.status.picked_up', 'Picked Up'),
      served: t('order.status.served', 'Served'),
      completed: t('order.status.completed', 'Completed'),
      cancelled: t('order.status.cancelled', 'Cancelled'),
    };
    return map[status] || status;
  };

  const handleStatusUpdate = async (newStatus: OrderStatus, cancellationReason?: string) => {
    try {
      setUpdating(true);
      const payload: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'cancelled' && cancellationReason) {
        payload.cancellationReason = cancellationReason;
      }
      await api.put(`/api/restaurants/${restaurantId}/orders/${order.id}`, payload);
      toast.success(`Order ${order.orderNumber} updated to ${statusConfig[newStatus].label}`);
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update';
      toast.error(msg);
    } finally {
      setUpdating(false);
    }
  };

  const items = order.items || [];
  const actionButtons = getActionButtons(order.status);

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="border-b pb-3 sm:pb-4">
            <SheetTitle className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg ${config.bgColor}`}>
                <config.icon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm sm:text-base">{t('dashboard.order', 'Order')} {order.orderNumber}</span>
                <span className="text-[11px] sm:text-xs font-normal text-muted-foreground">{config.description}</span>
              </div>
              <Badge className={`${config.bgColor} ${config.color} border-0 ml-auto text-[10px] sm:text-xs`}>
                {statusLabel(order.status)}
              </Badge>
              {order.priority === 'vip' && (
                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-0 text-[10px] sm:text-xs font-bold gap-1">
                  ⭐ VIP
                </Badge>
              )}
              {order.priority === 'rush' && (
                <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-0 text-[10px] sm:text-xs font-bold gap-1">
                  🔥 RUSH
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1 ml-1"
                onClick={() => setShowEventsDialog(true)}
                title="View order timeline (audit trail)"
              >
                <History className="h-3.5 w-3.5" />
                Timeline
              </Button>
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4 sm:space-y-5 px-3 sm:px-4 pb-6">
            {/* Order Info Card */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('dashboard.table_label', 'Table')}</p>
                  <p className="text-sm font-semibold">{order.table ? `Table ${order.table.number}` : '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('dashboard.customer', 'Customer')}</p>
                  <p className="text-sm font-semibold">{order.customer?.name || t('dashboard.walk_in', 'Walk-in')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('dashboard.type', 'Type')}</p>
                  {order.type === 'take_away' || order.type === 'takeaway' ? (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-0 text-xs font-bold gap-1">
                      🥡 TAKEAWAY
                    </Badge>
                  ) : (
                    <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-0 text-xs font-bold gap-1">
                      🍽️ DINE-IN
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{t('dashboard.time', 'Time')}</p>
                  <p className="text-sm font-semibold">{getTimeAgo(order.createdAt)}</p>
                </div>
              </div>
            </div>

            {order.specialInstructions && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800 p-3">
                <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400">{t('dashboard.notes', 'Notes')}</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{order.specialInstructions}</p>
              </div>
            )}

            {/* Items Section */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t('dashboard.items_count', 'items')} ({items.length})</h4>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {(item.menuItem?.image || item.menuItemImage) ? (
                        <img src={item.menuItem?.image || item.menuItemImage || ''} alt={item.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : item.menuItemEmoji ? (
                        <span className="text-lg shrink-0">{item.menuItemEmoji}</span>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{item.name}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${kitchenStatusColors[item.kitchenStatus]}`}>
                            {item.kitchenStatus}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                          {item.modifierSelections && item.modifierSelections.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({item.modifierSelections.map((m) => m.name).join(', ')})
                            </span>
                          )}
                        </div>
                        {item.specialInstructions && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{item.specialInstructions}</p>
                        )}
                        {/* Removed Ingredients */}
                        {item.removedIngredients && (() => {
                          try {
                            const removed = JSON.parse(item.removedIngredients)
                            if (!Array.isArray(removed) || removed.length === 0) return null
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {removed.map((ri: { id: string; name: string }) => (
                                  <span key={ri.id} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                                    🚫 {ri.name}
                                  </span>
                                ))}
                              </div>
                            )
                          } catch { return null }
                        })()}
                      </div>
                    </div>
                    <span className="text-sm font-semibold shrink-0 whitespace-nowrap">{formatCents(item.priceCents * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('dashboard.subtotal', 'Subtotal')}</span>
                <span className="font-medium">{formatCents(order.subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('dashboard.tax', 'Tax')}</span>
                <span className="font-medium">{formatCents(order.taxAmountCents)}</span>
              </div>
              {order.serviceChargeCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('dashboard.service_charge', 'Service Charge')}</span>
                  <span className="font-medium">{formatCents(order.serviceChargeCents)}</span>
                </div>
              )}
              {order.packagingChargeCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('dashboard.packaging', 'Packaging')}</span>
                  <span className="font-medium">{formatCents(order.packagingChargeCents)}</span>
                </div>
              )}
              {order.discountAmountCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('dashboard.discount', 'Discount')}</span>
                  <span className="font-medium text-red-600">-{formatCents(order.discountAmountCents)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold pt-1">
                <span>{t('dashboard.total', 'Total')}</span>
                <span className="text-primary">{formatCents(order.totalAmountCents)}</span>
              </div>
            </div>

            {/* Status Progress Indicator */}
            {order.status !== 'cancelled' && (
              <div className="rounded-xl border bg-muted/30 p-3">
                {/* Mobile: grid layout, Desktop: single row */}
                <div className="grid grid-cols-4 sm:flex sm:items-center sm:justify-between gap-2 sm:gap-1">
                  {(['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'served', 'completed'] as OrderStatus[]).map((step, idx) => {
                    const stepConfig = statusConfig[step];
                    const currentIdx = statusOrder.indexOf(order.status);
                    const stepIdx = statusOrder.indexOf(step);
                    const isCompleted = stepIdx < currentIdx || order.status === 'completed';
                    const isCurrent = order.status === step;
                    return (
                      <div key={step} className="flex flex-col items-center gap-1.5 sm:flex-1">
                        <div className={`flex h-8 w-8 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[10px] transition-colors ${
                          isCompleted ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                          isCurrent ? `${stepConfig.bgColor} ${stepConfig.color}` :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <stepConfig.icon className="h-4 w-4 sm:h-3 sm:w-3" />}
                        </div>
                        <span className={`text-[10px] sm:text-[9px] leading-tight text-center ${
                          isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        }`}>
                          {stepConfig.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Kitchen Status Info — when waiting for kitchen */}
            {(order.status === 'accepted' || order.status === 'preparing') && (
              <div className="rounded-xl border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 p-3">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    {order.status === 'accepted' && (
                      <>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Waiting for Kitchen</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                          Order confirmed. The kitchen will start preparing shortly — you&apos;ll be notified when it&apos;s ready for pickup.
                        </p>
                      </>
                    )}
                    {order.status === 'preparing' && (
                      <>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Kitchen is Cooking</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                          The kitchen is preparing this order — you&apos;ll be notified when it&apos;s ready for pickup.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Ready for Pickup Banner */}
            {order.status === 'ready' && (
              <div className="rounded-xl border-2 border-green-400 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-3 animate-pulse-once">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-800 dark:text-green-300">Ready for Pickup!</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      Kitchen has finished this order. Pick it up and deliver to Table {order.table?.number || '—'}.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bill Splits Section */}
            {canShowPaymentActions(order.status) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Split className="h-3.5 w-3.5" />
                    {t('dashboard.bill_splits', 'Bill Splits')}
                  </h4>
                  {loadingSplits && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </div>

                {billSplits.length === 0 && !loadingSplits && (
                  <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-center">
                    <Split className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">{t('dashboard.no_splits_yet', 'No bill splits yet')}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{t('dashboard.create_split_hint', 'Use "Split Bill" below to divide the bill')}</p>
                  </div>
                )}

                {billSplits.map((split) => {
                  // Parse splitData JSON
                  let splitEntries: { name: string; amountCents: number; items?: string[]; percentage?: number }[] = [];
                  try {
                    splitEntries = JSON.parse(split.splitData || '[]');
                  } catch { /* ignore parse error */ }

                  const splitTypeLabels: Record<string, { label: string; icon: React.ElementType }> = {
                    equal: { label: t('dashboard.split_equal', 'Equal'), icon: Equal },
                    items: { label: t('dashboard.split_by_items', 'By Items'), icon: ShoppingCart },
                    custom: { label: t('dashboard.split_custom', 'Custom'), icon: HandCoins },
                    percentage: { label: t('dashboard.split_percentage', 'Percentage'), icon: Percent },
                  };
                  const typeInfo = splitTypeLabels[split.splitType] || { label: split.splitType, icon: Split };
                  const TypeIcon = typeInfo.icon;

                  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
                    pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: t('dashboard.split_status_pending', 'Pending') },
                    partial: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: t('dashboard.split_status_partial', 'Partial') },
                    paid: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: t('dashboard.split_status_paid', 'Paid') },
                  };
                  const splitStatus = statusStyles[split.status] || statusStyles.pending;

                  // Determine which split entries have been paid
                  // Payment records are linked to the whole bill split, so we track
                  // paid portions based on payment count matching split index order
                  const paidCount = split.payments.filter(p => p.status === 'completed').length;

                  return (
                    <div key={split.id} className="rounded-xl border bg-card p-4 space-y-3">
                      {/* Split header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 border-primary/20 bg-primary/5">
                            <TypeIcon className="h-3 w-3" />
                            {typeInfo.label}
                          </Badge>
                          <Badge className={`text-[10px] px-1.5 py-0 border-0 ${splitStatus.bg} ${splitStatus.text}`}>
                            {splitStatus.label}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(split.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Split totals */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('dashboard.total', 'Total')}</span>
                        <span className="font-semibold">{formatCents(split.totalAmountCents)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('dashboard.paid', 'Paid')}</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">{formatCents(split.paidAmountCents)}</span>
                      </div>

                      {/* Payment progress bar */}
                      {split.totalAmountCents > 0 && (
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (split.paidAmountCents / split.totalAmountCents) * 100)}%` }}
                          />
                        </div>
                      )}

                      {/* People list */}
                      <div className="space-y-1.5">
                        {splitEntries.map((entry, idx) => {
                          const isPaid = idx < paidCount;
                          const markPaidKey = `${split.id}-${idx}`;
                          const isMarking = markingPaidKey === markPaidKey;

                          return (
                            <div key={idx} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${isPaid ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-card'}`}>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${isPaid ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                                  {isPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <span className={`text-sm font-medium truncate block ${isPaid ? 'text-green-700 dark:text-green-400' : ''}`}>{entry.name}</span>
                                  {entry.percentage !== undefined && entry.percentage > 0 && (
                                    <span className="text-[10px] text-muted-foreground">{entry.percentage}%</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-sm font-semibold ${isPaid ? 'text-green-700 dark:text-green-400' : ''}`}>{formatCents(entry.amountCents)}</span>
                                {isPaid ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] px-2 gap-1 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                                    onClick={() => handleMarkPortionPaid(split.id, idx)}
                                    disabled={isMarking || !!markingPaidKey}
                                  >
                                    {isMarking ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                    {t('dashboard.mark_paid', 'Mark Paid')}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action Buttons — based on natural flow */}
            <div className="space-y-3 pt-2">
              {/* Primary action buttons based on current status */}
              {actionButtons.length > 0 && actionButtons.map((btn) => (
                <Button
                  key={btn.label}
                  className={btn.variant === 'default' ? 'w-full h-11 text-sm font-semibold' : btn.variant === 'destructive' ? 'w-full h-10 text-sm border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950' : 'w-full h-10 text-sm'}
                  variant={btn.variant === 'destructive' ? 'outline' : btn.variant}
                  onClick={() => {
                    if (btn.requiresReason) {
                      setShowCancelDialog(true);
                    } else if (btn.targetStatus) {
                      handleStatusUpdate(btn.targetStatus);
                    }
                  }}
                  disabled={updating}
                >
                  {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <btn.icon className="h-4 w-4 mr-2" />}
                  {btn.label}
                </Button>
              ))}

              {/* Cancel Reason Dialog */}
              <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>{t('order.cancel_title', 'Cancel Order')}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Label htmlFor="cancel-reason">{t('order.cancel_reason', 'Reason for cancellation')}</Label>
                    <Input
                      id="cancel-reason"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder={t('order.cancel_reason_placeholder', 'Enter reason...')}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCancelDialog(false)}>{t('common.cancel', 'Cancel')}</Button>
                    <Button
                      variant="destructive"
                      disabled={updating || !cancelReason.trim()}
                      onClick={() => {
                        handleStatusUpdate('cancelled', cancelReason.trim());
                        setShowCancelDialog(false);
                        setCancelReason('');
                      }}
                    >
                      {updating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {t('order.confirm_cancel', 'Confirm Cancel')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Payment actions — only show AFTER food is served */}
              {canShowPaymentActions(order.status) && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="h-10 text-sm gap-2"
                    onClick={() => setShowSplitDialog(true)}
                  >
                    <Split className="h-4 w-4" />
                    {t('dashboard.split_bill', 'Split Bill')}
                  </Button>
                  <ReceiptPrinter
                    order={order}
                    restaurant={{
                      id: restaurantId,
                      name: restaurantName || '',
                      address: '',
                      phone: '',
                      currency: 'ETB',
                    }}
                  />
                </div>
              )}

              {/* Payment Actions */}
              {order.status !== 'completed' && order.status !== 'cancelled' && (
                <div className="space-y-2">
                  <Separator className="my-2" />
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('dashboard.payment_actions', 'Payment Actions')}
                  </h4>

                  {/* Pending cash payments from customer — staff must confirm */}
                  {order.payments?.filter(p => p.status === 'pending' && p.method === 'cash').map(pendingPay => (
                    <div key={pendingPay.id} className="rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                            <Banknote className="h-3.5 w-3.5" />
                            {t('dashboard.customer_cash_pending', 'Customer Cash Payment Pending')}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {(pendingPay.amountCents / 100).toLocaleString()} ETB • {t('dashboard.customer_initiated', 'Customer initiated from table')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                          onClick={async () => {
                            try {
                              await api.put(
                                `/api/restaurants/${restaurantId}/payments/${pendingPay.id}`,
                                { status: 'completed' }
                              );
                              toast.success(t('dashboard.cash_confirmed', 'Cash payment confirmed!'));
                              onUpdated();
                            } catch (e: any) {
                              toast.error(e.message || 'Failed to confirm payment');
                            }
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t('dashboard.confirm_cash_received', 'Confirm Cash Received')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={async () => {
                            try {
                              await api.put(
                                `/api/restaurants/${restaurantId}/payments/${pendingPay.id}`,
                                { status: 'failed' }
                              );
                              toast.info(t('dashboard.payment_rejected', 'Cash payment rejected'));
                              onUpdated();
                            } catch (e: any) {
                              toast.error(e.message || 'Failed to reject payment');
                            }
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {t('dashboard.reject', 'Reject')}
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Record Cash Payment (staff-initiated) */}
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-green-200 text-green-700 hover:bg-green-50"
                    onClick={async () => {
                      try {
                        // First create a cash payment record
                        const payRes = await api.post(
                          `/api/restaurants/${restaurantId}/payments`,
                          { orderId: order.id, method: 'cash', tipAmount: 0 }
                        );
                        if (payRes.data?.data?.payment?.id) {
                          // Then mark it as completed
                          await api.put(
                            `/api/restaurants/${restaurantId}/payments/${payRes.data.data.payment.id}`,
                            { status: 'completed' }
                          );
                          toast.success(t('dashboard.payment_confirmed', 'Cash payment confirmed! Order completed.'));
                          onUpdated();
                        } else if (payRes.data?.error?.includes?.('already has a completed payment')) {
                          toast.info(t('dashboard.already_paid', 'Order already paid'));
                        } else {
                          toast.error(payRes.data?.error || 'Failed to record payment');
                        }
                      } catch (e: any) {
                        toast.error(e.message || 'Payment error');
                      }
                    }}
                  >
                    <Banknote className="h-4 w-4" />
                    {t('dashboard.confirm_cash', 'Confirm Cash Payment')}
                  </Button>
                  {/* Record Digital Payment */}
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={async () => {
                      try {
                        const payRes = await api.post(
                          `/api/restaurants/${restaurantId}/payments`,
                          { orderId: order.id, method: 'telebirr', tipAmount: 0 }
                        );
                        if (payRes.data?.data?.payment?.id) {
                          await api.put(
                            `/api/restaurants/${restaurantId}/payments/${payRes.data.data.payment.id}`,
                            { status: 'completed' }
                          );
                          toast.success(t('dashboard.digital_payment_confirmed', 'Digital payment confirmed! Order completed.'));
                          onUpdated();
                        } else if (payRes.data?.error?.includes?.('already has a completed payment')) {
                          toast.info(t('dashboard.already_paid', 'Order already paid'));
                        } else {
                          toast.error(payRes.data?.error || 'Failed to record payment');
                        }
                      } catch (e: any) {
                        toast.error(e.message || 'Payment error');
                      }
                    }}
                  >
                    <CreditCard className="h-4 w-4" />
                    {t('dashboard.confirm_digital', 'Confirm Digital Payment')}
                  </Button>
                </div>
              )}

              {/* Kitchen ticket print — only before serving */}
              {canShowKitchenTicket(order.status) && (
                <Button
                  variant="outline"
                  className="w-full h-10 text-sm gap-2"
                  onClick={() => {
                    const printWindow = window.open('', '_blank', 'width=400,height=600');
                    if (!printWindow) return;
                    printWindow.document.write(generateKitchenTicketHTML(order));
                    printWindow.document.close();
                    printWindow.focus();
                    printWindow.onload = () => {
                      setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
                    };
                  }}
                >
                  <Printer className="h-4 w-4" />
                  Print Kitchen Ticket
                </Button>
              )}

              {/* Print Receipt Button — always available */}
              <ReceiptPrinter
                order={order}
                restaurant={{
                  id: restaurantId,
                  name: restaurantName || '',
                  address: '',
                  phone: '',
                  currency: 'ETB',
                }}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Bill Split Dialog */}
      <BillSplitDialog
        open={showSplitDialog}
        onClose={() => {
          setShowSplitDialog(false);
          // Refresh splits after the dialog closes (a split may have been created)
          if (canShowPaymentActions(order.status)) {
            fetchBillSplits();
          }
        }}
        order={order}
        restaurantId={restaurantId}
      />

      {/* Order Events Timeline Dialog */}
      <OrderEventsDialog
        open={showEventsDialog}
        onClose={() => setShowEventsDialog(false)}
        orderId={order.id}
        orderNumber={order.orderNumber}
        restaurantId={restaurantId}
      />
    </>
  );
}

// ─── Main Orders View ──────────────────────────────────────────

export function OrdersView() {
  const { selectedOrderId, setSelectedOrderId, user, selectedBranchId, branchChangeVersion } = useAppStore();
  const { t } = useI18n(user?.restaurantId);
  const restaurantId = user?.restaurantId || '';
  const restaurantName = user?.restaurantName || '';
  const userRole = user?.role || '';

  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [localFilter, setLocalFilter] = useState<OrderStatus | 'all'>('all');
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  const fetchOrdersRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const handleBranchChange = useCallback((newBranchId: string) => {
    console.log('[OrdersView] handleBranchChange called with:', newBranchId);
    setLoading(true);
    setOrders([]);
    fetchOrdersRef.current?.();
  }, []);

  useBranchChange(handleBranchChange);

  // Reset loading state when branch changes
  useEffect(() => {
    if (selectedBranchId) {
      setLoading(true);
      setOrders([]);
    }
  }, [selectedBranchId]);

  const fetchOrders = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const branchId = useAppStore.getState().selectedBranchId;
      const params = branchId ? `?branchId=${branchId}` : '';
      const res = await api.get<{ data: OrderData[] }>(`/api/restaurants/${restaurantId}/orders${params}`);
      setOrders(res.data || []);
    } catch (err) {
      // Silently handle — show empty state
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // Keep ref in sync for branch-change handler
  useEffect(() => { fetchOrdersRef.current = fetchOrders; }, [fetchOrders]);

  const [authToken, setAuthToken] = useState<string | undefined>()
  useEffect(() => { setAuthToken(localStorage.getItem('yeneqr_token') || undefined) }, [])

  // Real-time SSE connection
  useRealtime({
    restaurantId,
    token: authToken,
    enabled: !!restaurantId,
    onEvent: (event) => {
      if (event.type === 'waiter_order_ready') {
        // Kitchen finished an order — play sound to alert waiter
        try { playOrderReadySound(); } catch {}
        fetchOrders();
      }
      if (event.type === 'cash_payment_pending') {
        // Customer initiated a cash payment from their phone — notify cashier
        const e = event as any;
        toast.info(
          `💵 Cash payment pending — Table ${e.tableNumber || '?'} • Order ${e.orderNumber} • ${(e.amountCents / 100).toLocaleString()} ETB`,
          { duration: 10000 }
        );
        try { playOrderReadySound(); } catch {}
        fetchOrders();
      }
      if (event.type === 'payment_received') {
        // Payment confirmed — refresh to show updated status
        fetchOrders();
      }
      if (event.type === 'new_order' || event.type === 'order_status_changed' || event.type === 'kitchen_item_updated') {
        fetchOrders();
      }
    },
  });

  useEffect(() => {
    fetchOrders();

    // Auto-refresh every 30 seconds as fallback
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders, selectedBranchId, branchChangeVersion]);

  // ── Reminder: play sound for unaccepted orders every 30s ────
  useEffect(() => {
    const UNACCEPTED_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
    const REMINDER_INTERVAL_MS = 30 * 1000; // reminder every 30s

    const checkUnaccepted = () => {
      const now = Date.now();
      const hasUnaccepted = orders.some((o) => {
        if (o.status !== 'pending') return false;
        const created = new Date(o.createdAt).getTime();
        return now - created >= UNACCEPTED_THRESHOLD_MS;
      });
      if (hasUnaccepted) {
        try { playReminderSound(); } catch {}
      }
    };

    const reminderInterval = setInterval(checkUnaccepted, REMINDER_INTERVAL_MS);
    return () => clearInterval(reminderInterval);
  }, [orders]);

  // Helper: check if an order is urgent (unaccepted >2 min)
  const isOrderUrgent = (order: OrderData): boolean => {
    if (order.status !== 'pending') return false;
    const created = new Date(order.createdAt).getTime();
    return Date.now() - created >= 2 * 60 * 1000;
  };

  // Helper: get minutes since order creation
  const getMinutesSince = (createdAt: string): number => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  };

  const filteredOrders = localFilter === 'all'
    ? orders
    : orders.filter((o) => o.status === localFilter);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const urgentPendingCount = orders.filter((o) => isOrderUrgent(o)).length;

  const tabs = [
    { value: 'all', label: t('dashboard.all', 'All'), count: orders.length },
    { value: 'pending', label: t('order.status.pending', 'Pending'), count: orders.filter((o) => o.status === 'pending').length, urgent: urgentPendingCount },
    { value: 'preparing', label: t('order.status.preparing', 'Preparing'), count: orders.filter((o) => o.status === 'preparing').length },
    { value: 'ready', label: t('order.status.ready', 'Ready'), count: orders.filter((o) => o.status === 'ready').length },
    { value: 'served', label: t('order.status.served', 'Served'), count: orders.filter((o) => o.status === 'served').length },
    { value: 'completed', label: t('dashboard.completed_orders', 'Completed'), count: orders.filter((o) => o.status === 'completed').length },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">{t('dashboard.loading_orders', 'Loading orders...')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={localFilter} onValueChange={(v) => setLocalFilter(v as OrderStatus | 'all')}>
          <TabsList className="h-9 w-full sm:w-auto overflow-x-auto flex-nowrap sm:flex-wrap">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className={`text-xs h-7 gap-1 whitespace-nowrap ${'urgent' in tab && tab.urgent > 0 ? 'animate-pulse text-red-600 dark:text-red-400' : ''}`}>
                {tab.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${'urgent' in tab && tab.urgent > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted'}`}>{tab.count}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={localFilter} className="mt-4">
            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground">{t('dashboard.no_orders_found', 'No orders found')}</p>
                  </CardContent>
                </Card>
              ) : (
                filteredOrders.map((order) => {
                  const config = statusConfig[order.status] || statusConfig.pending;
                  const items = order.items || [];
                  const urgent = isOrderUrgent(order);
                  const minutesSince = getMinutesSince(order.createdAt);
                  return (
                    <Card
                      key={order.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow ${
                        urgent ? 'animate-urgent-blink border-red-300 dark:border-red-800' : ''
                      }`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${urgent ? 'bg-red-100 dark:bg-red-900/30' : config.bgColor}`}>
                              {urgent ? (
                                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              ) : (
                                <config.icon className={`h-5 w-5 ${config.color}`} />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{order.orderNumber}</span>
                                {order.type === 'take_away' || order.type === 'takeaway' ? (
                                  <span className="text-sm" title="Takeaway">🥡</span>
                                ) : null}
                                {urgent && (
                                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 text-[10px] animate-pulse font-bold">
                                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                                    UNACCEPTED {minutesSince}m
                                  </Badge>
                                )}
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${urgent ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : `${config.bgColor} ${config.color}`}`}>
                                  {(() => {
                                  const map: Record<string, string> = {
                                    pending: t('order.status.pending', 'Pending'),
                                    accepted: t('order.status.accepted', 'Confirmed'),
                                    preparing: t('order.status.preparing', 'Preparing'),
                                    ready: t('order.status.ready', 'Ready'),
                                    picked_up: t('order.status.picked_up', 'Picked Up'),
                                    served: t('order.status.served', 'Served'),
                                    completed: t('order.status.completed', 'Completed'),
                                    cancelled: t('order.status.cancelled', 'Cancelled'),
                                  };
                                  return map[order.status] || config.label;
                                })()}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {order.type === 'take_away' || order.type === 'takeaway' ? (
                                  <span className="font-medium text-amber-700 dark:text-amber-400">Takeaway</span>
                                ) : (
                                  order.table ? `Table ${order.table.number}` : '—'
                                )} · {items.length} {t('dashboard.items_count', 'items')} · {order.customer?.name || t('dashboard.walk_in', 'Walk-in')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-semibold text-sm">{formatCents(order.totalAmountCents)}</p>
                              <p className="text-[11px] text-muted-foreground">{getTimeAgo(order.createdAt)}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
        <Button variant="outline" size="sm" className="ml-2 gap-1" onClick={fetchOrders}>
          <RefreshCw className="h-3 w-3" />
          {t('dashboard.refresh', 'Refresh')}
        </Button>
        {hasPermission(userRole, PERMISSIONS.ORDER_CREATE.key) && (
          <Button size="sm" className="ml-2 gap-1" onClick={() => setShowCreateOrder(true)}>
            <ClipboardList className="h-3 w-3" />
            Create Order
          </Button>
        )}
      </div>

      <OrderDetailSheet
        order={selectedOrder || null}
        open={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        onUpdated={fetchOrders}
      />

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
