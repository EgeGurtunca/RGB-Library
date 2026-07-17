require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
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

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // Kitap kapakları dış kaynaklardan (Open Library vb.) geliyor
      'img-src': ["'self'", 'https:', 'data:'],
      // Yerelde http üzerinden çalışabilmek için (canlıda ters proxy https sağlar)
      'upgrade-insecure-requests': null,
    },
  },
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 } // 8 saat
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
  skip: () => process.env.NODE_ENV === 'test',
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

// --- Profil ---
app.get('/api/profile', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const me = db.prepare('SELECT username, role, created_at FROM users WHERE id = ?').get(userId);
  const shelf = db.prepare(`
    SELECT COALESCE(SUM(favorite), 0) AS favorites,
      COALESCE(SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END), 0) AS read,
      COALESCE(SUM(CASE WHEN status = 'toread' THEN 1 ELSE 0 END), 0) AS toread
    FROM user_books WHERE user_id = ?
  `).get(userId);
  const reviews = db.prepare(`
    SELECT r.book_id, r.rating, r.comment, r.created_at, b.title, b.title_en
    FROM reviews r JOIN books b ON b.id = r.book_id
    WHERE r.user_id = ? ORDER BY r.created_at DESC
  `).all(userId);
  const loans = db.prepare(`
    SELECT l.borrowed_at, l.due_at, l.returned_at, b.title, b.title_en,
      (l.returned_at IS NULL AND l.due_at < datetime('now')) AS overdue
    FROM loans l JOIN books b ON b.id = l.book_id
    WHERE l.user_id = ? ORDER BY l.borrowed_at DESC LIMIT 50
  `).all(userId);
  res.json({ ...me, shelf, reviews, loans });
});

