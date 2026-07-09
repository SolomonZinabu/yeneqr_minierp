# YeneQR Multi-Branch Audit — Progress Tracker

**Started:** 2026-06-17
**Source audit:** Deep multi-branch audit conducted 2026-06-17 (see chat history)
**Repo:** `/home/z/my-project/YeneQR_token2` → `https://github.com/SolomonZinabu/YeneQR.git`

## Legend
- ⬜ Not started
- 🔄 In progress
- ✅ Done (commit hash)
- ⏭️ Skipped (with reason)

---

## Phase 1 — Stop the bleeding (critical security fixes, must-do before any prod deploy)

| # | Status | Commit | Task |
|---|--------|--------|------|
| 1.1 | ✅ | a018792 | Add `requireAuth` + `requirePerm('restaurant:view')` to `src/app/api/restaurants/[id]/notifications/route.ts` POST (currently no auth at all) |
| 1.2 | ✅ | a018792 | Add `requireAuth` + customer-type check + `auth.branchId === body.branchId && auth.tableId === body.tableId` cross-check to `src/app/api/restaurants/[id]/waiter-calls/route.ts` POST |
| 1.3 | ✅ | a018792 | Add `if (auth.type==='customer' && auth.branchId !== body.branchId) return 403` to `src/app/api/restaurants/[id]/orders/route.ts` POST |
| 1.4 | ✅ | a018792 | Same branch cross-check on `src/app/api/restaurants/[id]/reservations/route.ts` POST |
| 1.5 | ✅ | a018792 | Delete `io.emit('event', event)` line in `src/lib/socket.ts` (cross-tenant broadcast leak) |
| 1.6 | ✅ | a018792 | Add `requirePerm('staff:view')` to GET and `requirePerm('staff:manage')` to POST on `src/app/api/restaurants/[id]/shifts/route.ts` (currently no perm check) |

## Phase 2 — Systematic branch enforcement (3–5 days)

| # | Status | Commit | Task |
|---|--------|--------|------|
| 2.1 | ✅ | ac70ad9 | Add `verifyBranchAccess(auth, requestedBranchId, restaurantId)` helper to `src/lib/api-auth.ts`. Returns null (allow) for platform:manage, owners/managers with multi-branch access, or matching auth.branchId. Returns 403 otherwise. |
| 2.2 | ✅ | ac70ad9 | Add `BRANCH_VIEW_ALL` permission to `src/lib/auth.ts` (granted to owner, manager, super_admin) |
| 2.3 | ✅ | 8feed8f | Roll `resolveBranchScope` out to: orders, tables, qr-codes, staff, reservations, inventory, audit-logs, reviews, refunds, waiter-calls, kitchen-stations, payments, notifications, analytics (14 routes) |
| 2.4 | ✅ | dbf7718 | Fix `tables/bulk/route.ts` PATCH to require `branchId` in body and verify each table belongs to that branch |
| 2.5 | ✅ | dbf7718 | Fix `analytics/route.ts` `computeReviews()` and `voidEvents` queries to apply `effectiveBranchId` filter |
| 2.6 | ✅ | dbf7718 | Add `branchId?` param to all 4 audit-log shorthand helpers (`logRefund`, `logRoleChange`, `logStaffAction`, `logSettingsChange`) and update call sites to pass `auth.branchId` or entity.branchId |
| 2.7 | ✅ | cb62e63 | Add `POST /api/auth/switch-branch` endpoint that re-issues JWT with new branchId after verifying user's StaffAssignment |
| 2.8 | ✅ | 8feed8f | Default `branchId` to `auth.branchId` when param is missing for branch-scoped roles (waiter, kitchen_staff, cashier) on GET routes — **covered by `resolveBranchScope` in Phase 2.3**, which returns `auth.branchId` for branch-scoped roles when the client omits `?branchId=` |

## Phase 3 — Real-time branch scoping (3–5 days)

| # | Status | Commit | Task |
|---|--------|--------|------|
| 3.1 | ✅ | 9c946ab | Add `branchId?` field to `RealtimeEvent` variants in `src/lib/realtime.ts` |
| 3.2 | ✅ | 9c946ab | Emit events on `restaurant:${rid}:branch:${bid}` channel (plus restaurant channel for broadcast events) |
| 3.3 | ✅ | 9c946ab | Update `src/app/api/events/route.ts` to subscribe based on token's `auth.branchId` |
| 3.4 | ✅ | 9c946ab | Add `branchId` to socket room names: `restaurant:${rid}:${bid}`, `kitchen:${rid}:${bid}`, `table:${rid}:${bid}:${tid}` |
| 3.5 | ✅ | 9c946ab | Verify `branchId` against authenticated socket token on room join |
| 3.6 | ✅ | 9c946ab | Thread `branchId` through `notifyXxx` helpers in `src/lib/notifications.ts` (waiter call, order ready, reservations) |
| 3.7 | ✅ | 9c946ab | Add `branchId` to the `notification` realtime event variant and emit it from `sendNotification` |

