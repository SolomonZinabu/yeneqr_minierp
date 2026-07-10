// Root layout — sets up HTML shell + providers (TanStack Query, theme, toaster).

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

// Disable static prerendering — all pages are SSR'd on demand.
// This fixes the Next.js 16 + React 19 "_global-error" prerender crash
// and ensures auth cookies/sessions work correctly on every request.

export const metadata: Metadata = {
  title: "Mini ERP",
  description: "Restaurant back-office — inventory, finance, HR, payroll.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
