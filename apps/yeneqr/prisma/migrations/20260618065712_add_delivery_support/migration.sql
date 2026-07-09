-- CreateTable
CREATE TABLE "DeliveryAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT,
    "label" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "deliveryInstructions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryAddress_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deliveryFeeCents" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryZone_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT,
    "sessionId" TEXT,
    "customerId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'dine_in',
    "deliveryAddressId" TEXT,
    "deliveryZoneId" TEXT,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_Order" ("branchId", "cancellationReason", "cancelledAt", "cancelledBy", "completedAt", "confirmedAt", "createdAt", "customerId", "discountAmountCents", "guestCount", "id", "orderNumber", "packagingChargeCents", "paidAt", "pickedUpBy", "preparingAt", "priority", "promotionCode", "promotionId", "readyAt", "restaurantId", "roundNumber", "scheduledFor", "servedAt", "serviceChargeCents", "sessionId", "specialInstructions", "status", "subtotalCents", "tableId", "tableNumber", "taxAmountCents", "tipAmountCents", "totalAmountCents", "type", "updatedAt", "waiterId") SELECT "branchId", "cancellationReason", "cancelledAt", "cancelledBy", "completedAt", "confirmedAt", "createdAt", "customerId", "discountAmountCents", "guestCount", "id", "orderNumber", "packagingChargeCents", "paidAt", "pickedUpBy", "preparingAt", "priority", "promotionCode", "promotionId", "readyAt", "restaurantId", "roundNumber", "scheduledFor", "servedAt", "serviceChargeCents", "sessionId", "specialInstructions", "status", "subtotalCents", "tableId", "tableNumber", "taxAmountCents", "tipAmountCents", "totalAmountCents", "type", "updatedAt", "waiterId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");
CREATE INDEX "Order_branchId_idx" ON "Order"("branchId");
CREATE INDEX "Order_tableId_idx" ON "Order"("tableId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_restaurantId_status_idx" ON "Order"("restaurantId", "status");
CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt");
CREATE INDEX "Order_type_idx" ON "Order"("type");
CREATE UNIQUE INDEX "Order_restaurantId_orderNumber_key" ON "Order"("restaurantId", "orderNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DeliveryAddress_restaurantId_idx" ON "DeliveryAddress"("restaurantId");

-- CreateIndex
CREATE INDEX "DeliveryAddress_customerId_idx" ON "DeliveryAddress"("customerId");

-- CreateIndex
CREATE INDEX "DeliveryZone_restaurantId_idx" ON "DeliveryZone"("restaurantId");

-- CreateIndex
CREATE INDEX "DeliveryZone_isActive_idx" ON "DeliveryZone"("isActive");
