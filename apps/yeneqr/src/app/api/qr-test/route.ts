// ============================================================
// Yene QR — QR Test API
// Returns all restaurants with their QR codes and table info.
//
// SECURITY: Requires platform:support permission.
// Sensitive payload/signature data is only included for admin users.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext, requirePerm, hasPerm } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Require platform:support permission (no restaurant scope — platform-level)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    // Only include sensitive payload/signature for users with platform:support
    const isAdmin = hasPerm(auth, 'platform:support')

    const restaurants = await db.restaurant.findMany({
      where: { isActive: true, isSuspended: false },
      select: {
        id: true,
        name: true,
        nameAm: true,
        slug: true,
        cuisineType: true,
        branches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            nameAm: true,
            floors: {
              select: {
                id: true,
                name: true,
                tables: {
                  where: { isActive: true },
                  select: {
                    id: true,
                    number: true,
                    capacity: true,
                    qrCode: {
                      select: {
                        id: true,
                        type: true,
                        payload: true,
                        signature: true,
                        scanCount: true,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Flatten into a simpler structure
    // qrCode is a 1:1 relation (QRCode?), so it's either an object or null
    const data = restaurants.map(r => ({
      id: r.id,
      name: r.name,
      nameAm: r.nameAm,
      slug: r.slug,
      cuisineType: r.cuisineType,
      tables: r.branches.flatMap(b =>
        b.floors.flatMap(f =>
          f.tables
            .filter(t => t.qrCode && t.qrCode.isActive)
            .map(t => {
              const entry: Record<string, unknown> = {
                tableId: t.id,
                tableNumber: t.number,
                capacity: t.capacity,
                branchName: b.name,
                branchNameAm: b.nameAm,
                floorName: f.name,
                qrType: t.qrCode!.type,
                scanCount: t.qrCode!.scanCount || 0,
              }
              // Only include payload and signature for authenticated admin users
              if (isAdmin) {
                entry.qrPayload = t.qrCode!.payload
                entry.qrSignature = t.qrCode!.signature
              }
              return entry
            })
        )
      ),
    })).filter(r => r.tables.length > 0)

    return NextResponse.json({ restaurants: data })
  } catch (error) {
    console.error('[QR_TEST_API]', error)
    return NextResponse.json(
      { error: 'Failed to fetch QR codes' },
      { status: 500 }
    )
  }
}
