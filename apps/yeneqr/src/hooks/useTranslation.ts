'use client'

import { useLanguageStore } from './useLanguage'
import { resolveI18nField, parseI18nJson, type I18nJson } from '@/lib/i18n'

/**
 * Hook that provides a `t()` function for resolving entity data translations.
 *
 * Usage with NEW format (i18n JSON):
 *   const { t } = useTranslation()
 *   <h1>{t(item.nameI18n, item.name)}</h1>
 *   <p>{t(item.descriptionI18n, item.description)}</p>
 *
 * Usage with OLD format (nameAm/nameEn pattern — backward compatible):
 *   const { tLegacy } = useTranslation()
 *   <h1>{tLegacy(item.name, item.nameAm)}</h1>
 */
export function useTranslation() {
  const language = useLanguageStore((s) => s.language)
  const defaultLanguage = useLanguageStore((s) => s.defaultLanguage)

  /**
   * Resolve a translatable field using the new i18n JSON format.
   * @param i18nJson - The i18n JSON object from the entity (already parsed)
   * @param fallback - The default-language value (entity.name, entity.description, etc.)
   */
  function t(i18nJson: I18nJson | null | undefined, fallback: string): string {
    return resolveI18nField(i18nJson, fallback, language, defaultLanguage)
  }

  /**
   * Resolve a translatable field from a raw i18n JSON string (as stored in DB).
   * Parses the JSON string first, then resolves.
   */
  function tRaw(i18nString: string | null | undefined, fallback: string): string {
    const i18nJson = parseI18nJson(i18nString)
    return resolveI18nField(i18nJson, fallback, language, defaultLanguage)
  }

  /**
   * Legacy resolver for the old nameEn/nameAm pattern.
   * @param enValue - English/default value
   * @param amValue - Amharic value (or any secondary language value)
   */
  function tLegacy(enValue: string, amValue: string | null | undefined): string {
    if (language !== defaultLanguage && language !== 'en' && amValue) return amValue
    return enValue
  }

  /**
   * Resolve with explicit language override.
   */
  function tInLang(
    i18nJson: I18nJson | null | undefined,
    fallback: string,
    overrideLang: string
  ): string {
    return resolveI18nField(i18nJson, fallback, overrideLang, defaultLanguage)
  }

  return { t, tRaw, tLegacy, tInLang, language, defaultLanguage }
}
