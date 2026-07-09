// scripts/start-embedded-postgres.js
// Starts an embedded PostgreSQL 17 instance for local dev.
// Data is persisted in ./.embedded-pg/data so it survives restarts.
//
// Usage:
//   node scripts/start-embedded-postgres.js            # start in foreground
//   node scripts/start-embedded-postgres.js --check    # exit 0 if running, 1 otherwise
//
// This is a development convenience — production uses a managed Postgres.

const EmbeddedPostgres = require("embedded-postgres").default;
const { net } = require("node:net");
const fs = require("node:fs");
const path = require("node:path");

const PORT = parseInt(process.env.PGPORT || "5433", 10);
const DATA_DIR = path.resolve(
  process.env.EMBEDDED_PG_DATA_DIR || "./.embedded-pg/data",
);
const USER = process.env.PGUSER || "postgres";
const PASSWORD = process.env.PGPASSWORD || "postgres";
const DB_NAME = process.env.PGDATABASE || "minierp";

function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = require("node:net").createServer();
    tester.once("error", () => resolve(true));
    tester.once("listening", () => {
      tester.close(() => resolve(false));
    });
    tester.listen(port, "127.0.0.1");
  });
}

async function main() {
  const mode = process.argv[2];

  if (mode === "--check") {
    const inUse = await isPortInUse(PORT);
    if (inUse) {
      console.log(`embedded-postgres: port ${PORT} is in use (assuming running)`);
      process.exit(0);
    }
    console.log(`embedded-postgres: port ${PORT} is free (not running)`);
    process.exit(1);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    port: PORT,
    user: USER,
    password: PASSWORD,
    persistent: true,
  });

  await pg.initialise();
  await pg.start();
  console.log(`embedded-postgres: started on port ${PORT}, data dir: ${DATA_DIR}`);

  // Create the dev DB if it does not exist
  try {
    await pg.createDatabase(DB_NAME, USER);
    console.log(`embedded-postgres: created database "${DB_NAME}"`);
  } catch (err) {
    // ignore "already exists" errors
    if (!String(err?.message || "").includes("already exists")) {
      console.warn("embedded-postgres: createDatabase warning:", err.message);
    }
  }

  console.log(`embedded-postgres: ready — DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB_NAME}?schema=public`);

  // Keep the process alive until SIGINT/SIGTERM
  const shutdown = async (signal) => {
    console.log(`\nembedded-postgres: ${signal} received, stopping...`);
    try {
      await pg.stop();
    } catch (e) {
      console.error("embedded-postgres: error stopping:", e.message);
    }
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("embedded-postgres: fatal:", err);
  process.exit(1);
});
