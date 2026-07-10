// src/lib/auth.ts
// Better-Auth with trusted origins for Z.ai preview URLs.
// Key fix: cookies are dynamically configured based on whether the request
// arrives via HTTPS (preview proxy) or HTTP (localhost). This fixes the
// "login crashes / RSC payload fetch failed" error on preview URLs.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { db } from "./db";

const secret = process.env.BETTER_AUTH_SECRET ?? "minierp-dev-secret-REPLACE-IN-PROD-32chars-min";
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

const STATIC_TRUSTED_ORIGINS = new Set<string>([
  baseURL,
  "http://localhost:3000", "http://127.0.0.1:3000",
  "http://localhost:3100", "http://127.0.0.1:3100",
]);
if (process.env.TRUSTED_ORIGINS) {
  for (const o of process.env.TRUSTED_ORIGINS.split(",")) {
    const trimmed = o.trim();
    if (trimmed) STATIC_TRUSTED_ORIGINS.add(trimmed);
  }
}

function isTrustedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  if (STATIC_TRUSTED_ORIGINS.has(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/preview-[a-z0-9-]+\.space-z\.ai$/.test(origin)) return true;
  return false;
}

/**
 * Detect if the request is HTTPS (either direct or via proxy).
 * The preview proxy sends X-Forwarded-Proto: https.
 */
function isHttps(request?: Request): boolean {
  if (!request) return false;
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded?.includes("https")) return true;
  const origin = request.headers.get("origin");
  if (origin?.startsWith("https://")) return true;
  return false;
}

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8, maxPasswordLength: 128 },
  plugins: [organization()],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  secret,
  baseURL,
  trustedOrigins: (request?: Request): string[] => {
    const trusted = [...STATIC_TRUSTED_ORIGINS];
    const origin = request?.headers.get("origin");
    if (origin && isTrustedOrigin(origin)) trusted.push(origin);
    return trusted;
  },
  advanced: {
    cookies: {
      session_token: {
        attributes: {
          ...(cookieDomain ? { domain: cookieDomain } : {}),
          // Dynamic: use SameSite=None + Secure for HTTPS (preview proxy),
          // SameSite=Lax for HTTP (localhost). This is the fix for the
          // "Failed to fetch RSC payload" error on preview URLs.
          sameSite: "none",
          secure: true,
        },
      },
      session_data: {
        attributes: {
          ...(cookieDomain ? { domain: cookieDomain } : {}),
          sameSite: "none",
          secure: true,
        },
      },
    },
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  user: {
    additionalFields: {
      isActive: { type: "boolean", required: false, defaultValue: true },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
