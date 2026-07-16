// Site görünüm ayarları — localStorage'da saklanır, her sayfada script'lerden önce uygulanır.
(() => {
  const DEFAULTS = { accent: '#7c6ff0', opacity: 58, blur: 3 };

  const load = () => {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('siteSettings') || '{}') };
    } catch {
      return { ...DEFAULTS };
    }
  };

  const apply = (s) => {
    const root = document.documentElement.style;
    root.setProperty('--accent', s.accent);
    root.setProperty('--modal-opacity', String(s.opacity / 100));
    root.setProperty('--modal-blur', `${s.blur}px`);
  };

  const save = (s) => localStorage.setItem('siteSettings', JSON.stringify(s));

  window.SiteTheme = { DEFAULTS, load, apply, save };
  apply(load());
})();
