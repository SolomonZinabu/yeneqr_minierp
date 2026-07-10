// POST /api/auth/login — returns JWT token in JSON (client stores in localStorage)
import { NextRequest, NextResponse } from "next/server";
import { login } from "@/lib/jwt-auth";

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
    // Return token in JSON — client stores in localStorage (like YeneQR)
    // Also set cookie as fallback for raw fetch calls that don't send Bearer header
    const response = NextResponse.json({
      token: result.token,
      user: { id: result.payload.userId, email: result.payload.email, name: null },
      role: result.payload.role,
      tenantId: result.payload.tenantId,
      permissions: result.payload.permissions,
    });
    response.headers.set(
      "Set-Cookie",
      `merp_token=${result.token}; Path=/; HttpOnly; Max-Age=604800; SameSite=None; Secure`,
    );
    return response;
  } catch (error) {
    console.error("[LOGIN_ERROR]", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
