# Technical Debt & Quality Issues

## Critical

### SQLite in Production
- **Severity:** CRITICAL
- **Problem:** SQLite does not support concurrent writes. Under load, orders will fail with database locking errors.
- **Fix:** Migrate to PostgreSQL for production. Prisma supports both; migration is schema-compatible.
- **Status:** PENDING (requires PostgreSQL server setup)

### Mock Payment Providers
- **Severity:** HIGH
- **Problem:** Telebirr, Chapa, CBE Birr all fall back to mock when credentials are not configured.
- **Fix:** Obtain sandbox credentials. Write integration tests. Deploy with real keys.
- **Status:** PENDING (requires provider sandbox access)

### No Authentication on Customer Routes
- **Severity:** HIGH
- **Problem:** Customer sessions use unsigned tokens. Any user can modify orders belonging to other sessions.
- **Fix:** Customer tokens are now JWT-signed via `generateCustomerToken()` in `src/lib/auth.ts`. Session ownership is validated via `getAuthContext()`.
- **Status:** FIXED — Customer sessions use signed JWT tokens with 4h expiry.

### No Rate Limiting
- **Severity:** HIGH
- **Problem:** No rate limiting on any API endpoint. Vulnerable to brute-force and spam.
- **Fix:** Rate limiting implemented in `src/lib/rate-limit.ts` with in-memory store. Applied to auth (5/15min), order (10/min), API (100/min), QR session (20/min), 2FA (10/5min), waiter calls, and review endpoints.
- **Status:** FIXED

## Medium

### Analytics Pipeline Empty
- **Severity:** MEDIUM
- **Problem:** AnalyticsDaily model exists but no cron job populates it. Dashboard shows zero data.
- **Fix:** Created `src/lib/analytics.ts` with aggregation pipeline. Cron endpoint at `/api/cron/analytics`. On-the-fly aggregation for missing dates. Triggered on order completion/cancellation.
- **Status:** FIXED

### No Database Migrations
- **Severity:** MEDIUM
- **Problem:** Using `prisma db push` instead of `prisma migrate`. No migration history, no rollback.
- **Fix:** Switch to `prisma migrate dev` before production deployment.
- **Status:** PENDING (low risk for pilot, must do before production scale)

### No Automated Tests
- **Severity:** MEDIUM
- **Problem:** Zero test files found in codebase.
- **Fix:** Add Jest + React Testing Library. Start with critical paths.
- **Status:** PENDING

### No AuditLog Middleware
- **Severity:** MEDIUM
- **Problem:** AuditLog model exists but no middleware to create entries for sensitive operations.
- **Fix:** Created `src/lib/audit-log.ts` with helper functions (`createAuditLog`, `logRefund`, `logRoleChange`, `logStaffAction`, `logSettingsChange`). Integrated into refund, staff role change, order cancellation, and settings update routes.
- **Status:** FIXED

### No SSE Event Replay
- **Severity:** MEDIUM
- **Problem:** When SSE connection drops, events are lost.
- **Fix:** Added event ID tracking and per-restaurant circular buffer (100 events, 5-min retention) in `src/lib/realtime.ts`. SSE endpoint now supports `Last-Event-ID` header for replay on reconnect. Events include `id:` field per SSE spec.
- **Status:** FIXED

## Low

### Single-Page App Architecture
- **Severity:** LOW
- **Problem:** Hash-based routing with all screens in one file (customer-app.tsx is 2786+ lines). Difficult to maintain and test.
- **Fix:** Refactor into separate route-based components with lazy loading.
- **Status:** PENDING (low priority, functional as-is)

### Float for Money
- **Severity:** LOW
- **Problem:** Prices stored as Float in some places - risk of precision loss.
- **Fix:** Use Int (cents) or Decimal for all money fields. Requires data migration.
- **Status:** PENDING (too risky to change before pilot, all prices round to 2 decimals in calculations)

### Status Fields as String
- **Severity:** LOW
- **Problem:** Order status, payment status, etc. use String instead of enums.
- **Fix:** Convert to Prisma enums for type safety. Requires data migration.
- **Status:** PENDING (too risky to change before pilot, validation already exists in application code)

### Customer Model Missing restaurantId
- **Severity:** LOW
- **Problem:** Customer model has no restaurantId field - multi-tenancy gap.
- **Fix:** Already has `restaurantId` field with `@@unique([restaurantId, phone])` constraint.
- **Status:** FIXED

### Menu Items Time-Based Availability
- **Severity:** LOW
- **Problem:** isAvailable flag exists but no server-side time-based filtering.
- **Fix:** Created `isItemCurrentlyAvailable()` in `src/lib/menu-scheduling.ts` with reason tracking. Menu items API now returns `currentAvailable` and `currentAvailableReason`. Filters by `availableFrom`/`availableTo` time ranges and `availableDays` day-of-week.
- **Status:** FIXED

### KDS Enhancement
- **Severity:** LOW
- **Problem:** Basic kitchen view lacks station routing, timers, sound alerts, bump bar.
- **Fix:** Kitchen view now has: elapsed time timers with color coding (green/yellow/red), sound alerts on new orders, bump bar (Start/Ready/Picked Up), station-based item grouping with section headers.
- **Status:** FIXED
