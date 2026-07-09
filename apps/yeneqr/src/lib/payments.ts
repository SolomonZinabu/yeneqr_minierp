// ============================================================
// Yene QR — Payment Provider Abstraction Layer
// Real + Mock fallback implementations for Telebirr, Chapa, CBE Birr, Cash
// ============================================================

import * as crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

export type PaymentMethod = 'telebirr' | 'chapa' | 'cbe_birr' | 'cash' | 'starpay'

export interface InitiatePaymentDTO {
  orderId: string
  amount: number
  tipAmount?: number
  currency: string
  method: PaymentMethod
  customerPhone?: string
  customerEmail?: string
  customerName?: string
  returnUrl: string
  webhookUrl: string
  metadata?: Record<string, unknown>
}

export interface PaymentResult {
  success: boolean
  providerReference: string
  checkoutUrl?: string  // Redirect URL for customer
  status: 'pending' | 'processing' | 'completed' | 'failed'
  message: string
  rawResponse?: Record<string, unknown>
}

export interface PaymentVerification {
  verified: boolean
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
  amount: number
  providerReference: string
  paidAt?: Date
  rawResponse?: Record<string, unknown>
}

export interface RefundDTO {
  paymentReference: string
  amount: number
  reason: string
}

export interface RefundResult {
  success: boolean
  refundReference: string
  status: 'pending' | 'processed' | 'rejected'
  message: string
}

export interface TransactionStatus {
  reference: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
  amount: number
  providerReference: string
  updatedAt: Date
}

// ============================================================
// Payment Provider Interface
// All providers must implement this interface
// ============================================================

export interface PaymentProvider {
  name: string
  initiatePayment(params: InitiatePaymentDTO): Promise<PaymentResult>
  verifyPayment(reference: string): Promise<PaymentVerification>
  processRefund(params: RefundDTO): Promise<RefundResult>
  getTransactionStatus(reference: string): Promise<TransactionStatus>
  handleWebhook(payload: unknown, headers: Record<string, string>): Promise<PaymentVerification>
}

// ============================================================
// Telebirr Provider (Real + Mock Fallback)
// ============================================================
// Telebirr H5Pay API Flow:
// 1. Merchant creates signed request with appId, merchantOrderId, totalAmount
// 2. Request is signed with RSA private key (RSA-SHA256)
// 3. User is redirected to Telebirr checkout URL
// 4. Telebirr sends webhook notification on payment completion
// ============================================================

export class TelebirrProvider implements PaymentProvider {
  name = 'telebirr'
  private appId: string
  private appKey: string
  private publicKey: string
  private privateKey: string
  private baseUrl: string

  constructor() {
    this.appId = process.env.TELEBIRR_APP_ID || ''
    this.appKey = process.env.TELEBIRR_APP_KEY || ''
    this.publicKey = process.env.TELEBIRR_PUBLIC_KEY || ''
    this.privateKey = process.env.TELEBIRR_PRIVATE_KEY || ''
    this.baseUrl = process.env.TELEBIRR_BASE_URL || 'https://app.ethiotelecom.et'
  }

  /**
   * Check if real Telebirr credentials are configured
   */
  private isConfigured(): boolean {
    return !!(this.appId && this.privateKey)
  }

