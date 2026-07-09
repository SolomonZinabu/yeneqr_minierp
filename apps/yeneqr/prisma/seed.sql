-- Yene QR — Database Seed Script
-- Run with: sqlite3 db/yeneqr.db < prisma/seed.sql

-- ============================================================
-- Subscription Plans
-- ============================================================

INSERT OR IGNORE INTO SubscriptionPlan (id, name, slug, description, price, yearlyPrice, features, limits, isActive, sortOrder) VALUES
('plan-basic', 'Basic', 'basic', 'Perfect for getting started with QR ordering', 0, 0, '{"qr_codes":true,"cash_payment":true,"basic_analytics":true,"single_branch":true}', '{"maxBranches":1,"maxMenuItems":50,"maxQRCodes":20}', 1, 1),
('plan-pro', 'Pro', 'pro', 'For growing restaurants that need more power', 2000, 20000, '{"qr_codes":true,"all_payments":true,"advanced_analytics":true,"kitchen_display":true,"loyalty":true,"custom_branding":true,"multi_branch":true}', '{"maxBranches":3,"maxMenuItems":500,"maxQRCodes":100}', 1, 2),
('plan-premium', 'Premium', 'premium', 'For restaurant chains and enterprise', 5000, 50000, '{"qr_codes":true,"all_payments":true,"advanced_analytics":true,"kitchen_display":true,"loyalty":true,"custom_branding":true,"unlimited_branches":true,"api_access":true,"white_label":true,"priority_support":true}', '{"maxBranches":-1,"maxMenuItems":-1,"maxQRCodes":-1}', 1, 3);

-- ============================================================
-- Super Admin
-- ============================================================

INSERT OR IGNORE INTO SuperAdmin (id, email, name, password, isActive) VALUES
('sa-1', 'admin@yeneqr.com', 'Platform Admin', '$2a$12$LJ3m4ys3Lg0bZcKP0kOcOe5KGKwDZ8rVn5fBN3Q2xKC6YHJqGfHCe', 1);
-- Password: admin123

-- ============================================================
-- Demo Restaurant: Habesha Restaurant
-- ============================================================

INSERT OR IGNORE INTO Restaurant (id, slug, name, nameAm, description, descriptionAm, cuisineType, phone, email, address, city, taxRate, serviceCharge, currency, defaultLanguage, isActive, isVerified) VALUES
('rest-habesha', 'habesha-restaurant', 'Habesha Restaurant', 'ሐበሻ ሬስቶራንት', 'Authentic Ethiopian cuisine in the heart of Addis Ababa', 'በአዲስ አበባ ልብ ውስጥ እውነተኛ የኢትዮጵያ ምግብ', 'Ethiopian', '+251911234567', 'info@habesha.et', 'Bole Road, Addis Ababa', 'Addis Ababa', 0.15, 0.1, 'ETB', 'en', 1, 1);

INSERT OR IGNORE INTO Branch (id, restaurantId, name, nameAm, address, city, phone, isActive, isMainBranch) VALUES
('branch-habesha-main', 'rest-habesha', 'Bole Branch', 'ቦሌ ቅርንጫፍ', 'Bole Road, Near Edna Mall', 'Addis Ababa', '+251911234568', 1, 1),
('branch-habesha-cm', 'rest-habesha', 'CMC Branch', 'ሲኤምሲ ቅርንጫፍ', 'CMC Roundabout', 'Addis Ababa', '+251911234569', 1, 0);

-- ============================================================
-- Floors & Tables (Bole Branch)
-- ============================================================

