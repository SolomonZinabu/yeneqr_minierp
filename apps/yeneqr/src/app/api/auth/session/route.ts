// ============================================================
// Yene QR — Customer QR Session API Route
// POST /api/auth/session
// Validates QR payload + signature, creates CustomerSession
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { generateCustomerToken, type CustomerTokenPayload } from '@/lib/auth'
import { getLeastBusyWaiterForTable } from '@/lib/waiter-assignment'

// Define QRPayload locally to avoid importing @/lib/qr which has
// a client-side dependency (qrcode library) that can't run in edge runtime
interface QRPayload {
  rid: string
  bid: string
  tid: string
  type: 'static' | 'dynamic' | 'temporary'
  iat: number
  exp: number | null
}

// QR secret must match the one in @/lib/qr.ts
const QR_SECRET = process.env.QR_SECRET || (
  process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build'
    ? (() => { throw new Error('FATAL: QR_SECRET env var required in production') })()
    : 'yene-qr-hmac-secret-change-in-production'
)

// Duplicate sign/verify logic from @/lib/qr to avoid importing
// client-incompatible modules (QRCode) on the server route
function signPayload(payload: QRPayload): string {
  const data = `${payload.rid}:${payload.bid}:${payload.tid}:${payload.type}:${payload.iat}:${payload.exp || 'none'}`
  return crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex')
}

