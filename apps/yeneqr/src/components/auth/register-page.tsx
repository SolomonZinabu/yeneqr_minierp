'use client';

import React, { useState, useCallback } from 'react';
import { useRouter, hashUrl, slugPath } from '@/lib/router';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  User,
  Phone,
  UtensilsCrossed,
  Globe,
  MapPin,
  Building,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/dashboard/language-switcher';
import { CUISINE_TYPES_I18N } from '@/lib/i18n';
import { useI18n } from '@/hooks/useI18n';

// Password strength indicator
function getPasswordStrength(password: string): { score: number; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, color: 'bg-red-500' };
  if (score <= 2) return { score, color: 'bg-orange-500' };
  if (score <= 3) return { score, color: 'bg-yellow-500' };
  if (score <= 4) return { score, color: 'bg-green-500' };
  return { score, color: 'bg-emerald-500' };
}

export function RegisterPage() {
  const { navigate } = useRouter();
  const { setAuth } = useAppStore();
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Restaurant fields
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantNameAm, setRestaurantNameAm] = useState(''); // kept for API compat
  const [slug, setSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [cuisine, setCuisine] = useState('ethiopian');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');

  // Owner fields
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Auto-generate slug from restaurant name
  const handleRestaurantNameChange = (value: string) => {
    setRestaurantName(value);
    const newSlug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setSlug(newSlug);
    // Reset availability check when slug changes
    setSlugAvailable(null);
  };

  const handleSlugChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(sanitized);
    setSlugAvailable(null);
  };

  // Check slug availability with debounce
  const checkSlugAvailability = useCallback(async (slugToCheck: string) => {
    if (!slugToCheck || slugToCheck.length < 3) {
      setSlugAvailable(null);
      return;
    }
    setSlugChecking(true);
    try {
      const res = await fetch(`/api/restaurants/by-slug/${slugToCheck}`);
      if (res.ok) {
        // Restaurant found = slug taken
        setSlugAvailable(false);
      } else {
        // 404 = slug available
        setSlugAvailable(true);
      }
    } catch {
      setSlugAvailable(null);
    } finally {
      setSlugChecking(false);
    }
  }, []);

  // Debounced slug check
  const [slugCheckTimer, setSlugCheckTimer] = useState<NodeJS.Timeout | null>(null);
  const handleSlugBlur = () => {
    if (slug && slug.length >= 3 && slugAvailable === null) {
      checkSlugAvailability(slug);
    }
  };

  // Slug availability check on change with delay
  React.useEffect(() => {
    if (slugCheckTimer) clearTimeout(slugCheckTimer);
    if (slug && slug.length >= 3) {
      const timer = setTimeout(() => checkSlugAvailability(slug), 600);
      setSlugCheckTimer(timer);
      return () => clearTimeout(timer);
    }
  }, [slug, checkSlugAvailability]);

  const passwordStrength = getPasswordStrength(password);
  const strengthLabels: Record<number, string> = {
    1: t('auth.strength_weak', 'Weak'),
    2: t('auth.strength_fair', 'Fair'),
    3: t('auth.strength_good', 'Good'),
    4: t('auth.strength_strong', 'Strong'),
    5: t('auth.strength_very_strong', 'Very Strong'),
  };
  const passwordsMatch = confirmPassword === '' || password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (password !== confirmPassword) {
      setError(t('auth.password_mismatch', 'Passwords do not match'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.password_mismatch', 'Passwords do not match'));
      return;
    }
    if (slugAvailable === false) {
      setError(t('auth.slug_already_taken', 'This URL slug is already taken'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName,
          nameAm: restaurantNameAm || undefined,
          slug,
          cuisineType: cuisine,
          city: city || undefined,
          address: address || undefined,
          ownerName,
          ownerEmail: email,
          password,
          phone: phone || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Map API response to store format
        const userData = {
          ...data.user,
          restaurantId: data.restaurant?.id || data.user.restaurantId,
          restaurantName: data.restaurant?.name || data.user.restaurantName,
          restaurantSlug: data.restaurant?.slug || data.user.restaurantSlug,
          branchId: data.branch?.id || data.user.branchId,
        };
        setAuth(data.token, userData);
        toast.success(t('auth.welcome_back', 'Welcome back!'));
        navigate(slugPath(userData.restaurantSlug || userData.restaurantId, '/dashboard'));
      } else {
        const data = await res.json();
        setError(data.error || t('error.generic', 'An error occurred. Please try again.'));
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
          <a
            href={hashUrl('/login')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('auth.already_have_account', 'Already have an account?')} <span className="text-primary font-medium">Sign in</span>
          </a>
          <LanguageSwitcher variant="icon" />
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-lg shadow-xl border-border/50">
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
              <UtensilsCrossed className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">{t('auth.register_restaurant', 'Register Your Restaurant')}</CardTitle>
            <CardDescription>
              {t('auth.register_desc', 'Create your restaurant account on Yene QR')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error message */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* ─── Restaurant Section ─── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('auth.restaurant_details', 'Restaurant Details')}
                </h3>

                {/* Restaurant Name */}
                <div className="space-y-2">
                  <Label htmlFor="restaurantName">{t('auth.restaurant_name', 'Restaurant Name')} *</Label>
                  <div className="relative">
                    <UtensilsCrossed className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="restaurantName"
                      placeholder="Habesha Restaurant"
                      value={restaurantName}
                      onChange={(e) => handleRestaurantNameChange(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {/* URL Slug */}
                <div className="space-y-2">
                  <Label htmlFor="slug">{t('auth.url_slug', 'URL Slug')} *</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="slug"
                      placeholder="habesha-restaurant"
                      value={slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      onBlur={handleSlugBlur}
                      className="pl-10 pr-10"
                      required
                      minLength={3}
                    />
                    {/* Slug availability indicator */}
                    {slug.length >= 3 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        {slugChecking ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : slugAvailable === true ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : slugAvailable === false ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : null}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      yeneqr.com/<span className="text-primary">{slug || 'your-restaurant'}</span>
                    </p>
                    {slugAvailable === false && (
                      <p className="text-xs text-destructive">{t('auth.slug_already_taken', 'This URL slug is already taken')}</p>
                    )}
                    {slugAvailable === true && (
                      <p className="text-xs text-green-600">{t('auth.available', 'Available')}</p>
                    )}
                  </div>
                </div>

                {/* Cuisine + City */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cuisine">{t('auth.cuisine_type', 'Cuisine Type')} *</Label>
                    <select
                      id="cuisine"
                      value={cuisine}
                      onChange={(e) => setCuisine(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      required
                    >
                      {CUISINE_TYPES_I18N.map((c) => (
                        <option key={c.code} value={c.code}>{c.nameI18n.en}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">{t('auth.city', 'City')}</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="city"
                        placeholder="Addis Ababa"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address">{t('auth.address', 'Address')}</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      placeholder="Bole, Near Edna Mall"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* ─── Owner Section ─── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('auth.owner_account', 'Owner Account')}
                </h3>

                {/* Name + Phone */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ownerName">{t('auth.full_name', 'Full Name')} *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="ownerName"
                        placeholder="Amanuel Girma"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">{t('auth.phone', 'Phone Number')} *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+251-911-123-456"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email', 'Email')} *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="owner@restaurant.com"
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
                  <Label htmlFor="password">{t('auth.password', 'Password')} *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('auth.min_8_chars', 'Minimum 8 characters')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      minLength={8}
                      autoComplete="new-password"
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
                  {/* Password strength bar */}
                  {password.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full ${
                              passwordStrength.score >= i ? passwordStrength.color : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('auth.strength', 'Strength')}: {strengthLabels[passwordStrength.score]}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('auth.confirm_password', 'Confirm Password')} *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`pl-10 pr-10 ${!passwordsMatch ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {!passwordsMatch && (
                    <p className="text-xs text-destructive">{t('auth.password_mismatch', 'Passwords do not match')}</p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={isLoading || !passwordsMatch || slugAvailable === false}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {t('auth.create_account', 'Create Account')}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By registering, you agree to our{' '}
                <a href="#" className="text-primary hover:underline">{t('auth.terms_of_service', 'Terms of Service')}</a>
                {' '}{t('auth.and', 'and')}{' '}
                <a href="#" className="text-primary hover:underline">{t('auth.privacy_policy', 'Privacy Policy')}</a>.
              </p>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t pt-4">
            <a
              href={hashUrl('/')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; {t('auth.back_to_home', 'Back to Home')}
            </a>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
