'use client';

import { useEffect, useRef, useState } from 'react';
import { useLanguageStore, rehydrateLanguageStore } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Check, Star } from 'lucide-react';
import type { LanguageConfig } from '@/lib/i18n';

interface LanguageSwitcherProps {
  restaurantId?: string;
  variant?: 'button' | 'icon';
  className?: string;
}

export function LanguageSwitcher({ restaurantId, variant = 'button', className }: LanguageSwitcherProps) {
  // Use selectors to avoid re-rendering on unrelated store changes
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const enabledLanguages = useLanguageStore((s) => s.enabledLanguages);
  const setEnabledLanguages = useLanguageStore((s) => s.setEnabledLanguages);
  const defaultLanguage = useLanguageStore((s) => s.defaultLanguage);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [restaurantEnabledCodes, setRestaurantEnabledCodes] = useState<Set<string>>(new Set());
  const [restaurantDefaultCode, setRestaurantDefaultCode] = useState<string | null>(null);

  // Keep a ref to defaultLanguage so the fetch effect doesn't re-run when it changes
  const defaultLanguageRef = useRef(defaultLanguage);
  defaultLanguageRef.current = defaultLanguage;

  // Wait until after mount to render dynamic content — prevents hydration mismatch
  // Also rehydrate the language store from localStorage (safe: after React hydration)
  useEffect(() => {
    rehydrateLanguageStore();
    setMounted(true);
  }, []);

  // Fetch all platform languages + restaurant-specific enabled info
  // Only re-run when restaurantId changes (NOT when defaultLanguage changes — that would cause re-render loops)
  useEffect(() => {
    let cancelled = false;

    async function fetchLanguages() {
      setLoading(true);
      try {
        // Always fetch ALL platform languages — the dashboard UI should be switchable to any language
        const platformRes = await fetch('/api/i18n/languages');
        const platformData = platformRes.ok ? await platformRes.json() : null;

        if (!platformData?.languages || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }

        const allLangs: LanguageConfig[] = platformData.languages.map((l: any) => ({
          code: l.code,
          name: l.name,
          nameLocal: l.nameLocal,
          direction: l.direction,
          fontFamily: l.fontFamily,
          flagEmoji: l.flagEmoji,
          isDefault: l.code === 'en',
          isActive: true,
          isRequired: false,
          sortOrder: l.sortOrder || 0,
          completionPct: 0,
        }));

        // If we have a restaurant context, also fetch restaurant-specific language info
        // to know which languages are enabled for the restaurant's customers
        if (restaurantId) {
          try {
            const restRes = await fetch(`/api/restaurants/${restaurantId}/i18n/languages`);
            const restData = restRes.ok ? await restRes.json() : null;

            if (restData?.enabledLanguages && !cancelled) {
              const enabledCodes = new Set(
                restData.enabledLanguages
                  .filter((l: any) => l.isActive !== false)
                  .map((l: any) => l.code)
              );
              setRestaurantEnabledCodes(enabledCodes);

              const defaultCode = restData.defaultLanguage ||
                restData.enabledLanguages.find((l: any) => l.isDefault)?.code || null;
              setRestaurantDefaultCode(defaultCode);

              // Merge completion stats from restaurant data into platform languages
              const completionMap = new Map<string, number>();
              for (const rl of restData.enabledLanguages) {
                if (rl.completionPct) {
                  completionMap.set(rl.code, rl.completionPct);
                }
              }
              for (const lang of allLangs) {
                const isRestEnabled = enabledCodes.has(lang.code);
                lang.isDefault = lang.code === defaultCode;
                lang.isActive = isRestEnabled; // Only restaurant-enabled languages are "active" for UI purposes
                lang.isRequired = lang.code === 'en' || lang.code === defaultCode;
                lang.completionPct = completionMap.get(lang.code) || 0;
                // Mark restaurant-enabled languages with a special sort order to appear first
                if (isRestEnabled) {
                  lang.sortOrder = lang.sortOrder; // Keep original order for enabled
                } else {
                  lang.sortOrder = 1000 + lang.sortOrder; // Push non-enabled to end
                }
              }
            }
          } catch {
            // Restaurant fetch failed — still show all platform languages
          }
        }

        if (!cancelled) {
          // Use ref to get the latest defaultLanguage without adding it to deps
          const currentDefault = defaultLanguageRef.current;
          const defaultLang = allLangs.find(l => l.code === currentDefault)?.code ||
            allLangs.find(l => l.isDefault)?.code || 'en';
          setEnabledLanguages(allLangs, defaultLang);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLanguages();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const currentLang = enabledLanguages.find(l => l.code === language);

  // Before mount, render a simple consistent placeholder to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="outline" size={variant === 'icon' ? 'icon' : 'sm'} className={`h-8 gap-1 text-xs ${className || ''}`} disabled>
        <Globe className="h-3.5 w-3.5" />
        {variant !== 'icon' && <span>EN</span>}
      </Button>
    );
  }

  if (enabledLanguages.length === 0) {
    // Fallback: show simple globe button
    return (
      <Button variant="outline" size="sm" className={`h-8 gap-1 text-xs ${className || ''}`} disabled>
        <Globe className="h-3.5 w-3.5" />
        {language.toUpperCase()}
      </Button>
    );
  }

  // Separate into restaurant-enabled and other platform languages
  const restaurantEnabled = enabledLanguages
    .filter(l => restaurantEnabledCodes.has(l.code))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const otherLanguages = enabledLanguages
    .filter(l => !restaurantEnabledCodes.has(l.code))
    .sort((a, b) => {
      // Sort by name alphabetically
      const aName = a.name || a.code;
      const bName = b.name || b.code;
      return aName.localeCompare(bName);
    });

  const hasRestaurantContext = restaurantId && restaurantEnabledCodes.size > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={variant === 'icon' ? 'icon' : 'sm'}
          className={`h-8 gap-1.5 text-xs ${className || ''}`}
        >
          <Globe className="h-3.5 w-3.5" />
          {variant === 'button' && (
            <span className="max-w-[80px] truncate">
              {currentLang?.flagEmoji ? `${currentLang.flagEmoji} ` : ''}
              {currentLang?.nameLocal || language.toUpperCase()}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Language / ቋንቋ
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {hasRestaurantContext && restaurantEnabled.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[10px] text-muted-foreground/70 uppercase tracking-wider px-2 py-1">
              <Star className="h-3 w-3 inline mr-1" />
              Menu Languages
            </DropdownMenuLabel>
            {restaurantEnabled.map((lang) => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className="flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {lang.flagEmoji && <span className="text-sm">{lang.flagEmoji}</span>}
                  <span className="text-sm truncate">{lang.nameLocal}</span>
                  <span className="text-xs text-muted-foreground truncate">{lang.name}</span>
                </div>
                {lang.code === language && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {hasRestaurantContext && otherLanguages.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground/70 uppercase tracking-wider px-2 py-1">
              Other Languages
            </DropdownMenuLabel>
          </>
        )}

        {(hasRestaurantContext ? otherLanguages : enabledLanguages)
          .sort((a, b) => {
            const aName = a.nameLocal || a.name || a.code;
            const bName = b.nameLocal || b.name || b.code;
            return aName.localeCompare(bName);
          })
          .map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className="flex items-center justify-between gap-2 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                {lang.flagEmoji && <span className="text-sm">{lang.flagEmoji}</span>}
                <span className="text-sm truncate">{lang.nameLocal}</span>
                <span className="text-xs text-muted-foreground truncate">{lang.name}</span>
              </div>
              {lang.code === language && (
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