INSERT OR IGNORE INTO Floor (id, branchId, name, sortOrder, width, height, walls, obstacles) VALUES
('floor-1', 'branch-habesha-main', 'Ground Floor', 1, 1200, 800, '[{"x1":0,"y1":0,"x2":1200,"y2":0,"thickness":8},{"x1":1200,"y1":0,"x2":1200,"y2":800,"thickness":8},{"x1":1200,"y1":800,"x2":0,"y2":800,"thickness":8},{"x1":0,"y1":800,"x2":0,"y2":0,"thickness":8},{"x1":400,"y1":0,"x2":400,"y2":300,"thickness":6},{"x1":800,"y1":500,"x2":800,"y2":800,"thickness":6}]', '[{"x":500,"y":20,"width":200,"height":60,"type":"bar","label":"Bar"},{"x":20,"y":600,"width":180,"height":80,"type":"kitchen","label":"Kitchen"},{"x":850,"y":550,"width":120,"height":80,"type":"restroom","label":"Restroom"}]'),
('floor-2', 'branch-habesha-main', 'Upper Floor', 2, 1200, 800, '[{"x1":0,"y1":0,"x2":1200,"y2":0,"thickness":8},{"x1":1200,"y1":0,"x2":1200,"y2":800,"thickness":8},{"x1":1200,"y1":800,"x2":0,"y2":800,"thickness":8},{"x1":0,"y1":800,"x2":0,"y2":0,"thickness":8},{"x1":600,"y1":0,"x2":600,"y2":400,"thickness":6}]', '[{"x":700,"y":20,"width":160,"height":60,"type":"lounge","label":"VIP Lounge"}]');

INSERT OR IGNORE INTO "Table" (id, branchId, floorId, number, capacity, status, shape, positionX, positionY, width, height, rotation) VALUES
('t1', 'branch-habesha-main', 'floor-1', '1', 2, 'available', 'round', 100, 100, 70, 70, 0),
('t2', 'branch-habesha-main', 'floor-1', '2', 4, 'available', 'square', 250, 100, 80, 80, 0),
('t3', 'branch-habesha-main', 'floor-1', '3', 4, 'available', 'square', 250, 280, 80, 80, 0),
('t4', 'branch-habesha-main', 'floor-1', '4', 6, 'available', 'rectangle', 450, 400, 120, 80, 0),
('t5', 'branch-habesha-main', 'floor-1', '5', 2, 'occupied', 'round', 100, 400, 70, 70, 0),
('t6', 'branch-habesha-main', 'floor-2', '6', 8, 'available', 'rectangle', 200, 200, 140, 90, 0),
('t7', 'branch-habesha-main', 'floor-2', '7', 4, 'reserved', 'square', 450, 200, 80, 80, 0),
('t8', 'branch-habesha-main', 'floor-2', '8', 2, 'available', 'round', 200, 500, 70, 70, 0),
('t9', 'branch-habesha-main', 'floor-2', '9', 6, 'cleaning', 'rectangle', 850, 200, 120, 80, 0),
('t10', 'branch-habesha-main', 'floor-2', '10', 4, 'available', 'square', 450, 500, 80, 80, 0);

-- ============================================================
-- Kitchen Stations
-- ============================================================

INSERT OR IGNORE INTO KitchenStation (id, branchId, name, type, sortOrder) VALUES
('ks-drinks', 'branch-habesha-main', 'Drinks Station', 'drinks', 1),
('ks-grill', 'branch-habesha-main', 'Grill Station', 'grill', 2),
('ks-general', 'branch-habesha-main', 'Main Kitchen', 'general', 3),
('ks-dessert', 'branch-habesha-main', 'Dessert Station', 'dessert', 4);

-- ============================================================
-- Owner User
-- ============================================================

INSERT OR IGNORE INTO RestaurantUser (id, restaurantId, email, name, password, phone, role, isActive) VALUES
('user-owner', 'rest-habesha', 'owner@habesha.et', 'Abebe Kebede', '$2a$12$LJ3m4ys3Lg0bZcKP0kOcOe5KGKwDZ8rVn5fBN3Q2xKC6YHJqGfHCe', '+251911000001', 'owner', 1),
('user-manager', 'rest-habesha', 'manager@habesha.et', 'Tigist Haile', '$2a$12$LJ3m4ys3Lg0bZcKP0kOcOe5KGKwDZ8rVn5fBN3Q2xKC6YHJqGfHCe', '+251911000002', 'manager', 1),
('user-waiter1', 'rest-habesha', 'waiter1@habesha.et', 'Dawit Amare', '$2a$12$LJ3m4ys3Lg0bZcKP0kOcOe5KGKwDZ8rVn5fBN3Q2xKC6YHJqGfHCe', '+251911000003', 'waiter', 1),
('user-kitchen1', 'rest-habesha', 'kitchen@habesha.et', 'Mulugeta Tadesse', '$2a$12$LJ3m4ys3Lg0bZcKP0kOcOe5KGKwDZ8rVn5fBN3Q2xKC6YHJqGfHCe', '+251911000004', 'kitchen_staff', 1),
('user-cashier1', 'rest-habesha', 'cashier@habesha.et', 'Helen Gebre', '$2a$12$LJ3m4ys3Lg0bZcKP0kOcOe5KGKwDZ8rVn5fBN3Q2xKC6YHJqGfHCe', '+251911000005', 'cashier', 1);
-- All passwords: admin123

