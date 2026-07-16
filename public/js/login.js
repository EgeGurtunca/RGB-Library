const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');
const btn = document.getElementById('login-btn');
const subtitle = document.getElementById('login-subtitle');
const toggleText = document.getElementById('toggle-text');
const modeToggle = document.getElementById('mode-toggle');

// 'login' veya 'register'
let mode = 'login';

const MODES = {
  login: {
    subtitle: 'Devam etmek için giriş yapın',
    button: 'Giriş Yap',
    busy: 'Giriş yapılıyor...',
    toggleText: 'Hesabınız yok mu?',
    toggleLink: 'Kayıt olun',
    endpoint: '/api/login',
    fallbackError: 'Giriş başarısız.',
  },
  register: {
    subtitle: 'Yeni bir hesap oluşturun',
    button: 'Kayıt Ol',
    busy: 'Kayıt yapılıyor...',
    toggleText: 'Zaten hesabınız var mı?',
    toggleLink: 'Giriş yapın',
    endpoint: '/api/register',
    fallbackError: 'Kayıt başarısız.',
  },
};

// Giriş butonu — liquid glass; arkasındaki renkli ışık küreleri camdan kırılarak görünür
// Not: liquid-glass kendi etiket span'ını ekler; HTML'deki metin silinmezse yazı iki kez görünür.
if (window.LiquidGlass) btn.textContent = '';
const btnGlass = window.LiquidGlass
  ? LiquidGlass.createLiquidButton(btn, {
      label: MODES[mode].button,
      glassThickness: 100,
      bezelWidth: 12,
      refractiveIndex: 1.5,
      profile: 'convexSquircle',
    })
  : null;

const setBtnText = (text) => {
  if (btnGlass) btnGlass.setLabel(text);
  else btn.textContent = text;
};

const applyMode = () => {
  const m = MODES[mode];
  subtitle.textContent = m.subtitle;
  toggleText.textContent = m.toggleText;
  modeToggle.textContent = m.toggleLink;
  setBtnText(m.button);
  errorEl.hidden = true;
};

modeToggle.addEventListener('click', (e) => {
  e.preventDefault();
  mode = mode === 'login' ? 'register' : 'login';
  applyMode();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const m = MODES[mode];
  errorEl.hidden = true;
  btn.disabled = true;
  setBtnText(m.busy);

  try {
    const res = await fetch(m.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value,
      }),
    });

    if (res.ok) {
      window.location.href = '/';
      return;
    }

    const data = await res.json().catch(() => ({}));
    errorEl.textContent = data.error || m.fallbackError;
    errorEl.hidden = false;
  } catch {
    errorEl.textContent = 'Sunucuya ulaşılamadı.';
    errorEl.hidden = false;
  } finally {
    btn.disabled = false;
    setBtnText(MODES[mode].button);
  }
});
