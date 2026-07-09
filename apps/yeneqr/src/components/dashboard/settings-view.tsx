'use client';

// ============================================================
// BRANCH SCOPING NOTE (Phase 4.5 of multi-branch audit)
// ============================================================
// This view intentionally does NOT use `useBranchChange` or pass
// `?branchId=` to API calls. Restaurant settings (payment methods,
// working hours, tax config, StarPay config, restaurant profile) are
// restaurant-level — they apply to all branches. If a future product
// decision makes settings branch-scoped (e.g., branch-specific hours
// or payment methods), add a BranchSettings model or a branchId
// column to RestaurantSettings and update this view + the settings
// API routes.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api-client';
import {
  Building,
  Clock,
  CreditCard,
  Percent,
  Plug,
  Truck,
  Gift,
  Save,
  Loader2,
  Shield,
  Smartphone,
  KeyRound,
  Copy,
  Check,
  UtensilsCrossed,
  Wallet,
  ExternalLink,
  AlertTriangle,
  Store,
  RotateCcw,
  Sparkles,
  Receipt,
  TrendingDown,
  ArrowLeft,
  Store as StoreIcon,
  DollarSign,
  Cog,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/hooks/useI18n';
import { useLanguageStore } from '@/hooks/useLanguage';
import { ImageUpload } from '@/components/ui/image-upload';
import { BranchSettingsSection } from '@/components/dashboard/branch-settings-section';
import { AIConfigPanel } from '@/components/dashboard/ai-config-panel';
import { POSIntegrationsPanel } from '@/components/dashboard/pos-integrations-panel';
import { DeliverySettingsPanel } from '@/components/dashboard/delivery-settings-panel';
import { LoyaltyRewardsPanel } from '@/components/dashboard/loyalty-rewards-panel';
import { SubscriptionPanel } from '@/components/dashboard/subscription-panel';
import { DynamicPricingPanel } from '@/components/dashboard/dynamic-pricing-panel';
import { RestaurantFeaturesSettings } from '@/components/dashboard/restaurant-features-settings';

interface RestaurantSettings {
  id: string;
  name: string;
  slug: string;
  cuisineType?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  logo?: string | null;
  banner?: string | null;
  taxRate: number;
  serviceCharge: number;
  currency: string;
  defaultLanguage: string;
  workingHours?: Record<string, { open: string; close: string; closed: boolean }> | null;
  settings?: Record<string, unknown> | null;
}

function RestaurantProfileSection({ settings, restaurantId, onSaved }: { settings: RestaurantSettings; restaurantId: string; onSaved: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(settings.name);
  const [cuisine, setCuisine] = useState(settings.cuisineType ?? '');
  const [description, setDescription] = useState(settings.description ?? '');
  const [phone, setPhone] = useState(settings.phone ?? '');
  const [email, setEmail] = useState(settings.email ?? '');
  const [address, setAddress] = useState(settings.address ?? '');
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.logo ?? null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(settings.banner ?? null);
  const [saving, setSaving] = useState(false);

  const handleLogoChange = (url: string | null) => {
    setLogoUrl(url);
    // Upload API already persists logo to DB — just refresh data
    onSaved();
  };

  const handleBannerChange = (url: string | null) => {
    setBannerUrl(url);
    // Upload API already persists banner to DB — just refresh data
    onSaved();
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/api/restaurants/${restaurantId}`, {
        name,
        cuisineType: cuisine || null,
        description: description || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
      });
      toast.success('Restaurant profile updated');
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner Upload */}
      <div className="space-y-2">
        <Label>Restaurant Banner</Label>
        <ImageUpload
          currentImage={bannerUrl}
          onImageChange={handleBannerChange}
          entity="restaurant-banner"
          entityId={restaurantId}
          size={600}
          height={200}
          shape="square"
          label="Click or drop banner image"
          className="w-full"
        />
      </div>
      {/* Logo Upload */}
      <div className="space-y-2">
        <Label>Restaurant Logo</Label>
        <ImageUpload
          currentImage={logoUrl}
          onImageChange={handleLogoChange}
          entity="restaurant-logo"
          entityId={restaurantId}
          size={120}
          height={120}
          shape="circle"
          label="Click or drop logo"
        />
      </div>
      <div className="space-y-2">
        <Label>Restaurant Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('auth.cuisine_type')}</Label>
          <Input value={cuisine} onChange={(e) => setCuisine(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('auth.phone')}</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('auth.email')}</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </div>
        <div className="space-y-2">
          <Label>{t('auth.address')}</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <Button className="gap-1.5" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t('settings.save_changes')}
      </Button>
    </div>
  );
}

function WorkingHoursSection({ settings, restaurantId, onSaved }: { settings: RestaurantSettings; restaurantId: string; onSaved: () => void }) {
  const { t } = useI18n();
  const dayKeys = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
  const dayI18nKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const [hours, setHours] = useState<Record<string, { open: string; close: string; closed: boolean }>>(
    settings.workingHours || Object.fromEntries(dayKeys.map((d) => [d, { open: '08:00', close: '22:00', closed: false }]))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/api/restaurants/${restaurantId}/settings`, {
        workingHours: hours,
      });
      toast.success('Working hours updated');
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {dayKeys.map((day, idx) => (
        <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="w-28">
            <span className="text-sm font-medium">{t(`settings.${dayI18nKeys[idx]}`)}</span>
          </div>
          <Switch
            checked={!hours[day]?.closed}
            onCheckedChange={(checked) =>
              setHours({ ...hours, [day]: { ...hours[day], closed: !checked } })
            }
          />
          {!hours[day]?.closed ? (
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={hours[day]?.open || '08:00'}
                onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], open: e.target.value } })}
                className="h-8 w-28 text-xs"
              />
              <span className="text-xs text-muted-foreground">{t('settings.to')}</span>
              <Input
                type="time"
                value={hours[day]?.close || '22:00'}
                onChange={(e) => setHours({ ...hours, [day]: { ...hours[day], close: e.target.value } })}
                className="h-8 w-28 text-xs"
              />
            </div>
          ) : (
            <Badge variant="secondary" className="text-xs">{t('settings.closed')}</Badge>
          )}
        </div>
      ))}
      <Button className="gap-1.5 mt-2" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t('settings.save_hours')}
      </Button>
    </div>
  );
}

