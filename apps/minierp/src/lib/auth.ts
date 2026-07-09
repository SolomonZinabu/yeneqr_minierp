// src/lib/auth.ts
// Better-Auth server-side configuration.
//
// - Prisma adapter (PostgreSQL)
// - Email & password auth
// - Organization plugin (used to model tenants in Better-Auth's data model;
//   our application-level multi-tenancy lives in the `Tenant` Prisma model —
//   the organization plugin is here for future SSO / shared-session features
//   and to mirror YeneQR's auth shape).
// - Shared secret with YeneQR for cross-subdomain SSO cookie.

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";

import { db } from "./db";

const secret =
  process.env.BETTER_AUTH_SECRET ??
  "minierp-dev-secret-REPLACE-IN-PROD-32chars-min";
const baseURL =
  process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
const cookieDomain = process.env.COOKIE_DOMAIN ?? "localhost";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  plugins: [organization()],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh session once per day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // cache session for 5 minutes
    },
  },
  secret,
  baseURL,
  advanced: {
    cookies: {
      session_token: {
        attributes: {
          domain: cookieDomain,
          sameSite: "lax",
        },
      },
    },
  },
  user: {
    additionalFields: {
      // Mirror our Prisma User model's custom fields into the Better-Auth user.
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
