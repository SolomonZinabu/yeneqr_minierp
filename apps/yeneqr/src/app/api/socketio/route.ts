// ============================================================
// Yene QR — Socket.IO HTTP Endpoint
// ============================================================
// Socket.IO needs to hijack the HTTP server for WebSocket upgrade,
// which isn't directly possible with Next.js App Router route handlers.
// This route provides a health-check / info endpoint.
// The actual WebSocket connection is handled via the SSE fallback
// at /api/events, or via a custom server.ts that calls initIO().

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Socket.IO endpoint — use SSE at /api/events for real-time updates, or configure a custom server with initIO()',
    sseEndpoint: '/api/events?restaurantId=YOUR_RESTAURANT_ID',
  })
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ status: 'ok' })
}
