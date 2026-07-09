import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn` — merge Tailwind classes with conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ────────────────────────────────────────────────────────────
//  Formatters — currency, dates, numbers
// ────────────────────────────────────────────────────────────

const CURRENCY_DEFAULT = "ETB";

export function formatCurrency(
  amount: number,
  currency: string = CURRENCY_DEFAULT,
  locale = "en-US",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback if currency code is invalid (e.g.ETB on some platforms)
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatNumber(
  value: number,
  locale = "en-US",
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(
  date: Date | string | number,
  locale = "en-US",
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(d);
}

export function formatDateTime(date: Date | string | number, locale = "en-US"): string {
  return formatDate(date, locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(date: Date | string | number, locale = "en-US"): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffMs = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second");
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  return rtf.format(diffDay, "day");
}

/**
 * Generate a URL-friendly slug from a string.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a random API key (URL-safe base64, ~32 chars).
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes));
  return `merp_${b64.replace(/\+/g, "-").replace(/\//g, "_")}`;
}

/**
 * Sleep helper for tests / dev.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
