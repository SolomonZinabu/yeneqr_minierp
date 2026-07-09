// Yene QR — Service Worker v3
// Strategies: network-first for API, cache-first for static assets,
// stale-while-revalidate for app pages, offline fallback, background sync

const CACHE_NAME = 'yene-qr-v3'
const STATIC_CACHE = 'yene-qr-static-v3'
const DYNAMIC_CACHE = 'yene-qr-dynamic-v3'

// App pages to pre-cache on install
const APP_PAGES = [
  '/',
  '/logo.png',
  '/manifest.json',
  '/offline.html',
]

// Static asset extensions for cache-first strategy
const STATIC_EXTENSIONS = [
  '.js', '.css', '.mjs', '.woff', '.woff2', '.ttf', '.otf',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.json', '.wasm',
]

// Background sync tag for form/order submissions
const ORDER_SYNC_TAG = 'order-sync'
const FORM_SYNC_TAG = 'form-sync'

// ==================== INSTALL ====================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_PAGES))
  )
  self.skipWaiting()
})

// ==================== ACTIVATE ====================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ==================== FETCH ====================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only handle same-origin requests
  if (url.origin !== location.origin) return

  // ----- POST requests: try network, queue for background sync on failure -----
  if (event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request)
        } catch {
          // Offline — queue the request for background sync
          if (
            url.pathname.includes('/orders') ||
            url.pathname.includes('/reservations') ||
            url.pathname.includes('/feedback')
          ) {
            const clone = event.request.clone()
            const body = await clone.text()
            await queueForSync(url.pathname, body, event.request.headers, ORDER_SYNC_TAG)
            return new Response(
              JSON.stringify({
                data: {
                  id: `pending-${Date.now()}`,
                  status: 'pending',
                  message: 'Request queued — will be processed when online',
                },
              }),
              { status: 202, headers: { 'Content-Type': 'application/json' } }
            )
          }
          // Generic form submission sync
          const clone = event.request.clone()
          const body = await clone.text()
          await queueForSync(url.pathname, body, event.request.headers, FORM_SYNC_TAG)
          return new Response(
            JSON.stringify({ queued: true, message: 'Form submission queued for sync' }),
            { status: 202, headers: { 'Content-Type': 'application/json' } }
          )
        }
      })()
    )
    return
  }

  // Only handle GET requests from here on
  if (event.request.method !== 'GET') return

  // ----- Navigation requests: network-first with offline fallback -----
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (cached) return cached
            return caches.match('/offline.html').then((fallback) => {
              if (fallback) return fallback
              return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
            })
          })
        )
    )
    return
  }

  // ----- API requests: network-first, cache fallback -----
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // ----- Static assets: cache-first, network fallback -----
  const isStaticAsset = STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext))
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone))
            }
            return response
          })
          .catch(() => caches.match(event.request))
      })
    )
    return
  }

  // ----- Other requests: stale-while-revalidate -----
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => cached)

      return cached || fetchPromise
    })
  )
})

// ==================== BACKGROUND SYNC ====================
self.addEventListener('sync', (event) => {
  if (event.tag === ORDER_SYNC_TAG || event.tag === FORM_SYNC_TAG) {
    event.waitUntil(syncQueuedRequests(event.tag))
  }
})

// ==================== PUSH (placeholder for future) ====================
self.addEventListener('push', (event) => {
  if (!event.data) return
  try {
    const data = event.data.json()
    const title = data.title || 'Yene QR'
    const options = {
      body: data.body || '',
      icon: '/logo.png',
      badge: '/logo.png',
      data: data.data || {},
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch {
    // Ignore malformed push data
  }
})

// ==================== IndexedDB helpers ====================
async function queueForSync(pathname, body, headers, tag) {
  const db = await openDB()
  const tx = db.transaction('requestQueue', 'readwrite')
  const store = tx.objectStore('requestQueue')
  await store.add({
    pathname,
    body,
    headers: Object.fromEntries(headers.entries()),
    tag,
    timestamp: Date.now(),
  })
  // Register for background sync
  self.registration.sync.register(tag)
}

async function syncQueuedRequests(tag) {
  const db = await openDB()
  const tx = db.transaction('requestQueue', 'readwrite')
  const store = tx.objectStore('requestQueue')
  const allRequests = await store.getAll()

  for (const req of allRequests) {
    if (req.tag !== tag) continue
    try {
      const response = await fetch(req.pathname, {
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          ...(req.headers['authorization'] ? { Authorization: req.headers['authorization'] } : {}),
        },
        body: req.body,
      })

      if (response.ok) {
        await db.transaction('requestQueue', 'readwrite').objectStore('requestQueue').delete(req.id)
      }
    } catch {
      // Will retry on next sync event
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('yene-qr-offline', 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('requestQueue')) {
        db.createObjectStore('requestQueue', { keyPath: 'id', autoIncrement: true })
      }
      // Migrate from old 'orderQueue' store if it exists
      if (db.objectStoreNames.contains('orderQueue') && !db.objectStoreNames.contains('requestQueue')) {
        db.createObjectStore('requestQueue', { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
