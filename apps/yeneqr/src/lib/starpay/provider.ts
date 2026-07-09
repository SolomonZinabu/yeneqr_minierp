/**
 * StarPay Payment Provider — YeneQR PaymentProvider Implementation
 *
 * Implements the YeneQR PaymentProvider interface for StarPay Ethiopia.
 * Unlike other providers (Chapa, Telebirr, CBE Birr) which use global env vars,
 * StarPay uses per-restaurant credentials stored in the database.
 *
 * The provider is instantiated per-request with the restaurant's config,
 * NOT as a singleton.
 */

import * as crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import {
  type PaymentProvider,
  type InitiatePaymentDTO,
  type PaymentResult,
  type PaymentVerification,
  type RefundDTO,
  type RefundResult,
  type TransactionStatus,
} from '@/lib/payments'
import {
  StarPayClient,
  createStarPayClient,
  formatEthiopianPhone,
  type StarPayConfig,
} from '@/lib/starpay'
import { verifySignature, isFreshCallback } from '@/lib/starpay/signature'
import type { StarPayCallbackPayload } from '@/lib/starpay/types'

export class StarPayProvider implements PaymentProvider {
  name = 'starpay'
  private client: StarPayClient
  private webhookSecret: string

  constructor(config: StarPayConfig) {
    this.client = createStarPayClient(config)
    this.webhookSecret = config.webhookSecret
  }

