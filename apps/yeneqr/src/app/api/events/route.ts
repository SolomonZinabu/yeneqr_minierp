// ============================================================
// Yene QR — Server-Sent Events (SSE) Endpoint
// ============================================================
// Provides real-time updates to clients via SSE.
//
// SECURITY: Requires authentication via JWT token.
// Staff tokens get full restaurant events.
// Customer tokens only get events for their table.
//
// SSE Replay:
//   On reconnection clients send Last-Event-ID header (or
//   query param) to receive all events they missed. Each
//   SSE event includes an `id:` field per the SSE spec.
//
// Usage: GET /api/events?restaurantId=xxx&token=xxx
//   OR:  GET /api/events?restaurantId=xxx (with Authorization: Bearer xxx header)

import { NextRequest } from 'next/server'
import { onRestaurantEvent, onBranchEvent, type RealtimeEvent, canConnect, registerConnection, unregisterConnection, getEventsSince } from '@/lib/realtime'
import { verifyToken, resolveUserPermissions, type TokenPayload, type CustomerTokenPayload } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Apply customer-level table filtering to an event.
 * Returns true if the event should be forwarded, false to skip.
 */
function shouldForwardToCustomer(
  event: RealtimeEvent,
  customerTableId: string
): boolean {
  const tableSpecificEvents = [
    'new_order',
    'order_status_changed',
    'waiter_call',
    'table_status_changed',
    'waiter_order_ready',
    'kitchen_item_updated',
    'reservation_status_changed',
  ]
  const isTableEvent =
    tableSpecificEvents.includes(event.type) &&
    'tableId' in event &&
    event.tableId === customerTableId
  const isGeneralEvent = ['notification'].includes(event.type)

  return isTableEvent || isGeneralEvent
}

/**
 * Determine whether a staff token has the 'branch:view_all' permission,
 * meaning they should receive events from ALL branches of their restaurant
 * (not just their assigned branch).
 *
 * Phase 3.3: owners and managers have this; waiters/kitchen_staff/cashiers
 * do not, so they only receive events from their assigned branch.
 */
function hasBranchViewAll(payload: TokenPayload): boolean {
  const permissions = payload.permissions || resolveUserPermissions(payload.role)
  return permissions.includes('branch:view_all')
}

/**
 * Determine whether an event should be forwarded to a branch-scoped subscriber.
 *
 * Branch-scoped staff receive:
 *   - Events with event.branchId === their branch (their own branch's events)
 *   - Events with no branchId (restaurant-wide broadcasts — e.g., platform
 *     notifications, settings changes)
 *
 * They do NOT receive events with a different branchId.
 */
