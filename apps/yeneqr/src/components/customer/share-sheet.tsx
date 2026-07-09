'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Share2,
  Copy,
  Check,
  X,
  MessageSquare,
  Mail,
  Link2,
  QrCode,
  Edit3,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'
import QRCode from 'qrcode'

// ─── Types ────────────────────────────────────────────────────

export interface ShareSheetProps {
  open: boolean
  onClose: () => void
  shareTitle: string
  shareText: string
  shareUrl: string
  restaurantName?: string
  restaurantImage?: string | null
  /** Called after a successful share/copy with the method used */
  onShared?: (method: string) => void
}

// ─── Platform Definitions ─────────────────────────────────────

interface SharePlatform {
  name: string
  color: string
  icon: React.ReactNode
  getUrl: (encodedUrl: string, encodedText: string) => string
  category: 'social' | 'messaging' | 'other'
}

const PLATFORMS: SharePlatform[] = [
  {
    name: 'WhatsApp',
    color: '#25D366',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    getUrl: (u, t) => `https://wa.me/?text=${t}%20${u}`,
    category: 'messaging',
  },
  {
    name: 'Telegram',
    color: '#0088cc',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    getUrl: (u, t) => `https://t.me/share/url?url=${u}&text=${t}`,
    category: 'messaging',
  },
  {
    name: 'X (Twitter)',
    color: '#000000',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    getUrl: (u, t) => `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    category: 'social',
  },
  {
    name: 'Facebook',
    color: '#1877F2',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    getUrl: (u, t) => `https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`,
    category: 'social',
  },
  {
    name: 'LinkedIn',
    color: '#0A66C2',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
    getUrl: (u, _t) => `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    category: 'social',
  },
  {
    name: 'SMS',
    color: '#34C759',
    icon: <MessageSquare className="w-6 h-6" />,
    getUrl: (u, t) => `sms:?body=${t}%20${u}`,
    category: 'messaging',
  },
  {
    name: 'Email',
    color: '#EA4335',
    icon: <Mail className="w-6 h-6" />,
    getUrl: (u, t) => `mailto:?subject=${encodeURIComponent('Check this out!')}&body=${t}%0A%0A${u}`,
    category: 'other',
  },
]

// ─── ShareSheet Component ─────────────────────────────────────

