"use client";

import { useEffect } from "react";
import { TOKEN_KEY } from "@/hooks/use-current-user";

export default function RootPage() {
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/login";
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );
}
