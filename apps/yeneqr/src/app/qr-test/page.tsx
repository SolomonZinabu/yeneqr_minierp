'use client'

import React, { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'

interface TableQR {
  tableId: string
  tableNumber: string
  capacity: number
  branchName: string
  branchNameAm: string | null
  floorName: string
  qrPayload: string | null
  qrSignature: string | null
  qrType: string | null
  scanCount: number
  qrUrl?: string
  qrImageDataUrl?: string
}

interface RestaurantQRData {
  id: string
  name: string
  nameAm: string | null
  slug: string
  cuisineType: string | null
  tables: TableQR[]
}

export default function QRTestPage() {
  const [restaurants, setRestaurants] = useState<RestaurantQRData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const printRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    // Use NEXT_PUBLIC_BASE_URL if set, otherwise fall back to window.location.origin
    const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
    const detected = envBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    setCustomBaseUrl(detected)
    loadQRCodes(detected)
  }, [])

  async function loadQRCodes(base: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/qr-test')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()

      // Generate QR images for each table
      setGenerating(true)
      const enriched = await Promise.all(
        (data.restaurants as RestaurantQRData[]).map(async (rest) => {
          const tables = await Promise.all(
            rest.tables.map(async (table) => {
              // Build QR URL from payload and signature
              let qrUrl = ''
              let qrImageDataUrl = ''

              if (table.qrPayload && table.qrSignature) {
                let payload: any
                try {
                  payload = typeof table.qrPayload === 'string'
                    ? JSON.parse(table.qrPayload)
                    : table.qrPayload
                } catch {
                  payload = table.qrPayload
                }
                const encodedPayload = btoa(JSON.stringify(payload))
                  .replace(/\+/g, '-')
                  .replace(/\//g, '_')
                  .replace(/=+$/, '')
                qrUrl = `${base}/menu/${encodedPayload}.${table.qrSignature}`

                try {
                  qrImageDataUrl = await QRCode.toDataURL(qrUrl, {
                    width: 512,
                    margin: 2,
                    color: { dark: '#039D55', light: '#FFFFFF' },
                  })
                } catch (e) {
                  console.error('QR gen error:', e)
                }
              }

              return { ...table, qrUrl, qrImageDataUrl }
            })
          )
          return { ...rest, tables }
        })
      )

      setRestaurants(enriched)
    } catch (err) {
      console.error('Failed to load QR codes:', err)
    } finally {
      setLoading(false)
      setGenerating(false)
    }
  }

  function handlePrint() {
    if (!printRef.current) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>Yene QR - QR Codes</title>
          <style>
            body { font-family: system-ui, sans-serif; margin: 20px; }
            .restaurant-header { page-break-after: avoid; margin-top: 30px; }
            .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .qr-card { border: 2px solid #039D55; border-radius: 12px; padding: 16px; text-align: center; page-break-inside: avoid; }
            .qr-card img { width: 200px; height: 200px; }
            .table-info { font-weight: bold; font-size: 18px; margin-top: 8px; color: #039D55; }
            .branch-info { font-size: 14px; color: #666; }
            h1 { color: #039D55; }
            h2 { color: #333; border-bottom: 2px solid #039D55; padding-bottom: 8px; }
          </style>
        </head>
        <body>
          <h1>Yene QR - QR Code Test Sheet</h1>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const filteredRestaurants = selectedRestaurant === 'all'
    ? restaurants
    : restaurants.filter(r => r.id === selectedRestaurant)

  const totalQRs = filteredRestaurants.reduce((sum, r) => sum + r.tables.length, 0)

  if (loading || generating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-gray-500">
          {generating ? 'Generating QR code images...' : 'Loading QR codes from database...'}
        </p>
        {generating && (
          <p className="text-gray-400 text-sm mt-2">This may take a moment for 123 QR codes</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" />
                  <rect x="18" y="14" width="3" height="3" /><rect x="14" y="18" width="3" height="3" />
                  <rect x="18" y="18" width="3" height="3" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">QR Code Test Page</h1>
                <p className="text-sm text-gray-500">Scan with your phone to test the customer ordering flow</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                Print All
              </button>
              <button
                onClick={() => loadQRCodes(customBaseUrl)}
                className="px-4 py-2 bg-brand hover:bg-brand-dark rounded-lg text-sm font-medium text-white transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium">Base URL:</label>
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-80 focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <button
                onClick={() => loadQRCodes(customBaseUrl)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
              >
                Apply
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 font-medium">Restaurant:</label>
              <select
                value={selectedRestaurant}
                onChange={(e) => setSelectedRestaurant(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="all">All Restaurants ({restaurants.length})</option>
                {restaurants.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.tables.length} tables)
                  </option>
                ))}
              </select>
            </div>
            <span className="text-sm text-gray-500">
              {totalQRs} QR codes
            </span>
          </div>
        </div>
      </div>

      {/* Instructions Banner */}
      <div className="max-w-7xl mx-auto px-4 mt-4">
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
            </svg>
          </div>
          <div className="text-sm text-brand/80">
            <p className="font-semibold text-brand">How to test:</p>
            <ol className="list-decimal list-inside mt-1 space-y-0.5">
              <li>Open your phone camera and point it at any QR code below</li>
              <li>Tap the notification to open the menu page</li>
              <li>You should see the restaurant welcome screen with the table number</li>
              <li>Tap &quot;Start Ordering&quot; to browse the menu and add items to cart</li>
              <li>Place an order — it will appear in the restaurant&apos;s kitchen dashboard</li>
            </ol>
          </div>
        </div>
      </div>

      {/* QR Codes Grid */}
      <div ref={printRef} className="max-w-7xl mx-auto px-4 py-6">
        {filteredRestaurants.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No QR codes found</p>
            <p className="text-gray-400 text-sm mt-2">Make sure the database is seeded</p>
          </div>
        )}

        {filteredRestaurants.map((restaurant) => (
          <div key={restaurant.id} className="mb-10">
            <div className="flex items-center gap-3 mb-4 restaurant-header">
              <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
                <span className="text-white font-bold text-lg">{restaurant.name.charAt(0)}</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{restaurant.name}</h2>
                <p className="text-xs text-gray-400">{restaurant.cuisineType} &middot; {restaurant.slug}</p>
              </div>
              <span className="ml-auto text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                {restaurant.tables.length} tables
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 qr-grid">
              {restaurant.tables.map((table) => (
                <div
                  key={table.tableId}
                  className="qr-card bg-white border-2 border-brand/20 rounded-2xl p-3 text-center hover:border-brand hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => {
                    if (table.qrUrl) {
                      navigator.clipboard.writeText(table.qrUrl)
                      const el = document.getElementById(`copy-${table.tableId}`)
                      if (el) {
                        el.textContent = 'Copied!'
                        setTimeout(() => { el.textContent = 'Copy URL' }, 1500)
                      }
                    }
                  }}
                >
                  {table.qrImageDataUrl ? (
                    <img
                      src={table.qrImageDataUrl}
                      alt={`QR - Table ${table.tableNumber}`}
                      className="w-full aspect-square rounded-xl mx-auto"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                      <span className="text-gray-400 text-xs">No QR</span>
                    </div>
                  )}
                  <div className="table-info text-brand font-bold text-base mt-2">
                    Table {table.tableNumber}
                  </div>
                  <div className="branch-info text-xs text-gray-500 mt-1">
                    {table.branchName}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {table.floorName} &middot; {table.capacity} seats &middot; {table.scanCount} scans
                  </div>
                  {table.qrType && (
                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      table.qrType === 'static' ? 'bg-blue-50 text-blue-600' :
                      table.qrType === 'dynamic' ? 'bg-amber-50 text-amber-600' :
                      'bg-purple-50 text-purple-600'
                    }`}>
                      {table.qrType}
                    </span>
                  )}
                  <button
                    id={`copy-${table.tableId}`}
                    className="mt-1 text-[10px] px-2 py-0.5 bg-brand/10 text-brand rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (table.qrUrl) {
                        navigator.clipboard.writeText(table.qrUrl)
                        const btn = e.currentTarget
                        btn.textContent = 'Copied!'
                        setTimeout(() => { btn.textContent = 'Copy URL' }, 1500)
                      }
                    }}
                  >
                    Copy URL
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
