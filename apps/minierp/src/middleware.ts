// src/middleware.ts
// Standard Next.js middleware — auth gate.
// Only checks if cookie EXISTS (not verifies — that happens in API routes).
// jsonwebtoken can't run in edge runtime, so we just check cookie presence.

import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "merp_token";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/health",
  "/api/me",
  "/api/tenants/provision",
  "/api/integrations",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Public routes — pass through
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // 2) Static assets — pass through
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // 3) Check if auth cookie exists (don't verify — API routes do that)
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4) Root → redirect to dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
