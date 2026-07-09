#!/bin/bash
# ============================================================
# YeneQR — Production Deployment Script
# Server: 37.60.253.124
# User: solomon
# App path: /srv/www/yeneqr.techbee.et/YeneQR
# Domain: https://yeneqr.techbee.et
# Port: 3200
#
# Strategy:
# - Pull latest code
# - Install dependencies
# - Generate Prisma client
# - Sync schema safely
# - Run idempotent seeds
# - Build Next.js standalone
# - Ensure SQLite DB/env are available to standalone runtime
# - Restart PM2 process: yeneqr
# ============================================================

set -e

APP_DIR="/srv/www/yeneqr.techbee.et/YeneQR"
APP_NAME="yeneqr"
APP_URL="https://yeneqr.techbee.et"
APP_PORT="3200"
DB_PATH="$APP_DIR/yeneqr.db"
PROD_DB_URL="file:$DB_PATH"

FORCE_RESET=false
ACCEPT_DATA_LOSS=false
if [[ "$1" == "--force-reset" ]]; then
  FORCE_RESET=true
  echo "⚠️  FORCE RESET MODE — Database will be wiped and re-seeded!"
elif [[ "$1" == "--accept-data-loss" ]]; then
  ACCEPT_DATA_LOSS=true
  echo "⚠️  ACCEPT-DATA-LOSS MODE — Renamed columns will be migrated first, then prisma db push will drop orphaned old columns."
fi

echo "🚀 Starting YeneQR production deployment..."
cd "$APP_DIR"

# Load NVM / Node for solomon
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

echo ""
echo "🔎 Runtime:"
echo "   Node: $(node -v)"
echo "   npm:  $(npm -v)"
echo "   PM2:  $(pm2 -v)"
echo "   App:  $APP_DIR"
echo "   URL:  $APP_URL"
echo "   Port: $APP_PORT"
echo "   DB:   $DB_PATH"

# ── Step 1: Pull latest code ──
echo ""
echo "📥 Step 1/11: Pulling latest code..."
git pull origin main

# CRITICAL: Remove any stale root-level schema.prisma that would override
# prisma/schema.prisma during prisma generate. This has caused multiple
# production issues (missing models, dropped tables, seed failures).
rm -f schema.prisma

# ── Step 2: Ensure production env ──
# IMPORTANT: .env.production is NOT tracked in git (see .gitignore).
# It is generated here from $APP_URL on every deploy so that QR codes,
# payment callbacks, and password reset links always point to this server.
# If you change APP_URL above, redeploy to regenerate env files.
echo ""
echo "🧾 Step 2/11: Writing production env..."
cat > .env <<ENVEOF
# Production environment — used when NODE_ENV=production

NODE_ENV=production
PORT=$APP_PORT
HOSTNAME=0.0.0.0

DATABASE_URL=file:./yeneqr.db

NEXT_PUBLIC_BASE_URL=$APP_URL
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_QR_BASE_URL=$APP_URL
NEXTAUTH_URL=$APP_URL

QR_SECRET=yene-qr-prod-hmac-2024-habesha-continental
JWT_SECRET=yene-qr-prod-jwt-2024-habesha-continental
CRON_SECRET=yene-qr-prod-cron-2024-billing
ENVEOF

cp .env .env.production

