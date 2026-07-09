// ============================================================
// Yene QR — Admin Feature Flags API
// List and update platform feature flags.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requirePerm } from '@/lib/api-auth'

/**
 * GET /api/admin/flags
 * List all feature flags.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:support')
    if (permErr) return permErr

    const flags = await db.platformFeatureFlag.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const data = flags.map(flag => {
      // Parse config JSON — may include rolloutPercentage and description
      let config: any = {}
      if (flag.config) {
        try {
          config = JSON.parse(flag.config)
        } catch {
          config = {}
        }
      }

      return {
        id: flag.id,
        name: flag.name,
        key: flag.key,
        description: config.description || '',
        enabled: flag.enabled,
        rolloutPercentage: config.rolloutPercentage ?? (flag.enabled ? 100 : 0),
        config: flag.config ? JSON.parse(flag.config) : {},
        createdAt: flag.createdAt.toISOString(),
        updatedAt: flag.updatedAt.toISOString(),
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_FLAGS_LIST]', error)
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/flags
 * Update a feature flag (enabled, rolloutPercentage, config).
 * Body: { flagId, enabled?, rolloutPercentage?, config?, name? }
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    const permErr = requirePerm(auth, 'platform:manage')
    if (permErr) return permErr

    const body = await request.json()
    const { flagId, enabled, rolloutPercentage, config, name } = body

    if (!flagId) {
      return NextResponse.json(
        { error: 'flagId is required' },
        { status: 400 }
      )
    }

    const existing = await db.platformFeatureFlag.findUnique({
      where: { id: flagId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Feature flag not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: any = {}

    if (name !== undefined) {
      updateData.name = name
    }

    if (enabled !== undefined) {
      updateData.enabled = enabled
    }

    // Merge rolloutPercentage and config into the config JSON field
    if (rolloutPercentage !== undefined || config !== undefined) {
      let existingConfig: any = {}
      if (existing.config) {
        try {
          existingConfig = JSON.parse(existing.config)
        } catch {
          existingConfig = {}
        }
      }

      if (rolloutPercentage !== undefined) {
        existingConfig.rolloutPercentage = rolloutPercentage
      }

      if (config !== undefined) {
        // Merge new config keys into existing config
        existingConfig = { ...existingConfig, ...config }
      }

      updateData.config = JSON.stringify(existingConfig)
    }

    const updated = await db.platformFeatureFlag.update({
      where: { id: flagId },
      data: updateData,
    })

    // Parse response
    let responseConfig: any = {}
    if (updated.config) {
      try {
        responseConfig = JSON.parse(updated.config)
      } catch {
        responseConfig = {}
      }
    }

    return NextResponse.json({
      data: {
        id: updated.id,
        name: updated.name,
        key: updated.key,
        description: responseConfig.description || '',
        enabled: updated.enabled,
        rolloutPercentage: responseConfig.rolloutPercentage ?? (updated.enabled ? 100 : 0),
        config: responseConfig,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[ADMIN_FLAGS_UPDATE]', error)
    return NextResponse.json(
      { error: 'Failed to update feature flag' },
      { status: 500 }
    )
  }
}
