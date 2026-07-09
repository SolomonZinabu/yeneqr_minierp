'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, slugPath } from '@/lib/router';
import { useAppStore } from '@/lib/store';
import { useLanguageStore } from '@/hooks/useLanguage';
import { useTranslation } from '@/hooks/useTranslation';
import { useI18n } from '@/hooks/useI18n';
import { LanguageSwitcher } from '@/components/dashboard/language-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  QrCode,
  ArrowRight,
  Store,
  Loader2,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { api } from '@/lib/api-client';

// ============================================================
// Restaurant Landing Page
// Displayed when visiting #/{slug} — the restaurant's "home page"
// Shows restaurant info and links to login, menu, etc.
// ============================================================

export function RestaurantLandingPage() {
  const { route, navigate } = useRouter();
  const user = useAppStore((s) => s.user);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const slug = route.slug;

  const { tRaw } = useTranslation();
  const { t } = useI18n();
  const [restaurantInfo, setRestaurantInfo] = useState<{
    name: string;
    nameI18n?: string;
    descriptionI18n?: string;
    cuisineType?: string;
    logo?: string | null;
    city?: string | null;
    address?: string | null;
    slug: string;
    id?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // If already authenticated as staff of this restaurant, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && user && slug) {
      const userSlug = user.restaurantSlug || user.restaurantId;
      if (userSlug === slug && (user.role !== 'super_admin' && user.role !== 'support_admin')) {
        navigate(slugPath(slug, '/dashboard'));
      }
    }
  }, [isAuthenticated, user, slug, navigate]);

  // Fetch restaurant info
  useEffect(() => {
    if (!slug) {
      setLoading(false);
      navigate('/');
      return;
    }
    setLoading(true);
    setError('');
    api.get<{ restaurant: typeof restaurantInfo }>(`/api/restaurants/by-slug/${slug}`)
      .then(res => {
        setRestaurantInfo(res.restaurant);
      })
      .catch(() => {
        setError(t('restaurant.not_found', 'Restaurant not found'));
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">{t('restaurant.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  if (error || !restaurantInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 gap-4 px-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">{t('restaurant.not_found', 'Restaurant Not Found')}</h2>
        <p className="text-muted-foreground text-center">{error || t('restaurant.not_found_desc', 'The restaurant you are looking for could not be found.')}</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          {t('restaurant.go_home', 'Go Home')}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-background to-primary/10">
      {/* Header — Restaurant branding */}
      <header className="flex items-center justify-between p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            {restaurantInfo.logo ? (
              <img src={restaurantInfo.logo} alt={restaurantInfo.name} className="w-8 h-8 rounded-lg object-contain" />
            ) : (
              <Store className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-foreground">{restaurantInfo.name}</span>
            {restaurantInfo.cuisineType && (
              <span className="text-xs text-muted-foreground">{restaurantInfo.cuisineType}{restaurantInfo.city && ` · ${restaurantInfo.city}`}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher restaurantId={restaurantInfo?.id} variant="icon" />
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg space-y-8">
          {/* Restaurant Card */}
          <Card className="shadow-xl border-border/50 overflow-hidden">
            {/* Restaurant Banner */}
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 px-6 py-8 text-center">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 ring-4 ring-background shadow-lg">
                {restaurantInfo.logo ? (
                  <img src={restaurantInfo.logo} alt={restaurantInfo.name} className="w-14 h-14 rounded-lg object-contain" />
                ) : (
                  <Store className="w-10 h-10 text-primary" />
                )}
              </div>
              <h1 className="text-2xl font-bold">{tRaw(restaurantInfo.nameI18n, restaurantInfo.name)}</h1>
              {restaurantInfo.cuisineType && (
                <p className="text-xs text-muted-foreground mt-2">
                  {restaurantInfo.cuisineType}
                  {restaurantInfo.city && ` · ${restaurantInfo.city}`}
                </p>
              )}
            </div>

            <CardContent className="p-6 space-y-4">
              {/* Staff Login Button */}
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => navigate(`/${slug}/login`)}
              >
                <Shield className="w-4 h-4" />
                {t('auth.login', 'Staff Login')}
                <ArrowRight className="w-4 h-4" />
              </Button>

              {/* Customer Menu Button */}
              <Button
                variant="outline"
                className="w-full gap-2"
                size="lg"
                onClick={() => navigate(`/${slug}/menu/welcome`)}
              >
                <QrCode className="w-4 h-4" />
                {t('welcome.view_menu', 'View Menu')}
              </Button>

              {/* Info */}
              <div className="text-center pt-2">
                <p className="text-[10px] text-muted-foreground mt-1">
                  yeneqr.com/{slug}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* QR Code hint */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {t('restaurant.scanned_qr', 'You scanned the QR code')}
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} {restaurantInfo.name}. {t('restaurant.all_rights', 'All rights reserved.')}
            </p>
            <span className="text-xs text-muted-foreground">
              {t('restaurant.powered_by', 'Powered by Yene QR')}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
