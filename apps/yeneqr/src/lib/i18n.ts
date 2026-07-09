// ============================================================
// Yene QR — Core Localization / i18n Library
// Handles translation resolution, fallback chains, and helpers
// ============================================================

/**
 * Supported language codes — sourced from the Language table but also
 * available as a TypeScript union for compile-time safety.
 */
export type LanguageCode = string // Flexible: 'en' | 'am' | 'om' | 'ti' | 'so' | 'aa' | 'sid' | 'ar' | 'it' | 'zh' | 'fr' | ...

/**
 * Language configuration as stored in the DB and fetched by the client.
 */
export interface LanguageConfig {
  code: string
  name: string
  nameLocal: string
  direction: 'ltr' | 'rtl'
  fontFamily: string | null
  flagEmoji: string | null
  isDefault: boolean
  isActive: boolean
  isRequired: boolean
  sortOrder: number
  completionPct: number
}

/**
 * i18n JSON format — stored as JSON string in SQLite, parsed to this type.
 * Keys are language codes, values are translations.
 * Example: { "am": "ሽሮ ወጥ", "om": "Shiro Wot", "ar": "شيرو وت" }
 */
export type I18nJson = Record<string, string>

/**
 * Parse an i18n JSON string from the database.
 * Returns null if the string is empty, null, or invalid JSON.
 */
export function parseI18nJson(i18nString: string | null | undefined): I18nJson | null {
  if (!i18nString) return null
  try {
    const parsed = JSON.parse(i18nString)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as I18nJson
    }
    return null
  } catch {
    return null
  }
}

/**
 * Serialize an i18n JSON object for database storage.
 */
export function serializeI18nJson(i18n: I18nJson | null | undefined): string | null {
  if (!i18n || Object.keys(i18n).length === 0) return null
  return JSON.stringify(i18n)
}

/**
 * Resolve a translatable field with full fallback chain:
 *   requested language → restaurant default language → English → fallback string
 *
 * @param i18nJson - The parsed i18n JSON object (or null)
 * @param fallback - The default-language value (entity.name, entity.description, etc.)
 * @param lang - The requested language code
 * @param defaultLang - The restaurant's default language (usually 'en')
 * @returns The resolved string in the best available language
 */
export function resolveI18nField(
  i18nJson: I18nJson | null | undefined,
  fallback: string,
  lang: string,
  defaultLang: string = 'en'
): string {
  if (!i18nJson) return fallback

  // Chain: requested → default → en → fallback
  return i18nJson[lang]
    ?? i18nJson[defaultLang]
    ?? i18nJson['en']
    ?? fallback
}

/**
 * Resolve a translatable field from a raw i18n JSON string (as stored in DB).
 * Combines parsing and resolution in one step.
 */
export function resolveI18nString(
  i18nString: string | null | undefined,
  fallback: string,
  lang: string,
  defaultLang: string = 'en'
): string {
  const i18nJson = parseI18nJson(i18nString)
  return resolveI18nField(i18nJson, fallback, lang, defaultLang)
}

/**
 * Set a translation value in an i18n JSON object.
 * Returns a new object (immutable).
 */
export function setI18nValue(
  i18nJson: I18nJson | null,
  lang: string,
  value: string
): I18nJson {
  const current = i18nJson || {}
  if (value === '') {
    // Remove the translation if empty
    const { [lang]: _, ...rest } = current
    return Object.keys(rest).length > 0 ? rest : {}
  }
  return { ...current, [lang]: value }
}

/**
 * Get the direction for a language code.
 */
export function getLanguageDirection(code: string): 'ltr' | 'rtl' {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur']
  return rtlLanguages.includes(code) ? 'rtl' : 'ltr'
}

/**
 * Merge old nameAm/nameEn pattern into new i18n JSON format.
 * Used during migration and backward compatibility.
 */
export function migrateAmharicToI18n(
  nameAm: string | null | undefined,
  existingI18n: I18nJson | null = null
): I18nJson | null {
  if (!nameAm) return existingI18n
  const merged = { ...(existingI18n || {}), am: nameAm }
  return Object.keys(merged).length > 0 ? merged : null
}

/**
 * Universal translation helper — bridge between old and new formats.
 *
 * NEW FORMAT: t(nameI18n, name) — i18nJson is first arg, fallback string is second
 *   t({ am: 'ሐበሻ' }, 'Habesha') → 'ሐበሻ' (if lang is 'am')
 *
 * OLD FORMAT: t('English text', 'አማርኛ ጽሑፍ', 'am') — backward compatible
 *   t('Hello', 'ሰላም', 'am') → 'ሰላም' (if lang is 'am')
 */
export function t(
  i18nOrEn: I18nJson | string | null | undefined,
  fallbackOrAm: string | null | undefined,
  lang?: string,
  defaultLang: string = 'en'
): string {
  // NEW format: t(nameI18n, name) — first arg is an i18n JSON object
  if (i18nOrEn && typeof i18nOrEn === 'object') {
    return resolveI18nField(
      i18nOrEn as I18nJson,
      typeof fallbackOrAm === 'string' ? fallbackOrAm : '',
      lang || defaultLang,
      defaultLang
    )
  }

  // OLD format: t('English', 'አማርኛ', 'am') — backward compatible
  if (typeof i18nOrEn === 'string') {
    if (lang === 'am' && fallbackOrAm) return fallbackOrAm
    return i18nOrEn
  }

  return typeof fallbackOrAm === 'string' ? fallbackOrAm : ''
}

