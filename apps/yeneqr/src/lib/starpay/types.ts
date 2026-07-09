/**
 * StarPay Ethiopia API Types — YeneQR Multi-Tenant Adaptation
 *
 * Type definitions for the StarPay payment gateway integration.
 * Adapted from techbee-hospitality reference implementation for
 * YeneQR's SaaS multi-tenant architecture where each restaurant
 * has its own StarPay merchant account.
 *
 * @see https://developer.starpayethiopia.com/
 */

// ─── Per-Restaurant Configuration ──────────────────────────────────────────

export interface StarPayConfig {
  /** StarPay API base URL (sandbox or production) */
  apiUrl: string
  /** Your x-api-secret key from StarPay dashboard */
  apiSecret: string
  /** Your merchant ID from StarPay dashboard */
  merchantId: string
  /** Webhook secret for HMAC-SHA256 callback verification */
  webhookSecret: string
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
}

/** Sandbox and production API URLs */
export const STARPAY_SANDBOX_URL = 'https://starpayqa.starpayethiopia.com/v1/starpay-api'
export const STARPAY_PRODUCTION_URL = 'https://api.starpayethiopia.com/v1/starpay-api'

// ─── Create Transaction (POST /trdp/order) ──────────────────────────────────

export interface CreateOrderItem {
  productId: string
  quantity: number
  item_name: string
  unit_price: number
}

export interface CreateOrderRequest {
  amount: number
  description: string
  currency: string
  customerName: string
  customerPhoneNumber: string
  customerEmail?: string
  callbackURL: string
  redirectUrl?: string
  expiredAt?: string
  items: CreateOrderItem[]
  metadata?: Record<string, unknown>
  customer_id?: string
}

export interface CreateOrderResponse {
  status: 'success' | 'error'
  timestamp: string
  message: string
  data: {
    order_id: string
    status: string
    amount: string | number
    currency: string
    payment_url: string
    redirectUrl?: string
    expires_at: string
    metadata?: Record<string, unknown>
  }
}

// ─── Payment Verification (POST /trdp/verify) ──────────────────────────────

export interface VerifyPaymentRequest {
  orderId: string
}

export interface VerifyPaymentResponse {
  status: 'success' | 'error'
  timestamp: string
  message: string
  data: {
    order_id: string
    status: 'UNPAID' | 'PAID' | 'SETTLED' | 'PENDING' | 'FAILED' | string
    amount: number | string
    currency: string
    updated_at: string
    expired_at?: string
    meta_data?: Record<string, unknown> | null
  }
}

// ─── Callback / Webhook Payload ─────────────────────────────────────────────

export interface StarPayCallbackPayload {
  billRefNo: string
  status: 'PAID' | 'SETTLED' | 'FAILED' | string
  timestamp: string
  message: string
  merchantId: string
  customerId?: string
  externalReferenceId?: string
  amount?: number
  payment_type?: string
  receipt_url?: string
}

// ─── Signature Verification ─────────────────────────────────────────────────

export interface SignatureHeaders {
  'X-Signature': string
  'X-Timestamp': string
}

// ─── Error Types ────────────────────────────────────────────────────────────

export interface StarPayError {
  status: 'error'
  timestamp: string
  path: string
  error: {
    code: string
    message: string
  }
}

// ─── Payment Method Mapping ─────────────────────────────────────────────────

/**
 * Maps YeneQR internal payment method names to StarPay-compatible identifiers.
 * StarPay handles telebirr, CBE Birr, Chapa, card, and bank transfer
 * through a single unified checkout — the customer chooses on the StarPay page.
 */
export const STARPAY_PAYMENT_METHOD_MAP: Record<string, string> = {
  telebirr: 'USSD_PUSH',
  cbe_birr: 'USSD_PUSH',
  chapa: 'USSD_PUSH',
  card: 'CARD',
  bank_transfer: 'BANK_TRANSFER',
} as const

/**
 * Reverse map: StarPay payment_type → YeneQR internal method
 */
export const STARPAY_TYPE_TO_METHOD: Record<string, string> = {
  USSD_PUSH: 'telebirr',
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
} as const
