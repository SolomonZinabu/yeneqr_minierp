// ============================================================
// Yene QR — Restaurant Settings API (GET, PUT)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'
import { logSettingsChange } from '@/lib/audit-log'

/**
 * GET /api/restaurants/[id]/settings
 * Get restaurant settings:
 * - workingHours (parsed from JSON)
 * - taxRate
 * - serviceCharge
 * - currency
 * - defaultLanguage
 * - paymentMethods (from settings JSON)
 * - general settings JSON
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)

    // Check access: must have restaurant:view permission for this restaurant
    const permErr = requirePerm(auth, 'restaurant:view', id)
    if (permErr) return permErr

    const restaurant = await db.restaurant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        workingHours: true,
        taxRate: true,
        serviceCharge: true,
        currency: true,
        defaultLanguage: true,
        settings: true,
        isActive: true,
      },
    })

    if (!restaurant) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    let parsedWorkingHours = null
    if (restaurant.workingHours) {
      try {
        parsedWorkingHours = JSON.parse(restaurant.workingHours)
      } catch {
        parsedWorkingHours = restaurant.workingHours
      }
    }

    let parsedSettings = null
    if (restaurant.settings) {
      try {
        parsedSettings = JSON.parse(restaurant.settings)
      } catch {
        parsedSettings = restaurant.settings
      }
    }

    // Extract payment methods from settings if available
    const paymentMethods = (parsedSettings as Record<string, unknown>)?.paymentMethods || []

    return NextResponse.json({
      data: {
        id: restaurant.id,
        name: restaurant.name,
        workingHours: parsedWorkingHours,
        taxRate: restaurant.taxRate,
        serviceCharge: restaurant.serviceCharge,
        currency: restaurant.currency,
        defaultLanguage: restaurant.defaultLanguage,
        paymentMethods,
        isActive: restaurant.isActive,
        settings: parsedSettings,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      const status = error.message === 'Unauthorized' ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    console.error('[SETTINGS_GET]', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/restaurants/[id]/settings
 * Update restaurant settings.
 * Accepts partial updates for: workingHours, taxRate, serviceCharge,
 * currency, defaultLanguage, paymentMethods (stored in settings JSON)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = requireAuth(request)

    // Must have restaurant:manage permission for this restaurant
    const permErr = requirePerm(auth, 'restaurant:manage', id)
    if (permErr) return permErr

    const existing = await db.restaurant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      workingHours,
      taxRate,
      serviceCharge,
      currency,
      defaultLanguage,
      paymentMethods,
      showServingSize,
      settings,
    } = body

    const updateData: any = {}

    // Track which fields changed for audit logging
    const changedFields: string[] = []

    // Direct fields
    if (workingHours !== undefined) {
      changedFields.push('workingHours')
      updateData.workingHours = typeof workingHours === 'string' ? workingHours : JSON.stringify(workingHours)
    }
    if (taxRate !== undefined) {
      changedFields.push('taxRate')
      if (taxRate < 0 || taxRate > 1) {
        return NextResponse.json(
          { error: 'Tax rate must be between 0 and 1' },
          { status: 400 }
        )
      }
      updateData.taxRate = taxRate
    }
    if (serviceCharge !== undefined) {
      changedFields.push('serviceCharge')
      if (serviceCharge < 0) {
        return NextResponse.json(
          { error: 'Service charge cannot be negative' },
          { status: 400 }
        )
      }
      updateData.serviceCharge = serviceCharge
    }
    if (currency !== undefined) {
      changedFields.push('currency')
      updateData.currency = currency
    }
    if (defaultLanguage !== undefined) {
      changedFields.push('defaultLanguage')
      if (!['en', 'am'].includes(defaultLanguage)) {
        return NextResponse.json(
          { error: 'Default language must be "en" or "am"' },
          { status: 400 }
        )
      }
      updateData.defaultLanguage = defaultLanguage
    }

    // Payment methods and other settings stored in JSON
    if (paymentMethods !== undefined || settings !== undefined || showServingSize !== undefined) {
      // Merge with existing settings
      let currentSettings: Record<string, unknown> = {}
      if (existing.settings) {
        try {
          currentSettings = JSON.parse(existing.settings)
        } catch {
          currentSettings = {}
        }
      }

      if (paymentMethods !== undefined) {
        changedFields.push('paymentMethods')
        currentSettings.paymentMethods = paymentMethods
      }

      if (showServingSize !== undefined) {
        changedFields.push('showServingSize')
        currentSettings.showServingSize = showServingSize
      }

      // Merge any additional settings provided
      if (settings !== undefined && typeof settings === 'object') {
        const { paymentMethods: _pm, showServingSize: _sss, ...restSettings } = settings as Record<string, unknown>
        currentSettings = { ...currentSettings, ...restSettings }
        // If paymentMethods was also at top level, don't overwrite
        if (paymentMethods !== undefined) {
          currentSettings.paymentMethods = paymentMethods
        }
        if (showServingSize !== undefined) {
          currentSettings.showServingSize = showServingSize
        }
        // Track additional setting keys that changed
        const settingKeys = Object.keys(restSettings)
        for (const key of settingKeys) {
          if (!changedFields.includes(key)) {
            changedFields.push(key)
          }
        }
      }

      updateData.settings = JSON.stringify(currentSettings)
    }

    const updated = await db.restaurant.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        workingHours: true,
        taxRate: true,
        serviceCharge: true,
        currency: true,
        defaultLanguage: true,
        settings: true,
      },
    })

    // ── Audit Log for settings change ──
    if (changedFields.length > 0) {
      // Build previous settings snapshot from the existing record
      let prevSettingsSnapshot: Record<string, unknown> = {}
      prevSettingsSnapshot.workingHours = existing.workingHours
      prevSettingsSnapshot.taxRate = existing.taxRate
      prevSettingsSnapshot.serviceCharge = existing.serviceCharge
      prevSettingsSnapshot.currency = existing.currency
      prevSettingsSnapshot.defaultLanguage = existing.defaultLanguage
      if (existing.settings) {
        try {
          prevSettingsSnapshot.settingsJson = JSON.parse(existing.settings)
        } catch {
          prevSettingsSnapshot.settingsJson = existing.settings
        }
      }

      // Build new settings snapshot from the updated record
      let newSettingsSnapshot: Record<string, unknown> = {}
      newSettingsSnapshot.workingHours = updated.workingHours
      newSettingsSnapshot.taxRate = updated.taxRate
      newSettingsSnapshot.serviceCharge = updated.serviceCharge
      newSettingsSnapshot.currency = updated.currency
      newSettingsSnapshot.defaultLanguage = updated.defaultLanguage
      if (updated.settings) {
        try {
          newSettingsSnapshot.settingsJson = JSON.parse(updated.settings)
        } catch {
          newSettingsSnapshot.settingsJson = updated.settings
        }
      }

      logSettingsChange({
        restaurantId: id,
        userId: auth.userId,
        performedByType: auth.type,
        previousSettings: prevSettingsSnapshot,
        newSettings: newSettingsSnapshot,
        changedFields,
      }).catch((err) => console.error('[AUDIT_SETTINGS_CHANGE]', err))
    }

    // Parse JSON fields for response
    let parsedWorkingHours = null
    if (updated.workingHours) {
      try {
        parsedWorkingHours = JSON.parse(updated.workingHours)
      } catch {
        parsedWorkingHours = updated.workingHours
      }
    }

    let parsedSettings = null
    if (updated.settings) {
      try {
        parsedSettings = JSON.parse(updated.settings)
      } catch {
        parsedSettings = updated.settings
      }
    }

    const paymentMethodsResponse = (parsedSettings as Record<string, unknown>)?.paymentMethods || []

    return NextResponse.json({
      data: {
        ...updated,
        workingHours: parsedWorkingHours,
        settings: parsedSettings,
        paymentMethods: paymentMethodsResponse,
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Forbidden')) {
      const status = error.message === 'Unauthorized' ? 401 : 403
      return NextResponse.json({ error: error.message }, { status })
    }
    console.error('[SETTINGS_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
