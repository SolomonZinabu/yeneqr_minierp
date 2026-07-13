// GET /api/me — reads JWT from cookie, returns user + permissions
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt-auth";
import { dbRaw } from "@/lib/db";

export async function GET(req: NextRequest) {
  const payload = await getSession(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await dbRaw.tenant.findUnique({
    where: { id: payload.tenantId },
    select: { id: true, name: true, slug: true, currency: true, erpPlanSlug: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: { id: payload.userId, email: payload.email, name: null },
    role: payload.role,
    permissions: payload.permissions || [],
    tenant,
  });
}
