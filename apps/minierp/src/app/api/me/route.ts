// GET /api/auth/me — returns current user from JWT (replaces Better-Auth)
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/jwt-auth";

export async function GET(req: NextRequest) {
  const payload = await getSession(req);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    user: { id: payload.userId, email: payload.email, name: null },
    role: payload.role,
    permissions: payload.permissions,
    tenant: { id: payload.tenantId },
  });
}
