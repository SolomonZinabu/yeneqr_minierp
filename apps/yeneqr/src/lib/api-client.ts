// ============================================================
// Yene QR — Frontend API Client
// Centralized fetch wrapper with JWT auth headers
// ============================================================
// Standard practices:
// 1. Every request attaches the Bearer token if available
// 2. On 401: attempts token refresh ONCE, then retries the original request
// 3. If refresh fails: clears auth state + redirects to the restaurant's login page
// 4. Prevents multiple simultaneous refresh attempts (singleton lock)
// 5. Prevents redirect loops (tracks if we're already redirecting)
// ============================================================

import { useAppStore } from './store'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface ApiOptions extends RequestInit {
  params?: Record<string, string>
}

class ApiClient {
  private refreshPromise: Promise<string | null> | null = null
  private isRedirecting = false

  private getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('yeneqr_token')
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    const token = this.getToken()
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  /**
   * Attempt to refresh the staff token.
   * Staff tokens are JWT-based with 24h expiry — we can't "refresh" them
   * like customer sessions. Instead, if the token is expired, we redirect
   * to login. But first we try the refresh endpoint (it handles customer
   * tokens; for staff it will fail gracefully and we redirect).
   *
   * Returns the new token if refresh succeeded, null otherwise.
   */
  private async tryRefresh(): Promise<string | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = (async () => {
      const currentToken = this.getToken()
      if (!currentToken) return null

      try {
        const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: currentToken }),
        })

        if (!response.ok) return null

        const data = await response.json()
        if (data.token) {
          // Store the new token
          if (typeof window !== 'undefined') {
            localStorage.setItem('yeneqr_token', data.token)
          }
          // Update the store if the user object exists
          const store = useAppStore.getState()
          if (store.user) {
            store.setAuth(data.token, store.user)
          }
          return data.token
        }
        return null
      } catch {
        return null
      } finally {
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  /**
   * Redirect to the appropriate login page.
   * Uses the current hash route to determine which restaurant slug to use.
   * Prevents redirect loops with a flag.
   */
  private redirectToLogin(): void {
    if (typeof window === 'undefined') return
    if (this.isRedirecting) return

    this.isRedirecting = true

    // Clear auth state
    useAppStore.getState().logout()

    // Determine the login URL from the current hash route
    // Hash format: #/{slug}/dashboard or #/{slug}/login or #/admin
    const hash = window.location.hash.replace(/^#/, '')
    const parts = hash.split('/').filter(Boolean)

    let loginUrl = '/#/' // default to landing

    if (parts.length > 0) {
      if (parts[0] === 'admin') {
        loginUrl = '/#/admin'
      } else {
        // parts[0] is the restaurant slug
        const slug = parts[0]
        loginUrl = `/#/${slug}/login`
      }
    }

    // Use a small delay to allow any pending UI updates to complete
    setTimeout(() => {
      window.location.hash = loginUrl.replace(/^\/#/, '')
      // Force a reload to clear any stale state
      window.location.reload()
    }, 100)
  }

  async request<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options

    let url = `${BASE_URL}${endpoint}`
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    const makeRequest = (token?: string | null): Promise<Response> => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      }
      const authToken = token || this.getToken()
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }
      return fetch(url, {
        ...fetchOptions,
        headers,
      })
    }

    // First attempt with current token
    let response = await makeRequest()

    // ── Handle 401: try refresh, then retry once ──
    if (response.status === 401) {
      // Don't attempt refresh for the refresh endpoint itself (prevents infinite loop)
      if (endpoint === '/api/auth/refresh') {
        this.redirectToLogin()
        throw new Error('Session expired. Please log in again.')
      }

      // Try to refresh the token
      const newToken = await this.tryRefresh()

      if (newToken) {
        // Retry the original request with the new token
        response = await makeRequest(newToken)

        if (response.status === 401) {
          // Still 401 after refresh — give up and redirect
          this.redirectToLogin()
          throw new Error('Session expired. Please log in again.')
        }
      } else {
        // Refresh failed — redirect to login
        this.redirectToLogin()
        throw new Error('Session expired. Please log in again.')
      }
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || `Request failed with status ${response.status}`)
    }

    return response.json()
  }

  async get<T = unknown>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params })
  }

  async post<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async put<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async patch<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async delete<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    })
  }
}

export const api = new ApiClient()

// ─── Typed API Response Helpers ──────────────────────────────

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// ─── Format helpers (keeping compatible with mock-data) ──────

export function formatCurrency(amount: number): string {
  return `ETB ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}
