// POST /api/tenants/provision
//
// Called by YeneQR's "Enable ERP" admin action to create a linked tenant
// in the Mini ERP. This is a system-level endpoint (no tenant context yet —
// we're creating the tenant), authenticated by a shared PROVISION_SECRET.
//
// Request body:
//   {
//     yeneqrRestaurantId: string,
//     restaurantName: string,
//     ownerEmail: string,
//     ownerName?: string,
//     currency?: string,        // default "ETB"
//     taxRate?: number,         // default 0.15
//     planSlug?: string         // default "erp_starter"
//   }
//
// Response:
//   {
//     tenantId: string,
//     apiKey: string,           // YeneQR stores this in POSIntegration.apiKey
//     webhookUrl: string        // YeneQR stores this in POSIntegration.webhookUrl
//   }
//
// Idempotent: if a tenant with the same externalYeneqrId already exists,
// returns the existing tenant's apiKey (re-provisioning).

import { NextRequest, NextResponse } from "next/server";
import { db, dbRaw, runWithoutTenant } from "@/lib/db";
import { randomBytes } from "node:crypto";

function generateApiKey(): string {
  return `merp_${randomBytes(24).toString("hex")}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export async function POST(req: NextRequest) {
  try {
    // 1) Auth — shared PROVISION_SECRET
    const provisionSecret = process.env.PROVISION_SECRET;
    if (!provisionSecret) {
      console.error("[PROVISION] PROVISION_SECRET env var not set");
      return NextResponse.json(
        { error: "Server misconfigured: PROVISION_SECRET not set" },
        { status: 500 },
      );
    }

    const providedSecret = req.headers.get("x-provision-secret");
    if (providedSecret !== provisionSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2) Parse body
    const body = await req.json();
    const {
      yeneqrRestaurantId,
      restaurantName,
      ownerEmail,
      ownerName,
      currency = "ETB",
      taxRate = 0.15,
      planSlug = "erp_starter",
    } = body ?? {};

    if (!yeneqrRestaurantId || !restaurantName || !ownerEmail) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: yeneqrRestaurantId, restaurantName, ownerEmail",
        },
        { status: 400 },
      );
    }

    // 3) Idempotency — if a tenant with this externalYeneqrId exists, return its API key
    const existingTenant = await dbRaw.tenant.findUnique({
      where: { externalYeneqrId: yeneqrRestaurantId },
    });

    if (existingTenant) {
      // Find or create the TenantIntegration for YeneQR
      let integration = await dbRaw.tenantIntegration.findUnique({
        where: {
          tenantId_provider: { tenantId: existingTenant.id, provider: "yeneqr" },
        },
      });

      if (!integration) {
        const apiKey = generateApiKey();
        integration = await dbRaw.tenantIntegration.create({
          data: {
            tenantId: existingTenant.id,
            provider: "yeneqr",
            externalId: yeneqrRestaurantId,
            apiKey,
            isActive: true,
          },
        });
      }

      return NextResponse.json({
        tenantId: existingTenant.id,
        apiKey: integration.apiKey,
        webhookUrl: `${process.env.BETTER_AUTH_URL ?? "http://localhost:3100"}/api/integrations/yeneqr/webhook`,
        reProvisioned: true,
      });
    }

    // 4) Create new tenant + owner user + default org node + integration
    const result = await runWithoutTenant(async () => {
      return await dbRaw.$transaction(async (tx) => {
        // a) Tenant
        const baseSlug = slugify(restaurantName);
        let slug = baseSlug;
        let suffix = 1;
        while (await tx.tenant.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${suffix++}`;
        }

        const tenant = await tx.tenant.create({
          data: {
            name: restaurantName,
            slug,
            currency,
            taxRate,
            erpEnabled: true,
            erpPlanSlug: planSlug,
            externalYeneqrId: yeneqrRestaurantId,
          },
        });

        // b) Owner user (find-or-create by email)
        let owner = await tx.user.findUnique({ where: { email: ownerEmail } });
        if (!owner) {
          // For Phase 0B, the owner doesn't have a password yet — YeneQR SSO
          // will issue a token. They can set a password later via "forgot password".
          owner = await tx.user.create({
            data: {
              email: ownerEmail,
              name: ownerName ?? null,
              isActive: true,
            },
          });
        }

        // c) TenantUser with role=owner
        await tx.tenantUser.create({
          data: {
            tenantId: tenant.id,
            userId: owner.id,
            role: "owner",
            isPrimary: true,
            acceptedAt: new Date(),
          },
        });

        // d) Default OrganizationNode — one main branch
        await tx.organizationNode.create({
          data: {
            tenantId: tenant.id,
            name: "Main Branch",
            code: "MAIN",
            type: "branch",
            isActive: true,
          },
        });

        // e) TenantIntegration for YeneQR webhook auth
        const apiKey = generateApiKey();
        await tx.tenantIntegration.create({
          data: {
            tenantId: tenant.id,
            provider: "yeneqr",
            externalId: yeneqrRestaurantId,
            apiKey,
            isActive: true,
          },
        });

        return { tenant, apiKey };
      });
    });

    // 5) Return credentials to YeneQR
    return NextResponse.json(
      {
        tenantId: result.tenant.id,
        apiKey: result.apiKey,
        webhookUrl: `${process.env.BETTER_AUTH_URL ?? "http://localhost:3100"}/api/integrations/yeneqr/webhook`,
        provisioned: true,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[PROVISION_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to provision tenant" },
      { status: 500 },
    );
  }
}
