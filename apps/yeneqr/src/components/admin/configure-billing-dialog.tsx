'use client';

// ============================================================
// Yene QR — Admin: Configure Billing Dialog (Decoupled Model)
// ============================================================
// Allows super admins to set:
//   1. Per-restaurant transaction fee rate (Restaurant.feeRate)
//      — independent of the subscription plan
//   2. Custom subscription price override (Subscription.customPriceCents)
//      — for negotiated deals on any plan
//   3. Change the subscription plan
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
import { Loader2, Settings2, Info, Percent } from 'lucide-react';
import { toast } from 'sonner';

interface BillingConfigData {
  restaurant: {
    id: string;
    name: string;
    feeRate: number;
    feeRatePercent: number;
  };
  subscription: {
    id: string;
    status: string;
    planId: string;
    planName: string;
    planSlug: string;
    customPriceCents: number | null;
    customNotes: string | null;
    effectivePriceCents: number;
  } | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  feeRatePercent: number;
  isActive: boolean;
}

interface ConfigureBillingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  restaurantName?: string;
  onSaved?: () => void;
}

export function ConfigureBillingDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
  onSaved,
}: ConfigureBillingDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<BillingConfigData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Form state
  const [feeRatePercent, setFeeRatePercent] = useState('3.0'); // percentage form (1.5 = 1.5%)
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [customPriceETB, setCustomPriceETB] = useState('');
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customNotes, setCustomNotes] = useState('');

  const fetchData = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [configRes, plansRes] = await Promise.all([
        api.get<{ data: BillingConfigData }>(`/api/admin/restaurants/${restaurantId}/billing-config`),
        api.get<{ data: Plan[] }>('/api/admin/subscriptions'),
      ]);
      setData(configRes.data);
      setPlans(plansRes.data || []);

      const r = configRes.data?.restaurant;
      const sub = configRes.data?.subscription;
      if (r) {
        setFeeRatePercent(String(r.feeRatePercent ?? 3.0));
      }
      if (sub) {
        setSelectedPlanId(sub.planId);
        setUseCustomPrice(sub.customPriceCents != null);
        setCustomPriceETB(sub.customPriceCents != null ? String(sub.customPriceCents / 100) : '');
        setCustomNotes(sub.customNotes || '');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch billing config';
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

      // Fee rate (decimal form for the API)
      const pct = parseFloat(feeRatePercent);
      if (isNaN(pct) || pct < 0 || pct > 50) {
        toast.error('Fee rate must be between 0 and 50%');
        setSaving(false);
        return;
      }
      payload.feeRate = pct / 100;

      // Plan change
      if (selectedPlanId && selectedPlanId !== data?.subscription?.planId) {
        payload.planId = selectedPlanId;
      }

      // Custom price
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

      await api.put(`/api/admin/restaurants/${restaurantId}/billing-config`, payload);
      toast.success(`Billing configured for ${data?.restaurant?.name || restaurantName}`);
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
  const planDefaultPrice = selectedPlan?.priceCents ?? 0;
  const effectivePriceCents = useCustomPrice
    ? Math.round((parseFloat(customPriceETB) || 0) * 100)
    : planDefaultPrice;
  const effectiveFeeRatePercent = parseFloat(feeRatePercent) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Configure Billing
          </DialogTitle>
          <DialogDescription>
            Set the transaction fee rate and subscription for{' '}
            <strong>{data?.restaurant?.name || restaurantName}</strong>.
            The fee rate is independent of the subscription plan.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Transaction Fee Rate — the primary field, decoupled from plan */}
            <div className="space-y-2 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Transaction Fee Rate</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Charged on every captured payment. Set per-restaurant — independent of the subscription plan.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={feeRatePercent}
                  onChange={(e) => setFeeRatePercent(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm font-medium">%</span>
                <span className="text-xs text-muted-foreground ml-2">
                  = {(effectiveFeeRatePercent / 100 * 100).toFixed(1)} ETB per 100 ETB transaction
                </span>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-2">
                {[
                  { label: '0% (Charity)', val: '0' },
                  { label: '1% (Premium)', val: '1' },
                  { label: '1.5% (Negotiated)', val: '1.5' },
                  { label: '2% (Pro)', val: '2' },
                  { label: '3% (Default)', val: '3' },
                ].map(preset => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setFeeRatePercent(preset.val)}
                    className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                      feeRatePercent === preset.val
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-accent border-input'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subscription Plan */}
            <div className="space-y-2">
              <Label>Subscription Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.isActive).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatCents(p.priceCents)}/mo)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                The plan determines the monthly subscription price + features. It does NOT affect the transaction fee rate.
              </p>
            </div>

            {/* Custom Price Override */}
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
            <div className="rounded-lg bg-muted/30 border p-3 space-y-1">
              <p className="text-xs font-semibold flex items-center gap-1">
                <Info className="h-3 w-3" />
                Effective Configuration
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Transaction Fee:</span>
                <span className="font-semibold">{effectiveFeeRatePercent.toFixed(1)}% per transaction</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Monthly Subscription:</span>
                <span className="font-semibold">{formatCents(effectivePriceCents)}/mo</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No billing data found.
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
