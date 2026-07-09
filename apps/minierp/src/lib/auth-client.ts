// src/lib/auth-client.ts
// Better-Auth React client — used in 'use client' components.

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { organization } from "better-auth/plugins";

import type { auth } from "./auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "",
  // baseURL defaults to same origin in browser — leave empty for App Router.
  plugins: [
    inferAdditionalFields<typeof auth>(),
    organization(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
