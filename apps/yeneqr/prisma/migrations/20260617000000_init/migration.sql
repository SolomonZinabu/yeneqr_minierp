-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" DATETIME,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorBackupCodes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupportAdmin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "yearlyPriceCents" INTEGER,
    "features" TEXT NOT NULL,
    "limits" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlatformFeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT,
    "restaurantId" TEXT,
    "createdBy" TEXT NOT NULL,
    "assignedTo" TEXT,
    "resolution" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "nameI18n" TEXT,
    "description" TEXT,
    "descriptionAm" TEXT,
    "descriptionI18n" TEXT,
    "logo" TEXT,
    "banner" TEXT,
    "cuisineType" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "addressI18n" TEXT,
    "city" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "workingHours" TEXT,
    "taxRate" REAL NOT NULL DEFAULT 0.15,
    "serviceCharge" REAL NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "enabledLanguages" TEXT DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "starPayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "starPayApiUrl" TEXT,
    "starPayApiSecret" TEXT,
    "starPayMerchantId" TEXT,
    "starPayWebhookSecret" TEXT,
    "starPayFeeRate" REAL NOT NULL DEFAULT 0.03
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "nameI18n" TEXT,
    "address" TEXT,
    "addressI18n" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "workingHours" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMainBranch" BOOLEAN NOT NULL DEFAULT false,
    "settings" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Branch_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameI18n" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "width" REAL NOT NULL DEFAULT 1200,
    "height" REAL NOT NULL DEFAULT 800,
    "walls" TEXT,
    "obstacles" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Floor_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "floorId" TEXT,
    "number" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'available',
    "positionX" REAL,
    "positionY" REAL,
    "width" REAL NOT NULL DEFAULT 80,
    "height" REAL NOT NULL DEFAULT 80,
    "rotation" REAL NOT NULL DEFAULT 0,
    "shape" TEXT NOT NULL DEFAULT 'round',
    "menuId" TEXT,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Table_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Table_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Table_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QRCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'static',
    "payload" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" DATETIME,
    "menuId" TEXT,
    "style" TEXT DEFAULT 'classic',
    "fgColor" TEXT DEFAULT '#039D55',
    "bgColor" TEXT DEFAULT '#FFFFFF',
    "logoUrl" TEXT,
    "errorCorrection" TEXT DEFAULT 'H',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QRCode_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QRCode_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QRCode_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RestaurantUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'waiter',
    "permissions" TEXT,
    "additionalPermissions" TEXT,
    "revokedPermissions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" DATETIME,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorBackupCodes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RestaurantUser_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RestaurantUser_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "stationId" TEXT,
    "assignedTables" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RestaurantUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffAssignment_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "KitchenStation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KitchenStation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameI18n" TEXT,
    "type" TEXT NOT NULL DEFAULT 'general',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KitchenStation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "nameI18n" TEXT,
    "description" TEXT,
    "descriptionAm" TEXT,
    "descriptionI18n" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "schedule" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Menu_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "nameI18n" TEXT,
    "description" TEXT,
    "descriptionAm" TEXT,
    "descriptionI18n" TEXT,
    "icon" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuCategory_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "nameI18n" TEXT,
    "description" TEXT,
    "descriptionAm" TEXT,
    "descriptionI18n" TEXT,
    "ingredients" TEXT,
    "ingredientsI18n" TEXT,
    "image" TEXT,
    "images" TEXT,
    "priceCents" INTEGER NOT NULL,
    "originalPriceCents" INTEGER,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "preparationTime" INTEGER NOT NULL DEFAULT 15,
    "calories" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "isSpicy" BOOLEAN NOT NULL DEFAULT false,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "isHalal" BOOLEAN NOT NULL DEFAULT false,
    "isGlutenFree" BOOLEAN NOT NULL DEFAULT false,
    "isDairyFree" BOOLEAN NOT NULL DEFAULT false,
    "showServingSize" BOOLEAN,
    "availabilityType" TEXT NOT NULL DEFAULT 'always',
    "availabilitySchedule" TEXT,
    "availableFrom" TEXT,
    "availableTo" TEXT,
    "availableDays" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItemBranchOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "priceCents" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItemBranchOverride_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuItemBranchOverride_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItemTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItemTranslation_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModifierGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "nameI18n" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "selectionType" TEXT NOT NULL DEFAULT 'single',
    "minSelection" INTEGER NOT NULL DEFAULT 1,
    "maxSelection" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModifierGroup_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModifierOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modifierGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "nameI18n" TEXT,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ModifierOption_modifierGroupId_fkey" FOREIGN KEY ("modifierGroupId") REFERENCES "ModifierGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItemAddon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "addonItemId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItemAddon_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComboItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "includedItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ComboItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "email" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "totalSpentCents" INTEGER NOT NULL DEFAULT 0,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "lastVisitAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "qrCodeId" TEXT,
    "token" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerFavorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerFavorite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerFavorite_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT,
    "sessionId" TEXT,
    "customerId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'dine_in',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxAmountCents" INTEGER NOT NULL DEFAULT 0,
    "serviceChargeCents" INTEGER NOT NULL DEFAULT 0,
    "packagingChargeCents" INTEGER NOT NULL DEFAULT 0,
    "discountAmountCents" INTEGER NOT NULL DEFAULT 0,
    "tipAmountCents" INTEGER NOT NULL DEFAULT 0,
    "totalAmountCents" INTEGER NOT NULL DEFAULT 0,
    "specialInstructions" TEXT,
    "scheduledFor" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "cancelledBy" TEXT,
    "confirmedAt" DATETIME,
    "preparingAt" DATETIME,
    "readyAt" DATETIME,
    "servedAt" DATETIME,
    "paidAt" DATETIME,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "waiterId" TEXT,
    "pickedUpBy" TEXT,
    "tableNumber" TEXT,
    "promotionId" TEXT,
    "promotionCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CustomerSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "RestaurantUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "nameI18n" TEXT,
    "priceCents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "specialInstructions" TEXT,
    "removedIngredients" TEXT,
    "kitchenStatus" TEXT NOT NULL DEFAULT 'pending',
    "kitchenStationId" TEXT,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "preparationStartedAt" DATETIME,
    "preparationCompletedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItemModifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "modifierGroupId" TEXT NOT NULL,
    "modifierOptionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "OrderItemModifier_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "data" TEXT,
    "performedBy" TEXT,
    "performedByType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillSplit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "splitType" TEXT NOT NULL DEFAULT 'equal',
    "totalAmountCents" INTEGER NOT NULL,
    "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "splitData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillSplit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "billSplitId" TEXT,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "tipAmountCents" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT,
    "providerResponse" TEXT,
    "receiptUrl" TEXT,
    "paidAt" DATETIME,
    "failedAt" DATETIME,
    "refundedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "starpayOrderId" TEXT,
    "starpayPaymentUrl" TEXT,
    "starpayBillRefNo" TEXT,
    "starpayPaymentType" TEXT,
    "starpayCustomerId" TEXT,
    "callbackVerified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_billSplitId_fkey" FOREIGN KEY ("billSplitId") REFERENCES "BillSplit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedBy" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Refund_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformFeeLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT,
    "transactionAmountCents" INTEGER NOT NULL,
    "feeRate" REAL NOT NULL,
    "feeAmountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unbilled',
    "invoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformFeeLedger_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlatformFeeLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlatformFeeLedger_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PlatformFeeInvoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformFeeInvoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "totalFeeCents" INTEGER NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlatformFeeInvoice_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "nameI18n" TEXT,
    "description" TEXT,
    "descriptionAm" TEXT,
    "descriptionI18n" TEXT,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValueCents" INTEGER NOT NULL,
    "minimumOrderCents" INTEGER NOT NULL DEFAULT 0,
    "maxDiscountCents" INTEGER,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "perCustomerLimit" INTEGER,
    "applicableItems" TEXT,
    "schedule" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Promotion_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromotionBranchAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promotionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PromotionBranchAssignment_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromotionBranchAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'trial',
    "currentPeriodStart" DATETIME NOT NULL,
    "currentPeriodEnd" DATETIME NOT NULL,
    "trialEndsAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "invoiceNumber" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'in_app',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
    "deliveredAt" DATETIME,
    "failedAt" DATETIME,
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalyticsDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "date" DATETIME NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenueCents" INTEGER NOT NULL DEFAULT 0,
    "totalTaxCents" INTEGER NOT NULL DEFAULT 0,
    "totalTipsCents" INTEGER NOT NULL DEFAULT 0,
    "avgOrderValueCents" INTEGER NOT NULL DEFAULT 0,
    "uniqueCustomers" INTEGER NOT NULL DEFAULT 0,
    "repeatCustomers" INTEGER NOT NULL DEFAULT 0,
    "cancelledOrders" INTEGER NOT NULL DEFAULT 0,
    "avgPrepTime" REAL NOT NULL DEFAULT 0,
    "tableTurnover" REAL NOT NULL DEFAULT 0,
    "topItems" TEXT,
    "peakHours" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnalyticsDaily_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TableReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "partySize" INTEGER NOT NULL,
    "reservedDate" DATETIME NOT NULL,
    "reservedTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 120,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "specialRequests" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TableReservation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TableReservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TableReservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaiterCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "sessionId" TEXT,
    "requestType" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WaiterCall_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WaiterCall_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WaiterCall_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLocal" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'ltr',
    "fontFamily" TEXT,
    "flagEmoji" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RestaurantLanguage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RestaurantLanguage_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RestaurantLanguage_languageCode_fkey" FOREIGN KEY ("languageCode") REFERENCES "Language" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UIString" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "description" TEXT,
    "defaultValue" TEXT NOT NULL,
    "translations" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UIStringOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "uiStringKey" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UIStringOverride_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UIStringOverride_uiStringKey_fkey" FOREIGN KEY ("uiStringKey") REFERENCES "UIString" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranslationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityIds" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "errorDetails" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "providerJobId" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TranslationJob_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TranslationJob_targetLanguage_fkey" FOREIGN KEY ("targetLanguage") REFERENCES "Language" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranslationStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "totalFields" INTEGER NOT NULL DEFAULT 0,
    "translatedFields" INTEGER NOT NULL DEFAULT 0,
    "verifiedFields" INTEGER NOT NULL DEFAULT 0,
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TranslationStat_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TranslationStat_languageCode_fkey" FOREIGN KEY ("languageCode") REFERENCES "Language" ("code") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RestaurantUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "currentStock" REAL NOT NULL DEFAULT 0,
    "minimumStock" REAL NOT NULL DEFAULT 0,
    "costPerUnit" REAL NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "lastRestocked" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAm" TEXT,
    "nameI18n" TEXT,
    "allergens" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "inventoryItemId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ingredient_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ingredient_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MenuItemIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "isRemovable" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "portion" TEXT,
    "quantityRequired" REAL NOT NULL DEFAULT 1,
    "extraPrice" REAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MenuItemIngredient_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuItemIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIAgentConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customName" TEXT,
    "customGreeting" TEXT,
    "customIcon" TEXT,
    "customColor" TEXT,
    "customInstructions" TEXT,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "maxToolIterations" INTEGER NOT NULL DEFAULT 5,
    "enabledTools" TEXT,
    "disabledTools" TEXT,
    "suggestionCategories" TEXT,
    "autoSuggest" BOOLEAN NOT NULL DEFAULT false,
    "autoSuggestInterval" INTEGER NOT NULL DEFAULT 60,
    "maxTokens" INTEGER NOT NULL DEFAULT 2048,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AIAgentConfig_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "agentType" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "context" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AIConversation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AIConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RestaurantUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AIConversation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CustomerSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIConversationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCallId" TEXT,
    "toolName" TEXT,
    "toolArguments" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "parameters" TEXT,
    "result" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBy" TEXT,
    "confirmedAt" DATETIME,
    "executedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIActionLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AISuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "data" TEXT,
    "actionType" TEXT,
    "actionParams" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dismissedReason" TEXT,
    "validUntil" DATETIME,
    "acceptedBy" TEXT,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AISuggestion_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Allergen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MenuItemAllergen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuItemId" TEXT NOT NULL,
    "allergenId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MenuItemAllergen_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MenuItemAllergen_allergenId_fkey" FOREIGN KEY ("allergenId") REFERENCES "Allergen" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "userType" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "previousData" TEXT,
    "newData" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Shift_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "clockInTime" DATETIME,
    "clockOutTime" DATETIME,
    "breakStart" DATETIME,
    "breakEnd" DATETIME,
    "notes" TEXT,
    "stationId" TEXT,
    "assignedTables" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShiftEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "RestaurantUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftEntry_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftEntry_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "KitchenStation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BranchSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "workingHours" TEXT,
    "taxRate" REAL,
    "serviceCharge" REAL,
    "acceptedPaymentMethods" TEXT,
    "orderTypes" TEXT,
    "posPrinterId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BranchSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_email_key" ON "SuperAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SupportAdmin_email_key" ON "SupportAdmin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_slug_key" ON "SubscriptionPlan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFeatureFlag_key_key" ON "PlatformFeatureFlag"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "Branch_restaurantId_idx" ON "Branch"("restaurantId");