function shouldForwardToBranch(
  event: RealtimeEvent,
  subscriberBranchId: string
): boolean {
  // If the event has no branchId, it's a restaurant-wide broadcast → forward
  if (!('branchId' in event) || !event.branchId) {
    return true
  }
  // Event is branch-specific → only forward if it matches the subscriber's branch
  return event.branchId === subscriberBranchId
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurantId')

  if (!restaurantId) {
    return new Response(
      JSON.stringify({ error: 'Missing restaurantId query parameter' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // ── Authentication ──
  // Try Authorization header first, then query param token
  let token: string | null = null
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  } else {
    token = req.nextUrl.searchParams.get('token')
  }

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Authentication required. Provide a valid token via Authorization header or ?token= param.' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const payload = verifyToken(token)
  if (!payload) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Validate that the token's restaurantId matches the requested restaurantId
  const tokenRestaurantId = payload.type === 'customer'
    ? (payload as CustomerTokenPayload).restaurantId
    : (payload as TokenPayload).restaurantId

  if (tokenRestaurantId && tokenRestaurantId !== restaurantId) {
    return new Response(
      JSON.stringify({ error: 'Token does not authorize access to this restaurant' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Determine if this is a customer token (for filtering)
  const isCustomer = payload.type === 'customer'
  const customerTableId = isCustomer ? (payload as CustomerTokenPayload).tableId : null

  // ── Phase 3.3: Determine branch subscription strategy for staff ──
  // - Customers: subscribe to restaurant channel, filter by tableId (existing behavior)
  // - Staff with branch:view_all (owners, managers): subscribe to restaurant channel
  //   (they see all branches' events)
  // - Branch-scoped staff (waiters, kitchen_staff, cashiers): subscribe to restaurant
  //   channel BUT filter to only their branch's events + restaurant-wide broadcasts.
  //   We use the restaurant channel (not the branch channel) so we can also
  //   receive broadcast events (branchId=null) in the same stream.
  const staffPayload = isCustomer ? null : payload as TokenPayload
  const staffBranchId = staffPayload?.branchId || null
  const isBranchScoped = !isCustomer && staffBranchId !== null && !hasBranchViewAll(staffPayload!)

  // Check connection limit
  if (!canConnect(restaurantId)) {
    return new Response(
      JSON.stringify({ error: 'Too many connections for this restaurant. Please try again later.' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Register this connection
  registerConnection(restaurantId)

  // ── SSE Replay: determine Last-Event-ID ──
  // Per SSE spec the browser sends `Last-Event-ID` header automatically
  // on reconnection. We also accept a `?lastEventId=` query param for
  // environments where header injection isn't possible.
  let lastEventId: number | null = null
  const lastEventIdHeader = req.headers.get('Last-Event-ID')
  const lastEventIdQuery = req.nextUrl.searchParams.get('lastEventId')

  if (lastEventIdHeader) {
    const parsed = parseInt(lastEventIdHeader, 10)
    if (!isNaN(parsed) && parsed > 0) {
      lastEventId = parsed
    }
  } else if (lastEventIdQuery) {
    const parsed = parseInt(lastEventIdQuery, 10)
    if (!isNaN(parsed) && parsed > 0) {
      lastEventId = parsed
    }
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'connected',
              restaurantId,
              timestamp: new Date().toISOString(),
            })}\n\n`
          )
        )
      } catch {
        return
      }

      // ── SSE Replay: send missed events ──
      if (lastEventId !== null) {
        try {
          const missedEvents = getEventsSince(restaurantId, lastEventId)
          for (const event of missedEvents) {
            // Apply customer filtering on replayed events too
            if (isCustomer && customerTableId) {
              if (!shouldForwardToCustomer(event, customerTableId)) {
                continue
              }
            }
            // Phase 3.3: apply branch filtering for branch-scoped staff
            if (isBranchScoped && staffBranchId) {
              if (!shouldForwardToBranch(event, staffBranchId)) {
                continue
              }
            }
            controller.enqueue(
              encoder.encode(`id: ${event.eventId}\ndata: ${JSON.stringify(event)}\n\n`)
            )
          }
        } catch {
          // If replay fails (e.g. client already disconnected), bail out
          clearInterval(keepalive)
          unsubscribe()
          unregisterConnection(restaurantId)
          return
        }
      }

      // Keepalive: send a comment every 15 seconds (30s is too long for mobile Safari)
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'))
        } catch {
          clearInterval(keepalive)
          unsubscribe()
          unregisterConnection(restaurantId)
        }
      }, 15000)

      // Listen for restaurant-specific events
      const unsubscribe = onRestaurantEvent(
        restaurantId,
        (event: RealtimeEvent) => {
          try {
            // For customer tokens, only forward events relevant to their table
            if (isCustomer && customerTableId) {
              if (!shouldForwardToCustomer(event, customerTableId)) {
                return // Skip events not for this customer's table
              }
            }
            // Phase 3.3: for branch-scoped staff, only forward events for
            // their branch (or restaurant-wide broadcasts with no branchId).
            // This closes the SSE cross-branch leak identified in the audit:
            // a waiter at Branch A previously received every new_order,
            // waiter_call, payment_received, etc. from Branch B.
            if (isBranchScoped && staffBranchId) {
              if (!shouldForwardToBranch(event, staffBranchId)) {
                return
              }
            }

            controller.enqueue(
              encoder.encode(`id: ${event.eventId}\ndata: ${JSON.stringify(event)}\n\n`)
            )
          } catch {
            clearInterval(keepalive)
            unsubscribe()
            unregisterConnection(restaurantId)
          }
        }
      )

      // Cleanup when the client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(keepalive)
        unsubscribe()
        unregisterConnection(restaurantId)
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
