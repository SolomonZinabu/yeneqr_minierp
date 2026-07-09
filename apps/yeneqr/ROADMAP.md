# Yene QR — Unified Implementation Roadmap

> Consolidated from README phases, todo/ phases, and the scalability audit (22 gaps).
> Last updated: June 2026 (updated after multi-branch audit + roadmap verification)

---

## Progress at a Glance

| Category | Total | Done | % |
|----------|-------|------|---|
| Phase 1: Foundation | 14 | 13 | 93% |
| Phase 2: Scalability (Audit Gaps) | 22 | 21 | 95% |
| Phase 3: Competitive Parity | 6 | 6 | 100% |
| Phase 4: Market Differentiation | 6 | 6 | 100% |
| Phase 5: Innovation Leadership | 4 | 4 | 100% |
| Phase 6: i18n Deep Integration | 8 | 2 | 25% |
| Phase 7: Payment Integration | 10 | 0 | 0% |
| Phase 8: PostgreSQL Migration | 9 | 0 | 0% |
| Tech Debt & Quality | 9 | 7 | 78% |
| Known Bugs | 4 | 4 | 100% |
| **TOTAL** | **92** | **62** | **67%** |

---

## Phase 1: Foundation (COMPLETE)

> Goal: Make the app production-safe. Fix all bugs. Add table-stakes features.

### Bug Fixes

| # | Bug | Status | Notes |
|---|-----|--------|-------|
| B1 | Waiter Call Types Mismatch | ✅ Done | Frontend sends `call_waiter`, `request_bill`, `request_menu` matching backend |
| B2 | Digital Payment Redirect Not Working | ✅ Done | Mock mode inline, real mode redirects via `window.location.href` |
| B3 | Review API Endpoint Mismatch | ✅ Done | Frontend sends to `/api/restaurants/${restaurantId}/reviews` |
| B4 | Loyalty Points Not Credited | ✅ Done | `creditLoyaltyPoints()` on order completion with idempotency check |

### Core Features

| # | Feature | Status | Key Files |
|---|---------|--------|-----------|
| 1.1 | Allergen Model + Dietary Filters | ✅ Done | Allergen + MenuItemAllergen models, filter chips on customer menu, warning badges |
| 1.2 | Persistent Customer Accounts + Order History | 🔄 Partial | Customer model, phone-based accounts, order history, "My Orders" tab done. Missing: "Reorder" button on past orders (needs wiring) |
| 1.3 | Digital Receipt + Order Confirmation | ✅ Done | Receipt HTML generator, print-ready, order summary after payment |
| 1.4 | Auto-Hide Unavailable Items + Scheduling | ✅ Done | `isItemCurrentlyAvailable()` in `menu-scheduling.ts`, "Currently Unavailable" badge |
| 1.5 | KDS Enhancement (stations, timers, sound, bump bar) | ✅ Done | Station routing, elapsed timers (green/yellow/red), sound alerts, bump bar |
| 1.6 | Rate Limiting | ✅ Done | `rate-limit.ts` — auth (5/15min), order (10/min), API (100/min), QR session (20/min) |
| 1.7 | Audit Logging Backend | ✅ Done | `audit-log.ts` helpers, integrated into refund, role change, cancellation, settings |
| 1.8 | SSE Event Replay | ✅ Done | `realtime.ts` — event IDs, per-restaurant buffer (100 events, 5-min), `Last-Event-ID` |
| 1.9 | Analytics Pipeline | ✅ Done | `analytics.ts`, cron endpoint, on-the-fly aggregation, triggered on order events |
| 1.10 | Floor Plan Editor | ✅ Done | `floor-plan/floor-manager.tsx`, `floor-dialog.tsx`, `use-floor-editor.ts` hook |

---

## Phase 2: Scalability — Audit Gap Implementation

> Goal: Close gaps that prevent scaling from small to large restaurants.
> Source: Comprehensive functionality audit (22 gaps identified).

### CRITICAL (5/5 Done)

