// ============================================================
// Yene QR — Real-time Events Module
// ============================================================
// Provides a unified event bus for real-time updates across
// the Yene QR platform. Uses Node.js EventEmitter for SSE
// and can bridge to Socket.IO when available.
//
// Events flow:
//   API routes → emitEvent() → EventEmitter → SSE /api/events
//                                         → Socket.IO bridge (if enabled)
//
// SSE Replay:
//   Each event is assigned an incrementing eventId and stored
//   in a per-restaurant circular buffer. On reconnection the
//   client can send Last-Event-ID to receive missed events.

import { EventEmitter } from 'events'

// -------------------------------------------------------
// Type Definitions
// -------------------------------------------------------

type RealtimeEventBase = {
  /** Monotonically incrementing event ID for SSE replay */
  eventId: number
}

export type RealtimeEvent = RealtimeEventBase & (
  | {
      type: 'new_order'
      restaurantId: string
      branchId?: string  // Phase 3.1: branch where the order was placed
      orderId: string
      orderNumber: string
      tableId: string
      tableNumber: number
    }
  | {
      // Order routing flag: fired in addition to 'new_order' when the branch
      // is configured for 'direct_to_kitchen' routing. Kitchen-view subscribes
      // to this to play the new-order chime + highlight without needing to
      // also filter 'new_order' by routing mode.
      type: 'kitchen_new_order'
      restaurantId: string
      branchId?: string
      orderId: string
      orderNumber: string
      tableId?: string | null
      tableNumber?: string | null
      orderType?: string
      autoAccepted?: boolean
    }
  | {
      type: 'order_status_changed'
      restaurantId: string
      branchId?: string  // Phase 3.1: branch of the order
      orderId: string
      fromStatus: string
      toStatus: string
    }
  | {
      type: 'kitchen_item_updated'
      restaurantId: string
      branchId?: string  // Phase 3.1: branch of the kitchen
      orderId: string
      itemId: string
      kitchenStatus: string
      tableId?: string
    }
  | {
      type: 'waiter_call'
      restaurantId: string
      branchId?: string  // Phase 3.1: branch where the waiter was called
      callId: string
      tableId: string
      tableNumber: number
      requestType: string
      message?: string
    }
  | {
      type: 'table_status_changed'
      restaurantId: string
      branchId?: string  // Phase 3.1: branch of the table
      tableId: string
      fromStatus: string
      toStatus: string
    }
  | {
      type: 'payment_received'
      restaurantId: string
      branchId?: string  // Phase 3.1: branch where the payment was taken
      orderId: string
      amount: number
      method: string
    }
  | {
      // Fired when a customer initiates a cash payment from their phone.
      // Notifies cashier/manager staff that they need to confirm receipt of cash.
      type: 'cash_payment_pending'
      restaurantId: string
      branchId?: string
      orderId: string
      orderNumber: string
      paymentId: string
      tableId?: string
      tableNumber?: string
      amountCents: number
    }
  | {
      type: 'waiter_order_ready'
      restaurantId: string
      branchId?: string  // Phase 3.1: branch of the kitchen that marked it ready
      orderId: string
      orderNumber: string
      tableId: string
      tableNumber: string
      waiterUserId?: string
    }
  | {
      type: 'notification'
      restaurantId: string
      branchId?: string  // Phase 3.7: branch the notification targets (null = broadcast)
      notificationId: string
      notificationType: string
      title: string
      message: string
    }
  | {
      type: 'reservation_status_changed'
      restaurantId: string
      branchId?: string  // Phase 3.1: branch of the reservation
      reservationId: string
      fromStatus: string
      toStatus: string
      tableId?: string
    }
  | {
      type: 'item_availability_changed'
      restaurantId: string
      branchId?: string  // Phase 3.1: branch whose inventory changed (null = all branches)
      menuItemId: string
      menuItemName: string
      isAvailable: boolean
      reason: string // e.g. "ingredient_out_of_stock", "manual_toggle", "restocked"
      ingredientId?: string
      ingredientName?: string
      inventoryItemId?: string
    }
  | {
      type: 'low_stock_alert'
      restaurantId: string
      branchId?: string  // Phase 3.1: branch with the low-stock item
      inventoryItemId: string
      inventoryItemName: string
      currentStock: number
      minimumStock: number
      unit: string
    }
)

