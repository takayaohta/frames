const CACHE_NAME = 'frames-v1.0.1';
const STATIC_CACHE = 'frames-static-v1.0.1';
const DYNAMIC_CACHE = 'frames-dynamic-v1.0.1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-48x48.png',
  '/icon-70x70.png',
  '/icon-72x72.png',
  '/icon-76x76.png',
  '/icon-96x96.png',
  '/icon-120x120.png',
  '/icon-144x144.png',
  '/icon-150x150.png',
  '/icon-152x152.png',
  '/icon-167x167.png',
  '/icon-180x180.png',
  '/icon-192x192.png',
  '/icon-310x310.png',
  '/icon-512x512.png',
  '/maskable-icon.png',
  'https://unpkg.com/three@0.157.0/examples/fonts/helvetiker_bold.typeface.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - cache first for static, network first for others
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // index.htmlはキャッシュファースト
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      caches.match('/index.html').then(response => {
        return response || fetch(request).then(res => {
          if (res.status === 200) {
            const resClone = res.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put('/index.html', resClone));
          }
          return res;
        });
      })
    );
    return;
  }

  // static配下はキャッシュファースト
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request).then(res => {
          if (res.status === 200) {
            const resClone = res.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, resClone));
          }
          return res;
        });
      })
    );
    return;
  }

  // その他のSTATIC_ASSETS
  if (STATIC_ASSETS.includes(url.pathname) || STATIC_ASSETS.includes(request.url)) {
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request).then(res => {
          if (res.status === 200) {
            const resClone = res.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, resClone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 画像リクエストはキャッシュファースト
  if (request.destination === 'image') {
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request).then(res => {
          if (res.status === 200) {
            const resClone = res.clone();
            caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, resClone));
          }
          return res;
        });
      }).catch(() => new Response('', { status: 404 }))
    );
    return;
  }

  // APIリクエストはネットワークファースト
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).then(res => {
        if (res.status === 200) {
          const resClone = res.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, resClone));
        }
        return res;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // デフォルトはネットワークファースト
  event.respondWith(
    fetch(request).then(res => {
      if (res.status === 200) {
        const resClone = res.clone();
        caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, resClone));
      }
      return res;
    }).catch(() => caches.match(request))
  );
});

// Background sync for offline functionality
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  console.log('Background sync triggered');
  // Handle background sync tasks like uploading images when back online
}

// Push notification handling
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Frames - New update available!',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open Frames',
        icon: '/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-72x72.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Frames', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
}); 