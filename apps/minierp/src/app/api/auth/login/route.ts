// POST /api/auth/login — JWT-based login (replaces Better-Auth)
import { NextRequest, NextResponse } from "next/server";
import { login, setAuthCookie, COOKIE_NAME } from "@/lib/jwt-auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const result = await login(email, password);
    if (!result) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const response = NextResponse.json({
      user: { id: result.payload.userId, email: result.payload.email, name: null },
      role: result.payload.role,
      tenantId: result.payload.tenantId,
      permissions: result.payload.permissions,
    });
    setAuthCookie(response, result.token);
    // Also set tenant cookie
    response.headers.append(
      "Set-Cookie",
      `mini-tenant-id=${result.payload.tenantId}; Path=/; HttpOnly; Max-Age=${60 * 60 * 24 * 30}; SameSite=None; Secure`,
    );
    return response;
  } catch (error) {
    console.error("[LOGIN_ERROR]", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
