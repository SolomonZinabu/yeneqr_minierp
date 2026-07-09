'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Save,
  Loader2,
  UtensilsCrossed,
  ShoppingBag,
  Package,
  Truck,
  Sparkles,
  Gamepad2,
  Bell,
  Heart,
  Ticket,
  Star,
  ChefHat,
  Clock,
  Settings,
  Info,
  Route,
  ArrowRight,
} from 'lucide-react';

// ==================== Types ====================

interface FeatureSettings {
  // Order Types
  orderTypes: {
    dineIn: boolean;
    takeaway: boolean;
    delivery: boolean;
  };
  // Packaging
  packaging: {
    enabled: boolean;
    feeType: 'per_order' | 'per_item';
    feeCents: number;
  };
  // Entertainment
  entertainment: {
    hubEnabled: boolean;
    games: {
      snake: boolean;
      '2048': boolean;
      memory: boolean;
      trivia: boolean;
    };
    contentTypes: {
      facts: boolean;
      stories: boolean;
      reads: boolean;
    };
  };
  // Waiter Calls
  waiterCalls: {
    enabled: boolean;
    cooldownSeconds: number;
    requestTypes: {
      call_waiter: boolean;
      request_bill: boolean;
      request_menu: boolean;
      custom: boolean;
    };
  };
  // Loyalty
  loyalty: {
    enabled: boolean;
    pointsPerAmount: number;
    pointValue: number;
  };
  // Promotions
  promotions: {
    couponSystemEnabled: boolean;
  };
  // Reviews
  reviews: {
    enabled: boolean;
    autoPromptAfterOrder: boolean;
  };
  // Kitchen
  kitchen: {
    autoAcceptTimeout: number;
    stationRouting: boolean;
    // 'waiter_first' (default) — new orders land in 'pending' for a waiter/manager to accept
    // 'direct_to_kitchen' — new orders auto-accept to 'accepted' so kitchen starts cooking immediately
    orderRouting: 'waiter_first' | 'direct_to_kitchen';
  };
}

const defaultSettings: FeatureSettings = {
  orderTypes: {
    dineIn: true,
    takeaway: true,
    delivery: false,
  },
  packaging: {
    enabled: true,
    feeType: 'per_order',
    feeCents: 0,
  },
  entertainment: {
    hubEnabled: true,
    games: { snake: true, '2048': true, memory: true, trivia: true },
    contentTypes: { facts: true, stories: true, reads: true },
  },
  waiterCalls: {
    enabled: true,
    cooldownSeconds: 30,
    requestTypes: { call_waiter: true, request_bill: true, request_menu: true, custom: false },
  },
  loyalty: {
    enabled: false,
    pointsPerAmount: 100,
    pointValue: 1,
  },
  promotions: {
    couponSystemEnabled: true,
  },
  reviews: {
    enabled: true,
    autoPromptAfterOrder: false,
  },
  kitchen: {
    autoAcceptTimeout: 0,
    stationRouting: false,
    orderRouting: 'waiter_first',
  },
};

// ==================== Component ====================

