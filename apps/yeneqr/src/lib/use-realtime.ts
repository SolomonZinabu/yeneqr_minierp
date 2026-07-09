// ============================================================
// Yene QR — Client-side Real-time Hooks
// ============================================================
// React hooks for subscribing to real-time updates via SSE.
// Falls back to polling when SSE is unavailable.
//
// Usage:
//   const { connected, lastEvent } = useRealtime({
//     restaurantId: 'xxx',
//     onEvent: (event) => { ... },
//   })
//
//   const { connected } = useCustomerRealtime({
//     restaurantId: 'xxx',
//     orderId: 'yyy',
//     token: 'zzz',
//     onOrderUpdate: (order) => { ... },
//   })

'use client'

import { useEffect, useRef, useState } from 'react'
import { type RealtimeEvent } from './realtime'

// -------------------------------------------------------
// useRealtime — General-purpose SSE hook
// -------------------------------------------------------

interface UseRealtimeOptions {
  restaurantId: string
  token?: string
  onEvent?: (event: RealtimeEvent) => void
  enabled?: boolean
}

interface UseRealtimeReturn {
  connected: boolean
  lastEvent: RealtimeEvent | null
  reconnect: () => void
}

export function useRealtime({
  restaurantId,
  token,
  onEvent,
  enabled = true,
}: UseRealtimeOptions): UseRealtimeReturn {
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectDelayRef = useRef(3000) // Start at 3s, exponential backoff
  const onEventRef = useRef(onEvent)

  // Keep onEventRef in sync inside an effect to avoid render-time ref writes
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  // Reconnect function — stable identity, no dependency on connect itself
  const reconnectRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!restaurantId || !enabled) return

    function connect() {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      // Build SSE URL with auth token (EventSource doesn't support custom headers)
      let url = `/api/events?restaurantId=${encodeURIComponent(restaurantId)}`
      if (token) {
        url += `&token=${encodeURIComponent(token)}`
      }
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.onopen = () => {
        setConnected(true)
        reconnectDelayRef.current = 3000 // Reset backoff on successful connection
      }

      es.onmessage = (e) => {
        try {
          const event: RealtimeEvent = JSON.parse(e.data)
          // Skip connection confirmation events
          if (event.type === 'connected') return
          setLastEvent(event)
          onEventRef.current?.(event)
        } catch {
          // Ignore malformed events
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        eventSourceRef.current = null

        // Reconnect with exponential backoff
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, reconnectDelayRef.current)

        // Increase delay for next attempt: 3s → 6s → 12s → 30s → 60s (capped)
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 60000)
      }
    }

    // Store reconnect reference
    reconnectRef.current = connect

    // Initial connection
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [restaurantId, token, enabled])

  return {
    connected,
    lastEvent,
    reconnect: () => reconnectRef.current(),
  }
}

// -------------------------------------------------------
// useCustomerRealtime — Customer-facing hook with polling fallback
// -------------------------------------------------------

interface UseCustomerRealtimeOptions {
  restaurantId: string
  orderId: string | null
  token?: string
  onOrderUpdate: (order: any) => void
  enabled?: boolean
}

interface UseCustomerRealtimeReturn {
  connected: boolean
}

export function useCustomerRealtime({
  restaurantId,
  orderId,
  token,
  onOrderUpdate,
  enabled = true,
}: UseCustomerRealtimeOptions): UseCustomerRealtimeReturn {
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectDelayRef = useRef(5000) // Start at 5s, exponential backoff
  const onOrderUpdateRef = useRef(onOrderUpdate)

  // Keep onOrderUpdateRef in sync inside an effect to avoid render-time ref writes
  useEffect(() => {
    onOrderUpdateRef.current = onOrderUpdate
  }, [onOrderUpdate])

  useEffect(() => {
    if (!restaurantId || !enabled) return

    // Fetch order data from API
    async function fetchOrder() {
      if (!orderId) return
      try {
        const headers: Record<string, string> = {}
        if (token) headers['Authorization'] = `Bearer ${token}`

        const res = await fetch(
          `/api/restaurants/${restaurantId}/orders/${orderId}`,
          { headers }
        )
        if (res.ok) {
          const data = await res.json()
          onOrderUpdateRef.current(data.data || data)
        }
      } catch {
        // Silently fail — polling will retry
      }
    }

    // Helper: handle SSE messages — defined as a named function to avoid stale closure
    function handleSSEMessage(e: MessageEvent) {
      try {
        const event: RealtimeEvent = JSON.parse(e.data)
        if (event.type === 'connected') return

        // If this event affects our order, re-fetch the latest state
        if (
          event.type === 'order_status_changed' &&
          event.orderId === orderId
        ) {
          fetchOrder()
        }
        if (
          event.type === 'kitchen_item_updated' &&
          event.orderId === orderId
        ) {
          fetchOrder()
        }
        if (event.type === 'payment_received' && event.orderId === orderId) {
          fetchOrder()
        }
        // When a waiter is notified the order is ready, also refresh
        if (
          event.type === 'waiter_order_ready' &&
          event.orderId === orderId
        ) {
          fetchOrder()
        }
      } catch {
        // Ignore malformed events
      }
    }

    // SSE for real-time events
    // Build URL with auth token (EventSource doesn't support custom headers)
    let sseUrl = `/api/events?restaurantId=${encodeURIComponent(restaurantId)}`
    if (token) {
      sseUrl += `&token=${encodeURIComponent(token)}`
    }

    function connectSSE() {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      const es = new EventSource(sseUrl)
      eventSourceRef.current = es

      es.onopen = () => {
        setConnected(true)
        reconnectDelayRef.current = 5000 // Reset backoff on successful connection
        // SSE connected — reduce polling frequency
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = setInterval(fetchOrder, 15000)
        }
      }

      es.onmessage = handleSSEMessage

      es.onerror = () => {
        setConnected(false)
        es.close()
        eventSourceRef.current = null

        // Fallback: start polling more aggressively if SSE fails
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
        pollIntervalRef.current = setInterval(fetchOrder, 5000)

        // Reconnect with exponential backoff
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE()
        }, reconnectDelayRef.current)

        // Increase delay for next attempt: 5s → 10s → 20s → 40s → 60s (capped)
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 60000)
      }
    }

    // Initial SSE connection
    connectSSE()

    // Also poll as a backup (every 15 seconds — SSE handles most updates)
    pollIntervalRef.current = setInterval(fetchOrder, 15000)

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [restaurantId, orderId, token, enabled])

  return { connected }
}
