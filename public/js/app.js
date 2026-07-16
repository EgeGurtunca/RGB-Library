const grid = document.getElementById('book-grid');
const emptyState = document.getElementById('empty-state');
const resultCount = document.getElementById('result-count');
const searchInput = document.getElementById('search');
const yearMinInput = document.getElementById('year-min');
const yearMaxInput = document.getElementById('year-max');
const sortSelect = document.getElementById('sort');
const genreChips = document.getElementById('genre-chips');
const shelfChips = document.getElementById('shelf-chips');
const addBookBtn = document.getElementById('add-book-btn');
const loansBtn = document.getElementById('loans-btn');
const statsBtn = document.getElementById('stats-btn');
const userChip = document.getElementById('user-chip');
const userNameEl = document.getElementById('user-name');

const modalOverlay = document.getElementById('modal-overlay');
const modal = document.getElementById('modal');

let activeGenre = '';
let activeShelf = '';
let currentBooks = [];
let knownGenres = [];
let currentUser = null;

const isAdmin = () => currentUser && currentUser.role === 'admin';

// ============ Dil (i18n) ============
const I18N = {
  tr: {
    searchPh: 'Kitap veya yazar ara...',
    logout: 'Çıkış',
    all: 'Tümü',
    year: 'Yıl',
    from: 'Başlangıç',
    to: 'Bitiş',
    sortLabel: 'Sırala',
    sortOptions: ['Başlığa göre (A–Z)', 'Puana göre', 'Yıla göre (yeni → eski)', 'Yıla göre (eski → yeni)'],
    found: (n) => `${n} kitap bulundu`,
    empty: 'Aradığınız kriterlere uygun kitap bulunamadı. 🔍',
    pages: 'sayfa',
    summary: 'Özet',
    brand: 'Kütüphane',
    shelfLabels: { '': 'Tüm Kitaplar', 'favorites': '♥ Favorilerim', 'toread': 'Okuyacaklarım', 'read': 'Okuduklarım', 'borrowed': 'Ödünç Aldıklarım' },
    addBook: '+ Kitap Ekle',
    actFav: 'Favori',
    actToread: 'Okuyacağım',
    actRead: 'Okudum',
    edit: 'Düzenle',
    del: 'Sil',
    confirmDelete: (title) => `"${title}" kitabı kalıcı olarak silinsin mi?`,
    formNew: 'Yeni Kitap',
    formEdit: 'Kitabı Düzenle',
    fTitle: 'Başlık',
    fTitleEn: 'İngilizce Başlık (isteğe bağlı)',
    fAuthor: 'Yazar',
    fGenre: 'Tür',
    fYear: 'Yayın Yılı',
    fPages: 'Sayfa Sayısı',
    fRating: 'Puan (0–5)',
    fDesc: 'Açıklama',
    save: 'Kaydet',
    cancel: 'Vazgeç',
    saveFail: 'Kaydedilemedi.',
    fCopies: 'Kopya Sayısı',
    reviews: 'Değerlendirmeler',
    yourReview: 'Senin değerlendirmen',
    commentPh: 'Yorumun (isteğe bağlı)',
    sendReview: 'Gönder',
    deleteReview: 'Değerlendirmemi Sil',
    noReviews: 'Henüz değerlendirme yok — ilk yorumu sen yaz!',
    pickRating: 'Önce yıldız verin',
    borrow: 'Ödünç Al',
    returnBook: 'İade Et',
    available: (a, c) => `${a}/${c} kopya müsait`,
    outOfStock: 'Tüm kopyalar ödünçte',
    dueDate: 'İade tarihi',
    overdueLabel: 'Gecikmiş!',
    loansBtn: 'Ödünçler',
    loansTitle: 'Aktif Ödünçler',
    noLoans: 'Aktif ödünç yok.',
    adminReturn: 'İade Al',
    borrowedAt: 'Alış',
    fCover: 'Kapak URL (isteğe bağlı)',
    statsBtn: 'İstatistik',
    statsTitle: 'Kütüphane İstatistikleri',
    stBooks: 'Kitap',
    stUsers: 'Üye',
    stReviews: 'Değerlendirme',
    stTotalLoans: 'Toplam Ödünç',
    stActive: 'Aktif Ödünç',
    stOverdue: 'Gecikmiş',
    topBorrowed: 'En Çok Ödünç Alınanlar',
    topRated: 'En Yüksek Puanlılar',
    byGenre: 'Türlere Göre Dağılım',
    noData: 'Henüz veri yok.',
    profileTip: 'Profilim',
    memberSince: 'Üyelik tarihi',
    changePass: 'Şifre Değiştir',
    currentPass: 'Mevcut şifre',
    newPass: 'Yeni şifre (en az 6 karakter)',
    passSaved: 'Şifren güncellendi ✓',
    passFail: 'Şifre değiştirilemedi.',
    myReviews: 'Değerlendirmelerim',
    noMyReviews: 'Henüz değerlendirme yapmadın.',
    myLoans: 'Ödünç Geçmişim',
    noMyLoans: 'Henüz kitap ödünç almadın.',
    returnedAt: 'İade edildi',
    stillOut: 'Sende',
  settings: 'Ayarlar',
    accentColor: 'Site Rengi',
    customColor: 'Özel renk seç',
    popupOpacity: 'Pop-up Opaklığı',
    glassBlur: 'Cam Bulanıklığı',
    resetSettings: 'Varsayılana Dön',
  },
  en: {
    searchPh: 'Search by book or author...',
    logout: 'Log out',
    all: 'All',
    year: 'Year',
    from: 'From',
    to: 'To',
    sortLabel: 'Sort',
    sortOptions: ['By title (A–Z)', 'By rating', 'By year (newest first)', 'By year (oldest first)'],
    found: (n) => `${n} ${n === 1 ? 'book' : 'books'} found`,
    empty: 'No books match your criteria. 🔍',
    pages: 'pages',
    summary: 'Summary',
    brand: 'Library',
    shelfLabels: { '': 'All Books', 'favorites': '♥ My Favorites', 'toread': 'To Read', 'read': 'Finished', 'borrowed': 'My Loans' },
    addBook: '+ Add Book',
    actFav: 'Favorite',
    actToread: 'To Read',
    actRead: 'Finished',
    edit: 'Edit',
    del: 'Delete',
    confirmDelete: (title) => `Permanently delete "${title}"?`,
    formNew: 'New Book',
    formEdit: 'Edit Book',
    fTitle: 'Title',
    fTitleEn: 'English Title (optional)',
    fAuthor: 'Author',
    fGenre: 'Genre',
    fYear: 'Publication Year',
    fPages: 'Pages',
    fRating: 'Rating (0–5)',
    fDesc: 'Description',
    save: 'Save',
    cancel: 'Cancel',
    saveFail: 'Could not save.',
    fCopies: 'Copies',
    reviews: 'Reviews',
    yourReview: 'Your review',
    commentPh: 'Your comment (optional)',
    sendReview: 'Submit',
    deleteReview: 'Delete My Review',
    noReviews: 'No reviews yet — be the first!',
    pickRating: 'Pick a star rating first',
    borrow: 'Borrow',
    returnBook: 'Return',
    available: (a, c) => `${a}/${c} copies available`,
    outOfStock: 'All copies on loan',
    dueDate: 'Due date',
    overdueLabel: 'Overdue!',
    loansBtn: 'Loans',
    loansTitle: 'Active Loans',
    noLoans: 'No active loans.',
    adminReturn: 'Mark Returned',
    borrowedAt: 'Borrowed',
    fCover: 'Cover URL (optional)',
    statsBtn: 'Stats',
    statsTitle: 'Library Statistics',
    stBooks: 'Books',
    stUsers: 'Users',
    stReviews: 'Reviews',
    stTotalLoans: 'Total Loans',
    stActive: 'Active Loans',
    stOverdue: 'Overdue',
    topBorrowed: 'Most Borrowed',
    topRated: 'Top Rated',
    byGenre: 'Books by Genre',
    noData: 'No data yet.',
    profileTip: 'My Profile',
    memberSince: 'Member since',
    changePass: 'Change Password',
    currentPass: 'Current password',
    newPass: 'New password (min 6 characters)',
    passSaved: 'Password updated ✓',
    passFail: 'Could not change password.',
    myReviews: 'My Reviews',
    noMyReviews: "You haven't reviewed any books yet.",
    myLoans: 'My Loan History',
    noMyLoans: "You haven't borrowed any books yet.",
    returnedAt: 'Returned',
    stillOut: 'Checked out',
  settings: 'Settings',
    accentColor: 'Site Color',
    customColor: 'Pick a custom color',
    popupOpacity: 'Popup Opacity',
    glassBlur: 'Glass Blur',
    resetSettings: 'Reset to Default',
  },
};