| # | Gap | Status | What Was Implemented |
|---|-----|--------|---------------------|
| 2.1 | Inventory → Menu Availability Linkage | ✅ Done | `inventory-watchdog.ts` with `deductStockForOrder()` + `restoreStockForOrder()`, `quantityRequired` on MenuItemIngredient, stock deduction on order creation + rounds, stock restoration on cancellation, `low_stock_alert` SSE event, inventory→ingredient→menu item propagation |
| 2.2 | Multi-Round Ordering | ✅ Done | `POST /orders/[orderId]/rounds` API, `roundNumber` on OrderItem, "Add More Items" button → "Adding to Order" banner in cart, round badges in KDS + customer order tracking, round separators between items |
| 2.3 | Order Priority / Rush Handling | ✅ Done | `priority` field on Order (normal/rush/vip), `isVip` on Table, auto-VIP from table, priority selector in staff order form, KDS priority sorting + visual badges (VIP purple, RUSH red) |
| 2.4 | Bulk Operations for Menu Management | ✅ Done | `POST /menus/bulk` — import, update_availability, update_prices, delete; `GET /menus/bulk` — JSON export; batch limits (500 import, 1000 updates), per-item error tracking, audit logging |
| 2.5 | Audit Trail UI | ✅ Done | `GET /audit-logs` API (paginated, filterable), `AuditLogsView` dashboard component, color-coded action badges, detail dialog with prev/new data diffs, CSV export, sidebar/router integration |

### HIGH (6/7 Done)

| # | Gap | Status | What Was Implemented |
|---|-----|--------|---------------------|
| 2.6 | Menu Scheduling Enforcement in Customer App | ✅ Done | API returns `currentAvailable`, customer apps already respect it — was working end-to-end |
| 2.7 | Customer Bill Splitting UI | ✅ Done | Split type selector (Equal/Custom/Percentage), proper API payload per type, integrated in payment screen |
| 2.8 | Loyalty Points Redemption | ✅ Done | Points balance display, "Redeem All Points" button, applied discount with remove, integrated with grandTotal |
| 2.9 | Waiter Auto-Assignment / Workload Balancing | ✅ Done | Least-tables+orders algorithm (`getLeastBusyWaiterForTable`), shift-aware workload calculation, auto-assign API, rebalance API, workload visualization with load bars, "Auto-Assign" and "Rebalance Tables" buttons in waiter view, order creation uses least-busy waiter |
| 2.10 | Notification Fatigue Reduction | ✅ Done | Bulk mark-all-read endpoint (1 query instead of N API calls); auto-dismiss read notifications older than 7 days via cron; `?grouped=true` query param returns type counts (e.g., "5 new orders" instead of 5 entries) |
| 2.11 | Customer Session Expiry Handling | ✅ Done | `POST /api/auth/refresh` (token refresh + 30-min grace), `POST /api/cron/sessions` (cleanup cron), session watchdog hook with auto-refresh at 5-min + warning toast at 10-min, amber expiry banner, localStorage cart persistence + restore |
| 2.12 | Shift Management | ✅ Done | Shift + ShiftEntry models, CRUD API for shifts, clock-in/out/break/absent API, ShiftsView dashboard with calendar + stats + staff assignment, shift-aware waiter assignment (priority: shift entries > StaffAssignment), shift-utils.ts helpers |

### MEDIUM (10/10 Done)

