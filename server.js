require('dotenv').config();
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./db');
const { hashPassword, verifyPassword } = require('./auth');

const missingEnv = ['SESSION_SECRET', 'ADMIN_USER', 'ADMIN_PASS'].filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(`Eksik ortam değişkenleri: ${missingEnv.join(', ')} — proje kökündeki .env dosyasını kontrol edin (bkz. README).`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// İlk çalıştırmada .env'deki admin hesabını oluştur
const seedAdmin = () => {
  const username = process.env.ADMIN_USER;
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return;
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, hashPassword(process.env.ADMIN_PASS), 'admin');
  console.log(`Admin kullanıcısı oluşturuldu: ${username}`);
};
seedAdmin();

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 } // 8 saat
}));

const requireAuth = (req, res, next) => {
  if (req.session.user) return next();
  res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
};

const requireAdmin = (req, res, next) => {
  if (req.session.user.role === 'admin') return next();
  res.status(403).json({ error: 'Bu işlem için yönetici yetkisi gerekiyor.' });
};

// --- Sayfalar ---
app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/liquid-glass', express.static(path.join(__dirname, 'node_modules', '@avenra', 'liquid-glass')));

// --- Kimlik doğrulama ---
// Brute-force koruması: aynı IP'den 10 dakikada en fazla 20 giriş/kayıt denemesi
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Çok fazla deneme yaptınız. Lütfen 10 dakika sonra tekrar deneyin.' },
});

app.post('/api/register', authLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const name = typeof username === 'string' ? username.trim() : '';
  if (name.length < 3 || name.length > 30) {
    return res.status(400).json({ error: 'Kullanıcı adı 3–30 karakter olmalı.' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  }
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(name)) {
    return res.status(409).json({ error: 'Bu kullanıcı adı zaten alınmış.' });
  }
  const info = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(name, hashPassword(password), 'user');
  req.session.user = { id: Number(info.lastInsertRowid), username: name, role: 'user' };
  res.status(201).json({ ok: true });
});

app.post('/api/login', authLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', requireAuth, (req, res) => {
  const { username, role } = req.session.user;
  res.json({ user: username, role });
});

// --- Kitaplar ---
app.get('/api/genres', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT DISTINCT genre FROM books ORDER BY genre').all();
  res.json(rows.map(r => r.genre));
});

