// ============================================================
// Yene QR — UAT (User Acceptance Testing) API
// GET /api/uat
// Returns all active restaurants with their branches, tables,
// and QR codes for customer-flow testing.
//
// SECURITY: Requires platform:support permission for sensitive data.
// Unauthenticated access is allowed for basic restaurant info.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { buildQRUrl, type QRPayload } from '@/lib/qr'
import { getAuthContext, hasPerm, requirePerm } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    // Auth check — optional: if authenticated with platform:support, include sensitive data.
    // Unauthenticated users (customers doing UAT) can still see the restaurant list
    // but without payload/signature details.
    const auth = getAuthContext(request)
    const isAdmin = auth && hasPerm(auth, 'platform:support')

    const host = request.headers.get('host') || ''
    const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`

    // Fetch all active, non-suspended restaurants
    const restaurants = await db.restaurant.findMany({
      where: {
        isActive: true,
        isSuspended: false,
      },
      select: {
        id: true,
        name: true,
        nameAm: true,
        nameI18n: true,
        slug: true,
        logo: true,
        banner: true,
        cuisineType: true,
        city: true,
        defaultLanguage: true,
        currency: true,
        branches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            nameAm: true,
            isMainBranch: true,
            tables: {
              where: { isActive: true },
              select: {
                id: true,
                number: true,
                capacity: true,
                status: true,
                shape: true,
                floor: {
                  select: { id: true, name: true },
                },
                qrCode: {
                  select: {
                    id: true,
                    type: true,
                    isActive: true,
                    payload: true,
                    signature: true,
                    scanCount: true,
                    createdAt: true,
                  },
                },
              },
              orderBy: { number: 'asc' },
            },
          },
          orderBy: { isMainBranch: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Enrich each table's QR code with a scannable URL
    // Strip sensitive payload/signature for non-admin users
    const enriched = restaurants.map((restaurant) => ({
      ...restaurant,
      branches: restaurant.branches.map((branch) => ({
        ...branch,
        tables: branch.tables.map((table) => ({
          ...table,
          qrCode: table.qrCode
            ? (() => {
                try {
                  const payload: QRPayload = JSON.parse(table.qrCode.payload)
                  const qrUrl = buildQRUrl(baseUrl, payload, table.qrCode.signature)
                  if (isAdmin) {
                    return { ...table.qrCode, qrUrl }
                  }
                  // Strip payload and signature for non-admin users
                  const { payload: _p, signature: _s, ...safeQrCode } = table.qrCode
                  return { ...safeQrCode, qrUrl }
                } catch {
                  if (isAdmin) {
                    return table.qrCode
                  }
                  const { payload: _p, signature: _s, ...safeQrCode } = table.qrCode
                  return safeQrCode
                }
              })()
            : null,
        })),
      })),
    }))

    // Summary stats
    const totalRestaurants = enriched.length
    const totalBranches = enriched.reduce((sum, r) => sum + r.branches.length, 0)
    const totalTables = enriched.reduce(
      (sum, r) => sum + r.branches.reduce((bs, b) => bs + b.tables.length, 0),
      0,
    )
    const totalQRCodes = enriched.reduce(
      (sum, r) =>
        sum +
        r.branches.reduce(
          (bs, b) => bs + b.tables.filter((t) => t.qrCode?.isActive).length,
          0,
        ),
      0,
    )

    return NextResponse.json({
      data: enriched,
      stats: {
        restaurants: totalRestaurants,
        branches: totalBranches,
        tables: totalTables,
        qrCodes: totalQRCodes,
      },
    })
  } catch (error) {
    console.error('[UAT_API_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to fetch UAT data' },
      { status: 500 },
    )
  }
}
