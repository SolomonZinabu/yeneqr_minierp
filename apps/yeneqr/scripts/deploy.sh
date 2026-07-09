#!/bin/bash
# ============================================================
# Yene QR — Production Deployment Script
# Run from the project root: bash scripts/deploy.sh
# ============================================================
set -e  # Exit on any error

echo "🚀 YeneQR Deployment Starting..."
echo "================================="
cd "$(dirname "$0")/.."

# ── Step 1: Pull latest code ──
echo ""
echo "📥 Step 1/11: Pulling latest code..."
git pull origin main

# ── Step 2: Install dependencies ──
echo ""
echo "📦 Step 2/11: Installing dependencies..."
npm install --legacy-peer-deps

# ── Step 3: Generate Prisma client ──
echo ""
echo "🔧 Step 3/11: Generating Prisma client..."
npx prisma generate

# ── Step 4: Push schema changes to database ──
echo ""
echo "🗄️  Step 4/11: Pushing schema changes to database..."
# Load DATABASE_URL from .env or .env.production
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep DATABASE_URL | xargs)
fi
if [ -z "$DATABASE_URL" ] && [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | grep DATABASE_URL | xargs)
fi
if [ -z "$DATABASE_URL" ] && [ -f .env.development ]; then
  export $(grep -v '^#' .env.development | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not found in any .env file"
  echo "   Please set DATABASE_URL in .env, .env.production, or .env.development"
  exit 1
fi

echo "   Using DATABASE_URL: ${DATABASE_URL:0:20}..."
npx prisma migrate deploy

# ── Step 5: Build ──
echo ""
echo "🏗️  Step 5/11: Building application..."
npm run build

# ── Step 6: Seed production data (restaurants, users, menus, tables, QR codes, subscriptions) ──
echo ""
echo "🍽️  Step 6/11: Seeding production data (restaurants, users, menus, tables, QR codes)..."
node prisma/seed-prod.js

# ── Step 7: Seed languages ──
echo ""
echo "🌐 Step 7/11: Seeding languages (en, am, om, ti, ar)..."
node scripts/seed-languages.js

# ── Step 8: Seed i18n translations ──
echo ""
echo "🌐 Step 8/11: Seeding i18n translations..."
# First, clean up any UIString records with invalid (non-JSON) translations
echo "   → Cleaning up any invalid translation data..."
node -e "
require('dotenv').config();
if (!process.env.DATABASE_URL) require('dotenv').config({ path: '.env.production' });
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
echo "   → Master keys (all 5 languages)..."
node scripts/seed-i18n-master.js
echo "   → Comprehensive keys (kitchen, waiter, staff)..."
node scripts/seed-i18n-comprehensive.js
echo "   → Missing keys..."
node scripts/seed-i18n-missing.js
echo "   → Landing, Auth, Restaurant keys..."
node scripts/seed-i18n-landing.js

# ── Step 9: Seed allergens and dietary flags ──
echo ""
echo "🧬 Step 9/11: Seeding allergens and dietary flags..."
node scripts/seed-allergens.js || echo "   ⚠️  Allergen seed skipped (non-critical)"

# ── Step 10: Restart the application ──
echo ""
echo "🔄 Step 10/11: Restarting application..."
pm2 restart yeneqr

# ── Step 11: Verify ──
echo ""
echo "✅ Step 11/11: Verifying deployment..."
sleep 3
if pm2 describe yeneqr | grep -q "online"; then
  echo "   ✅ Application is running (PM2 status: online)"
else
  echo "   ⚠️  Application may not be running. Check: pm2 status yeneqr"
fi

echo ""
echo "================================="
echo "🎉 YeneQR Deployment Complete!"
echo "   URL: http://207.180.209.141:4010"
echo ""
echo "🔑 Test accounts (password: admin123):"
echo "   Habesha Owner:   owner@habeshamaebel.com"
echo "   Habesha Waiter:  waiter.bole1@habeshamaebel.com"
echo "   Habesha Kitchen: kitchen.bole1@habeshamaebel.com"
echo "   Continental Owner: owner@thecontinental.et"
echo "================================="
