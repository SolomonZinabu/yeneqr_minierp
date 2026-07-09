/**
 * StarPay Payment Gateway Integration — YeneQR Multi-Tenant
 *
 * Main entry point for the StarPay payment module.
 * Each restaurant has its own StarPay merchant account,
 * and clients are created per-request with restaurant-specific config.
 */

export { StarPayClient, createStarPayClient, createStarPayClientFromRestaurant, formatEthiopianPhone } from './client'
export { createSignature, verifySignature, isFreshCallback } from './signature'
export { StarPayProvider } from './provider'
export * from './types'
