// ============================================================
// Yene QR — Restaurant Registration API Route
// POST /api/auth/register
// Onboarding: Restaurant → Branch (main) → Owner → Menu → Subscription
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, generateStaffToken, resolveUserPermissions, type TokenPayload } from '@/lib/auth'
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // ── Rate Limiting ──────────────────────────────────
    const clientIp = getClientIp(request)
    const rateLimitKey = `register:${clientIp}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.register)

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many registration attempts. Please try again later.',
          retryAfterMs: rateLimitResult.retryAfterMs,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.retryAfterMs || 3600000) / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      )
    }

    const body = await request.json()
    const { restaurantName, nameAm, slug, ownerName, ownerEmail, password, phone, cuisineType, city, address } = body

    // Validate required fields
    if (!restaurantName || !slug || !ownerName || !ownerEmail || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: restaurantName, slug, ownerName, ownerEmail, password' },
        { status: 400 }
      )
    }

    // Validate slug length
    if (slug.length < 3) {
      return NextResponse.json(
        { error: 'URL slug must be at least 3 characters long' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(ownerEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    const slugRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must be lowercase alphanumeric with hyphens (no leading/trailing hyphens)' },
        { status: 400 }
      )
    }

    // Check if slug is already taken
    const existingRestaurant = await db.restaurant.findUnique({ where: { slug } })
    if (existingRestaurant) {
      return NextResponse.json(
        { error: 'This restaurant URL slug is already taken. Please choose another.' },
        { status: 409 }
      )
    }

    // Check if owner email is already used in any user table
    const existingUser = await db.restaurantUser.findFirst({ where: { email: ownerEmail } })
    const existingSuperAdmin = await db.superAdmin.findFirst({ where: { email: ownerEmail } })
    const existingSupportAdmin = await db.supportAdmin.findFirst({ where: { email: ownerEmail } })
    if (existingUser || existingSuperAdmin || existingSupportAdmin) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      )
    }

    // Hash the owner's password
    const hashedPassword = await hashPassword(password)

    // Find or create a default subscription plan
    let plan = await db.subscriptionPlan.findFirst({ where: { slug: 'basic' } })
    if (!plan) {
      // Auto-create a default "Basic" plan if none exists
      plan = await db.subscriptionPlan.create({
        data: {
          name: 'Basic',
          slug: 'basic',
          description: 'Basic plan for small restaurants',
          priceCents: 0,
          yearlyPriceCents: null,
          features: JSON.stringify(['1 branch', '50 menu items', 'QR codes', 'Basic analytics']),
          limits: JSON.stringify({ maxBranches: 1, maxMenuItems: 50, maxStaff: 5 }),
          isActive: true,
          sortOrder: 0,
        },
      })
    }

    // Calculate trial dates
    const now = new Date()
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + 14)

    // Create the full restaurant onboarding in a transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Create Restaurant
      const restaurant = await tx.restaurant.create({
        data: {
          name: restaurantName,
          nameAm: nameAm || null,
          slug,
          cuisineType: cuisineType || null,
          phone: phone || null,
          email: ownerEmail,
          city: city || null,
          address: address || null,
          defaultLanguage: 'en',
          currency: 'ETB',
          enabledLanguages: JSON.stringify(['en', ...(nameAm ? ['am'] : [])]),
          isActive: true,
          isVerified: false,
          isSuspended: false,
        },
      })

      // 1b. Create default language configs for the restaurant
      await tx.restaurantLanguage.create({
        data: {
          restaurantId: restaurant.id,
          languageCode: 'en',
          isDefault: true,
          isActive: true,
          isRequired: true,
          sortOrder: 0,
        },
      })
      // Add Amharic if nameAm provided
      if (nameAm) {
        await tx.restaurantLanguage.create({
          data: {
            restaurantId: restaurant.id,
            languageCode: 'am',
            isDefault: false,
            isActive: true,
            isRequired: false,
            sortOrder: 1,
          },
        })
        // Also set nameI18n on the restaurant
        await tx.restaurant.update({
          where: { id: restaurant.id },
          data: {
            nameI18n: JSON.stringify({ am: nameAm }),
          },
        })
      }

      // 2. Create Main Branch
      const branch = await tx.branch.create({
        data: {
          restaurantId: restaurant.id,
          name: 'Main Branch',
          isMainBranch: true,
          isActive: true,
        },
      })

      // 3. Create Owner User
      const owner = await tx.restaurantUser.create({
        data: {
          restaurantId: restaurant.id,
          branchId: null, // Owner has access to all branches
          email: ownerEmail,
          name: ownerName,
          password: hashedPassword,
          phone: phone || null,
          role: 'owner',
          isActive: true,
        },
      })

      // 4. Create Default Menu
      const menu = await tx.menu.create({
        data: {
          restaurantId: restaurant.id,
          name: 'Main Menu',
          isActive: true,
          sortOrder: 0,
        },
      })

      // 5. Create default menu categories
      await tx.menuCategory.createMany({
        data: [
          {
            menuId: menu.id,
            restaurantId: restaurant.id,
            name: 'Starters',
            sortOrder: 0,
            isActive: true,
          },
          {
            menuId: menu.id,
            restaurantId: restaurant.id,
            name: 'Main Course',
            sortOrder: 1,
            isActive: true,
          },
          {
            menuId: menu.id,
            restaurantId: restaurant.id,
            name: 'Beverages',
            sortOrder: 2,
            isActive: true,
          },
          {
            menuId: menu.id,
            restaurantId: restaurant.id,
            name: 'Desserts',
            sortOrder: 3,
            isActive: true,
          },
        ],
      })

      // 6. Create Subscription with 14-day trial
      const subscription = await tx.subscription.create({
        data: {
          restaurantId: restaurant.id,
          planId: plan!.id,
          status: 'trial',
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          trialEndsAt: trialEnd,
        },
      })

      return { restaurant, branch, owner, menu, subscription }
    })

    // Generate JWT token for the newly created owner
    const tokenPayload: TokenPayload = {
      userId: result.owner.id,
      email: result.owner.email,
      role: 'owner',
      restaurantId: result.restaurant.id,
      branchId: undefined,
      type: 'staff',
      permissions: resolveUserPermissions('owner'),
    }

    const token = generateStaffToken(tokenPayload)

    return NextResponse.json(
      {
        message: 'Restaurant registered successfully! Your 14-day free trial has started.',
        token,
        user: {
          id: result.owner.id,
          name: result.owner.name,
          email: result.owner.email,
          phone: result.owner.phone,
          role: result.owner.role,
        },
        restaurant: {
          id: result.restaurant.id,
          name: result.restaurant.name,
          slug: result.restaurant.slug,
        },
        branch: {
          id: result.branch.id,
          name: result.branch.name,
          isMainBranch: result.branch.isMainBranch,
        },
        subscription: {
          id: result.subscription.id,
          status: result.subscription.status,
          trialEndsAt: result.subscription.trialEndsAt,
          currentPeriodEnd: result.subscription.currentPeriodEnd,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[AUTH_REGISTER_ERROR]', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred during registration. Please try again.' },
      { status: 500 }
    )
  }
}