app.get('/api/books', requireAuth, (req, res) => {
  const { search, genre, yearMin, yearMax, sort, shelf } = req.query;
  const userId = req.session.user.id;
  const conditions = [];
  // Sıra önemli: SQL'deki ilk iki ? my_due alt sorgusu ve user_books join'i
  const params = [userId, userId];

  if (search) {
    conditions.push('(title LIKE ? OR author LIKE ? OR title_en LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (genre) {
    conditions.push('genre = ?');
    params.push(genre);
  }
  if (yearMin) {
    conditions.push('year >= ?');
    params.push(Number(yearMin));
  }
  if (yearMax) {
    conditions.push('year <= ?');
    params.push(Number(yearMax));
  }
  if (shelf === 'favorites') {
    conditions.push('ub.favorite = 1');
  } else if (shelf === 'read' || shelf === 'toread') {
    conditions.push('ub.status = ?');
    params.push(shelf);
  } else if (shelf === 'borrowed') {
    conditions.push('EXISTS (SELECT 1 FROM loans lx WHERE lx.book_id = b.id AND lx.user_id = ? AND lx.returned_at IS NULL)');
    params.push(userId);
  }

  const sortMap = {
    'title': 'title COLLATE NOCASE ASC',
    'year-asc': 'year ASC',
    'year-desc': 'year DESC',
    'rating': 'avg_rating DESC',
  };
  const orderBy = sortMap[sort] || sortMap['title'];

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const books = db.prepare(`
    SELECT b.*,
      COALESCE(ub.favorite, 0) AS favorite, ub.status AS status,
      (SELECT COUNT(*) FROM reviews r WHERE r.book_id = b.id) AS review_count,
      COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.book_id = b.id), b.rating) AS avg_rating,
      b.copies - (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.returned_at IS NULL) AS available,
      (SELECT l.due_at FROM loans l WHERE l.book_id = b.id AND l.user_id = ? AND l.returned_at IS NULL) AS my_due
    FROM books b
    LEFT JOIN user_books ub ON ub.book_id = b.id AND ub.user_id = ?
    ${where} ORDER BY ${orderBy}
  `).all(...params);
  res.json({ count: books.length, books });
});

const parseBook = (body) => {
  const b = body || {};
  const title = String(b.title ?? '').trim();
  const titleEn = String(b.title_en ?? '').trim();
  const author = String(b.author ?? '').trim();
  const genre = String(b.genre ?? '').trim();
  const description = String(b.description ?? '').trim();
  const year = Number(b.year);
  const pages = Number(b.pages);
  const rating = Number(b.rating);
  const copies = b.copies === undefined ? 3 : Number(b.copies);
  const coverUrl = String(b.cover_url ?? '').trim();

  if (!title || !author || !genre || !description) {
    return { error: 'Başlık, yazar, tür ve açıklama boş olamaz.' };
  }
  if (!Number.isInteger(year) || year < -4000 || year > 2100) {
    return { error: 'Geçerli bir yayın yılı girin.' };
  }
  if (!Number.isInteger(pages) || pages <= 0) {
    return { error: 'Sayfa sayısı pozitif bir tam sayı olmalı.' };
  }
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    return { error: 'Puan 0 ile 5 arasında olmalı.' };
  }
  if (!Number.isInteger(copies) || copies < 0 || copies > 1000) {
    return { error: 'Kopya sayısı 0 ile 1000 arasında bir tam sayı olmalı.' };
  }
  if (coverUrl && !/^https?:\/\/\S+$/i.test(coverUrl)) {
    return { error: 'Kapak adresi http(s) ile başlayan geçerli bir URL olmalı.' };
  }
  return { book: { title, title_en: titleEn || null, author, genre, year, pages, rating, copies, description, cover_url: coverUrl || null } };
};

app.post('/api/books', requireAuth, requireAdmin, (req, res) => {
  const { error, book } = parseBook(req.body);
  if (error) return res.status(400).json({ error });
  const info = db.prepare(`
    INSERT INTO books (title, title_en, author, genre, year, pages, rating, copies, description, cover_url)
    VALUES (@title, @title_en, @author, @genre, @year, @pages, @rating, @copies, @description, @cover_url)
  `).run(book);
  const created = db.prepare('SELECT * FROM books WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

app.put('/api/books/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM books WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Kitap bulunamadı.' });
  }
  const { error, book } = parseBook(req.body);
  if (error) return res.status(400).json({ error });
  db.prepare(`
    UPDATE books SET title = @title, title_en = @title_en, author = @author, genre = @genre,
      year = @year, pages = @pages, rating = @rating, copies = @copies, description = @description,
      cover_url = @cover_url
    WHERE id = @id
  `).run({ ...book, id });
  res.json(db.prepare('SELECT * FROM books WHERE id = ?').get(id));
});

app.delete('/api/books/:id', requireAuth, requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM books WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Kitap bulunamadı.' });
  res.json({ ok: true });
});

