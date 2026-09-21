(function () {
  'use strict';
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const homePages = new Set(['home.html', 'savings.html', 'bitcoin.html', 'stocks.html']);
  const navItems = [
    ['home.html', 'fa-solid fa-house', 'Home', homePages.has(page)],
    ['activty.html', 'fa-solid fa-clock-rotate-left', 'Activity', page === 'activty.html'],
    ['index.html', 'fa-solid fa-dollar-sign', 'Pay', page === 'index.html'],
    ['card.html', 'fa-solid fa-credit-card', 'Card', page === 'card.html'],
    ['profile.html', 'fa-solid fa-user', 'Profile', page === 'profile.html']
  ];
  function ensureNav() {
    if (page === 'contact-pay.html') return;
    if (document.querySelector('.bottom-nav, .cash-shared-nav')) return;
    const nav = document.createElement('nav');
    nav.className = 'cash-shared-nav';
    nav.setAttribute('aria-label', 'Primary navigation');
    navItems.forEach(([href, icon, label, active]) => {
      const link = document.createElement('a');
      link.href = href;
      link.setAttribute('aria-label', label);
      if (active) { link.className = 'is-active'; link.setAttribute('aria-current', 'page'); }
      const glyph = document.createElement('i');
      glyph.className = icon;
      glyph.setAttribute('aria-hidden', 'true');
      link.appendChild(glyph);
      nav.appendChild(link);
    });
    document.body.appendChild(nav);
  }
  let rendererPromise;
  function getRenderer() {
    if (window.lottie || window.bodymovin) return Promise.resolve(window.lottie || window.bodymovin);
    if (!rendererPromise) {
      rendererPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'lottie.min.js';
        script.onload = () => resolve(window.lottie || window.bodymovin);
        script.onerror = () => { script.remove(); rendererPromise = null; reject(new Error('Loader unavailable')); };
        document.head.appendChild(script);
      });
    }
    return rendererPromise;
  }
  const loaderData = new Map();
  function getLoaderData(path) {
    if (!loaderData.has(path)) {
      loaderData.set(path, fetch(path).then(response => {
        if (!response.ok) throw new Error('Loader unavailable');
        return response.json();
      }).catch(error => { loaderData.delete(path); throw error; }));
    }
    return loaderData.get(path);
  }
  function loaderPath(host) {
    if (localStorage.getItem('cashAppPayMode') === '4') return localStorage.getItem('cashAppMode4Style') !== 'dark' ? 'loader_lm.json' : 'loader_dm.json';
    if (host.closest('.m2-panel')) {
      const light = document.body.classList.contains('pay-mode-3')
        ? document.body.classList.contains('mode3-white')
        : document.body.classList.contains('mode2-white');
      return light ? 'loader_lm.json' : 'loader_dm.json';
    }
    return document.body.classList.contains('dark-mode') || document.documentElement.dataset.theme === 'dark'
      ? 'loader_dm.json' : 'loader_lm.json';
  }
  async function mount(host) {
    if (!host) return null;
    try {
      const path = loaderPath(host);
      const [renderer, data] = await Promise.all([getRenderer(), getLoaderData(path)]);
      if (!renderer || !host.isConnected) return null;
      if (path !== loaderPath(host)) return mount(host);
      if (host._cashAnimation && host._cashLoaderPath === path) return host._cashAnimation;
      if (host._cashAnimation) host._cashAnimation.destroy();
      host.replaceChildren();
      host.classList.add('cash-inline-loader');
      host._cashLoaderPath = path;
      const animation = renderer.loadAnimation({ container: host, renderer: 'svg', loop: true, autoplay: false, animationData: JSON.parse(JSON.stringify(data)) });
      host._cashAnimation = animation;
      animation.addEventListener('DOMLoaded', () => {
        if (host._cashAnimation === animation && host._cashShouldPlay) { animation.resize(); animation.play(); }
      });
      animation.addEventListener('data_failed', () => {
        if (host._cashAnimation !== animation) return;
        animation.destroy();
        host._cashAnimation = null;
        host.textContent = 'Loading…';
      });
      return animation;
    } catch (error) {
      if (host._cashShouldPlay) host.textContent = 'Loading…';
      return null;
    }
  }
  window.CashInlineLoader = {
    mount,
    async play(host) {
      if (!host) return;
      host._cashShouldPlay = true;
      host.classList.add('cash-is-loading');
      host.setAttribute('role', 'status');
      host.setAttribute('aria-label', 'Loading');
      const animation = await mount(host);
      if (animation && host._cashShouldPlay) { animation.resize(); animation.play(); }
    },
    pause(host) {
      if (!host) return;
      host._cashShouldPlay = false;
      host.classList.remove('cash-is-loading');
      if (host._cashAnimation) host._cashAnimation.pause();
    }
  };

  // Create processing UI only when an operation starts, never on navigation.
  let overlay;
  window.CashLoader = {
    show(message = '') {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'cash-global-loader';
        overlay.innerHTML = '<div class="cash-loader-animation" data-cash-inline-loader></div><p class="cash-loader-text" role="status"></p>';
        document.body.appendChild(overlay);
      }
      const text = overlay.querySelector('.cash-loader-text');
      text.textContent = message;
      if (/^(add|adding) money/i.test(message)) {
        text.textContent = 'Adding money';
        for (let i = 0; i < 3; i++) { const dot = document.createElement('span'); dot.textContent = '.'; text.appendChild(dot); }
      }
      overlay.hidden = false;
      overlay.classList.add('is-visible');
      window.CashInlineLoader.play(overlay.querySelector('[data-cash-inline-loader]'));
    },
    hide() {
      if (!overlay) return;
      overlay.classList.remove('is-visible');
      overlay.hidden = true;
      window.CashInlineLoader.pause(overlay.querySelector('[data-cash-inline-loader]'));
    }
  };
  function clearLoaders() {
    window.CashLoader.hide();
    document.querySelectorAll('[data-cash-inline-loader]').forEach(window.CashInlineLoader.pause);
  }
  function enforceLogout() {
    if (localStorage.getItem('cashAppSignedOut') !== 'true') return;
    clearLoaders();
    if (page !== 'index.html') location.replace('index.html?loggedOut=1');
  }
  let logoutRequest;
  window.CashSession = {
    logout() {
      if (logoutRequest) return logoutRequest;
      localStorage.setItem('cashAppSignedOut', 'true');
      localStorage.removeItem('deviceId');
      clearLoaders();
      logoutRequest = (async () => {
        try {
          const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(10000) });
          if (!response.ok) console.warn('Session logout failed; sign-in is required locally.');
        } catch (error) { console.warn('Session logout unavailable; sign-in is required locally.'); }
        location.replace('index.html?loggedOut=1');
      })();
      return logoutRequest;
    }
  };
  window.addEventListener('pagehide', clearLoaders);
  window.addEventListener('pageshow', enforceLogout);
  window.addEventListener('storage', event => { if (event.key === 'cashAppSignedOut') enforceLogout(); });



  let notificationAudio;
  const soundEnabledKey = 'cashAppNotificationSound';
  const soundVolumeKey = 'cashAppNotificationVolume';
  const soundVolume = () => {
    const stored = localStorage.getItem(soundVolumeKey);
    const value = stored === null ? 50 : Number(stored);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 50;
  };
  window.CashNotificationSound = {
    unlock() {
      if (localStorage.getItem(soundEnabledKey) !== 'true') return;
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        notificationAudio ||= new Audio();
        notificationAudio.resume().catch(() => {});
      } catch (_) { /* Audio must never block the app. */ }
    },
    play() {
      if (localStorage.getItem(soundEnabledKey) !== 'true' || !soundVolume()) return;
      if (!notificationAudio || notificationAudio.state !== 'running') return;
      try {
        const start = notificationAudio.currentTime;
        [660, 880].forEach((frequency, index) => {
          const tone = notificationAudio.createOscillator();
          const gain = notificationAudio.createGain();
          tone.frequency.value = frequency;
          const at = start + index * 0.13;
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(soundVolume() / 100 * 0.16, at + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
          tone.connect(gain); gain.connect(notificationAudio.destination);
          tone.onended = () => { tone.disconnect(); gain.disconnect(); };
          tone.start(at); tone.stop(at + 0.24);
        });
      } catch (_) { /* Unsupported audio remains silent. */ }
    }
  };
  function syncNotificationSettings() {
    document.querySelectorAll('.notification-settings').forEach(group => {
      const enabled = localStorage.getItem(soundEnabledKey) === 'true';
      group.querySelector('[data-sound-enabled]').checked = enabled;
      group.querySelector('[data-sound-volume]').value = soundVolume();
      group.querySelector('output').textContent = soundVolume() + '%';
      group.querySelector('button').disabled = !enabled || !soundVolume();
    });
  }
  function prepareNotificationSettings(container) {
    if (!container || container.querySelector('.notification-settings')) return;
    const group = document.createElement('section');
    group.className = 'notification-settings';
    group.innerHTML = '<h3>Notification sound</h3><label><input type="checkbox" data-sound-enabled> Enable sound</label><label>Volume <output>50%</output><input type="range" min="0" max="100" step="1" data-sound-volume aria-label="Notification volume"></label><button type="button">Preview sound</button>';
    container.append(group);
    group.addEventListener('input', event => {
      if (event.target.matches('[data-sound-enabled]')) {
        localStorage.setItem(soundEnabledKey, String(event.target.checked));
        window.CashNotificationSound.unlock();
      }
      if (event.target.matches('[data-sound-volume]')) localStorage.setItem(soundVolumeKey, event.target.value);
      syncNotificationSettings();
    });
    group.querySelector('button').addEventListener('click', async () => {
      window.CashNotificationSound.unlock();
      try { await notificationAudio?.resume(); window.CashNotificationSound.play(); } catch (_) {}
    });
    syncNotificationSettings();
  }
  window.addEventListener('storage', syncNotificationSettings);
  function preparePayColors(container) {
    if (!container || container.querySelector('.m4-pay-colors')) return;
    const group = document.createElement('div');
    group.className = 'm4-pay-colors';
    group.innerHTML = '<label><input type="checkbox" data-pay-color-enabled> Customize Mode 4 Pay color</label><label>Pay background<select data-pay-color><option value="green">Green</option><option value="purple">Purple</option><option value="white">White</option><option value="dark">Dark</option><option value="red">Red</option></select></label><p>Off restores the original green. Other pages keep their light/dark setting.</p>';
    container.append(group);
    group.addEventListener('change', () => {
      localStorage.setItem('cashAppMode4PayColorEnabled', String(group.querySelector('input').checked));
      localStorage.setItem('cashAppMode4PayColor', group.querySelector('select').value);
      applyPayColors();
    });
    applyPayColors();
  }
  function applyPayColors() {
    const palettes = {green:['#00d632','#000000'],purple:['#7139d8','#ffffff'],white:['#ffffff','#111111'],dark:['#111111','#ffffff'],red:['#c92537','#ffffff']};
    const enabled = localStorage.getItem('cashAppMode4PayColorEnabled') === 'true';
    const selected = localStorage.getItem('cashAppMode4PayColor') || 'green';
    const palette = palettes[enabled ? selected : 'green'] || palettes.green;
    document.documentElement.style.setProperty('--m4-pay-bg',palette[0]);
    document.documentElement.style.setProperty('--m4-pay-ink',palette[1]);
    document.querySelectorAll('.m4-pay-colors').forEach(group => {
      group.querySelector('input').checked = enabled;
      group.querySelector('select').value = palettes[selected] ? selected : 'green';
      group.querySelector('select').disabled = !enabled;
    });
  }
  function openMode4Settings() {
    let dialog = document.getElementById('m4-settings');
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id='m4-settings';
      dialog.innerHTML='<h2>Settings</h2><label>Mode 4 appearance<select id="m4-quick-theme"><option value="white">Light</option><option value="dark">Dark</option></select></label><label class="m4-setting-check"><input id="m4-quick-face" type="checkbox"> iOS Face ID demo animation</label><p>Animation only—not biometric authentication.</p><a href="profile.html?settings=1">All personal &amp; app settings →</a><form method="dialog"><button>Done</button></form>';
      document.body.append(dialog);
      dialog.querySelector('select').addEventListener('change',event=>{
        localStorage.setItem('cashAppMode4Style',event.target.value);
        window.dispatchEvent(new Event('cash-theme-change'));
      });
      dialog.querySelector('input').addEventListener('change',event=>localStorage.setItem('cashAppMode4FaceId',String(event.target.checked)));
    }
    preparePayColors(dialog);
    prepareNotificationSettings(dialog);
    syncNotificationSettings();
    applyPayColors();
    dialog.querySelector('select').value=localStorage.getItem('cashAppMode4Style') || 'white';
    dialog.querySelector('input').checked=localStorage.getItem('cashAppMode4FaceId')==='true';
    dialog.showModal();
  }
  function prepareMode4CardPreview() {
    if (page !== 'home.html' || document.getElementById('m4-card-toggle')) return;
    const header=document.querySelector('.app-header');
    if (!header) return;
    const button=document.createElement('button'); button.id='m4-card-toggle'; button.type='button';
    button.textContent='⌄ Show card';button.setAttribute('aria-haspopup','dialog');
    header.after(button);
    let dialog;
    function show() {
      if (!document.body.classList.contains('pay-mode-4')) return;
      if (!dialog) {
        dialog=document.createElement('dialog');dialog.id='m4-card-preview';
        dialog.innerHTML='<div class="m4-preview-bar"><strong>Card</strong><a href="card.html">Open full page</a><button type="button" aria-label="Close card preview">×</button></div><iframe title="Card preview"></iframe>';
        document.body.append(dialog);
        dialog.querySelector('button').addEventListener('click',()=>dialog.close());
        dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
        dialog.querySelector('iframe').addEventListener('load',()=>{
          const doc=dialog.querySelector('iframe').contentDocument;
          if (!doc) return;
          const style=doc.createElement('style');
          style.textContent='.bottom-nav,.cash-shared-nav{display:none!important}';
          doc.head.append(style);
        });
      }
      dialog.showModal();
      const frame=dialog.querySelector('iframe');
      if (!frame.getAttribute('src')) frame.src='card.html';
    }
    button.addEventListener('click',show);
    let origin;
    const scroller=document.querySelector('.main-content');
    document.addEventListener('touchstart',event=>{
      origin=null;
      if (!document.body.classList.contains('pay-mode-4') || event.touches.length!==1 || document.querySelector('dialog[open], .transaction-modal-overlay.show')) return;
      if ((scroller?.scrollTop || 0)>0 || window.scrollY>0) return;
      origin={x:event.touches[0].clientX,y:event.touches[0].clientY};
    },{passive:true});
    document.addEventListener('touchmove',event=>{
      if (!origin || event.touches.length!==1) return;
      const dy=event.touches[0].clientY-origin.y;
      const dx=event.touches[0].clientX-origin.x;
      if (dy>0 && Math.abs(dx)<40) button.style.height=`${112+Math.min(dy,110)}px`;
    },{passive:true});
    document.addEventListener('touchcancel',()=>{ origin=null; button.style.height=''; },{passive:true});
    document.addEventListener('touchend',event=>{
      button.style.height='';
      if (!origin || !event.changedTouches.length) return;
      const touch=event.changedTouches[0], dy=touch.clientY-origin.y, dx=touch.clientX-origin.x;
      if (dy>80 && Math.abs(dx)<40) show();
      origin=null;
    },{passive:true});
  }
  async function loadMode4CardArtwork() {
    const button = document.getElementById('m4-card-toggle');
    if (!button || button.dataset.artwork || localStorage.getItem('cashAppPayMode') !== '4') return;
    button.dataset.artwork = 'loading';
    try {
      const response = await fetch('card.html');
      if (!response.ok) throw new Error('Card preview unavailable');
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const source = doc.querySelector('.card-front');
      if (!source) throw new Error('Card artwork not found');
      const artwork = document.createElement('span'); artwork.className = 'm4-card-artwork';
      // Reuse only the existing card's visual elements, not its scripts or controls.
      for (const selector of ['.card-chip', '.card-number', '.card-footer']) {
        const item = source.querySelector(selector);
        if (item) artwork.append(document.importNode(item, true));
      }
      artwork.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      let profile = {};
      try { profile = JSON.parse(localStorage.getItem('cashAppUserProfile') || '{}') || {}; } catch {}
      const holder = artwork.querySelector('.card-holder-name');
      if (holder) holder.textContent = profile.fullName || '';
      const label = document.createElement('span'); label.className = 'm4-artwork-label'; label.textContent = 'DEMO';
      artwork.append(label);
      button.replaceChildren(artwork);
      button.setAttribute('aria-label', 'Open card preview');
      button.dataset.artwork = 'ready';
    } catch {
      delete button.dataset.artwork;
      // Keep the existing functional View card button if the preview cannot load.
    }
  }
  function prepareMode4Home() {
    if (page !== 'home.html' || document.getElementById('m4-balance-visibility')) return;
    const balance = document.getElementById('balance-preview-card');
    if (!balance) return;
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem('cashAppUserProfile') || '{}') || {}; } catch {}
    const toggle = document.getElementById('m4-card-toggle');
    if (toggle) {
      const card = document.createElement('span'); card.className = 'm4-card-caption'; card.textContent = 'View card';
      const tag = document.createElement('span'); tag.textContent = profile.cashtag ? '$' + String(profile.cashtag).replace(/^[$@]/, '') : 'View card';
      toggle.replaceChildren(card, tag);
    }
    const header = balance.querySelector('.balance-header');
    const number = document.createElement('span'); number.className = 'm4-account-tail';
    const digits = String(profile.accountNumber || '').replace(/\D/g, '').slice(-4);
    number.textContent = digits ? ' •• ' + digits : '';
    header.querySelector('span')?.append(number);
    const eye = document.createElement('button'); eye.id = 'm4-balance-visibility'; eye.type = 'button';
    eye.setAttribute('aria-label', 'Hide balance'); eye.setAttribute('aria-pressed', 'false');
    eye.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="m4-eye-slash" d="m3 21 18-18"/></svg>';
    header.append(eye);
    eye.addEventListener('click', () => {
      const hidden = balance.classList.toggle('m4-balance-hidden');
      eye.setAttribute('aria-pressed', String(hidden));
      eye.setAttribute('aria-label', hidden ? 'Show balance' : 'Hide balance');
      document.getElementById('balance-amount').setAttribute('aria-hidden', String(hidden));
    });
    const green = document.createElement('button'); green.type = 'button'; green.className = 'm4-green-card';
    green.innerHTML = '<img class="m4-green-logo" src="icons/app-full-192-v7.png" alt=""><span>Cash App Green</span><span>View details ›</span>';
    green.addEventListener('click', () => window.showFeatureNotImplementedModal?.());
    balance.after(green);
    document.querySelectorAll('.savings-list-card').forEach(link => {
      const title = link.querySelector('.title')?.textContent.trim();
      const symbol = title === 'Savings' ? '$' : title === 'Bitcoin' ? '₿' : null;
      if (!symbol) return;
      const icon = document.createElement('span'); icon.className = 'm4-asset-symbol'; icon.textContent = symbol; icon.setAttribute('aria-hidden','true');
      link.querySelector('.icon-container')?.append(icon);
    });
  }
  function prepareMode4Header() {
    if (!['index.html','home.html'].includes(page)) return;
    const header = document.querySelector(page === 'index.html' ? '.pay-header' : '.app-header');
    if (!header || header.querySelector('.m4-smile')) return;
    document.body.classList.add(page === 'index.html' ? 'm4-pay-page' : 'm4-home-page');
    const svg = paths => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths+'</svg>';
    const smile = document.createElement('button');
    smile.type='button'; smile.className='m4-icon m4-smile'; smile.setAttribute('aria-label','Open settings');
    smile.innerHTML=svg('<path d="M7 7v2m10-2v2M6 15q6 5 12 0"/>');
    const tools = document.createElement('div'); tools.className='m4-tools';
    const qr = document.createElement('button'); qr.type='button'; qr.className='m4-icon'; qr.setAttribute('aria-label','QR code options');
    qr.innerHTML=svg('<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h4v4h-6v-2M21 13v2"/>');
    const search = document.createElement('a'); search.href='activty.html'; search.className='m4-icon'; search.setAttribute('aria-label','Search activity');
    search.innerHTML=svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>');
    tools.append(qr,search);
    const profile = header.querySelector('.profile-icon-link');
    if (profile) { profile.setAttribute('aria-label','Profile'); tools.append(profile); }
    header.prepend(smile);header.append(tools);
    function information(title, message) {
      let dialog=document.getElementById('m4-information');
      if (!dialog) {
        dialog=document.createElement('dialog');dialog.id='m4-information';
        dialog.innerHTML='<h2></h2><p></p><form method="dialog"><button>Close</button></form>';
        document.body.append(dialog);
      }
      dialog.querySelector('h2').textContent=title;
      dialog.querySelector('p').textContent=message;
      dialog.showModal();
    }
    smile.addEventListener('click', openMode4Settings);
    qr.addEventListener('click',()=>information('QR codes','QR scanning and payment QR codes are not available in this demo yet.'));
  }

  function applyMode4() {
    preparePayColors(document.getElementById('login-mode4-theme')?.closest('.settings-section'));
    applyPayColors();
    prepareMode4Header();
    prepareMode4CardPreview();
    prepareMode4Home();
    loadMode4CardArtwork();
    const active = localStorage.getItem('cashAppPayMode') === '4';
    const light = localStorage.getItem('cashAppMode4Style') !== 'dark';
    const wasActive = document.body.classList.contains('pay-mode-4');
    document.body.classList.toggle('pay-mode-4', active);
    document.body.classList.toggle('mode4-white', active && light);
    if (active) {
      document.body.classList.toggle('mode2-white', light);
      window.CashTheme?.apply();
    } else if (wasActive) {
      document.body.classList.toggle('mode2-white', localStorage.getItem('cashAppMode2Style') === 'white');
      window.CashTheme?.apply();
    }
  }
  let faceIdPromise;
  window.CashMode4 = {
    isFaceIdEnabled() {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return localStorage.getItem('cashAppPayMode') === '4' && ios && localStorage.getItem('cashAppMode4FaceId') === 'true';
    },
    faceId() {
      if (!window.CashMode4.isFaceIdEnabled()) return Promise.resolve();
      if (faceIdPromise) return faceIdPromise;
      faceIdPromise = new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'mode4-faceid-overlay';
        overlay.setAttribute('role','status');
        overlay.innerHTML = '<video src="icons/faceIDvideo.mp4" playsinline muted></video><span>Face ID demo</span>';
        document.body.appendChild(overlay);
        const video = overlay.querySelector('video');
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true; clearTimeout(timer);
          video.pause();
          overlay.classList.add('is-leaving');
          setTimeout(() => { overlay.remove(); resolve(); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
        };
        const timer = setTimeout(done, 5000);
        video.muted = true;
        video.addEventListener('ended',done,{once:true});
        video.addEventListener('error',done,{once:true});
        try { video.play().catch(done); } catch (_) { done(); }
      }).finally(() => { faceIdPromise = null; });
      return faceIdPromise;
    }
  };
  window.addEventListener('cash-theme-change',applyMode4);
  window.addEventListener('pageshow',applyMode4);
  window.addEventListener('storage',event => {
    if (['cashAppPayMode','cashAppMode4Style','cashAppMode4PayColorEnabled','cashAppMode4PayColor'].includes(event.key)) applyMode4();
  });

  const init = () => {
    prepareNotificationSettings(document.querySelector('#settingsModal .settings-card'));
    prepareNotificationSettings(document.querySelector('#personal-edit-overlay .edit-content'));
    applyMode4();
    ensureNav();
    enforceLogout();
    // Prepare animations without showing or playing a navigation spinner.
    getRenderer().catch(() => {});
    ['loader_lm.json', 'loader_dm.json'].forEach(path => getLoaderData(path).catch(() => {}));
    document.querySelectorAll('[data-cash-inline-loader]').forEach(host => mount(host));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
