// GET /api/me — returns current user + role + effective permissions
// Auto-resolves the user's primary tenant if no x-tenant-id header or cookie is set.
// This fixes the "app keeps loading" issue — after sign-in, the dashboard layout
// calls /api/me but the mini-tenant-id cookie hasn't been set yet, so we auto-resolve.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { dbRaw, runWithTenant } from "@/lib/db";
import { getEffectivePermissions } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    // 1) Get session
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Resolve tenant — from header, cookie, or auto-resolve primary tenant
    let tenantId = req.headers.get("x-tenant-id");
    
    if (!tenantId) {
      // Try cookie
      tenantId = req.cookies.get("mini-tenant-id")?.value ?? null;
    }

    if (!tenantId) {
      // Auto-resolve: find the user's primary tenant
      const tenantUser = await dbRaw.tenantUser.findFirst({
        where: { userId: session.user.id, isPrimary: true },
        include: { tenant: true },
      });
      if (!tenantUser) {
        // No primary — try any tenant
        const anyTenantUser = await dbRaw.tenantUser.findFirst({
          where: { userId: session.user.id },
          include: { tenant: true },
        });
        if (!anyTenantUser) {
          return NextResponse.json({ error: "No tenant membership found" }, { status: 403 });
        }
        tenantId = anyTenantUser.tenantId;
      } else {
        tenantId = tenantUser.tenantId;
      }
    }

    // 3) Get tenant + tenantUser
    const tenant = await dbRaw.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const tenantUser = await dbRaw.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: session.user.id } },
    });
    if (!tenantUser) {
      return NextResponse.json({ error: "Not a member of this tenant" }, { status: 403 });
    }

    // 4) Compute permissions
    const userExtraPerms = Array.isArray(tenantUser.permissions)
      ? (tenantUser.permissions as unknown as string[]).filter((p): p is string => typeof p === "string")
      : [];
    const permissions = getEffectivePermissions(tenantUser.role, userExtraPerms);

    // 5) Return — also set the tenant cookie so subsequent requests have it
    const response = NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
      },
      role: tenantUser.role,
      permissions: Array.from(permissions).sort(),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        currency: tenant.currency,
        erpPlanSlug: tenant.erpPlanSlug,
      },
    });

    // Set the tenant cookie so future requests don't need auto-resolution
    response.cookies.set("mini-tenant-id", tenantId, {
      path: "/",
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (error) {
    console.error("[/api/me ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