| # | Gap | Status | What Was Implemented |
|---|-----|--------|---------------------|
| 2.13 | Language Display Fix (Admin) | ✅ Done | Admin now shows only restaurant-enabled languages, not all 13 platform languages |
| 2.14 | Kitchen Ticket Printing | ✅ Done | `useKitchenTicketPrinter` hook generates 80mm thermal-printer-formatted HTML (no prices, shows modifiers + removed ingredients + special instructions + priority + round badges); print button on KDS header; auto-opens print dialog via `window.print()` |
| 2.15 | Tax Calculation Flexibility | ✅ Done | `isTaxExempt` + `taxRate` fields on MenuItem (null=inherit restaurant rate, 0=exempt, set=override); `calculateOrderTotalsWithPerItemTax()` in money.ts handles per-item tax; migration applied safely |
| 2.16 | 86'd KDS Button | ✅ Done | "86'd" button on KDS item cards — cancels the order item + marks menu item unavailable via API, toast confirmation, optimistic update |
| 2.17 | Bulk Translation Support | ✅ Done | `POST /api/restaurants/[id]/i18n/bulk-translate` — AI-powered batch translation of menu items using z-ai-web-dev-sdk; supports target languages, specific item IDs, overwrite flag; updates nameI18n + descriptionI18n JSON fields |
| 2.18 | Offline UI Indicators | ⏭️ Skipped | Not practical for a SaaS platform — kitchen needs real-time orders, payments need server connectivity, menu data lives in DB. A "connection lost" banner is low value vs. other priorities. |
| 2.19 | Customer Wait Time Estimates | ✅ Done | Order API returns `estimatedWaitMinutes` in meta (based on kitchen load: items ahead × avg prep time / stations + max item prep time); customer app sets `estimatedReadyAt` from response; UI shows "Est. ready in ~X min" countdown |
| 2.20 | Table Merge/Split | ✅ Done | Table merge API (`POST /tables/merge`) — transfers all items from secondary table's order to primary, cancels secondary order, frees secondary table; bill split (check splitting) already existed at `POST /orders/[orderId]/split` |
| 2.21 | Multi-Branch Analytics UI | ✅ Done | `resolveBranchScope` + `effectiveBranchId` filter on all 6+ aggregation queries; `?compare=branches` endpoint computes per-branch revenue/orders/customers; `analytics-view.tsx` passes `selectedBranchId` |
| 2.22 | Review Response Persistence + Export Date Filtering | ✅ Done | `ownerReply` + `ownerReplyAt` fields on Review model; PATCH/DELETE `/reviews/[reviewId]` API for owner replies; export endpoint accepts `?dateFrom=` + `?dateTo=` for orders and revenue types |

---

## Phase 3: Competitive Parity

> Goal: Reach feature parity with Tier 2 competitors so Yene QR is not disqualified in sales conversations.

| # | Feature | Status | Implementation Notes |
|---|---------|--------|---------------------|
| 3.1 | Delivery / Takeaway Ordering | ✅ Done | DeliveryAddress + DeliveryZone models; `POST /delivery/zones` (fee + ETA per zone); `POST /delivery/addresses` (save customer addresses); Order model supports `type: 'delivery'` with `deliveryAddressId`, `deliveryZoneId`, `deliveryFeeCents` fields; migration applied safely |
| 3.2 | Basic Inventory Management | ✅ Done | InventoryItem model, stock deduction/restoration, low-stock alerts, auto-unavailable (done in Gap 2.1) |
| 3.3 | Loyalty / Rewards Program | ✅ Done | 4 tiers + earn logic + redemption UI (existing) + LoyaltyReward catalog model (free_item, discount, free_category types); CRUD API at `/loyalty/rewards`; pointsCost per reward; isActive + sortOrder |
| 3.4 | POS Integration API | ✅ Done | `POSIntegration` model (webhook URL, API key, sync flags for orders/payments/menu); CRUD API at `/integrations`; `dispatchPOSWebhook()` helper sends events to external systems (order.created, payment.received, order.status_changed); 10s timeout per webhook; fire-and-forget (never breaks primary operation) |
| 3.5 | SMS/Email Notifications | ✅ Done | Infrastructure exists in `notifications.ts` (sendSMS for Ethio Telecom/Twilio, sendEmail for SMTP/SendGrid); `notifyNewOrder`, `notifyOrderReady`, `notifyPaymentReceived`, `notifyReservationCreated` helpers wire to SMS/email channels; templates are inline (order number, table, amount); providers configured via env vars (SMS_PROVIDER, EMAIL_PROVIDER) |
| 3.6 | Advanced Search Filters | ✅ Done | Menu items API supports `?priceMin=`, `?priceMax=`, `?q=` (text search on name/nameAm/description), `?sortBy=priceAsc|priceDesc|popular|default`; existing dietary filters retained |

---