const GENRE_EN = {
  'Roman': 'Novel',
  'Bilim Kurgu': 'Science Fiction',
  'Fantastik': 'Fantasy',
  'Polisiye': 'Crime',
  'Tarih': 'History',
  'Felsefe': 'Philosophy',
  'Şiir': 'Poetry',
  'Macera': 'Adventure',
  'Kişisel Gelişim': 'Self-Improvement',
};

let lang = localStorage.getItem('lang') === 'en' ? 'en' : 'tr';
const t = () => I18N[lang];
const genreLabel = (g) => (lang === 'en' ? (GENRE_EN[g] || g) : g);
const bookTitle = (b) => (lang === 'en' && b.title_en ? b.title_en : b.title);

// Tür başına renk sınıfı + çizgisel SVG ikon
const GENRE_META = {
  'Roman': {
    cls: 'g-roman',
    icon: '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
  },
  'Bilim Kurgu': {
    cls: 'g-bilim-kurgu',
    icon: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  },
  'Fantastik': {
    cls: 'g-fantastik',
    icon: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/>',
  },
  'Polisiye': {
    cls: 'g-polisiye',
    icon: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  },
  'Tarih': {
    cls: 'g-tarih',
    icon: '<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  },
  'Felsefe': {
    cls: 'g-felsefe',
    icon: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  },
  'Şiir': {
    cls: 'g-siir',
    icon: '<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/>',
  },
  'Macera': {
    cls: 'g-macera',
    icon: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  },
  'Kişisel Gelişim': {
    cls: 'g-kisisel-gelisim',
    icon: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  },
};

const DEFAULT_META = {
  cls: '',
  icon: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
};

const genreMeta = (genre) => GENRE_META[genre] || DEFAULT_META;

const iconSvg = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const HEART_SVG = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

const formatYear = (year) => {
  if (year < 0) return lang === 'en' ? `${-year} BC` : `MÖ ${-year}`;
  return year;
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

// SQLite'ın 'YYYY-MM-DD HH:MM:SS' (UTC) tarihini yerel biçimde göster
const fmtDate = (sqlDate) => new Date(sqlDate.replace(' ', 'T') + 'Z')
  .toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
const isOverdue = (sqlDate) => new Date(sqlDate.replace(' ', 'T') + 'Z') < new Date();
const starRow = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// ============ Oturumdaki kullanıcı ============
async function loadMe() {
  const res = await fetch('/api/me');
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }
  currentUser = await res.json();
  userNameEl.textContent = currentUser.user;
  userChip.hidden = false;
  addBookBtn.hidden = !isAdmin();
  loansBtn.hidden = !isAdmin();
  statsBtn.hidden = !isAdmin();
}

// ============ Raf güncelleme (favori / okuma durumu) ============
async function setShelf(book, patch) {
  const res = await fetch(`/api/books/${book.id}/shelf`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return;
  const data = await res.json();
  book.favorite = data.favorite ? 1 : 0;
  book.status = data.status;
}

async function loadBooks() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (activeGenre) params.set('genre', activeGenre);
  if (activeShelf) params.set('shelf', activeShelf);
  if (yearMinInput.value) params.set('yearMin', yearMinInput.value);
  if (yearMaxInput.value) params.set('yearMax', yearMaxInput.value);
  params.set('sort', sortSelect.value);

  const res = await fetch(`/api/books?${params}`);
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }
  const { count, books } = await res.json();

  resultCount.textContent = t().found(count);
  emptyState.hidden = count > 0;
  currentBooks = books;

  grid.innerHTML = books.map((b, i) => {
    const meta = genreMeta(b.genre);
    const statusBadge = b.status
      ? `<span class="status-badge s-${b.status}">${b.status === 'read' ? '✓ ' + t().actRead : t().actToread}</span>`
      : '';
    return `
    <article class="book-card ${meta.cls}" data-index="${i}" style="animation-delay:${Math.min(i * 25, 400)}ms">
      <div class="book-cover">
        <button class="fav-btn ${b.favorite ? 'active' : ''}" aria-label="${t().actFav}">${HEART_SVG}</button>
        ${statusBadge}
        ${b.my_due ? `<span class="borrow-badge ${isOverdue(b.my_due) ? 'overdue' : ''}" title="${t().dueDate}: ${fmtDate(b.my_due)}">📖</span>` : ''}
        <div class="cover-icon">${iconSvg(meta.icon)}</div>
        ${b.cover_url ? `<img class="cover-img" src="${escapeHtml(b.cover_url)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      </div>
      <div class="book-info">
        <h3 class="book-title">${escapeHtml(bookTitle(b))}</h3>
        <p class="book-author">${escapeHtml(b.author)}</p>
        <div class="book-meta">
          <span class="genre-badge">${escapeHtml(genreLabel(b.genre))}</span>
          <span class="book-year">${formatYear(b.year)}</span>
          <span class="book-rating">★ ${Number(b.avg_rating).toFixed(1)}${b.review_count ? ` <small>(${b.review_count})</small>` : ''}</span>
        </div>
        <p class="book-desc">${escapeHtml(b.description)}</p>
      </div>
    </article>`;
  }).join('');
}

async function loadGenres() {
  const res = await fetch('/api/genres');
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }
  knownGenres = await res.json();
  if (activeGenre && !knownGenres.includes(activeGenre)) activeGenre = '';
  genreChips.innerHTML = [
    `<button class="chip ${activeGenre ? '' : 'active'}" data-genre="">${t().all}</button>`,
    ...knownGenres.map((g) =>
      `<button class="chip ${g === activeGenre ? 'active' : ''}" data-genre="${escapeHtml(g)}">${escapeHtml(genreLabel(g))}</button>`),
  ].join('');
}

// ============ Dil değiştirici ============
const langSwitch = document.getElementById('lang-switch');
const langKnob = document.getElementById('lang-knob');

function applyLang() {
  const L = t();
  document.documentElement.lang = lang;
  document.title = L.brand;
  document.querySelector('.brand span').textContent = L.brand;
  searchInput.placeholder = L.searchPh;
  if (logoutGlass) logoutGlass.setLabel(L.logout);
  else document.getElementById('logout-btn').textContent = L.logout;
  addBookBtn.textContent = L.addBook;
  loansBtn.textContent = L.loansBtn;
  statsBtn.textContent = L.statsBtn;
  const settingsBtn = document.getElementById('settings-btn');
  settingsBtn.title = L.settings;
  settingsBtn.setAttribute('aria-label', L.settings);
  userChip.title = L.profileTip;
  document.querySelector('label[for="year-min"]').textContent = L.year;
  yearMinInput.placeholder = L.from;
  yearMaxInput.placeholder = L.to;
  document.querySelector('label[for="sort"]').textContent = L.sortLabel;
  [...sortSelect.options].forEach((opt, i) => { opt.text = L.sortOptions[i]; });
  emptyState.textContent = L.empty;
  langSwitch.dataset.lang = lang;
  langSwitch.querySelectorAll('.lang-opt').forEach((opt) => {
    opt.classList.toggle('active', opt.dataset.lang === lang);
  });
  genreChips.querySelectorAll('.chip').forEach((chip) => {
    chip.textContent = chip.dataset.genre ? genreLabel(chip.dataset.genre) : L.all;
  });
  shelfChips.querySelectorAll('.chip').forEach((chip) => {
    chip.textContent = L.shelfLabels[chip.dataset.shelf];
  });
}

function setLang(next) {
  if (next === lang) return;
  lang = next;
  localStorage.setItem('lang', lang);
  applyLang();
  loadBooks();
}

// Topuzu sürükleyerek (veya tıklayarak) dil seçimi
let dragState = null;

langSwitch.addEventListener('pointerdown', (e) => {
  const travel = langKnob.offsetWidth;
  dragState = {
    startX: e.clientX,
    startPos: lang === 'en' ? travel : 0,
    pos: lang === 'en' ? travel : 0,
    travel,
    moved: false,
  };
  langSwitch.setPointerCapture(e.pointerId);
  langSwitch.classList.add('dragging');
  langKnob.style.transition = 'none';
});

langSwitch.addEventListener('pointermove', (e) => {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  if (Math.abs(dx) > 3) dragState.moved = true;
  dragState.pos = Math.min(Math.max(dragState.startPos + dx, 0), dragState.travel);
  langKnob.style.transform = `translateX(${dragState.pos}px)`;
});

langSwitch.addEventListener('pointerup', (e) => {
  if (!dragState) return;
  const { travel, moved, pos } = dragState;
  let next;
  if (moved) {
    next = pos > travel / 2 ? 'en' : 'tr';
  } else {
    // Sürüklemeden tıklandıysa: tıklanan taraf seçilir
    const rect = langSwitch.getBoundingClientRect();
    next = e.clientX - rect.left > rect.width / 2 ? 'en' : 'tr';
  }
  dragState = null;
  langSwitch.classList.remove('dragging');
  langKnob.style.transition = '';
  langKnob.style.transform = '';
  langSwitch.dataset.lang = next;
  setLang(next);
});

langSwitch.addEventListener('pointercancel', () => {
  dragState = null;
  langSwitch.classList.remove('dragging');
  langKnob.style.transition = '';
  langKnob.style.transform = '';
});

// ============ Kitap detay modalı ============
const buildSummary = (b) => {
  if (lang === 'en') {
    const genreLower = genreLabel(b.genre).toLowerCase();
    const published = b.year < 0
      ? `written around ${-b.year} BC`
      : `published in ${b.year}`;
    return `This ${genreLower} work by ${b.author} was ${published}. ${b.description} ` +
      `Spanning ${b.pages} pages, the book holds a reader rating of ${Number(b.avg_rating).toFixed(1)} out of 5.`;
  }
  const genreLower = b.genre.toLocaleLowerCase('tr-TR');
  const published = b.year < 0
    ? `MÖ ${-b.year} civarında kaleme alındı`
    : `${b.year} yılında yayımlandı`;
  return `${b.author} imzalı bu ${genreLower} türündeki eser, ${published}. ${b.description} ` +
    `${b.pages} sayfalık kitap, okurlardan 5 üzerinden ${Number(b.avg_rating).toFixed(1)} puan aldı.`;
};

const glassLayers = `
    <div class="glass-blur"></div>
    <div class="glass-effect"></div>
    <div class="glass-tint"></div>
    <div class="glass-shine"></div>
    <button class="modal-close" aria-label="Kapat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>`;

function showModal() {
  modalOverlay.hidden = false;
  requestAnimationFrame(() => modalOverlay.classList.add('open'));
}

function openModal(b) {
  const L = t();
  const meta = genreMeta(b.genre);
  const overdue = b.my_due ? isOverdue(b.my_due) : false;

  const loanChip = b.my_due
    ? `<span class="m-chip loan ${overdue ? 'overdue' : ''}">📖 ${L.dueDate}: ${fmtDate(b.my_due)}${overdue ? ' — ' + L.overdueLabel : ''}</span>`
    : `<span class="m-chip ${b.available > 0 ? '' : 'out'}">${b.available > 0 ? L.available(b.available, b.copies) : L.outOfStock}</span>`;

  const borrowBtn = b.my_due
    ? `<button class="m-action borrow active" data-act="return">↩ ${L.returnBook}</button>`
    : `<button class="m-action borrow" data-act="borrow" ${b.available > 0 ? '' : 'disabled'}>📖 ${L.borrow}</button>`;

  modal.className = `modal ${meta.cls}`;
  modal.innerHTML = `
    ${glassLayers}
    <div class="glass-content">
      <div class="modal-hero">
        ${b.cover_url
          ? `<img class="modal-cover" src="${escapeHtml(b.cover_url)}" alt="" onerror="this.remove()">`
          : `<div class="modal-icon">${iconSvg(meta.icon)}</div>`}
        <div>
          <h2 class="modal-title">${escapeHtml(bookTitle(b))}</h2>
          <p class="modal-author">${escapeHtml(b.author)}</p>
        </div>
      </div>
      <div class="modal-chips">
        <span class="m-chip genre">${escapeHtml(genreLabel(b.genre))}</span>
        <span class="m-chip">${formatYear(b.year)}</span>
        <span class="m-chip">${b.pages} ${L.pages}</span>
        <span class="m-chip rating">★ ${Number(b.avg_rating).toFixed(1)}${b.review_count ? ` (${b.review_count})` : ''}</span>
        ${loanChip}
      </div>
      <div class="modal-actions">
        <button class="m-action fav ${b.favorite ? 'active' : ''}" data-act="favorite">${HEART_SVG} ${L.actFav}</button>
        <button class="m-action ${b.status === 'toread' ? 'active' : ''}" data-act="toread">📌 ${L.actToread}</button>
        <button class="m-action ${b.status === 'read' ? 'active' : ''}" data-act="read">✓ ${L.actRead}</button>
        ${borrowBtn}
      </div>
      <h3 class="modal-sub">${L.summary}</h3>
      <p class="modal-summary">${escapeHtml(buildSummary(b))}</p>
      <h3 class="modal-sub review-heading">${L.reviews}${b.review_count ? ` (${b.review_count})` : ''}</h3>
      <div class="review-editor">
        <p class="review-editor-label">${L.yourReview}</p>
        <div class="star-picker">
          ${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="star" data-v="${i}">★</button>`).join('')}
        </div>
        <textarea class="review-comment" maxlength="1000" rows="2" placeholder="${L.commentPh}"></textarea>
        <p class="form-error review-error" hidden></p>
        <div class="review-editor-actions">
          <button class="m-admin-btn review-save">${L.sendReview}</button>
          <button class="m-admin-btn danger review-del" hidden>${L.deleteReview}</button>
        </div>
      </div>
      <div class="review-list"></div>
      ${isAdmin() ? `
      <div class="modal-admin">
        <button class="m-admin-btn" data-admin="edit">✎ ${L.edit}</button>
        <button class="m-admin-btn danger" data-admin="delete">🗑 ${L.del}</button>
      </div>` : ''}
    </div>
  `;
  modal.querySelector('.modal-close').addEventListener('click', closeModal);

  // --- Raf + ödünç aksiyonları ---
  const actionsEl = modal.querySelector('.modal-actions');
  actionsEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.m-action');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.act;
    if (act === 'borrow') {
      const res = await fetch(`/api/books/${b.id}/borrow`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        b.my_due = data.due_at;
        b.available = data.available;
        openModal(b);
        loadBooks();
      }
      return;
    }
    if (act === 'return') {
      const res = await fetch(`/api/books/${b.id}/return`, { method: 'POST' });
      if (res.ok) {
        b.my_due = null;
        b.available += 1;
        openModal(b);
        loadBooks();
      }
      return;
    }
    if (act === 'favorite') await setShelf(b, { favorite: !b.favorite });
    else await setShelf(b, { status: b.status === act ? null : act });
    actionsEl.querySelector('[data-act="favorite"]').classList.toggle('active', Boolean(b.favorite));
    actionsEl.querySelector('[data-act="toread"]').classList.toggle('active', b.status === 'toread');
    actionsEl.querySelector('[data-act="read"]').classList.toggle('active', b.status === 'read');
    loadBooks();
  });

  // --- Değerlendirme editörü ---
  let pickedRating = 0;
  const starBtns = [...modal.querySelectorAll('.star-picker .star')];
  const commentEl = modal.querySelector('.review-comment');
  const reviewErr = modal.querySelector('.review-error');
  const delBtn = modal.querySelector('.review-del');

  const setStars = (n) => {
    pickedRating = n;
    starBtns.forEach((s) => s.classList.toggle('on', Number(s.dataset.v) <= n));
  };
  starBtns.forEach((s) => s.addEventListener('click', () => setStars(Number(s.dataset.v))));

  const refreshAfterReview = async () => {
    const res = await fetch(`/api/books/${b.id}/reviews`);
    const reviews = await res.json();
    b.review_count = reviews.length;
    b.avg_rating = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : b.rating;
    openModal(b);
    loadBooks();
  };

  const loadReviews = async () => {
    const listEl = modal.querySelector('.review-list');
    const res = await fetch(`/api/books/${b.id}/reviews`);
    if (!res.ok) return;
    const reviews = await res.json();
    const mine = reviews.find((r) => r.mine);
    if (mine) {
      setStars(mine.rating);
      commentEl.value = mine.comment || '';
      delBtn.hidden = false;
    }
    listEl.innerHTML = reviews.length ? reviews.map((r) => `
      <div class="review-item ${r.mine ? 'mine' : ''}">
        <div class="review-head">
          <span class="review-user">${escapeHtml(r.username)}</span>
          <span class="review-stars">${starRow(r.rating)}</span>
          <span class="review-date">${fmtDate(r.created_at)}</span>
          ${isAdmin() && !r.mine ? `<button class="review-remove" data-user="${r.user_id}" title="${L.del}">✕</button>` : ''}
        </div>
        ${r.comment ? `<p class="review-text">${escapeHtml(r.comment)}</p>` : ''}
      </div>`).join('') : `<p class="review-empty">${L.noReviews}</p>`;

    listEl.querySelectorAll('.review-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await fetch(`/api/books/${b.id}/reviews/${btn.dataset.user}`, { method: 'DELETE' });
        refreshAfterReview();
      });
    });
  };

  modal.querySelector('.review-save').addEventListener('click', async () => {
    reviewErr.hidden = true;
    if (!pickedRating) {
      reviewErr.textContent = L.pickRating;
      reviewErr.hidden = false;
      return;
    }
    const res = await fetch(`/api/books/${b.id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: pickedRating, comment: commentEl.value }),
    });
    if (res.ok) refreshAfterReview();
  });

  delBtn.addEventListener('click', async () => {
    const res = await fetch(`/api/books/${b.id}/review`, { method: 'DELETE' });
    if (res.ok) refreshAfterReview();
  });

  if (isAdmin()) {
    modal.querySelector('[data-admin="edit"]').addEventListener('click', () => {
      closeModal();
      setTimeout(() => openFormModal(b), 200);
    });
    modal.querySelector('[data-admin="delete"]').addEventListener('click', async () => {
      if (!confirm(t().confirmDelete(bookTitle(b)))) return;
      const res = await fetch(`/api/books/${b.id}`, { method: 'DELETE' });
      if (res.ok) {
        closeModal();
        loadGenres();
        loadBooks();
      }
    });
  }
  loadReviews();
  showModal();
}