## Phase 4 — Frontend gaps (1–2 days)

| # | Status | Commit | Task |
|---|--------|--------|------|
| 4.1 | ⏭️ | — | ~~Add `useBranchChange` + `?branchId=` to `menu-view.tsx`~~ **Skipped**: Menu model has no branchId — restaurant-level by design. Documented in Phase 4.5 instead. |
| 4.2 | ⏭️ | — | ~~Add `useBranchChange` + `?branchId=` to `promotions-view.tsx`~~ **Skipped**: Promotion model has no branchId — restaurant-level by design. Documented in Phase 4.5 instead. |
| 4.3 | ✅ | 578960e | Fix `waiter-view.tsx` `fetchOrders`/`fetchCalls` to pass `{ branchId }` |
| 4.4 | ✅ | 578960e | Delete dead code: `src/components/dashboard/header.tsx` (never imported) |
| 4.5 | ✅ | 578960e | Add code comments to `settings-view.tsx`, `localization-view.tsx`, `invoices-view.tsx`, `menu-view.tsx`, `promotions-view.tsx` explaining intentional restaurant-level scoping |

## Phase 5 — Data hygiene (1 day)

| # | Status | Commit | Task |
|---|--------|--------|------|
| 5.1 | ✅ | 6ab59d6 | Backfill `OrderItem.branchId` and `OrderEvent.branchId` from `Order.branchId`, then make required in Prisma schema (script: `scripts/backfill-branch-ids.js`) |
| 5.2 | ✅ | 6ab59d6 | Make `branchId: string` required in `lib/customer-store.ts::CustomerSession` |
| 5.3 | ✅ | 6ab59d6 | Fix legacy `.`-separator QR parsing in `customer-app.tsx` line 4935 to accept `--` separator |
| 5.4 | ✅ | 6ab59d6 | Delete dead `lib/stores/customer-store.ts` (zero imports, superseded by `lib/customer-store.ts`) |
| 5.5 | ✅ | 6ab59d6 | Add comment to `my-reservations.tsx` explaining intentional all-branches fetch (API already supports `?branchId=` filtering) |

---

## ✅ ALL PHASES 1–5 COMPLETE

**Total tasks completed:** 33 (6 in Phase 1 + 8 in Phase 2 + 7 in Phase 3 + 5 in Phase 4 + 5 in Phase 5 + 2 skipped with documentation)

**Total commits:** 8
- `a018792` — Phase 1: Critical security fixes (6 tasks)
- `ac70ad9` — Phase 2.1+2.2: verifyBranchAccess helper + BRANCH_VIEW_ALL permission
- `8feed8f` — Phase 2.3: Roll out resolveBranchScope to 14 routes
- `dbf7718` — Phase 2.4+2.5+2.6: tables/bulk, analytics leaks, audit-log branchId
- `cb62e63` — Phase 2.7: switch-branch endpoint
- `9c946ab` — Phase 3: Real-time branch scoping (7 tasks)
- `578960e` — Phase 4: Frontend gaps (3 tasks + 2 documented as intentional)
- `6ab59d6` — Phase 5: Data hygiene (5 tasks)

## Phase 6 — Industry-standard multi-branch features (based on Toast/Square/Lightspeed research)

Implements the "global + location overrides" pattern that every major restaurant
platform uses. Schema models were added in commit 5f41310; APIs wired up in
subsequent commits.

