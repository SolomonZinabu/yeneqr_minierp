# Phase 1: Foundation Fixes (4-6 weeks)

**Goal:** Close the most critical table-stakes gaps that currently disqualify Yene QR from serious consideration.
Fix all known bugs. Add rate limiting. Make the platform pilot-ready.

## Critical Bug Fixes (Week 1)

### BUG-1: Waiter Call Types Mismatch
- **Status:** FIXED
- Frontend sends `call_waiter`, `request_bill`, `request_menu` which match backend validation.

### BUG-2: Digital Payment Redirect Not Working
- **Status:** FIXED
- Payment flow handles both mock (inline overlay) and real (window.location.href redirect) modes.

### BUG-3: Review API Endpoint Mismatch
- **Status:** FIXED
- Frontend sends to `/api/restaurants/${restaurantId}/reviews` matching backend route.

### BUG-4: Loyalty Points Not Credited
- **Status:** FIXED
- `creditLoyaltyPoints()` called on order completion with idempotency check. Welcome bonus on first order.

## Feature Gaps (Weeks 2-6)

### T1-1: Allergen Model + Dietary Filters (2 weeks)
- **Status:** DONE
- Allergen + MenuItemAllergen models in schema
- Allergen management in menu item editor
- Dietary filter chips on customer menu (vegan, vegetarian, gluten-free, dairy-free, halal, nut-free)
- Allergen warning badges on item cards
- Customer-facing allergen info on item detail

### T1-2: Persistent Customer Accounts + Order History + Reordering (2 weeks)
- **Status:** PARTIAL
- Customer model has `restaurantId` for multi-tenancy
- Phone-based customer account creation/lookup exists
- Order history stored per customer
- "My Orders" tab in customer app
- Missing: "Reorder" button on past orders, customer preferences

### T1-3: Digital Receipt + Order Confirmation (1 week)
- **Status:** DONE
- Digital receipt HTML generator in customer app
- Order confirmation with details and estimated time
- Print-ready receipt with restaurant branding
- Order summary after successful payment

### T1-5: Auto-Hide Unavailable Items + Time-Based Availability (1 week)
- **Status:** DONE
- `isAvailable` flag checked on menu items API
- Server-side time-based filtering via `isItemCurrentlyAvailable()` in `menu-scheduling.ts`
- "Currently Unavailable" badge with reason
- Availability schedule UI in menu editor (fields exist)

### T2-2: KDS Enhancement (2 weeks)
- **Status:** DONE
- Station-based item routing with section headers
- Elapsed time timers with color coding (green/yellow/red)
- Sound alerts for new orders (configurable toggle)
- Bump bar (Start, Ready, Picked Up)

### Security: Rate Limiting (1 week)
- **Status:** DONE
- Rate limiting middleware in `src/lib/rate-limit.ts`
- Applied to auth (5/15min), order (10/min), API (100/min), QR session (20/min), 2FA (10/5min)
- In-memory store with periodic cleanup

### Security: Audit Logging
- **Status:** DONE
- `src/lib/audit-log.ts` helper module
- Integrated into refund, staff role change, order cancellation, settings update routes
- Fire-and-forget pattern (never blocks primary operations)

### Reliability: SSE Event Replay
- **Status:** DONE
- Event ID tracking with incrementing counter
- Per-restaurant circular buffer (100 events, 5-min retention)
- `Last-Event-ID` header support for replay on reconnect
- SSE `id:` field per spec

### Data: Analytics Pipeline
- **Status:** DONE
- `src/lib/analytics.ts` with aggregation functions
- Cron endpoint at `/api/cron/analytics`
- On-the-fly aggregation for missing dates
- Triggered on order completion/cancellation

## Completion Criteria

- [x] All 4 bugs fixed and verified
- [x] Allergen filters visible and working on customer menu
- [x] Customers can view order history (reorder pending)
- [x] Unavailable items hidden or badged with reason
- [x] KDS has timers, station routing, sound alerts
- [x] Rate limiting active on critical endpoints
- [x] Digital receipt available after payment
- [x] Audit logging for sensitive operations
- [x] SSE event replay on reconnect
- [x] Analytics pipeline populates dashboard data
