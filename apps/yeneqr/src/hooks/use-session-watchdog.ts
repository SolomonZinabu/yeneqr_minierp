// ============================================================
// Yene QR — Customer Session Watchdog Hook
// ============================================================
// Monitors the customer's JWT token for expiry, shows a warning
// toast before expiration, and auto-refreshes the token to
// prevent session interruption.

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

interface SessionWatchdogOptions {
  /** The current JWT token */
  token: string | null
  /** Callback to update the stored token after refresh */
  onTokenRefreshed: (newToken: string) => void
  /** Callback when session has completely expired and cannot be refreshed */
  onSessionExpired: () => void
  /** Minutes before expiry to show warning toast (default: 10) */
  warningMinutes?: number
  /** Minutes before expiry to attempt auto-refresh (default: 5) */
  refreshMinutes?: number
}

interface SessionWatchdogReturn {
  /** Whether the session is about to expire (warning state) */
  isExpiringSoon: boolean
  /** Minutes remaining until token expires */
  minutesRemaining: number | null
  /** Manually refresh the token now */
  refreshNow: () => Promise<boolean>
  /** Whether a refresh is in progress */
  isRefreshing: boolean
  /** Last refresh error message */
  refreshError: string | null
}

/**
 * Decodes a JWT token and returns the expiry timestamp (seconds since epoch).
 * Returns null if the token cannot be decoded.
 */
function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    return payload.exp ?? null
  } catch {
    return null
  }
}

// Use btoa/atob for browser environment
function getTokenExpiryBrowser(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Browser-compatible base64url decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(decodeURIComponent(escape(atob(base64))))
    return payload.exp ?? null
  } catch {
    return null
  }
}

export function useSessionWatchdog({
  token,
  onTokenRefreshed,
  onSessionExpired,
  warningMinutes = 10,
  refreshMinutes = 5,
}: SessionWatchdogOptions): SessionWatchdogReturn {
  const [isExpiringSoon, setIsExpiringSoon] = useState(false)
  const [minutesRemaining, setMinutesRemaining] = useState<number | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasRefreshedRef = useRef(false)
  const hasWarnedRef = useRef(false)
  const hasExpiredRef = useRef(false)

  const refreshNow = useCallback(async (): Promise<boolean> => {
    if (!token || isRefreshing) return false

    setIsRefreshing(true)
    setRefreshError(null)

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!response.ok) {
        const data = await response.json()
        setRefreshError(data.error || 'Refresh failed')

        if (response.status === 401) {
          // Session cannot be refreshed — it's truly expired
          onSessionExpired()
          return false
        }
        return false
      }

      const data = await response.json()
      onTokenRefreshed(data.token)
      hasRefreshedRef.current = true
      setIsExpiringSoon(false)
      setMinutesRemaining(null)
      return true
    } catch (err) {
      setRefreshError('Network error during refresh')
      return false
    } finally {
      setIsRefreshing(false)
    }
  }, [token, isRefreshing, onTokenRefreshed, onSessionExpired])

  useEffect(() => {
    if (!token) {
      setIsExpiringSoon(false)
      setMinutesRemaining(null)
      return
    }

    // Reset flags when token changes (e.g., after refresh)
    hasRefreshedRef.current = false
    hasWarnedRef.current = false
    hasExpiredRef.current = false

    const checkToken = () => {
      const exp = getTokenExpiryBrowser(token)
      if (!exp) return

      const nowSec = Date.now() / 1000
      const remainingSec = exp - nowSec
      const remainingMin = Math.max(0, Math.floor(remainingSec / 60))

      setMinutesRemaining(remainingMin)

      // Session expired
      if (remainingSec <= 0) {
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true
          onSessionExpired()
        }
        return
      }

      // Auto-refresh when within refresh window
      if (remainingMin <= refreshMinutes && !hasRefreshedRef.current) {
        hasRefreshedRef.current = true
        refreshNow()
        return
      }

      // Show warning when within warning window
      if (remainingMin <= warningMinutes && !hasWarnedRef.current) {
        hasWarnedRef.current = true
        setIsExpiringSoon(true)
      }
    }

    // Check immediately
    checkToken()

    // Then check every 30 seconds
    intervalRef.current = setInterval(checkToken, 30_000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [token, warningMinutes, refreshMinutes, onSessionExpired, refreshNow])

  return {
    isExpiringSoon,
    minutesRemaining,
    refreshNow,
    isRefreshing,
    refreshError,
  }
}