## Phase 4: Market Differentiation

> Goal: Build features that no competitor in Africa offers.

| # | Feature | Status | Implementation Notes |
|---|---------|--------|---------------------|
| 4.1 | AI Menu Personalization | ✅ Done | `GET /recommendations?customerId=` — AI-powered "Recommended for You" based on order history; falls back to popularity-based when AI disabled; uses per-restaurant AI config |
| 4.2 | AI Upsells & Cross-Sells | ✅ Done | `GET /upsells?itemIds=` — "Frequently Ordered Together" via co-occurrence analysis of past orders; AI-powered complementary suggestions when available; falls back to popular items |
| 4.3 | CRM Dashboard | ✅ Done | `GET /crm` — customer profiles with LTV, visit frequency, segmentation (new/regular/VIP/at-risk), summary stats; branch-scoped; paginated |
| 4.4 | Menu Engineering / Profitability | ✅ Done | `GET /menu-engineering` — Star/Puzzle/Plowhorse/Dog classification based on popularity vs margin; per-item profit calculation; 30-day rolling window; branch-scoped |
| 4.5 | Dynamic Pricing | ✅ Done | `GET/POST /dynamic-pricing` — happy hour rules, time-based discounts, demand-based pricing via Promotion model with schedule JSON; checks active rules in real-time |
| 4.6 | Waitlist / Queue Management | ✅ Done | `GET/POST/PATCH /waitlist` — walk-in queue with position tracking, estimated wait (15 min/party), customer self-add, seat/cancel/leave transitions, real-time notification on add |

---

## Phase 5: Innovation Leadership

> Goal: Pioneer features no platform globally offers.

| # | Feature | Status | Implementation Notes |
|---|---------|--------|---------------------|
| 5.1 | AI Dynamic Pricing (Advanced) | ✅ Done | Implemented in Phase 4.5 — `GET/POST /dynamic-pricing` with schedule JSON for time-based rules; AI suggestions available via per-restaurant config |
| 5.2 | Predictive Ordering | ✅ Done | `GET /predictive-order?customerId=` — AI predicts likely order from history; falls back to most-frequently-ordered items; uses per-restaurant AI config |
| 5.3 | Social / Group Ordering | ✅ Done | `GET/POST /group-order` — creates a shared order with a 6-char group code; multiple people add items via shareable link; order number = GRP-XXXXXX |
| 5.4 | Self-Service Kiosk Mode | ✅ Done | `GET /kiosk` — single-request endpoint returns restaurant + menus + categories + items + allergens + branches + kiosk config; optimized for full-screen terminal |

---

## Phase 6: i18n Deep Integration

> Goal: Make multi-language support work end-to-end for real users.

| # | Feature | Status | Implementation Notes |
|---|---------|--------|---------------------|
| 6.1 | Customer App Language Switcher → Real API | 🔄 Partial | Customer picker fetches enabled languages from `/api/restaurants/[id]/i18n/languages`; UI string bundle not yet wired into customer app |
| 6.2 | Dashboard Language Switcher → UI Strings | ✅ Done | `useI18n.ts` hook (522 lines) loads bundle via `/api/i18n/ui-strings/bundle` with caching + interpolation + fallback; used in 18 dashboard/landing/auth components |
| 6.3 | AI Translation Job Execution | ⬜ TODO | Integrate OpenAI/DeepL for auto-translation |
| 6.4 | Translation Completion Tracking | ⬜ TODO | Show % complete per language |
| 6.5 | Restaurant-Specific UI String Overrides | ✅ Done | `UIStringOverride` model in schema; `/api/i18n/ui-strings/bundle` route applies overrides before falling back to platform defaults |
| 6.6 | RTL Layout Verification (Arabic) | ⬜ TODO | Test and fix right-to-left layout |
| 6.7 | Missing Translation Indicators | ⬜ TODO | Show fallback language with visual indicator |
| 6.8 | Menu Item Image Per Language | ⬜ TODO | Different images for different locales |

---

## Phase 7: Payment Integration (DO LAST)

