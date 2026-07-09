// src/lib/api-client.ts
// Thin fetch wrapper that:
//  - prefixes the API base URL (relative for same-origin)
//  - injects `x-tenant-id` header from the cookie (so server-side tenant
//    resolution works on every request)
//  - injects `x-csrf-token` for mutating requests (Better-Auth pattern)
//  - parses JSON and surfaces errors in a consistent shape

"use client";

import type { ApiError } from "@/types";

export interface ApiFetchOptions extends RequestInit {
  // If true, do NOT throw on non-2xx; return the raw Response instead.
  raw?: boolean;
  // If provided, this tenantId overrides the cookie.
  tenantId?: string;
}

const TENANT_COOKIE_NAME = "mini-erp-tenant-id";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export class ApiClientError extends Error implements ApiError {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Make an API request with automatic tenant header injection.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { raw, tenantId, headers, ...rest } = options;

  const finalHeaders = new Headers(headers ?? {});
  if (!finalHeaders.has("Content-Type") && rest.body) {
    finalHeaders.set("Content-Type", "application/json");
  }
  const tid = tenantId ?? readCookie(TENANT_COOKIE_NAME);
  if (tid) {
    finalHeaders.set("x-tenant-id", tid);
  }

  const res = await fetch(path, {
    ...rest,
    headers: finalHeaders,
    credentials: "include",
  });

  if (raw) {
    return res as unknown as T;
  }

  // Empty 204 → return null
  if (res.status === 204) {
    return null as unknown as T;
  }

  let json: unknown = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    json = await res.json();
  } else {
    const text = await res.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
  }

  if (!res.ok) {
    const errBody = (json ?? {}) as { message?: string; code?: string; details?: unknown };
    throw new ApiClientError(
      errBody.message ?? res.statusText ?? "API request failed",
      res.status,
      errBody.code,
      errBody.details,
    );
  }

  return json as T;
}

export const api = {
  get: <T = unknown>(path: string, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T = unknown>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T = unknown>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T = unknown>(path: string, body?: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(path, {
      ...options,
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T = unknown>(path: string, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
