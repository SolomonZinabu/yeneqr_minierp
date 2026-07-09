# Phase 2: Competitive Parity (6-8 weeks)

**Goal:** Reach feature parity with Tier 2 competitors so Yene QR is no longer disqualified in sales conversations.

## T2-1: Delivery / Takeaway Ordering (3 weeks)
- **Priority:** CRITICAL
- **Problem:** Order type field exists (dine_in, takeaway, scheduled) but no delivery flow, address, or driver tracking
- **Implementation:**
  1. Add DeliveryAddress model to schema
  2. Add delivery zone configuration in restaurant settings
  3. Add delivery address form in customer app
  4. Add delivery fee calculation by zone
  5. Add driver assignment tracking
  6. Add estimated delivery time

## T2-3: Basic Inventory Management (3 weeks)
- **Priority:** CRITICAL
- **Problem:** No inventory model, no stock tracking, no recipe costing, no auto-depletion on orders
- **Implementation:**
  1. Add InventoryItem model (stockLevel, lowStockThreshold, unit)
  2. Link MenuItem to InventoryItem via recipe
  3. Auto-deplete stock on order completion
  4. Show low-stock alerts in dashboard
  5. Auto-mark items unavailable when stock hits 0

## T2-4: Loyalty / Rewards Program (2 weeks)
- **Priority:** HIGH
- **Problem:** loyaltyPoints field on Customer but no earn/redeem logic, no tiers, no rewards catalog
- **Implementation:**
  1. Add LoyaltyTier model (Bronze, Silver, Gold, Platinum)
  2. Add points earn rule (1 point per X birr spent)
  3. Add LoyaltyReward model (free item, discount, etc.)
  4. Add redeem flow in customer app
  5. Show points balance and tier status

## T2-6: POS Integration API (2 weeks)
- **Priority:** HIGH
- **Problem:** No POS integration API, no external system connector
- **Implementation:**
  1. Add Integration model (type, credentials, syncSettings)
  2. Build webhook-based integration framework
  3. Add order sync outbound webhooks
  4. Add menu sync capability
  5. Add data export for accounting

## T2-11: SMS/Email Notifications (1 week)
- **Priority:** MEDIUM
- **Implementation:**
  1. Add notification templates
  2. Integrate email via SendGrid/Resend
  3. Integrate SMS via Twilio or local gateway
  4. Send order confirmation on creation
  5. Send order ready notification

## T1-6: Advanced Search Filters (1 week)
- **Priority:** MEDIUM
- **Depends on:** Allergen data from T1-1
- **Implementation:**
  1. Add price range filter
  2. Add dietary filter (using allergen data)
  3. Add popularity sort (by order count)
  4. Add cuisine type filter