export function RestaurantFeaturesSettings() {
  const { user } = useAppStore();
  const restaurantId = user?.restaurantId || '';

  const [settings, setSettings] = useState<FeatureSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ==================== Fetch Settings ====================

  const fetchSettings = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await api.get<{
        data: { settings: Record<string, unknown> | null };
      }>(`/api/restaurants/${restaurantId}/settings`);

      const rawSettings = res.data?.settings as Record<string, unknown> | null;
      if (rawSettings) {
        setSettings({
          orderTypes: {
            dineIn: (rawSettings.orderTypes as Record<string, boolean>)?.dineIn !== false,
            takeaway: (rawSettings.orderTypes as Record<string, boolean>)?.takeaway !== false,
            delivery: (rawSettings.orderTypes as Record<string, boolean>)?.delivery === true,
          },
          packaging: {
            enabled: (rawSettings.packaging as Record<string, unknown>)?.enabled !== false,
            feeType: ((rawSettings.packaging as Record<string, unknown>)?.feeType as string) || 'per_order',
            feeCents: (rawSettings.packaging as Record<string, unknown>)?.feeCents as number || 0,
          },
          entertainment: {
            hubEnabled:
              (rawSettings.entertainment as Record<string, unknown>)?.hubEnabled !== false,
            games: {
              snake:
                ((rawSettings.entertainment as Record<string, unknown>)?.games as Record<string, boolean>)?.snake !== false,
              '2048':
                ((rawSettings.entertainment as Record<string, unknown>)?.games as Record<string, boolean>)?.['2048'] !== false,
              memory:
                ((rawSettings.entertainment as Record<string, unknown>)?.games as Record<string, boolean>)?.memory !== false,
              trivia:
                ((rawSettings.entertainment as Record<string, unknown>)?.games as Record<string, boolean>)?.trivia !== false,
            },
            contentTypes: {
              facts:
                ((rawSettings.entertainment as Record<string, unknown>)?.contentTypes as Record<string, boolean>)?.facts !== false,
              stories:
                ((rawSettings.entertainment as Record<string, unknown>)?.contentTypes as Record<string, boolean>)?.stories !== false,
              reads:
                ((rawSettings.entertainment as Record<string, unknown>)?.contentTypes as Record<string, boolean>)?.reads !== false,
            },
          },
          waiterCalls: {
            enabled: (rawSettings.waiterCalls as Record<string, unknown>)?.enabled !== false,
            cooldownSeconds:
              (rawSettings.waiterCalls as Record<string, unknown>)?.cooldownSeconds as number ?? 30,
            requestTypes: {
              // Use snake_case keys matching backend enum; fall back to legacy camelCase keys
              call_waiter:
                ((rawSettings.waiterCalls as Record<string, unknown>)?.requestTypes as Record<string, boolean>)?.call_waiter
                ?? ((rawSettings.waiterCalls as Record<string, unknown>)?.requestTypes as Record<string, boolean>)?.callWaiter !== false,
              request_bill:
                ((rawSettings.waiterCalls as Record<string, unknown>)?.requestTypes as Record<string, boolean>)?.request_bill
                ?? ((rawSettings.waiterCalls as Record<string, unknown>)?.requestTypes as Record<string, boolean>)?.requestBill !== false,
              request_menu:
                ((rawSettings.waiterCalls as Record<string, unknown>)?.requestTypes as Record<string, boolean>)?.request_menu
                ?? ((rawSettings.waiterCalls as Record<string, unknown>)?.requestTypes as Record<string, boolean>)?.requestMenu !== false,
              custom:
                ((rawSettings.waiterCalls as Record<string, unknown>)?.requestTypes as Record<string, boolean>)?.custom === true,
            },
          },
          loyalty: {
            enabled: (rawSettings.loyalty as Record<string, unknown>)?.enabled === true,
            pointsPerAmount:
              (rawSettings.loyalty as Record<string, unknown>)?.pointsPerAmount as number ?? 100,
            pointValue: (rawSettings.loyalty as Record<string, unknown>)?.pointValue as number ?? 1,
          },
          promotions: {
            couponSystemEnabled:
              (rawSettings.promotions as Record<string, unknown>)?.couponSystemEnabled !== false,
          },
          reviews: {
            enabled: (rawSettings.reviews as Record<string, unknown>)?.enabled !== false,
            autoPromptAfterOrder:
              (rawSettings.reviews as Record<string, unknown>)?.autoPromptAfterOrder === true,
          },
          kitchen: {
            autoAcceptTimeout:
              (rawSettings.kitchen as Record<string, unknown>)?.autoAcceptTimeout as number ?? 0,
            stationRouting:
              (rawSettings.kitchen as Record<string, unknown>)?.stationRouting === true,
            orderRouting:
              ((rawSettings.kitchen as Record<string, unknown>)?.orderRouting === 'direct_to_kitchen')
                ? 'direct_to_kitchen'
                : 'waiter_first',
          },
        });
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ==================== Save ====================

  const handleSave = async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      await api.put(`/api/restaurants/${restaurantId}/settings`, {
        settings,
      });
      toast.success('Feature settings saved successfully');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ==================== Nested State Updaters ====================

  const updateOrderTypes = (key: keyof FeatureSettings['orderTypes'], value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      orderTypes: { ...prev.orderTypes, [key]: value },
    }));
  };

  const updateEntertainment = (
    path: string,
    value: boolean | number | string
  ) => {
    setSettings((prev) => {
      const ent = { ...prev.entertainment };
      if (path === 'hubEnabled') {
        ent.hubEnabled = value as boolean;
      } else if (path.startsWith('games.')) {
        const gameKey = path.replace('games.', '') as keyof typeof ent.games;
        ent.games = { ...ent.games, [gameKey]: value as boolean };
      } else if (path.startsWith('contentTypes.')) {
        const ctKey = path.replace('contentTypes.', '') as keyof typeof ent.contentTypes;
        ent.contentTypes = { ...ent.contentTypes, [ctKey]: value as boolean };
      }
      return { ...prev, entertainment: ent };
    });
  };

  const updateWaiterCalls = (
    path: string,
    value: boolean | number
  ) => {
    setSettings((prev) => {
      const wc = { ...prev.waiterCalls };
      if (path === 'enabled') wc.enabled = value as boolean;
      else if (path === 'cooldownSeconds') wc.cooldownSeconds = value as number;
      else if (path.startsWith('requestTypes.')) {
        const rtKey = path.replace('requestTypes.', '') as keyof typeof wc.requestTypes;
        wc.requestTypes = { ...wc.requestTypes, [rtKey]: value as boolean };
      }
      return { ...prev, waiterCalls: wc };
    });
  };

  const updateLoyalty = (
    path: string,
    value: boolean | number
  ) => {
    setSettings((prev) => {
      const loy = { ...prev.loyalty };
      if (path === 'enabled') loy.enabled = value as boolean;
      else if (path === 'pointsPerAmount') loy.pointsPerAmount = value as number;
      else if (path === 'pointValue') loy.pointValue = value as number;
      return { ...prev, loyalty: loy };
    });
  };

  const updatePackaging = (
    path: string,
    value: boolean | number | string
  ) => {
    setSettings((prev) => {
      const pkg = { ...prev.packaging };
      if (path === 'enabled') pkg.enabled = value as boolean;
      else if (path === 'feeType') pkg.feeType = value as 'per_order' | 'per_item';
      else if (path === 'feeCents') pkg.feeCents = value as number;
      return { ...prev, packaging: pkg };
    });
  };

  // ==================== Render ====================

  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">No restaurant selected</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading feature settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Feature Configuration
          </h2>
          <p className="text-sm text-muted-foreground">
            Enable or disable features for your restaurant
          </p>
        </div>
        <Button className="gap-1.5" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All
        </Button>
      </div>

      {/* ==================== Order Types ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <UtensilsCrossed className="h-4 w-4 text-emerald-600" />
            </div>
            Order Types
          </CardTitle>
          <CardDescription>Choose which ordering methods are available to customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Dine-in</p>
                <p className="text-xs text-muted-foreground">Customers order at their table</p>
              </div>
            </div>
            <Switch
              checked={settings.orderTypes.dineIn}
              onCheckedChange={(v) => updateOrderTypes('dineIn', v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Takeaway</p>
                <p className="text-xs text-muted-foreground">Customers pick up their order</p>
              </div>
            </div>
            <Switch
              checked={settings.orderTypes.takeaway}
              onCheckedChange={(v) => updateOrderTypes('takeaway', v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Delivery</p>
                <p className="text-xs text-muted-foreground">Deliver orders to customers</p>
              </div>
            </div>
            <Switch
              checked={settings.orderTypes.delivery}
              onCheckedChange={(v) => updateOrderTypes('delivery', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ==================== Packaging Charges ==================== */}
      {settings.orderTypes.takeaway && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
                <ShoppingBag className="h-4 w-4 text-indigo-600" />
              </div>
              Packaging Charges
            </CardTitle>
            <CardDescription>Configure packaging fees for takeaway orders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Enable Packaging Fee</p>
                <p className="text-xs text-muted-foreground">
                  Add packaging charges to takeaway orders
                </p>
              </div>
              <Switch
                checked={settings.packaging.enabled}
                onCheckedChange={(v) => updatePackaging('enabled', v)}
              />
            </div>

            {settings.packaging.enabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Fee Type
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={settings.packaging.feeType === 'per_order' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updatePackaging('feeType', 'per_order')}
                    >
                      Per Order
                    </Button>
                    <Button
                      type="button"
                      variant={settings.packaging.feeType === 'per_item' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updatePackaging('feeType', 'per_item')}
                    >
                      Per Item
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Fee Amount (ETB)</Label>
                  <Input
                    type="number"
                    value={settings.packaging.feeCents / 100}
                    onChange={(e) =>
                      updatePackaging(
                        'feeCents',
                        Math.round((parseFloat(e.target.value) || 0) * 100)
                      )
                    }
                    min="0"
                    step="0.01"
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.packaging.feeType === 'per_order'
                      ? `Fixed fee per takeaway order: ${formatETB(settings.packaging.feeCents / 100)}`
                      : `Fee per item in takeaway order: ${formatETB(settings.packaging.feeCents / 100)}`}
                  </p>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Per Order: fixed fee per takeaway order &nbsp;|&nbsp; Per Item: fee multiplied by total items
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ==================== Entertainment ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
              <Sparkles className="h-4 w-4 text-purple-600" />
            </div>
            Entertainment
          </CardTitle>
          <CardDescription>Configure games and content for waiting customers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hub Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Entertainment Hub</p>
              <p className="text-xs text-muted-foreground">Show games and content to customers</p>
            </div>
            <Switch
              checked={settings.entertainment.hubEnabled}
              onCheckedChange={(v) => updateEntertainment('hubEnabled', v)}
            />
          </div>

          {/* Games */}
          {settings.entertainment.hubEnabled && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4" />
                  Available Games
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'snake' as const, label: 'Snake', emoji: '🐍' },
                    { key: '2048' as const, label: '2048', emoji: '🔢' },
                    { key: 'memory' as const, label: 'Memory', emoji: '🧠' },
                    { key: 'trivia' as const, label: 'Trivia', emoji: '❓' },
                  ].map((game) => (
                    <div
                      key={game.key}
                      className="flex items-center justify-between rounded-lg border p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{game.emoji}</span>
                        <span className="text-sm">{game.label}</span>
                      </div>
                      <Switch
                        checked={settings.entertainment.games[game.key]}
                        onCheckedChange={(v) => updateEntertainment(`games.${game.key}`, v)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Content Types */}
              <div>
                <p className="text-sm font-medium mb-2">Content Types</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'facts' as const, label: 'Facts' },
                    { key: 'stories' as const, label: 'Stories' },
                    { key: 'reads' as const, label: 'Reads' },
                  ].map((ct) => (
                    <div
                      key={ct.key}
                      className="flex items-center justify-between rounded-lg border p-2.5"
                    >
                      <span className="text-sm">{ct.label}</span>
                      <Switch
                        checked={settings.entertainment.contentTypes[ct.key]}
                        onCheckedChange={(v) =>
                          updateEntertainment(`contentTypes.${ct.key}`, v)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ==================== Waiter Calls ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Bell className="h-4 w-4 text-amber-600" />
            </div>
            Waiter Calls
          </CardTitle>
          <CardDescription>Configure how customers can call for service</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Enable Waiter Calls</p>
              <p className="text-xs text-muted-foreground">
                Allow customers to call waiters from the menu
              </p>
            </div>
            <Switch
              checked={settings.waiterCalls.enabled}
              onCheckedChange={(v) => updateWaiterCalls('enabled', v)}
            />
          </div>

          {settings.waiterCalls.enabled && (
            <>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Cooldown (seconds)
                </Label>
                <Input
                  type="number"
                  value={settings.waiterCalls.cooldownSeconds}
                  onChange={(e) =>
                    updateWaiterCalls('cooldownSeconds', parseInt(e.target.value) || 0)
                  }
                  min="0"
                  max="300"
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum time between calls from the same table
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Available Request Types</p>
                <div className="space-y-2">
                  {[
                    {
                      key: 'call_waiter' as const,
                      label: 'Call Waiter',
                      desc: 'General waiter call',
                    },
                    {
                      key: 'request_bill' as const,
                      label: 'Request Bill',
                      desc: 'Ask for the check',
                    },
                    {
                      key: 'request_menu' as const,
                      label: 'Request Menu',
                      desc: 'View the menu again',
                    },
                    {
                      key: 'custom' as const,
                      label: 'Custom Request',
                      desc: 'Free-text message to staff',
                    },
                  ].map((rt) => (
                    <div
                      key={rt.key}
                      className="flex items-center justify-between rounded-lg border p-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium">{rt.label}</p>
                        <p className="text-xs text-muted-foreground">{rt.desc}</p>
                      </div>
                      <Switch
                        checked={settings.waiterCalls.requestTypes[rt.key]}
                        onCheckedChange={(v) =>
                          updateWaiterCalls(`requestTypes.${rt.key}`, v)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ==================== Loyalty Program ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10">
              <Heart className="h-4 w-4 text-rose-600" />
            </div>
            Loyalty Program
          </CardTitle>
          <CardDescription>Reward repeat customers with loyalty points</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Enable Loyalty Program</p>
              <p className="text-xs text-muted-foreground">
                Customers earn points on every order
              </p>
            </div>
            <Switch
              checked={settings.loyalty.enabled}
              onCheckedChange={(v) => updateLoyalty('enabled', v)}
            />
          </div>

          {settings.loyalty.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Points per Amount (ETB)</Label>
                  <Input
                    type="number"
                    value={settings.loyalty.pointsPerAmount}
                    onChange={(e) =>
                      updateLoyalty('pointsPerAmount', parseInt(e.target.value) || 0)
                    }
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Points earned per {settings.loyalty.pointsPerAmount} ETB spent
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Point Value (ETB)</Label>
                  <Input
                    type="number"
                    value={settings.loyalty.pointValue}
                    onChange={(e) =>
                      updateLoyalty('pointValue', parseFloat(e.target.value) || 0)
                    }
                    min="0.01"
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground">
                    1 point = {settings.loyalty.pointValue} ETB discount value
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  Example: A customer spending 500 ETB earns{' '}
                  <strong>
                    {Math.floor(500 / settings.loyalty.pointsPerAmount)} points
                  </strong>{' '}
                  (worth{' '}
                  {formatETB(
                    Math.floor(500 / settings.loyalty.pointsPerAmount) *
                      settings.loyalty.pointValue
                  )}
                  )
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ==================== Promotions ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
              <Ticket className="h-4 w-4 text-teal-600" />
            </div>
            Promotions
          </CardTitle>
          <CardDescription>Configure coupon and promotion features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Coupon System</p>
              <p className="text-xs text-muted-foreground">
                Allow creating and redeeming promo codes
              </p>
            </div>
            <Switch
              checked={settings.promotions.couponSystemEnabled}
              onCheckedChange={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  promotions: { couponSystemEnabled: v },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* ==================== Reviews ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
              <Star className="h-4 w-4 text-yellow-600" />
            </div>
            Reviews
          </CardTitle>
          <CardDescription>Configure customer review and rating features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Enable Reviews</p>
              <p className="text-xs text-muted-foreground">
                Allow customers to rate and review their experience
              </p>
            </div>
            <Switch
              checked={settings.reviews.enabled}
              onCheckedChange={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  reviews: { ...prev.reviews, enabled: v },
                }))
              }
            />
          </div>
          {settings.reviews.enabled && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Auto-Prompt After Order</p>
                <p className="text-xs text-muted-foreground">
                  Automatically ask for a review after order completion
                </p>
              </div>
              <Switch
                checked={settings.reviews.autoPromptAfterOrder}
                onCheckedChange={(v) =>
                  setSettings((prev) => ({
                    ...prev,
                    reviews: { ...prev.reviews, autoPromptAfterOrder: v },
                  }))
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== Kitchen ==================== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
              <ChefHat className="h-4 w-4 text-orange-600" />
            </div>
            Kitchen
          </CardTitle>
          <CardDescription>Configure kitchen workflow and routing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Order Routing Mode (waiter-first vs direct-to-kitchen) ── */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-start gap-2">
              <Route className="h-4 w-4 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium">Order Routing</p>
                <p className="text-xs text-muted-foreground">
                  Control whether new orders go to a waiter for acceptance first, or fire straight to the kitchen.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    kitchen: { ...prev.kitchen, orderRouting: 'waiter_first' },
                  }))
                }
                className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors ${
                  settings.kitchen.orderRouting === 'waiter_first'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                    : 'border-input hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Waiter First</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Orders land in <span className="font-medium">Pending</span>. A waiter or manager must accept before the kitchen starts cooking.
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Best for full-service restaurants where the waiter confirms the order with the customer.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSettings((prev) => ({
                    ...prev,
                    kitchen: { ...prev.kitchen, orderRouting: 'direct_to_kitchen' },
                  }))
                }
                className={`flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors ${
                  settings.kitchen.orderRouting === 'direct_to_kitchen'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                    : 'border-input hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Direct to Kitchen</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Orders are <span className="font-medium">auto-accepted</span>. Kitchen can start preparing immediately — the waiter is still assigned for delivery but skips the accept step.
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Best for fast-casual, QSR, kiosks, or busy shifts where the waiter would rubber-stamp every order.
                </p>
              </button>
            </div>

            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                This is the restaurant-wide default. Individual branches can override it from <span className="font-medium">Settings → Branch Settings</span>.
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Auto-Accept Timeout (seconds)</Label>
            <Input
              type="number"
              value={settings.kitchen.autoAcceptTimeout}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  kitchen: {
                    ...prev.kitchen,
                    autoAcceptTimeout: parseInt(e.target.value) || 0,
                  },
                }))
              }
              min="0"
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              {settings.kitchen.autoAcceptTimeout === 0
                ? 'Orders require manual acceptance (no auto-accept)'
                : `Orders auto-accepted after ${settings.kitchen.autoAcceptTimeout}s if not acknowledged`}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Station Routing</p>
              <p className="text-xs text-muted-foreground">
                Route items to specific kitchen stations (e.g., grill, drinks)
              </p>
            </div>
            <Switch
              checked={settings.kitchen.stationRouting}
              onCheckedChange={(v) =>
                setSettings((prev) => ({
                  ...prev,
                  kitchen: { ...prev.kitchen, stationRouting: v },
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Footer */}
      <div className="flex justify-end pt-2">
        <Button className="gap-1.5" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}

function formatETB(amount: number): string {
  return `${amount.toLocaleString('en-US')} ETB`;
}
