-- ============================================================
-- Migration: add_branch_order_routing
-- ============================================================
-- Adds an `orderRouting` column to BranchSettings so each branch
-- can override the restaurant-level order routing mode.
--
-- Values:
--   NULL                  → inherit from Restaurant.settings.kitchen.orderRouting
--   'waiter_first'        → new orders land in 'pending' (waiter/manager accepts before kitchen)
--   'direct_to_kitchen'   → new orders auto-accept to 'accepted' (kitchen starts immediately)
-- ============================================================

-- SQLite: ALTER TABLE ... ADD COLUMN (nullable columns do not need a default)
ALTER TABLE "BranchSettings" ADD COLUMN "orderRouting" TEXT;
