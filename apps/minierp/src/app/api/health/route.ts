// GET /api/health
// Public health-check endpoint. Returns 200 if the process is alive.
// DB and auth health are not checked here — keep this fast for uptime probes.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "mini-erp",
    timestamp: new Date().toISOString(),
  });
}
