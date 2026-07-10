"use client";

import { useEffect, useState, useCallback } from "react";

export interface CurrentUser {
  user: { id: string; email: string; name: string | null };
  role: string;
  permissions: string[];
  tenant: { id: string; name: string; slug: string; currency: string; erpPlanSlug: string };
}

export function useCurrentUser(): { user: CurrentUser | null; isLoading: boolean; hasPermission: (p: string) => boolean } {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
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