function TaxServiceSection({ settings, restaurantId, onSaved }: { settings: RestaurantSettings; restaurantId: string; onSaved: () => void }) {
  const { t } = useI18n();
  const enabledLanguages = useLanguageStore((s) => s.enabledLanguages);
  const [taxRate, setTaxRate] = useState((settings.taxRate * 100).toFixed(0));
  const [serviceCharge, setServiceCharge] = useState((settings.serviceCharge * 100).toFixed(0));
  const [currency, setCurrency] = useState(settings.currency);
  const [defaultLanguage, setDefaultLanguage] = useState(settings.defaultLanguage);
  const [saving, setSaving] = useState(false);

  // Fiscal information (Gebioch / ERCA compliance)
  const existingFiscal = (settings.settings as Record<string, unknown>)?.fiscal as Record<string, unknown> | undefined;
  const [tin, setTin] = useState((existingFiscal?.tin as string) || '');
  const [vatNumber, setVatNumber] = useState((existingFiscal?.vat as string) || '');
  const [gebiochEnabled, setGebiochEnabled] = useState(existingFiscal?.gebiochEnabled === true);
  const [gebiochMachineId, setGebiochMachineId] = useState((existingFiscal?.gebiochMachineId as string) || '');
  const [gebiochBranchCode, setGebiochBranchCode] = useState((existingFiscal?.gebiochBranchCode as string) || '');

  // Language data is fetched by the LanguageSwitcher in the dashboard header.
  // We just read it from the store here — no duplicate fetch needed.

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/api/restaurants/${restaurantId}`, {
        taxRate: parseFloat(taxRate) / 100,
        serviceCharge: parseFloat(serviceCharge) / 100,
        currency,
        defaultLanguage,
      });
      // Save fiscal info to restaurant.settings.fiscal
      await api.put(`/api/restaurants/${restaurantId}/settings`, {
        settings: {
          fiscal: {
            tin: tin || undefined,
            vat: vatNumber || undefined,
            gebiochEnabled,
            gebiochMachineId: gebiochMachineId || undefined,
            gebiochBranchCode: gebiochBranchCode || undefined,
          },
        },
      });
      toast.success('Tax & fiscal settings updated');
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tax & Service */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('settings.tax_rate')}</Label>
          <div className="relative">
            <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('settings.service_charge_pct')}</Label>
          <Input type="number" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t('settings.currency')}</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ETB">ETB - Ethiopian Birr</SelectItem>
              <SelectItem value="USD">USD - US Dollar</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('settings.default_language')}</Label>
          <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {enabledLanguages.length > 0 ? (
                enabledLanguages
                  .filter(l => l.isActive && l.sortOrder < 1000)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.flagEmoji ? `${lang.flagEmoji} ` : ''}{lang.nameLocal}{lang.code !== lang.nameLocal ? ` (${lang.name})` : ''}
                    </SelectItem>
                  ))
              ) : (
                <>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="am">🇪🇹 አማርኛ (Amharic)</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fiscal Information (Gebioch / ERCA Compliance) */}
      <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
        <div>
          <h4 className="text-sm font-bold flex items-center gap-2">
            📋 Fiscal Information (Gebioch / ERCA)
          </h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Required for tax-compliant fiscal receipts. Appears on every printed receipt.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">TIN (Tax Identification Number)</Label>
            <Input
              type="text"
              value={tin}
              onChange={(e) => setTin(e.target.value)}
              placeholder="0012345678"
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">10-digit number from ERCA</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">VAT Registration Number</Label>
            <Input
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="VAT-1234567890"
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Required if registered for VAT</p>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-amber-200 dark:border-amber-800">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={gebiochEnabled}
              onChange={(e) => setGebiochEnabled(e.target.checked)}
              className="rounded border-amber-400"
            />
            <span className="text-xs font-medium">Enable Gebioch (electronic fiscal invoicing)</span>
          </label>
          <p className="text-[10px] text-muted-foreground pl-6">
            When enabled, receipts include Gebioch-compliant formatting. For full ERCA certification,
            connect a certified Gebioch POS via POS Integrations.
          </p>
        </div>

        {gebiochEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Gebioch Machine ID</Label>
              <Input
                type="text"
                value={gebiochMachineId}
                onChange={(e) => setGebiochMachineId(e.target.value)}
                placeholder="M001"
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">From your ERCA fiscal device registration</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Gebioch Branch Code</Label>
              <Input
                type="text"
                value={gebiochBranchCode}
                onChange={(e) => setGebiochBranchCode(e.target.value)}
                placeholder="BR001"
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Per-branch fiscal identifier</p>
            </div>
          </div>
        )}
      </div>

      <Button className="gap-1.5" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t('settings.save_settings')}
      </Button>
    </div>
  );
}

function PaymentMethodsSection({ restaurantId }: { restaurantId: string }) {
  const { t } = useI18n();
  const [telebirr, setTelebirr] = useState(true);
  const [chapa, setChapa] = useState(true);
  const [cbeBirr, setCbeBirr] = useState(false);
  const [cash, setCash] = useState(true);
  const [paymentTiming, setPaymentTiming] = useState<'after_served' | 'before_order'>('after_served');
  const [saving, setSaving] = useState(false);

  // Load current settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get(`/api/restaurants/${restaurantId}/settings`);
        const data = res.data?.data || res.data;
        const pm = data?.paymentMethods || data?.settings?.paymentMethods;
        if (pm) {
          if (pm.telebirr !== undefined) setTelebirr(pm.telebirr);
          if (pm.chapa !== undefined) setChapa(pm.chapa);
          if (pm.cbeBirr !== undefined) setCbeBirr(pm.cbeBirr);
          if (pm.cash !== undefined) setCash(pm.cash);
          if (pm.paymentTiming) setPaymentTiming(pm.paymentTiming);
        }
      } catch { /* ignore */ }
    };
    loadSettings();
  }, [restaurantId]);

  const methods = [
    { name: 'Telebirr', description: 'Mobile money by Ethio Telecom', enabled: telebirr, setEnabled: setTelebirr, icon: '📱' },
    { name: 'Chapa', description: 'Online payment gateway', enabled: chapa, setEnabled: setChapa, icon: '💳' },
    { name: 'CBE Birr', description: 'Commercial Bank of Ethiopia mobile banking', enabled: cbeBirr, setEnabled: setCbeBirr, icon: '🏦' },
    { name: 'Cash', description: 'Accept cash payments', enabled: cash, setEnabled: setCash, icon: '💵' },
  ];

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/api/restaurants/${restaurantId}/settings`, {
        paymentMethods: {
          telebirr,
          chapa,
          cbeBirr,
          cash,
          paymentTiming,
        },
      });
      toast.success('Payment settings updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Payment Timing */}
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <p className="text-sm font-medium">{t('settings.payment_timing', 'Payment Timing')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.payment_timing_desc', 'When should customers pay? Common in Ethiopia: pay after being served.')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setPaymentTiming('after_served')}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
              paymentTiming === 'after_served'
                ? 'border-brand bg-brand/5'
                : 'border-border hover:border-brand/30'
            }`}
          >
            <span className="text-2xl mt-0.5">🍽️</span>
            <div>
              <p className="text-sm font-semibold">{t('settings.pay_after_served', 'Pay After Served')}</p>
              <p className="text-xs text-muted-foreground">{t('settings.pay_after_served_desc', 'Customer orders first, pays after eating. Common in Ethiopian restaurants.')}</p>
            </div>
            {paymentTiming === 'after_served' && (
              <span className="ml-auto mt-1 text-brand text-xs font-bold">✓</span>
            )}
          </button>
          <button
            onClick={() => setPaymentTiming('before_order')}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
              paymentTiming === 'before_order'
                ? 'border-brand bg-brand/5'
                : 'border-border hover:border-brand/30'
            }`}
          >
            <span className="text-2xl mt-0.5">💳</span>
            <div>
              <p className="text-sm font-semibold">{t('settings.pay_before_order', 'Pay Before Order')}</p>
              <p className="text-xs text-muted-foreground">{t('settings.pay_before_order_desc', 'Customer selects payment method and pays before the order is placed.')}</p>
            </div>
            {paymentTiming === 'before_order' && (
              <span className="ml-auto mt-1 text-xs font-bold text-brand">✓</span>
            )}
          </button>
        </div>
      </div>

      {/* Payment Methods */}
      {methods.map((method) => (
        <div key={method.name} className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{method.icon}</span>
            <div>
              <p className="text-sm font-medium">{method.name}</p>
              <p className="text-xs text-muted-foreground">{method.description}</p>
            </div>
          </div>
          <Switch checked={method.enabled} onCheckedChange={method.setEnabled} />
        </div>
      ))}
      <Button className="gap-1.5" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t('settings.save_payment')}
      </Button>
    </div>
  );
}