-- ============================================================
-- Menu & Categories
-- ============================================================

INSERT OR IGNORE INTO Menu (id, restaurantId, name, nameAm, isActive, sortOrder) VALUES
('menu-main', 'rest-habesha', 'Main Menu', 'ዋና ምናሌ', 1, 1);

INSERT OR IGNORE INTO MenuCategory (id, menuId, restaurantId, name, nameAm, icon, isActive, sortOrder) VALUES
('cat-appetizer', 'menu-main', 'rest-habesha', 'Appetizers', 'መክሰስ', '🥗', 1, 1),
('cat-main', 'menu-main', 'rest-habesha', 'Main Course', 'ዋና ምግብ', '🍲', 1, 2),
('cat-drinks', 'menu-main', 'rest-habesha', 'Drinks', 'መጠጥ', '☕', 1, 3),
('cat-dessert', 'menu-main', 'rest-habesha', 'Desserts', 'ፍሬ', '🍰', 1, 4);

-- ============================================================
-- Menu Items
-- ============================================================

INSERT OR IGNORE INTO MenuItem (id, categoryId, restaurantId, name, nameAm, description, price, preparationTime, isAvailable, isPopular, isVegetarian, isSpicy, availabilityType, sortOrder) VALUES
-- Appetizers
('item-timbale', 'cat-appetizer', 'rest-habesha', 'Timbale', 'ቲምባሌ', 'Crispy pastry with spiced filling', 120, 15, 1, 0, 0, 1, 'always', 1),
('item-sambusa', 'cat-appetizer', 'rest-habesha', 'Sambusa', 'ሳምቡሳ', 'Crispy triangle with lentil filling', 80, 10, 1, 1, 1, 1, 'always', 2),
('item-kitfo-raw', 'cat-appetizer', 'rest-habesha', 'Kitfo (Raw)', 'ክፍቶ', 'Premium raw minced beef with mitmita', 350, 10, 1, 1, 0, 1, 'always', 3),

-- Main Course
('item-doro-wot', 'cat-main', 'rest-habesha', 'Doro Wot', 'ዶሮ ወጥ', 'Slow-cooked chicken stew with berbere spice and hard-boiled egg', 380, 45, 1, 1, 0, 1, 'always', 1),
('item-tibs', 'cat-main', 'rest-habesha', 'Tibs', 'ጥብስ', 'Pan-fried cubed beef with onions, peppers, and rosemary', 320, 20, 1, 1, 0, 0, 'always', 2),
('item-shiro', 'cat-main', 'rest-habesha', 'Shiro', 'ሽሮ', 'Creamy chickpea flour stew with garlic and ginger', 180, 25, 1, 1, 1, 0, 'always', 3),
('item-dulet', 'cat-main', 'rest-habesha', 'Dulet', 'ዱለት', 'Spicy tripe, liver, and lamb mix with peppers', 290, 20, 1, 0, 0, 1, 'always', 4),
('item-firfir', 'cat-main', 'rest-habesha', 'Firfir', 'ፍርፍር', 'Shredded injera with spicy berbere sauce', 200, 15, 1, 0, 1, 1, 'always', 5),