// -------------------------------------------------------
// Event Bus
// -------------------------------------------------------

const emitter = new EventEmitter()
emitter.setMaxListeners(1000) // Allow many SSE connections

// -------------------------------------------------------
// Event ID Counter & Circular Buffer (for SSE Replay)
// -------------------------------------------------------

/** Monotonically incrementing event ID */
let nextEventId = 1

/** Maximum number of events to retain per restaurant */
const MAX_EVENTS_PER_RESTAURANT = 100

/** Age threshold (ms) — events older than this are purged during cleanup */
const EVENT_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Stored event with metadata for replay */
interface StoredEvent {
  eventId: number
  event: RealtimeEvent
  timestamp: number // Date.now() when stored
}

/** Per-restaurant circular buffer of recent events */
const eventBuffer = new Map<string, StoredEvent[]>()

/**
 * Store an event in the circular buffer for its restaurant.
 * Automatically trims to MAX_EVENTS_PER_RESTAURANT.
 */
function bufferEvent(event: RealtimeEvent): void {
  const { restaurantId } = event
  let buffer = eventBuffer.get(restaurantId)
  if (!buffer) {
    buffer = []
    eventBuffer.set(restaurantId, buffer)
  }
  buffer.push({ eventId: event.eventId, event, timestamp: Date.now() })

  // Trim to max size (circular buffer behaviour)
  if (buffer.length > MAX_EVENTS_PER_RESTAURANT) {
    buffer.splice(0, buffer.length - MAX_EVENTS_PER_RESTAURANT)
  }
}

/**
 * Return all buffered events for a restaurant that have an eventId
 * strictly greater than `lastEventId`. Used for SSE replay on reconnect.
 *
 * Returns an empty array if the restaurant has no buffered events or
 * the lastEventId is beyond the buffer range.
 */
export function getEventsSince(
  restaurantId: string,
  lastEventId: number
): RealtimeEvent[] {
  const buffer = eventBuffer.get(restaurantId)
  if (!buffer || buffer.length === 0) return []

  // Fast-path: if the requested ID is older than the oldest event in
  // the buffer we still return everything (best-effort replay — we
  // can't replay what we've already discarded).
  const firstId = buffer[0].eventId
  if (lastEventId < firstId) {
    return buffer.map((se) => se.event)
  }

  // Binary-style search isn't necessary for ≤100 items; linear scan is fine.
  const events: RealtimeEvent[] = []
  for (const se of buffer) {
    if (se.eventId > lastEventId) {
      events.push(se.event)
    }
  }
  return events
}

// -------------------------------------------------------
// Periodic Cleanup
// -------------------------------------------------------

/** How often the cleanup timer runs */
const CLEANUP_INTERVAL_MS = 60_000 // 1 minute

/**
 * Remove events older than EVENT_TTL_MS from all restaurant buffers.
 * Also removes empty buffer entries to keep memory tidy.
 */
function cleanupOldEvents(): void {
  const cutoff = Date.now() - EVENT_TTL_MS
  for (const [restaurantId, buffer] of eventBuffer.entries()) {
    // Find the first index that is still within TTL
    let firstValid = 0
    while (firstValid < buffer.length && buffer[firstValid].timestamp < cutoff) {
      firstValid++
    }
    if (firstValid > 0) {
      buffer.splice(0, firstValid)
    }
    if (buffer.length === 0) {
      eventBuffer.delete(restaurantId)
    }
  }
}

// Start periodic cleanup (unref'd so it doesn't keep the process alive)
const cleanupTimer = setInterval(cleanupOldEvents, CLEANUP_INTERVAL_MS)
if (cleanupTimer.unref) {
  cleanupTimer.unref()
}

// -------------------------------------------------------
// Connection Tracking & Limits
// -------------------------------------------------------

// Track per-restaurant connection counts
const connectionCounts = new Map<string, number>()
const MAX_CONNECTIONS_PER_RESTAURANT = 50 // Reasonable limit

/**
 * Get the current connection count for a restaurant.
 */
export function getConnectionCount(restaurantId: string): number {
  return connectionCounts.get(restaurantId) || 0
}

/**
 * Check whether a new SSE connection is allowed for this restaurant.
 */
