'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, hashUrl, slugPath } from '@/lib/router';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Toaster, toast } from 'sonner';
import {
  QrCode,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Shield,
  UtensilsCrossed,
  Store,
  AlertCircle,
  Search,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/dashboard/language-switcher';
import { useI18n } from '@/hooks/useI18n';
import { api } from '@/lib/api-client';

// ============================================================
// Role-based default landing page after login
// ============================================================

function getRoleDefaultPath(role: string): string {
  switch (role) {
    case 'kitchen_staff':
      return '/dashboard/kitchen';
    case 'waiter':
      return '/dashboard/waiter';
    case 'cashier':
      return '/dashboard/orders';
    case 'owner':
    case 'manager':
    default:
      return '/dashboard';
  }
}

// ============================================================
// Restaurant-specific Login Page
// Used when accessed via #/{slug}/login
// Shows restaurant branding and passes slug to API for scoped auth
// ============================================================

export function RestaurantLoginPage() {
  const { route, navigate } = useRouter();
  const { setAuth } = useAppStore();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Restaurant info from URL slug
  const slug = route.slug;
  const [restaurantInfo, setRestaurantInfo] = useState<{ name: string; cuisineType?: string; logo?: string | null; slug: string } | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState('');

  // Fetch restaurant info by slug for branding
  useEffect(() => {
    if (!slug) {
      setLoadingInfo(false);
      return;
    }
    setLoadingInfo(true);
    setInfoError('');
    api.get<{ restaurant: { name: string; cuisineType?: string; logo?: string | null; slug: string } }>(`/api/restaurants/by-slug/${slug}`)
      .then(res => {
        setRestaurantInfo(res.restaurant);
      })
      .catch((err: any) => {
        // Distinguish between "not found" and "inactive/suspended"
        const msg = err?.message || err?.error || '';
        if (msg.toLowerCase().includes('inactive')) {
          setInfoError(t('auth.restaurant_inactive', 'This restaurant is currently inactive. Please contact the restaurant owner.'));
        } else if (msg.toLowerCase().includes('suspended')) {
          setInfoError(t('auth.restaurant_suspended', 'This restaurant has been suspended. Please contact support.'));
        } else {
          setInfoError(t('auth.restaurant_not_found', 'Restaurant not found. Please check the link and try again.'));
        }
      })
      .finally(() => setLoadingInfo(false));
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Pass restaurantSlug to scope the login to this specific restaurant
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, restaurantSlug: slug }),
      });

      if (res.ok) {
        const data = await res.json();

        // Check if 2FA is required
        if (data.requires2FA) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('yeneqr_2fa_token', data.tempToken);
            sessionStorage.setItem('yeneqr_2fa_email', data.user?.email || email);
            sessionStorage.setItem('yeneqr_2fa_name', data.user?.name || '');
            sessionStorage.setItem('yeneqr_2fa_slug', slug || '');
          }
          navigate(slug ? `/${slug}/two-factor` : '/two-factor');
          return;
        }

        // Map API response to store format
        const userData = {
          ...data.user,
          restaurantId: data.user.restaurant?.id || data.user.restaurantId,
          restaurantName: data.user.restaurant?.name || data.user.restaurantName,
          restaurantSlug: data.user.restaurant?.slug || data.user.restaurantSlug,
          branchId: data.user.branch?.id || data.user.branchId,
        };
        setAuth(data.token, userData);
        toast.success(t('auth.welcome_back', 'Welcome back!'));

        // Navigate to role-appropriate default page
        if (userData.role === 'super_admin' || userData.role === 'support_admin') {
          navigate('/admin');
        } else {
          const roleDefaultPath = getRoleDefaultPath(userData.role);
          navigate(slugPath(userData.restaurantSlug || slug || userData.restaurantId, roleDefaultPath));
        }
      } else {
        const data = await res.json();
        setError(data.error || t('auth.invalid_credentials', 'Invalid email or password'));
      }
    } catch {
      setError(t('error.network', 'Network error. Please check your connection.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Slug → email domain mapping for demo accounts
  const SLUG_EMAIL_DOMAINS: Record<string, string> = {
    'habesha-restaurant': 'habesha.et',
    'blue-nile-grill': 'bluenile.et',
    'yod-abyssinia': 'yod.et',
    'lalibela-restaurant': 'lalibela.et',
    'sheba-lounge': 'sheba.et',
    'meskel-cafe': 'meskel.et',
    'aster-kitchen': 'aster.et',
    'rift-valley-fish': 'riftvalley.et',
    'harar-gate': 'harargate.et',
    'entsoto-terrace': 'entoto.et',
    'wolkite-queen': 'wolkite.et',
  };

  // Get demo accounts for this restaurant's slug
  const emailDomain = slug ? SLUG_EMAIL_DOMAINS[slug] : null;
  const demoAccounts = emailDomain ? [
    { role: 'Owner', email: `owner@${emailDomain}`, icon: UtensilsCrossed, bgClass: 'bg-primary/10', iconClass: 'text-primary' },
    { role: 'Manager', email: `manager@${emailDomain}`, icon: Shield, bgClass: 'bg-blue-500/10', iconClass: 'text-blue-500' },
    { role: 'Waiter', email: `waiter@${emailDomain}`, icon: Store, bgClass: 'bg-green-500/10', iconClass: 'text-green-500' },
    { role: 'Kitchen', email: `kitchen@${emailDomain}`, icon: UtensilsCrossed, bgClass: 'bg-orange-500/10', iconClass: 'text-orange-500' },
    { role: 'Cashier', email: `cashier@${emailDomain}`, icon: Store, bgClass: 'bg-purple-500/10', iconClass: 'text-purple-500' },
  ] : [];

  const handleDemoFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('admin123');
    setError('');
  };

  // Restaurant not found
  if (!slug) {
    return <PlatformLoginPage />;
  }

  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (infoError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 gap-4 px-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">{t('auth.restaurant_not_found', 'Restaurant Not Found')}</h2>
        <p className="text-muted-foreground text-center">{infoError}</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          {t('auth.go_to_home', 'Go to Home')}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Header */}
      <header className="flex items-center justify-between p-4 sm:p-6">
        <a
          href={hashUrl('/')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img src="/logo.png" alt="Yene QR" className="w-9 h-9 rounded-lg object-contain" />
          <span className="text-xl font-bold text-foreground">Yene QR</span>
        </a>
        <div className="flex items-center gap-2">
          <LanguageSwitcher variant="icon" />
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md shadow-xl border-border/50">
          <CardHeader className="space-y-1 text-center pb-4">
            {/* Restaurant branding */}
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
              {restaurantInfo?.logo ? (
                <img src={restaurantInfo.logo} alt={restaurantInfo.name} className="w-10 h-10 rounded-lg object-contain" />
              ) : (
                <Store className="w-7 h-7 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {restaurantInfo?.name || slug}
            </CardTitle>
            <CardDescription>
              {t('auth.restaurant_dashboard', 'Restaurant Dashboard')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error message */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@restaurant.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href={hashUrl(slug ? `/${slug}/forgot-password` : '/forgot-password')}
                    className="text-xs text-primary hover:underline"
                  >
                    {t('auth.forgot_password', 'Forgot password?')}
                  </a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.enter_password', 'Enter your password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {t('auth.sign_in', 'Sign In')}
              </Button>
            </form>

            {/* Demo accounts — populates form fields for this restaurant */}
            {slug && demoAccounts.length > 0 && (
              <>
                <div className="relative my-6">
                  <Separator />
                  <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    {t('auth.quick_demo_fill', 'Quick Demo Fill')}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {demoAccounts.map((account) => (
                    <button
                      key={account.role}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/60 bg-card hover:bg-accent/50 hover:border-primary/30 transition-all text-left group"
                      onClick={() => handleDemoFill(account.email)}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${account.bgClass}`}>
                        <account.icon className={`h-4 w-4 ${account.iconClass}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{account.role}</p>
                        <p className="text-xs text-muted-foreground truncate">{account.email}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        Fill →
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-1">
                  Password: <code className="bg-muted px-1 rounded text-[10px]">admin123</code>
                </p>
              </>
            )}
          </CardContent>

          <CardFooter className="flex-col gap-2 border-t pt-4">
            <a
              href={hashUrl('/')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('common.back', 'Back')} Yene QR
            </a>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

// ============================================================
// Platform Login Page (for SuperAdmin/SupportAdmin)
// Used when there's no restaurant slug in the URL
// ============================================================

function PlatformLoginPage() {
  const { navigate } = useRouter();
  const { setAuth } = useAppStore();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // No restaurantSlug — only admin tables will be checked
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();

        if (data.requires2FA) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('yeneqr_2fa_token', data.tempToken);
            sessionStorage.setItem('yeneqr_2fa_email', data.user?.email || email);
            sessionStorage.setItem('yeneqr_2fa_name', data.user?.name || '');
          }
          navigate('/two-factor');
          return;
        }

        const userData = {
          ...data.user,
          restaurantId: data.user.restaurant?.id || data.user.restaurantId,
          restaurantName: data.user.restaurant?.name || data.user.restaurantName,
          restaurantSlug: data.user.restaurant?.slug || data.user.restaurantSlug,
          branchId: data.user.branch?.id || data.user.branchId,
        };
        setAuth(data.token, userData);
        toast.success(t('auth.welcome_back', 'Welcome back!'));

        if (userData.role === 'super_admin' || userData.role === 'support_admin') {
          navigate('/admin');
        } else if (userData.restaurantSlug) {
          // If somehow a restaurant user logs in here, redirect to role-appropriate page
          const roleDefaultPath = getRoleDefaultPath(userData.role);
          navigate(slugPath(userData.restaurantSlug, roleDefaultPath));
        } else {
          navigate('/');
        }
      } else {
        const data = await res.json();
        setError(data.error || t('auth.invalid_credentials', 'Invalid email or password'));
      }
    } catch {
      setError(t('error.network', 'Network error. Please check your connection.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Header */}
      <header className="flex items-center justify-between p-4 sm:p-6">
        <a
          href={hashUrl('/')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img src="/logo.png" alt="Yene QR" className="w-9 h-9 rounded-lg object-contain" />
          <span className="text-xl font-bold text-foreground">Yene QR</span>
        </a>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground hidden sm:block">
            {t('auth.platform_admin', 'Platform Admin')}
          </p>
          <LanguageSwitcher variant="icon" />
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md shadow-xl border-border/50">
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-2">
              <Shield className="w-7 h-7 text-amber-600" />
            </div>
            <CardTitle className="text-2xl font-bold">{t('auth.admin_login', 'Admin Login')}</CardTitle>
            <CardDescription>
              {t('auth.admin_panel_desc', 'Access the platform administration panel')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="admin-email">{t('auth.email', 'Email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-email"
                    type="email"
                    placeholder="admin@yeneqr.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password">{t('auth.password', 'Password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('auth.enter_password', 'Enter your password')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {t('auth.sign_in', 'Sign In')}
              </Button>
            </form>

            <div className="relative my-6">
              <Separator />
              <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                {t('auth.quick_demo', 'Quick Demo')}
              </span>
            </div>

            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => { setEmail('admin@yeneqr.com'); setPassword('admin123'); }}
              disabled={isLoading}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <Shield className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{t('auth.super_admin', 'Super Admin')}</p>
                <p className="text-xs text-muted-foreground">admin@yeneqr.com</p>
              </div>
            </Button>
          </CardContent>

          <CardFooter className="flex-col gap-2 border-t pt-4">
            <p className="text-xs text-muted-foreground text-center">
              {t('auth.back_to_home', 'Back to Home')}
            </p>
            <a
              href={hashUrl('/')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('auth.back_to_home', 'Back to Home')}
            </a>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

// Legacy export for backward compatibility
export { RestaurantLoginPage as LoginPage };
