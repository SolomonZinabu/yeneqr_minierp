-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItem" (
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
    "isTaxExempt" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" REAL,
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
INSERT INTO "new_MenuItem" ("availabilitySchedule", "availabilityType", "availableDays", "availableFrom", "availableTo", "calories", "categoryId", "costCents", "createdAt", "description", "descriptionAm", "descriptionI18n", "id", "image", "images", "ingredients", "ingredientsI18n", "isAvailable", "isDairyFree", "isGlutenFree", "isHalal", "isPopular", "isSpicy", "isVegan", "isVegetarian", "name", "nameAm", "nameI18n", "originalPriceCents", "preparationTime", "priceCents", "restaurantId", "showServingSize", "sortOrder", "updatedAt") SELECT "availabilitySchedule", "availabilityType", "availableDays", "availableFrom", "availableTo", "calories", "categoryId", "costCents", "createdAt", "description", "descriptionAm", "descriptionI18n", "id", "image", "images", "ingredients", "ingredientsI18n", "isAvailable", "isDairyFree", "isGlutenFree", "isHalal", "isPopular", "isSpicy", "isVegan", "isVegetarian", "name", "nameAm", "nameI18n", "originalPriceCents", "preparationTime", "priceCents", "restaurantId", "showServingSize", "sortOrder", "updatedAt" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");
CREATE INDEX "MenuItem_isAvailable_idx" ON "MenuItem"("isAvailable");
CREATE INDEX "MenuItem_restaurantId_isAvailable_idx" ON "MenuItem"("restaurantId", "isAvailable");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
