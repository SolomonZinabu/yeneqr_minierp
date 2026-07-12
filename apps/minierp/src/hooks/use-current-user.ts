"use client";

import { useEffect, useState, useCallback } from "react";

export interface CurrentUser {
  user: { id: string; email: string; name: string | null };
  role: string;
  permissions: string[];
  tenant: { id: string; name: string; slug: string; currency: string; erpPlanSlug: string };
}

const TOKEN_KEY = "merp_token";

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers, credentials: "include" });
}

export function useCurrentUser(): { user: CurrentUser | null; isLoading: boolean; hasPermission: (p: string) => boolean } {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
      if (!token) {
        // No token in localStorage — try cookie-based fetch (credentials: include)
        const res = await fetch("/api/me", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setUser(null);
        }
        setIsLoading(false);
        return;
      }
      // Try Bearer token first
      const res = await fetch("/api/me", {
        headers: { "Authorization": `Bearer ${token}` },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        // Bearer failed — try cookie-only (credentials: include)
        const res2 = await fetch("/api/me", { credentials: "include" });
        if (res2.ok) {
          const data = await res2.json();
          setUser(data);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    isLoading,
    hasPermission: (p: string) => user?.permissions.includes(p) ?? false,
  };
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export { TOKEN_KEY };
