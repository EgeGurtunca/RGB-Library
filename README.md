# RGB Library

Oturum korumalı bir kitap kütüphanesi web uygulaması. Kitaplar arasında arama, tür/yıl filtreleme ve sıralama yapılabilir; kullanıcılar kayıt olup kendi raflarını (favoriler, okuduklarım, okuyacaklarım) yönetebilir, kitaplara yıldız + yorum bırakabilir ve kitap ödünç alabilir; adminler kitap ekleyip düzenleyebilir, aktif ödünçleri yönetebilir ve kütüphane istatistiklerini görebilir. Veritabanı ilk çalıştırmada 100 kitapla otomatik doldurulur; kitap kapakları Open Library'den tek komutla çekilebilir.

## Teknolojiler

- **Node.js + Express 5** — web sunucusu ve API
- **better-sqlite3** — SQLite veritabanı (`library.db`)
- **express-session** — oturum yönetimi (giriş zorunlu)
- **Node crypto (scrypt)** — şifre hash'leme (ek bağımlılık yok)
- **Vanilla JS + HTML/CSS** — arayüz (`public/`)

## Kurulum

```bash
npm install
```

Proje kökünde bir `.env` dosyası oluşturun:

```env
SESSION_SECRET=rastgele-uzun-bir-anahtar
ADMIN_USER=admin
ADMIN_PASS=sifreniz
PORT=3000
```

> `PORT` isteğe bağlıdır, varsayılan 3000. Diğer üç değişken zorunludur; eksikse sunucu açılışta hata verir.

## Çalıştırma

```bash
npm start
```

Tarayıcıda `http://localhost:3000` adresini açın. Giriş yapmadan ana sayfaya erişilemez.

- `library.db` yoksa otomatik oluşturulur ve 100 kitapla doldurulur.
- İlk çalıştırmada `.env`'deki `ADMIN_USER` / `ADMIN_PASS` ile bir **admin** hesabı oluşturulur (şifre scrypt ile hash'lenerek saklanır).
- Yeni kullanıcılar giriş sayfasındaki **"Kayıt olun"** bağlantısıyla hesap açabilir (rol: `user`).

### Kitap kapakları

```bash
npm run covers
```