-- CreateIndex
CREATE INDEX "Floor_branchId_idx" ON "Floor"("branchId");

-- CreateIndex
CREATE INDEX "Table_branchId_idx" ON "Table"("branchId");

-- CreateIndex
CREATE INDEX "Table_menuId_idx" ON "Table"("menuId");

-- CreateIndex
CREATE INDEX "Table_status_idx" ON "Table"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QRCode_tableId_key" ON "QRCode"("tableId");

-- CreateIndex
CREATE INDEX "QRCode_restaurantId_idx" ON "QRCode"("restaurantId");

-- CreateIndex
CREATE INDEX "QRCode_branchId_idx" ON "QRCode"("branchId");

-- CreateIndex
CREATE INDEX "QRCode_type_idx" ON "QRCode"("type");

-- CreateIndex
CREATE INDEX "RestaurantUser_restaurantId_idx" ON "RestaurantUser"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantUser_role_idx" ON "RestaurantUser"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantUser_restaurantId_email_key" ON "RestaurantUser"("restaurantId", "email");

-- CreateIndex
CREATE INDEX "StaffAssignment_userId_idx" ON "StaffAssignment"("userId");

-- CreateIndex
CREATE INDEX "StaffAssignment_branchId_idx" ON "StaffAssignment"("branchId");

