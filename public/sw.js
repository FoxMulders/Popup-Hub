const CACHE_NAME = 'popup-hub-shell-v5'
const STATIC_ASSETS = [
  '/manifest.json',
  '/popup-hub-brand.png',
  '/popup-hub-icon.png',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

function isAppShellRequest(url) {
  return (
    url.pathname.startsWith('/_next/') ||
    url.pathname === '/' ||
    url.pathname.startsWith('/discover') ||
    url.pathname.startsWith('/vendor') ||
    url.pathname.startsWith('/coordinator') ||
    url.pathname.startsWith('/wallet') ||
    url.pathname.startsWith('/profile') ||
    url.pathname.startsWith('/events') ||
    url.pathname.startsWith('/favorites')
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  // Always fetch fresh HTML/JS/CSS so deploys (logo, UI) reach users immediately.
  if (isAppShellRequest(url)) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((cached) => cached ?? Response.error()))
    )
    return
  }

  // Cache-first only for static brand/install assets.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (!response.ok || response.type === 'opaque') return response
          if (STATIC_ASSETS.includes(url.pathname)) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached ?? Response.error())
    })
  )
})
