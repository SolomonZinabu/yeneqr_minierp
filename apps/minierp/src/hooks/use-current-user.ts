"use client";

import { useEffect, useState, useCallback } from "react";

export interface CurrentUser {
  user: { id: string; email: string; name: string | null };
  role: string;
  permissions: string[];
  tenant: { id: string; name: string; slug: string; currency: string; erpPlanSlug: string };
}

const TOKEN_KEY = "merp_token";

// API client that sends Bearer token from localStorage (like YeneQR)
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

export function useCurrentUser(): { user: CurrentUser | null; isLoading: boolean; hasPermission: (p: string) => boolean } {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const res = await fetch("/api/me", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
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