export default function ShareSheet({
  open,
  onClose,
  shareTitle,
  shareText,
  shareUrl,
  restaurantName = '',
  restaurantImage,
  onShared,
}: ShareSheetProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [showCustomMsg, setShowCustomMsg] = useState(false)
  const [customMessage, setCustomMessage] = useState('')
  const [showMorePlatforms, setShowMorePlatforms] = useState(false)
  const [downloadingQR, setDownloadingQR] = useState(false)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const encodedUrl = encodeURIComponent(shareUrl)
  const encodedText = encodeURIComponent(shareText)

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setCopied(false)
      setShowQR(false)
      setShowCustomMsg(false)
      setCustomMessage('')
      setShowMorePlatforms(false)
    }
  }, [open])

  // Generate QR code when toggled
  useEffect(() => {
    if (showQR && shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).then(setQrDataUrl).catch(() => setQrDataUrl(null))
    }
  }, [showQR, shareUrl])

  // ── Copy Link ──
  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = shareUrl
        textArea.style.position = 'fixed'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopied(true)
      onShared?.('copy')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Failed silently
    }
  }, [shareUrl, onShared])

  // ── Native Share ──
  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: showCustomMsg && customMessage ? customMessage : shareText,
          url: shareUrl,
        })
        onShared?.('native')
      } catch {
        // User cancelled
      }
    }
  }, [shareTitle, shareText, shareUrl, showCustomMsg, customMessage, onShared])

  // ── Platform Share ──
  const handlePlatformShare = useCallback((platform: SharePlatform) => {
    const text = showCustomMsg && customMessage ? customMessage : shareText
    const encText = encodeURIComponent(text)
    const url = platform.getUrl(encodedUrl, encText)
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500')
    onShared?.(platform.name.toLowerCase().replace(/[\s()]/g, '_'))
  }, [encodedUrl, shareText, showCustomMsg, customMessage, onShared])

  // ── Download QR ──
  const handleDownloadQR = useCallback(() => {
    if (!qrDataUrl) return
    setDownloadingQR(true)
    const link = document.createElement('a')
    link.download = `${restaurantName || 'menu'}-qr.png`
    link.href = qrDataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setDownloadingQR(false)
    onShared?.('qr_download')
  }, [qrDataUrl, restaurantName, onShared])

  // ── Share QR Image ──
  const handleShareQR = useCallback(async () => {
    if (!qrDataUrl) return
    try {
      // Convert data URL to blob for Web Share API
      const response = await fetch(qrDataUrl)
      const blob = await response.blob()
      const file = new File([blob], `${restaurantName || 'menu'}-qr.png`, { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file],
        })
        onShared?.('qr_share')
      } else {
        // Fallback: download
        handleDownloadQR()
      }
    } catch {
      handleDownloadQR()
    }
  }, [qrDataUrl, shareTitle, shareText, restaurantName, onShared, handleDownloadQR])

  // Split platforms into primary and more
  const primaryPlatforms = PLATFORMS.slice(0, 4)
  const morePlatforms = PLATFORMS.slice(4)

  // Get effective share text for display
  const effectiveText = showCustomMsg && customMessage ? customMessage : shareText

  return (
    <AnimatePresence>
      {open && (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-lg bg-card rounded-t-3xl shadow-2xl max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="sticky top-0 z-10 bg-card rounded-t-3xl">
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          <div className="px-5 pb-3 border-b flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Share2 className="w-5 h-5 text-brand" />
                Share
              </h3>
              <p className="text-sm text-muted-foreground truncate">{shareTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Restaurant Image Preview */}
        {restaurantImage && (
          <div className="px-5 pt-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-2xl">
              {restaurantImage && (
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-muted">
                  <img
                    src={restaurantImage}
                    alt={restaurantName}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{restaurantName}</p>
                <p className="text-xs text-muted-foreground truncate">{shareUrl}</p>
              </div>
            </div>
          </div>
        )}

        {/* Custom Message Editor */}
        <div className="px-5 pt-4">
          <button
            onClick={() => setShowCustomMsg(!showCustomMsg)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            {showCustomMsg ? 'Hide custom message' : 'Add custom message'}
            {showCustomMsg ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <AnimatePresence>
            {showCustomMsg && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder={shareText}
                  className="w-full mt-2 p-3 bg-muted/50 rounded-xl text-sm resize-none border border-border/50 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50"
                  rows={2}
                  maxLength={500}
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">
                  {customMessage.length}/500
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Primary Social Platforms */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-4 gap-4">
            {primaryPlatforms.map((p) => (
              <button
                key={p.name}
                onClick={() => handlePlatformShare(p)}
                className="flex flex-col items-center gap-2 group"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white transition-transform group-hover:scale-110 group-active:scale-95 shadow-md"
                  style={{ backgroundColor: p.color }}
                >
                  {p.icon}
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* More Platforms Toggle */}
        <div className="px-5 pb-2">
          <button
            onClick={() => setShowMorePlatforms(!showMorePlatforms)}
            className="flex items-center gap-2 text-sm text-brand font-medium hover:underline"
          >
            {showMorePlatforms ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                More platforms
              </>
            )}
          </button>
        </div>

        <AnimatePresence>
          {showMorePlatforms && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 py-2">
                <div className="grid grid-cols-4 gap-4">
                  {morePlatforms.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handlePlatformShare(p)}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-white transition-transform group-hover:scale-110 group-active:scale-95 shadow-md"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.icon}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR Code Section */}
        <div className="px-5 py-3">
          <button
            onClick={() => setShowQR(!showQR)}
            className="flex items-center gap-2 text-sm text-brand font-medium hover:underline"
          >
            <QrCode className="w-4 h-4" />
            {showQR ? 'Hide QR code' : 'Share via QR code'}
            {showQR ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showQR && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex flex-col items-center gap-3 p-4 bg-white rounded-2xl">
                  {qrDataUrl ? (
                    <>
                      <img
                        src={qrDataUrl}
                        alt="QR Code"
                        className="w-56 h-56 rounded-xl"
                      />
                      <div className="flex items-center gap-2 w-full">
                        <button
                          onClick={handleDownloadQR}
                          disabled={downloadingQR}
                          className="flex-1 py-2.5 rounded-xl bg-muted text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Download
                        </button>
                        {typeof navigator !== 'undefined' && navigator.share && (
                          <button
                            onClick={handleShareQR}
                            className="flex-1 py-2.5 rounded-xl bg-brand text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-brand/90 transition-colors"
                          >
                            <Share2 className="w-4 h-4" />
                            Share
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="w-56 h-56 rounded-xl bg-muted animate-pulse flex items-center justify-center">
                      <QrCode className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs text-center text-gray-500">
                    Scan this QR code to open the menu
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Copy Link */}
        <div className="px-5 pb-2">
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
            <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground truncate font-mono">{shareUrl}</p>
            </div>
            <button
              onClick={handleCopy}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand text-white hover:bg-brand/90'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Native Share (if available) */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <div className="px-5 pb-3 pt-2">
            <button
              onClick={handleNativeShare}
              className="w-full py-3 rounded-xl bg-muted text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              More sharing options
            </button>
          </div>
        )}

        {/* Close */}
        <div className="px-5 pb-6 pt-1">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-muted/50 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  )
}
