// Open Library'den kitap kapaklarını bulup books.cover_url alanına yazar.
// Kullanım: npm run covers — yalnızca kapağı olmayan kitaplar için arama yapar,
// istenildiği kadar tekrar çalıştırılabilir.
const db = require('../db');

const SEARCH_URL = 'https://openlibrary.org/search.json';
const HEADERS = { 'User-Agent': 'RGB-Library/1.0 (kutuphane ders projesi)' };
const DELAY_MS = 350; // Open Library'ye nazik davran: istekler arası bekleme

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchCoverId(fields) {
  const params = new URLSearchParams({ ...fields, limit: '3', fields: 'cover_i' });
  const res = await fetch(`${SEARCH_URL}?${params}`, { headers: HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = (data.docs || []).find((d) => d.cover_i);
  return hit ? hit.cover_i : null;
}


(async () => {
  const books = db.prepare(
    `SELECT id, title, title_en, author FROM books WHERE cover_url IS NULL OR cover_url = ''`
  ).all();
  if (!books.length) {
    console.log('Kapağı eksik kitap yok, çıkılıyor.');
    return;
  }
  console.log(`${books.length} kitap için kapak aranıyor...`);

  const update = db.prepare('UPDATE books SET cover_url = ? WHERE id = ?');
  let found = 0;

  for (const b of books) {
    // Önce İngilizce başlık + yazar (en isabetlisi), bulunamazsa daha gevşek aramalar
    const attempts = [
      b.title_en && { title: b.title_en, author: b.author },
      b.title_en && { title: b.title_en },
      { title: b.title, author: b.author },
      { title: b.title },
    ].filter(Boolean);

    let coverId = null;
    for (const fields of attempts) {
      try {
        coverId = await searchCoverId(fields);
      } catch (err) {
        console.error(`  ! ${b.title}: ${err.message}`);
      }
      if (coverId) break;
      await sleep(DELAY_MS);
    }

    if (coverId) {
      update.run(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`, b.id);
      found += 1;
      console.log(`  ✓ ${b.title}`);
    } else {
      console.log(`  — ${b.title} (kapak bulunamadı)`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`Bitti: ${found}/${books.length} kitaba kapak eklendi.`);
})();