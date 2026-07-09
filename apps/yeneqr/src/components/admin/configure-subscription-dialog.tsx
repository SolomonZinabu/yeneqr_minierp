'use client';

// ============================================================
// Yene QR — Admin: Configure Subscription Dialog
// ============================================================
// Allows super admins to set per-restaurant custom fee rates,
// custom subscription prices, and notes — for the "Configurable"
// plan or special deals on any plan.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { formatCents } from '@/lib/money';
import { Loader2, Settings2, Sparkles, Info } from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionOverrideData {
  subscription: {
    id: string;
    status: string;
    planId: string;
    planName: string;
    planSlug: string;
    customFeeRate: number | null;
    customPriceCents: number | null;
    customNotes: string | null;
    effectiveFeeRate: number;
    effectiveFeeRatePercent: number;
    effectivePriceCents: number;
  };
  restaurant: { id: string; name: string };
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  feeRatePercent: number;
  isActive: boolean;
}

interface ConfigureSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  restaurantName?: string;
  onSaved?: () => void;
}

export function ConfigureSubscriptionDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
  onSaved,
}: ConfigureSubscriptionDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SubscriptionOverrideData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Form state
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [customFeeRatePercent, setCustomFeeRatePercent] = useState(''); // percentage form (1.5 = 1.5%)
  const [customPriceETB, setCustomPriceETB] = useState(''); // ETB form
  const [customNotes, setCustomNotes] = useState('');
  const [useCustomFeeRate, setUseCustomFeeRate] = useState(false);
  const [useCustomPrice, setUseCustomPrice] = useState(false);

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [overrideRes, plansRes] = await Promise.all([
        api.get<{ data: SubscriptionOverrideData }>(`/api/admin/restaurants/${restaurantId}/subscription-overrides`),
        api.get<{ data: Plan[] }>('/api/admin/subscriptions'),
      ]);
      setData(overrideRes.data);
      setPlans(plansRes.data || []);

      const sub = overrideRes.data?.subscription;
      if (sub) {
        setSelectedPlanId(sub.planId);
        setUseCustomFeeRate(sub.customFeeRate != null);
        setCustomFeeRatePercent(sub.customFeeRate != null ? String(sub.customFeeRate * 100) : '');
        setUseCustomPrice(sub.customPriceCents != null);
        setCustomPriceETB(sub.customPriceCents != null ? String(sub.customPriceCents / 100) : '');
        setCustomNotes(sub.customNotes || '');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch subscription data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (open && restaurantId) {
      fetchData();
    }
  }, [open, restaurantId, fetchData]);

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};

      if (selectedPlanId && selectedPlanId !== data?.subscription?.planId) {
        payload.planId = selectedPlanId;
      }

      // customFeeRate: send as decimal (0.015) if enabled, null to clear
      if (useCustomFeeRate) {
        const pct = parseFloat(customFeeRatePercent);
        if (isNaN(pct) || pct < 0 || pct > 50) {
          toast.error('Fee rate must be between 0 and 50%');
          setSaving(false);
          return;
        }
        payload.customFeeRate = pct / 100;
      } else {
        payload.customFeeRate = null; // clear override
      }

      // customPriceCents: send in cents if enabled, null to clear
      if (useCustomPrice) {
        const etb = parseFloat(customPriceETB);
        if (isNaN(etb) || etb < 0) {
          toast.error('Custom price must be a non-negative number');
          setSaving(false);
          return;
        }
        payload.customPriceCents = Math.round(etb * 100);
      } else {
        payload.customPriceCents = null; // clear override
      }

      payload.customNotes = customNotes.trim() || null;

      await api.put(`/api/admin/restaurants/${restaurantId}/subscription-overrides`, payload);
      toast.success(`Subscription configured for ${data?.restaurant?.name || restaurantName}`);
      onSaved?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const planDefaultFeeRate = selectedPlan?.feeRatePercent ?? 3.0;
  const planDefaultPrice = selectedPlan?.priceCents ?? 0;
  const effectiveFeeRate = useCustomFeeRate ? (parseFloat(customFeeRatePercent) || 0) : planDefaultFeeRate;
  const effectivePriceCents = useCustomPrice ? Math.round((parseFloat(customPriceETB) || 0) * 100) : planDefaultPrice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configure Subscription
          </DialogTitle>
          <DialogDescription>
            Set a custom fee rate and/or subscription price for{' '}
            <strong>{data?.restaurant?.name || restaurantName}</strong>.
            Use this for negotiated deals, enterprise contracts, or the Configurable plan.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Current status */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Current Plan</span>
                <Badge variant="outline" className="text-xs">{data.subscription.planName}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Subscription Status</span>
                <Badge variant="outline" className="text-xs">{data.subscription.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Effective Fee Rate</span>
                <span className="text-sm font-semibold">{data.subscription.effectiveFeeRatePercent}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Effective Monthly Price</span>
                <span className="text-sm font-semibold">{formatCents(data.subscription.effectivePriceCents)}</span>
              </div>
            </div>

            {/* Plan selector */}
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.isActive).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({p.feeRatePercent}% fee, {formatCents(p.priceCents)}/mo)
                        </span>
                        {p.slug === 'configurable' && (
                          <Sparkles className="h-3 w-3 text-purple-500" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Switch to &ldquo;Configurable&rdquo; for custom-negotiated deals. The actual numbers are set below.
              </p>
            </div>

            {/* Custom Fee Rate */}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Custom Fee Rate</Label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomFeeRate}
                    onChange={(e) => setUseCustomFeeRate(e.target.checked)}
                    className="rounded"
                  />
                  Override plan default
                </label>
              </div>
              {useCustomFeeRate ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={customFeeRatePercent}
                    onChange={(e) => setCustomFeeRatePercent(e.target.value)}
                    placeholder="1.5"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    = {effectiveFeeRate}% per transaction
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Using plan default: <strong>{planDefaultFeeRate}%</strong>
                </p>
              )}
            </div>

            {/* Custom Price */}
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Custom Monthly Price</Label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomPrice}
                    onChange={(e) => setUseCustomPrice(e.target.checked)}
                    className="rounded"
                  />
                  Override plan default
                </label>
              </div>
              {useCustomPrice ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={customPriceETB}
                    onChange={(e) => setCustomPriceETB(e.target.value)}
                    placeholder="1500"
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">ETB/mo</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    = {formatCents(effectivePriceCents)}/mo
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Using plan default: <strong>{formatCents(planDefaultPrice)}/mo</strong>
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="custom-notes">Notes (admin only)</Label>
              <Textarea
                id="custom-notes"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Reason for the custom deal, contract reference, negotiation details..."
                rows={2}
              />
            </div>

            {/* Effective summary */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
              <p className="text-xs font-semibold text-primary flex items-center gap-1">
                <Info className="h-3 w-3" />
                Effective Configuration
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Fee Rate:</span>
                <span className="font-semibold">{effectiveFeeRate}% per transaction</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Monthly Price:</span>
                <span className="font-semibold">{formatCents(effectivePriceCents)}/mo</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No subscription data found.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings2 className="h-4 w-4 mr-2" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
