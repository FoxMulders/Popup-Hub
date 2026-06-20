const CACHE_NAME = 'popup-hub-shell-v18'
const STATIC_ASSETS = [
  '/manifest.json',
  '/site.webmanifest',
  '/popup-hub-brand.png',
  '/popup-hub-brand-dark.png',
  '/popup-hub-icon.png',
  '/popup-hub-icon-dark.png',
  '/hubguard-logo.png',
  '/hubguard-icon.png',
  '/popup-hub-logo.png',
  '/logo.png',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
]

const FONT_DESTINATIONS = ['/_next/static/media/', '/__nextjs_font/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

function isNextAssetRequest(url) {
  return url.pathname.startsWith('/_next/')
}

function isAppShellRequest(url) {
  return (
    isNextAssetRequest(url) ||
    url.pathname === '/' ||
    url.pathname.startsWith('/discover') ||
    url.pathname.startsWith('/vendor') ||
    url.pathname.startsWith('/coordinator') ||
    url.pathname.startsWith('/wallet') ||
    url.pathname.startsWith('/profile') ||
    url.pathname.startsWith('/events') ||
    url.pathname.startsWith('/favorites') ||
    url.pathname.startsWith('/notifications')
  )
}

function isFontRequest(url) {
  return FONT_DESTINATIONS.some((prefix) => url.pathname.includes(prefix))
}

function cacheableStaticPath(pathname) {
  return STATIC_ASSETS.includes(pathname) || FONT_DESTINATIONS.some((prefix) => pathname.includes(prefix))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  if (isAppShellRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && isNextAssetRequest(url)) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached ?? Response.error()),
        ),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (!response.ok || response.type === 'opaque') return response
          if (cacheableStaticPath(url.pathname)) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached ?? Response.error())
    })
  )
})

function parsePushPayload(event) {
  const defaults = {
    title: 'Popup Hub',
    body: 'You have a new update.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    url: '/notifications',
  }

  if (!event.data) return defaults

  try {
    const json = event.data.json()
    return {
      title: json.title ?? defaults.title,
      body: json.body ?? json.message ?? defaults.body,
      icon: json.icon ?? defaults.icon,
      badge: json.badge ?? defaults.badge,
      url: json.url ?? json.link ?? defaults.url,
      tag: json.tag,
      data: json.data ?? { url: json.url ?? defaults.url },
    }
  } catch {
    const text = event.data.text()
    return { ...defaults, body: text || defaults.body }
  }
}

self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event)
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      data: payload.data ?? { url: payload.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl =
    event.notification.data?.url ?? event.notification.data?.link ?? '/notifications'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const absolute = new URL(targetUrl, self.location.origin).href
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(absolute)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absolute)
      }
      return undefined
    })
  )
})

self.addEventListener('sync', (event) => {
  if (event.tag === 'passport-scan-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'PASSPORT_SCAN_FLUSH' })
        }
      })
    )
  }
})