// ============ Admin: aktif ödünçler paneli ============
async function renderLoansList() {
  const listEl = modal.querySelector('.loans-list');
  if (!listEl) return;
  const L = t();
  const res = await fetch('/api/admin/loans');
  if (!res.ok) return;
  const loans = await res.json();
  listEl.innerHTML = loans.length ? loans.map((l) => `
    <div class="loan-item ${l.overdue ? 'overdue' : ''}">
      <div class="loan-info">
        <span class="loan-user">${escapeHtml(l.username)}</span>
        <span class="loan-book">${escapeHtml(lang === 'en' && l.title_en ? l.title_en : l.title)}</span>
        <span class="loan-dates">${L.borrowedAt}: ${fmtDate(l.borrowed_at)} → ${L.dueDate}: ${fmtDate(l.due_at)}${l.overdue ? ' ⚠ ' + L.overdueLabel : ''}</span>
      </div>
      <button class="m-admin-btn loan-return" data-id="${l.id}">${L.adminReturn}</button>
    </div>`).join('') : `<p class="review-empty">${L.noLoans}</p>`;

  listEl.querySelectorAll('.loan-return').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await fetch(`/api/admin/loans/${btn.dataset.id}/return`, { method: 'POST' });
      renderLoansList();
      loadBooks();
    });
  });
}