-- Drinks
('item-tedj', 'cat-drinks', 'rest-habesha', 'Tej', 'ጠጀ', 'Traditional Ethiopian honey wine', 150, 5, 1, 1, 1, 0, 'always', 1),
('item-coffee', 'cat-drinks', 'rest-habesha', 'Ethiopian Coffee', 'የኢትዮጵያ ቡና', 'Freshly roasted and brewed Ethiopian coffee ceremony style', 60, 15, 1, 1, 1, 0, 'always', 2),
('item-tella', 'cat-drinks', 'rest-habesha', 'Tella', 'ጠላ', 'Traditional Ethiopian beer from grains', 80, 5, 1, 0, 1, 0, 'always', 3),
('item-mango-juice', 'cat-drinks', 'rest-habesha', 'Mango Juice', 'የማንጎ ጭማቂ', 'Fresh pressed mango juice', 70, 5, 1, 0, 1, 0, 'always', 4),

-- Desserts
('item-honey-bread', 'cat-dessert', 'rest-habesha', 'Honey Bread', 'የማር ዳቦ', 'Traditional sweet bread with Ethiopian honey', 100, 10, 1, 0, 1, 0, 'always', 1),
('item-baklava', 'cat-dessert', 'rest-habesha', 'Baklava', 'ባክላቫ', 'Flaky pastry with nuts and honey syrup', 120, 5, 1, 1, 1, 0, 'always', 2),
('item-icecream', 'cat-dessert', 'rest-habesha', 'Ice Cream', 'አይስ ክሪም', 'Vanilla ice cream with fresh fruits', 90, 5, 1, 0, 1, 0, 'always', 3);

-- ============================================================
-- Modifier Groups
-- ============================================================

INSERT OR IGNORE INTO ModifierGroup (id, menuItemId, name, nameAm, isRequired, selectionType, minSelection, maxSelection, sortOrder) VALUES
('mod-spice-doro', 'item-doro-wot', 'Spice Level', 'ቅመማ መጠን', 1, 'single', 1, 1, 1),
('mod-size-doro', 'item-doro-wot', 'Serving Size', 'መጠን', 0, 'single', 1, 1, 2),
('mod-spice-tibs', 'item-tibs', 'Spice Level', 'ቅመማ መጠን', 1, 'single', 1, 1, 1),
('mod-cooking-tibs', 'item-tibs', 'Cooking Level', 'የማብሰያ ደረጃ', 0, 'single', 1, 1, 2),
('mod-spice-kitfo', 'item-kitfo-raw', 'Spice Level', 'ቅመማ መጠን', 1, 'single', 1, 1, 1),
('mod-coffee-size', 'item-coffee', 'Cup Size', 'የኩብ መጠን', 0, 'single', 1, 1, 1);

INSERT OR IGNORE INTO ModifierOption (id, modifierGroupId, name, nameAm, priceDelta, isDefault, isActive, sortOrder) VALUES
('opt-mild', 'mod-spice-doro', 'Mild', 'ቀለል', 0, 0, 1, 1),
('opt-medium', 'mod-spice-doro', 'Medium', 'መካከለኛ', 0, 1, 1, 2),
('opt-hot', 'mod-spice-doro', 'Hot', 'መᠠጨት', 0, 0, 1, 3),
('opt-small-doro', 'mod-size-doro', 'Small', 'ትንሽ', -50, 0, 1, 1),
('opt-regular-doro', 'mod-size-doro', 'Regular', 'መደበኛ', 0, 1, 1, 2),
('opt-large-doro', 'mod-size-doro', 'Large', 'ትልቅ', 80, 0, 1, 3),
('opt-mild-tibs', 'mod-spice-tibs', 'Mild', 'ቀለል', 0, 0, 1, 1),
('opt-medium-tibs', 'mod-spice-tibs', 'Medium', 'መካከለኛ', 0, 1, 1, 2),
('opt-hot-tibs', 'mod-spice-tibs', 'Hot', 'መᠠጨት', 0, 0, 1, 3),
('opt-rare', 'mod-cooking-tibs', 'Rare', 'ያልተሠራ', 0, 0, 1, 1),
('opt-medium-cook', 'mod-cooking-tibs', 'Medium', 'መካከለኛ', 0, 1, 1, 2),
('opt-well-done', 'mod-cooking-tibs', 'Well Done', 'በደንብ የተጠበሰ', 0, 0, 1, 3),
('opt-mild-kitfo', 'mod-spice-kitfo', 'Mild', 'ቀለል', 0, 0, 1, 1),
('opt-medium-kitfo', 'mod-spice-kitfo', 'Medium', 'መካከለኛ', 0, 1, 1, 2),
('opt-hot-kitfo', 'mod-spice-kitfo', 'Hot / Mitmita', 'ሚጥሚጣ', 0, 0, 1, 3),
('opt-small-coffee', 'mod-coffee-size', 'Small (Macchiato)', 'ትንሽ', 0, 1, 1, 1),
('opt-large-coffee', 'mod-coffee-size', 'Large (Jebena)', 'ጀበና', 40, 0, 1, 2);