> Goal: Connect real Ethiopian payment providers. This is last because we need a fully working platform first.

| # | Feature | Status | Implementation Notes |
|---|---------|--------|---------------------|
| 7.1 | Telebirr API — Real Credentials | ⬜ TODO | Configure merchant credentials, test end-to-end |
| 7.2 | Chapa API — Real Credentials | ⬜ TODO | Configure API key, test end-to-end |
| 7.3 | CBE Birr API — Real Credentials | ⬜ TODO | Configure credentials, test end-to-end |
| 7.4 | Payment Webhook Endpoints | ⬜ TODO | `/api/webhooks/[provider]` for provider callbacks |
| 7.5 | Payment Status Polling | ⬜ TODO | Background job for pending payment verification |
| 7.6 | Payment Timeout Handling | ⬜ TODO | Mark payments as failed after timeout |
| 7.7 | Refund Processing UI | ⬜ TODO | Initiate and track refunds from dashboard |
| 7.8 | Payment Reconciliation Report | ⬜ TODO | Match payments with orders |
| 7.9 | Multiple Payment Methods Per Order | ⬜ TODO | Split payment (cash + digital) |
| 7.10 | Payment Receipt PDF Download | ⬜ TODO | PDF receipt generation |

---

## Phase 8: PostgreSQL Migration (DO LAST)

> Goal: Move from SQLite to PostgreSQL for production scalability.

| # | Feature | Status | Implementation Notes |
|---|---------|--------|---------------------|
| 8.1 | Convert String Enums → PostgreSQL Enums | ⬜ TODO | `prisma/schema.prisma` |
| 8.2 | Convert JSON-as-String → Native JSONB | ⬜ TODO | `prisma/schema.prisma` |
| 8.3 | Create PostgreSQL Migration File | ⬜ TODO | `prisma/migrations/` |
| 8.4 | Add Connection Pooling | ⬜ TODO | pgBouncer or Prisma connection pool |
| 8.5 | Update Docker Compose for PostgreSQL | ⬜ TODO | `docker-compose.yml` |
| 8.6 | Update Seed Script for PostgreSQL | ⬜ TODO | `prisma/seed.js` |
| 8.7 | Data Migration Script (SQLite → PostgreSQL) | ⬜ TODO | Migration script |
| 8.8 | Performance Testing + Query Optimization | ⬜ TODO | All APIs |
| 8.9 | Update Env Templates + Deployment Docs | ⬜ TODO | `.env.production`, README |

---

## Tech Debt & Quality

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| T1 | SQLite in Production | CRITICAL | ⬜ Pending | Must migrate to PostgreSQL before production scale |
| T2 | Mock Payment Providers | HIGH | ⬜ Pending | Need sandbox credentials from Telebirr/Chapa/CBE |
| T3 | Customer Auth — JWT Signed | HIGH | ✅ Done | Signed JWT tokens with 4h expiry via `generateCustomerToken()` |
| T4 | Rate Limiting | HIGH | ✅ Done | In-memory store, applied to auth/order/API/QR/2FA endpoints |
| T5 | Analytics Pipeline Empty | MEDIUM | ✅ Done | Aggregation pipeline + cron + on-the-fly calculation |
| T6 | No Database Migrations | MEDIUM | ✅ Done | Switched from `prisma db push` to `prisma migrate` — baseline migration created, deploy.sh updated to use `migrate deploy`, migration files committed to git |
| T7 | No Automated Tests | MEDIUM | 🔄 Partial | `scripts/e2e-test.sh` — 48-test multi-branch E2E suite (all passing). Still missing: Jest + React Testing Library unit tests |
| T8 | No AuditLog Middleware | MEDIUM | ✅ Done | `audit-log.ts` helpers integrated into sensitive routes |
| T9 | No SSE Event Replay | MEDIUM | ✅ Done | Event IDs + circular buffer + `Last-Event-ID` replay |

---

## Competitor Benchmark