-- CreateIndex
CREATE INDEX "StaffAssignment_restaurantId_idx" ON "StaffAssignment"("restaurantId");

-- CreateIndex
CREATE INDEX "KitchenStation_branchId_idx" ON "KitchenStation"("branchId");

-- CreateIndex
CREATE INDEX "Menu_restaurantId_idx" ON "Menu"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuCategory_menuId_idx" ON "MenuCategory"("menuId");

-- CreateIndex
CREATE INDEX "MenuCategory_restaurantId_idx" ON "MenuCategory"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuItem_isAvailable_idx" ON "MenuItem"("isAvailable");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_isAvailable_idx" ON "MenuItem"("restaurantId", "isAvailable");

-- CreateIndex
CREATE INDEX "MenuItemBranchOverride_branchId_idx" ON "MenuItemBranchOverride"("branchId");

-- CreateIndex
CREATE INDEX "MenuItemBranchOverride_menuItemId_idx" ON "MenuItemBranchOverride"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemBranchOverride_menuItemId_branchId_key" ON "MenuItemBranchOverride"("menuItemId", "branchId");

-- CreateIndex
CREATE INDEX "MenuItemTranslation_menuItemId_idx" ON "MenuItemTranslation"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemTranslation_menuItemId_language_key" ON "MenuItemTranslation"("menuItemId", "language");

