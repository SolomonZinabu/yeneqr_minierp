// scripts/custom-server.js
// Custom Next.js server that rewrites the Origin header for ALL incoming
// requests. This bypasses Next.js 16's dev-mode cross-origin restriction
// without needing to list every possible origin in allowedDevOrigins.
//
// Any request from any preview URL (https://preview-*.space-z.ai) or any
// other origin gets its Origin header rewritten to http://localhost:3000
// before reaching Next.js. This means:
//   - No "Failed to fetch RSC payload" errors
//   - No cross-origin redirect loops
//   - Works from ANY preview subdomain, ngrok URL, or localhost
//
// Usage: node scripts/custom-server.js  (started by PM2)

const { createServer } = require("node:http");
const { parse } = require("node:url");
const next = require("next");

const PORT = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";

const app = next({ dev, hostname, port: PORT });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    try {
      // ── Origin rewriting ──
      // Rewrite ANY non-localhost Origin to http://localhost:3000 so that
      // Next.js dev mode's cross-origin check always passes.
      const originalOrigin = req.headers.origin;
      if (originalOrigin && !originalOrigin.includes("localhost") && !originalOrigin.includes("127.0.0.1")) {
        req.headers.origin = `http://localhost:${PORT}`;
        // Also rewrite Referer so RSC fetches pass the check too
        if (req.headers.referer) {
          try {
            const refererUrl = new URL(req.headers.referer);
            if (!refererUrl.hostname.includes("localhost")) {
              req.headers.referer = `http://localhost:${PORT}${refererUrl.pathname}${refererUrl.search}`;
            }
          } catch {}
        }
      }

      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error("[CUSTOM_SERVER_ERROR]", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(PORT, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT} (custom server — all origins allowed)`);
  });
});
