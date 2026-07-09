'use client';

// ============================================================
// Yene QR — Dynamic Pricing Panel (Settings tab)
// ============================================================
// Wires the GET/POST /api/restaurants/{id}/dynamic-pricing endpoint
// into the Settings view. Lets the owner:
//   - View all current dynamic-pricing rules (happy hour, surge, etc.)
//   - See which rules are currently active (live indicator)
//   - Create a new happy-hour rule (time-based discount)
//   - Toggle rules on/off via the Promotions API (DELETE /promotions/{id})
//
// Note: This endpoint is a thin wrapper over the Promotions model —
// rules with type='happy_hour' or type='discount' are surfaced here
// as "dynamic pricing" because they are time/schedule-based rather
// than coupon-based. Full CRUD (edit/delete) is intentionally routed
// to the existing Promotions view to avoid duplicating logic.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Plus, TrendingDown, Clock, Zap, RefreshCw, Tag } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface DynamicPricingRule {
  id: string;
  name: string;
  type: string;          // 'happy_hour' | 'discount'
  discountType: string;  // 'percentage' | 'fixed'
  discountValueCents: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  schedule: string | null;
  applicableItems: string | null;
}

interface DynamicPricingPanelProps {
  restaurantId: string;
}

function formatDiscount(rule: DynamicPricingRule): string {
  if (rule.discountType === 'percentage') {
    return `${rule.discountValueCents / 100}% off`;
  }
  return `ETB ${(rule.discountValueCents / 100).toFixed(0)} off`;
}

function parseSchedule(schedule: string | null): { days?: string[]; startTime?: string; endTime?: string } | null {
  if (!schedule) return null;
  try {
    return JSON.parse(schedule);
  } catch {
    return null;
  }
}

function formatSchedule(rule: DynamicPricingRule): string {
  const sched = parseSchedule(rule.schedule);
  if (!sched) return 'Always-on during validity window';
  const days = sched.days && sched.days.length > 0
    ? sched.days.map(d => d.slice(0, 3)).join(', ')
    : 'Every day';
  const time = sched.startTime && sched.endTime
    ? `${sched.startTime}–${sched.endTime}`
    : 'all day';
  return `${days}, ${time}`;
}

function isCurrentlyActive(rule: DynamicPricingRule): boolean {
  if (!rule.isActive) return false;
  const now = new Date();
  const from = new Date(rule.validFrom);
  const until = new Date(rule.validUntil);
  if (now < from || now > until) return false;
  // Check schedule time window if present
  const sched = parseSchedule(rule.schedule);
  if (sched?.startTime && sched?.endTime) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = sched.startTime.split(':').map(Number);
    const [eh, em] = sched.endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (nowMinutes < startMin || nowMinutes > endMin) return false;
    if (sched.days && sched.days.length > 0) {
      const todayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (!sched.days.includes(todayName)) return false;
    }
  }
  return true;
}

const DAY_OPTIONS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

export function DynamicPricingPanel({ restaurantId }: DynamicPricingPanelProps) {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<DynamicPricingRule[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('17:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
  const [validUntil, setValidUntil] = useState('');

  const fetchRules = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await api.get<{
        data: DynamicPricingRule[];
        activeCount: number;
        hasActiveHappyHour: boolean;
      }>(`/api/restaurants/${restaurantId}/dynamic-pricing`);
      setRules(res.data || []);
      setActiveCount(res.activeCount || 0);
    } catch (err) {
      console.error('[DYNAMIC_PRICING_FETCH]', err);
      toast.error('Failed to load pricing rules');
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const resetForm = () => {
    setName('');
    setDiscountType('percentage');
    setDiscountValue('');
    setStartTime('14:00');
    setEndTime('17:00');
    setSelectedDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']);
    setValidUntil('');
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }
    const dv = parseFloat(discountValue);
    if (isNaN(dv) || dv <= 0) {
      toast.error('Please enter a valid discount value');
      return;
    }
    if (discountType === 'percentage' && dv > 100) {
      toast.error('Percentage discount cannot exceed 100%');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/restaurants/${restaurantId}/dynamic-pricing`, {
        name: name.trim(),
        type: 'happy_hour',
        discountType,
        discountValue: dv,
        schedule: {
          days: selectedDays,
          startTime,
          endTime,
        },
        validFrom: new Date().toISOString(),
        validUntil: validUntil || '2027-12-31',
      });
      toast.success('Pricing rule created');
      setShowCreateDialog(false);
      resetForm();
      fetchRules();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg || 'Failed to create pricing rule');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Dynamic Pricing
            {activeCount > 0 && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] gap-1 ml-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {activeCount} active now
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Time-based discounts and surge pricing. Rules run automatically during their schedule window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8 rounded-lg border border-dashed">
              <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">No pricing rules yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Create a happy hour to discount items during slow periods, or a surge rule for peak demand.
              </p>
              <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create First Rule
              </Button>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-2">
                <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Rule
                </Button>
              </div>
              <div className="space-y-2">
                {rules.map((rule) => {
                  const live = isCurrentlyActive(rule);
                  return (
                    <div
                      key={rule.id}
                      className={`rounded-lg border p-3 ${live ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{rule.name}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {rule.type === 'happy_hour' ? (
                                <><Clock className="h-2.5 w-2.5 mr-1" />HAPPY HOUR</>
                              ) : (
                                <><Tag className="h-2.5 w-2.5 mr-1" />{rule.type.toUpperCase()}</>
                              )}
                            </Badge>
                            {live && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                LIVE
                              </Badge>
                            )}
                            {!rule.isActive && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">PAUSED</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDiscount(rule)} · {formatSchedule(rule)}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Valid until {new Date(rule.validUntil).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={fetchRules}
                          title="Refresh"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Tip: to edit, pause, or delete a rule, use the <span className="font-medium">Promotions</span> tab in the sidebar.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Rule Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Happy Hour Rule</DialogTitle>
            <DialogDescription>
              The discount will apply automatically during the scheduled time window.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Afternoon Happy Hour"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Discount Type</Label>
                <Select value={discountType} onValueChange={(v: 'percentage' | 'fixed') => setDiscountType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (ETB)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="discount-value">Discount Value</Label>
                <Input
                  id="discount-value"
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'e.g., 20' : 'e.g., 50'}
                  min="0"
                  max={discountType === 'percentage' ? '100' : undefined}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Active Days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_OPTIONS.map((d) => {
                  const active = selectedDays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-accent border-input'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valid-until">Valid Until (optional)</Label>
              <Input
                id="valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Leave empty for an ongoing rule (valid until 2027).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