-- CreateIndex
CREATE INDEX "ModifierGroup_menuItemId_idx" ON "ModifierGroup"("menuItemId");

-- CreateIndex
CREATE INDEX "ModifierOption_modifierGroupId_idx" ON "ModifierOption"("modifierGroupId");

-- CreateIndex
CREATE INDEX "MenuItemAddon_menuItemId_idx" ON "MenuItemAddon"("menuItemId");

-- CreateIndex
CREATE INDEX "ComboItem_menuItemId_idx" ON "ComboItem"("menuItemId");

-- CreateIndex
CREATE INDEX "Customer_restaurantId_idx" ON "Customer"("restaurantId");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_restaurantId_phone_key" ON "Customer"("restaurantId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSession_token_key" ON "CustomerSession"("token");

-- CreateIndex
CREATE INDEX "CustomerSession_restaurantId_idx" ON "CustomerSession"("restaurantId");

-- CreateIndex
CREATE INDEX "CustomerSession_tableId_idx" ON "CustomerSession"("tableId");

-- CreateIndex
CREATE INDEX "CustomerSession_token_idx" ON "CustomerSession"("token");

-- CreateIndex
CREATE INDEX "CustomerSession_isActive_idx" ON "CustomerSession"("isActive");

-- CreateIndex
CREATE INDEX "CustomerFavorite_restaurantId_idx" ON "CustomerFavorite"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerFavorite_customerId_menuItemId_key" ON "CustomerFavorite"("customerId", "menuItemId");

