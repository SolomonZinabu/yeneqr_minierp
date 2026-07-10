"use client";

import { useEffect, useState } from "react";

export interface CurrentUser {
  user: { id: string; email: string; name: string | null };
  role: string;
  permissions: string[];
  tenant: { id: string; name: string; slug: string; currency: string; erpPlanSlug: string };
}

let cached: CurrentUser | null = null;
const subscribers = new Set<(u: CurrentUser | null) => void>();

export function useCurrentUser(): { user: CurrentUser | null; isLoading: boolean; hasPermission: (p: string) => boolean } {
  const [state, setState] = useState<CurrentUser | null>(cached);
  const [isLoading, setIsLoading] = useState(cached === null);

  useEffect(() => {
    let mounted = true;
    subscribers.add((u) => { if (mounted) { setState(u); setIsLoading(false); } });
    if (cached === null) {
      fetch("/api/me").then(r => r.ok ? r.json() : null).then(data => {
        cached = data; subscribers.forEach(cb => cb(data));
      }).catch(() => { subscribers.forEach(cb => cb(null)); });
    }
    return () => { mounted = false; subscribers.delete(() => {}); };
  }, []);

  return { user: state, isLoading, hasPermission: (p: string) => state?.permissions.includes(p) ?? false };
}

export function refreshCurrentUser() {
  cached = null;
  fetch("/api/me").then(r => r.ok ? r.json() : null).then(data => {
    cached = data; subscribers.forEach(cb => cb(data));
  }).catch(() => {});
}
