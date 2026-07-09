-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Restaurant" (
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
    "starPayFeeRate" REAL NOT NULL DEFAULT 0.03,
    "aiProvider" TEXT NOT NULL DEFAULT 'none',
    "aiApiKey" TEXT,
    "aiModel" TEXT,
    "aiBaseUrl" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiTranslationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiSuggestionsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiChatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiUpsellEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Restaurant" ("address", "addressI18n", "banner", "city", "createdAt", "cuisineType", "currency", "defaultLanguage", "description", "descriptionAm", "descriptionI18n", "email", "enabledLanguages", "id", "isActive", "isSuspended", "isVerified", "latitude", "logo", "longitude", "name", "nameAm", "nameI18n", "phone", "serviceCharge", "settings", "slug", "starPayApiSecret", "starPayApiUrl", "starPayEnabled", "starPayFeeRate", "starPayMerchantId", "starPayWebhookSecret", "taxRate", "updatedAt", "website", "workingHours") SELECT "address", "addressI18n", "banner", "city", "createdAt", "cuisineType", "currency", "defaultLanguage", "description", "descriptionAm", "descriptionI18n", "email", "enabledLanguages", "id", "isActive", "isSuspended", "isVerified", "latitude", "logo", "longitude", "name", "nameAm", "nameI18n", "phone", "serviceCharge", "settings", "slug", "starPayApiSecret", "starPayApiUrl", "starPayEnabled", "starPayFeeRate", "starPayMerchantId", "starPayWebhookSecret", "taxRate", "updatedAt", "website", "workingHours" FROM "Restaurant";
DROP TABLE "Restaurant";
ALTER TABLE "new_Restaurant" RENAME TO "Restaurant";
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
