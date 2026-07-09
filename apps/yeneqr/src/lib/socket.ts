// ============================================================
// Yene QR — Socket.IO Server Singleton
// ============================================================
// This module provides a Socket.IO server that can be attached
// to a custom Next.js HTTP server for WebSocket support.
// In the default Next.js App Router setup, the SSE fallback
// (see /api/events) handles real-time updates instead.
//
// Phase 3.4 + 3.5: Room names now include branchId so a kitchen
// display at Branch A doesn't receive Branch B's tickets. Token
// verification on room join prevents unauthorized cross-branch
// subscription.

import { Server as SocketIOServer, Socket } from 'socket.io'
import { onEvent } from './realtime'
import { verifyToken, resolveUserPermissions, type TokenPayload, type CustomerTokenPayload } from './auth'

let io: SocketIOServer | undefined

export function getIO(): SocketIOServer | undefined {
  return io
}

/**
 * Extract and verify the JWT from a socket's auth handshake.
 * Returns null if no token or invalid token.
 *
 * Phase 3.5: every room-join handler now calls this to verify
 * the socket is authenticated as a user who actually has access
 * to the restaurant/branch they're trying to subscribe to.
 */
function getAuthFromSocket(socket: Socket): TokenPayload | CustomerTokenPayload | null {
  // socket.handshake.auth is the recommended way to pass tokens with Socket.IO v4+
  const token = socket.handshake.auth?.token as string | undefined
    || (socket.handshake.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  return verifyToken(token)
}

/**
 * Check whether a staff token has the 'branch:view_all' permission.
 * Used to decide whether to allow joining a restaurant-wide room
 * (vs. requiring a branch-scoped room).
 */
function hasBranchViewAll(payload: TokenPayload): boolean {
  const permissions = payload.permissions || resolveUserPermissions(payload.role)
  return permissions.includes('branch:view_all')
}

export function initIO(httpServer: any): SocketIOServer {
  if (io) return io

  io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/api/socketio',
  })

  // Track per-socket auth context so we can validate room joins
  // against the token's restaurantId/branchId.
  const socketAuth = new WeakMap<Socket, TokenPayload | CustomerTokenPayload | null>()

  io.on('connection', (socket) => {
    console.log('[SOCKET] Connected:', socket.id)

    // Authenticate on connection — store the decoded token for later room-join checks
    const auth = getAuthFromSocket(socket)
    socketAuth.set(socket, auth)
    if (!auth) {
      console.warn(`[SOCKET] ${socket.id} connected WITHOUT a valid token — room joins will be rejected`)
    }

    // ── Join restaurant room ──
    // Phase 3.4: room name now includes branchId: restaurant:${rid}:${bid}
    // Phase 3.5: verify the token's restaurantId matches, and (for branch-scoped
    // staff) that the branchId matches their assigned branch.
    socket.on('join-restaurant', (restaurantId: string, branchId?: string) => {
      const auth = socketAuth.get(socket)
      if (!auth) {
        socket.emit('error', { message: 'Authentication required' })
        return
      }

      // Verify restaurant scope
      const tokenRestaurantId = auth.type === 'customer'
        ? (auth as CustomerTokenPayload).restaurantId
        : (auth as TokenPayload).restaurantId
      if (tokenRestaurantId !== restaurantId) {
        socket.emit('error', { message: 'Forbidden — restaurant mismatch' })
        return
      }

      // For branch-scoped staff without view_all, force the branchId to their
      // assigned branch (ignore what the client sent) and join the branch room.
      // For owners/managers (view_all) and platform admins, allow joining either
      // the restaurant-wide room (no branchId) or a specific branch room.
      if (auth.type === 'staff' && !hasBranchViewAll(auth as TokenPayload)) {
        const userBranchId = (auth as TokenPayload).branchId
        if (!userBranchId) {
          // Staff with no branch assignment and no view_all — shouldn't happen,
          // but deny defensively
          socket.emit('error', { message: 'No branch assignment in token' })
          return
        }
        // Force-join their own branch room (ignore client-supplied branchId)
        const room = `restaurant:${restaurantId}:branch:${userBranchId}`
        socket.join(room)
        console.log(`[SOCKET] ${socket.id} joined ${room} (branch-scoped, forced)`)
        return
      }

      // Owners/managers/platform admins: respect client's choice
      if (branchId) {
        const room = `restaurant:${restaurantId}:branch:${branchId}`
        socket.join(room)
        console.log(`[SOCKET] ${socket.id} joined ${room}`)
      } else {
        // Restaurant-wide room — receives all branches' events
        const room = `restaurant:${restaurantId}`
        socket.join(room)
        console.log(`[SOCKET] ${socket.id} joined ${room} (restaurant-wide)`)
      }
    })

    // ── Join kitchen room ──
    // Phase 3.4: kitchen rooms are now branch-scoped: kitchen:${rid}:${bid}
    // (plus optional station: kitchen:${rid}:${bid}:${station})
    // Phase 3.5: branch-scoped kitchen staff are forced into their own branch's kitchen room.
    socket.on('join-kitchen', (restaurantId: string, branchId?: string, station?: string) => {
      const auth = socketAuth.get(socket)
      if (!auth) {
        socket.emit('error', { message: 'Authentication required' })
        return
      }

      const tokenRestaurantId = auth.type === 'customer'
        ? (auth as CustomerTokenPayload).restaurantId
        : (auth as TokenPayload).restaurantId
      if (tokenRestaurantId !== restaurantId) {
        socket.emit('error', { message: 'Forbidden — restaurant mismatch' })
        return
      }

      // Resolve effective branchId
      let effectiveBranchId = branchId
      if (auth.type === 'staff' && !hasBranchViewAll(auth as TokenPayload)) {
        const userBranchId = (auth as TokenPayload).branchId
        if (!userBranchId) {
          socket.emit('error', { message: 'No branch assignment in token' })
          return
        }
        effectiveBranchId = userBranchId // force
      }

      if (!effectiveBranchId) {
        socket.emit('error', { message: 'branchId is required to join a kitchen room' })
        return
      }

      const room = `kitchen:${restaurantId}:${effectiveBranchId}`
      socket.join(room)
      if (station) socket.join(`kitchen:${restaurantId}:${effectiveBranchId}:${station}`)
      console.log(`[SOCKET] ${socket.id} joined ${room}${station ? `:${station}` : ''}`)
    })

    // ── Join table room ──
    // Phase 3.4: table rooms now include branchId: table:${rid}:${bid}:${tid}
    // Phase 3.5: verify the table belongs to the caller's branch (for branch-scoped
    // staff) or their session (for customers).
    socket.on('join-table', (restaurantId: string, tableId: string, branchId?: string) => {
      const auth = socketAuth.get(socket)
      if (!auth) {
        socket.emit('error', { message: 'Authentication required' })
        return
      }

      const tokenRestaurantId = auth.type === 'customer'
        ? (auth as CustomerTokenPayload).restaurantId
        : (auth as TokenPayload).restaurantId
      if (tokenRestaurantId !== restaurantId) {
        socket.emit('error', { message: 'Forbidden — restaurant mismatch' })
        return
      }

      // Resolve effective branchId
      let effectiveBranchId = branchId
      if (auth.type === 'customer') {
        effectiveBranchId = (auth as CustomerTokenPayload).branchId
        // Customer must be joining their own table
        if ((auth as CustomerTokenPayload).tableId !== tableId) {
          socket.emit('error', { message: 'Forbidden — table mismatch with customer session' })
          return
        }
      } else if (auth.type === 'staff' && !hasBranchViewAll(auth as TokenPayload)) {
        const userBranchId = (auth as TokenPayload).branchId
        if (!userBranchId) {
          socket.emit('error', { message: 'No branch assignment in token' })
          return
        }
        effectiveBranchId = userBranchId // force
      }

      if (!effectiveBranchId) {
        socket.emit('error', { message: 'branchId is required to join a table room' })
        return
      }

      const room = `table:${restaurantId}:${effectiveBranchId}:${tableId}`
      socket.join(room)
      console.log(`[SOCKET] ${socket.id} joined ${room}`)
    })

    socket.on('leave-restaurant', (restaurantId: string, branchId?: string) => {
      if (branchId) {
        socket.leave(`restaurant:${restaurantId}:branch:${branchId}`)
      } else {
        // Leave both forms for safety
        socket.leave(`restaurant:${restaurantId}`)
        // (Cannot easily leave all branch rooms without tracking them per-socket;
        //  client should leave-restaurant with the specific branchId they joined.)
      }
      console.log(`[SOCKET] ${socket.id} left restaurant:${restaurantId}${branchId ? `:branch:${branchId}` : ''}`)
    })

    socket.on('leave-kitchen', (restaurantId: string, branchId?: string) => {
      if (branchId) {
        socket.leave(`kitchen:${restaurantId}:${branchId}`)
      }
      console.log(`[SOCKET] ${socket.id} left kitchen:${restaurantId}${branchId ? `:${branchId}` : ''}`)
    })

    socket.on('leave-table', (restaurantId: string, tableId: string, branchId?: string) => {
      if (branchId) {
        socket.leave(`table:${restaurantId}:${branchId}:${tableId}`)
      } else {
        // Fallback: try the old format (no branchId) for backward compat
        socket.leave(`table:${restaurantId}:${tableId}`)
      }
      console.log(`[SOCKET] ${socket.id} left table:${restaurantId}${branchId ? `:${branchId}` : ''}:${tableId}`)
    })

    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] Disconnected: ${socket.id} (${reason})`)
    })
  })

  // Bridge: when emitEvent is called, also push via Socket.IO
  // This ensures both SSE and Socket.IO clients receive updates.
  //
  // Phase 3.4: emit to branch-scoped rooms when event.branchId is set,
  // so a Branch A event doesn't reach Branch B's kitchen display.
  onEvent((event: any) => {
    if (!io) return
    const restaurantId = event.restaurantId
    if (!restaurantId) return

    const branchId = ('branchId' in event && event.branchId) ? event.branchId : null

    // Always emit to the restaurant-wide room (owners/managers + platform admins)
    io.to(`restaurant:${restaurantId}`).emit('event', event)

    // Emit to branch-specific room (branch-scoped staff subscribe here)
    if (branchId) {
      io.to(`restaurant:${restaurantId}:branch:${branchId}`).emit('event', event)

      // Kitchen events also go to the branch's kitchen room
      if (event.type === 'new_order' || event.type === 'order_status_changed' || event.type === 'kitchen_item_updated') {
        io.to(`kitchen:${restaurantId}:${branchId}`).emit('event', event)
      }

      // Waiter calls go to the branch's restaurant room
      if (event.type === 'waiter_call') {
        io.to(`restaurant:${restaurantId}:branch:${branchId}`).emit('waiter_call', event)
      }
    }

    // Table-specific events (customer-facing)
    if (event.tableId && branchId) {
      io.to(`table:${restaurantId}:${branchId}:${event.tableId}`).emit('event', event)
    } else if (event.tableId) {
      // Fallback for events that have tableId but no branchId (legacy callers)
      // — use the old room name. New callers should always set branchId.
      io.to(`table:${restaurantId}:${event.tableId}`).emit('event', event)
    }
    // SECURITY: The previous line `io.emit('event', event)` was a cross-tenant
    // data leak — removed in Phase 1.5. See git history.
  })

  return io
}