function openLoansModal() {
  modal.className = 'modal';
  modal.innerHTML = `
    ${glassLayers}
    <div class="glass-content">
      <h2 class="modal-title form-title">${t().loansTitle}</h2>
      <div class="loans-list"></div>
    </div>
  `;
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  renderLoansList();
  showModal();
}

const statTile = (num, label, cls = '') =>
  `<div class="stat-tile ${cls}"><span class="stat-num">${num}</span><span class="stat-label">${label}</span></div>`;

// ============ Admin: istatistik paneli ============
async function openStatsModal() {
  const L = t();
  const res = await fetch('/api/admin/stats');
  if (!res.ok) return;
  const { totals, topBorrowed, topRated, genres } = await res.json();
  const tile = statTile;

  // Tek serilik yatay çubuk listesi; değerler doğrudan satır sonunda yazılır
  const barList = (rows, nameOf, valueOf, labelOf, fixedMax) => {
    if (!rows.length) return `<p class="review-empty">${L.noData}</p>`;
    const max = fixedMax || Math.max(...rows.map(valueOf), 1);
    return `<div class="bar-list">${rows.map((r) => `
      <div class="bar-row">
        <span class="bar-name" title="${escapeHtml(nameOf(r))}">${escapeHtml(nameOf(r))}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((valueOf(r) / max) * 100)}%"></div></div>
        <span class="bar-val">${labelOf(r)}</span>
      </div>`).join('')}</div>`;
  };

  const rowTitle = (r) => (lang === 'en' && r.title_en ? r.title_en : r.title);

  modal.className = 'modal';
  modal.innerHTML = `
    ${glassLayers}
    <div class="glass-content">
      <h2 class="modal-title form-title">📊 ${L.statsTitle}</h2>
      <div class="stats-grid">
        ${tile(totals.books, L.stBooks)}
        ${tile(totals.users, L.stUsers)}
        ${tile(totals.reviews, L.stReviews)}
        ${tile(totals.totalLoans, L.stTotalLoans)}
        ${tile(totals.activeLoans, L.stActive)}
        ${tile(totals.overdueLoans, L.stOverdue, totals.overdueLoans ? 'warn' : '')}
      </div>
      <h3 class="modal-sub">${L.topBorrowed}</h3>
      ${barList(topBorrowed, rowTitle, (r) => r.loan_count, (r) => r.loan_count)}
      <h3 class="modal-sub">${L.topRated}</h3>
      ${barList(topRated, rowTitle, (r) => r.avg_rating, (r) => `★ ${Number(r.avg_rating).toFixed(1)} (${r.review_count})`, 5)}
      <h3 class="modal-sub">${L.byGenre}</h3>
      ${barList(genres, (r) => genreLabel(r.genre), (r) => r.book_count, (r) => r.book_count)}
    </div>
  `;
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  showModal();
}