export function canConnect(restaurantId: string): boolean {
  const current = connectionCounts.get(restaurantId) || 0
  return current < MAX_CONNECTIONS_PER_RESTAURANT
}

/**
 * Register a new SSE connection for a restaurant.
 */
export function registerConnection(restaurantId: string): void {
  const current = connectionCounts.get(restaurantId) || 0
  connectionCounts.set(restaurantId, current + 1)
}

/**
 * Unregister an SSE connection for a restaurant (on disconnect / error).
 */
export function unregisterConnection(restaurantId: string): void {
  const current = connectionCounts.get(restaurantId) || 0
  connectionCounts.set(restaurantId, Math.max(0, current - 1))
}

/**
 * Input type for emitEvent — callers do NOT need to provide eventId;
 * it is assigned automatically by emitEvent.
 */
export type RealtimeEventInput = Omit<RealtimeEvent, 'eventId'>

/**
 * Emit a real-time event to all listeners (SSE clients, Socket.IO bridge, etc.)
 * Assigns an incrementing eventId and buffers the event for replay.
 *
 * Channel emission strategy (Phase 3.2):
 *   - Global 'event' channel (all listeners)
 *   - 'restaurant:${rid}' channel (all listeners in this restaurant)
 *   - 'restaurant:${rid}:branch:${bid}' channel (only listeners in this branch)
 *     — only emitted if event.branchId is set
 *
 * SSE subscribers in /api/events pick the channel based on the caller's
 * token: owners/managers (branch:view_all) subscribe to the restaurant
 * channel; branch-scoped staff subscribe to their branch's channel.
 */
export function emitEvent(input: RealtimeEventInput): void {
  // Assign the next event ID
  const event: RealtimeEvent = { ...input, eventId: nextEventId++ }

  // Buffer for replay
  bufferEvent(event)

  // Global event
  emitter.emit('event', event)
  // Restaurant-specific event
  emitter.emit(`restaurant:${event.restaurantId}`, event)
  // Branch-specific event (only if branchId is set)
  if ('branchId' in event && event.branchId) {
    emitter.emit(`restaurant:${event.restaurantId}:branch:${event.branchId}`, event)
  }
}

/**
 * Subscribe to all real-time events.
 * Returns an unsubscribe function.
 */
export function onEvent(callback: (event: RealtimeEvent) => void): () => void {
  emitter.on('event', callback)
  return () => emitter.off('event', callback)
}

/**
 * Subscribe to events for a specific restaurant.
 * Returns an unsubscribe function.
 *
 * NOTE (Phase 3.2): This receives ALL events for the restaurant, including
 * events from branches the caller may not have access to. For branch-scoped
 * staff, use onBranchEvent() instead. The SSE endpoint in /api/events
 * handles this distinction based on the caller's token.
 */
export function onRestaurantEvent(
  restaurantId: string,
  callback: (event: RealtimeEvent) => void
): () => void {
  const channel = `restaurant:${restaurantId}`
  emitter.on(channel, callback)
  return () => emitter.off(channel, callback)
}

/**
 * Subscribe to events for a specific branch of a restaurant.
 * Returns an unsubscribe function.
 *
 * Phase 3.2: This is the preferred subscription for branch-scoped staff
 * (waiters, kitchen_staff, cashiers). They receive only events for their
 * assigned branch, plus restaurant-wide broadcasts (events with no
 * branchId set, which are emitted on the restaurant channel only —
 * the SSE endpoint forwards those to branch subscribers too).
 *
 * Note: callers using this helper should ALSO subscribe via
 * onRestaurantEvent if they want to receive broadcast (branchId=null)
 * events. The SSE endpoint handles this composition.
 */
export function onBranchEvent(
  restaurantId: string,
  branchId: string,
  callback: (event: RealtimeEvent) => void
): () => void {
  const channel = `restaurant:${restaurantId}:branch:${branchId}`
  emitter.on(channel, callback)
  return () => emitter.off(channel, callback)
}

/**
 * Get the current listener count for a restaurant channel.
 * Useful for monitoring / debugging.
 */
export function getRestaurantListenerCount(restaurantId: string): number {
  return emitter.listenerCount(`restaurant:${restaurantId}`)
}

/**
 * Get total event listener count across all channels.
 */
export function getTotalListenerCount(): number {
  return emitter.listenerCount('event')
}