// --- Kişisel raf (favori + okuma durumu) ---
app.put('/api/books/:id/shelf', requireAuth, (req, res) => {
  const bookId = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM books WHERE id = ?').get(bookId)) {
    return res.status(404).json({ error: 'Kitap bulunamadı.' });
  }
  const { favorite, status } = req.body || {};
  if (favorite !== undefined && typeof favorite !== 'boolean') {
    return res.status(400).json({ error: 'favorite true/false olmalı.' });
  }
  if (status !== undefined && status !== null && !['read', 'toread'].includes(status)) {
    return res.status(400).json({ error: "status 'read', 'toread' veya null olmalı." });
  }

  const userId = req.session.user.id;
  const current = db.prepare('SELECT favorite, status FROM user_books WHERE user_id = ? AND book_id = ?')
    .get(userId, bookId) || { favorite: 0, status: null };
  const next = {
    favorite: favorite === undefined ? current.favorite : (favorite ? 1 : 0),
    status: status === undefined ? current.status : status,
  };

  if (!next.favorite && !next.status) {
    db.prepare('DELETE FROM user_books WHERE user_id = ? AND book_id = ?').run(userId, bookId);
  } else {
    db.prepare(`
      INSERT INTO user_books (user_id, book_id, favorite, status) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, book_id) DO UPDATE SET favorite = excluded.favorite, status = excluded.status
    `).run(userId, bookId, next.favorite, next.status);
  }
  res.json({ favorite: Boolean(next.favorite), status: next.status });
});

// --- Yorumlar ve puanlar ---
app.get('/api/books/:id/reviews', requireAuth, (req, res) => {
  const bookId = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM books WHERE id = ?').get(bookId)) {
    return res.status(404).json({ error: 'Kitap bulunamadı.' });
  }
  const rows = db.prepare(`
    SELECT r.user_id, r.rating, r.comment, r.created_at, u.username
    FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.book_id = ? ORDER BY r.created_at DESC
  `).all(bookId);
  res.json(rows.map((r) => ({ ...r, mine: r.user_id === req.session.user.id })));
});

app.put('/api/books/:id/review', requireAuth, (req, res) => {
  const bookId = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM books WHERE id = ?').get(bookId)) {
    return res.status(404).json({ error: 'Kitap bulunamadı.' });
  }
  const { rating, comment } = req.body || {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Puan 1 ile 5 arasında bir tam sayı olmalı.' });
  }
  const text = typeof comment === 'string' ? comment.trim().slice(0, 1000) : '';
  db.prepare(`
    INSERT INTO reviews (user_id, book_id, rating, comment) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, book_id) DO UPDATE SET
      rating = excluded.rating, comment = excluded.comment, created_at = datetime('now')
  `).run(req.session.user.id, bookId, rating, text || null);
  res.json({ ok: true });
});

