// /api/auth/[...all]
// Better-Auth catch-all handler. All auth routes (sign-in, sign-up, sign-out,
// session, etc.) are served from here.

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
