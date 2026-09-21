// Cache public HTML shells, never authentication responses or account data.
const CACHE_NAME = 'animated-cashapp-shell-v7';
const CACHE_PREFIX = 'animated-cashapp-shell-';
const PAGES = new Set(['index.html', 'home.html', 'contact-pay.html', 'activty.html',
  'profile.html', 'card.html', 'bitcoin.html', 'stocks.html', 'savings.html']);
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }
  const page = PAGES.has(url.pathname.split('/').pop());
  const media = /\.(?:png|jpe?g|gif|webp|svg|ttf|otf|woff2?|mp4|mov)$/.test(url.pathname);
  const code = new Set(["dark-mode.js","cashapp-shared.js","cashapp-shared.css","footer.display.js","nav-performance.js","cash-auth.js","asset-page.js","asset-page.css","reference-home.css","reference-profile.css","reference-activity.css","saving.css","lottie.min.js"]).has(url.pathname.split('/').pop());
  const loader = /\/(?:loader_[ld]m.json|lottie.min.js)$/.test(url.pathname);
  if ((!page && !media && !loader && !code) || request.cache === 'no-store') return;
  const cachePromise = caches.open(CACHE_NAME);
  const refresh = cachePromise.then(async cache => {
    if (media || loader) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    const response = await fetch(request);
    if (response.ok && !response.redirected && !/no-store|private/i.test(response.headers.get('Cache-Control') || '')) {
      await cache.put(request, response.clone());
    }
    return response;
  });
  // A cached public shell renders immediately while refreshing in the background.
  event.waitUntil(refresh.then(() => {}, () => {}));
  event.respondWith(cachePromise.then(async cache => (await cache.match(request)) || refresh));
});



