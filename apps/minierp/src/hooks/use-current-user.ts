"use client";

import { useEffect, useState } from "react";

export interface CurrentUser {
  user: { id: string; email: string; name: string | null };
  role: string;
  permissions: string[];
  tenant: { id: string; name: string; slug: string; currency: string; erpPlanSlug: string };
}

export function useCurrentUser(): { user: CurrentUser | null; isLoading: boolean; hasPermission: (p: string) => boolean } {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Cookie-based fetch — credentials: include sends the HTTP-only cookie
    fetch("/api/me", { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  return {
    user,
    isLoading,
    hasPermission: (p: string) => user?.permissions.includes(p) ?? false,
  };
}

export function logout() {
  // Clear cookie by calling a logout endpoint or setting expired cookie
  document.cookie = "merp_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=None; Secure";
}
