'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter, hashUrl, slugPath } from '@/lib/router'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Shield,
  Loader2,
  ArrowRight,
  KeyRound,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { useI18n } from '@/hooks/useI18n'
import { LanguageSwitcher } from '@/components/dashboard/language-switcher'
import { toast } from 'sonner'

export function TwoFactorPage() {
  const { navigate } = useRouter()
  const { setAuth } = useAppStore()
  const { t } = useI18n()

  // Read temp token from sessionStorage (set by login page on 2FA redirect)
  const [tempToken, setTempToken] = useState<string>('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [backupCode, setBackupCode] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Load from sessionStorage on mount
  useEffect(() => {
    const token = sessionStorage.getItem('yeneqr_2fa_token') || ''
    const storedEmail = sessionStorage.getItem('yeneqr_2fa_email') || ''
    setTempToken(token)
    setEmail(storedEmail)

    if (!token) {
      setError('No 2FA session found. Please log in again.')
    }
  }, [])

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6)
      const newCode = [...code]
      for (let i = 0; i < 6; i++) {
        newCode[i] = digits[i] || ''
      }
      setCode(newCode)
      const focusIndex = Math.min(digits.length, 5)
      inputRefs.current[focusIndex]?.focus()
      return
    }

    const digit = value.replace(/\D/g, '')
    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const verificationCode = useBackup ? backupCode : code.join('')

    if (verificationCode.length < (useBackup ? 8 : 6)) {
      setError(useBackup ? 'Please enter a valid backup code' : 'Please enter the 6-digit code')
      setIsLoading(false)
      return
    }

    if (!tempToken) {
      setError('Session expired. Please log in again.')
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempToken,
          code: verificationCode,
          isBackupCode: useBackup,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const userData = {
          ...data.user,
          restaurantId: data.user.restaurant?.id || data.user.restaurantId,
          restaurantName: data.user.restaurant?.name || data.user.restaurantName,
          branchId: data.user.branch?.id || data.user.branchId,
        }
        setAuth(data.token, userData)

        // Clean up sessionStorage
        sessionStorage.removeItem('yeneqr_2fa_token')
        sessionStorage.removeItem('yeneqr_2fa_email')
        sessionStorage.removeItem('yeneqr_2fa_name')

        toast.success(t('auth.welcome_back', 'Welcome back!'))

        // Navigate to appropriate dashboard
        const slug = sessionStorage.getItem('yeneqr_2fa_slug') || data.user.restaurant?.slug || data.user.restaurantSlug
        if (data.user.role === 'super_admin' || data.user.role === 'support_admin') {
          navigate('/admin')
        } else {
          navigate(slugPath(slug, '/dashboard'))
        }
        // Clean up slug from sessionStorage
        sessionStorage.removeItem('yeneqr_2fa_slug')
      } else {
        const data = await res.json()
        setError(data.error || t('error.generic', 'An error occurred. Please try again.'))
      }
    } catch {
      setError(t('error.network', 'Network error. Please check your connection.'))
    } finally {
      setIsLoading(false)
    }
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
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">{t('auth.two_factor_auth', 'Two-Factor Authentication')}</CardTitle>
            <CardDescription>
              {email
                ? `${t('auth.enter_6_digit', 'Enter 6-digit code')} ${email}`
                : t('auth.enter_6_digit', 'Enter 6-digit code')}
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

              {!useBackup ? (
                <div className="space-y-2">
                  <Label className="text-center block">{t('auth.verification_code', 'Verification Code')}</Label>
                  <div className="flex justify-center gap-2">
                    {code.map((digit, index) => (
                      <Input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        className="w-12 h-14 text-center text-xl font-bold rounded-lg"
                        autoFocus={index === 0}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('auth.enter_6_digit', 'Enter 6-digit code')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="backupCode">{t('auth.backup_code', 'Backup Code')}</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="backupCode"
                      type="text"
                      placeholder="XXXX-XXXX"
                      value={backupCode}
                      onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                      className="pl-10 text-center font-mono text-lg tracking-widest"
                      maxLength={9}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('auth.enter_backup_code', 'Enter backup code')}
                  </p>
                </div>
              )}

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
                {t('auth.verify', 'Verify')}
              </Button>
            </form>

            {/* Toggle backup code */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setUseBackup(!useBackup)
                  setError('')
                }}
                className="text-sm text-primary hover:underline"
              >
                {useBackup ? t('auth.use_authenticator', 'Use Authenticator App') : t('auth.use_backup', 'Use Backup Code')}
              </button>
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-2 border-t pt-4">
            <a
              href={hashUrl('/login')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {t('auth.back_to_login', 'Back to Login')}
            </a>
          </CardFooter>
        </Card>
      </main>
    </div>
  )
}