// ============ Profil ============
async function openProfileModal() {
  const L = t();
  const res = await fetch('/api/profile');
  if (!res.ok) return;
  const p = await res.json();
  const rowTitle = (r) => (lang === 'en' && r.title_en ? r.title_en : r.title);

  const loanRow = (l) => {
    const state = l.returned_at
      ? `${L.returnedAt}: ${fmtDate(l.returned_at)}`
      : `${L.stillOut} — ${L.dueDate}: ${fmtDate(l.due_at)}${l.overdue ? ' ⚠ ' + L.overdueLabel : ''}`;
    return `
    <div class="loan-item ${l.returned_at ? 'returned' : ''} ${l.overdue ? 'overdue' : ''}">
      <div class="loan-info">
        <span class="loan-book">${escapeHtml(rowTitle(l))}</span>
        <span class="loan-dates">${L.borrowedAt}: ${fmtDate(l.borrowed_at)} · ${state}</span>
      </div>
    </div>`;
  };

  modal.className = 'modal';
  modal.innerHTML = `
    ${glassLayers}
    <div class="glass-content">
      <h2 class="modal-title form-title">👤 ${escapeHtml(p.username)}</h2>
      <p class="profile-meta">${L.memberSince}: ${fmtDate(p.created_at)}${p.role === 'admin' ? ' · Admin' : ''}</p>
      <div class="stats-grid profile-stats">
        ${statTile(p.shelf.favorites, '♥ ' + L.actFav)}
        ${statTile(p.shelf.read, L.actRead)}
        ${statTile(p.shelf.toread, L.actToread)}
        ${statTile(p.reviews.length, L.reviews)}
      </div>
      <h3 class="modal-sub">${L.changePass}</h3>
      <form class="pass-form">
        <input type="password" name="current" placeholder="${L.currentPass}" required autocomplete="current-password">
        <input type="password" name="next" placeholder="${L.newPass}" required minlength="6" autocomplete="new-password">
        <button type="submit" class="m-admin-btn">${L.save}</button>
      </form>
      <p class="form-error pass-msg" hidden></p>
      <h3 class="modal-sub">${L.myLoans}</h3>
      <div class="loans-list profile-loans">
        ${p.loans.length ? p.loans.map(loanRow).join('') : `<p class="review-empty">${L.noMyLoans}</p>`}
      </div>
      <h3 class="modal-sub">${L.myReviews}</h3>
      <div class="review-list">
        ${p.reviews.length ? p.reviews.map((r) => `
        <div class="review-item mine">
          <div class="review-head">
            <span class="review-user">${escapeHtml(rowTitle(r))}</span>
            <span class="review-stars">${starRow(r.rating)}</span>
            <span class="review-date">${fmtDate(r.created_at)}</span>
          </div>
          ${r.comment ? `<p class="review-text">${escapeHtml(r.comment)}</p>` : ''}
        </div>`).join('') : `<p class="review-empty">${L.noMyReviews}</p>`}
      </div>
    </div>
  `;
  modal.querySelector('.modal-close').addEventListener('click', closeModal);

  const form = modal.querySelector('.pass-form');
  const msg = modal.querySelector('.pass-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.hidden = true;
    const data = Object.fromEntries(new FormData(form).entries());
    const r = await fetch('/api/profile/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await r.json().catch(() => ({}));
    msg.classList.toggle('ok', r.ok);
    msg.textContent = r.ok ? L.passSaved : (body.error || L.passFail);
    msg.hidden = false;
    if (r.ok) form.reset();
  });

  showModal();
}

