// Native links remain immediate; only public page shells are warmed.
(() => {
  'use strict';
  const pages = ['index.html', 'home.html', 'contact-pay.html', 'activty.html',
    'profile.html', 'card.html', 'bitcoin.html', 'stocks.html', 'savings.html'];
  const warmed = new Set();
  function warm(href) {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin || !pages.includes(url.pathname.split('/').pop()) ||
        warmed.has(url.href) || navigator.connection?.saveData) return;
    warmed.add(url.href);
    const key = 'cash-ui-warm-v6:' + url.pathname;
    try {
      if (Date.now() - Number(sessionStorage.getItem(key) || 0) < 60000) return;
    } catch (_) {}
    fetch(url.href, { credentials: 'same-origin' }).then(response => {
      if (!response.ok) { warmed.delete(url.href); return; }
      try { sessionStorage.setItem(key, String(Date.now())); } catch (_) {}
    }).catch(() => warmed.delete(url.href));
  }
  for (const type of ['pointerover', 'focusin', 'touchstart']) {
    document.addEventListener(type, event => {
      const link = event.target.closest?.('a[href]');
      if (link) warm(link.href);
    }, { passive: true });
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      warmed.clear();
      pages.forEach(warm);
    });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(() =>
      navigator.serviceWorker.ready
    ).then(() => {
      const run = () => pages.forEach(warm);
      if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 1000 });
      else setTimeout(run, 100);
    }).catch(() => {});
  }
})();