-- ============================================================
-- Subscription
-- ============================================================

INSERT OR IGNORE INTO Subscription (id, restaurantId, planId, status, currentPeriodStart, currentPeriodEnd, trialEndsAt) VALUES
('sub-habesha', 'rest-habesha', 'plan-pro', 'trial', '2025-01-01', '2025-02-01', '2025-01-15');

-- ============================================================
-- Feature Flags
-- ============================================================

INSERT OR IGNORE INTO PlatformFeatureFlag (id, key, name, enabled, config) VALUES
('ff-1', 'loyalty_program', 'Loyalty Program', 1, '{"plan":"pro"}'),
('ff-2', 'api_access', 'API Access', 0, '{"plan":"premium"}'),
('ff-3', 'white_label', 'White Label', 0, '{"plan":"premium"}'),
('ff-4', 'multi_station_kds', 'Multi-Station KDS', 1, '{"plan":"pro"}'),
('ff-5', 'happy_hour', 'Happy Hour Promotions', 1, '{"plan":"basic"}');

-- ============================================================
-- Table Reservations (Sample Data)
-- ============================================================

INSERT OR IGNORE INTO TableReservation (id, restaurantId, branchId, tableId, customerName, customerPhone, customerEmail, partySize, reservedDate, reservedTime, duration, status, specialRequests, notes) VALUES
('resv-1', 'rest-habesha', 'branch-main', 't7', 'Sara Tadesse', '+251912345678', 'sara@example.com', 4, '2026-05-30', '19:00', 120, 'confirmed', 'Window seat preferred', NULL),
('resv-2', 'rest-habesha', 'branch-main', 't6', 'Dawit Haile', '+251913456789', NULL, 8, '2026-05-30', '18:30', 180, 'confirmed', 'Birthday celebration — need cake', 'VIP customer'),
('resv-3', 'rest-habesha', 'branch-main', NULL, 'Marta Girma', '+251914567890', 'marta@example.com', 2, '2026-05-31', '20:00', 120, 'pending', NULL, NULL),
('resv-4', 'rest-habesha', 'branch-main', 't2', 'Yohannes Abebe', '+251915678901', NULL, 4, '2026-05-30', '12:00', 90, 'completed', NULL, 'Regular customer'),
('resv-5', 'rest-habesha', 'branch-main', 't3', 'Liya Bekele', '+251916789012', 'liya@example.com', 3, '2026-05-29', '19:30', 120, 'cancelled', 'Allergy to peanuts', NULL),
('resv-6', 'rest-habesha', 'branch-main', NULL, 'Solomon Zinabu', '+251917890123', NULL, 6, '2026-06-01', '18:00', 150, 'pending', 'Business dinner — quiet table', NULL),
('resv-7', 'rest-habesha', 'branch-main', NULL, 'Helen Kasahun', '+251918901234', 'helen@example.com', 2, '2026-05-30', '13:00', 60, 'confirmed', NULL, NULL),
('resv-8', 'rest-habesha', 'branch-main', 't4', 'Abel Meshesha', '+251919012345', NULL, 6, '2026-05-28', '20:00', 120, 'no_show', NULL, 'Did not show up');
