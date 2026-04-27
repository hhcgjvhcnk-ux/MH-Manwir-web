/* =============================================
   MH MANWIR Admin – Service Worker
   ============================================= */

const CACHE_NAME = 'mh-manwir-admin-v1';

// الملفات الأساسية التي سيتم تخزينها مؤقتاً
const STATIC_ASSETS = [
  './admin.html',
  './manifest.json',
  './logoo.png'
];

// ===== INSTALL =====
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      // نستخدم addAll مع معالجة الأخطاء حتى لا يفشل التثبيت إذا لم يوجد ملف
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(err => console.warn('[SW] Could not cache:', url, err)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[SW] Deleting old cache:', key);
          return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ===== FETCH =====
// استراتيجية: Network First ثم Cache كبديل
self.addEventListener('fetch', event => {
  const { request } = event;

  // تجاهل طلبات Firebase والخطوط الخارجية (تحتاج اتصال دائماً)
  if (
    request.url.includes('firebaseio.com') ||
    request.url.includes('googleapis.com') ||
    request.url.includes('gstatic.com') ||
    request.url.includes('cdnjs.cloudflare.com') ||
    request.url.includes('fonts.googleapis.com')
  ) {
    return; // اتركها للمتصفح مباشرة
  }

  // للملفات المحلية: Network First → Cache Fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        // إذا نجح الطلب، احفظ نسخة في الكاش
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // إذا فشل الاتصال، استخدم الكاش
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // إذا لم يوجد في الكاش، أعد الصفحة الرئيسية
          if (request.destination === 'document') {
            return caches.match('./admin.html');
          }
        });
      })
  );
});

// ===== PUSH NOTIFICATIONS (اختياري للمستقبل) =====
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'MH MANWIR Admin';
  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: './logoo.png',
    badge: './logoo.png',
    dir: 'rtl',
    lang: 'ar'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
