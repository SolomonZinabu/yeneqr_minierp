// src/lib/jwt-auth.ts
// Standard JWT auth — token stored in HTTP-only cookie.
// Read by middleware (edge) and API routes (node).
// NO localStorage, NO Bearer headers — just cookies, the standard way.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { dbRaw } from "./db";
import { getEffectivePermissions } from "./permissions";

const JWT_SECRET = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "minierp-dev-secret-change-in-production";
export const COOKIE_NAME = "merp_token";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  type: "staff";
  permissions: string[];
}

export async function hashPassword(password: string): Promise<string> {
  const rounds = process.env.NODE_ENV === "production" ? 12 : 4;
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract token from HTTP-only cookie in a Request.
 * Works in both middleware (edge) and API routes (node).
 */
export function getTokenFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [k, ...v] = c.split("=");
      return [k, v.join("=")];
    }),
  );
  return cookies[COOKIE_NAME] || null;
}

/**
 * Get session from request (cookie-based).
 */
export async function getSession(req: Request): Promise<TokenPayload | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Login: verify credentials, return token + payload.
 * The caller (API route) sets the cookie.
 */
export async function login(email: string, password: string): Promise<{ token: string; payload: TokenPayload } | null> {
  const user = await dbRaw.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return null;

  const account = await (dbRaw as unknown as {
    account: { findFirst: (args: unknown) => Promise<{ password: string | null } | null> };
  }).account.findFirst({ where: { userId: user.id, providerId: "credential" } });
  if (!account?.password) return null;

  const valid = await verifyPassword(password, account.password);
  if (!valid) return null;

  const tenantUser = await dbRaw.tenantUser.findFirst({
    where: { userId: user.id, isPrimary: true },
  });
  let tenantId = tenantUser?.tenantId;
  let fallbackRole = "staff";
  let fallbackPerms: string[] = [];
  if (!tenantId) {
    const anyTU = await dbRaw.tenantUser.findFirst({ where: { userId: user.id } });
    tenantId = anyTU?.tenantId;
    fallbackRole = anyTU?.role ?? "staff";
    fallbackPerms = Array.isArray(anyTU?.permissions)
      ? (anyTU!.permissions as unknown as string[]).filter((p): p is string => typeof p === "string")
      : [];
  }
  if (!tenantId) return null;

  const role = tenantUser?.role ?? fallbackRole;
  const userExtraPerms = tenantUser
    ? (Array.isArray(tenantUser.permissions)
      ? (tenantUser.permissions as unknown as string[]).filter((p): p is string => typeof p === "string")
      : [])
    : fallbackPerms;
  const permissions = Array.from(getEffectivePermissions(role, userExtraPerms));

  const payload: TokenPayload = {
    userId: user.id, email: user.email, role, tenantId, type: "staff", permissions,
  };
  const token = generateToken(payload);
  return { token, payload };
}
