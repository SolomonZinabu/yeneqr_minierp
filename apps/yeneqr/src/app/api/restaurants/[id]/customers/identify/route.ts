// ============================================================
// Yene QR — Customer Identify API
// POST /api/restaurants/[id]/customers/identify
// Links a customer session to an existing customer record by phone number.
// If no existing customer is found, creates one.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/api-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: restaurantId } = await params

    // Verify customer auth
    const auth = getAuthContext(request)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (auth.type !== 'customer') {
      return NextResponse.json({ error: 'Only customers can identify themselves' }, { status: 403 })
    }

    if (auth.restaurantId !== restaurantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { phone, name } = body

    if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
      return NextResponse.json(
        { error: 'A valid phone number is required' },
        { status: 400 }
      )
    }

    const trimmedPhone = phone.trim()

    // Get the current session
    const session = await db.customerSession.findUnique({
      where: { id: auth.sessionId },
      include: { customer: true },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Check if there's already an existing customer with this phone for this restaurant
    const existingCustomer = await db.customer.findFirst({
      where: {
        restaurantId,
        phone: trimmedPhone,
      },
    })

    let customer

    if (existingCustomer) {
      // Link session to existing customer
      customer = existingCustomer

      // Update customer info if name provided
      if (name && !existingCustomer.name) {
        await db.customer.update({
          where: { id: existingCustomer.id },
          data: { name },
        })
        customer = { ...existingCustomer, name }
      }

      // Update visit stats
      await db.customer.update({
        where: { id: existingCustomer.id },
        data: {
          visitCount: { increment: 1 },
          lastVisitAt: new Date(),
        },
      })
      customer.visitCount += 1
      customer.lastVisitAt = new Date()
    } else if (session.customer) {
      // Session already linked to a customer — update their phone number
      await db.customer.update({
        where: { id: session.customer.id },
        data: {
          phone: trimmedPhone,
          name: name || session.customer.name,
          visitCount: { increment: 1 },
          lastVisitAt: new Date(),
        },
      })
      customer = {
        ...session.customer,
        phone: trimmedPhone,
        name: name || session.customer.name,
        visitCount: session.customer.visitCount + 1,
        lastVisitAt: new Date(),
      }
    } else {
      // No existing customer — create a new one
      customer = await db.customer.create({
        data: {
          restaurantId,
          phone: trimmedPhone,
          name: name || null,
          visitCount: 1,
          lastVisitAt: new Date(),
        },
      })
    }

    // Link session to customer
    await db.customerSession.update({
      where: { id: session.id },
      data: { customerId: customer.id },
    })

    // Return customer info with order count
    const orderCount = await db.order.count({
      where: {
        customerId: customer.id,
        restaurantId,
      },
    })

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        loyaltyPoints: customer.loyaltyPoints,
        totalSpent: customer.totalSpentCents,
        visitCount: customer.visitCount,
        lastVisitAt: customer.lastVisitAt,
        orderCount,
      },
      message: existingCustomer
        ? 'Welcome back! Your order history is now available.'
        : 'Account created! Your future orders will be saved.',
    })
  } catch (error) {
    console.error('[CUSTOMER_IDENTIFY]', error)
    return NextResponse.json(
      { error: 'Failed to identify customer' },
      { status: 500 }
    )
  }
}
