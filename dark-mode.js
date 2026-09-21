// Resolve the page theme without changing the user's saved global preference.
(function () {
  'use strict';
  const mode3Pages = new Set(['home.html', 'activty.html', 'profile.html', 'card.html', 'savings.html']);
  const page = location.pathname.split('/').pop().toLowerCase();
  const keys = new Set(['cashAppDarkMode', 'cashAppPayMode', 'cashAppMode3Style', 'cashAppMode4Style']);
  function isDark() {
    try {
      if (localStorage.getItem('cashAppPayMode') === '4') return localStorage.getItem('cashAppMode4Style') === 'dark';
      if (mode3Pages.has(page) && localStorage.getItem('cashAppPayMode') === '3') {
        return (localStorage.getItem('cashAppMode3Style') || 'dark') !== 'white';
      }
      return localStorage.getItem('cashAppDarkMode') === 'true';
    } catch (_) { return false; }
  }
  function apply() {
    const dark = isDark();
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.backgroundColor = dark ? '#000000' : '#ffffff';
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.classList.toggle('dark-boot', dark && !document.body);
    if (document.body) document.body.classList.toggle('dark-mode', dark);
  }
  window.CashTheme = { apply, isDark };
  apply();
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  window.addEventListener('pageshow', apply);
  window.addEventListener('cash-theme-change', apply);
  window.addEventListener('storage', event => { if (event.key === null || keys.has(event.key)) apply(); });
})();


