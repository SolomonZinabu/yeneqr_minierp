'use client';

// ============================================================
// Yene QR — Branch Settings Section
// ============================================================
// Clean, form-based branch overrides. No JSON inputs.
// Each field shows the current restaurant-level default as a
// placeholder/hint, with an "Inherit" button to clear the override.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, RotateCcw, Store, Globe, Check, Bell, ArrowRight, Percent, Clock, CreditCard, UtensilsCrossed, Printer } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface BranchInfo {
  id: string;
  name: string;
  isMainBranch?: boolean;
}

interface RestaurantDefaults {
  taxRate: number;
  serviceCharge: number;
  workingHours: string | null;
  acceptedPaymentMethods: string[];
  orderTypes: { dineIn: boolean; takeaway: boolean };
}

interface BranchSettingsData {
  id?: string;
  branchId: string;
  workingHours: string | null;
  taxRate: number | null;
  serviceCharge: number | null;
  acceptedPaymentMethods: string | null;
  orderTypes: string | null;
  posPrinterId: string | null;
  orderRouting: 'waiter_first' | 'direct_to_kitchen' | null;
}

interface BranchSettingsSectionProps {
  restaurantId: string;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const PAYMENT_METHODS = ['cash', 'telebirr', 'chapa', 'card', 'starpay'];

export function BranchSettingsSection({ restaurantId }: BranchSettingsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [settings, setSettings] = useState<BranchSettingsData | null>(null);
  const [restaurantDefaults, setRestaurantDefaults] = useState<RestaurantDefaults | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Fetch branches + restaurant defaults on mount
  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([
      api.get<{ data: BranchInfo[] }>(`/api/restaurants/${restaurantId}/branches`),
      api.get<{ data: Record<string, unknown> }>(`/api/restaurants/${restaurantId}/settings`),
    ]).then(([branchesRes, settingsRes]) => {
      const list = branchesRes.data || [];
      setBranches(list);
      if (list.length > 0 && !selectedBranchId) {
        setSelectedBranchId(list[0].id);
      }
      // Parse restaurant defaults for display
      const s = settingsRes.data || {};
      let wh: Record<string, { open: string; close: string }> | null = null;
      if (s.workingHours) {
        try { wh = typeof s.workingHours === 'string' ? JSON.parse(s.workingHours) : s.workingHours; } catch { /* ignore */ }
      }
      let pm: string[] = ['cash'];
      if (s.paymentMethods) {
        pm = Array.isArray(s.paymentMethods) ? s.paymentMethods : (typeof s.paymentMethods === 'string' ? JSON.parse(s.paymentMethods || '["cash"]') : ['cash']);
      }
      let ot = { dineIn: true, takeaway: true };
      if (s.orderTypes) {
        try { ot = typeof s.orderTypes === 'string' ? JSON.parse(s.orderTypes) : s.orderTypes; } catch { /* ignore */ }
      }
      setRestaurantDefaults({
        taxRate: (s.taxRate as number) ?? 0.15,
        serviceCharge: (s.serviceCharge as number) ?? 0,
        workingHours: wh ? JSON.stringify(wh) : null,
        acceptedPaymentMethods: pm,
        orderTypes: ot,
      });
    }).catch(() => toast.error('Failed to load data'));
  }, [restaurantId]);

  // Fetch branch settings when branch changes
  const fetchSettings = useCallback(async () => {
    if (!restaurantId || !selectedBranchId) return;
    setLoading(true);
    setIsDirty(false);
    try {
      const res = await api.get<{ data: BranchSettingsData | null }>(
        `/api/restaurants/${restaurantId}/branches/${selectedBranchId}/settings`
      );
      const data = res.data;
      setSettings(data || {
        branchId: selectedBranchId,
        workingHours: null, taxRate: null, serviceCharge: null,
        acceptedPaymentMethods: null, orderTypes: null, posPrinterId: null, orderRouting: null,
      });
    } catch { toast.error('Failed to load branch settings'); }
    finally { setLoading(false); }
  }, [restaurantId, selectedBranchId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const update = (field: keyof BranchSettingsData, value: unknown) => {
    setSettings(prev => prev ? { ...prev, [field]: value } : prev);
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!settings || !selectedBranchId) return;
    setSaving(true);
    try {
      await api.put(
        `/api/restaurants/${restaurantId}/branches/${selectedBranchId}/settings`,
        {
          workingHours: settings.workingHours || null,
          taxRate: settings.taxRate ?? null,
          serviceCharge: settings.serviceCharge ?? null,
          acceptedPaymentMethods: settings.acceptedPaymentMethods || null,
          orderTypes: settings.orderTypes || null,
          posPrinterId: settings.posPrinterId || null,
          orderRouting: settings.orderRouting || null,
        }
      );
      toast.success('Branch settings saved');
      setIsDirty(false);
      fetchSettings();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const handleResetAll = async () => {
    if (!selectedBranchId) return;
    try {
      await api.delete(`/api/restaurants/${restaurantId}/branches/${selectedBranchId}/settings`);
      toast.success('All overrides cleared — branch now inherits everything');
      fetchSettings();
    } catch { toast.error('Failed to reset'); }
  };

  const selectedBranch = branches.find(b => b.id === selectedBranchId);
  const hasOverrides = settings?.id !== undefined;

  // Parse working hours for the form
  const parseWorkingHours = (wh: string | null): Record<string, { open: string; close: string } | null> => {
    if (!wh) return {};
    try { return JSON.parse(wh); } catch { return {}; }
  };

  const branchHours = parseWorkingHours(settings?.workingHours ?? null);
  const restaurantHours = parseWorkingHours(restaurantDefaults?.workingHours ?? null);

  // Parse payment methods
  const branchPayments: string[] = settings?.acceptedPaymentMethods
    ? (() => { try { return JSON.parse(settings.acceptedPaymentMethods); } catch { return []; } })()
    : [];
  const restaurantPayments = restaurantDefaults?.acceptedPaymentMethods || ['cash'];

  // Parse order types
  const branchOrderTypes = settings?.orderTypes
    ? (() => { try { return JSON.parse(settings.orderTypes); } catch { return { dineIn: true, takeaway: true }; } })()
    : null;
  const restaurantOrderTypes = restaurantDefaults?.orderTypes || { dineIn: true, takeaway: true };

  return (
    <div className="space-y-4">
      {/* Branch selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="h-4 w-4" />
            Branch Settings
          </CardTitle>
          <CardDescription>
            Override restaurant-level settings for a specific branch. Fields you don't change will inherit from the restaurant defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Select branch</Label>
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger><SelectValue placeholder="Choose a branch..." /></SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                    {branch.isMainBranch && ' (Main)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status banner */}
          {selectedBranch && (
            <div className={`rounded-md px-3 py-2 flex items-center gap-2 text-xs ${hasOverrides ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'}`}>
              {hasOverrides ? (
                <>
                  <Store className="h-3.5 w-3.5" />
                  <span className="font-medium">{selectedBranch.name} has active overrides</span>
                  <span className="ml-auto">fields below override the restaurant defaults</span>
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" />
                  <span className="font-medium">{selectedBranch.name} inherits all settings from restaurant</span>
                  <span className="ml-auto">change any field below to override</span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !settings ? (
        <div className="text-center py-8 text-sm text-muted-foreground">Select a branch to view settings.</div>
      ) : (
        <>
          {/* Tax & Service Charge */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Percent className="h-4 w-4" />Tax & Service Charge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Tax Rate */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Tax Rate (%)</Label>
                    {settings.taxRate !== null && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => update('taxRate', null)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Inherit
                      </Button>
                    )}
                  </div>
                  <Input
                    type="number" step="0.01" min="0"
                    placeholder={`Inherit (${((restaurantDefaults?.taxRate ?? 0.15) * 100).toFixed(1)}%)`}
                    value={settings.taxRate ?? ''}
                    onChange={e => update('taxRate', e.target.value === '' ? null : parseFloat(e.target.value))}
                  />
                  {settings.taxRate === null && <p className="text-[11px] text-muted-foreground">Inherits restaurant default</p>}
                </div>

                {/* Service Charge */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Service Charge (%)</Label>
                    {settings.serviceCharge !== null && (
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => update('serviceCharge', null)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Inherit
                      </Button>
                    )}
                  </div>
                  <Input
                    type="number" step="0.01" min="0"
                    placeholder={`Inherit (${((restaurantDefaults?.serviceCharge ?? 0) * 100).toFixed(1)}%)`}
                    value={settings.serviceCharge ?? ''}
                    onChange={e => update('serviceCharge', e.target.value === '' ? null : parseFloat(e.target.value))}
                  />
                  {settings.serviceCharge === null && <p className="text-[11px] text-muted-foreground">Inherits restaurant default</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Working Hours */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Working Hours</CardTitle>
                {settings.workingHours && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => update('workingHours', null)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Inherit all
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {settings.workingHours === null ? (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">Inheriting restaurant working hours</p>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                    // Initialize with restaurant defaults
                    const defaults: Record<string, { open: string; close: string }> = {};
                    DAYS.forEach(d => {
                      const rh = restaurantHours[d];
                      defaults[d] = rh ? { open: rh.open, close: rh.close } : { open: '09:00', close: '22:00' };
                    });
                    update('workingHours', JSON.stringify(defaults));
                  }}>
                    Override hours
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {DAYS.map(day => {
                    const hours = branchHours[day] || { open: '09:00', close: '22:00' };
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-xs font-medium w-8">{DAY_LABELS[day]}</span>
                        <Input
                          type="time"
                          value={hours?.open || '09:00'}
                          onChange={e => {
                            const next = { ...branchHours, [day]: { ...hours, open: e.target.value } };
                            update('workingHours', JSON.stringify(next));
                          }}
                          className="w-32 h-8 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input
                          type="time"
                          value={hours?.close || '22:00'}
                          onChange={e => {
                            const next = { ...branchHours, [day]: { ...hours, close: e.target.value } };
                            update('workingHours', JSON.stringify(next));
                          }}
                          className="w-32 h-8 text-xs"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />Accepted Payment Methods</CardTitle>
                {settings.acceptedPaymentMethods && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => update('acceptedPaymentMethods', null)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Inherit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {settings.acceptedPaymentMethods === null ? (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Inheriting restaurant payment methods</p>
                    <div className="flex gap-1 mt-1">
                      {restaurantPayments.map(pm => (
                        <Badge key={pm} variant="outline" className="text-[10px] capitalize">{pm}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                    update('acceptedPaymentMethods', JSON.stringify(restaurantPayments));
                  }}>
                    Override
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {PAYMENT_METHODS.map(method => (
                    <label key={method} className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-accent/50">
                      <Switch
                        checked={branchPayments.includes(method)}
                        onCheckedChange={checked => {
                          const next = checked
                            ? [...branchPayments, method]
                            : branchPayments.filter((m: string) => m !== method);
                          update('acceptedPaymentMethods', JSON.stringify(next));
                        }}
                      />
                      <span className="text-sm capitalize">{method}</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Types */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><UtensilsCrossed className="h-4 w-4" />Order Types</CardTitle>
                {settings.orderTypes && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => update('orderTypes', null)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Inherit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {settings.orderTypes === null ? (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Inheriting restaurant order types</p>
                    <div className="flex gap-1 mt-1">
                      {restaurantOrderTypes.dineIn && <Badge variant="outline" className="text-[10px]">Dine-in</Badge>}
                      {restaurantOrderTypes.takeaway && <Badge variant="outline" className="text-[10px]">Takeaway</Badge>}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                    update('orderTypes', JSON.stringify(restaurantOrderTypes));
                  }}>
                    Override
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-accent/50">
                    <Switch
                      checked={branchOrderTypes?.dineIn ?? true}
                      onCheckedChange={v => update('orderTypes', JSON.stringify({ ...branchOrderTypes, dineIn: v }))}
                    />
                    <span className="text-sm">Dine-in</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-accent/50">
                    <Switch
                      checked={branchOrderTypes?.takeaway ?? true}
                      onCheckedChange={v => update('orderTypes', JSON.stringify({ ...branchOrderTypes, takeaway: v }))}
                    />
                    <span className="text-sm">Takeaway</span>
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Routing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4" />Order Routing</CardTitle>
              <CardDescription className="text-xs">Control whether orders go to a waiter first or straight to the kitchen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => update('orderRouting', 'waiter_first')}
                  className={`flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors ${settings.orderRouting === 'waiter_first' ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent'}`}
                >
                  <div className="flex items-center gap-1"><Bell className="h-3 w-3" /><span className="text-[11px] font-semibold uppercase">Waiter First</span></div>
                  <p className="text-[10px] text-muted-foreground">Waiter accepts before kitchen</p>
                </button>
                <button
                  type="button"
                  onClick={() => update('orderRouting', 'direct_to_kitchen')}
                  className={`flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors ${settings.orderRouting === 'direct_to_kitchen' ? 'border-primary bg-primary/5' : 'border-input hover:bg-accent'}`}
                >
                  <div className="flex items-center gap-1"><ArrowRight className="h-3 w-3" /><span className="text-[11px] font-semibold uppercase">Direct to Kitchen</span></div>
                  <p className="text-[10px] text-muted-foreground">Auto-accept, kitchen starts immediately</p>
                </button>
                <button
                  type="button"
                  onClick={() => update('orderRouting', null)}
                  className={`flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition-colors ${settings.orderRouting === null ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-input hover:bg-accent'}`}
                >
                  <div className="flex items-center gap-1"><Globe className="h-3 w-3" /><span className="text-[11px] font-semibold uppercase">Inherit</span></div>
                  <p className="text-[10px] text-muted-foreground">Use restaurant default</p>
                </button>
              </div>
              {settings.orderRouting === null && <p className="text-[11px] text-muted-foreground mt-2">This branch inherits the restaurant-wide order routing setting.</p>}
            </CardContent>
          </Card>

          {/* POS Printer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Printer className="h-4 w-4" />POS Printer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Printer ID</Label>
                  {settings.posPrinterId && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => update('posPrinterId', null)}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Inherit
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="Inherit from restaurant"
                  value={settings.posPrinterId ?? ''}
                  onChange={e => update('posPrinterId', e.target.value || null)}
                />
                {settings.posPrinterId === null && <p className="text-[11px] text-muted-foreground">Inherits restaurant printer</p>}
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <Separator />
          <div className="flex items-center justify-between gap-2">
            {hasOverrides && (
              <Button variant="outline" size="sm" onClick={handleResetAll} disabled={saving}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset all to inherit
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {isDirty && <Badge variant="outline" className="text-amber-600 border-amber-300">Unsaved changes</Badge>}
              <Button onClick={handleSave} disabled={saving || !isDirty}>
                {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save overrides</>}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
