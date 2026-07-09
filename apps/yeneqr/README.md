# Yene QR — Multi-Tenant Restaurant QR Menu Platform

Ethiopia's QR-powered restaurant management platform. Customers scan QR codes to view menus, place orders, and pay — no app download needed. Restaurant owners manage everything from a dashboard.

Built by **Repux Technologies PLC**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, `output: standalone`) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Runtime | Bun |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma ORM |
| Process Manager | PM2 (`yeneqr`) |
| Auth | JWT + HMAC-signed QR sessions (customers) |
| Payments | Telebirr, Chapa, CBE Birr, Cash |
| i18n | 13 languages (Amharic, Oromo, Tigrinya, Somali, Afar, Sidama, Arabic, Italian, Chinese, French, Hindi, Malayalam, English) |

---

## Project Structure

```
/home/z/my-project/
├── prisma/              # Database schema & migrations
├── public/              # Static assets (logo, uploads, manifest)
├── src/
│   ├── app/
│   │   ├── api/         # API routes (auth, restaurants, orders, payments, upload, uat, etc.)
│   │   ├── menu/[payload]/  # Customer QR scan landing page (Next.js route, not hash-based)
│   │   └── page.tsx     # Root page (renders SPA via hash router)
│   ├── components/
│   │   ├── admin/       # Platform admin UI
│   │   ├── customer/    # Customer menu app (Zustand store)
│   │   ├── dashboard/   # Restaurant dashboard UI
│   │   ├── landing/     # Landing page + UAT testing section
│   │   └── ui/          # shadcn/ui primitives
│   ├── hooks/           # React hooks (useI18n, useLanguage, useTranslation, etc.)
│   └── lib/             # Core logic (router, api, qr, db, i18n, store, etc.)
├── db/                  # SQLite database file
├── .next/               # Build output (gitignored)
│   └── standalone/      # Production standalone build (served by PM2)
└── package.json
```

---

## Routing Architecture

The app uses a **hybrid routing** system:

| URL Pattern | Router | Component |
|-------------|--------|-----------|
| `#/` | Hash SPA Router | LandingPage |
| `#/{slug}` | Hash SPA Router | RestaurantLandingPage |
| `#/{slug}/dashboard` | Hash SPA Router | DashboardView |
| `#/admin` | Hash SPA Router | AdminOverviewView |
| `/menu/{payload}` | **Next.js App Router** | CustomerMenuPage |

**Why hybrid?** QR codes generate real URLs that must work without JavaScript hash routing. The `/menu/[payload]` route is a real Next.js dynamic route. All other navigation uses hash routing (`#/`).

---

## Deployment & Build Process

### The Standalone Build Trap

Next.js with `output: 'standalone'` does **NOT** include static assets or the `public/` directory in the standalone output. After every build, you **must** manually copy them:

```bash
# Full rebuild + deploy sequence
npx next build
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
pm2 restart yeneqr
```

**If you skip the copy steps, CSS will break (404) and images/uploads won't load.**

The `npm run build` script already handles this (including backing up uploads), but if you run `npx next build` directly, you must copy manually.

### PM2 Process

```bash
# Common commands
pm2 list                    # Show running processes
pm2 restart yeneqr          # Restart after build
pm2 logs yeneqr             # View logs
pm2 show yeneqr             # Process details
```

### Quick Deploy Cheat Sheet

```bash
cd /home/z/my-project
npm run build
pm2 restart yeneqr
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Prisma database URL | `file:/home/z/my-project/db/yeneqr.db` |
| `NEXT_PUBLIC_BASE_URL` | Public base URL for QR codes | Auto-detected from Host header |
| `QR_SECRET` | HMAC secret for QR payload signing | Required in production |
| `NEXTAUTH_SECRET` | Secret for next-auth sessions | Required in production |
| `UPLOAD_DIR` | File upload directory | `uploads/` in project root |

---

## Git Repository

**Remote:** `https://github.com/SolomonZinabu/YeneQR.git`
**Branch:** `main`

---

## License

Proprietary — Repux Technologies PLC

---

## Implementation Roadmap

The full implementation roadmap — including all phases, progress tracking, competitor benchmarks, and next priorities — is maintained in:

👉 **[ROADMAP.md](./ROADMAP.md)**

This consolidated tracker merges the previous README roadmap (12 phases, 118 items), the `todo/` folder (4 phases, 48 items), and the scalability audit (22 gaps) into a single source of truth.

---

## Build & Deploy Quick Reference

```bash
cd /home/z/my-project

# Build
npm run build

# Restart
pm2 restart yeneqr

# Check status
pm2 list
pm2 logs yeneqr --lines 50

# Database
npx prisma migrate deploy   # Apply pending migrations (safe, no data loss)
npx prisma db seed           # Seed data
npx prisma studio            # GUI database browser

# Git
git add -A && git commit -m "feat: description"
git push origin main
```