// ============ Kitap ekleme / düzenleme formu (admin) ============
function openFormModal(book) {
  const L = t();
  const isEdit = Boolean(book);
  const v = (key) => (isEdit && book[key] != null ? escapeHtml(book[key]) : '');
  modal.className = 'modal';
  modal.innerHTML = `
    ${glassLayers}
    <div class="glass-content">
      <h2 class="modal-title form-title">${isEdit ? L.formEdit : L.formNew}</h2>
      <form id="book-form" class="book-form">
        <div class="form-grid">
          <div class="form-field span-2">
            <label>${L.fTitle}</label>
            <input name="title" required maxlength="200" value="${v('title')}">
          </div>
          <div class="form-field span-2">
            <label>${L.fTitleEn}</label>
            <input name="title_en" maxlength="200" value="${v('title_en')}">
          </div>
          <div class="form-field span-2">
            <label>${L.fAuthor}</label>
            <input name="author" required maxlength="120" value="${v('author')}">
          </div>
          <div class="form-field">
            <label>${L.fGenre}</label>
            <input name="genre" list="genre-list" required maxlength="60" value="${v('genre')}">
            <datalist id="genre-list">
              ${knownGenres.map((g) => `<option value="${escapeHtml(g)}">`).join('')}
            </datalist>
          </div>
          <div class="form-field">
            <label>${L.fYear}</label>
            <input name="year" type="number" required min="-4000" max="2100" value="${isEdit ? book.year : ''}">
          </div>
          <div class="form-field">
            <label>${L.fPages}</label>
            <input name="pages" type="number" required min="1" value="${isEdit ? book.pages : ''}">
          </div>
          <div class="form-field">
            <label>${L.fRating}</label>
            <input name="rating" type="number" required step="0.1" min="0" max="5" value="${isEdit ? book.rating : ''}">
          </div>
          <div class="form-field">
            <label>${L.fCopies}</label>
            <input name="copies" type="number" required min="0" max="1000" value="${isEdit ? book.copies : 3}">
          </div>
          <div class="form-field span-2">
            <label>${L.fCover}</label>
            <input name="cover_url" type="url" maxlength="500" placeholder="https://..." value="${v('cover_url')}">
          </div>
          <div class="form-field span-2">
            <label>${L.fDesc}</label>
            <textarea name="description" rows="3" required>${v('description')}</textarea>
          </div>
        </div>
        <p class="form-error" id="form-error" hidden></p>
        <div class="form-actions">
          <button type="button" class="btn-cancel">${L.cancel}</button>
          <button type="submit" class="btn-save">${L.save}</button>
        </div>
      </form>
    </div>
  `;
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('.btn-cancel').addEventListener('click', closeModal);

  const form = modal.querySelector('#book-form');
  const errEl = modal.querySelector('#form-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.year = Number(payload.year);
    payload.pages = Number(payload.pages);
    payload.rating = Number(payload.rating);
    payload.copies = Number(payload.copies);

    const res = await fetch(isEdit ? `/api/books/${book.id}` : '/api/books', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      errEl.textContent = data.error || L.saveFail;
      errEl.hidden = false;
      return;
    }
    closeModal();
    loadGenres();
    loadBooks();
  });
  showModal();
}