| Feature | Yene QR | GloriaFood | Mr Yum | Sunday | ScanOrder | Restroworks |
|---------|---------|------------|--------|--------|-----------|-------------|
| QR Code Ordering | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-language | ✅ (13) | ❌ | ✅ (3) | ✅ (5) | ✅ (2) | ✅ (20+) |
| Digital Payments | ⚠️ Mock | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kitchen Display | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Floor Plan Editor | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Loyalty Program | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Bill Splitting | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Reservations | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Waiter Call | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Real-time Updates | ✅ SSE | ❌ | ✅ | ✅ | ❌ | ✅ |
| Offline Mode | ⚠️ PWA | ❌ | ❌ | ❌ | ❌ | ✅ |
| Analytics | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Inventory Tracking | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Delivery Integration | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POS Integration | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Multi-branch | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Subscription SaaS | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Allergen Filters | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Combo Meals | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Entertainment | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Competitive advantages:** Floor plan editor, entertainment hub, 13 languages (including Ethiopian), waiter calling, Ethiopian payment providers, inventory→menu linkage.

**Biggest gaps to close:** Real payments, delivery integration, POS integration, offline mode.

---

## How to Update This Tracker

When completing a task:
1. Change `⬜ TODO` to `✅ Done` (or `🔄 Partial`)
2. Add key files or notes in the Notes column
3. Update the Progress at a Glance table numbers
4. Commit with message: `feat(phase-N): description of completed task`

---

## What to Work On Next

**CRITICAL — Do first (would have prevented the Jun 17 production data incident):**
1. T6 — Switch from `prisma db push` to `prisma migrate` (migration files are reviewable, testable, and rollback-safe)

**Immediate priority (Phase 2 remaining HIGH):**
2. Gap 2.10 — Notification Fatigue Reduction (last HIGH-priority Phase 2 item)

**Then (Phase 2 MEDIUM — pick by impact):**
3. Gap 2.16 — 86'd KDS Button (small effort, high kitchen UX impact)
4. Gap 2.19 — Customer Wait Time Estimates (small effort, high customer UX impact)
5. Gap 2.14 — Kitchen Ticket Printing (medium effort, Ethiopian restaurants need thermal printers)
6. Gaps 2.15, 2.17, 2.18, 2.20, 2.22 — remaining medium-priority items

**Then (Phase 3 — competitive parity):**
7. Gap 3.1 — Delivery / Takeaway Ordering (biggest competitive gap)
8. Gap 3.5 — SMS/Email Notifications (order confirmation + ready notifications)
9. Gap 3.4 — POS Integration API
10. Gap 3.6 — Advanced Search Filters

**Then (Phase 7 — payment integration, DO LAST):**
11. Real Telebirr / Chapa / CBE Birr integration (needs sandbox credentials from providers)

---

## Multi-Branch Audit (COMPLETE — June 2026)

A comprehensive 7-phase multi-branch audit was completed in June 2026. All work is committed to `main` and deployed to production. The audit delivered:

- **Phase 1:** 6 critical security fixes (auth bypasses closed, cross-tenant socket leak)
- **Phase 2:** Branch enforcement across 14 routes (`resolveBranchScope` + `verifyBranchAccess` + `BRANCH_VIEW_ALL` permission + `switch-branch` endpoint)
- **Phase 3:** Real-time branch scoping (SSE filtering, socket room branch dimensions, notification branch routing)
- **Phase 4:** Frontend gaps (waiter-view branch fix, dead code cleanup, 5 restaurant-level views documented)
- **Phase 5:** Data hygiene (backfilled OrderItem/OrderEvent.branchId, made required; fixed QR parsing; deleted dead customer store)
- **Phase 6:** Industry-standard features (MenuItemBranchOverride = Toast LSP pattern, PromotionBranchAssignment = per-location promos, BranchSettings = layered settings, inventory watchdog branch-scoped)
- **Phase 7:** Frontend UI (branch overrides dialog, promotion assignments dialog, branch settings tab, switch-branch JWT re-issue wiring)
- **E2E tests:** 48-test suite covering all layers (`scripts/e2e-test.sh`)

See `/home/z/my-project/notes/branch-audit-progress.md` for the full audit tracker (41 tasks, 15 commits).
