// src/middleware.ts
// Standard Next.js middleware — auth gate.
// Checks for JWT cookie. If missing → redirect to /login.
// Runs on every request except public routes + static assets.

import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/jwt-auth";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/health",
  "/api/tenants/provision",
  "/api/integrations",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Public routes — pass through
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // 2) Static assets — pass through
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // 3) Check JWT cookie
  const token = req.cookies.get(COOKIE_NAME)?.value;
  
  if (!token) {
    // No token — redirect to login (or return 401 for API routes)
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4) Verify token
  const payload = verifyToken(token);
  if (!payload) {
    // Invalid/expired token — clear cookie and redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // 5) Root → redirect to dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 6) Forward tenant ID to downstream handlers
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-id", payload.tenantId);
  requestHeaders.set("x-user-id", payload.userId);
  requestHeaders.set("x-user-role", payload.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
