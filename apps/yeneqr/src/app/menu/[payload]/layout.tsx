import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Yene QR — Menu & Order',
  description: 'Scan, browse the menu, and order directly from your table.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#039D55',
}

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="customer-app-shell-outer">
      <div className="customer-app-shell">
        {children}
      </div>
    </div>
  )
}