| # | Status | Commit | Task |
|---|--------|--------|------|
| 6.1 | ✅ | 5f41310 | Add `MenuItemBranchOverride` model (Toast LSP pattern) + admin API (`/items/[itemId]/branch-overrides`) + customer menu applies overrides (price + 86'd items) |
| 6.2 | ✅ | 94b90d7 | Add `PromotionBranchAssignment` model (Toast per-location promotions) + admin API (`/promotions/[promotionId]/branch-assignments`) + validate endpoint respects assignments |
| 6.3 | ✅ | 3a5983f | Add `BranchSettings` model (Toast/Square layered settings) + admin API (`/branches/[branchId]/settings`) — null fields inherit from restaurant |
| 6.4 | ✅ | de8bfc9 | Fix `inventory-watchdog.ts` to be branch-scoped (bug fix — events + notifications now carry branchId) |

---

## ✅ ALL PHASES 1–6 COMPLETE

**Total tasks completed:** 37 (6 + 8 + 7 + 5 + 5 + 4 + 2 documented as intentional)

**Total commits:** 12
- `a018792` — Phase 1: Critical security fixes (6 tasks)
- `ac70ad9` — Phase 2.1+2.2: verifyBranchAccess helper + BRANCH_VIEW_ALL permission
- `8feed8f` — Phase 2.3: Roll out resolveBranchScope to 14 routes
- `dbf7718` — Phase 2.4+2.5+2.6: tables/bulk, analytics leaks, audit-log branchId
- `cb62e63` — Phase 2.7: switch-branch endpoint
- `9c946ab` — Phase 3: Real-time branch scoping (7 tasks)
- `578960e` — Phase 4: Frontend gaps (3 tasks + 2 documented as intentional)
- `6ab59d6` — Phase 5: Data hygiene (5 tasks)
- `de8bfc9` — Phase 6.4: Inventory watchdog branch-scoped (bug fix)
- `5f41310` — Phase 6.1: MenuItemBranchOverride (Toast LSP pattern)
- `94b90d7` — Phase 6.2: PromotionBranchAssignment (Toast per-location promotions)
- `3a5983f` — Phase 6.3: BranchSettings (layered settings pattern)

**Industry patterns implemented** (based on research of Toast, Square, Lightspeed, Clover, Otter):
1. Global menu + location overrides (MenuItemBranchOverride) — Toast LSP, Square per-location pricing
2. Per-branch promotion activation (PromotionBranchAssignment) — Toast, Square
3. Layered settings with inheritance (BranchSettings) — Toast, Square, Lightspeed
4. Per-branch inventory (already correct, watchdog now branch-scoped) — all platforms
5. RBAC with branch:view_all (Phase 2.2) — Toast, Square, Lightspeed
6. Branch-scoped real-time events (Phase 3) — all platforms

## Phase 7 — Frontend UI for Phase 6 features + branch switcher wiring

| # | Status | Commit | Task |
|---|--------|--------|------|
| 7.1 | ✅ | d4d0807 | Branch overrides dialog in menu-view (per-item price + 86'd toggle per branch) |
| 7.2 | ✅ | e2d67df | Promotion branch assignments dialog in promotions-view (assign/promote per branch) |
| 7.3 | ✅ | e2d67df | Branch settings tab in settings-view (override tax/hours/payment per branch) |
| 7.4 | ✅ | e2d67df | Wire dashboard branch switcher to call /api/auth/switch-branch (re-issue JWT) |

---

## ✅ ALL PHASES 1–7 COMPLETE + E2E TESTS PASS

**Total tasks completed:** 41 (6 + 8 + 7 + 5 + 5 + 4 + 4 + 2 documented as intentional)

**Total commits:** 15
- `a018792` — Phase 1: Critical security fixes (6 tasks)
- `ac70ad9` — Phase 2.1+2.2: verifyBranchAccess helper + BRANCH_VIEW_ALL permission
- `8feed8f` — Phase 2.3: Roll out resolveBranchScope to 14 routes
- `dbf7718` — Phase 2.4+2.5+2.6: tables/bulk, analytics leaks, audit-log branchId
- `cb62e63` — Phase 2.7: switch-branch endpoint
- `9c946ab` — Phase 3: Real-time branch scoping (7 tasks)
- `578960e` — Phase 4: Frontend gaps (3 tasks + 2 documented as intentional)
- `6ab59d6` — Phase 5: Data hygiene (5 tasks)
- `de8bfc9` — Phase 6.4: Inventory watchdog branch-scoped (bug fix)
- `5f41310` — Phase 6.1: MenuItemBranchOverride (Toast LSP pattern)
- `94b90d7` — Phase 6.2: PromotionBranchAssignment (Toast per-location promotions)
- `3a5983f` — Phase 6.3: BranchSettings (layered settings pattern)
- `d4d0807` — Phase 7.1: Branch overrides dialog UI
- `e2d67df` — Phase 7.2+7.3+7.4: Promotion assignments UI + branch settings tab + switch-branch wiring
- `e9e7f31` — E2E test suite (48 tests, all pass)

## E2E Test Results (2026-06-17)

**48 tests passed, 0 failed, 0 skipped** 🎉

Run: `bash scripts/e2e-test.sh`

| Test Group | Tests | Result |
|------------|-------|--------|
| 1. Authentication & Login | 4 | ✅ 4/4 |
| 2. Branch Switching (JWT re-issue) | 4 | ✅ 4/4 |
| 3. resolveBranchScope Enforcement | 3 | ✅ 3/3 |
| 4. Critical Auth Bypasses Closed | 4 | ✅ 4/4 |
| 5. Branch Overrides CRUD | 5 | ✅ 5/5 |
| 6. Promotion Branch Assignments | 5 | ✅ 5/5 |
| 7. Branch Settings API | 5 | ✅ 5/5 |
| 8. SSE Branch Filtering | 4 | ✅ 4/4 |
| 9. All 14 Branch-Scoped Routes | 14 | ✅ 14/14 |

---

## Implementation notes

- Each task = 1 commit with conventional commit message
- After Phase 1, push to GitHub and deploy to preview for testing
- After Phase 2.1–2.2 (verifyBranchAccess helper + BRANCH_VIEW_ALL permission), commit before rolling out to routes
- Phase 3 changes are non-breaking if done carefully (events without branchId still flow on restaurant channel)
- Phase 5.1 (schema change) requires `npx prisma db push --accept-data-loss` on prod deploy
