// src/middleware.ts
// Next.js middleware — auth check + tenant resolution.
//
// Responsibilities:
//   1. Skip auth for public routes (/api/health, /api/auth/*, /api/tenants/provision,
//      /api/integrations/*, static assets, login & register pages).
//   2. For everything else, look for a Better-Auth session cookie.
//      If missing → redirect to /login.
//   3. Resolve the current tenantId from the `mini-erp-tenant-id` cookie
//      (or the `x-tenant-id` request header). Forward it to downstream
//      handlers as the `x-tenant-id` request header so server-side code
//      can wrap queries in `runWithTenant(...)`.
//
// Note: Better-Auth's `getSessionCookie` only verifies the cookie's
// presence, NOT its cryptographic validity. Full session validation
// happens in the API route handlers via `auth.api.getSession({ headers })`.

import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/health",
  "/api/auth", // Better-Auth handler
  "/api/tenants/provision", // called by YeneQR admin (uses X-Provision-Secret)
  "/api/integrations", // webhook receivers (use API key)
];

const STATIC_PATHS = ["/_next", "/favicon.ico", "/icons", "/fonts"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  if (STATIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Public routes — short-circuit
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // 2) Root → redirect to dashboard (if logged in) or login
  if (pathname === "/") {
    const sessionCookie = getSessionCookie(req);
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 3) Auth check
  const sessionCookie = getSessionCookie(req);
  if (!sessionCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized", message: "Authentication required" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4) Tenant resolution — prefer header (set by client), fall back to cookie
  const tenantIdFromHeader = req.headers.get("x-tenant-id");
  const tenantIdFromCookie = req.cookies.get("mini-tenant-id")?.value;
  const tenantId = tenantIdFromHeader ?? tenantIdFromCookie ?? null;

  // 5) Forward to downstream handlers
  const requestHeaders = new Headers(req.headers);
  if (tenantId) {
    requestHeaders.set("x-tenant-id", tenantId);
  } else {
    requestHeaders.delete("x-tenant-id");
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  // Run middleware on everything except Next internals and static assets.
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon.ico
     * - public assets (anything with a file extension)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
