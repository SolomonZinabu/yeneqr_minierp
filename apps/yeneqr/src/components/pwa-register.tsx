'use client'

import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | null = null

    async function registerSW() {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        })

        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration?.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            // New service worker activated — can prompt user to reload
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version activated')
            }
          })
        })

        // Check for updates periodically (every 30 minutes)
        const updateInterval = setInterval(() => {
          registration?.update?.()
        }, 30 * 60 * 1000)

        return () => clearInterval(updateInterval)
      } catch (error) {
        console.warn('[PWA] Service worker registration failed:', error)
      }
    }

    registerSW()

    // Listen for controller change (new SW took over)
    const handleControllerChange = () => {
      // A new service worker has taken control — could auto-reload
      // For now, just log it
      console.log('[PWA] Service worker controller changed')
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
    }
  }, [])

  return null
}
