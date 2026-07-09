'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from '@/lib/router';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/hooks/useI18n';
import { useLanguageStore } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import {
  QrCode,
  Shield,
  Check,
  ArrowRight,
  Zap,
  Globe,
  Clock,
  CreditCard,
  BarChart3,
  Star,
  Loader2,
  Store,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/dashboard/language-switcher';
import { UATTestingSection } from '@/components/landing/uat-testing';
import { api } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';


export function LandingPage() {
  const { navigate } = useRouter();
  const user = useAppStore((s) => s.user);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const { t } = useI18n(); // platform-level UI strings (no restaurantId)
  const language = useLanguageStore((s) => s.language);


  // If already authenticated, redirect appropriately
  React.useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'super_admin' || user.role === 'support_admin') {
        navigate('/admin');
      } else if (user.restaurantSlug) {
        navigate(`/${user.restaurantSlug}/dashboard`);
      }
    }
  }, [isAuthenticated, user, navigate]);



  // ── Feature data using t() for translations ──
  const features = [
    {
      icon: QrCode,
      titleKey: 'landing.feature.qr_ordering.title',
      titleDefault: 'QR-Powered Ordering',
      descKey: 'landing.feature.qr_ordering.desc',
      descDefault: 'Generate unique QR codes per table. Customers scan, browse your menu, and order instantly — no app download needed.',
    },
    {
      icon: Globe,
      titleKey: 'landing.feature.multilingual.title',
      titleDefault: 'Multilingual Menus',
      descKey: 'landing.feature.multilingual.desc',
      descDefault: '13 languages supported with automatic detection. Your customers see the menu in their preferred language automatically.',
    },
    {
      icon: Clock,
      titleKey: 'landing.feature.kitchen.title',
      titleDefault: 'Kitchen Display System',
      descKey: 'landing.feature.kitchen.desc',
      descDefault: 'Real-time kitchen display with station filtering, preparation timers, and automatic order routing to the right station.',
    },
    {
      icon: CreditCard,
      titleKey: 'landing.feature.payments.title',
      titleDefault: 'Ethiopian Payments',
      descKey: 'landing.feature.payments.desc',
      descDefault: 'Accept Telebirr, Chapa, CBE Birr, and cash. Provider-agnostic architecture means adding new payment methods is seamless.',
    },
    {
      icon: BarChart3,
      titleKey: 'landing.feature.analytics.title',
      titleDefault: 'Smart Analytics',
      descKey: 'landing.feature.analytics.desc',
      descDefault: 'Track sales, popular items, peak hours, table turnover, and average order value. Make data-driven decisions for your restaurant.',
    },
    {
      icon: Star,
      titleKey: 'landing.feature.engagement.title',
      titleDefault: 'Customer Engagement',
      descKey: 'landing.feature.engagement.desc',
      descDefault: 'Loyalty points, promotions, happy hour deals, and post-order feedback. Keep your customers coming back.',
    },
  ];

  // ── Pricing plans — fetched dynamically from DB ──
  const [dbPlans, setDbPlans] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    yearlyPriceCents: number | null;
    features: string[];
    limits: { maxBranches: number; maxTables: number; maxStaff: number; maxMenuItems: number };
    isFree: boolean;
    isPopular: boolean;
    sortOrder: number;
  }> | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: Array<{
          id: string;
          name: string;
          description: string | null;
          priceCents: number;
          yearlyPriceCents: number | null;
          features: string[];
          limits: { maxBranches: number; maxTables: number; maxStaff: number; maxMenuItems: number };
          isFree: boolean;
          isPopular: boolean;
          sortOrder: number;
        }> }>('/api/plans');
        if (!cancelled && res.data && res.data.length > 0) {
          setDbPlans(res.data);
        }
      } catch {
        // Fallback to hardcoded plans if API fails
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Use dynamic plans from DB if available, otherwise fallback to static
  const plans = dbPlans ? dbPlans.map(p => ({
    nameKey: '',
    nameDefault: p.name,
    priceKey: '',
    priceDefault: p.isFree ? 'Free' : (p.priceCents / 100).toLocaleString('en-US'),
    priceCents: p.priceCents,
    descKey: '',
    descDefault: p.description || '',
    features: p.features.length > 0 ? p.features : [
      `${p.limits.maxBranches === -1 ? 'Unlimited' : p.limits.maxBranches} Branch${p.limits.maxBranches !== 1 ? 'es' : ''}`,
      `${p.limits.maxTables === -1 ? 'Unlimited' : p.limits.maxTables} Tables`,
      `${p.limits.maxStaff === -1 ? 'Unlimited' : p.limits.maxStaff} Staff`,
      ...(
        p.isFree
          ? ['QR Codes', 'Cash Payment', 'Basic Analytics']
          : p.isPopular
            ? ['QR Codes', 'All Payments', 'Advanced Analytics', 'Kitchen Display', 'Loyalty Program', 'Custom Branding']
            : ['Priority Support', 'API Access', 'White Label', 'Advanced Loyalty', 'Multi-station KDS', 'Custom Integrations']
      ),
    ],
    ctaKey: '',
    ctaDefault: p.isFree ? 'Start Free' : p.priceCents >= 500000 ? 'Contact Sales' : 'Start Trial',
    popular: p.isPopular,
    yearlyPriceCents: p.yearlyPriceCents,
  })) : [
    {
      nameKey: 'landing.pricing.basic',
      nameDefault: 'Basic',
      priceKey: 'landing.pricing.free',
      priceDefault: 'Free',
      priceCents: 0,
      descKey: 'landing.pricing.basic_desc',
      descDefault: 'Perfect for getting started',
      features: ['1 Branch', '1 Menu', 'QR Codes', 'Cash Payment', 'Basic Analytics'],
      ctaKey: 'landing.pricing.start_free',
      ctaDefault: 'Start Free',
      popular: false,
      yearlyPriceCents: null as number | null,
    },
    {
      nameKey: 'landing.pricing.pro',
      nameDefault: 'Pro',
      priceKey: 'landing.pricing.pro_price',
      priceDefault: '2,000',
      priceCents: 200000,
      descKey: 'landing.pricing.pro_desc',
      descDefault: 'For growing restaurants',
      features: ['3 Branches', 'Unlimited Menus', 'QR Codes', 'All Payments', 'Advanced Analytics', 'Kitchen Display', 'Loyalty Program', 'Custom Branding'],
      ctaKey: 'landing.pricing.start_trial',
      ctaDefault: 'Start Trial',
      popular: true,
      yearlyPriceCents: null as number | null,
    },
    {
      nameKey: 'landing.pricing.premium',
      nameDefault: 'Premium',
      priceKey: 'landing.pricing.premium_price',
      priceDefault: '5,000',
      priceCents: 500000,
      descKey: 'landing.pricing.premium_desc',
      descDefault: 'For restaurant chains',
      features: ['Unlimited Branches', 'Unlimited Menus', 'Priority Support', 'API Access', 'White Label', 'Advanced Loyalty', 'Multi-station KDS', 'Custom Integrations'],
      ctaKey: 'landing.pricing.contact_sales',
      ctaDefault: 'Contact Sales',
      popular: false,
      yearlyPriceCents: null as number | null,
    },
  ];

  // Helper: translate with fallback — passes fallback directly to t() so the
  // fallback chain works: loaded bundle → explicit fallback → ENGLISH_FALLBACKS → human-readable key
  const tf = (key: string, fallback: string) => {
    return t(key, fallback);
  };

  // Feature key translation map — converts DB snake_case keys like
  // '1_branch', '5_tables', 'basic_analytics' into human-readable text
  const FEATURE_LABELS: Record<string, string> = {
    '1_branch': '1 Branch',
    '5_branches': '5 Branches',
    'unlimited_branches': 'Unlimited Branches',
    '5_tables': '5 Tables',
    '50_tables': '50 Tables',
    'unlimited_tables': 'Unlimited Tables',
    'basic_analytics': 'Basic Analytics',
    'advanced_analytics': 'Advanced Analytics',
    'multilingual': 'Multilingual Menus',
    'ai_assistant': 'AI Assistant',
    'priority_support': 'Priority Support',
    'custom_branding': 'Custom Branding',
    'api_access': 'API Access',
    'qr_codes': 'QR Codes',
    'cash_payment': 'Cash Payment',
    'all_payments': 'All Payment Methods',
    'kitchen_display': 'Kitchen Display',
    'loyalty_program': 'Loyalty Program',
    'white_label': 'White Label',
    'advanced_loyalty': 'Advanced Loyalty',
    'multi_station_kds': 'Multi-station KDS',
    'custom_integrations': 'Custom Integrations',
    'realtime_orders': 'Real-time Orders',
    'waiter_app': 'Waiter App',
    'reservations': 'Reservations',
    'promotions': 'Promotions',
    'reviews': 'Reviews',
  };

  // Translate a feature key from the DB into a readable label
  const featureLabel = (f: string): string => {
    // If it's already a human-readable string (contains spaces), return as-is
    if (f.includes(' ')) return f;
    // Otherwise look up in the feature label map
    return FEATURE_LABELS[f] || f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Yene QR" className="w-9 h-9 rounded-lg object-contain" />
              <span className="text-xl font-bold text-foreground">
                Yene QR
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Restaurant Login — dropdown selector */}
              <Select onValueChange={(slug) => navigate(`/${slug}/login`)}>
                <SelectTrigger size="sm" className="w-auto gap-1.5 border-0 shadow-none hover:bg-accent">
                  <Store className="w-4 h-4" />
                  <span className="hidden sm:inline">{tf('landing.nav.restaurant_login', 'Restaurant Login')}</span>
                  <span className="sm:hidden">{tf('landing.nav.login', 'Login')}</span>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <NavRestaurantList />
                </SelectContent>
              </Select>

              {/* Admin Login — goes directly to PlatformLoginPage */}
              <Button variant="outline" size="sm" onClick={() => navigate('/login')}>
                <Shield className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">{tf('landing.nav.admin', 'Admin')}</span>
              </Button>
              <Button size="sm" onClick={() => navigate('/register')}>
                {tf('landing.nav.get_started', 'Get Started')}
              </Button>
              <LanguageSwitcher variant="icon" />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero with Restaurant Finder */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Zap className="w-4 h-4" />
                {tf('landing.hero.badge', "Ethiopia's #1 QR Restaurant Platform")}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                {tf('landing.hero.title_scan', 'Scan.')}{' '}
                {tf('landing.hero.title_order', 'Order.')}{' '}
                <span className="text-primary">{tf('landing.hero.title_enjoy', 'Enjoy.')}</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                {tf('landing.hero.description', 'Transform your restaurant with QR-powered digital menus, seamless ordering, kitchen management, and Ethiopian payment integrations. Built for restaurants that want to deliver exceptional dining experiences.')}
              </p>

              {/* Restaurant Dropdown Selector */}
              <RestaurantDropdown t={tf} />

              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-primary" />
                  {tf('landing.hero.free_trial', '14-day free trial')}
                </div>
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-primary" />
                  {tf('landing.hero.no_card', 'No credit card required')}
                </div>
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-primary" />
                  {tf('landing.hero.multilingual', '13 languages supported')}
                </div>
              </div>
            </div>
            <div className="relative hidden lg:block">
              <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl p-8 border border-primary/10">
                <div className="bg-card rounded-2xl shadow-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <QrCode className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Habesha Restaurant</p>
                      <p className="text-sm text-muted-foreground">
                        {tf('landing.demo.table_guests', 'Table {number} · {count} guests')
                          .replace('{number}', '7')
                          .replace('{count}', '2')}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {['Doro Wot', 'Kitfo Special', 'Teff Injera'].map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <span className="text-sm font-medium">{item}</span>
                        <span className="text-sm text-primary font-semibold">
                          {[350, 420, 50][i]} ETB
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t">
                    <span className="text-sm font-semibold">{tf('landing.demo.total', 'Total')}</span>
                    <span className="text-lg font-bold text-primary">820 ETB</span>
                  </div>
                  <Button className="w-full gap-2" size="lg">
                    <CreditCard className="w-4 h-4" />
                    {tf('landing.demo.pay_telebirr', 'Pay with Telebirr')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works — 3 User Entry Points */}
      <section className="py-16 bg-muted/30 border-y">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              {tf('landing.entry_points.title', 'How Would You Like to Get Started?')}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {tf('landing.entry_points.subtitle', 'Whether you manage restaurants, serve customers, or oversee the platform — we\'ve got you covered.')}
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {/* Restaurant Owner / Staff */}
            <Card className="group hover:shadow-lg transition-all hover:border-primary/30 cursor-pointer" onClick={() => navigate('/register')}>
              <CardContent className="p-6 space-y-4 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Store className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{tf('landing.entry_points.restaurant_title', 'Restaurant Owner')}</h3>
                <p className="text-sm text-muted-foreground">
                  {tf('landing.entry_points.restaurant_desc', 'Register your restaurant, create menus, generate QR codes, manage orders, and track analytics from your dashboard.')}
                </p>
                <Button className="w-full gap-2" onClick={(e) => { e.stopPropagation(); navigate('/register'); }}>
                  {tf('landing.entry_points.restaurant_cta', 'Register Your Restaurant')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  {tf('landing.entry_points.restaurant_existing', 'Already registered?')}{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); /* scroll to dropdown in hero */ document.querySelector('[data-slot="select-trigger"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                    className="text-primary hover:underline font-medium"
                  >
                    {tf('landing.entry_points.login_here', 'Log in here')}
                  </button>
                </p>
              </CardContent>
            </Card>

            {/* Customer — UAT Testing Environment */}
            <UATTestingSection />

            {/* Platform Admin */}
            <Card className="group hover:shadow-lg transition-all hover:border-primary/30 cursor-pointer" onClick={() => navigate('/login')}>
              <CardContent className="p-6 space-y-4 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <Shield className="w-7 h-7 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold">{tf('landing.entry_points.admin_title', 'Platform Admin')}</h3>
                <p className="text-sm text-muted-foreground">
                  {tf('landing.entry_points.admin_desc', 'Manage all restaurants, subscriptions, feature flags, support tickets, and platform-wide analytics from the admin panel.')}
                </p>
                <Button variant="outline" className="w-full gap-2" onClick={(e) => { e.stopPropagation(); navigate('/login'); }}>
                  <Shield className="w-4 h-4" />
                  {tf('landing.entry_points.admin_cta', 'Admin Login')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  {tf('landing.entry_points.admin_note', 'Super admin & support staff only')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              {tf('landing.features.title', 'Everything Your Restaurant Needs')}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {tf('landing.features.description', 'From QR code generation to kitchen management, Yene QR covers every aspect of modern restaurant operations.')}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Card key={i} className="group hover:shadow-lg transition-all hover:border-primary/30">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{tf(feature.titleKey, feature.titleDefault)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tf(feature.descKey, feature.descDefault)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              {tf('landing.pricing.title', 'Simple, Transparent Pricing')}
            </h2>
            <p className="text-lg text-muted-foreground">
              {tf('landing.pricing.subtitle', 'Start free. Upgrade when you\'re ready.')}
            </p>
          </div>
          {plansLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-8 max-w-5xl mx-auto" style={{ gridTemplateColumns: `repeat(${Math.min(plans.length, 4)}, minmax(0, 1fr))` }}>
              {plans.map((plan, i) => (
                <Card
                  key={i}
                  className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                      {tf('landing.pricing.most_popular', 'Most Popular')}
                    </div>
                  )}
                  <CardContent className="p-6 space-y-6">
                    <div>
                      <h3 className="text-xl font-bold">{plan.nameKey ? tf(plan.nameKey, plan.nameDefault) : plan.nameDefault}</h3>
                      <p className="text-sm text-muted-foreground">{plan.descKey ? tf(plan.descKey, plan.descDefault) : plan.descDefault}</p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">{plan.priceKey ? tf(plan.priceKey, plan.priceDefault) : plan.priceDefault}</span>
                      {(plan.priceKey ? tf(plan.priceKey, plan.priceDefault) : plan.priceDefault) !== tf('landing.pricing.free', 'Free') && (
                        <span className="text-muted-foreground">{tf('landing.pricing.per_month', 'ETB/mo')}</span>
                      )}
                    </div>
                    {'yearlyPriceCents' in plan && plan.yearlyPriceCents != null && plan.yearlyPriceCents > 0 && (
                      <p className="text-xs text-muted-foreground -mt-4">
                        {(plan.yearlyPriceCents / 100).toLocaleString('en-US')} ETB/year — save {Math.round((1 - plan.yearlyPriceCents / (('priceCents' in plan && plan.priceCents ? plan.priceCents : 0) * 12)) * 100)}%
                      </p>
                    )}
                    <ul className="space-y-3">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          {featureLabel(f)}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => navigate('/register')}
                    >
                      {plan.ctaKey ? tf(plan.ctaKey, plan.ctaDefault) : plan.ctaDefault}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Powered by Repux Technologies PLC. Built with love in Ethiopia.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Restaurant Dropdown Component
// Lists all active restaurants in a dropdown for easy selection
// Redirects to the selected restaurant's login page
// ============================================================

function RestaurantDropdown({ t }: { t: (key: string, fallback: string) => string }) {
  const { navigate } = useRouter();
  const [restaurants, setRestaurants] = useState<Array<{ id: string; name: string; slug: string; cuisineType?: string | null; city?: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ restaurants: Array<{ id: string; name: string; slug: string; cuisineType?: string | null; city?: string | null }> }>('/api/restaurants/list');
        if (!cancelled && res.restaurants) {
          setRestaurants(res.restaurants);
        }
      } catch {
        // Silently fail — dropdown will be empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSelect = useCallback((slug: string) => {
    navigate(`/${slug}/login`);
  }, [navigate]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select onValueChange={handleSelect}>
          <SelectTrigger className="w-full h-12 text-base">
            {loading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('landing.dropdown.loading', 'Loading restaurants...')}
              </span>
            ) : (
              <SelectValue placeholder={t('landing.dropdown.placeholder', 'Select a restaurant...')} />
            )}
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {restaurants.length === 0 && !loading && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {t('landing.dropdown.no_restaurants', 'No restaurants available yet.')}
              </div>
            )}
            {restaurants.map((r) => (
              <SelectItem key={r.id} value={r.slug}>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{r.name}</span>
                  {r.cuisineType && (
                    <span className="text-xs text-muted-foreground">({r.cuisineType})</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('landing.dropdown.staff_hint', 'Select your restaurant to log in to the dashboard.')}
        {' '}Admin? <button type="button" onClick={() => navigate('/login')} className="text-primary hover:underline">{t('landing.dropdown.admin_login', 'Log in here')}</button>.
      </p>
    </div>
  );
}

// ============================================================
// Nav Restaurant List — lightweight list for the nav dropdown
// ============================================================

function NavRestaurantList() {
  const [restaurants, setRestaurants] = useState<Array<{ id: string; name: string; slug: string; cuisineType?: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ restaurants: Array<{ id: string; name: string; slug: string; cuisineType?: string | null }> }>('/api/restaurants/list');
        if (!cancelled && res.restaurants) {
          setRestaurants(res.restaurants);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="px-3 py-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
        No restaurants available
      </div>
    );
  }

  return (
    <>
      {restaurants.map((r) => (
        <SelectItem key={r.id} value={r.slug}>
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{r.name}</span>
          </div>
        </SelectItem>
      ))}
    </>
  );
}