-- CreateIndex
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");

-- CreateIndex
CREATE INDEX "Order_branchId_idx" ON "Order"("branchId");

-- CreateIndex
CREATE INDEX "Order_tableId_idx" ON "Order"("tableId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_restaurantId_status_idx" ON "Order"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_type_idx" ON "Order"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_orderNumber_key" ON "Order"("restaurantId", "orderNumber");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_branchId_idx" ON "OrderItem"("branchId");

-- CreateIndex
CREATE INDEX "OrderItem_kitchenStatus_idx" ON "OrderItem"("kitchenStatus");

-- CreateIndex
CREATE INDEX "OrderItem_branchId_kitchenStatus_idx" ON "OrderItem"("branchId", "kitchenStatus");

-- CreateIndex
CREATE INDEX "OrderItem_restaurantId_idx" ON "OrderItem"("restaurantId");

-- CreateIndex
CREATE INDEX "OrderItemModifier_orderItemId_idx" ON "OrderItemModifier"("orderItemId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

-- CreateIndex
CREATE INDEX "OrderEvent_branchId_idx" ON "OrderEvent"("branchId");

-- CreateIndex
CREATE INDEX "OrderEvent_createdAt_idx" ON "OrderEvent"("createdAt");

-- CreateIndex
CREATE INDEX "OrderEvent_restaurantId_idx" ON "OrderEvent"("restaurantId");

-- CreateIndex
CREATE INDEX "BillSplit_orderId_idx" ON "BillSplit"("orderId");

-- CreateIndex
CREATE INDEX "BillSplit_restaurantId_idx" ON "BillSplit"("restaurantId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_restaurantId_idx" ON "Payment"("restaurantId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_branchId_idx" ON "Payment"("branchId");

-- CreateIndex
CREATE INDEX "Payment_restaurantId_createdAt_idx" ON "Payment"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_starpayOrderId_idx" ON "Payment"("starpayOrderId");

-- CreateIndex
CREATE INDEX "Payment_starpayBillRefNo_idx" ON "Payment"("starpayBillRefNo");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_restaurantId_idx" ON "Refund"("restaurantId");

-- CreateIndex
CREATE INDEX "Refund_branchId_idx" ON "Refund"("branchId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFeeLedger_paymentId_key" ON "PlatformFeeLedger"("paymentId");

-- CreateIndex
CREATE INDEX "PlatformFeeLedger_restaurantId_idx" ON "PlatformFeeLedger"("restaurantId");

-- CreateIndex
CREATE INDEX "PlatformFeeLedger_status_idx" ON "PlatformFeeLedger"("status");

-- CreateIndex
CREATE INDEX "PlatformFeeLedger_restaurantId_status_idx" ON "PlatformFeeLedger"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "PlatformFeeLedger_createdAt_idx" ON "PlatformFeeLedger"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformFeeLedger_orderId_idx" ON "PlatformFeeLedger"("orderId");

-- CreateIndex
CREATE INDEX "PlatformFeeLedger_branchId_idx" ON "PlatformFeeLedger"("branchId");

-- CreateIndex
CREATE INDEX "PlatformFeeInvoice_restaurantId_idx" ON "PlatformFeeInvoice"("restaurantId");

-- CreateIndex
CREATE INDEX "PlatformFeeInvoice_status_idx" ON "PlatformFeeInvoice"("status");

-- CreateIndex
CREATE INDEX "PlatformFeeInvoice_dueDate_idx" ON "PlatformFeeInvoice"("dueDate");

-- CreateIndex
CREATE INDEX "PlatformFeeInvoice_restaurantId_status_idx" ON "PlatformFeeInvoice"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "Review_orderId_idx" ON "Review"("orderId");

-- CreateIndex
CREATE INDEX "Review_restaurantId_idx" ON "Review"("restaurantId");

-- CreateIndex
CREATE INDEX "Review_branchId_idx" ON "Review"("branchId");

-- CreateIndex
CREATE INDEX "Review_customerId_idx" ON "Review"("customerId");

-- CreateIndex
CREATE INDEX "Promotion_restaurantId_idx" ON "Promotion"("restaurantId");

-- CreateIndex
CREATE INDEX "Promotion_type_idx" ON "Promotion"("type");

-- CreateIndex
CREATE INDEX "Promotion_isActive_idx" ON "Promotion"("isActive");

-- CreateIndex
CREATE INDEX "Promotion_code_idx" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_restaurantId_code_idx" ON "Promotion"("restaurantId", "code");

-- CreateIndex
CREATE INDEX "PromotionBranchAssignment_branchId_idx" ON "PromotionBranchAssignment"("branchId");

-- CreateIndex
CREATE INDEX "PromotionBranchAssignment_promotionId_idx" ON "PromotionBranchAssignment"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionBranchAssignment_promotionId_branchId_key" ON "PromotionBranchAssignment"("promotionId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_restaurantId_key" ON "Subscription"("restaurantId");

-- CreateIndex
CREATE INDEX "Subscription_restaurantId_idx" ON "Subscription"("restaurantId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Notification_restaurantId_idx" ON "Notification"("restaurantId");

-- CreateIndex
CREATE INDEX "Notification_branchId_idx" ON "Notification"("branchId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsDaily_restaurantId_idx" ON "AnalyticsDaily"("restaurantId");

-- CreateIndex
CREATE INDEX "AnalyticsDaily_date_idx" ON "AnalyticsDaily"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsDaily_restaurantId_branchId_date_key" ON "AnalyticsDaily"("restaurantId", "branchId", "date");

-- CreateIndex
CREATE INDEX "TableReservation_restaurantId_branchId_reservedDate_idx" ON "TableReservation"("restaurantId", "branchId", "reservedDate");

-- CreateIndex
CREATE INDEX "TableReservation_status_idx" ON "TableReservation"("status");

-- CreateIndex
CREATE INDEX "WaiterCall_restaurantId_idx" ON "WaiterCall"("restaurantId");

-- CreateIndex
CREATE INDEX "WaiterCall_branchId_idx" ON "WaiterCall"("branchId");

-- CreateIndex
CREATE INDEX "WaiterCall_tableId_idx" ON "WaiterCall"("tableId");

-- CreateIndex
CREATE INDEX "WaiterCall_status_idx" ON "WaiterCall"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE INDEX "RestaurantLanguage_restaurantId_idx" ON "RestaurantLanguage"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantLanguage_restaurantId_isActive_idx" ON "RestaurantLanguage"("restaurantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantLanguage_restaurantId_languageCode_key" ON "RestaurantLanguage"("restaurantId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "UIString_key_key" ON "UIString"("key");

-- CreateIndex
CREATE INDEX "UIString_group_idx" ON "UIString"("group");

-- CreateIndex
CREATE INDEX "UIString_key_idx" ON "UIString"("key");

-- CreateIndex
CREATE INDEX "UIStringOverride_restaurantId_idx" ON "UIStringOverride"("restaurantId");

-- CreateIndex
CREATE INDEX "UIStringOverride_restaurantId_languageCode_idx" ON "UIStringOverride"("restaurantId", "languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "UIStringOverride_restaurantId_uiStringKey_languageCode_key" ON "UIStringOverride"("restaurantId", "uiStringKey", "languageCode");

-- CreateIndex
CREATE INDEX "TranslationJob_restaurantId_idx" ON "TranslationJob"("restaurantId");

-- CreateIndex
CREATE INDEX "TranslationJob_status_idx" ON "TranslationJob"("status");

-- CreateIndex
CREATE INDEX "TranslationJob_restaurantId_entityType_idx" ON "TranslationJob"("restaurantId", "entityType");

-- CreateIndex
CREATE INDEX "TranslationStat_restaurantId_languageCode_idx" ON "TranslationStat"("restaurantId", "languageCode");

-- CreateIndex
CREATE INDEX "TranslationStat_restaurantId_idx" ON "TranslationStat"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationStat_restaurantId_languageCode_entityType_key" ON "TranslationStat"("restaurantId", "languageCode", "entityType");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_restaurantId_idx" ON "PushSubscription"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "InventoryItem_restaurantId_idx" ON "InventoryItem"("restaurantId");

-- CreateIndex
CREATE INDEX "InventoryItem_branchId_idx" ON "InventoryItem"("branchId");

-- CreateIndex
CREATE INDEX "InventoryItem_restaurantId_isActive_idx" ON "InventoryItem"("restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "InventoryItem_branchId_isActive_idx" ON "InventoryItem"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_restaurantId_branchId_name_key" ON "InventoryItem"("restaurantId", "branchId", "name");

-- CreateIndex
CREATE INDEX "Ingredient_restaurantId_idx" ON "Ingredient"("restaurantId");

-- CreateIndex
CREATE INDEX "Ingredient_restaurantId_isAvailable_idx" ON "Ingredient"("restaurantId", "isAvailable");

-- CreateIndex
CREATE INDEX "Ingredient_inventoryItemId_idx" ON "Ingredient"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_restaurantId_name_key" ON "Ingredient"("restaurantId", "name");

-- CreateIndex
CREATE INDEX "MenuItemIngredient_menuItemId_idx" ON "MenuItemIngredient"("menuItemId");

-- CreateIndex
CREATE INDEX "MenuItemIngredient_ingredientId_idx" ON "MenuItemIngredient"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemIngredient_menuItemId_ingredientId_key" ON "MenuItemIngredient"("menuItemId", "ingredientId");

-- CreateIndex
CREATE INDEX "AIAgentConfig_restaurantId_idx" ON "AIAgentConfig"("restaurantId");

-- CreateIndex
CREATE INDEX "AIAgentConfig_agentType_idx" ON "AIAgentConfig"("agentType");

-- CreateIndex
CREATE INDEX "AIAgentConfig_isEnabled_idx" ON "AIAgentConfig"("isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "AIAgentConfig_restaurantId_agentType_key" ON "AIAgentConfig"("restaurantId", "agentType");

-- CreateIndex
CREATE INDEX "AIConversation_restaurantId_idx" ON "AIConversation"("restaurantId");

-- CreateIndex
CREATE INDEX "AIConversation_userId_idx" ON "AIConversation"("userId");

-- CreateIndex
CREATE INDEX "AIConversation_sessionId_idx" ON "AIConversation"("sessionId");

-- CreateIndex
CREATE INDEX "AIConversation_agentType_idx" ON "AIConversation"("agentType");

-- CreateIndex
CREATE INDEX "AIConversation_status_idx" ON "AIConversation"("status");

-- CreateIndex
CREATE INDEX "AIConversation_createdAt_idx" ON "AIConversation"("createdAt");

-- CreateIndex
CREATE INDEX "AIConversationMessage_conversationId_idx" ON "AIConversationMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AIConversationMessage_createdAt_idx" ON "AIConversationMessage"("createdAt");

-- CreateIndex
CREATE INDEX "AIActionLog_conversationId_idx" ON "AIActionLog"("conversationId");

-- CreateIndex
CREATE INDEX "AIActionLog_restaurantId_idx" ON "AIActionLog"("restaurantId");

-- CreateIndex
CREATE INDEX "AIActionLog_action_idx" ON "AIActionLog"("action");

-- CreateIndex
CREATE INDEX "AIActionLog_status_idx" ON "AIActionLog"("status");

-- CreateIndex
CREATE INDEX "AIActionLog_createdAt_idx" ON "AIActionLog"("createdAt");

-- CreateIndex
CREATE INDEX "AISuggestion_restaurantId_idx" ON "AISuggestion"("restaurantId");

-- CreateIndex
CREATE INDEX "AISuggestion_agentType_idx" ON "AISuggestion"("agentType");

-- CreateIndex
CREATE INDEX "AISuggestion_category_idx" ON "AISuggestion"("category");

-- CreateIndex
CREATE INDEX "AISuggestion_status_idx" ON "AISuggestion"("status");

-- CreateIndex
CREATE INDEX "AISuggestion_priority_idx" ON "AISuggestion"("priority");

-- CreateIndex
CREATE INDEX "AISuggestion_createdAt_idx" ON "AISuggestion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Allergen_name_key" ON "Allergen"("name");

-- CreateIndex
CREATE INDEX "MenuItemAllergen_menuItemId_idx" ON "MenuItemAllergen"("menuItemId");

-- CreateIndex
CREATE INDEX "MenuItemAllergen_allergenId_idx" ON "MenuItemAllergen"("allergenId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemAllergen_menuItemId_allergenId_key" ON "MenuItemAllergen"("menuItemId", "allergenId");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_idx" ON "AuditLog"("restaurantId");

-- CreateIndex
CREATE INDEX "AuditLog_branchId_idx" ON "AuditLog"("branchId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_restaurantId_createdAt_idx" ON "AuditLog"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Shift_restaurantId_idx" ON "Shift"("restaurantId");

-- CreateIndex
CREATE INDEX "Shift_branchId_idx" ON "Shift"("branchId");

-- CreateIndex
CREATE INDEX "Shift_restaurantId_branchId_idx" ON "Shift"("restaurantId", "branchId");

-- CreateIndex
CREATE INDEX "ShiftEntry_shiftId_idx" ON "ShiftEntry"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftEntry_userId_idx" ON "ShiftEntry"("userId");

-- CreateIndex
CREATE INDEX "ShiftEntry_restaurantId_idx" ON "ShiftEntry"("restaurantId");

-- CreateIndex
CREATE INDEX "ShiftEntry_branchId_idx" ON "ShiftEntry"("branchId");

-- CreateIndex
CREATE INDEX "ShiftEntry_date_idx" ON "ShiftEntry"("date");

-- CreateIndex
CREATE INDEX "ShiftEntry_restaurantId_date_idx" ON "ShiftEntry"("restaurantId", "date");

-- CreateIndex
CREATE INDEX "ShiftEntry_branchId_date_idx" ON "ShiftEntry"("branchId", "date");

-- CreateIndex
CREATE INDEX "ShiftEntry_status_idx" ON "ShiftEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftEntry_shiftId_userId_date_key" ON "ShiftEntry"("shiftId", "userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BranchSettings_branchId_key" ON "BranchSettings"("branchId");

-- CreateIndex
CREATE INDEX "BranchSettings_branchId_idx" ON "BranchSettings"("branchId");