# ── Step 3: Ensure PM2 production config ──
echo ""
echo "⚙️  Step 3/11: Writing PM2 production config..."
cat > ecosystem.config.prod.js <<PM2EOF
module.exports = {
  apps: [
    {
      name: '$APP_NAME',
      script: './.next/standalone/server.js',
      cwd: '$APP_DIR',
      env: {
        NODE_ENV: 'production',
        PORT: $APP_PORT,
        HOSTNAME: '0.0.0.0',

        DATABASE_URL: '$PROD_DB_URL',

        NEXTAUTH_URL: '$APP_URL',
        NEXT_PUBLIC_BASE_URL: '$APP_URL',
        NEXT_PUBLIC_APP_URL: '$APP_URL',
        NEXT_PUBLIC_QR_BASE_URL: '$APP_URL',

        QR_SECRET: 'yene-qr-prod-hmac-2024-habesha-continental',
        JWT_SECRET: 'yene-qr-prod-jwt-2024-habesha-continental',
        CRON_SECRET: 'yene-qr-prod-cron-2024-billing'
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
PM2EOF

node -c ecosystem.config.prod.js

# ── Step 4: Install dependencies ──
echo ""
echo "📦 Step 4/11: Installing dependencies..."
npm install --legacy-peer-deps

# ── Step 5: Generate Prisma client ──
echo ""
echo "🔧 Step 5/11: Generating Prisma client..."
export DATABASE_URL="$PROD_DB_URL"
npx prisma generate

# ── Step 6: Verify database exists ──
echo ""
echo "🗄️  Step 6/11: Checking SQLite database..."
if [ ! -f "$DB_PATH" ]; then
  echo "❌ Database file not found: $DB_PATH"
  echo "   Copy production DB first before deploying."
  exit 1
fi

ls -lah "$DB_PATH"

# ── Step 7: Database schema migration ──
# Phase R4: use `prisma db push` (WITHOUT --accept-data-loss) to sync the
# schema from schema.prisma to the production DB.
#
# Why db push (not migrate deploy):
#   The production DB was originally created via `prisma db push` (no
#   _prisma_migrations table). Prisma's `migrate deploy` + `migrate resolve
#   --applied` baselining flow has known bugs on this DB — it claims success
#   but doesn't persist, leaving every deploy broken with P3005/P3008.
#
#   `prisma db push` (no flags) is SAFE for additive changes:
#     - ADDS missing columns (nullable → NULL, with default → default value)
#     - ADDS missing tables (empty)
#     - REFUSES to drop columns/tables (prompts for --accept-data-loss)
#     - NEVER modifies existing data
#
#   The data wipe that happened previously was caused by `--accept-data-loss`
#   or `--force-reset` flags, NOT by plain `db push`. Without those flags,
#   db push is the safest way to sync schema on a DB without migration history.
#
# What this means for the deploy:
#   If schema.prisma has new columns/tables (from recent commits), db push
#   adds them. If the DB already matches schema.prisma, db push is a no-op.
#   If the DB has EXTRA columns not in schema.prisma, db push will refuse
#   to proceed (safe — requires manual intervention).
echo ""
if [ "$FORCE_RESET" = true ]; then
  echo "🗑️  Step 7/11: FORCE RESET — Wiping database..."
  npx prisma migrate reset --force --skip-seed
  node prisma/seed-prod.js
else
  # ── Pre-Step 7a: Drop orphaned columns from previous broken deploys ──
  # Previous deploy attempts (with the broken schema) added "new" columns
  # to the production DB via pre-backfill and migration scripts. The schema
  # has been RESTORED to the original column names, so these "new" columns
  # are now orphans that prisma db push would refuse to drop (interactive
  # prompt that hangs non-interactive deploys).
  #
  # The original data is still in the original columns (splitData, reference,
  # enabled, defaultValue), so dropping the orphaned "new" columns is SAFE.
  echo "🧹 Step 7/11: Dropping orphaned columns from previous broken deploys..."
  node scripts/drop-orphaned-columns.js

  echo ""
  echo "🛠️  Step 7/11: Pre-backfilling required columns for games + customer identification..."
  node -e "
    const { execSync } = require('child_process');
    const dbPath = process.env.DATABASE_URL.replace('file:', '');
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    function columnExists(table, col) {
      const rows = db.prepare('SELECT name FROM pragma_table_info(?)').all(table);
      return rows.some(r => r.name === col);
    }
    function addColumn(table, col, decl) {
      if (columnExists(table, col)) { console.log('   ✓ ' + table + '.' + col + ' already exists'); return; }
      try {
        db.exec('ALTER TABLE \"' + table + '\" ADD COLUMN \"' + col + '\" ' + decl + ';');
        console.log('   ✅ Added ' + table + '.' + col);
      } catch (e) { console.log('   ⚠️  ' + table + '.' + col + ': ' + e.message); }
    }
    // CustomerSession: customerName, customerPhone (nullable, no default needed)
    addColumn('CustomerSession', 'customerName', 'TEXT');
    addColumn('CustomerSession', 'customerPhone', 'TEXT');
    // GameSession: session relation column (no add needed — prisma will create the FK column)
    // GameLeaderboard: dedupKey (NOT NULL with default)
    addColumn('GameLeaderboard', 'dedupKey', 'TEXT NOT NULL DEFAULT \'session:anonymous\'');
    // GameReward: dedupKey, customerPhone, claimedBy, claimNote, expiresAt
    addColumn('GameReward', 'dedupKey', 'TEXT NOT NULL DEFAULT \'session:anonymous\'');
    addColumn('GameReward', 'customerPhone', 'TEXT');
    addColumn('GameReward', 'claimedBy', 'TEXT');
    addColumn('GameReward', 'claimNote', 'TEXT');
    addColumn('GameReward', 'expiresAt', 'DATETIME');
    db.close();
  " 2>/dev/null || echo "   (skipped — better-sqlite3 not available, prisma db push will handle it)"

  echo ""
  echo "🗄️  Step 7/11: Syncing schema (prisma db push — additive only, no data loss)..."
  npx prisma db push --skip-generate 2>&1 || {
    echo ""
    echo "❌ prisma db push FAILED."
    echo ""
    echo "   The DB has columns/tables that are NOT in schema.prisma (schema drift)."
    echo "   db push refuses to drop them without --accept-data-loss."
    echo ""
    echo "   To diagnose:"
    echo "     npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma"
    echo ""
    echo "   If the extra columns are safe to drop, run:"
    echo "     ./deploy.sh --accept-data-loss"
    echo ""
    exit 1
  }
  echo "✅ Schema synced."

  # ── Post-schema: Migrate game leaderboard dedupKeys + merge duplicates ──
  # After schema sync, backfill dedupKey on existing rows + merge leaderboard
  # entries that belong to the same customer (previously keyed by sessionId).
  echo ""
  echo "🔄 Step 7/11: Migrating game leaderboard dedupKeys..."
  node scripts/migrate-game-dedup-keys.js || echo "   ⚠️  Migration script failed (non-critical, can re-run)"
fi

# ── Step 8: Verify critical columns ──
echo ""
echo "🔍 Step 8/11: Verifying critical schema columns..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function verify() {
  try {
    await prisma.restaurantUser.findFirst({ select: { id: true, permissions: true } });
    console.log('   ✅ RestaurantUser.permissions column exists');
  } catch (e) {
    if (e.code === 'P2022') {
      console.log('   ❌ RestaurantUser.permissions column missing. Adding columns...');
      const { execSync } = require('child_process');
      const dbPath = process.env.DATABASE_URL.replace('file:', '');
      const commands = [
        'ALTER TABLE RestaurantUser ADD COLUMN permissions TEXT;',
        'ALTER TABLE RestaurantUser ADD COLUMN additionalPermissions TEXT;',
        'ALTER TABLE RestaurantUser ADD COLUMN revokedPermissions TEXT;'
      ];
      for (const sql of commands) {
        try {
          execSync('sqlite3 \"' + dbPath + '\" \"' + sql + '\"', { stdio: 'inherit' });
        } catch (_) {}
      }
      console.log('   ✅ Column fix attempted');
    } else {
      throw e;
    }
  } finally {
    await prisma.\$disconnect();
  }
}
verify().catch(e => { console.error('Verification error:', e.message); process.exit(1); });
"

# ── Step 9: Run idempotent seeds ──
echo ""
echo "🌱 Step 9/11: Running idempotent seed scripts..."

node prisma/seed-prod.js
node scripts/seed-languages.js

echo "   → Cleaning invalid translation records..."
node -e "
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function cleanup() {
  const all = await prisma.uIString.findMany();
  let fixed = 0;
  for (const s of all) {
    if (s.translations) {
      try { JSON.parse(s.translations); } catch(e) {
        await prisma.uIString.delete({ where: { id: s.id } });
        fixed++;
      }
    }
  }
  console.log('   Cleaned ' + fixed + ' invalid records');
  await prisma.\$disconnect();
}
cleanup().catch(() => process.exit(1));
"

node scripts/seed-i18n-master.js
node scripts/seed-i18n-comprehensive.js
node scripts/seed-i18n-missing.js
node scripts/seed-i18n-landing.js
node scripts/seed-allergens.js || echo "   ⚠️  Allergen seed skipped, non-critical"

# Entertainment content (trivia questions, emoji game config, facts, stories, reads)
# Powers the YeneQR Arena games — Trivia Royale + Emoji Food Guess depend on this
node prisma/seed-entertainment.js 2>/dev/null || node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  // Inline minimal seed if seed-entertainment.js is missing or fails
  const count = await p.entertainmentContent.count({ where: { type: 'trivia_question' } }).catch(() => 0);
  if (count > 0) { console.log('   → Entertainment content already seeded'); return; }
  const trivia = [
    { q: 'What grain is injera made from?', opts: ['Wheat','Teff','Barley','Corn'], correct: 1, explain: 'Teff is a tiny grain native to Ethiopia.' },
    { q: 'What is the national dish of Ethiopia?', opts: ['Pasta','Doro Wot','Sushi','Pizza'], correct: 1, explain: 'Doro Wot is a spicy chicken stew.' },
    { q: 'What is Tej?', opts: ['Beer','Honey wine','Coffee','Tea'], correct: 1, explain: 'Tej is traditional Ethiopian honey wine.' },
    { q: 'Where was coffee discovered?', opts: ['Yemen','Brazil','Ethiopia','Colombia'], correct: 2, explain: 'Coffee was discovered in Kaffa, Ethiopia.' },
    { q: 'How many months in Ethiopian calendar?', opts: ['10','12','13','14'], correct: 2, explain: '13 months — 12 of 30 days + 1 of 5-6 days.' },
  ];
  for (const t of trivia) {
    await p.entertainmentContent.create({ data: {
      id: 'ent-trivia-' + Math.random().toString(36).slice(2,10),
      type: 'trivia_question', category: 'food', title: t.q.slice(0,40),
      content: JSON.stringify(t), isActive: true, sortOrder: 0,
    }}).catch(() => {});
  }
  // Emoji game config
  await p.entertainmentContent.create({ data: {
    id: 'ent-game-emoji-food-quiz',
    type: 'game_config', category: 'food', title: 'Emoji Food Quiz',
    content: JSON.stringify({ enabled: true, difficulty: 'easy', timeLimit: 30, questions: [
      { emojis: '☕🔥🐐', answer: 'Kaldi Coffee Discovery', hint: 'Goats dancing' },
      { emojis: '🍯🍷', answer: 'Tej', hint: 'Honey wine' },
      { emojis: '🌶️🔥🍗', answer: 'Doro Wot', hint: 'Spicy chicken stew' },
      { emojis: '🌾🫓', answer: 'Injera', hint: 'Spongy flatbread' },
    ]}),
    isActive: true, sortOrder: 0,
  }}).catch(() => {});
  console.log('   ✅ Seeded minimal entertainment content (5 trivia + emoji config)');
  await p.\$disconnect();
})();
" || echo "   ⚠️  Entertainment seed skipped, non-critical"

# ── Step 10: Build ──
echo ""
echo "🏗️  Step 10/11: Building application..."
npm run build

echo "📦 Preparing standalone runtime files..."
cp "$DB_PATH" .next/standalone/yeneqr.db
cp .env .next/standalone/.env
cp .env.production .next/standalone/.env.production

# ── Step 11: Restart PM2 ──
echo ""
echo "🔄 Step 11/11: Restarting PM2 app..."

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.prod.js --only "$APP_NAME"
fi

pm2 save

sleep 3

echo ""
pm2 list

if pm2 describe "$APP_NAME" | grep -q "online"; then
  echo ""
  echo "✅ YeneQR deployment complete."
  echo "   URL:  $APP_URL"
  echo "   Port: $APP_PORT"
  echo "   DB:   $DB_PATH"
else
  echo ""
  echo "⚠️  App may not be running. Check:"
  echo "   pm2 logs $APP_NAME --lines 100"
  exit 1
fi