function verifyQRSignature(payload: QRPayload, signature: string): boolean {
  try {
    const expected = signPayload(payload)
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

function isQRExpired(payload: QRPayload): boolean {
  if (!payload.exp) return false
  return Math.floor(Date.now() / 1000) > payload.exp
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { payload, signature } = body

    // Validate required fields
    if (!payload || !signature) {
      return NextResponse.json(
        { error: 'QR payload and signature are required' },
        { status: 400 }
      )
    }

    // Validate payload structure
    const qrPayload = payload as QRPayload
    if (!qrPayload.rid || !qrPayload.bid || !qrPayload.tid || !qrPayload.type || !qrPayload.iat) {
      return NextResponse.json(
        { error: 'Invalid QR payload structure' },
        { status: 400 }
      )
    }

    // Verify QR signature
    const isValidSignature = verifyQRSignature(qrPayload, signature)
    if (!isValidSignature) {
      return NextResponse.json(
        { error: 'Invalid QR code signature. This QR code may have been tampered with.' },
        { status: 401 }
      )
    }

    // Check if QR is expired
    if (isQRExpired(qrPayload)) {
      return NextResponse.json(
        { error: 'This QR code has expired. Please ask staff for a new one.' },
        { status: 410 }
      )
    }

    // Verify restaurant exists and is active
    const restaurant = await db.restaurant.findUnique({
      where: { id: qrPayload.rid },
      select: {
        id: true,
        name: true,
        nameAm: true,
        nameI18n: true,
        slug: true,
        logo: true,
        banner: true,
        description: true,
        cuisineType: true,
        defaultLanguage: true,
        currency: true,
        taxRate: true,
        serviceCharge: true,
        isActive: true,
        isSuspended: true,
        workingHours: true,
        settings: true,
        starPayEnabled: true,
      },
    })

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found.' },
        { status: 404 }
      )
    }

    if (!restaurant.isActive || restaurant.isSuspended) {
      return NextResponse.json(
        { error: 'This restaurant is currently unavailable.' },
        { status: 403 }
      )
    }

    // Verify branch exists and is active
    const branch = await db.branch.findFirst({
      where: {
        id: qrPayload.bid,
        restaurantId: qrPayload.rid,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        nameAm: true,
        nameI18n: true,
        address: true,
        workingHours: true,
      },
    })

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found or inactive.' },
        { status: 404 }
      )
    }

    // Verify table exists and is active
    const table = await db.table.findFirst({
      where: {
        id: qrPayload.tid,
        branchId: qrPayload.bid,
        isActive: true,
      },
      select: {
        id: true,
        number: true,
        capacity: true,
        status: true,
        menuId: true,
      },
    })

    if (!table) {
      return NextResponse.json(
        { error: 'Table not found or inactive.' },
        { status: 404 }
      )
    }

    // Find or look up QR code record (needed for deactivation check + menuId)
    const qrCodeRecord = await db.qRCode.findFirst({
      where: {
        tableId: qrPayload.tid,
        restaurantId: qrPayload.rid,
        branchId: qrPayload.bid,
      },
      select: {
        id: true,
        menuId: true,
        isActive: true,
        signature: true,
        expiresAt: true,
      },
    })

    // Check if QR code has been deactivated
    if (qrCodeRecord && !qrCodeRecord.isActive) {
      return NextResponse.json(
        { error: 'This QR code has been deactivated. Please ask staff for a new one.' },
        { status: 410 }
      )
    }

    // Cross-validate signature against the DB record.
    // This ensures that after reactivation (which generates a new signature),
    // old QR codes with the old signature are rejected.
    if (qrCodeRecord && qrCodeRecord.isActive && signature !== qrCodeRecord.signature) {
      return NextResponse.json(
        { error: 'This QR code is outdated. Please scan the updated QR code.' },
        { status: 410 }
      )
    }

    // Check if QR code has expired in the database (cross-validate with DB record)
    if (qrCodeRecord?.expiresAt && new Date() > qrCodeRecord.expiresAt) {
      return NextResponse.json(
        { error: 'This QR code has expired. Please ask staff for a new one.' },
        { status: 410 }
      )
    }

    // Check if there's already an active session for this table
    // Only resume if the session has an actively preparing order (not served/paid/completed/cancelled)
    const existingSession = await db.customerSession.findFirst({
      where: {
        tableId: qrPayload.tid,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    })

    // Check if the existing session has an actively preparing order
    // If the order is already served/paid/completed/cancelled, create a fresh session
    let shouldResumeSession = false
    if (existingSession) {
      const activePreparingOrder = await db.order.findFirst({
        where: {
          sessionId: existingSession.id,
          status: { in: ['pending', 'accepted', 'preparing', 'ready', 'picked_up'] },
        },
      })
      if (activePreparingOrder) {
        shouldResumeSession = true
      } else {
        // Session has no active order — expire it so we create a fresh one
        await db.customerSession.update({
          where: { id: existingSession.id },
          data: { isActive: false, lastActivityAt: new Date() },
        })
      }
    }

    if (existingSession && shouldResumeSession) {
      // Reuse the existing session — customer has an active order being prepared
      // Just update the last activity timestamp
      await db.customerSession.update({
        where: { id: existingSession.id },
        data: { lastActivityAt: new Date() },
      })

      // Fetch customer info if linked to this session
      let linkedCustomer: { id: string; name: string | null; phone: string | null } | null = null
      if (existingSession.customerId) {
        const customer = await db.customer.findUnique({
          where: { id: existingSession.customerId },
          select: { id: true, name: true, phone: true },
        })
        if (customer) linkedCustomer = customer
      }

      // Generate a new JWT token for the existing session
      const customerPayload: CustomerTokenPayload = {
        sessionId: existingSession.id,
        restaurantId: qrPayload.rid,
        branchId: qrPayload.bid,
        tableId: qrPayload.tid,
        language: existingSession.language || restaurant.defaultLanguage || 'en',
        type: 'customer',
        customerId: linkedCustomer?.id,
      }
      const jwtToken = generateCustomerToken(customerPayload)

      // Look up assigned waiter for this table (dynamic — reflects current shift)
      const assignedWaiter = await getLeastBusyWaiterForTable(restaurant.id, table.id)

      return NextResponse.json({
        message: 'Session resumed',
        sessionToken: existingSession.token,
        token: jwtToken,
        session: {
          id: existingSession.id,
          language: existingSession.language,
          startedAt: existingSession.startedAt,
          expiresAt: existingSession.expiresAt,
          customerId: linkedCustomer?.id || null,
          customerName: linkedCustomer?.name || null,
          customerPhone: linkedCustomer?.phone || null,
        },
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          nameAm: restaurant.nameAm,
          nameI18n: restaurant.nameI18n,
          slug: restaurant.slug,
          logo: restaurant.logo,
          banner: restaurant.banner,
          description: restaurant.description,
          cuisineType: restaurant.cuisineType,
          defaultLanguage: restaurant.defaultLanguage,
          currency: restaurant.currency,
          taxRate: restaurant.taxRate,
          serviceCharge: restaurant.serviceCharge,
          workingHours: restaurant.workingHours,
          settings: (() => { try { return restaurant.settings ? JSON.parse(restaurant.settings) : {} } catch { return {} } })(),
        },
        branch: {
          id: branch.id,
          name: branch.name,
          nameAm: branch.nameAm,
          nameI18n: branch.nameI18n,
          address: branch.address,
          workingHours: branch.workingHours,
        },
        table: {
          id: table.id,
          number: table.number,
          capacity: table.capacity,
          status: table.status,
        },
        menuId: qrCodeRecord?.menuId || table.menuId || null,
        waiter: assignedWaiter ? {
          name: assignedWaiter.name,
          phone: assignedWaiter.phone,
        } : null,
        customer: linkedCustomer ? {
          id: linkedCustomer.id,
          name: linkedCustomer.name,
          phone: linkedCustomer.phone,
        } : null,
      })
    }

    // Increment scan count if QR code record exists
    if (qrCodeRecord) {
      await db.qRCode.update({
        where: { id: qrCodeRecord.id },
        data: { scanCount: { increment: 1 } },
      })
    }

    // Generate session token
    const sessionToken = generateSessionToken()

    // Calculate session expiry (4 hours from now)
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setHours(expiresAt.getHours() + 4)

    // Create customer session
    const session = await db.customerSession.create({
      data: {
        restaurantId: qrPayload.rid,
        branchId: qrPayload.bid,
        tableId: qrPayload.tid,
        qrCodeId: qrCodeRecord?.id || null,
        token: sessionToken,
        language: restaurant.defaultLanguage || 'en',
        isActive: true,
        startedAt: now,
        lastActivityAt: now,
        expiresAt,
      },
    })

    // Generate customer JWT token
    const customerPayload: CustomerTokenPayload = {
      sessionId: session.id,
      restaurantId: qrPayload.rid,
      branchId: qrPayload.bid,
      tableId: qrPayload.tid,
      language: session.language,
      type: 'customer',
    }

    const jwtToken = generateCustomerToken(customerPayload)

    // Look up assigned waiter for this table (dynamic — reflects current shift)
    const assignedWaiter = await getLeastBusyWaiterForTable(restaurant.id, table.id)

    return NextResponse.json({
      message: 'Session created successfully',
      sessionToken,
      token: jwtToken,
      session: {
        id: session.id,
        language: session.language,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        customerId: null,
        customerName: null,
        customerPhone: null,
      },
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        nameAm: restaurant.nameAm,
        nameI18n: restaurant.nameI18n,
        slug: restaurant.slug,
        logo: restaurant.logo,
        banner: restaurant.banner,
        description: restaurant.description,
        cuisineType: restaurant.cuisineType,
        defaultLanguage: restaurant.defaultLanguage,
        currency: restaurant.currency,
        taxRate: restaurant.taxRate,
        serviceCharge: restaurant.serviceCharge,
        workingHours: restaurant.workingHours,
        settings: (() => { try { return restaurant.settings ? JSON.parse(restaurant.settings) : {} } catch { return {} } })(),
      },
      branch: {
        id: branch.id,
        name: branch.name,
        nameAm: branch.nameAm,
        nameI18n: branch.nameI18n,
        address: branch.address,
        workingHours: branch.workingHours,
      },
      table: {
        id: table.id,
        number: table.number,
        capacity: table.capacity,
      },
      menuId: qrCodeRecord?.menuId || table.menuId || null,
      waiter: assignedWaiter ? {
        name: assignedWaiter.name,
        phone: assignedWaiter.phone,
      } : null,
      customer: null,
    }, { status: 201 })
  } catch (error) {
    console.error('[AUTH_SESSION_ERROR]', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try scanning the QR code again.' },
      { status: 500 }
    )
  }
}
