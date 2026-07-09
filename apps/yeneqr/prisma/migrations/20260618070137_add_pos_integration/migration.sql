-- CreateTable
CREATE TABLE "POSIntegration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "apiKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncOrders" BOOLEAN NOT NULL DEFAULT true,
    "syncPayments" BOOLEAN NOT NULL DEFAULT true,
    "syncMenu" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "POSIntegration_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "POSIntegration_restaurantId_idx" ON "POSIntegration"("restaurantId");

-- CreateIndex
CREATE INDEX "POSIntegration_isActive_idx" ON "POSIntegration"("isActive");