// -------------------------------------------------------
// StarPay Settings Section
// -------------------------------------------------------

function StarPaySettingsSection({ restaurantId }: { restaurantId: string }) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [apiUrl, setApiUrl] = useState('https://starpayqa.starpayethiopia.com/v1/starpay-api');
  const [apiSecret, setApiSecret] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  // Fee rate is decoupled from the subscription plan — set per-restaurant
  // by the YeneQR admin team. Read-only here.
  const [feeRatePercent, setFeeRatePercent] = useState<number>(3.0);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  // Load current StarPay settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await api.get(`/api/restaurants/${restaurantId}/settings/starpay`);
        const data = res.data?.data || res.data;
        if (data) {
          setEnabled(data.enabled || false);
          setApiUrl(data.apiUrl || 'https://starpayqa.starpayethiopia.com/v1/starpay-api');
          setMerchantId(data.merchantId || '');
          setFeeRatePercent(data.feeRatePercent ?? 3.0);
          setHasCredentials(data.hasCredentials || false);
          // Don't populate secrets — they come masked from the API
          setApiSecret('');
          setWebhookSecret('');
        }
      } catch { /* ignore */ }
    };
    loadSettings();
  }, [restaurantId]);

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setConnectionStatus('idle');
      await api.put(`/api/restaurants/${restaurantId}/settings/starpay`, {
        enabled: false, // Don't enable during test
        apiUrl,
        apiSecret: apiSecret || undefined,
        merchantId,
        webhookSecret: webhookSecret || undefined,
        testConnection: true,
      });
      setConnectionStatus('success');
      toast.success('Connection test passed! StarPay API is reachable with your credentials.');
    } catch (err: unknown) {
      setConnectionStatus('failed');
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        enabled,
        apiUrl,
        merchantId,
      };

      // Only send secrets if the user entered new values
      if (apiSecret) payload.apiSecret = apiSecret;
      if (webhookSecret) payload.webhookSecret = webhookSecret;

      await api.put(`/api/restaurants/${restaurantId}/settings/starpay`, payload);
      toast.success(enabled ? 'StarPay enabled and settings saved' : 'StarPay settings saved');
      setHasCredentials(!!(apiSecret || merchantId));
      setApiSecret('');
      setWebhookSecret('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⭐</span>
          <div>
            <p className="text-sm font-medium">StarPay Ethiopia</p>
            <p className="text-xs text-muted-foreground">Accept Telebirr, Chapa, CBE Birr, cards and bank transfers through a single unified checkout</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {/* Info Banner */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
        <p className="text-xs text-blue-800 dark:text-blue-200">
          <strong>How it works:</strong> Each restaurant has its own StarPay merchant account. StarPay settles payments directly to your bank account. YeneQR charges a <strong>{feeRatePercent}%</strong> platform fee on each transaction, billed monthly via invoice. Contact us to negotiate a lower fee rate based on your transaction volume.
        </p>
      </div>

      {/* Environment Selection */}
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <Label className="text-sm font-medium">Environment</Label>
          <p className="text-xs text-muted-foreground">Use Sandbox for testing, Production for real payments</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setApiUrl('https://starpayqa.starpayethiopia.com/v1/starpay-api')}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
              apiUrl.includes('starpayqa') || apiUrl.includes('sandbox')
                ? 'border-brand bg-brand/5'
                : 'border-border hover:border-brand/30'
            }`}
          >
            <span className="text-lg">🧪</span>
            <div>
              <p className="text-sm font-semibold">Sandbox</p>
              <p className="text-xs text-muted-foreground">Test environment</p>
            </div>
          </button>
          <button
            onClick={() => setApiUrl('https://api.starpayethiopia.com/v1/starpay-api')}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
              apiUrl.includes('api.starpayethiopia') && !apiUrl.includes('starpayqa')
                ? 'border-brand bg-brand/5'
                : 'border-border hover:border-brand/30'
            }`}
          >
            <span className="text-lg">🚀</span>
            <div>
              <p className="text-sm font-semibold">Production</p>
              <p className="text-xs text-muted-foreground">Real payments</p>
            </div>
          </button>
        </div>
      </div>

      {/* API Credentials */}
      <div className="rounded-lg border p-4 space-y-4">
        <div>
          <Label className="text-sm font-medium">API Credentials</Label>
          <p className="text-xs text-muted-foreground">Get these from your StarPay merchant dashboard</p>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Merchant ID</Label>
            <Input
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="Enter your StarPay Merchant ID"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">API Secret (x-api-secret)</Label>
            <Input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={hasCredentials ? '•••••••••••••••• (enter new to change)' : 'Enter your API Secret'}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Webhook Secret (for callback verification)</Label>
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder={hasCredentials ? '•••••••••••••••• (enter new to change)' : 'Enter your Webhook Secret'}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Platform Fee Rate — read-only, set per-restaurant by YeneQR admin */}
      <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
        <div>
          <Label className="text-sm font-medium">Platform Fee Rate</Label>
          <p className="text-xs text-muted-foreground">
            Your per-transaction fee rate is set by the YeneQR team, independent of your subscription plan.
            Contact us to negotiate a lower rate based on your transaction volume.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 px-4 rounded-md border bg-background">
            <span className="text-lg font-bold text-primary">{feeRatePercent}%</span>
          </div>
          <span className="text-xs text-muted-foreground">
            = {feeRatePercent.toFixed(2)} ETB per 100 ETB transaction
          </span>
        </div>
      </div>

      {/* Webhook URL (info only) */}
      <div className="rounded-lg border p-4 space-y-2">
        <div>
          <Label className="text-sm font-medium">Webhook Callback URL</Label>
          <p className="text-xs text-muted-foreground">Add this URL to your StarPay merchant dashboard callback settings</p>
        </div>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-1.5 rounded flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/restaurants/{restaurantId}/payments/webhook/starpay
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/restaurants/${restaurantId}/payments/webhook/starpay`;
              navigator.clipboard.writeText(url);
              toast.success('Webhook URL copied');
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Connection Test */}
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <Label className="text-sm font-medium">Connection Test</Label>
          <p className="text-xs text-muted-foreground">Verify your StarPay credentials before enabling</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || !merchantId}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ExternalLink className="h-4 w-4 mr-1.5" />}
            Test Connection
          </Button>
          {connectionStatus === 'success' && (
            <Badge variant="default" className="bg-green-600">Connected</Badge>
          )}
          {connectionStatus === 'failed' && (
            <Badge variant="destructive">Failed</Badge>
          )}
        </div>
      </div>

      {/* Warning if enabling without credentials */}
      {enabled && !hasCredentials && !apiSecret && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Warning:</strong> You are enabling StarPay without configuring API credentials. Customers will see StarPay as an option but payments will fail. Please enter your Merchant ID and API Secret first.
          </p>
        </div>
      )}

      {/* Save Button */}
      <Button className="gap-1.5" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save StarPay Settings
      </Button>
    </div>
  );
}

// Security & 2FA Section
// -------------------------------------------------------

function SecuritySection() {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [setupStep, setSetupStep] = useState<'idle' | 'setup' | 'verify' | 'done'>('idle');
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Check 2FA status on mount
  useEffect(() => {
    // Read from the user object (if available from API)
    // For now, we check a simple flag
    const check2FA = async () => {
      try {
        // Try to get current user info including 2FA status
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${localStorage.getItem('yeneqr_token')}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user?.twoFactorEnabled) {
            setTwoFAEnabled(true);
            setSetupStep('done');
          }
        }
      } catch {
        // Ignore — may not be available
      }
    };
    check2FA();
  }, []);

  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('yeneqr_token');
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setSecret(data.secret);
        setQrCodeUrl(data.qrCodeUrl);
        setBackupCodes(data.backupCodes);
        setSetupStep('setup');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to setup 2FA');
      }
    } catch {
      toast.error('Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndEnable = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('yeneqr_token');
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: verifyCode }),
      });

      if (res.ok) {
        setTwoFAEnabled(true);
        setSetupStep('done');
        setVerifyCode('');
        toast.success('2FA has been enabled successfully!');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Invalid verification code');
      }
    } catch {
      toast.error('Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast.error('Please enter your current password');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('yeneqr_token');
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: disablePassword }),
      });

      if (res.ok) {
        setTwoFAEnabled(false);
        setSetupStep('idle');
        setDisablePassword('');
        setSecret('');
        setQrCodeUrl('');
        setBackupCodes([]);
        toast.success('2FA has been disabled');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to disable 2FA');
      }
    } catch {
      toast.error('Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    toast.success('Secret key copied!');
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account with TOTP-based two-factor authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {twoFAEnabled ? (
            <>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Check className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">2FA is enabled</p>
                    <p className="text-xs text-muted-foreground">Your account is protected with two-factor authentication</p>
                  </div>
                </div>
                <Badge variant="default" className="bg-emerald-600">Active</Badge>
              </div>

              {backupCodes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Backup Recovery Codes</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setShowBackupCodes(!showBackupCodes)}
                    >
                      {showBackupCodes ? 'Hide' : 'Show'} codes
                    </Button>
                  </div>
                  {showBackupCodes && (
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/50 font-mono text-xs">
                      {backupCodes.map((code, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <KeyRound className="h-3 w-3 text-muted-foreground" />
                          {code}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Store these codes in a safe place. Each code can only be used once.
                  </p>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium text-destructive">Disable 2FA</Label>
                <p className="text-xs text-muted-foreground">
                  Enter your current password to disable two-factor authentication
                </p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Current password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisable2FA}
                    disabled={loading || !disablePassword}
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Disable 2FA'}
                  </Button>
                </div>
              </div>
            </>
          ) : setupStep === 'setup' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                <p className="text-sm font-medium">Step 1: Scan QR Code</p>
                <p className="text-xs text-muted-foreground">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                {qrCodeUrl && (
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`}
                      alt="2FA QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    If you can&apos;t scan the QR code, manually enter this secret key:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-md text-xs font-mono break-all">
                      {secret}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={copySecret}
                    >
                      {copiedSecret ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Step 2: Backup Recovery Codes</p>
                <p className="text-xs text-muted-foreground">
                  Save these backup codes in a safe place. You can use them to sign in if you lose access to your authenticator.
                </p>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/50 font-mono text-xs">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <KeyRound className="h-3 w-3 text-muted-foreground" />
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm font-medium">Step 3: Verify</p>
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code from your authenticator app to confirm setup
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="max-w-[140px] text-center text-lg font-bold tracking-widest"
                    maxLength={6}
                  />
                  <Button
                    onClick={handleVerifyAndEnable}
                    disabled={loading || verifyCode.length !== 6}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable'}
                  </Button>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setSetupStep('idle')}
              >
                Cancel setup
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Shield className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">2FA is not enabled</p>
                  <p className="text-xs text-muted-foreground">
                    Protect your account with an authenticator app
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSetup2FA}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                Enable 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <PushNotificationSection />
    </div>
  );
}