  /**
   * Initiate a StarPay payment order.
   * Creates a transaction on StarPay and returns the payment_url for customer redirect.
   */
  async initiatePayment(params: InitiatePaymentDTO): Promise<PaymentResult> {
    try {
      const providerReference = uuidv4()

      // Format customer phone for StarPay (requires +251XXXXXXXXX)
      const customerPhone = params.customerPhone
        ? formatEthiopianPhone(params.customerPhone)
        : ''

      // Order expires in 2 hours
      const expiredAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

      const result = await this.client.createOrder({
        amount: Math.round(params.amount * 100) / 100, // Round to 2 decimal places
        description: `YeneQR Order - ${params.orderId}`,
        currency: params.currency || 'ETB',
        customerName: params.customerName || 'Guest Customer',
        customerPhoneNumber: customerPhone || '+251900000000', // Fallback required by StarPay
        customerEmail: params.customerEmail,
        callbackURL: params.webhookUrl,
        redirectUrl: params.returnUrl,
        items: [
          {
            productId: params.orderId,
            quantity: 1,
            item_name: `Order ${params.orderId}`,
            unit_price: params.amount,
          },
        ],
        metadata: {
          orderId: params.orderId,
          ...(params.metadata || {}),
        },
        expiredAt,
      })

      if (!result.success || !result.data) {
        return {
          success: false,
          providerReference,
          status: 'failed',
          message: result.error || 'Failed to create StarPay order',
        }
      }

      const orderData = result.data.data

      return {
        success: true,
        providerReference: orderData.order_id || providerReference,
        checkoutUrl: orderData.payment_url,
        status: 'pending',
        message: 'StarPay order created. Redirect customer to payment_url.',
        rawResponse: result.data as unknown as Record<string, unknown>,
      }
    } catch (error) {
      console.error('[StarPayProvider] initiatePayment error:', error)
      return {
        success: false,
        providerReference: uuidv4(),
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Verify a payment by calling StarPay's verify endpoint.
   */
  async verifyPayment(reference: string): Promise<PaymentVerification> {
    try {
      const result = await this.client.verifyPayment(reference)

      if (!result.success || !result.data) {
        return {
          verified: false,
          status: 'failed',
          amount: 0,
          providerReference: reference,
          rawResponse: result as unknown as Record<string, unknown>,
        }
      }

      const data = result.data.data
      const status = mapStarPayStatus(data.status)

      return {
        verified: true,
        status,
        amount: typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount,
        providerReference: data.order_id,
        paidAt: status === 'completed' ? new Date(data.updated_at) : undefined,
        rawResponse: result.data as unknown as Record<string, unknown>,
      }
    } catch (error) {
      console.error('[StarPayProvider] verifyPayment error:', error)
      return {
        verified: false,
        status: 'failed',
        amount: 0,
        providerReference: reference,
      }
    }
  }

  /**
   * StarPay doesn't natively support refunds via this API.
   * Refunds would need to be handled out-of-band or via StarPay dashboard.
   */
  async processRefund(_params: RefundDTO): Promise<RefundResult> {
    return {
      success: false,
      refundReference: uuidv4(),
      status: 'rejected',
      message: 'StarPay refunds are not supported via API. Please process through the StarPay merchant dashboard.',
    }
  }

  /**
   * Get transaction status by verifying with StarPay API.
   */
  async getTransactionStatus(reference: string): Promise<TransactionStatus> {
    const verification = await this.verifyPayment(reference)

    return {
      reference,
      status: verification.status,
      amount: verification.amount,
      providerReference: verification.providerReference,
      updatedAt: new Date(),
    }
  }

  /**
   * Handle StarPay webhook callback.
   *
   * Verifies the HMAC-SHA256 signature and extracts payment status.
   * StarPay sends callbacks with X-Signature and X-Timestamp headers.
   *
   * IMPORTANT: In multi-tenant mode, we need the restaurant's webhookSecret
   * to verify the signature. The webhook route must fetch this from the DB
   * and pass it via headers before calling this method.
   */
  async handleWebhook(
    payload: unknown,
    headers: Record<string, string>
  ): Promise<PaymentVerification> {
    try {
      const signature = headers['x-signature'] || headers['X-Signature']
      const timestamp = headers['x-timestamp'] || headers['X-Timestamp']

      // If we have signature and timestamp, verify them
      let signatureVerified = false

      if (signature && timestamp) {
        // Check timestamp freshness (replay attack protection)
        if (!isFreshCallback(timestamp)) {
          console.warn('[StarPayProvider] Callback timestamp too old:', timestamp)
          return {
            verified: false,
            status: 'failed',
            amount: 0,
            providerReference: '',
            rawResponse: payload as Record<string, unknown>,
          }
        }

        // Verify HMAC-SHA256 signature
        if (this.webhookSecret) {
          signatureVerified = verifySignature(
            payload,
            timestamp,
            signature,
            this.webhookSecret
          )

          if (!signatureVerified) {
            console.error('[StarPayProvider] Signature verification failed')
            return {
              verified: false,
              status: 'failed',
              amount: 0,
              providerReference: '',
              rawResponse: payload as Record<string, unknown>,
            }
          }
        } else {
          // Sandbox mode: accept without signature verification (with warning)
          console.warn('[StarPayProvider] No webhook secret configured — accepting callback without signature verification')
          signatureVerified = true
        }
      } else {
        console.warn('[StarPayProvider] Missing X-Signature or X-Timestamp headers')
      }

      // Parse callback payload
      const callback = payload as StarPayCallbackPayload
      const status = mapStarPayCallbackStatus(callback.status)

      return {
        verified: signatureVerified,
        status,
        amount: callback.amount || 0,
        providerReference: callback.billRefNo || callback.externalReferenceId || '',
        paidAt: status === 'completed' ? new Date() : undefined,
        rawResponse: payload as Record<string, unknown>,
      }
    } catch (error) {
      console.error('[StarPayProvider] handleWebhook error:', error)
      return {
        verified: false,
        status: 'failed',
        amount: 0,
        providerReference: '',
      }
    }
  }
}

// ─── Status Mapping Helpers ──────────────────────────────────────────────────

/**
 * Map StarPay verify response status to YeneQR payment status
 */
function mapStarPayStatus(
  starPayStatus: string
): 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' {
  switch (starPayStatus) {
    case 'PAID':
    case 'SETTLED':
      return 'completed'
    case 'PENDING':
    case 'UNPAID':
      return 'pending'
    case 'FAILED':
      return 'failed'
    default:
      return 'pending'
  }
}

/**
 * Map StarPay callback status to YeneQR payment status
 */
function mapStarPayCallbackStatus(
  starPayStatus: string
): 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' {
  switch (starPayStatus) {
    case 'PAID':
    case 'SETTLED':
      return 'completed'
    case 'FAILED':
      return 'failed'
    default:
      return 'pending'
  }
}
