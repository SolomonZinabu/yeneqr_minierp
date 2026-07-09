// src/hooks/use-current-user.ts
// Client hook: returns the currently authenticated user via Better-Auth.

"use client";

import { useSession } from "@/lib/auth-client";

export function useCurrentUser() {
  const { data: session, isPending, error } = useSession();
  return {
    user: session?.user ?? null,
    session,
    isLoading: isPending,
    error,
  };
}