  async initiatePayment(params: InitiatePaymentDTO): Promise<PaymentResult> {
    if (!this.isConfigured()) {
      return this.mockInitiate(params)
    }

    const nonce = uuidv4()
    const timestamp = Date.now().toString()
    const subject = `Order ${params.orderId}`
    const totalAmount = params.amount.toString()

    // Build request object matching Telebirr H5Pay spec
    const requestParams = {
      appId: this.appId,
      merchantOrderId: params.orderId,
      totalAmount,
      subject,
      notifyUrl: params.webhookUrl,
      returnUrl: params.returnUrl || '',
      nonce,
      timestamp,
    }

    // Sign with RSA private key
    const sign = this.signRequest(requestParams)

    try {
      const response = await fetch(`${this.baseUrl}/service/openapi/pay/h5`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: this.appId,
          sign,
          ...requestParams,
        }),
      })

      const result = await response.json()

      if (result.code === '0' || result.code === 0) {
        return {
          success: true,
          providerReference: result.merchantOrderId || params.orderId,
          checkoutUrl: result.payUrl || result.redirectUrl,
          status: 'pending',
          message: 'Redirect to Telebirr for payment',
          rawResponse: result,
        }
      }

      return {
        success: false,
        providerReference: params.orderId,
        status: 'failed',
        message: result.msg || 'Telebirr payment initiation failed',
        rawResponse: result,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Telebirr connection failed'
      return {
        success: false,
        providerReference: params.orderId,
        status: 'failed',
        message,
      }
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerification> {
    if (!this.isConfigured()) {
      return this.mockVerify(reference)
    }

    try {
      const timestamp = Date.now().toString()
      const nonce = uuidv4()

      const queryParams = {
        appId: this.appId,
        merchantOrderId: reference,
        timestamp,
        nonce,
      }
      const sign = this.signRequest(queryParams)

      const response = await fetch(`${this.baseUrl}/service/openapi/pay/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...queryParams, sign }),
      })

      const result = await response.json()

      if (result.code === '0' || result.code === 0) {
        const status =
          result.tradeStatus === 'SUCCESS' ? 'completed' :
          result.tradeStatus === 'WAITING' ? 'pending' : 'failed'

        return {
          verified: status === 'completed',
          status,
          amount: parseFloat(result.totalAmount || '0'),
          providerReference: reference,
          paidAt: result.payTime ? new Date(result.payTime) : undefined,
          rawResponse: result,
        }
      }

      return {
        verified: false,
        status: 'failed',
        amount: 0,
        providerReference: reference,
        rawResponse: result,
      }
    } catch {
      return {
        verified: false,
        status: 'failed',
        amount: 0,
        providerReference: reference,
      }
    }
  }

  async processRefund(params: RefundDTO): Promise<RefundResult> {
    if (!this.isConfigured()) {
      return this.mockRefund(params)
    }

    try {
      const timestamp = Date.now().toString()
      const nonce = uuidv4()
      const refundParams = {
        appId: this.appId,
        merchantOrderId: params.paymentReference,
        refundAmount: params.amount.toString(),
        reason: params.reason,
        timestamp,
        nonce,
      }
      const sign = this.signRequest(refundParams)

      const response = await fetch(`${this.baseUrl}/service/openapi/pay/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...refundParams, sign }),
      })

      const result = await response.json()

      if (result.code === '0' || result.code === 0) {
        return {
          success: true,
          refundReference: result.refundOrderId || `TBR-REFUND-${Date.now()}`,
          status: 'processed',
          message: 'Telebirr refund processed successfully.',
        }
      }

      return {
        success: false,
        refundReference: `TBR-REFUND-${Date.now()}`,
        status: 'rejected',
        message: result.msg || 'Telebirr refund failed',
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Telebirr refund connection failed'
      return {
        success: false,
        refundReference: `TBR-REFUND-${Date.now()}`,
        status: 'rejected',
        message,
      }
    }
  }

  async getTransactionStatus(reference: string): Promise<TransactionStatus> {
    if (!this.isConfigured()) {
      return this.mockTransactionStatus(reference)
    }

    const verification = await this.verifyPayment(reference)
    return {
      reference,
      status: verification.status,
      amount: verification.amount,
      providerReference: verification.providerReference,
      updatedAt: new Date(),
    }
  }

  async handleWebhook(payload: unknown, headers: Record<string, string>): Promise<PaymentVerification> {
    const data = payload as Record<string, unknown>

    // If real credentials are configured, verify the webhook signature
    if (this.isConfigured() && this.publicKey) {
      const signatureVerified = this.verifyWebhookSignature(data, headers)
      if (!signatureVerified) {
        console.warn('[TELEBIRR_WEBHOOK] Signature verification failed', {
          reference: data.merchantOrderId || data.tradeNo,
        })
        return {
          verified: false,
          status: 'failed',
          amount: 0,
          providerReference: (data.merchantOrderId as string) || (data.tradeNo as string) || '',
          rawResponse: data,
        }
      }
    }

    // Parse payment status from webhook payload
    const tradeStatus = data.tradeStatus as string
    const status = tradeStatus === 'SUCCESS' ? 'completed' :
                   tradeStatus === 'WAITING' ? 'pending' : 'failed'

    return {
      verified: status === 'completed',
      status,
      amount: parseFloat((data.totalAmount as string) || '0'),
      providerReference: (data.merchantOrderId as string) || (data.tradeNo as string) || '',
      paidAt: data.payTime ? new Date(data.payTime as string) : new Date(),
      rawResponse: data,
    }
  }

  // -------------------------------------------------------
  // RSA Signing Helpers
  // -------------------------------------------------------

  /**
   * Sign request params with RSA-SHA256 using the merchant private key.
   * Params are sorted alphabetically by key and joined as key=value pairs.
   */
  private signRequest(params: Record<string, string>): string {
    try {
      const sortedParams = Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&')

      const sign = crypto.createSign('RSA-SHA256')
      sign.update(sortedParams)

      // Ensure PEM format for the private key
      const privateKeyPem = this.normalizePem(this.privateKey, 'PRIVATE KEY')
      return sign.sign(privateKeyPem, 'base64')
    } catch (error) {
      console.error('[TELEBIRR_SIGN] RSA signing failed:', error)
      return ''
    }
  }

  /**
   * Verify webhook signature using Telebirr's public key.
   */
  private verifyWebhookSignature(
    data: Record<string, unknown>,
    _headers: Record<string, string>
  ): boolean {
    try {
      const sign = data.sign as string
      if (!sign) return false

      // Remove sign from data for verification
      const { sign: _, ...verifyData } = data
      const sortedParams = Object.keys(verifyData)
        .sort()
        .map((k) => `${k}=${verifyData[k]}`)
        .join('&')

      const publicKeyPem = this.normalizePem(this.publicKey, 'PUBLIC KEY')
      const verifier = crypto.createVerify('RSA-SHA256')
      verifier.update(sortedParams)
      return verifier.verify(publicKeyPem, sign, 'base64')
    } catch (error) {
      console.error('[TELEBIRR_WEBHOOK_VERIFY] Signature verification error:', error)
      return false
    }
  }

  /**
   * Normalize a key string to PEM format if it isn't already.
   */
  private normalizePem(key: string, type: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
    if (key.includes('-----BEGIN')) return key
    return `-----BEGIN ${type}-----\n${key}\n-----END ${type}-----`
  }

  // -------------------------------------------------------
  // Mock Fallbacks (used when credentials are not configured)
  // -------------------------------------------------------

  private mockInitiate(params: InitiatePaymentDTO): PaymentResult {
    const reference = `TBR-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    return {
      success: true,
      providerReference: reference,
      checkoutUrl: `https://mock.telebirr.com/pay?ref=${reference}&amount=${params.amount}`,
      status: 'pending',
      message: 'Telebirr payment initiated (MOCK). Customer should complete payment in Telebirr app.',
      rawResponse: {
        outTradeNo: params.orderId,
        tradeNo: reference,
        totalAmount: params.amount,
        currency: params.currency,
        mock: true,
      },
    }
  }

  private mockVerify(reference: string): PaymentVerification {
    // Deterministic mock: always succeed in development
    // This avoids random test failures from Math.random()
    return {
      verified: true,
      status: 'completed' as const,
      amount: 0,
      providerReference: reference,
      paidAt: new Date(),
      rawResponse: { tradeNo: reference, tradeStatus: 'TRADE_SUCCESS', mock: true },
    }
  }

  private mockRefund(params: RefundDTO): RefundResult {
    const refundRef = `TBR-REFUND-${Date.now()}`
    return {
      success: true,
      refundReference: refundRef,
      status: 'processed',
      message: 'Telebirr refund processed successfully (MOCK).',
    }
  }

  private mockTransactionStatus(reference: string): TransactionStatus {
    return {
      reference,
      status: 'completed',
      amount: 0,
      providerReference: reference,
      updatedAt: new Date(),
    }
  }
}

