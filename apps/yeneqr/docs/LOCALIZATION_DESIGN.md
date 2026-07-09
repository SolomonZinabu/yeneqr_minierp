# Yene QR — Comprehensive Localization Architecture Design

> **Version**: 1.0
> **Date**: 2025-03-04
> **Author**: Architecture Team
> **Status**: Design Proposal

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Overview](#3-architecture-overview)
4. [Prisma Schema — New Models](#4-prisma-schema--new-models)
5. [Prisma Schema — JSON i18n Columns on Existing Models](#5-prisma-schema--json-i18n-columns-on-existing-models)
6. [API Design](#6-api-design)
7. [Client-Side Architecture](#7-client-side-architecture)
8. [RTL Support](#8-rtl-support)
9. [Translation Completion Tracking](#9-translation-completion-tracking)
10. [AI Auto-Translation Integration](#10-ai-auto-translation-integration)
11. [Migration Strategy](#11-migration-strategy)
12. [Performance Considerations](#12-performance-considerations)
13. [Implementation Phases](#13-implementation-phases)

---

## 1. Executive Summary

This document defines the architecture for transforming Yene QR's hardcoded Amharic-only localization (`nameAm`/`descriptionAm` columns) into a comprehensive, N-language, database-level internationalization system. The design supports 12+ languages, per-restaurant language configuration, DB-stored UI strings with per-restaurant overrides, RTL support, fallback chains, completion tracking, and AI auto-translation integration.

**Key design decisions:**

- **JSON columns** on existing entities for data translations (scalable, zero-join reads)
- **Dedicated normalized tables** for UI string management (queryable, manageable, overridable)
- **Backward-compatible migration** — existing `name`/`description` columns remain the default-language fallback
- **Deprecation** of `MenuItemTranslation` table in favor of JSON i18n columns on `MenuItem`
- **Persistent language state** via localStorage + cookie + session token

---

## 2. Current State Analysis

### 2.1 Models with Hardcoded Amharic Columns

| Model | Column(s) | Used In |
|-------|-----------|---------|
| `Restaurant` | `nameAm`, `descriptionAm` | Customer menu page, dashboard, restaurant switcher |
| `Branch` | `nameAm` | Customer menu, branch selector |
| `Menu` | `nameAm`, `descriptionAm` | Menu management |
| `MenuCategory` | `nameAm`, `descriptionAm` | Category tabs, item listing |
| `MenuItem` | `nameAm`, `descriptionAm` | Menu items, cart, order display |
| `ModifierGroup` | `nameAm` | Modifier selection UI |
| `ModifierOption` | `nameAm` | Modifier option labels |
| `OrderItem` | `nameAm` | Order snapshot (frozen at order time) |
| `Promotion` | `nameAm`, `descriptionAm` | Promo banners, coupon display |

### 2.2 Current Client Pattern

```typescript
// customer-app.tsx & page.tsx — hardcoded t() helper
function t(en: string, am: string | null, lang: 'en' | 'am'): string {
  return lang === 'am' && am ? am : en
}

// Usage — inline Amharic strings
{t('Start Ordering', 'ትዕዛዝ ጀምር', language)}
{t('Search menu...', 'ምናሌ ፈልግ...', language)}
```

### 2.3 Current Store Type

```typescript
// customer-store.ts
language: 'en' | 'am'  // Hardcoded to 2 languages

// store.ts (admin)
language: 'en' | 'am'  // Same limitation
```

### 2.4 Current `MenuItemTranslation` Table

```prisma
model MenuItemTranslation {
  id          String   @id @default(cuid())
  menuItemId  String
  language    String   // en, am
  name        String
  description String?
  // @@unique([menuItemId, language])
}
```

**Problems:**

- Only used for `MenuItem`, not other entities
- Row-per-language-per-field causes N+1 queries
- Not integrated with the `t()` helper on the client
- UI strings are hardcoded in components, not in DB

### 2.5 Language State Persistence Gap

- `useCustomerStore` language resets on page refresh (Zustand without persistence)
- Admin `useAppStore` language also resets
- No cookie or localStorage persistence mechanism

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│                                                                  │
│  useLanguage() ──► LanguageContext ──► RTL detection             │
│       │                  │                                       │
│       ▼                  ▼                                       │
│  useTranslation()    useI18n() ──► t('key') for UI strings      │
│       │                                                          │
│       ▼                                                          │
│  resolveI18nField(entity, 'name', lang) ──► data strings         │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                        API LAYER                                 │
│                                                                  │
│  /api/i18n/languages        ──► CRUD platform languages          │
│  /api/i18n/ui-strings       ──► UI string management             │
│  /api/restaurants/[id]/i18n ──► Restaurant language config       │
│  /api/restaurants/[id]/translations/bulk ──► Bulk data translate  │
│  /api/restaurants/[id]/translations/jobs  ──► AI translation     │
│  /api/restaurants/[id]/translations/stats ──► Completion tracking│
│                                                                  │
│  Middleware: ?lang=am header ──► ctx.language                    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                                │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │  Entity Data i18n │  │  UI String i18n  │                     │
│  │  (JSON columns)   │  │  (Normalized     │                     │
│  │                   │  │   tables)         │                     │
│  │  Restaurant:      │  │                   │                     │
│  │   nameI18n Json?  │  │  Language         │                     │
│  │   descI18n  Json? │  │  RestaurantLang   │                     │
│  │                   │  │  UIString         │                     │
│  │  MenuItem:        │  │  UIStringOverride │                     │
│  │   nameI18n Json?  │  │  TranslationJob   │                     │
│  │   descI18n  Json? │  │  TranslationStat  │                     │
│  │                   │  │                   │                     │
│  │  JSON format:     │  └──────────────────┘                     │
│  │  {                │                                           │
│  │    "am": "ሽሮ",    │                                           │
│  │    "om": "Shiro", │                                           │
│  │    "ar": "شيرو"   │                                           │
│  │  }                │                                           │
│  └──────────────────┘                                           │
│                                                                  │
│  Fallback: nameI18n[lang] → nameI18n[defaultLang] → name        │
└──────────────────────────────────────────────────────────────────┘
```

### Design Rationale: Why JSON Columns vs. Dedicated Translation Tables

| Aspect | JSON Columns (Chosen) | Dedicated Translation Table |
|--------|----------------------|----------------------------|
| Read performance | Single row read, no joins | N joins per language per field |
| Write frequency | Low (menu updates are infrequent) | Same |
| Query patterns | Always read all languages for an entity | Same |
| Schema simplicity | Add column, no new table per entity | One huge table or many per-entity tables |
| PostgreSQL support | GIN indexes, `jsonb_path_query` | Standard indexes |
| Migration from nameAm | Direct `json_build_object` | Insert rows |
| Admin UI | Read/write whole JSON at once | Paginated row editing |

**Hybrid approach**: JSON columns for **entity data** (menu items, categories, etc. — always loaded together, rarely queried by language alone). Dedicated tables for **UI strings** (queried by key, by language, need per-restaurant overrides, need completion tracking).

---

## 4. Prisma Schema — New Models

### 4.1 `Language` — Platform-Supported Languages

```prisma
model Language {
  id          String   @id @default(cuid())
  code        String   @unique  // ISO 639-1 or 639-3: 'en', 'am', 'om', 'ti', 'so', 'aa', 'sid', 'ar', 'it', 'zh', 'fr'
  name        String             // English name: 'Amharic', 'Oromo', 'Arabic'
  nameLocal   String             // Name in its own script: 'አማርኛ', 'Afaan Oromoo', 'العربية'
  direction   String   @default("ltr")  // 'ltr' or 'rtl'
  fontFamily  String?            // Optional font override: 'Noto Sans Ethiopic', 'Noto Naskh Arabic'
  flagEmoji   String?            // '🇪🇹', '🇬🇧', '🇸🇦'
  isActive    Boolean  @default(true)   // Platform-wide availability
  sortOrder   Int      @default(0)

  // Relations
  restaurantLanguages RestaurantLanguage[]
  translationJobs     TranslationJob[]
  translationStats    TranslationStat[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 4.2 `RestaurantLanguage` — Per-Restaurant Language Configuration

```prisma
model RestaurantLanguage {
  id            String   @id @default(cuid())
  restaurantId  String
  languageCode  String   // 'am', 'om', 'ar' — matches Language.code
  isDefault     Boolean  @default(false)  // Restaurant's primary language
  isActive      Boolean  @default(true)   // Visible to customers?
  isRequired    Boolean  @default(false)  // Must be filled before publishing?
  sortOrder     Int      @default(0)      // Display order in language picker

  restaurant    Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  language      Language   @relation(fields: [languageCode], references: [code], onDelete: Cascade)

  @@unique([restaurantId, languageCode])
  @@index([restaurantId])
  @@index([restaurantId, isActive])

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### 4.3 `UIString` — Platform UI String Definitions

```prisma
model UIString {
  id           String   @id @default(cuid())
  key          String   @unique  // Dot-notation: 'menu.search_placeholder', 'cart.empty', 'order.place'
  group        String             // Logical grouping: 'menu', 'cart', 'order', 'payment', 'common', 'auth'
  description  String?            // Context for translators: 'The search box placeholder on the menu page'

  // Translations stored as JSON: { "am": "ምናሌ ፈልግ...", "om": "...", "ar": "..." }
  // The 'en' value is stored in `defaultValue` as the source of truth
  defaultValue String             // English source string: 'Search menu...'
  translations String?            // JSON: { "am": "ምናሌ ፈልግ...", "om": "Makala...", "ar": "ابحث..." }

  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  overrides    UIStringOverride[]

  @@index([group])
  @@index([key])
}
```

### 4.4 `UIStringOverride` — Per-Restaurant UI String Overrides

```prisma
model UIStringOverride {
  id            String   @id @default(cuid())
  restaurantId  String
  uiStringKey   String             // Matches UIString.key
  languageCode  String             // 'am', 'om', etc.
  value         String             // Override value

  restaurant    Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  @@unique([restaurantId, uiStringKey, languageCode])
  @@index([restaurantId])
  @@index([restaurantId, languageCode])

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### 4.5 `TranslationJob` — AI Auto-Translation Job Tracking

```prisma
model TranslationJob {
  id              String   @id @default(cuid())
  restaurantId    String
  sourceLanguage  String              // 'en' — source language code
  targetLanguage  String              // 'am', 'om', etc. — target language code
  entityType      String              // 'menuItem', 'menuCategory', 'modifierGroup', 'modifierOption', 'promotion', 'uiString'
  entityIds       String              // JSON array of entity IDs to translate
  status          String  @default("pending")  // pending, in_progress, completed, failed, partially_completed
  progress        Int     @default(0)   // Percentage 0-100
  totalItems      Int     @default(0)
  completedItems  Int     @default(0)
  failedItems     Int     @default(0)
  errorDetails    String?             // JSON: { itemId: errorMessage }
  provider        String  @default("openai")  // 'openai', 'google', 'deepl', 'custom'
  providerJobId   String?             // External job reference
  startedAt       DateTime?
  completedAt     DateTime?
  createdBy       String?             // User ID who triggered the job

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([restaurantId])
  @@index([status])
  @@index([restaurantId, entityType])
}
```

### 4.6 `TranslationStat` — Translation Completion Tracking

```prisma
model TranslationStat {
  id               String   @id @default(cuid())
  restaurantId     String
  languageCode     String
  entityType       String              // 'menuItem', 'menuCategory', 'modifierGroup', 'modifierOption', 'promotion', 'uiString'
  totalFields      Int     @default(0) // Total translatable fields of this type
  translatedFields Int     @default(0) // Fields with non-null translation
  verifiedFields   Int     @default(0) // Fields marked as verified/correct
  completionPct    Int     @default(0) // Computed: translatedFields / totalFields * 100

  @@unique([restaurantId, languageCode, entityType])
  @@index([restaurantId, languageCode])
  @@index([restaurantId])

  updatedAt        DateTime @updatedAt
}
```

---

## 5. Prisma Schema — JSON i18n Columns on Existing Models

### 5.1 Strategy

For each existing model with `nameAm`/`descriptionAm`, add a `Json?` column suffixed with `I18n`. The JSON structure is:

```json
{
  "am": "ሽሮ ወጥ",
  "om": "Shiro Wot",
  "ti": "ሽሮ ወጥ",
  "so": "Shiro",
  "ar": "شيرو وت",
  "it": "Shiro Wot"
}
```

**Key rules:**

- The existing `name`/`description` columns remain the **default language** value (backward compatible)
- `nameI18n`/`descriptionI18n` store **non-default-language** translations only
- Reading: `nameI18n[requestedLang] ?? name` (fallback chain)
- Writing: update `name` for default language, `nameI18n[lang]` for others
- The `nameAm`/`descriptionAm` columns are **deprecated** and will be migrated into `nameI18n`

### 5.2 Complete Column Additions

| Model | New JSON Column(s) | Existing Column(s) to Deprecate |
|-------|--------------------|---------------------------------|
| `Restaurant` | `nameI18n Json?`, `descriptionI18n Json?`, `addressI18n Json?` | `nameAm`, `descriptionAm` |
| `Branch` | `nameI18n Json?`, `addressI18n Json?` | `nameAm` |
| `Menu` | `nameI18n Json?`, `descriptionI18n Json?` | `nameAm`, `descriptionAm` |
| `MenuCategory` | `nameI18n Json?`, `descriptionI18n Json?` | `nameAm`, `descriptionAm` |
| `MenuItem` | `nameI18n Json?`, `descriptionI18n Json?` | `nameAm`, `descriptionAm` |
| `ModifierGroup` | `nameI18n Json?` | `nameAm` |
| `ModifierOption` | `nameI18n Json?` | `nameAm` |
| `OrderItem` | `nameI18n Json?` | `nameAm` |
| `Promotion` | `nameI18n Json?`, `descriptionI18n Json?` | `nameAm`, `descriptionAm` |
| `Floor` | `nameI18n Json?` | _(none — new)_ |
| `KitchenStation` | `nameI18n Json?` | _(none — new)_ |

### 5.3 Prisma Schema Diff (Existing Models)

```prisma
model Restaurant {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String                          // Default language value (kept)
  nameAm          String?  // ⚠️ DEPRECATED — migrate to nameI18n.am
  nameI18n        Json?    // ✅ NEW: { "am": "...", "om": "...", ... }
  description     String?
  descriptionAm   String?  // ⚠️ DEPRECATED — migrate to descriptionI18n.am
  descriptionI18n Json?    // ✅ NEW: { "am": "...", "om": "...", ... }
  addressI18n     Json?    // ✅ NEW: { "am": "...", "om": "...", ... }
  // ... all other existing fields unchanged ...
  defaultLanguage String   @default("en")
  enabledLanguages String? @default("[]")  // ✅ NEW: JSON array of enabled language codes ["en","am","om"]
  // ... rest unchanged ...

  // ✅ NEW relations
  restaurantLanguages RestaurantLanguage[]
  uiStringOverrides   UIStringOverride[]
  translationJobs     TranslationJob[]
  translationStats    TranslationStat[]
}

model Branch {
  id            String   @id @default(cuid())
  // ... existing fields ...
  nameAm        String?  // ⚠️ DEPRECATED
  nameI18n      Json?    // ✅ NEW
  addressI18n   Json?    // ✅ NEW
  // ... rest unchanged ...
}

model Menu {
  id            String   @id @default(cuid())
  // ... existing fields ...
  nameAm        String?  // ⚠️ DEPRECATED
  nameI18n      Json?    // ✅ NEW
  descriptionAm String?  // ⚠️ DEPRECATED
  descriptionI18n Json?  // ✅ NEW
  // ... rest unchanged ...
}

model MenuCategory {
  id            String   @id @default(cuid())
  // ... existing fields ...
  nameAm        String?  // ⚠️ DEPRECATED
  nameI18n      Json?    // ✅ NEW
  descriptionAm String?  // ⚠️ DEPRECATED
  descriptionI18n Json?  // ✅ NEW
  // ... rest unchanged ...
}

model MenuItem {
  id              String   @id @default(cuid())
  // ... existing fields ...
  nameAm          String?  // ⚠️ DEPRECATED
  nameI18n        Json?    // ✅ NEW
  descriptionAm   String?  // ⚠️ DEPRECATED
  descriptionI18n Json?    // ✅ NEW
  // ... rest unchanged ...
  // ⚠️ MenuItemTranslation relation will be deprecated
}

model ModifierGroup {
  id           String   @id @default(cuid())
  // ... existing fields ...
  nameAm       String?  // ⚠️ DEPRECATED
  nameI18n     Json?    // ✅ NEW
  // ... rest unchanged ...
}

model ModifierOption {
  id              String   @id @default(cuid())
  // ... existing fields ...
  nameAm          String?  // ⚠️ DEPRECATED
  nameI18n        Json?    // ✅ NEW
  // ... rest unchanged ...
}

model OrderItem {
  id              String   @id @default(cuid())
  // ... existing fields ...
  nameAm          String?  // ⚠️ DEPRECATED
  nameI18n        Json?    // ✅ NEW — frozen snapshot at order time
  // ... rest unchanged ...
}

model Promotion {
  id            String   @id @default(cuid())
  // ... existing fields ...
  nameAm        String?  // ⚠️ DEPRECATED
  nameI18n      Json?    // ✅ NEW
  descriptionAm String?  // ⚠️ DEPRECATED
  descriptionI18n Json?  // ✅ NEW
  // ... rest unchanged ...
}

model Floor {
  id           String   @id @default(cuid())
  // ... existing fields ...
  nameI18n     Json?    // ✅ NEW
  // ... rest unchanged ...
}

model KitchenStation {
  id           String   @id @default(cuid())
  // ... existing fields ...
  nameI18n     Json?    // ✅ NEW
  // ... rest unchanged ...
}

model CustomerSession {
  id            String   @id @default(cuid())
  // ... existing fields ...
  language      String   @default("en")  // Changed from implicit 'en'|'am' to string
  // ... rest unchanged ...
}

model Customer {
  id          String   @id @default(cuid())
  // ... existing fields ...
  language    String   @default("en")  // Changed from implicit 'en'|'am' to string
  // ... rest unchanged ...
}
```

---

## 6. API Design

### 6.1 Platform Language Management (Super Admin)

#### `GET /api/i18n/languages`

List all platform-supported languages.

```typescript
// Response
{
  languages: Array<{
    id: string
    code: string          // 'am', 'om', 'ar'
    name: string          // 'Amharic'
    nameLocal: string     // 'አማርኛ'
    direction: 'ltr' | 'rtl'
    fontFamily: string | null
    flagEmoji: string | null
    isActive: boolean
    sortOrder: number
  }>
}
```

#### `POST /api/i18n/languages`

Add a new platform language (super admin only).

```typescript
// Request
{
  code: 'ti'             // Tigrinya
  name: 'Tigrinya'
  nameLocal: 'ትግርኛ'
  direction: 'ltr'
  fontFamily: 'Noto Sans Ethiopic'
  flagEmoji: '🇪🇹'
  sortOrder: 3
}
```

#### `PATCH /api/i18n/languages/[code]`

Update a platform language.

#### `DELETE /api/i18n/languages/[code]`

Deactivate a platform language (soft delete — set `isActive: false`).

---

### 6.2 Restaurant Language Configuration

#### `GET /api/restaurants/[id]/i18n/languages`

Get restaurant's enabled languages.

```typescript
// Response
{
  defaultLanguage: 'en'
  enabledLanguages: Array<{
    code: string
    name: string
    nameLocal: string
    direction: 'ltr' | 'rtl'
    isDefault: boolean
    isActive: boolean
    isRequired: boolean
    sortOrder: number
    completionPct: number  // Aggregate from TranslationStat
  }>
}
```

#### `PUT /api/restaurants/[id]/i18n/languages`

Configure restaurant's enabled languages.

```typescript
// Request
{
  defaultLanguage: 'am'   // Changed from 'en'
  languages: Array<{
    code: string
    isActive: boolean
    isRequired: boolean
    sortOrder: number
  }>
}
```

---

### 6.3 Entity Data Translations

#### `GET /api/restaurants/[id]/translations?entityType=menuItem&lang=am`

Get all translations for a specific entity type and language.

```typescript
// Response
{
  entityType: 'menuItem'
  languageCode: 'am'
  translations: Array<{
    entityId: string
    fields: {
      name: string
      description: string | null
    }
  }>
}
```

#### `PUT /api/restaurants/[id]/translations`

Bulk update translations for entities.

```typescript
// Request
{
  languageCode: 'am'
  translations: Array<{
    entityType: 'menuItem'    // 'menuItem' | 'menuCategory' | 'modifierGroup' | 'modifierOption' | 'promotion' | 'branch'
    entityId: string
    fields: {
      name: string
      description?: string
    }
  }>
}

// Response
{
  updated: number
  errors: Array<{ entityId: string; error: string }>
}
```

#### `PATCH /api/restaurants/[id]/items/[itemId]`

Single entity update (existing endpoint, extended with i18n support).

```typescript
// Request — includes i18n fields
{
  name: 'Doro Wot',           // Default language value
  description: 'Slow-cooked chicken stew...', // Default language value
  nameI18n: {                  // Translations for non-default languages
    am: 'ዶሮ ወጥ',
    om: 'Doro Wot',
    ti: 'ዶሮ ወጥ',
    ar: 'دورو وت'
  },
  descriptionI18n: {
    am: 'በበርበሬ የተረፋ ዶሮ ወጥ...',
    om: 'Doro wot bilchaata...',
  },
  price: 380,
  // ... other fields
}
```

---

### 6.4 UI Strings

#### `GET /api/i18n/ui-strings?group=menu&lang=am&restaurantId=xxx`

Get UI strings for a group/language, with restaurant overrides applied.

```typescript
// Response
{
  language: 'am'
  group: 'menu'
  strings: Record<string, string>  // { "menu.search_placeholder": "ምናሌ ፈልግ...", ... }
}
```

#### `GET /api/i18n/ui-strings/bundle?lang=am&restaurantId=xxx`

Get ALL UI strings for a language (for client-side caching).

```typescript
// Response — compact bundle for client hydration
{
  language: 'am'
  direction: 'ltr'
  strings: Record<string, string>  // { "menu.search_placeholder": "...", "cart.empty": "...", ... }
}
```

#### `PUT /api/i18n/ui-strings/[key]`

Update a platform UI string translation (super admin).

```typescript
// Request
{
  translations: {
    am: 'ምናሌ ፈልግ...',
    om: 'Makala...',
    ar: 'ابحث في القائمة...'
  }
}
```

#### `PUT /api/restaurants/[id]/i18n/ui-string-overrides/[key]`

Set a per-restaurant override for a UI string.

```typescript
// Request
{
  languageCode: 'am'
  value: 'በዚሁ ሬስቶራንት ልዩ ስም...'  // Restaurant-specific override
}
```

#### `DELETE /api/restaurants/[id]/i18n/ui-string-overrides/[key]?languageCode=am`

Remove a per-restaurant override (revert to platform default).

---

### 6.5 Translation Jobs (AI)

#### `POST /api/restaurants/[id]/translations/jobs`

Create an AI translation job.

```typescript
// Request
{
  sourceLanguage: 'en'
  targetLanguage: 'am'
  entityType: 'menuItem'        // or 'all' for everything
  entityIds?: string[]          // Optional: specific items; omit for all
  provider?: 'openai'           // Default: 'openai'
  overwrite?: boolean           // Overwrite existing translations? Default: false
}

// Response
{
  jobId: string
  status: 'pending'
  totalItems: 45
  estimatedTime: '2-3 minutes'
}
```

#### `GET /api/restaurants/[id]/translations/jobs/[jobId]`

Check job status.

```typescript
// Response
{
  id: string
  status: 'in_progress'
  progress: 65
  totalItems: 45
  completedItems: 29
  failedItems: 1
  errorDetails: { 'item-xxx': 'Rate limited' }
}
```

#### `POST /api/restaurants/[id]/translations/jobs/[jobId]/cancel`

Cancel a running job.

#### `POST /api/restaurants/[id]/translations/jobs/[jobId]/apply`

Apply completed translations (preview first, then confirm).

---

### 6.6 Translation Stats / Completion

#### `GET /api/restaurants/[id]/translations/stats`

Get translation completion stats for all enabled languages.

```typescript
// Response
{
  defaultLanguage: 'en'
  languages: Array<{
    code: string
    name: string
    completion: {
      overall: number           // Weighted average across all entity types
      menuItem: { total: 120, translated: 95, verified: 80, pct: 79 }
      menuCategory: { total: 15, translated: 15, verified: 12, pct: 100 }
      modifierGroup: { total: 45, translated: 20, verified: 15, pct: 44 }
      modifierOption: { total: 180, translated: 60, verified: 40, pct: 33 }
      promotion: { total: 5, translated: 3, verified: 2, pct: 60 }
      uiString: { total: 200, translated: 180, verified: 150, pct: 90 }
    }
  }>
}
```

---

### 6.7 Language-Aware Data Endpoints

All existing data endpoints accept an optional `?lang=am` query parameter. When provided:

1. The response includes i18n fields resolved for that language
2. A `_i18n` envelope is added for convenience

```typescript
// GET /api/restaurants/[id]/menus/[menuId]/items?lang=am

// Response — items include resolved translations
{
  items: Array<{
    id: string
    name: string               // Resolved: nameI18n.am ?? name
    description: string | null // Resolved: descriptionI18n.am ?? description
    nameI18n: { am: '...', om: '...' } | null  // Raw i18n object (for editing)
    descriptionI18n: { ... } | null
    price: number
    // ... other fields
  }>
}
```

**API Middleware: Language Resolution**

```typescript
// src/lib/i18n-middleware.ts
function resolveLanguage(req: Request): string {
  // Priority: ?lang=am > Cookie: yeneqr_lang > Accept-Language header > restaurant default > 'en'
  const urlLang = new URL(req.url).searchParams.get('lang')
  if (urlLang) return urlLang

  const cookieLang = req.cookies.get('yeneqr_lang')?.value
  if (cookieLang) return cookieLang

  const acceptLang = req.headers.get('accept-language')
  if (acceptLang) {
    // Parse Accept-Language and match against enabled languages
    const preferred = parseAcceptLanguage(acceptLang)
    if (preferred) return preferred
  }

  return 'en' // ultimate fallback
}
```

---

## 7. Client-Side Architecture

### 7.1 `useLanguage` Hook — Language State Management

```typescript
// src/hooks/useLanguage.ts

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LanguageState {
  language: string                    // Current language code: 'en', 'am', 'om', etc.
  enabledLanguages: LanguageConfig[]  // Languages available for this restaurant
  defaultLanguage: string             // Restaurant's default language
  setLanguage: (lang: string) => void
  setEnabledLanguages: (languages: LanguageConfig[], defaultLang: string) => void
  isRTL: () => boolean
  getDirection: () => 'ltr' | 'rtl'
  getFontFamily: () => string | null
}

interface LanguageConfig {
  code: string
  name: string
  nameLocal: string
  direction: 'ltr' | 'rtl'
  fontFamily: string | null
  flagEmoji: string | null
  isDefault: boolean
  completionPct: number
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'en',
      enabledLanguages: [],
      defaultLanguage: 'en',

      setLanguage: (lang: string) => {
        set({ language: lang })
        // Set cookie for server-side rendering
        document.cookie = `yeneqr_lang=${lang};path=/;max-age=${60 * 60 * 24 * 365}`
        // Set HTML dir attribute for RTL
        document.documentElement.dir = get().getDirection()
        document.documentElement.lang = lang
      },

      setEnabledLanguages: (languages, defaultLang) => {
        set({
          enabledLanguages: languages,
          defaultLanguage: defaultLang,
        })
      },

      isRTL: () => {
        const lang = get().language
        const config = get().enabledLanguages.find(l => l.code === lang)
        return config?.direction === 'rtl'
      },

      getDirection: () => {
        const lang = get().language
        const config = get().enabledLanguages.find(l => l.code === lang)
        return config?.direction || 'ltr'
      },

      getFontFamily: () => {
        const lang = get().language
        const config = get().enabledLanguages.find(l => l.code === lang)
        return config?.fontFamily || null
      },
    }),
    {
      name: 'yeneqr_language',     // localStorage key
      partialize: (state) => ({
        language: state.language,
        defaultLanguage: state.defaultLanguage,
      }),
    }
  )
)

// React hook wrapper
export function useLanguage() {
  const store = useLanguageStore()
  return {
    language: store.language,
    setLanguage: store.setLanguage,
    enabledLanguages: store.enabledLanguages,
    defaultLanguage: store.defaultLanguage,
    isRTL: store.isRTL(),
    direction: store.getDirection(),
    fontFamily: store.getFontFamily(),
  }
}
```

### 7.2 `useTranslation` Hook — Data Field Resolution

```typescript
// src/hooks/useTranslation.ts

import { useLanguageStore } from './useLanguage'

/**
 * Resolves an i18n JSON field with fallback chain:
 *   requested language → restaurant default → 'en' → fallback string
 */
export function resolveI18nField(
  i18nJson: Record<string, string> | null | undefined,
  fallback: string,
  lang: string,
  defaultLang: string = 'en'
): string {
  if (!i18nJson) return fallback

  // Chain: requested → default → en → fallback
  return i18nJson[lang] ?? i18nJson[defaultLang] ?? i18nJson['en'] ?? fallback
}

/**
 * Hook that provides a `t()` function for resolving entity data translations.
 * Usage:
 *   const { t } = useTranslation()
 *   <h1>{t(item.nameI18n, item.name)}</h1>
 */
export function useTranslation() {
  const language = useLanguageStore((s) => s.language)
  const defaultLanguage = useLanguageStore((s) => s.defaultLanguage)

  /**
   * Resolve a translatable field.
   * @param i18nJson - The i18n JSON object from the entity
   * @param fallback - The default-language value (entity.name, entity.description, etc.)
   */
  function t(i18nJson: Record<string, string> | null | undefined, fallback: string): string {
    return resolveI18nField(i18nJson, fallback, language, defaultLanguage)
  }

  /**
   * Resolve with explicit language override.
   */
  function tInLang(
    i18nJson: Record<string, string> | null | undefined,
    fallback: string,
    overrideLang: string
  ): string {
    return resolveI18nField(i18nJson, fallback, overrideLang, defaultLanguage)
  }

  return { t, tInLang, language, defaultLanguage }
}
```

### 7.3 `useI18n` Hook — UI String Resolution

```typescript
// src/hooks/useI18n.ts

import { useState, useEffect, useCallback } from 'react'
import { useLanguageStore } from './useLanguage'

// In-memory cache of UI string bundles
const bundleCache = new Map<string, Record<string, string>>()

interface I18nStrings {
  strings: Record<string, string>
  loading: boolean
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * Hook for UI string translations (labels, buttons, messages).
 * Loads the full bundle for the current language on mount and caches it.
 *
 * Usage:
 *   const { t } = useI18n()
 *   <button>{t('cart.empty')}</button>
 *   <p>{t('order.items_count', { count: 3 })}</p>
 */
export function useI18n(restaurantId?: string): I18nStrings {
  const language = useLanguageStore((s) => s.language)
  const [strings, setStrings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `${language}:${restaurantId || 'platform'}`

    async function loadBundle() {
      // Check in-memory cache
      if (bundleCache.has(cacheKey)) {
        setStrings(bundleCache.get(cacheKey)!)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const params = new URLSearchParams({ lang: language })
        if (restaurantId) params.set('restaurantId', restaurantId)

        const res = await fetch(`/api/i18n/ui-strings/bundle?${params}`)
        if (res.ok) {
          const data = await res.json()
          const bundle = data.strings || {}
          bundleCache.set(cacheKey, bundle)
          if (!cancelled) setStrings(bundle)
        } else {
          // Fallback: keys themselves as values (English keys are readable)
          if (!cancelled) setStrings({})
        }
      } catch {
        if (!cancelled) setStrings({})
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBundle()
    return () => { cancelled = true }
  }, [language, restaurantId])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = strings[key] || key
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        })
      }
      return value
    },
    [strings]
  )

  return { strings, loading, t }
}
```

### 7.4 Updated `useAppStore` Integration

```typescript
// src/lib/store.ts — updated language type

// BEFORE:
// language: 'en' | 'am'

// AFTER:
language: string  // 'en', 'am', 'om', 'ti', 'so', 'ar', etc.
setLanguage: (lang: string) => void
```

### 7.5 Updated Customer Store

```typescript
// src/lib/customer-store.ts — updated types

export interface MenuItem {
  id: string
  name: string                   // Default language value (backward compatible)
  nameI18n: Record<string, string> | null  // NEW
  description: string            // Default language value
  descriptionI18n: Record<string, string> | null  // NEW
  price: number
  categoryId: string
  // ... rest unchanged
}

export interface ModifierOption {
  id: string
  name: string
  nameI18n: Record<string, string> | null  // NEW (replaces nameAm)
  price: number
}

export interface ModifierGroup {
  id: string
  name: string
  nameI18n: Record<string, string> | null  // NEW (replaces nameAm)
  required: boolean
  singleSelect: boolean
  options: ModifierOption[]
}

export interface Category {
  id: string
  name: string
  nameI18n: Record<string, string> | null  // NEW (replaces nameAm)
  emoji: string
}

// Store
interface CustomerStore {
  language: string  // Changed from 'en' | 'am'
  setLanguage: (lang: string) => void
  // ... rest
}
```

### 7.6 Updated `t()` Helper — Bridge Pattern

During migration, provide a bridge `t()` that works with both old and new data:

```typescript
// src/lib/i18n.ts

import { useLanguageStore } from '@/hooks/useLanguage'

/**
 * Universal translation resolver.
 * Handles both old format (nameEn/nameAm) and new format (name/nameI18n).
 */
export function t(
  i18nOrEn: Record<string, string> | string | null | undefined,
  fallbackOrAm: string | null | undefined,
  lang?: string
): string {
  const currentLang = lang || useLanguageStore.getState().language
  const defaultLang = useLanguageStore.getState().defaultLanguage

  // New format: t(nameI18n, name) — i18nOrEn is the JSON, fallbackOrAm is the fallback string
  if (i18nOrEn && typeof i18nOrEn === 'object') {
    return i18nOrEn[currentLang]
      ?? i18nOrEn[defaultLang]
      ?? i18nOrEn['en']
      ?? (typeof fallbackOrAm === 'string' ? fallbackOrAm : '')
  }

  // Old format: t('English', 'አማርኛ', 'am') — backward compatible
  if (typeof i18nOrEn === 'string') {
    if (currentLang === 'am' && fallbackOrAm) return fallbackOrAm
    return i18nOrEn
  }

  return typeof fallbackOrAm === 'string' ? fallbackOrAm : ''
}
```

### 7.7 Component Migration Example

```tsx
// BEFORE (customer-app.tsx):
function t(en: string, am: string, lang: 'en' | 'am'): string {
  return lang === 'am' ? am : en
}
// Usage:
{t(item.nameEn, item.nameAm, language)}
{t('Start Ordering', 'ትዕዛዝ ጀምር', language)}

// AFTER:
import { useTranslation, useI18n } from '@/hooks/useTranslation'
import { useLanguage } from '@/hooks/useLanguage'

function MenuItemCard({ item }: { item: MenuItem }) {
  const { t } = useTranslation()    // For entity data
  const { t: ui } = useI18n()       // For UI strings
  const { isRTL } = useLanguage()

  return (
    <div className={isRTL ? 'text-right' : 'text-left'}>
      <h3>{t(item.nameI18n, item.name)}</h3>
      <p>{t(item.descriptionI18n, item.description)}</p>
      {!item.isAvailable && <Badge>{ui('menu.sold_out')}</Badge>}
      <Button>{ui('cart.add')}</Button>
    </div>
  )
}
```

---

## 8. RTL Support

### 8.1 Language Direction Configuration

```typescript
// RTL languages in our system
const RTL_LANGUAGES = ['ar']  // Arabic — expand as needed

// In Language table:
// code: 'ar', direction: 'rtl'
```

### 8.2 CSS/Tailwind Integration

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <LanguageDirectionProvider>
          {children}
        </LanguageDirectionProvider>
      </body>
    </html>
  )
}

// src/components/language-direction-provider.tsx
'use client'

import { useEffect } from 'react'
import { useLanguage } from '@/hooks/useLanguage'

export function LanguageDirectionProvider({ children }: { children: React.ReactNode }) {
  const { language, direction, fontFamily } = useLanguage()

  useEffect(() => {
    const html = document.documentElement
    html.lang = language
    html.dir = direction

    // Apply font family for specific scripts
    if (fontFamily) {
      document.body.style.fontFamily = `${fontFamily}, var(--font-sans)`
    } else {
      document.body.style.fontFamily = ''
    }
  }, [language, direction, fontFamily])

  return <>{children}</>
}
```

### 8.3 Tailwind RTL Utilities

```css
/* globals.css — add RTL-aware utilities */
[dir="rtl"] .rtl-flip {
  transform: scaleX(-1);
}

[dir="rtl"] .rtl-text-right {
  text-align: left;  /* Flip */
}

[dir="rtl"] .rtl-flex-row-reverse {
  flex-direction: row-reverse;
}
```

Or use `tailwindcss-rtl` plugin for automatic RTL variants:

```bash
npm install tailwindcss-rtl
```

```js
// tailwind.config.ts
plugins: [require('tailwindcss-rtl')]
```

```tsx
// Usage with RTL-aware classes:
<div className="flex flex-row rtl:flex-row-reverse">
  <span className="mr-2 rtl:ml-2 rtl:mr-0">Icon</span>
  <span>Text</span>
</div>
```

### 8.4 Ethiopian Script Fonts

Ethiopian languages (Amharic, Tigrinya, Afaan Oromo with Ethiopic script) need proper font support:

```css
/* Load Noto Sans Ethiopic for all Ethiopic-script languages */
@font-face {
  font-family: 'Noto Sans Ethiopic';
  src: url('/fonts/NotoSansEthiopic-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}
```

---

## 9. Translation Completion Tracking

### 9.1 Stat Computation

Stats are computed via a **materialized pattern** — updated on every translation write operation.

```typescript
// src/lib/translation-stats.ts

export async function recalculateTranslationStats(
  restaurantId: string,
  languageCode: string,
  entityType: string,
  prisma: PrismaClient
) {
  // Count total translatable fields
  let totalFields = 0
  let translatedFields = 0

  switch (entityType) {
    case 'menuItem': {
      const items = await prisma.menuItem.findMany({
        where: { restaurantId },
        select: { id: true, nameI18n: true, descriptionI18n: true },
      })
      for (const item of items) {
        totalFields += 2 // name + description
        const i18n = (item.nameI18n as Record<string, string>) || {}
        if (i18n[languageCode]) translatedFields++
        const descI18n = (item.descriptionI18n as Record<string, string>) || {}
        if (descI18n[languageCode]) translatedFields++
      }
      break
    }
    case 'menuCategory': {
      const cats = await prisma.menuCategory.findMany({
        where: { restaurantId },
        select: { id: true, nameI18n: true, descriptionI18n: true },
      })
      for (const cat of cats) {
        totalFields += 2
        const i18n = (cat.nameI18n as Record<string, string>) || {}
        if (i18n[languageCode]) translatedFields++
        const descI18n = (cat.descriptionI18n as Record<string, string>) || {}
        if (descI18n[languageCode]) translatedFields++
      }
      break
    }
    // ... similar for other entity types
  }

  const completionPct = totalFields > 0 ? Math.round((translatedFields / totalFields) * 100) : 100

  await prisma.translationStat.upsert({
    where: {
      restaurantId_languageCode_entityType: {
        restaurantId,
        languageCode,
        entityType,
      },
    },
    create: {
      restaurantId,
      languageCode,
      entityType,
      totalFields,
      translatedFields,
      verifiedFields: 0,
      completionPct,
    },
    update: {
      totalFields,
      translatedFields,
      completionPct,
    },
  })
}
```

### 9.2 Admin Dashboard Widget

```tsx
// Translation completion progress bars per language
function TranslationProgress({ restaurantId }: { restaurantId: string }) {
  const { data } = useSWR(`/api/restaurants/${restaurantId}/translations/stats`)

  return (
    <div className="space-y-3">
      {data?.languages?.map((lang) => (
        <div key={lang.code}>
          <div className="flex justify-between text-sm mb-1">
            <span>{lang.nameLocal}</span>
            <span className={lang.completion.overall < 50 ? 'text-red-500' : 'text-green-600'}>
              {lang.completion.overall}%
            </span>
          </div>
          <Progress value={lang.completion.overall} />
          <div className="text-xs text-muted-foreground mt-1">
            Menu: {lang.completion.menuItem.pct}% · Categories: {lang.completion.menuCategory.pct}%
          </div>
        </div>
      ))}
    </div>
  )
}
```

---

## 10. AI Auto-Translation Integration

### 10.1 Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Admin UI    │────►│  Job Queue   │────►│  Translation │
│  "Translate  │     │  (DB-based)  │     │  Worker      │
│   All to Am" │     │              │     │              │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                                 ▼
                    ┌──────────────────────────────────────┐
                    │  Provider Adapters                   │
                    │  ┌─────────┐ ┌───────┐ ┌─────────┐  │
                    │  │ OpenAI  │ │ Google │ │ DeepL   │  │
                    │  │ GPT-4o  │ │ Trans  │ │ API     │  │
                    │  └─────────┘ └───────┘ └─────────┘  │
                    └──────────────────────────────────────┘
```

### 10.2 Translation Worker

```typescript
// src/lib/translation-worker.ts

interface TranslationProvider {
  translate(
    texts: string[],
    sourceLang: string,
    targetLang: string,
    context?: string
  ): Promise<string[]>
}

class OpenAITranslationProvider implements TranslationProvider {
  async translate(texts: string[], sourceLang: string, targetLang: string, context?: string) {
    const systemPrompt = `You are a professional translator for a restaurant menu system.
Translate the following text from ${sourceLang} to ${targetLang}.
Context: ${context || 'Restaurant menu items and descriptions'}.
Preserve any HTML tags. Do not translate brand names.
Return only the translated text, one per line, matching the input order.`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: texts.join('\n---\n') },
        ],
        temperature: 0.3,
      }),
    })

    const data = await response.json()
    return data.choices[0].message.content.split('\n---\n')
  }
}
```

### 10.3 Job Processing

```typescript
// Process a translation job in batches of 10 items
export async function processTranslationJob(jobId: string, prisma: PrismaClient) {
  const job = await prisma.translationJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'pending') return

  await prisma.translationJob.update({
    where: { id: jobId },
    data: { status: 'in_progress', startedAt: new Date() },
  })

  const entityIds = JSON.parse(job.entityIds) as string[]
  const batchSize = 10
  let completed = 0
  let failed = 0
  const errors: Record<string, string> = {}

  for (let i = 0; i < entityIds.length; i += batchSize) {
    const batch = entityIds.slice(i, i + batchSize)

    try {
      // Fetch entities, extract translatable fields
      const entities = await fetchEntities(job.entityType, batch, prisma)
      const texts = entities.map((e: any) => e.name).filter(Boolean)

      // Translate
      const provider = new OpenAITranslationProvider()
      const translations = await provider.translate(
        texts,
        job.sourceLanguage,
        job.targetLanguage
      )

      // Write back to entity i18n columns
      for (let j = 0; j < entities.length; j++) {
        await updateEntityI18n(
          job.entityType,
          entities[j].id,
          job.targetLanguage,
          { name: translations[j] },
          prisma
        )
      }

      completed += batch.length
    } catch (error) {
      failed += batch.length
      batch.forEach(id => { errors[id] = String(error) })
    }

    // Update progress
    await prisma.translationJob.update({
      where: { id: jobId },
      data: {
        completedItems: completed,
        failedItems: failed,
        progress: Math.round(((completed + failed) / entityIds.length) * 100),
        errorDetails: Object.keys(errors).length > 0 ? JSON.stringify(errors) : undefined,
      },
    })
  }

  // Mark complete
  await prisma.translationJob.update({
    where: { id: jobId },
    data: {
      status: failed > 0 ? 'partially_completed' : 'completed',
      completedAt: new Date(),
    },
  })

  // Recalculate stats
  await recalculateTranslationStats(
    job.restaurantId,
    job.targetLanguage,
    job.entityType,
    prisma
  )
}
```

---

## 11. Migration Strategy

### 11.1 Overview

The migration happens in **4 phases** over multiple deployments, with zero downtime and full backward compatibility at each step.

```
Phase 1: Add columns & tables (additive, non-breaking)
Phase 2: Migrate data (nameAm → nameI18n.am)
Phase 3: Update API responses to include i18n fields
Phase 4: Remove deprecated columns (breaking — requires client migration)
```

### 11.2 Phase 1: Additive Schema Changes

**Goal**: Add all new columns and tables without breaking anything.

```sql
-- Migration: 001_add_i18n_columns.sql

-- 1. Add JSON i18n columns to existing tables
ALTER TABLE "Restaurant" ADD COLUMN "nameI18n" jsonb;
ALTER TABLE "Restaurant" ADD COLUMN "descriptionI18n" jsonb;
ALTER TABLE "Restaurant" ADD COLUMN "addressI18n" jsonb;
ALTER TABLE "Restaurant" ADD COLUMN "enabledLanguages" text DEFAULT '[]';

ALTER TABLE "Branch" ADD COLUMN "nameI18n" jsonb;
ALTER TABLE "Branch" ADD COLUMN "addressI18n" jsonb;

ALTER TABLE "Menu" ADD COLUMN "nameI18n" jsonb;
ALTER TABLE "Menu" ADD COLUMN "descriptionI18n" jsonb;

ALTER TABLE "MenuCategory" ADD COLUMN "nameI18n" jsonb;
ALTER TABLE "MenuCategory" ADD COLUMN "descriptionI18n" jsonb;

ALTER TABLE "MenuItem" ADD COLUMN "nameI18n" jsonb;
ALTER TABLE "MenuItem" ADD COLUMN "descriptionI18n" jsonb;

ALTER TABLE "ModifierGroup" ADD COLUMN "nameI18n" jsonb;
ALTER TABLE "ModifierOption" ADD COLUMN "nameI18n" jsonb;
ALTER TABLE "OrderItem" ADD COLUMN "nameI18n" jsonb;

ALTER TABLE "Promotion" ADD COLUMN "nameI18n" jsonb;
ALTER TABLE "Promotion" ADD COLUMN "descriptionI18n" jsonb;

ALTER TABLE "Floor" ADD COLUMN "nameI18n" jsonb;
ALTER TABLE "KitchenStation" ADD COLUMN "nameI18n" jsonb;

-- 2. Create new tables (see full DDL in Section 4)
-- Language, RestaurantLanguage, UIString, UIStringOverride, TranslationJob, TranslationStat

-- 3. Create indexes
CREATE INDEX "RestaurantLanguage_restaurantId_idx" ON "RestaurantLanguage"("restaurantId");
CREATE INDEX "RestaurantLanguage_restaurantId_isActive_idx" ON "RestaurantLanguage"("restaurantId", "isActive");
CREATE INDEX "UIString_group_idx" ON "UIString"("group");
CREATE INDEX "UIString_key_idx" ON "UIString"("key");
CREATE INDEX "UIStringOverride_restaurantId_idx" ON "UIStringOverride"("restaurantId");
CREATE INDEX "UIStringOverride_restaurantId_languageCode_idx" ON "UIStringOverride"("restaurantId", "languageCode");
CREATE INDEX "TranslationJob_restaurantId_idx" ON "TranslationJob"("restaurantId");
CREATE INDEX "TranslationJob_status_idx" ON "TranslationJob"("status");
CREATE INDEX "TranslationStat_restaurantId_languageCode_idx" ON "TranslationStat"("restaurantId", "languageCode");
CREATE INDEX "TranslationStat_restaurantId_idx" ON "TranslationStat"("restaurantId");
```

### 11.3 Phase 2: Data Migration Script

```sql
-- Migration: 002_migrate_nameAm_to_i18n.sql

-- Migrate Restaurant
UPDATE "Restaurant"
SET "nameI18n" = json_build_object('am', "nameAm")::jsonb
WHERE "nameAm" IS NOT NULL AND "nameAm" != '';

UPDATE "Restaurant"
SET "descriptionI18n" = json_build_object('am', "descriptionAm")::jsonb
WHERE "descriptionAm" IS NOT NULL AND "descriptionAm" != '';

-- Migrate Branch
UPDATE "Branch"
SET "nameI18n" = json_build_object('am', "nameAm")::jsonb
WHERE "nameAm" IS NOT NULL AND "nameAm" != '';

-- Migrate Menu
UPDATE "Menu"
SET "nameI18n" = json_build_object('am', "nameAm")::jsonb
WHERE "nameAm" IS NOT NULL AND "nameAm" != '';

UPDATE "Menu"
SET "descriptionI18n" = json_build_object('am', "descriptionAm")::jsonb
WHERE "descriptionAm" IS NOT NULL AND "descriptionAm" != '';

-- Migrate MenuCategory
UPDATE "MenuCategory"
SET "nameI18n" = json_build_object('am', "nameAm")::jsonb
WHERE "nameAm" IS NOT NULL AND "nameAm" != '';

UPDATE "MenuCategory"
SET "descriptionI18n" = json_build_object('am', "descriptionAm")::jsonb
WHERE "descriptionAm" IS NOT NULL AND "descriptionAm" != '';

-- Migrate MenuItem
UPDATE "MenuItem"
SET "nameI18n" = json_build_object('am', "nameAm")::jsonb
WHERE "nameAm" IS NOT NULL AND "nameAm" != '';

UPDATE "MenuItem"
SET "descriptionI18n" = json_build_object('am', "descriptionAm")::jsonb
WHERE "descriptionAm" IS NOT NULL AND "descriptionAm" != '';

-- Also merge from MenuItemTranslation table into nameI18n
-- (PostgreSQL-specific: merge existing JSON with new key)
UPDATE "MenuItem" mi
SET "nameI18n" = CASE
    WHEN mi."nameI18n" IS NOT NULL THEN
      mi."nameI18n"::jsonb || json_build_object(t.language, t.name)::jsonb
    ELSE
      json_build_object(t.language, t.name)::jsonb
  END,
  "descriptionI18n" = CASE
    WHEN mi."descriptionI18n" IS NOT NULL AND t.description IS NOT NULL THEN
      mi."descriptionI18n"::jsonb || json_build_object(t.language, t.description)::jsonb
    WHEN t.description IS NOT NULL THEN
      json_build_object(t.language, t.description)::jsonb
    ELSE mi."descriptionI18n"
  END
FROM "MenuItemTranslation" t
WHERE t."menuItemId" = mi.id
  AND t.language != 'en';  -- Skip 'en' since it's already in the default column

-- Migrate ModifierGroup
UPDATE "ModifierGroup"
SET "nameI18n" = json_build_object('am', "nameAm")::jsonb
WHERE "nameAm" IS NOT NULL AND "nameAm" != '';

-- Migrate ModifierOption
UPDATE "ModifierOption"
SET "nameI18n" = json_build_object('am', "nameAm")::jsonb
WHERE "nameAm" IS NOT NULL AND "nameAm" != '';

-- Migrate OrderItem
UPDATE "OrderItem"
SET "nameI18n" = json_build_object('am', "nameAm")::jsonb
WHERE "nameAm" IS NOT NULL AND "nameAm" != '';

-- Migrate Promotion
UPDATE "Promotion"
SET "nameI18n" = json_build_object('am', "nameAm")::jsonb
WHERE "nameAm" IS NOT NULL AND "nameAm" != '';

UPDATE "Promotion"
SET "descriptionI18n" = json_build_object('am', "descriptionAm")::jsonb
WHERE "descriptionAm" IS NOT NULL AND "descriptionAm" != '';

-- Seed Language table with initial languages
INSERT INTO "Language" ("id", "code", "name", "nameLocal", "direction", "fontFamily", "flagEmoji", "sortOrder", "createdAt", "updatedAt")
VALUES
  ('lang-en', 'en', 'English', 'English', 'ltr', NULL, '🇬🇧', 0, NOW(), NOW()),
  ('lang-am', 'am', 'Amharic', 'አማርኛ', 'ltr', 'Noto Sans Ethiopic', '🇪🇹', 1, NOW(), NOW()),
  ('lang-om', 'om', 'Oromo', 'Afaan Oromoo', 'ltr', 'Noto Sans Ethiopic', '🇪🇹', 2, NOW(), NOW()),
  ('lang-ti', 'ti', 'Tigrinya', 'ትግርኛ', 'ltr', 'Noto Sans Ethiopic', '🇪🇹', 3, NOW(), NOW()),
  ('lang-so', 'so', 'Somali', 'Soomaali', 'ltr', NULL, '🇸🇴', 4, NOW(), NOW()),
  ('lang-aa', 'aa', 'Afar', 'Qafar', 'ltr', NULL, '🇪🇹', 5, NOW(), NOW()),
  ('lang-sid', 'sid', 'Sidamo', 'Sidaamu Afo', 'ltr', NULL, '🇪🇹', 6, NOW(), NOW()),
  ('lang-ar', 'ar', 'Arabic', 'العربية', 'rtl', 'Noto Naskh Arabic', '🇸🇦', 7, NOW(), NOW()),
  ('lang-it', 'it', 'Italian', 'Italiano', 'ltr', NULL, '🇮🇹', 8, NOW(), NOW()),
  ('lang-zh', 'zh', 'Chinese', '中文', 'ltr', 'Noto Sans SC', '🇨🇳', 9, NOW(), NOW()),
  ('lang-fr', 'fr', 'French', 'Français', 'ltr', NULL, '🇫🇷', 10, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- Seed RestaurantLanguage for existing restaurants (they all have 'en' + 'am')
INSERT INTO "RestaurantLanguage" ("id", "restaurantId", "languageCode", "isDefault", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT
  'rl-en-' || r.id,
  r.id,
  'en',
  (CASE WHEN r."defaultLanguage" = 'en' THEN true ELSE false END),
  true,
  0,
  NOW(),
  NOW()
FROM "Restaurant" r
ON CONFLICT ("restaurantId", "languageCode") DO NOTHING;

INSERT INTO "RestaurantLanguage" ("id", "restaurantId", "languageCode", "isDefault", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT
  'rl-am-' || r.id,
  r.id,
  'am',
  (CASE WHEN r."defaultLanguage" = 'am' THEN true ELSE false END),
  true,
  1,
  NOW(),
  NOW()
FROM "Restaurant" r
ON CONFLICT ("restaurantId", "languageCode") DO NOTHING;

-- Update Restaurant.enabledLanguages
UPDATE "Restaurant"
SET "enabledLanguages" = '["en","am"]'
WHERE "enabledLanguages" = '[]' OR "enabledLanguages" IS NULL;
```

### 11.4 Phase 3: Update API Responses

Add `nameI18n`/`descriptionI18n` fields to all API responses alongside existing `nameAm`/`descriptionAm`:

```typescript
// API response transformer — both old and new formats during migration
function addI18nFields(entity: any) {
  return {
    ...entity,
    // Keep old format for backward compatibility
    nameAm: entity.nameAm || (entity.nameI18n as Record<string, string>)?.am || null,
    descriptionAm: entity.descriptionAm || (entity.descriptionI18n as Record<string, string>)?.am || null,
    // Add new format
    nameI18n: entity.nameI18n,
    descriptionI18n: entity.descriptionI18n,
  }
}
```

### 11.5 Phase 4: Remove Deprecated Columns (Future)

After all clients are migrated to use `nameI18n`/`descriptionI18n`:

```sql
-- Migration: 003_drop_deprecated_columns.sql (run after full client migration)

ALTER TABLE "Restaurant" DROP COLUMN "nameAm";
ALTER TABLE "Restaurant" DROP COLUMN "descriptionAm";
ALTER TABLE "Branch" DROP COLUMN "nameAm";
ALTER TABLE "Menu" DROP COLUMN "nameAm";
ALTER TABLE "Menu" DROP COLUMN "descriptionAm";
ALTER TABLE "MenuCategory" DROP COLUMN "nameAm";
ALTER TABLE "MenuCategory" DROP COLUMN "descriptionAm";
ALTER TABLE "MenuItem" DROP COLUMN "nameAm";
ALTER TABLE "MenuItem" DROP COLUMN "descriptionAm";
ALTER TABLE "ModifierGroup" DROP COLUMN "nameAm";
ALTER TABLE "ModifierOption" DROP COLUMN "nameAm";
ALTER TABLE "OrderItem" DROP COLUMN "nameAm";
ALTER TABLE "Promotion" DROP COLUMN "nameAm";
ALTER TABLE "Promotion" DROP COLUMN "descriptionAm";

-- Drop deprecated MenuItemTranslation table
DROP TABLE "MenuItemTranslation";
```

---

## 12. Performance Considerations

### 12.1 JSON Column Indexing (PostgreSQL)

```sql
-- GIN index for fast JSON key lookups on high-traffic tables
CREATE INDEX idx_menuitem_name_i18n ON "MenuItem" USING gin ("nameI18n");
CREATE INDEX idx_menuitem_desc_i18n ON "MenuItem" USING gin ("descriptionI18n");

-- For checking if a specific language translation exists
CREATE INDEX idx_menuitem_has_am ON "MenuItem" (("nameI18n"::jsonb ? 'am'))
  WHERE "nameI18n" IS NOT NULL;
```

### 12.2 UI String Bundle Caching

- **Server-side**: Cache bundles in Redis with key `i18n:bundle:{lang}:{restaurantId}`, TTL 5 minutes
- **Client-side**: In-memory Map cache per language per restaurant; invalidated on language change
- **CDN**: UI string bundles are cacheable at the CDN layer (immutable per lang+version)

### 12.3 Read Path Optimization

```typescript
// Server-side: resolve i18n fields before sending to client
function resolveEntityForLang(entity: any, lang: string, defaultLang: string = 'en') {
  return {
    ...entity,
    name: entity.nameI18n?.[lang] || entity.nameI18n?.[defaultLang] || entity.name,
    description: entity.descriptionI18n?.[lang] || entity.descriptionI18n?.[defaultLang] || entity.description,
  }
}

// Use in API routes for customer-facing endpoints
// This avoids sending full i18n JSON to customers (smaller payload)
```

### 12.4 Write Path Optimization

```typescript
// Update a single language in the JSON column without reading first
// PostgreSQL jsonb_set with upsert behavior
await prisma.$executeRaw`
  UPDATE "MenuItem"
  SET "nameI18n" = jsonb_set(
    COALESCE("nameI18n", '{}'::jsonb),
    '{${languageCode}}',
    ${value}::jsonb,
    true
  )
  WHERE id = ${entityId}
`
```

### 12.5 OrderItem Snapshot Optimization

OrderItem freezes translations at order time into `nameI18n` — no runtime resolution needed for historical orders:

```typescript
// When creating an order item, snapshot ALL enabled language translations
const menuItem = await prisma.menuItem.findUnique({ where: { id: itemId } })
await prisma.orderItem.create({
  data: {
    name: menuItem.name,
    nameI18n: menuItem.nameI18n,  // Snapshot all translations
    // ...
  }
})
```

---

## 13. Implementation Phases

### Phase 1: Foundation (Week 1-2)

- [ ] Add new Prisma models (`Language`, `RestaurantLanguage`, `UIString`, `UIStringOverride`, `TranslationJob`, `TranslationStat`)
- [ ] Add JSON i18n columns to existing models
- [ ] Run Phase 1+2 migrations
- [ ] Create `useLanguage` hook with Zustand + persist
- [ ] Create `useTranslation` hook
- [ ] Seed `Language` table with initial 11 languages
- [ ] Seed `RestaurantLanguage` for existing restaurants

### Phase 2: API Layer (Week 2-3)

- [ ] Implement language management API endpoints
- [ ] Add `?lang=` parameter support to existing data endpoints
- [ ] Implement UI string bundle API
- [ ] Add i18n field resolution in API responses
- [ ] Implement language resolution middleware

### Phase 3: Client Migration (Week 3-4)

- [ ] Migrate customer-app.tsx from `t(en, am, lang)` to `useTranslation()`
- [ ] Migrate customer menu page (page.tsx)
- [ ] Migrate customer-store.ts types
- [ ] Migrate admin store and dashboard
- [ ] Implement RTL support (LanguageDirectionProvider, Tailwind RTL)
- [ ] Add language picker component with all enabled languages

### Phase 4: UI String System (Week 4-5)

- [ ] Extract all hardcoded strings from components into `UIString` table
- [ ] Implement `useI18n` hook
- [ ] Create admin UI for managing UI strings
- [ ] Create admin UI for restaurant language overrides
- [ ] Seed platform UI strings for en + am

### Phase 5: AI Translation (Week 5-6)

- [ ] Implement translation job system
- [ ] Implement OpenAI translation provider
- [ ] Create admin UI for triggering AI translation
- [ ] Implement job progress tracking UI
- [ ] Add translation completion stats dashboard

### Phase 6: Polish & Cleanup (Week 6-7)

- [ ] Performance testing and optimization
- [ ] Add GIN indexes for JSON columns
- [ ] Implement UI string bundle caching (Redis)
- [ ] Add font loading for Ethiopic and Arabic scripts
- [ ] Translation quality review workflow
- [ ] Documentation and developer guide
- [ ] Phase 4 migration: remove deprecated `nameAm`/`descriptionAm` columns

---

## Appendix A: Initial UI String Keys

```typescript
// Platform UI strings to seed
const INITIAL_UI_STRINGS = [
  // Common
  { key: 'common.loading', group: 'common', defaultValue: 'Loading...' },
  { key: 'common.error', group: 'common', defaultValue: 'Something went wrong' },
  { key: 'common.retry', group: 'common', defaultValue: 'Try Again' },
  { key: 'common.cancel', group: 'common', defaultValue: 'Cancel' },
  { key: 'common.save', group: 'common', defaultValue: 'Save' },
  { key: 'common.delete', group: 'common', defaultValue: 'Delete' },
  { key: 'common.close', group: 'common', defaultValue: 'Close' },
  { key: 'common.back', group: 'common', defaultValue: 'Back' },
  { key: 'common.confirm', group: 'common', defaultValue: 'Confirm' },
  { key: 'common.yes', group: 'common', defaultValue: 'Yes' },
  { key: 'common.no', group: 'common', defaultValue: 'No' },
  { key: 'common.search', group: 'common', defaultValue: 'Search...' },

  // Menu
  { key: 'menu.search_placeholder', group: 'menu', defaultValue: 'Search menu...' },
  { key: 'menu.no_items', group: 'menu', defaultValue: 'No items found' },
  { key: 'menu.sold_out', group: 'menu', defaultValue: 'Sold Out' },
  { key: 'menu.vegetarian', group: 'menu', defaultValue: 'Vegetarian' },
  { key: 'menu.spicy', group: 'menu', defaultValue: 'Spicy' },
  { key: 'menu.popular', group: 'menu', defaultValue: 'Popular' },
  { key: 'menu.combo', group: 'menu', defaultValue: 'Combo' },
  { key: 'menu.includes', group: 'menu', defaultValue: 'Includes' },

  // Item Detail
  { key: 'item.required', group: 'item', defaultValue: 'Required' },
  { key: 'item.choose_one', group: 'item', defaultValue: 'Choose 1' },
  { key: 'item.add_ons', group: 'item', defaultValue: 'Add-ons' },
  { key: 'item.special_instructions', group: 'item', defaultValue: 'Special Instructions' },
  { key: 'item.instructions_placeholder', group: 'item', defaultValue: 'Any allergies or preferences...' },

  // Cart
  { key: 'cart.title', group: 'cart', defaultValue: 'Your Cart' },
  { key: 'cart.empty', group: 'cart', defaultValue: 'Your cart is empty' },
  { key: 'cart.browse_menu', group: 'cart', defaultValue: 'Browse the menu to add items' },
  { key: 'cart.add', group: 'cart', defaultValue: 'Add to Cart' },
  { key: 'cart.added', group: 'cart', defaultValue: 'Added!' },
  { key: 'cart.item', group: 'cart', defaultValue: 'item' },
  { key: 'cart.items', group: 'cart', defaultValue: 'items' },
  { key: 'cart.subtotal', group: 'cart', defaultValue: 'Subtotal' },
  { key: 'cart.tax', group: 'cart', defaultValue: 'Tax' },
  { key: 'cart.service_charge', group: 'cart', defaultValue: 'Service Charge' },
  { key: 'cart.total', group: 'cart', defaultValue: 'Total' },
  { key: 'cart.discount', group: 'cart', defaultValue: 'Discount' },
  { key: 'cart.loyalty_points', group: 'cart', defaultValue: 'Loyalty Points' },

  // Order
  { key: 'order.place', group: 'order', defaultValue: 'Place Order' },
  { key: 'order.placing', group: 'order', defaultValue: 'Placing your order...' },
  { key: 'order.status.pending', group: 'order', defaultValue: 'Pending' },
  { key: 'order.status.accepted', group: 'order', defaultValue: 'Accepted' },
  { key: 'order.status.preparing', group: 'order', defaultValue: 'Preparing' },
  { key: 'order.status.ready', group: 'order', defaultValue: 'Ready' },
  { key: 'order.status.served', group: 'order', defaultValue: 'Served' },
  { key: 'order.estimated_time', group: 'order', defaultValue: 'Estimated time: {minutes} min' },

  // Payment
  { key: 'payment.title', group: 'payment', defaultValue: 'Payment' },
  { key: 'payment.cash', group: 'payment', defaultValue: 'Cash' },
  { key: 'payment.telebirr', group: 'payment', defaultValue: 'Telebirr' },
  { key: 'payment.chapa', group: 'payment', defaultValue: 'Chapa' },
  { key: 'payment.cbe_birr', group: 'payment', defaultValue: 'CBE Birr' },
  { key: 'payment.processing', group: 'payment', defaultValue: 'Processing payment...' },
  { key: 'payment.success', group: 'payment', defaultValue: 'Payment successful!' },
  { key: 'payment.failed', group: 'payment', defaultValue: 'Payment failed' },

  // Welcome
  { key: 'welcome.start_ordering', group: 'welcome', defaultValue: 'Start Ordering' },
  { key: 'welcome.scan_qr', group: 'welcome', defaultValue: 'Scan QR code to order directly from your table' },
  { key: 'welcome.table', group: 'welcome', defaultValue: 'Table' },

  // Waiter
  { key: 'waiter.call', group: 'waiter', defaultValue: 'Call Waiter' },
  { key: 'waiter.request_bill', group: 'waiter', defaultValue: 'Request Bill' },
  { key: 'waiter.request_menu', group: 'waiter', defaultValue: 'Request Menu' },
  { key: 'waiter.sent', group: 'waiter', defaultValue: 'Waiter called!' },
]
```

## Appendix B: JSON i18n Field Type Definition

```typescript
// src/types/i18n.ts

/**
 * Type for i18n JSON columns stored in the database.
 * Keys are ISO language codes, values are translated strings.
 */
export type I18nField = Record<string, string> | null

/**
 * Entity that supports i18n fields.
 */
export interface I18nEntity {
  name: string
  nameI18n: I18nField
  description?: string
  descriptionI18n?: I18nField
}

/**
 * Resolve an i18n field with fallback chain.
 */
export function resolveI18n(
  field: I18nField,
  fallback: string,
  lang: string,
  defaultLang: string = 'en'
): string {
  if (!field) return fallback
  return field[lang] ?? field[defaultLang] ?? field['en'] ?? fallback
}
```

## Appendix C: Prisma JSON Column Type Safety

```typescript
// src/types/prisma-i18n.ts

import { Prisma } from '@prisma/client'

// Prisma returns Json? fields as `Prisma.JsonValue | null`
// We need to cast them to our I18nField type

export function asI18nField(json: Prisma.JsonValue | null): Record<string, string> | null {
  if (json === null || json === undefined) return null
  if (typeof json === 'object' && !Array.isArray(json)) {
    return json as Record<string, string>
  }
  return null
}

// Usage in API routes:
// const nameI18n = asI18nField(item.nameI18n)
// const name = resolveI18n(nameI18n, item.name, lang, restaurant.defaultLanguage)
```
