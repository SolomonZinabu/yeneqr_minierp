// src/lib/api-helpers.ts
// Shared helpers for authenticated API routes with permission-based RBAC.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, dbRaw, runWithTenant } from "@/lib/db";
import { assertErpEnabled } from "@/lib/erp-gate";
import { getEffectivePermissions } from "@/lib/permissions";

export interface ApiContext {
  req: NextRequest;
  params: Record<string, string>;
  tenant: { id: string; name: string; slug: string; currency: string; taxRate: number; erpPlanSlug: string; erpEnabled: boolean };
  user: { id: string; email: string; name: string | null };
  role: string;
  permissions: Set<string>;
  hasPermission: (permission: string) => boolean;
}

export type ApiHandler<T = unknown> = (ctx: ApiContext) => Promise<T>;

export function withTenant<T = unknown>(handler: ApiHandler<T>) {
  return async (
    req: NextRequest,
    segmentParams?: { params: Promise<Record<string, string>> } | Record<string, string>,
  ): Promise<Response | NextResponse<T>> => {
    try {
      let params: Record<string, string> = {};
      if (segmentParams) {
        const raw = "params" in segmentParams
          ? await (segmentParams as { params: Promise<Record<string, string>> }).params
          : segmentParams as Record<string, string>;
        params = raw ?? {};
      }
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const tenantId = req.headers.get("x-tenant-id");
      if (!tenantId) return NextResponse.json({ error: "No tenant selected. Set the mini-tenant-id cookie or x-tenant-id header." }, { status: 400 });
      const tenant = await dbRaw.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
      const tenantUser = await dbRaw.tenantUser.findUnique({ where: { tenantId_userId: { tenantId, userId: session.user.id } } });
      if (!tenantUser) return NextResponse.json({ error: "You are not a member of this tenant" }, { status: 403 });
      const gate = assertErpEnabled(tenant);
      if (!gate.ok) return gate.response!;
      const userExtraPerms = Array.isArray(tenantUser.permissions)
        ? (tenantUser.permissions as unknown as string[]).filter((p): p is string => typeof p === "string")
        : [];
      const permissions = getEffectivePermissions(tenantUser.role, userExtraPerms);
      const hasPermission = (perm: string) => permissions.has(perm);
      const result = await runWithTenant(tenantId, () =>
        handler({
          req, params,
          tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, currency: tenant.currency, taxRate: tenant.taxRate, erpPlanSlug: tenant.erpPlanSlug, erpEnabled: tenant.erpEnabled },
          user: { id: session.user.id, email: session.user.email, name: session.user.name ?? null },
          role: tenantUser.role, permissions, hasPermission,
        }),
      );
      return result as Response | NextResponse<T>;
    } catch (error) {
      console.error("[API_ERROR]", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      const status = isHttpError(error) ? error.status : 500;
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function isHttpError(e: unknown): e is HttpError { return e instanceof HttpError; }

export function requirePermission(ctx: ApiContext, permission: string): void {
  if (!ctx.hasPermission(permission)) {
    throw new HttpError(403, `Forbidden — you need the "${permission}" permission. Your role "${ctx.role}" doesn't grant this.`);
  }
}

export function withPermission<T = unknown>(permission: string, handler: ApiHandler<T>) {
  return withTenant<T>(async (ctx) => {
    requirePermission(ctx, permission);
    return handler(ctx);
  });
}

export async function parseJsonBody<T = unknown>(req: NextRequest): Promise<T> {
  try { return (await req.json()) as T; }
  catch { throw new HttpError(400, "Invalid JSON body"); }
}

export async function parseAndValidate<T>(req: NextRequest, schema: { parse: (data: unknown) => T }): Promise<T> {
  const body = await parseJsonBody(req);
  try { return schema.parse(body); }
  catch (err) {
    if (err && typeof err === "object" && "issues" in err) {
      const issues = (err as { issues: { path: unknown[]; message: string }[] }).issues;
      throw new HttpError(422, `Validation error: ${issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    throw new HttpError(422, "Validation failed");
  }
}

export { db, dbRaw, runWithTenant };