// ============ Ayarlar pop-up'ı ============
const SETTINGS_SWATCHES = ['#7c6ff0', '#4da3f0', '#4cc2a0', '#6cc968', '#e8c05a', '#e09a5c', '#f06f6f', '#ee85bb'];

function openSettingsModal() {
  const L = t();
  const s = SiteTheme.load();
  modal.className = 'modal';
  modal.innerHTML = `
    ${glassLayers}
    <div class="glass-content">
      <h2 class="modal-title form-title">⚙ ${L.settings}</h2>
      <div class="settings-group">
        <label>${L.accentColor}</label>
        <div class="swatch-row">
          ${SETTINGS_SWATCHES.map((c) =>
            `<button type="button" class="swatch ${c.toLowerCase() === s.accent.toLowerCase() ? 'active' : ''}" data-color="${c}" style="--sw:${c}" aria-label="${c}"></button>`).join('')}
          <input type="color" id="custom-color" value="${s.accent}" title="${L.customColor}">
        </div>
      </div>
      <div class="settings-group">
        <label>${L.popupOpacity}: <span class="setting-val" id="opacity-val">%${s.opacity}</span></label>
        <input type="range" id="opacity-range" min="20" max="95" value="${s.opacity}">
      </div>
      <div class="settings-group">
        <label>${L.glassBlur}: <span class="setting-val" id="blur-val">${s.blur}px</span></label>
        <input type="range" id="blur-range" min="0" max="20" value="${s.blur}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn-cancel" id="settings-reset">↺ ${L.resetSettings}</button>
      </div>
    </div>
  `;
  modal.querySelector('.modal-close').addEventListener('click', closeModal);

  const update = (patch) => {
    Object.assign(s, patch);
    SiteTheme.apply(s);
    SiteTheme.save(s);
  };

  const swatches = [...modal.querySelectorAll('.swatch')];
  const customColor = modal.querySelector('#custom-color');
  const markActive = (color) => {
    swatches.forEach((sw) => sw.classList.toggle('active', sw.dataset.color.toLowerCase() === color.toLowerCase()));
  };
  swatches.forEach((sw) => sw.addEventListener('click', () => {
    update({ accent: sw.dataset.color });
    customColor.value = sw.dataset.color;
    markActive(sw.dataset.color);
  }));
  customColor.addEventListener('input', () => {
    update({ accent: customColor.value });
    markActive(customColor.value);
  });

  const opacityRange = modal.querySelector('#opacity-range');
  const opacityVal = modal.querySelector('#opacity-val');
  opacityRange.addEventListener('input', () => {
    update({ opacity: Number(opacityRange.value) });
    opacityVal.textContent = `%${opacityRange.value}`;
  });

  const blurRange = modal.querySelector('#blur-range');
  const blurVal = modal.querySelector('#blur-val');
  blurRange.addEventListener('input', () => {
    update({ blur: Number(blurRange.value) });
    blurVal.textContent = `${blurRange.value}px`;
  });

  modal.querySelector('#settings-reset').addEventListener('click', () => {
    update({ ...SiteTheme.DEFAULTS });
    openSettingsModal();
  });

  showModal();
}

