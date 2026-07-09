'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, hashUrl } from '@/lib/router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  UtensilsCrossed,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useI18n } from '@/hooks/useI18n';
import { LanguageSwitcher } from '@/components/dashboard/language-switcher';
import { toast } from 'sonner';

export function ResetPasswordPage() {
  const { navigate } = useRouter();
  const { t } = useI18n();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [token, setToken] = useState('');

  // Extract and validate token from URL params on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1) || '';
    const urlParams = new URLSearchParams(hash.split('?')[1] || '');
    const resetToken = urlParams.get('token');

    if (!resetToken) {
      setTokenValid(false);
      return;
    }

    setToken(resetToken);
    setTokenValid(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (newPassword.length < 8) {
      setError(t('auth.min_8_chars', 'Minimum 8 characters'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.password_mismatch', 'Passwords do not match'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: newPassword }),
      });

      if (res.ok) {
        setIsSuccess(true);
        toast.success(t('auth.password_reset', 'Password Reset'));
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
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

  // Token is invalid or missing
  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/5 via-background to-primary/10">
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

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <Card className="w-full max-w-md shadow-xl border-border/50">
            <CardHeader className="space-y-1 text-center pb-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
                <XCircle className="w-7 h-7 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold">{t('auth.invalid_link', 'Invalid Link')}</CardTitle>
              <CardDescription>
                {t('auth.link_expired', 'This password reset link has expired or is invalid.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                {t('auth.request_new_link', 'Please request a new one.')}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/forgot-password')}
              >
                {t('auth.request_new', 'Request New Link')}
              </Button>
            </CardContent>
            <CardFooter className="justify-center border-t pt-4">
              <a
                href={hashUrl('/login')}
                className="text-sm text-primary font-medium hover:underline"
              >
                {t('auth.back_to_login', 'Back to Login')}
              </a>
            </CardFooter>
          </Card>
        </main>
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
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
              {isSuccess ? (
                <CheckCircle2 className="w-7 h-7 text-primary" />
              ) : (
                <Lock className="w-7 h-7 text-primary" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold">
              {isSuccess ? t('auth.password_reset', 'Password Reset') : t('auth.reset_your_password', 'Reset Your Password')}
            </CardTitle>
            <CardDescription>
              {isSuccess
                ? t('auth.reset_success', 'Your password has been reset successfully!')
                : t('auth.enter_new_password', 'Enter your new password below.')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isSuccess ? (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {t('auth.sign_in_new_password', 'Sign in with your new password')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error message */}
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password">{t('auth.new_password', 'New Password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('auth.min_8_chars', 'Minimum 8 characters')}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
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
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">{t('auth.confirm_password', 'Confirm Password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('auth.re_enter_password', 'Re-enter password')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">{t('auth.password_mismatch', 'Passwords do not match')}</p>
                  )}
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full gap-2"
                  size="lg"
                  disabled={isLoading || (confirmPassword.length > 0 && newPassword !== confirmPassword)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {t('auth.reset_password', 'Reset Password')}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="flex-col gap-2 border-t pt-4">
            <a
              href={hashUrl('/login')}
              className="text-sm text-primary font-medium hover:underline"
            >
              {t('auth.back_to_login', 'Back to Login')}
            </a>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
