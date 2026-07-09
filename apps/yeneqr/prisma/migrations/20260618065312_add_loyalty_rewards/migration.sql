-- CreateTable
CREATE TABLE "LoyaltyReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "menuItemId" TEXT,
    "categoryId" TEXT,
    "discountCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoyaltyReward_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LoyaltyReward_restaurantId_idx" ON "LoyaltyReward"("restaurantId");

-- CreateIndex
CREATE INDEX "LoyaltyReward_isActive_idx" ON "LoyaltyReward"("isActive");