// -------------------------------------------------------
// Push Notification Section
// -------------------------------------------------------

function PushNotificationSection() {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Read actual permission after hydration to avoid SSR/client mismatch
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission as PermissionState);
    }
  }, []);

  const requestPermissionAndSubscribe = async () => {
    if (!('Notification' in window)) {
      toast.error('Your browser does not support push notifications');
      return;
    }

    if (!('serviceWorker' in navigator)) {
      toast.error('Service workers are not supported in your browser');
      return;
    }

    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result !== 'granted') {
        toast.error('Notification permission was denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!vapidKey) {
        setSubscribed(true);
        toast.success('Push notifications enabled (demo mode)');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      const subJson = subscription.toJSON();
      await api.post('/api/push/subscribe', {
        endpoint: subJson.endpoint,
        p256dh: (subJson.keys as Record<string, string>)?.p256dh,
        auth: (subJson.keys as Record<string, string>)?.auth,
      });

      setSubscribed(true);
      toast.success('Push notifications enabled successfully!');
    } catch (err) {
      console.error('[PUSH_SETUP_ERROR]', err);
      toast.error('Failed to enable push notifications');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subJson = subscription.toJSON();
        await subscription.unsubscribe();
        await api.delete('/api/push/subscribe');
      }

      setSubscribed(false);
      toast.success('Push notifications disabled');
    } catch (err) {
      console.error('[PUSH_UNSUBSCRIBE_ERROR]', err);
      toast.error('Failed to disable push notifications');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive instant push notifications for new orders, waiter calls, and payment alerts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status</span>
              {permission === 'granted' || subscribed ? (
                <Badge variant="default" className="text-xs gap-1">
                  <Check className="h-3 w-3" /> Enabled
                </Badge>
              ) : permission === 'denied' ? (
                <Badge variant="destructive" className="text-xs gap-1">
                  Blocked
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  Not configured
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {permission === 'denied'
                ? 'Push notifications are blocked by your browser. Please update your browser settings.'
                : subscribed
                  ? 'You will receive push notifications for critical events.'
                  : 'Enable push notifications to get real-time alerts.'}
            </p>
          </div>
          <Button
            size="sm"
            variant={subscribed ? 'outline' : 'default'}
            className="gap-1.5"
            disabled={loading || permission === 'denied'}
            onClick={subscribed ? unsubscribe : requestPermissionAndSubscribe}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : subscribed ? (
              'Disable'
            ) : (
              'Enable'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MenuDisplaySection({ settings, restaurantId, onSaved }: { settings: RestaurantSettings; restaurantId: string; onSaved: () => void }) {
  const { t } = useI18n();
  const parsedSettings = (settings.settings || {}) as Record<string, unknown>;
  const [showServingSize, setShowServingSize] = useState(parsedSettings.showServingSize !== false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/api/restaurants/${restaurantId}/settings`, {
        showServingSize,
      });
      toast.success('Menu display settings updated');
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Show Serving Size</Label>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            When enabled, customers will see a serving size selector for menu items that have serving size modifier groups. 
            Disable this if your restaurant typically doesn&apos;t offer different portion sizes (e.g., traditional Ethiopian cuisine). 
            You can also override this per individual menu item.
          </p>
        </div>
        <Switch checked={showServingSize} onCheckedChange={setShowServingSize} />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Menu Display Settings
        </Button>
      </div>
    </div>
  );
}

export function SettingsView() {
  const { user } = useAppStore();
  const { t } = useI18n(user?.restaurantId);
  const restaurantId = user?.restaurantId || '';

  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Active setting panel (null = show category cards grid)
  // MUST be declared before any early returns (Rules of Hooks)
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const res = await api.get<{ data: RestaurantSettings }>(`/api/restaurants/${restaurantId}`);
      if (res.data) {
        setSettings(res.data);
      }
    } catch (err) {
      // Silently handle — show empty state
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-muted-foreground mb-3">Failed to load settings</p>
        <Button size="sm" onClick={() => { setLoadError(false); setLoading(true); fetchSettings(); }}>Retry</Button>
      </div>
    );
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="ml-2 text-muted-foreground">{t('dashboard.loading_settings')}</span>
      </div>
    );
  }

  // Setting categories — each is a card on the settings home page
  const categories = [
    {
      id: 'restaurant',
      title: 'Restaurant',
      icon: Building,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
      description: 'Profile, working hours, brand',
      items: [
        { value: 'profile', label: 'Restaurant Profile', icon: Building, description: 'Name, logo, cuisine, contact info' },
        { value: 'hours', label: 'Working Hours', icon: Clock, description: 'Daily operating schedule' },
      ],
    },
    {
      id: 'fiscal',
      title: 'Tax & Fiscal',
      icon: Percent,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
      borderColor: 'border-purple-200 dark:border-purple-800',
      description: 'Tax rates, VAT, Gebioch compliance',
      items: [
        { value: 'tax', label: 'Tax & Service', icon: Percent, description: 'Tax rate, service charge, VAT, TIN, Gebioch' },
      ],
    },
    {
      id: 'menu',
      title: 'Menu',
      icon: UtensilsCrossed,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      borderColor: 'border-orange-200 dark:border-orange-800',
      description: 'How menu appears to customers',
      items: [
        { value: 'menu-display', label: 'Menu Display', icon: UtensilsCrossed, description: 'Display options, serving sizes' },
        { value: 'dynamic-pricing', label: 'Dynamic Pricing', icon: TrendingDown, description: 'Happy hour, time-based pricing' },
      ],
    },
    {
      id: 'payments',
      title: 'Payments',
      icon: CreditCard,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800',
      description: 'Payment methods, gateways, billing',
      items: [
        { value: 'payments', label: 'Payment Methods', icon: CreditCard, description: 'Cash, Telebirr, Chapa, CBE Birr' },
        { value: 'starpay', label: 'StarPay', icon: Wallet, description: 'StarPay Ethiopia gateway config' },
        { value: 'subscription', label: 'Subscription & Billing', icon: Receipt, description: 'Plan, invoices, billing history' },
      ],
    },
    {
      id: 'branches',
      title: 'Branches',
      icon: StoreIcon,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
      description: 'Per-branch settings overrides',
      items: [
        { value: 'branches', label: 'Branch Settings', icon: Store, description: 'Order routing, branch-specific config' },
      ],
    },
    {
      id: 'operations',
      title: 'Operations',
      icon: Cog,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      description: 'Delivery, loyalty, POS integrations',
      items: [
        { value: 'delivery', label: 'Delivery', icon: Truck, description: 'Delivery zones, addresses, fees' },
        { value: 'loyalty', label: 'Loyalty Rewards', icon: Gift, description: 'Points, tiers, reward catalog' },
        { value: 'pos', label: 'POS Integration', icon: Plug, description: 'External POS webhook sync' },
      ],
    },
    {
      id: 'ai',
      title: 'AI & Automation',
      icon: Sparkles,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50 dark:bg-pink-950/30',
      borderColor: 'border-pink-200 dark:border-pink-800',
      description: 'AI provider, translation, suggestions',
      items: [
        { value: 'ai', label: 'AI Configuration', icon: Sparkles, description: 'OpenAI/Gemini/Anthropic, per-restaurant keys' },
      ],
    },
    {
      id: 'security',
      title: 'Security',
      icon: Shield,
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      borderColor: 'border-red-200 dark:border-red-800',
      description: '2FA, sessions, API keys',
      items: [
        { value: 'security', label: 'Security & Access', icon: Shield, description: 'Two-factor auth, active sessions' },
      ],
    },
  ];

  // Find which category the active panel belongs to (for the back button)
  const activeCategory = activePanel
    ? categories.find(cat => cat.items.some(item => item.value === activePanel))
    : null;

  // Render the active panel's content
  const renderPanelContent = (panel: string) => {
    switch (panel) {
      case 'profile':
        return <RestaurantProfileSection settings={settings} restaurantId={restaurantId} onSaved={fetchSettings} />;
      case 'hours':
        return <WorkingHoursSection settings={settings} restaurantId={restaurantId} onSaved={fetchSettings} />;
      case 'tax':
        return <TaxServiceSection settings={settings} restaurantId={restaurantId} onSaved={fetchSettings} />;
      case 'menu-display':
        return <MenuDisplaySection settings={settings} restaurantId={restaurantId} onSaved={fetchSettings} />;
      case 'payments':
        return <PaymentMethodsSection restaurantId={restaurantId} />;
      case 'starpay':
        return <StarPaySettingsSection restaurantId={restaurantId} />;
      case 'security':
        return <SecuritySection />;
      case 'branches':
        return <BranchSettingsSection restaurantId={restaurantId} />;
      case 'ai':
        return <AIConfigPanel restaurantId={restaurantId} />;
      case 'pos':
        return <POSIntegrationsPanel restaurantId={restaurantId} />;
      case 'delivery':
        return <DeliverySettingsPanel restaurantId={restaurantId} />;
      case 'loyalty':
        return <LoyaltyRewardsPanel restaurantId={restaurantId} />;
      case 'subscription':
        return <SubscriptionPanel restaurantId={restaurantId} />;
      case 'dynamic-pricing':
        return <DynamicPricingPanel restaurantId={restaurantId} />;
      default:
        return null;
    }
  };

  // If a panel is active, show it with a back button
  if (activePanel) {
    const activeItem = activeCategory?.items.find(item => item.value === activePanel);
    return (
      <div className="space-y-4 max-w-3xl">
        <button
          onClick={() => setActivePanel(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </button>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            {activeItem?.icon && <activeItem.icon className="h-5 w-5" />}
            {activeItem?.label}
          </h2>
          {activeItem?.description && (
            <p className="text-sm text-muted-foreground mt-1">{activeItem.description}</p>
          )}
        </div>
        <Card>
          <CardContent className="pt-6">
            {renderPanelContent(activePanel)}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show the categorized cards grid
  return (

    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your restaurant configuration. Select a category to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div key={cat.id} className={`rounded-2xl border-2 ${cat.borderColor} ${cat.bgColor} p-4`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-2 rounded-xl bg-background/80 ${cat.color}`}>
                <cat.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{cat.title}</h3>
                <p className="text-[10px] text-muted-foreground">{cat.description}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {cat.items.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setActivePanel(item.value)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-background/60 hover:bg-background hover:shadow-sm transition-all text-left group"
                >
                  <item.icon className={`h-4 w-4 ${cat.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground/40 rotate-180 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
