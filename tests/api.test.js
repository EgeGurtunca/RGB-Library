// API akış testleri — gerçek Express app'i geçici bir SQLite dosyasıyla test eder.
// Ortam değişkenleri server.js require edilmeden ÖNCE ayarlanmalı.
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.ADMIN_USER = 'testadmin';
process.env.ADMIN_PASS = 'admintest123';

const path = require('path');
const fs = require('fs');
const os = require('os');
const dbFile = path.join(os.tmpdir(), `rgb-library-test-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbFile;

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');
const db = require('../db');

after(() => {
  db.close();
  fs.rmSync(dbFile, { force: true });
});

// Oturumlu istekler için kalıcı ajanlar (cookie taşırlar)
const admin = request.agent(app);
const user1 = request.agent(app);
const user2 = request.agent(app);
const user3 = request.agent(app);

const registerUser = (agent, username) =>
  agent.post('/api/register').send({ username, password: 'sifre123' });

// ---- Kimlik doğrulama ----

test('oturumsuz istek 401 döner', async () => {
  const res = await request(app).get('/api/books');
  assert.equal(res.status, 401);
});

test('kısa kullanıcı adı ve kısa şifre reddedilir', async () => {
  const r1 = await request(app).post('/api/register').send({ username: 'ab', password: 'sifre123' });
  assert.equal(r1.status, 400);
  const r2 = await request(app).post('/api/register').send({ username: 'gecerli', password: '123' });
  assert.equal(r2.status, 400);
});

test('kayıt olan kullanıcı oturum açmış olur', async () => {
  const res = await registerUser(user1, 'testuser1');
  assert.equal(res.status, 201);
  const me = await user1.get('/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user, 'testuser1');
  assert.equal(me.body.role, 'user');
});

test('aynı kullanıcı adıyla ikinci kayıt 409 döner', async () => {
  const res = await request(app).post('/api/register').send({ username: 'testuser1', password: 'sifre123' });
  assert.equal(res.status, 409);
});

test('yanlış şifreyle giriş 401 döner', async () => {
  const res = await request(app).post('/api/login').send({ username: 'testuser1', password: 'yanlis' });
  assert.equal(res.status, 401);
});

test('admin .env hesabıyla giriş yapabilir', async () => {
  const res = await admin.post('/api/login').send({ username: 'testadmin', password: 'admintest123' });
  assert.equal(res.status, 200);
  const me = await admin.get('/api/me');
  assert.equal(me.body.role, 'admin');
});

// ---- Kitap listesi ve filtreler ----

test('kitap listesi seed verisiyle dolu gelir', async () => {
  const res = await user1.get('/api/books');
  assert.equal(res.status, 200);
  assert.equal(res.body.count, 100);
  const book = res.body.books[0];
  for (const key of ['available', 'avg_rating', 'reservation_count', 'my_queue_pos']) {
    assert.ok(key in book, `kitap satırında ${key} alanı olmalı`);
  }
});

test('arama filtresi çalışır', async () => {
  const res = await user1.get('/api/books').query({ search: '1984' });
  assert.equal(res.body.count, 1);
  assert.equal(res.body.books[0].title, '1984');
});

test('tür filtresi yalnızca o türü döndürür', async () => {
  const res = await user1.get('/api/books').query({ genre: 'Felsefe' });
  assert.ok(res.body.count > 0);
  assert.ok(res.body.books.every((b) => b.genre === 'Felsefe'));
});

// ---- Kitap CRUD yetkileri ----

const newBook = {
  title: 'Test Kitabı', author: 'Test Yazar', genre: 'Roman', year: 2020,
  pages: 100, rating: 4, copies: 1, description: 'Test açıklaması.',
};

let testBookId;

test('admin olmayan kullanıcı kitap ekleyemez', async () => {
  const res = await user1.post('/api/books').send(newBook);
  assert.equal(res.status, 403);
});

test('admin kitap ekleyebilir ve güncelleyebilir', async () => {
  const created = await admin.post('/api/books').send(newBook);
  assert.equal(created.status, 201);
  testBookId = created.body.id;

  const updated = await admin.put(`/api/books/${testBookId}`).send({ ...newBook, pages: 150 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.pages, 150);
});

test('eksik alanlı kitap 400 döner', async () => {
  const res = await admin.post('/api/books').send({ ...newBook, title: '' });
  assert.equal(res.status, 400);
});

// ---- Raf ----

test('favorilenen kitap favoriler rafında görünür', async () => {
  const res = await user1.put('/api/books/1/shelf').send({ favorite: true });
  assert.equal(res.status, 200);
  const shelf = await user1.get('/api/books').query({ shelf: 'favorites' });
  assert.equal(shelf.body.count, 1);
  assert.equal(shelf.body.books[0].id, 1);
});

// ---- Değerlendirmeler ----

test('geçersiz puan reddedilir, geçerli değerlendirme kaydedilir', async () => {
  const bad = await user1.put('/api/books/1/review').send({ rating: 6 });
  assert.equal(bad.status, 400);

  const ok = await user1.put('/api/books/1/review').send({ rating: 5, comment: 'Harika!' });
  assert.equal(ok.status, 200);

  const list = await user1.get('/api/books/1/reviews');
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].mine, true);
  assert.equal(list.body[0].rating, 5);
});

// ---- Ödünç alma ----

test('ödünç alma, mükerrer alma ve iade akışı', async () => {
  const borrow = await user1.post('/api/books/1/borrow');
  assert.equal(borrow.status, 200);
  assert.ok(borrow.body.due_at);

  const again = await user1.post('/api/books/1/borrow');
  assert.equal(again.status, 409);

  const shelf = await user1.get('/api/books').query({ shelf: 'borrowed' });
  assert.equal(shelf.body.count, 1);
  assert.ok(shelf.body.books[0].my_due);

  const ret = await user1.post('/api/books/1/return');
  assert.equal(ret.status, 200);
  const retAgain = await user1.post('/api/books/1/return');
  assert.equal(retAgain.status, 404);
});

test('aynı anda en fazla 5 kitap ödünç alınabilir', async () => {
  for (let id = 2; id <= 6; id++) {
    const res = await user1.post(`/api/books/${id}/borrow`);
    assert.equal(res.status, 200, `kitap ${id} ödünç alınabilmeli`);
  }
  const sixth = await user1.post('/api/books/7/borrow');
  assert.equal(sixth.status, 409);
  for (let id = 2; id <= 6; id++) {
    await user1.post(`/api/books/${id}/return`);
  }
});

// ---- Rezervasyon ----

test('rezervasyon kuyruğu: sıra, ayrılan kopya ve sırası gelen üye', async () => {
  await registerUser(user2, 'testuser2');
  await registerUser(user3, 'testuser3');

  // Tek kopyalı test kitabını user1 alır → stok biter
  const b1 = await user1.post(`/api/books/${testBookId}/borrow`);
  assert.equal(b1.status, 200);

  // Müsait kitaba rezervasyon yapılamaz (kitap 1 boşta)
  const noNeed = await user2.post('/api/books/1/reserve');
  assert.equal(noNeed.status, 409);

  // user2 ve user3 sıraya girer
  const r2 = await user2.post(`/api/books/${testBookId}/reserve`);
  assert.equal(r2.status, 201);
  assert.equal(r2.body.position, 1);
  const r3 = await user3.post(`/api/books/${testBookId}/reserve`);
  assert.equal(r3.body.position, 2);

  // Mükerrer rezervasyon reddedilir
  const dup = await user2.post(`/api/books/${testBookId}/reserve`);
  assert.equal(dup.status, 409);

  // Stok yokken sıradaki bile alamaz
  const early = await user2.post(`/api/books/${testBookId}/borrow`);
  assert.equal(early.status, 409);

  // user1 iade eder → kopya kuyruktaki user2 için ayrılır
  await user1.post(`/api/books/${testBookId}/return`);
  const jump = await user3.post(`/api/books/${testBookId}/borrow`);
  assert.equal(jump.status, 409, 'sırası gelmeyen üye kitabı kapamamalı');

  // user2'nin uyarılarında "rezervasyonun hazır" görünür
  const alerts = await user2.get('/api/my/alerts');
  assert.equal(alerts.body.ready.length, 1);
  assert.equal(alerts.body.ready[0].title, 'Test Kitabı');

  // user2 alır, rezervasyonu düşer; user3 kuyrukta 1. sıraya yükselir
  const take = await user2.post(`/api/books/${testBookId}/borrow`);
  assert.equal(take.status, 200);
  const list = await user3.get('/api/books').query({ search: 'Test Kitabı' });
  assert.equal(list.body.books[0].my_queue_pos, 1);

  // user3 rezervasyonunu iptal eder
  const cancel = await user3.delete(`/api/books/${testBookId}/reserve`);
  assert.equal(cancel.status, 200);
  const cancelAgain = await user3.delete(`/api/books/${testBookId}/reserve`);
  assert.equal(cancelAgain.status, 404);
});

// ---- Öneriler ----

test('öneriler kullanıcının etkileşimdeki kitaplarını içermez', async () => {
  const res = await user1.get('/api/recommendations');
  assert.equal(res.status, 200);
  assert.ok(res.body.count > 0 && res.body.count <= 12);
  // Kitap 1: favori + değerlendirme; test kitabı: ödünç geçmişi olsa da aktif değil,
  // yine de user1'in raf/yorum/ödünç kayıtlarındaki kitaplar önerilmemeli
  assert.ok(!res.body.books.some((b) => b.id === 1), 'raftaki kitap önerilmemeli');
});

// ---- Uyarılar ----

test('yeni ödünçte uyarı şeridi boş kalır (14 gün var)', async () => {
  await user1.post('/api/books/10/borrow');
  const res = await user1.get('/api/my/alerts');
  assert.equal(res.status, 200);
  assert.equal(res.body.overdue.length, 0);
  assert.equal(res.body.dueSoon.length, 0);
  await user1.post('/api/books/10/return');
});

// ---- Profil ----

test('şifre değiştirme: yanlış mevcut şifre 401, doğrusu çalışır', async () => {
  const bad = await user1.post('/api/profile/password').send({ current: 'yanlis', next: 'yenisifre1' });
  assert.equal(bad.status, 401);

  const ok = await user1.post('/api/profile/password').send({ current: 'sifre123', next: 'yenisifre1' });
  assert.equal(ok.status, 200);

  const login = await request(app).post('/api/login').send({ username: 'testuser1', password: 'yenisifre1' });
  assert.equal(login.status, 200);
});