function closeModal() {
  modalOverlay.classList.remove('open');
  setTimeout(() => { modalOverlay.hidden = true; }, 400);
}

grid.addEventListener('click', async (e) => {
  const card = e.target.closest('.book-card');
  if (!card) return;
  const book = currentBooks[Number(card.dataset.index)];
  if (!book) return;

  const favBtn = e.target.closest('.fav-btn');
  if (favBtn) {
    await setShelf(book, { favorite: !book.favorite });
    favBtn.classList.toggle('active', Boolean(book.favorite));
    if (activeShelf === 'favorites') loadBooks();
    return;
  }
  openModal(book);
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
});

genreChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  genreChips.querySelector('.chip.active')?.classList.remove('active');
  chip.classList.add('active');
  activeGenre = chip.dataset.genre;
  loadBooks();
});

shelfChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  shelfChips.querySelector('.chip.active')?.classList.remove('active');
  chip.classList.add('active');
  activeShelf = chip.dataset.shelf;
  loadBooks();
});

addBookBtn.addEventListener('click', () => openFormModal(null));
loansBtn.addEventListener('click', openLoansModal);
statsBtn.addEventListener('click', openStatsModal);
userChip.addEventListener('click', openProfileModal);
document.getElementById('settings-btn').addEventListener('click', openSettingsModal);

let debounceTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadBooks, 250);
});

yearMinInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadBooks, 350);
});
yearMaxInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadBooks, 350);
});

sortSelect.addEventListener('change', loadBooks);

// Çıkış butonu — fizik tabanlı liquid glass (Chromium'da kırılma, diğerlerinde buzlu cam)
// Not: liquid-glass kendi etiket span'ını ekler; HTML'deki metin silinmezse yazı iki kez görünür.
const logoutBtn = document.getElementById('logout-btn');
if (window.LiquidGlass) logoutBtn.textContent = '';
const logoutGlass = window.LiquidGlass
  ? LiquidGlass.createLiquidButton(logoutBtn, {
      label: I18N[lang].logout,
      glassThickness: 100,
      bezelWidth: 10,
      refractiveIndex: 1.5,
      profile: 'convexSquircle',
    })
  : null;

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

applyLang();
loadMe();
loadGenres();
loadBooks();
