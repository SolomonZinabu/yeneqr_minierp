// src/lib/jwt-auth.ts
// JWT-based auth — matches YeneQR's working pattern.
// Replaces Better-Auth (which caused all the cookie/origin/RSC issues).

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { dbRaw } from "./db";
import { getEffectivePermissions } from "./permissions";

const JWT_SECRET = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || "minierp-dev-secret-change-in-production";
const JWT_EXPIRES_IN = "7d";
const COOKIE_NAME = "merp_token";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  type: "staff";
  permissions: string[];
}

// ── Password hashing ──
export async function hashPassword(password: string): Promise<string> {
  const rounds = process.env.NODE_ENV === "production" ? 12 : 4;
  const salt = await bcrypt.genSalt(rounds);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ── Token generation/verification ──
export function generateToken(payload: Omit<TokenPayload, "permissions"> & { permissions?: string[] }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// ── Cookie helpers (server-side) ──
export function setAuthCookie(response: Response, token: string): void {
  response.headers.set(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Max-Age=${60 * 60 * 24 * 7}; SameSite=None; Secure`,
  );
}

export function getTokenFromRequest(req: Request): string | null {
  // Try cookie first
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [k, ...v] = c.split("=");
      return [k, v.join("=")];
    }),
  );
  if (cookies[COOKIE_NAME]) return cookies[COOKIE_NAME];
  // Try Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.substring(7);
  return null;
}

// ── Session resolution ──
export async function getSession(req: Request): Promise<TokenPayload | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

// ── Login ──
export async function login(email: string, password: string): Promise<{ token: string; payload: TokenPayload } | null> {
  const user = await dbRaw.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return null;

  // Find credential account
  const account = await (dbRaw as unknown as {
    account: { findFirst: (args: unknown) => Promise<{ password: string | null } | null> };
  }).account.findFirst({ where: { userId: user.id, providerId: "credential" } });
  if (!account?.password) return null;

  const valid = await verifyPassword(password, account.password);
  if (!valid) return null;

  // Find primary tenant
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

export { COOKIE_NAME };