/**
 * Get the font family CSS for a given language configuration.
 */
export function getLanguageFontCSS(config: LanguageConfig | null): string {
  if (!config?.fontFamily) return ''
  return `font-family: '${config.fontFamily}', sans-serif;`
}

/**
 * Default platform languages — used for seeding and initial setup.
 */
export const DEFAULT_LANGUAGES: Array<{
  code: string
  name: string
  nameLocal: string
  direction: 'ltr' | 'rtl'
  fontFamily: string | null
  flagEmoji: string | null
  sortOrder: number
}> = [
  { code: 'en', name: 'English', nameLocal: 'English', direction: 'ltr', fontFamily: null, flagEmoji: '🇬🇧', sortOrder: 0 },
  { code: 'am', name: 'Amharic', nameLocal: 'አማርኛ', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: '🇪🇹', sortOrder: 1 },
  { code: 'om', name: 'Oromo', nameLocal: 'Afaan Oromoo', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: '🇪🇹', sortOrder: 2 },
  { code: 'ti', name: 'Tigrinya', nameLocal: 'ትግርኛ', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: '🇪🇹', sortOrder: 3 },
  { code: 'so', name: 'Somali', nameLocal: 'Soomaali', direction: 'ltr', fontFamily: null, flagEmoji: '🇸🇴', sortOrder: 4 },
  { code: 'aa', name: 'Afar', nameLocal: 'Afaraf', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: '🇪🇹', sortOrder: 5 },
  { code: 'sid', name: 'Sidamo', nameLocal: 'Sidaamu Afo', direction: 'ltr', fontFamily: 'Noto Sans Ethiopic', flagEmoji: '🇪🇹', sortOrder: 6 },
  { code: 'ar', name: 'Arabic', nameLocal: 'العربية', direction: 'rtl', fontFamily: 'Noto Naskh Arabic', flagEmoji: '🇸🇦', sortOrder: 7 },
  { code: 'it', name: 'Italian', nameLocal: 'Italiano', direction: 'ltr', fontFamily: null, flagEmoji: '🇮🇹', sortOrder: 8 },
  { code: 'zh', name: 'Chinese', nameLocal: '中文', direction: 'ltr', fontFamily: 'Noto Sans SC', flagEmoji: '🇨🇳', sortOrder: 9 },
  { code: 'fr', name: 'French', nameLocal: 'Français', direction: 'ltr', fontFamily: null, flagEmoji: '🇫🇷', sortOrder: 10 },
  { code: 'hi', name: 'Hindi', nameLocal: 'हिन्दी', direction: 'ltr', fontFamily: 'Noto Sans Devanagari', flagEmoji: '🇮🇳', sortOrder: 11 },
  { code: 'ml', name: 'Malayalam', nameLocal: 'മലയാളം', direction: 'ltr', fontFamily: 'Noto Sans Malayalam', flagEmoji: '🇮🇳', sortOrder: 12 },
]

/**
 * Cuisine types with translations for each supported language.
 * Used in registration and restaurant settings.
 */
export const CUISINE_TYPES_I18N: Array<{
  code: string
  nameI18n: Record<string, string>
}> = [
  { code: 'ethiopian', nameI18n: { en: 'Ethiopian', am: 'ኢትዮጵያዊ', om: 'Itoophiyaa', ti: 'ኢትዮጵያዊ', so: 'Itoobiya', ar: 'إثيوبي', it: 'Etiope', zh: '埃塞俄比亚' } },
  { code: 'italian', nameI18n: { en: 'Italian', am: 'ጣሊያናዊ', om: 'Xaaliyaanii', ti: 'ጣሊያናዊ', ar: 'إيطالي', it: 'Italiano', zh: '意大利' } },
  { code: 'chinese', nameI18n: { en: 'Chinese', am: 'ቻይናዊ', om: 'Shaayinaa', ti: 'ቻይናዊ', ar: 'صيني', it: 'Cinese', zh: '中国' } },
  { code: 'indian', nameI18n: { en: 'Indian', am: 'ህንዳዊ', om: 'Indiyaa', ti: 'ህንዳዊ', ar: 'هندي', it: 'Indiano', zh: '印度' } },
  { code: 'mexican', nameI18n: { en: 'Mexican', am: 'ሜክሲካዊ', om: 'Meksikaa', ti: 'ሜክሲካዊ', ar: 'مكسيكي', it: 'Messicano', zh: '墨西哥' } },
  { code: 'japanese', nameI18n: { en: 'Japanese', am: 'ጃፓናዊ', om: 'Jaapaanaa', ti: 'ጃፓናዊ', ar: 'ياباني', it: 'Giapponese', zh: '日本' } },
  { code: 'continental', nameI18n: { en: 'Continental', am: 'ኮንቲኔንታል', om: 'Kontinentaal', ti: 'ኮንቲኔንታል', ar: 'قاري', it: 'Continentale', zh: '欧陆' } },
  { code: 'fusion', nameI18n: { en: 'Fusion', am: 'ፊውዥን', om: 'Fyuushinii', ti: 'ፊውዥን', ar: 'فيوجن', it: 'Fusion', zh: '融合' } },
  { code: 'other', nameI18n: { en: 'Other', am: 'ሌላ', om: 'Kan biraa', ti: 'ኻላ', so: 'Kale', ar: 'آخر', it: 'Altro', zh: '其他' } },
]