app.post('/api/profile/password', requireAuth, (req, res) => {
  const { current, next } = req.body || {};
  if (typeof current !== 'string' || typeof next !== 'string') {
    return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli.' });
  }
  if (next.length < 6) {
    return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı.' });
  }
  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.session.user.id);
  if (!verifyPassword(current, user.password_hash)) {
    return res.status(401).json({ error: 'Mevcut şifre hatalı.' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
  res.json({ ok: true });
});

// --- Kitaplar ---
app.get('/api/genres', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT DISTINCT genre FROM books ORDER BY genre').all();
  res.json(rows.map(r => r.genre));
});

const DEFAULT_PAGE_SIZE = 24;
const toPositiveInt = (value, fallback) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

app.get('/api/books', requireAuth, (req, res) => {
  const { search, genre, yearMin, yearMax, sort, shelf } = req.query;
  const userId = req.session.user.id;
  const conditions = [];
  const condParams = [];

  if (search) {
    conditions.push('(title LIKE ? OR author LIKE ? OR title_en LIKE ?)');
    condParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (genre) {
    conditions.push('genre = ?');
    condParams.push(genre);
  }
  if (yearMin) {
    conditions.push('year >= ?');
    condParams.push(Number(yearMin));
  }
  if (yearMax) {
    conditions.push('year <= ?');
    condParams.push(Number(yearMax));
  }
  if (shelf === 'favorites') {
    conditions.push('ub.favorite = 1');
  } else if (shelf === 'read' || shelf === 'toread') {
    conditions.push('ub.status = ?');
    condParams.push(shelf);
  } else if (shelf === 'borrowed') {
    conditions.push('EXISTS (SELECT 1 FROM loans lx WHERE lx.book_id = b.id AND lx.user_id = ? AND lx.returned_at IS NULL)');
    condParams.push(userId);
  }

  const sortMap = {
    'title': 'title COLLATE NOCASE ASC',
    'year-asc': 'year ASC',
    'year-desc': 'year DESC',
    'rating': 'avg_rating DESC',
  };
  const orderBy = sortMap[sort] || sortMap['title'];

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // count = filtreye uyan TOPLAM kitap; books yalnızca istenen sayfayı taşır
  const total = db.prepare(`
    SELECT COUNT(*) AS c FROM books b
    LEFT JOIN user_books ub ON ub.book_id = b.id AND ub.user_id = ?
    ${where}
  `).get(userId, ...condParams).c;

  const pageSize = Math.min(toPositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE), 100);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(toPositiveInt(req.query.page, 1), pageCount);

  const books = db.prepare(`
    SELECT b.*,
      COALESCE(ub.favorite, 0) AS favorite, ub.status AS status,
      (SELECT COUNT(*) FROM reviews r WHERE r.book_id = b.id) AS review_count,
      COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.book_id = b.id), b.rating) AS avg_rating,
      b.copies - (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.returned_at IS NULL) AS available,
      (SELECT l.due_at FROM loans l WHERE l.book_id = b.id AND l.user_id = ? AND l.returned_at IS NULL) AS my_due,
      (SELECT COUNT(*) FROM reservations rs WHERE rs.book_id = b.id AND rs.status = 'active') AS reservation_count,
      (SELECT COUNT(*) FROM reservations r2 WHERE r2.book_id = b.id AND r2.status = 'active'
        AND r2.id <= (SELECT r3.id FROM reservations r3 WHERE r3.book_id = b.id AND r3.user_id = ? AND r3.status = 'active')
      ) AS my_queue_pos
    FROM books b
    LEFT JOIN user_books ub ON ub.book_id = b.id AND ub.user_id = ?
    ${where} ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(userId, userId, userId, ...condParams, pageSize, (page - 1) * pageSize);
  res.json({ count: total, page, pageCount, pageSize, books });
});

// Kişiye özel öneriler: kullanıcının etkileşime girdiği kitaplarla (raf, yorum,
// ödünç, rezervasyon) yazar/tür benzerliği + okur puanı skoru. Etkileşim yoksa
// skor yalnızca puana düşer, yani en beğenilen kitaplar önerilir.
app.get('/api/recommendations', requireAuth, (req, res) => {
  const books = db.prepare(`
    WITH my_books AS (
      SELECT book_id FROM user_books WHERE user_id = @id
      UNION SELECT book_id FROM reviews WHERE user_id = @id
      UNION SELECT book_id FROM loans WHERE user_id = @id
      UNION SELECT book_id FROM reservations WHERE user_id = @id AND status = 'active'
    )
    SELECT b.*,
      0 AS favorite, NULL AS status, NULL AS my_due, 0 AS my_queue_pos,
      (SELECT COUNT(*) FROM reviews r WHERE r.book_id = b.id) AS review_count,
      COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.book_id = b.id), b.rating) AS avg_rating,
      b.copies - (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.returned_at IS NULL) AS available,
      (SELECT COUNT(*) FROM reservations rs WHERE rs.book_id = b.id AND rs.status = 'active') AS reservation_count,
      ((SELECT COUNT(*) FROM my_books m JOIN books mb ON mb.id = m.book_id AND mb.author = b.author) * 3.0
        + (SELECT COUNT(*) FROM my_books m JOIN books mb ON mb.id = m.book_id AND mb.genre = b.genre) * 0.5
        + COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.book_id = b.id), b.rating)) AS rec_score
    FROM books b
    WHERE b.id NOT IN (SELECT book_id FROM my_books)
    ORDER BY rec_score DESC, b.title COLLATE NOCASE
    LIMIT 12
  `).all({ id: req.session.user.id });
  res.json({ count: books.length, books });
});

// Kullanıcı uyarıları: gecikmiş / yaklaşan iadeler ve sırası gelen rezervasyonlar
app.get('/api/my/alerts', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const loans = db.prepare(`
    SELECT b.title, b.title_en, l.due_at,
      CAST(julianday(l.due_at) - julianday('now') AS INTEGER) AS days_left
    FROM loans l JOIN books b ON b.id = l.book_id
    WHERE l.user_id = ? AND l.returned_at IS NULL
    ORDER BY l.due_at
  `).all(userId);
  const ready = db.prepare(`
    SELECT b.title, b.title_en
    FROM reservations rs JOIN books b ON b.id = rs.book_id
    WHERE rs.user_id = ? AND rs.status = 'active'
      AND (SELECT COUNT(*) FROM reservations r2 WHERE r2.book_id = rs.book_id AND r2.status = 'active' AND r2.id <= rs.id)
        <= b.copies - (SELECT COUNT(*) FROM loans l WHERE l.book_id = rs.book_id AND l.returned_at IS NULL)
    ORDER BY rs.id
  `).all(userId);
  res.json({
    overdue: loans.filter((l) => l.days_left < 0),
    dueSoon: loans.filter((l) => l.days_left >= 0 && l.days_left <= 3),
    ready,
  });
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

    // Müsait kopyalar önce rezervasyon sırasındakilere ayrılır (id = kuyruk sırası)
    const availableCopies = book.copies - active;
    const queue = db.prepare(`SELECT id, user_id FROM reservations WHERE book_id = ? AND status = 'active' ORDER BY id`).all(bookId);
    const myPos = queue.findIndex((r) => r.user_id === userId);
    if (myPos >= 0) {
      if (myPos >= availableCopies) {
        return { code: 409, error: `Rezervasyon sıranız henüz gelmedi (sıranız: ${myPos + 1}).` };
      }
      db.prepare(`UPDATE reservations SET status = 'fulfilled' WHERE id = ?`).run(queue[myPos].id);
    } else if (availableCopies <= queue.length) {
      return { code: 409, error: 'Müsait kopyalar rezervasyon sırasındaki üyeler için ayrıldı.' };
    }

    db.prepare(`INSERT INTO loans (user_id, book_id, due_at) VALUES (?, ?, datetime('now', '+${LOAN_DAYS} days'))`)
      .run(userId, bookId);
    const due = db.prepare('SELECT due_at FROM loans WHERE user_id = ? AND book_id = ? AND returned_at IS NULL')
      .get(userId, bookId).due_at;
    return { code: 200, body: { due_at: due, available: book.copies - active - 1 } };
  })();
  if (result.error) return res.status(result.code).json({ error: result.error });
  res.json(result.body);
});

// --- Rezervasyon ---
app.post('/api/books/:id/reserve', requireAuth, (req, res) => {
  const bookId = Number(req.params.id);
  const userId = req.session.user.id;
  const result = db.transaction(() => {
    const book = db.prepare('SELECT id, copies FROM books WHERE id = ?').get(bookId);
    if (!book) return { code: 404, error: 'Kitap bulunamadı.' };
    if (db.prepare('SELECT 1 FROM loans WHERE user_id = ? AND book_id = ? AND returned_at IS NULL').get(userId, bookId)) {
      return { code: 409, error: 'Bu kitap zaten sizde, rezervasyona gerek yok.' };
    }
    if (db.prepare(`SELECT 1 FROM reservations WHERE user_id = ? AND book_id = ? AND status = 'active'`).get(userId, bookId)) {
      return { code: 409, error: 'Bu kitap için zaten rezervasyonunuz var.' };
    }
    const active = db.prepare('SELECT COUNT(*) AS c FROM loans WHERE book_id = ? AND returned_at IS NULL').get(bookId).c;
    const reserved = db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE book_id = ? AND status = 'active'`).get(bookId).c;
    if (book.copies - active - reserved > 0) {
      return { code: 409, error: 'Kitap şu an müsait — doğrudan ödünç alabilirsiniz.' };
    }
    db.prepare('INSERT INTO reservations (user_id, book_id) VALUES (?, ?)').run(userId, bookId);
    return { code: 201, body: { position: reserved + 1 } };
  })();
  if (result.error) return res.status(result.code).json({ error: result.error });
  res.status(result.code).json(result.body);
});

app.delete('/api/books/:id/reserve', requireAuth, (req, res) => {
  const info = db.prepare(`UPDATE reservations SET status = 'cancelled' WHERE user_id = ? AND book_id = ? AND status = 'active'`)
    .run(req.session.user.id, Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Aktif rezervasyon bulunamadı.' });
  res.json({ ok: true });
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

// Testler app'i supertest ile kullanır; dinleme yalnızca doğrudan çalıştırınca
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Kütüphane sunucusu çalışıyor: http://localhost:${PORT}`);
  });
}

module.exports = app;
