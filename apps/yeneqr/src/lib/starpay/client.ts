/**
 * StarPay Ethiopia API Client — YeneQR Multi-Tenant Adaptation
 *
 * Handles authentication, request management, and HTTP communication with
 * the StarPay payment gateway API. Adapted for multi-tenant SaaS where each
 * restaurant has its own StarPay merchant account.
 *
 * KEY DIFFERENCE from reference implementation:
 * - No singleton — a new client is created per-request with restaurant-specific config
 * - Config comes from DB (Restaurant.starPayApiSecret, etc.), not env vars
 * - Each restaurant's credentials are isolated
 *
 * API Documentation: https://developer.starpayethiopia.com/
 * Sandbox API: https://starpayqa.starpayethiopia.com/v1/starpay-api
 * Production API: https://api.starpayethiopia.com/v1/starpay-api
 *
 * NOTE: api_secret and merchant_id are NOT sent in the request body.
 * Authentication is handled via the x-api-secret header and middleware.
 */

import {
  StarPayConfig,
  CreateOrderRequest,
  CreateOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from './types'

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 30000 // 30 seconds
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

// ─── Client Class ────────────────────────────────────────────────────────────

export class StarPayClient {
  private config: StarPayConfig

  constructor(config: StarPayConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || DEFAULT_TIMEOUT,
    }
  }

  // ─── HTTP Methods ────────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    const url = `${this.config.apiUrl}${endpoint}`
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeout
    )

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-secret': this.config.apiSecret,
        'User-Agent': 'YeneQR/1.0',
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const data = await response.json()

      if (!response.ok) {
        const errorMessage =
          data?.error?.message ||
          data?.message ||
          `HTTP ${response.status}: ${response.statusText}`
        console.error('[StarPay] API error:', {
          status: response.status,
          endpoint,
          error: errorMessage,
          merchantId: this.config.merchantId,
        })
        return { success: false, error: errorMessage }
      }

      return { success: true, data: data as T }
    } catch (error) {
      clearTimeout(timeout)
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('[StarPay] Request failed:', { endpoint, error: message })
      return { success: false, error: message }
    }
  }

  /**
   * Make a request with automatic retry on transient failures
   */
  private async requestWithRetry<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    let lastError: string | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const result = await this.request<T>(method, endpoint, body)

      if (result.success) return result

      lastError = result.error || 'Unknown error'

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1)
        console.warn(
          `[StarPay] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms:`,
          lastError
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    return { success: false, error: lastError || 'Max retries exceeded' }
  }

  // ─── Create Transaction ──────────────────────────────────────────────────

  /**
   * Create a new payment order on StarPay
   *
   * This initiates a payment session and returns a payment URL
   * where the customer can complete the payment.
   */
  async createOrder(params: {
    amount: number
    description: string
    currency?: string
    customerName: string
    customerPhoneNumber: string
    customerEmail?: string
    callbackURL: string
    redirectUrl?: string
    items: Array<{
      productId: string
      quantity: number
      item_name: string
      unit_price: number
    }>
    metadata?: Record<string, unknown>
    customerId?: string
    expiredAt?: string
  }): Promise<{
    success: boolean
    data?: CreateOrderResponse
    error?: string
  }> {
    const body: CreateOrderRequest = {
      amount: params.amount,
      description: params.description,
      currency: params.currency || 'ETB',
      customerName: params.customerName,
      customerPhoneNumber: params.customerPhoneNumber,
      customerEmail: params.customerEmail,
      callbackURL: params.callbackURL,
      redirectUrl: params.redirectUrl,
      items: params.items,
      metadata: params.metadata,
      customer_id: params.customerId,
      expiredAt: params.expiredAt,
    }

    return this.requestWithRetry<CreateOrderResponse>(
      'POST',
      '/trdp/order',
      body as unknown as Record<string, unknown>
    )
  }

  // ─── Verify Payment ──────────────────────────────────────────────────────

  /**
   * Verify a payment by order ID
   * Use this to check the current status of a payment.
   */
  async verifyPayment(orderId: string): Promise<{
    success: boolean
    data?: VerifyPaymentResponse
    error?: string
  }> {
    const body: VerifyPaymentRequest = { orderId }

    return this.requestWithRetry<VerifyPaymentResponse>(
      'POST',
      '/trdp/verify',
      body as unknown as Record<string, unknown>
    )
  }

  // ─── Health Check ────────────────────────────────────────────────────────

  /**
   * Test the StarPay API connection using this restaurant's credentials
   */
  async testConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      const result = await this.request<unknown>(
        'POST',
        '/trdp/verify',
        { orderId: 'test-connection-check' }
      )
      return { connected: true }
    } catch {
      return { connected: false, error: 'Connection failed' }
    }
  }

  // ─── Getters ─────────────────────────────────────────────────────────────

  get merchantId(): string {
    return this.config.merchantId
  }

  get webhookSecret(): string {
    return this.config.webhookSecret
  }

  get isSandbox(): boolean {
    return this.config.apiUrl.includes('starpayqa') ||
           this.config.apiUrl.includes('sandbox')
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

/**
 * Create a StarPay client from restaurant's DB-stored configuration.
 * This is the primary way to instantiate the client in API routes.
 *
 * @param config - StarPay config from the Restaurant model
 * @returns StarPayClient instance with restaurant-specific credentials
 */
export function createStarPayClient(config: StarPayConfig): StarPayClient {
  return new StarPayClient(config)
}

/**
 * Create a StarPay client from restaurant DB fields.
 * Convenience function that maps Restaurant model fields to StarPayConfig.
 */
export function createStarPayClientFromRestaurant(restaurant: {
  starPayApiUrl: string | null
  starPayApiSecret: string | null
  starPayMerchantId: string | null
  starPayWebhookSecret: string | null
  starPayEnabled: boolean
}): StarPayClient | null {
  if (!restaurant.starPayEnabled) return null
  if (!restaurant.starPayApiSecret || !restaurant.starPayMerchantId) return null

  return new StarPayClient({
    apiUrl: restaurant.starPayApiUrl || 'https://starpayqa.starpayethiopia.com/v1/starpay-api',
    apiSecret: restaurant.starPayApiSecret,
    merchantId: restaurant.starPayMerchantId,
    webhookSecret: restaurant.starPayWebhookSecret || '',
  })
}

/**
 * Format an Ethiopian phone number to international format (+251XXXXXXXXX)
 * StarPay requires this format for customerPhoneNumber
 */
export function formatEthiopianPhone(phone: string): string {
  if (!phone) return ''
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '')

  // Already in international format
  if (digits.startsWith('251')) {
    return `+${digits}`
  }
  // Local format starting with 0 — remove leading 0
  if (digits.startsWith('0')) {
    digits = digits.substring(1)
  }
  // Now digits should be 9XXXXXXXX
  return `+251${digits}`
}
