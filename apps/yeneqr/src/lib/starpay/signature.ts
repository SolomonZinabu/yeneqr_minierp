/**
 * StarPay Callback Signature Verification — YeneQR Multi-Tenant
 *
 * Implements HMAC-SHA256 signature creation and verification for
 * secure webhook/callback processing from StarPay.
 *
 * In the multi-tenant model, each restaurant has its own webhookSecret,
 * so verification functions accept the secret as a parameter rather than
 * reading from environment variables.
 *
 * @see https://developer.starpayethiopia.com/api-reference/sign
 */

import crypto from 'crypto'

/**
 * Create HMAC-SHA256 signature for a callback payload
 * Matches the signature format used by StarPay when sending callbacks
 */
export function createSignature(
  payload: unknown,
  secret: string,
  timestamp: string
): string {
  const body = JSON.stringify(payload)
  const message = `${timestamp}.${body}`

  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

/**
 * Verify an incoming callback signature from StarPay
 *
 * @param payload - JSON payload received in the callback body
 * @param timestamp - X-Timestamp header from the request
 * @param signature - X-Signature header from the request
 * @param secret - Restaurant's webhook secret (stored per-restaurant in DB)
 * @returns true if the signature is valid, false otherwise
 */
export function verifySignature(
  payload: unknown,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createSignature(payload, secret, timestamp)
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  const signatureBuffer = Buffer.from(signature, 'hex')

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false
  }

  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
}

/**
 * Check if a callback timestamp is within acceptable time window
 * Prevents replay attacks by rejecting old callbacks
 *
 * @param timestamp - X-Timestamp header value (epoch milliseconds string)
 * @param maxAgeMs - Maximum age in milliseconds (default: 5 minutes)
 * @returns true if timestamp is fresh
 */
export function isFreshCallback(
  timestamp: string,
  maxAgeMs: number = 5 * 60 * 1000
): boolean {
  const callbackTime = parseInt(timestamp, 10)

  if (isNaN(callbackTime)) {
    return false
  }

  const now = Date.now()
  const age = now - callbackTime

  return age >= 0 && age <= maxAgeMs
}
