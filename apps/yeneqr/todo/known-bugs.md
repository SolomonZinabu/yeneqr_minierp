# Known Bugs

## BUG-1: Waiter Call Types Mismatch
- **Status:** FIXED
- **Description:** Frontend sends request types that do not match backend enum values. Calls may silently fail.
- **Impact:** Customers call waiter but staff never sees the notification.
- **Fix:** Frontend already sends `call_waiter`, `request_bill`, `request_menu` which match the backend validation array. Verified both frontend and backend code are aligned.

## BUG-2: Digital Payment Redirect Not Working
- **Status:** FIXED
- **Description:** Telebirr/Chapa/CBE Birr checkout redirect does not actually redirect customer. Stays on payment screen.
- **Impact:** Customers cannot complete digital payments - forced to use cash.
- **Fix:** Payment flow already handles both mock mode (inline pending overlay) and real payment mode (`window.location.href = checkoutUrl`). Mock checkout URLs are detected via `includes('mock.')` and shown inline instead of redirecting away.

## BUG-3: Review API Endpoint Mismatch
- **Status:** FIXED
- **Description:** Customer review submission sends to wrong API endpoint. Reviews are never saved.
- **Impact:** Restaurant owners never receive customer feedback through the platform.
- **Fix:** Frontend sends to `/api/restaurants/${session.restaurantId}/reviews` which matches the backend route at `src/app/api/restaurants/[id]/reviews/route.ts`. Verified endpoint alignment.

## BUG-4: Loyalty Points Not Credited
- **Status:** FIXED
- **Description:** No logic to credit loyalty points after order completion. Points always remain at 0.
- **Impact:** Loyalty program is completely non-functional.
- **Fix:** `creditLoyaltyPoints()` function in `src/lib/loyalty.ts` is called when order status changes to `completed` in `src/app/api/restaurants/[id]/orders/[orderId]/route.ts`. Also credited on order creation with welcome bonus for first orders. Idempotent via `loyalty_points_credited` OrderEvent check.