app.delete('/api/books/:id/review', requireAuth, (req, res) => {
  const info = db.prepare('DELETE FROM reviews WHERE user_id = ? AND book_id = ?')
    .run(req.session.user.id, Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Değerlendirme bulunamadı.' });
  res.json({ ok: true });
});

// Admin: başkasının yorumunu kaldırabilir
app.delete('/api/books/:id/reviews/:userId', requireAuth, requireAdmin, (req, res) => {
  const info = db.prepare('DELETE FROM reviews WHERE user_id = ? AND book_id = ?')
    .run(Number(req.params.userId), Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Değerlendirme bulunamadı.' });
  res.json({ ok: true });
});

// --- Ödünç alma ---
const MAX_ACTIVE_LOANS = 5;
const LOAN_DAYS = 14;

app.post('/api/books/:id/borrow', requireAuth, (req, res) => {
  const bookId = Number(req.params.id);
  const userId = req.session.user.id;
  const result = db.transaction(() => {
    const book = db.prepare('SELECT id, copies FROM books WHERE id = ?').get(bookId);
    if (!book) return { code: 404, error: 'Kitap bulunamadı.' };
    if (db.prepare('SELECT 1 FROM loans WHERE user_id = ? AND book_id = ? AND returned_at IS NULL').get(userId, bookId)) {
      return { code: 409, error: 'Bu kitap zaten sizde.' };
    }
    const myActive = db.prepare('SELECT COUNT(*) AS c FROM loans WHERE user_id = ? AND returned_at IS NULL').get(userId).c;
    if (myActive >= MAX_ACTIVE_LOANS) {
      return { code: 409, error: `Aynı anda en fazla ${MAX_ACTIVE_LOANS} kitap ödünç alabilirsiniz.` };
    }
    const active = db.prepare('SELECT COUNT(*) AS c FROM loans WHERE book_id = ? AND returned_at IS NULL').get(bookId).c;
    if (active >= book.copies) return { code: 409, error: 'Bu kitabın tüm kopyaları ödünçte.' };
    db.prepare(`INSERT INTO loans (user_id, book_id, due_at) VALUES (?, ?, datetime('now', '+${LOAN_DAYS} days'))`)
      .run(userId, bookId);
    const due = db.prepare('SELECT due_at FROM loans WHERE user_id = ? AND book_id = ? AND returned_at IS NULL')
      .get(userId, bookId).due_at;
    return { code: 200, body: { due_at: due, available: book.copies - active - 1 } };
  })();
  if (result.error) return res.status(result.code).json({ error: result.error });
  res.json(result.body);
});

app.post('/api/books/:id/return', requireAuth, (req, res) => {
  const info = db.prepare(`UPDATE loans SET returned_at = datetime('now') WHERE user_id = ? AND book_id = ? AND returned_at IS NULL`)
    .run(req.session.user.id, Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Aktif ödünç kaydı bulunamadı.' });
  res.json({ ok: true });
});

// Admin: tüm aktif ödünçler
app.get('/api/admin/loans', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT l.id, l.borrowed_at, l.due_at, u.username, b.title, b.title_en,
      (l.due_at < datetime('now')) AS overdue
    FROM loans l
    JOIN users u ON u.id = l.user_id
    JOIN books b ON b.id = l.book_id
    WHERE l.returned_at IS NULL
    ORDER BY l.due_at ASC
  `).all();
  res.json(rows);
});

// Admin: kullanıcı adına iade al
app.post('/api/admin/loans/:loanId/return', requireAuth, requireAdmin, (req, res) => {
  const info = db.prepare(`UPDATE loans SET returned_at = datetime('now') WHERE id = ? AND returned_at IS NULL`)
    .run(Number(req.params.loanId));
  if (info.changes === 0) return res.status(404).json({ error: 'Aktif ödünç kaydı bulunamadı.' });
  res.json({ ok: true });
});

// Admin: istatistikler
app.get('/api/admin/stats', requireAuth, requireAdmin, (req, res) => {
  const count = (sql) => db.prepare(sql).get().c;
  const totals = {
    books: count('SELECT COUNT(*) AS c FROM books'),
    users: count('SELECT COUNT(*) AS c FROM users'),
    reviews: count('SELECT COUNT(*) AS c FROM reviews'),
    totalLoans: count('SELECT COUNT(*) AS c FROM loans'),
    activeLoans: count('SELECT COUNT(*) AS c FROM loans WHERE returned_at IS NULL'),
    overdueLoans: count(`SELECT COUNT(*) AS c FROM loans WHERE returned_at IS NULL AND due_at < datetime('now')`),
  };
  const topBorrowed = db.prepare(`
    SELECT b.title, b.title_en, COUNT(*) AS loan_count
    FROM loans l JOIN books b ON b.id = l.book_id
    GROUP BY l.book_id ORDER BY loan_count DESC, b.title COLLATE NOCASE LIMIT 5
  `).all();
  const topRated = db.prepare(`
    SELECT b.title, b.title_en, AVG(r.rating) AS avg_rating, COUNT(*) AS review_count
    FROM reviews r JOIN books b ON b.id = r.book_id
    GROUP BY r.book_id ORDER BY avg_rating DESC, review_count DESC, b.title COLLATE NOCASE LIMIT 5
  `).all();
  const genres = db.prepare(`
    SELECT genre, COUNT(*) AS book_count FROM books GROUP BY genre ORDER BY book_count DESC
  `).all();
  res.json({ totals, topBorrowed, topRated, genres });
});

// --- Hata yönetimi ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Böyle bir API ucu yok.' });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

app.listen(PORT, () => {
  console.log(`Kütüphane sunucusu çalışıyor: http://localhost:${PORT}`);
});
