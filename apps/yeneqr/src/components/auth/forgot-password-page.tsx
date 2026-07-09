'use client';

import React, { useState } from 'react';
import { useRouter, hashUrl } from '@/lib/router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Mail,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  UtensilsCrossed,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useI18n } from '@/hooks/useI18n';
import { LanguageSwitcher } from '@/components/dashboard/language-switcher';

export function ForgotPasswordPage() {
  const { navigate } = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setIsSuccess(true);
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
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
              {isSuccess ? (
                <CheckCircle2 className="w-7 h-7 text-primary" />
              ) : (
                <Mail className="w-7 h-7 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {isSuccess ? t('auth.check_email', 'Check Your Email') : t('auth.forgot_password', 'Forgot Password')}
            </CardTitle>
            <CardDescription>
              {isSuccess
                ? t('auth.reset_sent', 'Reset link sent! Check your email.')
                : t('auth.forgot_desc', 'Enter your email and we\'ll send you a reset link.')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isSuccess ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    We&apos;ve sent a password reset link to{' '}
                    <span className="font-medium text-foreground">{email}</span>.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Didn&apos;t receive the email? Check your spam folder or try again.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail('');
                  }}
                >
                  {t('auth.try_different_email', 'Try a different email')}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error message */}
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email_address', 'Email Address')}</Label>
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
                    <Mail className="h-4 w-4" />
                  )}
                  {t('auth.send_reset_link', 'Send Reset Link')}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex-col gap-2 border-t pt-4">
            <a
              href={hashUrl('/login')}
              className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              {t('auth.back_to_login', 'Back to Login')}
            </a>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