// ============================================================
// Chapa Provider (Real + Mock Fallback)
// ============================================================
// Chapa REST API Flow:
// 1. POST to /v1/transaction/initialize with Bearer auth
// 2. Returns checkout URL for customer redirect
// 3. Webhook callback on payment completion
// 4. Verify with GET /v1/transaction/verify/{reference}
// ============================================================

export class ChapaProvider implements PaymentProvider {
  name = 'chapa'
  private secretKey: string
  private baseUrl: string
  private webhookSecret: string

  constructor() {
    this.secretKey = process.env.CHAPA_SECRET_KEY || ''
    this.baseUrl = process.env.CHAPA_BASE_URL || 'https://api.chapa.co/v1'
    this.webhookSecret = process.env.CHAPA_WEBHOOK_SECRET || ''
  }

  /**
   * Check if real Chapa credentials are configured
   */
  private isConfigured(): boolean {
    return !!this.secretKey
  }

  async initiatePayment(params: InitiatePaymentDTO): Promise<PaymentResult> {
    if (!this.isConfigured()) {
      return this.mockInitiate(params)
    }

    try {
      const txRef = `CHP-${params.orderId}-${Date.now()}`

      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency || 'ETB',
          email: params.customerEmail || 'customer@yeneqr.et',
          first_name: params.customerName?.split(' ')[0] || 'Customer',
          last_name: params.customerName?.split(' ').slice(1).join(' ') || '',
          phone_number: params.customerPhone || '',
          tx_ref: txRef,
          callback_url: params.webhookUrl,
          return_url: params.returnUrl,
          customization: {
            title: 'Yene QR Order',
            description: `Payment for order ${params.orderId}`,
          },
          meta: {
            orderId: params.orderId,
            hide_receipt: true,
          },
        }),
      })

      const result = await response.json()

      if (result.status === 'success') {
        return {
          success: true,
          providerReference: result.data?.tx_ref || txRef,
          checkoutUrl: result.data?.checkout_url,
          status: 'pending',
          message: 'Redirect to Chapa for payment',
          rawResponse: result,
        }
      }

      return {
        success: false,
        providerReference: txRef,
        status: 'failed',
        message: result.message || 'Chapa payment initiation failed',
        rawResponse: result,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Chapa connection failed'
      return {
        success: false,
        providerReference: params.orderId,
        status: 'failed',
        message,
      }
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerification> {
    if (!this.isConfigured()) {
      return this.mockVerify(reference)
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: { 'Authorization': `Bearer ${this.secretKey}` },
        }
      )

      const result = await response.json()

      if (result.status === 'success') {
        const chapaStatus = result.data?.status as string
        const status =
          chapaStatus === 'success' ? 'completed' :
          chapaStatus === 'pending' ? 'pending' : 'failed'

        return {
          verified: status === 'completed',
          status,
          amount: parseFloat(result.data?.amount || '0'),
          providerReference: result.data?.tx_ref || reference,
          paidAt: result.data?.created_at ? new Date(result.data.created_at) : undefined,
          rawResponse: result,
        }
      }

      return {
        verified: false,
        status: 'failed',
        amount: 0,
        providerReference: reference,
        rawResponse: result,
      }
    } catch {
      return {
        verified: false,
        status: 'failed',
        amount: 0,
        providerReference: reference,
      }
    }
  }

  async processRefund(params: RefundDTO): Promise<RefundResult> {
    if (!this.isConfigured()) {
      return this.mockRefund(params)
    }

    // Chapa does not have a direct refund API in v1.
    // Refunds are typically handled through the Chapa dashboard or support.
    // We record the refund request for manual processing.
    try {
      const refundRef = `CHP-REFUND-${Date.now()}`

      // Attempt Chapa refund endpoint if available
      const response = await fetch(`${this.baseUrl}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: params.paymentReference,
          amount: params.amount,
          reason: params.reason,
        }),
      })

      const result = await response.json()

      if (result.status === 'success') {
        return {
          success: true,
          refundReference: result.data?.refund_ref || refundRef,
          status: 'processed',
          message: 'Chapa refund processed successfully.',
        }
      }

      // Fallback: record as pending manual refund
      return {
        success: true,
        refundReference: refundRef,
        status: 'pending',
        message: 'Chapa refund recorded. Please process manually through the Chapa dashboard.',
        }
    } catch {
      // Fallback: record as pending manual refund
      const refundRef = `CHP-REFUND-${Date.now()}`
      return {
        success: true,
        refundReference: refundRef,
        status: 'pending',
        message: 'Chapa refund recorded. Please process manually through the Chapa dashboard.',
      }
    }
  }

  async getTransactionStatus(reference: string): Promise<TransactionStatus> {
    if (!this.isConfigured()) {
      return this.mockTransactionStatus(reference)
    }

    const verification = await this.verifyPayment(reference)
    return {
      reference,
      status: verification.status,
      amount: verification.amount,
      providerReference: verification.providerReference,
      updatedAt: new Date(),
    }
  }

  async handleWebhook(payload: unknown, headers: Record<string, string>): Promise<PaymentVerification> {
    const data = payload as Record<string, unknown>

    // If real credentials configured, verify webhook signature
    if (this.isConfigured() && this.webhookSecret) {
      const signatureVerified = this.verifyWebhookSignature(data, headers)
      if (!signatureVerified) {
        console.warn('[CHAPA_WEBHOOK] Signature verification failed', {
          reference: data.tx_ref,
        })
        return {
          verified: false,
          status: 'failed',
          amount: 0,
          providerReference: (data.tx_ref as string) || '',
          rawResponse: data,
        }
      }
    }

    // Parse payment status from Chapa webhook
    const chapaStatus = data.status as string
    const status = chapaStatus === 'success' ? 'completed' :
                   chapaStatus === 'pending' ? 'pending' : 'failed'

    return {
      verified: status === 'completed',
      status,
      amount: parseFloat((data.amount as string) || '0'),
      providerReference: (data.tx_ref as string) || '',
      paidAt: data.created_at ? new Date(data.created_at as string) : new Date(),
      rawResponse: data,
    }
  }

  // -------------------------------------------------------
  // Chapa Webhook Signature Verification
  // -------------------------------------------------------

  /**
   * Verify Chapa webhook using HMAC-SHA256 with webhook secret.
   * Chapa sends a Chapa-Signature header containing the HMAC.
   */
  private verifyWebhookSignature(
    data: Record<string, unknown>,
    headers: Record<string, string>
  ): boolean {
    try {
      const signature = headers['chapa-signature'] || headers['x-chapa-signature']
      if (!signature) {
        console.warn('[CHAPA_WEBHOOK] No signature header found')
        return false
      }

      const payload = JSON.stringify(data)
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex')

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    } catch (error) {
      console.error('[CHAPA_WEBHOOK_VERIFY] Signature verification error:', error)
      return false
    }
  }

  // -------------------------------------------------------
  // Mock Fallbacks
  // -------------------------------------------------------

  private mockInitiate(params: InitiatePaymentDTO): PaymentResult {
    const reference = `CHP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    return {
      success: true,
      providerReference: reference,
      checkoutUrl: `https://mock.chapa.co/checkout?ref=${reference}&amount=${params.amount}`,
      status: 'pending',
      message: 'Chapa payment initialized (MOCK). Redirect customer to checkout URL.',
      rawResponse: {
        tx_ref: reference,
        checkout_url: `https://mock.chapa.co/checkout?ref=${reference}`,
        amount: params.amount,
        currency: params.currency,
        mock: true,
      },
    }
  }

  private mockVerify(reference: string): PaymentVerification {
    // Deterministic mock: always succeed in development
    // This avoids random test failures from Math.random()
    return {
      verified: true,
      status: 'completed' as const,
      amount: 0,
      providerReference: reference,
      paidAt: new Date(),
      rawResponse: { tx_ref: reference, status: 'success', mock: true },
    }
  }

  private mockRefund(params: RefundDTO): RefundResult {
    const refundRef = `CHP-REFUND-${Date.now()}`
    return {
      success: true,
      refundReference: refundRef,
      status: 'processed',
      message: 'Chapa refund processed successfully (MOCK).',
    }
  }

  private mockTransactionStatus(reference: string): TransactionStatus {
    return {
      reference,
      status: 'completed',
      amount: 0,
      providerReference: reference,
      updatedAt: new Date(),
    }
  }
}

// ============================================================
// CBE Birr Provider (Real + Mock Fallback)
// ============================================================
// CBE Birr Bill Payment Flow:
// 1. Generate a bill reference number via API
// 2. Customer pays via CBE Birr app using the bill reference
// 3. CBE sends callback notification on payment
// 4. Verify payment status via API query
// ============================================================

export class CBEBirrProvider implements PaymentProvider {
  name = 'cbe_birr'
  private merchantId: string
  private apiKey: string
  private baseUrl: string
  private webhookSecret: string

  constructor() {
    this.merchantId = process.env.CBE_MERCHANT_ID || ''
    this.apiKey = process.env.CBE_API_KEY || ''
    this.baseUrl = process.env.CBE_BASE_URL || 'https://api.cbe.com.et/v1'
    this.webhookSecret = process.env.CBE_WEBHOOK_SECRET || ''
  }

  /**
   * Check if real CBE Birr credentials are configured
   */
  private isConfigured(): boolean {
    return !!(this.merchantId && this.apiKey)
  }

  async initiatePayment(params: InitiatePaymentDTO): Promise<PaymentResult> {
    if (!this.isConfigured()) {
      return this.mockInitiate(params)
    }

    try {
      const billRef = `CBE-${params.orderId}-${Date.now().toString().slice(-6)}`

      const response = await fetch(`${this.baseUrl}/bills`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: this.merchantId,
          billReference: billRef,
          amount: params.amount,
          currency: params.currency || 'ETB',
          description: `Yene QR Order ${params.orderId}`,
          callbackUrl: params.webhookUrl,
          customerPhone: params.customerPhone,
        }),
      })

      const result = await response.json()

      if (result.billId || result.reference) {
        return {
          success: true,
          providerReference: billRef,
          checkoutUrl: undefined, // No redirect — customer pays via CBE Birr app
          status: 'pending',
          message: `Pay using CBE Birr app. Bill reference: ${billRef}`,
          rawResponse: result,
        }
      }

      return {
        success: false,
        providerReference: billRef,
        status: 'failed',
        message: result.message || 'CBE Birr bill creation failed',
        rawResponse: result,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'CBE Birr connection failed'
      return {
        success: false,
        providerReference: params.orderId,
        status: 'failed',
        message,
      }
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerification> {
    if (!this.isConfigured()) {
      return this.mockVerify(reference)
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/bills/${encodeURIComponent(reference)}`,
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      )

      const result = await response.json()

      const billStatus = result.status as string
      const status =
        billStatus === 'PAID' ? 'completed' :
        billStatus === 'PENDING' ? 'pending' : 'failed'

      return {
        verified: status === 'completed',
        status,
        amount: parseFloat(result.amount || '0'),
        providerReference: result.billReference || reference,
        paidAt: result.paidAt ? new Date(result.paidAt) : undefined,
        rawResponse: result,
      }
    } catch {
      return {
        verified: false,
        status: 'failed',
        amount: 0,
        providerReference: reference,
      }
    }
  }

  async processRefund(params: RefundDTO): Promise<RefundResult> {
    if (!this.isConfigured()) {
      return this.mockRefund(params)
    }

    try {
      const refundRef = `CBE-REFUND-${Date.now()}`

      const response = await fetch(`${this.baseUrl}/bills/${encodeURIComponent(params.paymentReference)}/refund`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchantId: this.merchantId,
          amount: params.amount,
          reason: params.reason,
        }),
      })

      const result = await response.json()

      if (result.refundId || result.status === 'APPROVED') {
        return {
          success: true,
          refundReference: result.refundId || refundRef,
          status: 'processed',
          message: 'CBE Birr refund processed successfully.',
        }
      }

      return {
        success: false,
        refundReference: refundRef,
        status: 'rejected',
        message: result.message || 'CBE Birr refund failed',
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'CBE Birr refund connection failed'
      return {
        success: false,
        refundReference: `CBE-REFUND-${Date.now()}`,
        status: 'rejected',
        message,
      }
    }
  }

  async getTransactionStatus(reference: string): Promise<TransactionStatus> {
    if (!this.isConfigured()) {
      return this.mockTransactionStatus(reference)
    }

    const verification = await this.verifyPayment(reference)
    return {
      reference,
      status: verification.status,
      amount: verification.amount,
      providerReference: verification.providerReference,
      updatedAt: new Date(),
    }
  }

  async handleWebhook(payload: unknown, headers: Record<string, string>): Promise<PaymentVerification> {
    const data = payload as Record<string, unknown>

    // If real credentials configured, verify webhook signature
    if (this.isConfigured() && this.webhookSecret) {
      const signatureVerified = this.verifyWebhookSignature(data, headers)
      if (!signatureVerified) {
        console.warn('[CBE_WEBHOOK] Signature verification failed', {
          reference: data.billReference,
        })
        return {
          verified: false,
          status: 'failed',
          amount: 0,
          providerReference: (data.billReference as string) || '',
          rawResponse: data,
        }
      }
    }

    // Parse payment status from CBE webhook
    const billStatus = data.status as string
    const status = billStatus === 'PAID' ? 'completed' :
                   billStatus === 'PENDING' ? 'pending' : 'failed'

    return {
      verified: status === 'completed',
      status,
      amount: parseFloat((data.amount as string) || '0'),
      providerReference: (data.billReference as string) || '',
      paidAt: data.paidAt ? new Date(data.paidAt as string) : new Date(),
      rawResponse: data,
    }
  }

  // -------------------------------------------------------
  // CBE Birr Webhook Signature Verification
  // -------------------------------------------------------

  /**
   * Verify CBE callback signature using HMAC-SHA256.
   * CBE includes an X-CBE-Signature header with the HMAC of the payload.
   */
  private verifyWebhookSignature(
    data: Record<string, unknown>,
    headers: Record<string, string>
  ): boolean {
    try {
      const signature = headers['x-cbe-signature'] || headers['cbe-signature']
      if (!signature) {
        console.warn('[CBE_WEBHOOK] No signature header found')
        return false
      }

      const payload = JSON.stringify(data)
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex')

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    } catch (error) {
      console.error('[CBE_WEBHOOK_VERIFY] Signature verification error:', error)
      return false
    }
  }

  // -------------------------------------------------------
  // Mock Fallbacks
  // -------------------------------------------------------

  private mockInitiate(params: InitiatePaymentDTO): PaymentResult {
    const reference = `CBE-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    return {
      success: true,
      providerReference: reference,
      checkoutUrl: `https://mock.cbe.com.et/bill?ref=${reference}&amount=${params.amount}`,
      status: 'pending',
      message: 'CBE Birr payment initiated (MOCK). Customer should approve in CBE Birr app.',
      rawResponse: {
        billReference: reference,
        amount: params.amount,
        currency: params.currency,
        status: 'PENDING',
        mock: true,
      },
    }
  }

  private mockVerify(reference: string): PaymentVerification {
    // Deterministic mock: always succeed in development
    // This avoids random test failures from Math.random()
    return {
      verified: true,
      status: 'completed' as const,
      amount: 0,
      providerReference: reference,
      paidAt: new Date(),
      rawResponse: { billReference: reference, status: 'PAID', mock: true },
    }
  }

  private mockRefund(params: RefundDTO): RefundResult {
    const refundRef = `CBE-REFUND-${Date.now()}`
    return {
      success: true,
      refundReference: refundRef,
      status: 'processed',
      message: 'CBE Birr refund processed successfully (MOCK).',
    }
  }

  private mockTransactionStatus(reference: string): TransactionStatus {
    return {
      reference,
      status: 'completed',
      amount: 0,
      providerReference: reference,
      updatedAt: new Date(),
    }
  }
}

// ============================================================
// Cash Payment Provider (Staff-Confirmed)
// ============================================================

export class CashProvider implements PaymentProvider {
  name = 'cash'

  async initiatePayment(params: InitiatePaymentDTO): Promise<PaymentResult> {
    const reference = `CASH-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    return {
      success: true,
      providerReference: reference,
      status: 'pending',
      message: 'Cash payment pending staff confirmation.',
      rawResponse: { reference, amount: params.amount, method: 'cash' },
    }
  }

  async verifyPayment(reference: string): Promise<PaymentVerification> {
    return {
      verified: false,
      status: 'pending',
      amount: 0,
      providerReference: reference,
      rawResponse: { reference, status: 'pending_staff_confirmation' },
    }
  }

  async processRefund(params: RefundDTO): Promise<RefundResult> {
    const refundRef = `CASH-REFUND-${Date.now()}`
    return {
      success: true,
      refundReference: refundRef,
      status: 'processed',
      message: 'Cash refund recorded. Please handle physical cash return.',
    }
  }

  async getTransactionStatus(reference: string): Promise<TransactionStatus> {
    return {
      reference,
      status: 'pending',
      amount: 0,
      providerReference: reference,
      updatedAt: new Date(),
    }
  }

  async handleWebhook(payload: unknown, headers: Record<string, string>): Promise<PaymentVerification> {
    // Cash payments don't have webhooks — staff confirms manually
    throw new Error('Cash payments do not support webhooks')
  }
}

// ============================================================
// Payment Provider Factory
// ============================================================

const providers: Record<Exclude<PaymentMethod, 'starpay'>, PaymentProvider> = {
  telebirr: new TelebirrProvider(),
  chapa: new ChapaProvider(),
  cbe_birr: new CBEBirrProvider(),
  cash: new CashProvider(),
}

export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  if (method === 'starpay') {
    throw new Error(
      'StarPay provider requires per-restaurant config. Use getStarPayProvider() instead.'
    )
  }
  const provider = providers[method]
  if (!provider) throw new Error(`Payment provider not found: ${method}`)
  return provider
}

/**
 * Get a StarPay provider instance with restaurant-specific credentials.
 * StarPay is multi-tenant — each restaurant has its own merchant account.
 */
export function getStarPayProvider(config: {
  apiUrl: string
  apiSecret: string
  merchantId: string
  webhookSecret: string
}): PaymentProvider {
  const { StarPayProvider } = require('@/lib/starpay/provider')
  return new StarPayProvider(config)
}

export function getAvailableProviders(): { method: PaymentMethod; name: string }[] {
  return [
    { method: 'telebirr', name: 'Telebirr' },
    { method: 'chapa', name: 'Chapa' },
    { method: 'cbe_birr', name: 'CBE Birr' },
    { method: 'cash', name: 'Cash' },
    { method: 'starpay', name: 'StarPay' },
  ]
}

// ============================================================
// Payment Calculation Helpers
// ============================================================

export interface PaymentCalculation {
  subtotalCents: number
  taxRate: number
  taxAmountCents: number
  serviceChargeRate: number
  serviceChargeCents: number
  discountAmountCents: number
  tipAmountCents: number
  totalAmountCents: number
}

/**
 * Calculate payment breakdown — all inputs and outputs are in cents.
 */
export function calculatePayment(params: {
  subtotalCents: number
  taxRate?: number
  serviceChargeRate?: number
  discountAmountCents?: number
  tipAmountCents?: number
}): PaymentCalculation {
  const taxRate = params.taxRate ?? 0.15
  const serviceChargeRate = params.serviceChargeRate ?? 0
  const discountAmountCents = params.discountAmountCents ?? 0
  const tipAmountCents = params.tipAmountCents ?? 0

  const taxableAmountCents = Math.max(0, params.subtotalCents - discountAmountCents)
  const taxAmountCents = Math.round(taxableAmountCents * taxRate)
  const serviceChargeCents = Math.round(taxableAmountCents * serviceChargeRate)
  const totalAmountCents = taxableAmountCents + taxAmountCents + serviceChargeCents + tipAmountCents

  return {
    subtotalCents: params.subtotalCents,
    taxRate,
    taxAmountCents,
    serviceChargeRate,
    serviceChargeCents,
    discountAmountCents,
    tipAmountCents,
    totalAmountCents,
  }
}
