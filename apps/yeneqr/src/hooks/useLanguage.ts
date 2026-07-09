'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LanguageConfig } from '@/lib/i18n'

interface LanguageState {
  language: string                    // Current language code: 'en', 'am', 'om', etc.
  enabledLanguages: LanguageConfig[]  // Languages available for this restaurant
  defaultLanguage: string             // Restaurant's default language
  _hasRehydrated: boolean             // Track whether persist has rehydrated
  setLanguage: (lang: string) => void
  setEnabledLanguages: (languages: LanguageConfig[], defaultLang: string) => void
  isRTL: () => boolean
  getDirection: () => 'ltr' | 'rtl'
  getFontFamily: () => string | null
  getLanguageConfig: () => LanguageConfig | undefined
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'en',
      enabledLanguages: [],
      defaultLanguage: 'en',
      _hasRehydrated: false,

      setLanguage: (lang: string) => {
        set({ language: lang })
        // Set cookie for server-side rendering
        if (typeof document !== 'undefined') {
          document.cookie = `yeneqr_lang=${lang};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
          // Set HTML dir attribute for RTL
          const direction = get().getDirection()
          document.documentElement.dir = direction
          document.documentElement.lang = lang
          // Apply font family
          const fontFamily = get().getFontFamily()
          if (fontFamily) {
            document.documentElement.style.setProperty('--lang-font', `'${fontFamily}', sans-serif`)
          } else {
            document.documentElement.style.removeProperty('--lang-font')
          }
        }
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

      getLanguageConfig: () => {
        const lang = get().language
        return get().enabledLanguages.find(l => l.code === lang)
      },
    }),
    {
      name: 'yeneqr_language',     // localStorage key
      partialize: (state) => ({
        language: state.language,
        defaultLanguage: state.defaultLanguage,
      }),
      skipHydration: true,  // Prevent zustand from rehydrating before React's first render
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state._hasRehydrated = true
          }
        }
      },
    }
  )
)

/**
 * Rehydrate the language store from localStorage.
 * Must be called inside a useEffect (after mount) to avoid hydration mismatch.
 */
export function rehydrateLanguageStore() {
  useLanguageStore.persist.rehydrate()
}

/**
 * Selectors that compute derived values from raw state.
 * These avoid calling methods inside selectors, which is a Zustand anti-pattern
 * that can cause infinite re-renders (methods create new references each call).
 */
function selectIsRTL(s: LanguageState) {
  const config = s.enabledLanguages.find(l => l.code === s.language)
  return config?.direction === 'rtl'
}

function selectDirection(s: LanguageState): 'ltr' | 'rtl' {
  const config = s.enabledLanguages.find(l => l.code === s.language)
  return config?.direction || 'ltr'
}

function selectFontFamily(s: LanguageState): string | null {
  const config = s.enabledLanguages.find(l => l.code === s.language)
  return config?.fontFamily || null
}

/**
 * React hook for language management.
 * Provides current language, direction, and language switching.
 * Uses individual selectors to minimize re-renders.
 * IMPORTANT: Rehydration must be triggered via useEffect (see LanguageSwitcher or rehydrateLanguageStore).
 *
 * NOTE: Do NOT call store methods (isRTL(), getDirection(), etc.) inside selectors.
 * They read state via get() and return new values on every evaluation, which can
 * trigger infinite re-render loops. Use the pure selector functions above instead.
 */
export function useLanguage() {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const enabledLanguages = useLanguageStore((s) => s.enabledLanguages)
  const setEnabledLanguages = useLanguageStore((s) => s.setEnabledLanguages)
  const defaultLanguage = useLanguageStore((s) => s.defaultLanguage)
  const isRTL = useLanguageStore(selectIsRTL)
  const direction = useLanguageStore(selectDirection)
  const fontFamily = useLanguageStore(selectFontFamily)
  const hasRehydrated = useLanguageStore((s) => s._hasRehydrated)

  return {
    language,
    setLanguage,
    enabledLanguages,
    setEnabledLanguages,
    defaultLanguage,
    isRTL,
    direction,
    fontFamily,
    hasRehydrated,
  }
}
