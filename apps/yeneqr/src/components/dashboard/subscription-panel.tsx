'use client';

// ============================================================
// Yene QR — Subscription Panel (Settings tab)
// ============================================================
// Wires the GET/PUT /api/restaurants/{id}/subscription endpoint
// and the public /api/plans endpoint into the Settings view.
//
// Lets the restaurant owner:
//   - View their current plan, status, billing period, and limits
//   - See the 5 most recent invoices
//   - Change plan (creates a new invoice via the API)
//   - Cancel subscription (with reason)
//
// Previously, the /subscription endpoint had zero UI consumers —
// owners had no way to see or change their plan from the dashboard.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, CreditCard, CheckCircle2, XCircle, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface SubscriptionPlan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  yearlyPriceCents: number | null;
  features: string;
  limits: string;
  sortOrder: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amountCents: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  description: string | null;
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  plan: SubscriptionPlan;
  invoices: Invoice[];
}

interface SubscriptionPanelProps {
  restaurantId: string;
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  trial: { label: 'Trial', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  past_due: { label: 'Past Due', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-300' },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-800 border-gray-300' },
};

const INVOICE_STATUS_STYLES: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-800',
  void: 'bg-gray-100 text-gray-500',
  draft: 'bg-blue-100 text-blue-800',
};

function formatMoney(cents: number): string {
  return `ETB ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function SubscriptionPanel({ restaurantId }: SubscriptionPanelProps) {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [cancelReason, setCancelReason] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchSubscription = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: Subscription }>(
        `/api/restaurants/${restaurantId}/subscription`
      );
      setSubscription(res.data);
    } catch (err: unknown) {
      // 404 = no subscription yet — show empty state, not a toast error
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status !== 404) {
        console.error('[SUBSCRIPTION_FETCH]', err);
        toast.error('Failed to load subscription');
      }
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const fetchPlans = useCallback(async () => {
    try {
      // The public /api/plans endpoint returns { data: [...] }, not { plans: [...] }
      const res = await api.get<{ data: SubscriptionPlan[]; plans?: SubscriptionPlan[] }>('/api/plans');
      setPlans(res.data || res.plans || []);
    } catch (err) {
      console.error('[PLANS_FETCH]', err);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();
    fetchPlans();
  }, [fetchSubscription, fetchPlans]);

  const handleChangePlan = async () => {
    if (!selectedPlanId) {
      toast.error('Please select a plan');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/restaurants/${restaurantId}/subscription`, { planId: selectedPlanId });
      toast.success('Subscription plan updated');
      setShowChangePlanDialog(false);
      fetchSubscription();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg || 'Failed to change plan');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/restaurants/${restaurantId}/subscription`, { cancellationReason: cancelReason.trim() });
      toast.success('Subscription cancelled');
      setShowCancelDialog(false);
      setCancelReason('');
      fetchSubscription();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg || 'Failed to cancel subscription');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription
          </CardTitle>
          <CardDescription>Your YeneQR billing plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No subscription found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Contact support to activate your subscription.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusInfo = STATUS_STYLES[subscription.status] || STATUS_STYLES.expired;
  const currentPlanId = subscription.plan.id;
  const isCancelled = subscription.status === 'cancelled';

  return (
    <div className="space-y-4">
      {/* Current Subscription Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Current Subscription
          </CardTitle>
          <CardDescription>Your active billing plan and renewal date</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan + status row */}
          <div className="flex items-start justify-between gap-3 rounded-lg border p-4">
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <p className="text-lg font-semibold">{subscription.plan.name}</p>
              {subscription.plan.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{subscription.plan.description}</p>
              )}
              <p className="text-xs mt-1 text-muted-foreground">
                {formatMoney(subscription.plan.priceCents)} / month
                {subscription.plan.yearlyPriceCents
                  ? ` · ${formatMoney(subscription.plan.yearlyPriceCents)} / year`
                  : ''}
              </p>
            </div>
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          </div>

          {/* Billing period */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Calendar className="h-3 w-3" />
                Period Start
              </div>
              <p className="text-sm font-medium">{formatDate(subscription.currentPeriodStart)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Calendar className="h-3 w-3" />
                Period End
              </div>
              <p className="text-sm font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
            </div>
          </div>

          {/* Cancellation info */}
          {isCancelled && subscription.cancelledAt && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400 font-medium mb-1">
                <XCircle className="h-3.5 w-3.5" />
                Cancelled on {formatDate(subscription.cancelledAt)}
              </div>
              {subscription.cancellationReason && (
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                  Reason: {subscription.cancellationReason}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setSelectedPlanId(currentPlanId);
                setShowChangePlanDialog(true);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {isCancelled ? 'Reactivate / Change Plan' : 'Change Plan'}
            </Button>
            {!isCancelled && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Invoices Card */}
      {subscription.invoices && subscription.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Invoices</CardTitle>
            <CardDescription>Last {subscription.invoices.length} billing documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {subscription.invoices.map((inv) => {
                const style = INVOICE_STATUS_STYLES[inv.status] || 'bg-gray-100 text-gray-800';
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{inv.invoiceNumber}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${style}`}>
                          {inv.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {inv.description || formatDate(inv.dueDate)}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-medium">{formatMoney(inv.amountCents)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {inv.paidAt ? `Paid ${formatDate(inv.paidAt)}` : `Due ${formatDate(inv.dueDate)}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              See the Invoices tab in the sidebar for the full list and to mark invoices as paid.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Change Plan Dialog */}
      <Dialog open={showChangePlanDialog} onOpenChange={setShowChangePlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a plan</DialogTitle>
            <DialogDescription>
              Select a plan to switch to. A new invoice will be created for the new billing period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto py-2">
            {plans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Loading plans...</p>
            ) : (
              plans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                const isCurrent = plan.id === currentPlanId;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">{formatMoney(plan.priceCents)} / month</p>
                      </div>
                      {isCurrent && <Badge variant="outline" className="text-[10px]">CURRENT</Badge>}
                      {isSelected && !isCurrent && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePlanDialog(false)}>Cancel</Button>
            <Button onClick={handleChangePlan} disabled={saving || selectedPlanId === currentPlanId}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Please tell us why you&apos;re cancelling. Your subscription will remain active until the end of the current billing period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancel-reason">Reason for cancellation</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Switching to a different system, cost concerns, etc."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Keep Plan</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={saving || !cancelReason.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Cancel Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