Kapağı olmayan kitaplar için [Open Library](https://openlibrary.org/dev/docs/api/search)'de arama yapar ve bulunan kapak görsellerinin URL'lerini veritabanına yazar (görseller `covers.openlibrary.org` üzerinden tarayıcıda yüklenir). İstenildiği kadar tekrar çalıştırılabilir; kapak bulunamayan kitaplar tür ikonuyla görünmeye devam eder. Admin, kitap formundaki **Kapak URL** alanından kapağı elle de ayarlayabilir.

## Roller

| Rol | Yetkiler |
|-----|----------|
| `user` | Kitapları görüntüleme, arama/filtreleme, kişisel raf (favori + okuma durumu), yıldız + yorum, ödünç alma/iade, profil (raf özeti, ödünç geçmişi, değerlendirmeler, şifre değiştirme — üst barda kullanıcı adına tıklayınca açılır) |
| `admin` | Ek olarak: kitap ekleme/düzenleme/silme, yorum kaldırma, tüm aktif ödünçleri görme ve iade alma, istatistik paneli |

## Puanlama ve ödünç kuralları

- Her kullanıcı bir kitaba **1 değerlendirme** (1–5 yıldız + isteğe bağlı yorum) bırakabilir; tekrar gönderirse eskisi güncellenir.
- Kitabın görünen puanı, kullanıcı değerlendirmelerinin **ortalamasıdır**; hiç değerlendirme yoksa seed puanı gösterilir.
- Her kitabın bir **kopya stoku** vardır (varsayılan 3, admin formundan değiştirilebilir).
- Ödünç süresi **14 gün**; bir kullanıcı aynı anda en fazla **5 kitap** ödünç alabilir ve aynı kitabı ikinci kez alamaz.
- Süresi geçen ödünçler admin panelinde (üst bardaki "Ödünçler") kırmızı işaretlenir.

## API

Tüm `/api` uçları (login/register hariç) oturum gerektirir; oturum yoksa `401` döner. Admin gerektiren uçlar yetkisiz kullanıcıya `403` döner.

Giriş ve kayıt uçları **hız sınırlıdır**: aynı IP'den 10 dakika içinde en fazla 20 deneme yapılabilir, aşımda `429` döner (brute-force koruması).

| Metot | Yol | Yetki | Açıklama |
|-------|-----|-------|----------|
| POST | `/api/register` | — | Kayıt — gövde: `{ "username", "password" }` (kullanıcı adı 3–30, şifre ≥ 6 karakter) |
| POST | `/api/login` | — | Giriş — gövde: `{ "username", "password" }` |
| POST | `/api/logout` | oturum | Oturumu sonlandırır |
| GET | `/api/me` | oturum | Oturumdaki kullanıcıyı ve rolünü döner |
| GET | `/api/profile` | oturum | Profil: üyelik bilgisi, raf özeti, değerlendirmeler, ödünç geçmişi (son 50) |
| POST | `/api/profile/password` | oturum | Şifre değiştirir — gövde: `{ "current", "next" }` (yeni şifre ≥ 6 karakter) |
| GET | `/api/genres` | oturum | Mevcut kitap türlerini listeler |
| GET | `/api/books` | oturum | Kitapları listeler (filtre/sıralama/raf destekli) |
| POST | `/api/books` | admin | Yeni kitap ekler |
| PUT | `/api/books/:id` | admin | Kitabı günceller |
| DELETE | `/api/books/:id` | admin | Kitabı siler |
| PUT | `/api/books/:id/shelf` | oturum | Kişisel raf — gövde: `{ "favorite": bool, "status": "read" \| "toread" \| null }` (alanlar isteğe bağlı) |
| GET | `/api/books/:id/reviews` | oturum | Kitabın değerlendirmelerini listeler (`mine` alanıyla) |
| PUT | `/api/books/:id/review` | oturum | Kendi değerlendirmeni ekler/günceller — gövde: `{ "rating": 1–5, "comment"? }` |
| DELETE | `/api/books/:id/review` | oturum | Kendi değerlendirmeni siler |
| DELETE | `/api/books/:id/reviews/:userId` | admin | Bir kullanıcının değerlendirmesini kaldırır |
| POST | `/api/books/:id/borrow` | oturum | Kitabı ödünç alır (stok + limit kontrolü, 14 gün) |
| POST | `/api/books/:id/return` | oturum | Ödünç alınan kitabı iade eder |
| GET | `/api/admin/loans` | admin | Tüm aktif ödünçler (gecikme bilgisiyle) |
| POST | `/api/admin/loans/:loanId/return` | admin | Kullanıcı adına iade alır |
| GET | `/api/admin/stats` | admin | İstatistikler: toplamlar, en çok ödünç alınanlar, en yüksek puanlılar, tür dağılımı |

### `/api/books` sorgu parametreleri

- `search` — başlık veya yazarda arama
- `genre` — türe göre filtre (örn. `Roman`, `Bilim Kurgu`)
- `yearMin` / `yearMax` — yayın yılı aralığı
- `shelf` — kişisel raf filtresi: `favorites`, `read`, `toread`, `borrowed`
- `sort` — `title` (varsayılan), `year-asc`, `year-desc`, `rating` (ortalama puana göre)

Dönen her kitapta oturumdaki kullanıcıya özel alanlar bulunur: `favorite` (0/1), `status` (`read`/`toread`/`null`), `my_due` (aktif ödünç iade tarihi veya `null`); ayrıca `avg_rating` (ortalama puan), `review_count` ve `available` (müsait kopya sayısı).

Örnek:

```
GET /api/books?search=orwell&genre=Bilim%20Kurgu&sort=rating&shelf=favorites
```

## Veritabanı şeması

- **books** — id, title, title_en, author, genre, year, pages, rating (seed puanı), copies (kopya stoku), description, cover_url
- **users** — id, username (benzersiz, harf duyarsız), password_hash (scrypt), role (`admin`/`user`), created_at
- **user_books** — user_id + book_id (bileşik anahtar), favorite (0/1), status (`read`/`toread`)
- **reviews** — user_id + book_id (bileşik anahtar), rating (1–5), comment, created_at
- **loans** — id, user_id, book_id, borrowed_at, due_at, returned_at (`null` = hâlâ ödünçte)

Kullanıcı veya kitap silinince bağlı satırlar da silinir (CASCADE).

## Proje yapısı

```
├── server.js        # Express sunucusu, oturum, kimlik doğrulama ve API rotaları
├── auth.js          # scrypt şifre hash'leme / doğrulama
├── db.js            # SQLite bağlantısı, şema ve seed verisi
├── library.db       # Veritabanı (git'e dahil değil, otomatik oluşur)
├── scripts/
│   └── fetch-covers.js  # Open Library'den kitap kapaklarını çeker (npm run covers)
└── public/
    ├── index.html   # Kütüphane arayüzü
    ├── login.html   # Giriş / kayıt sayfası
    ├── js/          # app.js, login.js
    └── css/         # style.css
```
