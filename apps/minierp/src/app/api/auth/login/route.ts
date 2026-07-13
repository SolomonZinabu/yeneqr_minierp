// POST /api/auth/login — sets JWT in HTTP-only cookie
import { NextRequest, NextResponse } from "next/server";
import { login, COOKIE_NAME } from "@/lib/jwt-auth";

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
    // Set HTTP-only cookie — standard auth pattern
    const response = NextResponse.json({
      user: { id: result.payload.userId, email: result.payload.email, name: null },
      role: result.payload.role,
      tenantId: result.payload.tenantId,
      permissions: result.payload.permissions,
    });
    response.cookies.set(COOKIE_NAME, result.token, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return response;
  } catch (error) {
    console.error("[LOGIN_ERROR]", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
