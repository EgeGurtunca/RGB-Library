const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'library.db'));
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    genre TEXT NOT NULL,
    year INTEGER NOT NULL,
    pages INTEGER NOT NULL,
    rating REAL NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_books (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    favorite INTEGER NOT NULL DEFAULT 0,
    status TEXT CHECK (status IN ('read', 'toread')),
    PRIMARY KEY (user_id, book_id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, book_id)
  );

  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    borrowed_at TEXT NOT NULL DEFAULT (datetime('now')),
    due_at TEXT NOT NULL,
    returned_at TEXT
  );
`);

// [title, author, genre, year, pages, rating, description]
const seedBooks = [
  ['Tutunamayanlar', 'Oğuz Atay', 'Roman', 1972, 724, 4.8, 'Türk edebiyatının en önemli modernist romanlarından biri.'],
  ['Kürk Mantolu Madonna', 'Sabahattin Ali', 'Roman', 1943, 160, 4.7, 'Raif Efendi\'nin Berlin\'de yaşadığı tutkulu aşkın hikayesi.'],
  ['İnce Memed', 'Yaşar Kemal', 'Roman', 1955, 436, 4.6, 'Toroslar\'da bir eşkıyanın destansı öyküsü.'],
  ['Saatleri Ayarlama Enstitüsü', 'Ahmet Hamdi Tanpınar', 'Roman', 1961, 382, 4.7, 'Modernleşme çabalarının ironik bir eleştirisi.'],
  ['Aylak Adam', 'Yusuf Atılgan', 'Roman', 1959, 156, 4.4, 'Şehirde amaçsızca dolaşan C.\'nin varoluş arayışı.'],
  ['Beyaz Kale', 'Orhan Pamuk', 'Roman', 1985, 200, 4.2, 'Bir Venedikli köle ile Osmanlı aliminin kimlik değişimi.'],
  ['Benim Adım Kırmızı', 'Orhan Pamuk', 'Polisiye', 1998, 472, 4.4, 'Osmanlı nakkaşları arasında geçen bir cinayet romanı.'],
  ['Masumiyet Müzesi', 'Orhan Pamuk', 'Roman', 2008, 592, 4.3, 'Kemal\'in Füsun\'a duyduğu saplantılı aşkın müzesi.'],
  ['Huzur', 'Ahmet Hamdi Tanpınar', 'Roman', 1949, 391, 4.5, 'Mümtaz ile Nuran\'ın aşkı üzerinden bir İstanbul romanı.'],
  ['Yaban', 'Yakup Kadri Karaosmanoğlu', 'Roman', 1932, 216, 4.2, 'Kurtuluş Savaşı yıllarında aydın-köylü çatışması.'],
  ['Çalıkuşu', 'Reşat Nuri Güntekin', 'Roman', 1922, 543, 4.5, 'Feride\'nin Anadolu\'da öğretmenlik yıllarının hikayesi.'],
  ['Sinekli Bakkal', 'Halide Edib Adıvar', 'Roman', 1936, 456, 4.1, 'II. Abdülhamid dönemi İstanbul\'unda Rabia\'nın hayatı.'],
  ['Anayurt Oteli', 'Yusuf Atılgan', 'Roman', 1973, 160, 4.3, 'Otel katibi Zebercet\'in psikolojik çöküşü.'],
  ['Tehlikeli Oyunlar', 'Oğuz Atay', 'Roman', 1973, 471, 4.7, 'Hikmet Benol\'un iç dünyasında gezinen deneysel bir roman.'],
  ['Sevgili Arsız Ölüm', 'Latife Tekin', 'Roman', 1983, 205, 4.2, 'Köyden kente göçün büyülü gerçekçi anlatısı.'],
  ['Bir Düğün Gecesi', 'Adalet Ağaoğlu', 'Roman', 1979, 372, 4.3, 'Bir düğün üzerinden 12 Mart dönemine bakış.'],
  ['Kuyucaklı Yusuf', 'Sabahattin Ali', 'Roman', 1937, 224, 4.6, 'Anadolu kasabasında büyüyen Yusuf\'un dramı.'],
  ['Fatih-Harbiye', 'Peyami Safa', 'Roman', 1931, 128, 4.0, 'Doğu-Batı ikilemi arasında kalan Neriman.'],
  ['Dokuzuncu Hariciye Koğuşu', 'Peyami Safa', 'Roman', 1930, 128, 4.3, 'Hasta bir gencin acılarla dolu iç dünyası.'],
  ['Esir Şehrin İnsanları', 'Kemal Tahir', 'Tarih', 1956, 384, 4.4, 'İşgal altındaki İstanbul\'da direniş.'],
  ['Devlet Ana', 'Kemal Tahir', 'Tarih', 1967, 624, 4.3, 'Osmanlı\'nın kuruluş dönemini anlatan tarihsel roman.'],
  ['Yılanların Öcü', 'Fakir Baykurt', 'Roman', 1954, 288, 4.2, 'Köy yaşamında toprak ve namus kavgası.'],
  ['Memleketimden İnsan Manzaraları', 'Nâzım Hikmet', 'Şiir', 1966, 552, 4.8, 'Türkiye\'nin insan manzaralarını anlatan dev şiir.'],
  ['Otuz Beş Yaş', 'Cahit Sıtkı Tarancı', 'Şiir', 1946, 96, 4.5, 'Yaşamın ortasında ölüm ve yaşam üzerine şiirler.'],
  ['Sisler Bulvarı', 'Attilâ İlhan', 'Şiir', 1954, 112, 4.4, 'İkinci Yeni öncesi dönemin unutulmaz şiirleri.'],
  ['Suç ve Ceza', 'Fyodor Dostoyevski', 'Roman', 1866, 687, 4.8, 'Raskolnikov\'un işlediği cinayetin vicdani sorgusu.'],
  ['Karamazov Kardeşler', 'Fyodor Dostoyevski', 'Roman', 1880, 1024, 4.8, 'İnanç, ahlak ve baba katli üzerine başyapıt.'],
  ['Budala', 'Fyodor Dostoyevski', 'Roman', 1869, 768, 4.6, 'Saf ve iyi kalpli Prens Mışkin\'in trajedisi.'],
  ['Yeraltından Notlar', 'Fyodor Dostoyevski', 'Felsefe', 1864, 176, 4.5, 'Modern insanın yabancılaşmasının ilk büyük anlatısı.'],
  ['Savaş ve Barış', 'Lev Tolstoy', 'Tarih', 1869, 1225, 4.7, 'Napolyon savaşları döneminde Rus toplumu.'],
  ['Anna Karenina', 'Lev Tolstoy', 'Roman', 1877, 864, 4.7, 'Yasak bir aşkın trajik sonu.'],
  ['İvan İlyiç\'in Ölümü', 'Lev Tolstoy', 'Felsefe', 1886, 112, 4.6, 'Ölüm döşeğindeki bir adamın hayat muhasebesi.'],
  ['Babalar ve Oğullar', 'İvan Turgenyev', 'Roman', 1862, 296, 4.4, 'Kuşak çatışması ve nihilizm üzerine.'],
  ['Ölü Canlar', 'Nikolay Gogol', 'Roman', 1842, 432, 4.4, 'Çiçikov\'un ölü serf ruhları satın alma dolandırıcılığı.'],
  ['Usta ile Margarita', 'Mihail Bulgakov', 'Fantastik', 1967, 512, 4.7, 'Şeytan\'ın Moskova\'yı ziyaretinin hicivli öyküsü.'],
  ['1984', 'George Orwell', 'Bilim Kurgu', 1949, 328, 4.8, 'Totaliter bir gelecekte Winston Smith\'in direnişi.'],
  ['Hayvan Çiftliği', 'George Orwell', 'Roman', 1945, 152, 4.6, 'Devrimin yozlaşmasının alegorik anlatısı.'],
  ['Cesur Yeni Dünya', 'Aldous Huxley', 'Bilim Kurgu', 1932, 288, 4.5, 'Mutluluğun dayatıldığı distopik bir gelecek.'],
  ['Fahrenheit 451', 'Ray Bradbury', 'Bilim Kurgu', 1953, 256, 4.4, 'Kitapların yakıldığı bir dünyada bir itfaiyecinin uyanışı.'],
  ['Dune', 'Frank Herbert', 'Bilim Kurgu', 1965, 712, 4.7, 'Çöl gezegeni Arrakis\'te güç ve kehanet mücadelesi.'],
  ['Vakıf', 'Isaac Asimov', 'Bilim Kurgu', 1951, 296, 4.6, 'Galaktik imparatorluğun çöküşü ve psikotarih.'],
  ['Ben, Robot', 'Isaac Asimov', 'Bilim Kurgu', 1950, 256, 4.4, 'Robot yasalarını sorgulayan öykü derlemesi.'],
  ['Otostopçunun Galaksi Rehberi', 'Douglas Adams', 'Bilim Kurgu', 1979, 224, 4.5, 'Dünya\'nın yıkılışıyla başlayan absürt uzay macerası.'],
  ['Solaris', 'Stanislaw Lem', 'Bilim Kurgu', 1961, 224, 4.4, 'Bilinçli bir okyanus gezegeniyle temas denemesi.'],
  ['Karanlığın Sol Eli', 'Ursula K. Le Guin', 'Bilim Kurgu', 1969, 336, 4.5, 'Cinsiyetsiz bir gezegende diplomasi ve dostluk.'],
  ['Mülksüzler', 'Ursula K. Le Guin', 'Bilim Kurgu', 1974, 400, 4.6, 'İki dünya arasında bir fizikçinin ütopya arayışı.'],
  ['Yüzüklerin Efendisi', 'J.R.R. Tolkien', 'Fantastik', 1954, 1178, 4.9, 'Tek Yüzük\'ü yok etme yolculuğunun destanı.'],
  ['Hobbit', 'J.R.R. Tolkien', 'Fantastik', 1937, 310, 4.7, 'Bilbo Baggins\'in ejderha Smaug\'a karşı macerası.'],
  ['Harry Potter ve Felsefe Taşı', 'J.K. Rowling', 'Fantastik', 1997, 336, 4.6, 'Genç büyücünün Hogwarts\'taki ilk yılı.'],
  ['Taht Oyunları', 'George R.R. Martin', 'Fantastik', 1996, 694, 4.6, 'Westeros\'ta taht için verilen kanlı mücadele.'],
  ['Rüzgarın Adı', 'Patrick Rothfuss', 'Fantastik', 2007, 662, 4.6, 'Efsanevi Kvothe\'un kendi ağzından hayat hikayesi.'],
  ['Amerikan Tanrıları', 'Neil Gaiman', 'Fantastik', 2001, 465, 4.3, 'Eski tanrılarla yeni tanrıların Amerika\'daki savaşı.'],
  ['Yerdeniz Büyücüsü', 'Ursula K. Le Guin', 'Fantastik', 1968, 183, 4.5, 'Genç büyücü Ged\'in kendi gölgesiyle yüzleşmesi.'],
  ['Simyacı', 'Paulo Coelho', 'Roman', 1988, 184, 4.2, 'Kişisel menkıbesinin peşindeki çobanın yolculuğu.'],
  ['Yüzyıllık Yalnızlık', 'Gabriel García Márquez', 'Roman', 1967, 464, 4.7, 'Buendia ailesinin yedi kuşaklık büyülü hikayesi.'],
  ['Kolera Günlerinde Aşk', 'Gabriel García Márquez', 'Roman', 1985, 448, 4.4, 'Elli yıl bekleyen bir aşkın romanı.'],
  ['Dönüşüm', 'Franz Kafka', 'Roman', 1915, 104, 4.5, 'Bir sabah böceğe dönüşen Gregor Samsa\'nın dramı.'],
  ['Dava', 'Franz Kafka', 'Roman', 1925, 304, 4.5, 'Nedenini bilmediği bir suçla yargılanan Josef K.'],
  ['Şato', 'Franz Kafka', 'Roman', 1926, 352, 4.3, 'Şatoya ulaşmaya çalışan kadastrocu K.\'nın hikayesi.'],
  ['Yabancı', 'Albert Camus', 'Felsefe', 1942, 160, 4.6, 'Meursault\'nun absürt dünyayla hesaplaşması.'],
  ['Veba', 'Albert Camus', 'Roman', 1947, 320, 4.5, 'Salgın altındaki Oran şehrinde insanlık halleri.'],
  ['Sisifos Söyleni', 'Albert Camus', 'Felsefe', 1942, 176, 4.4, 'Absürt felsefesinin temel metni.'],
  ['Bulantı', 'Jean-Paul Sartre', 'Felsefe', 1938, 256, 4.3, 'Varoluşun saçmalığıyla yüzleşen Roquentin.'],
  ['Böyle Buyurdu Zerdüşt', 'Friedrich Nietzsche', 'Felsefe', 1883, 352, 4.5, 'Üstinsan öğretisinin şiirsel anlatımı.'],
  ['Sokrates\'in Savunması', 'Platon', 'Felsefe', -399, 96, 4.6, 'Sokrates\'in Atina mahkemesindeki savunması.'],
  ['Devlet', 'Platon', 'Felsefe', -380, 496, 4.5, 'İdeal devlet ve adalet üzerine diyaloglar.'],
  ['Nikomakhos\'a Etik', 'Aristoteles', 'Felsefe', -340, 400, 4.4, 'Erdem ve mutluluk üzerine temel etik metni.'],
  ['Hükümdar', 'Niccolò Machiavelli', 'Felsefe', 1532, 152, 4.3, 'İktidarın doğası üzerine acımasızca gerçekçi bir el kitabı.'],
  ['Denemeler', 'Michel de Montaigne', 'Felsefe', 1580, 424, 4.5, 'İnsan doğası üzerine samimi denemeler.'],
  ['Küçük Prens', 'Antoine de Saint-Exupéry', 'Roman', 1943, 96, 4.7, 'Bir pilotun çölde tanıştığı küçük prensin masalı.'],
  ['Sefiller', 'Victor Hugo', 'Roman', 1862, 1232, 4.7, 'Jean Valjean\'ın merhamet ve adalet arayışı.'],
  ['Notre Dame\'ın Kamburu', 'Victor Hugo', 'Roman', 1831, 512, 4.4, 'Quasimodo\'nun Esmeralda\'ya imkansız aşkı.'],
  ['Monte Kristo Kontu', 'Alexandre Dumas', 'Macera', 1844, 1176, 4.7, 'Haksız yere hapsedilen Dantès\'in intikam planı.'],
  ['Üç Silahşörler', 'Alexandre Dumas', 'Macera', 1844, 704, 4.4, 'D\'Artagnan ve üç silahşörün maceraları.'],
  ['Madame Bovary', 'Gustave Flaubert', 'Roman', 1856, 384, 4.3, 'Taşra hayatından bunalan Emma\'nın trajedisi.'],
  ['Kırmızı ve Siyah', 'Stendhal', 'Roman', 1830, 576, 4.4, 'Hırslı Julien Sorel\'in yükseliş ve düşüşü.'],
  ['Germinal', 'Émile Zola', 'Roman', 1885, 592, 4.5, 'Maden işçilerinin grevi ve sınıf mücadelesi.'],
  ['Gurur ve Önyargı', 'Jane Austen', 'Roman', 1813, 432, 4.6, 'Elizabeth Bennet ile Bay Darcy\'nin aşk oyunu.'],
  ['Uğultulu Tepeler', 'Emily Brontë', 'Roman', 1847, 416, 4.4, 'Heathcliff ile Catherine\'in yıkıcı tutkusu.'],
  ['Jane Eyre', 'Charlotte Brontë', 'Roman', 1847, 532, 4.5, 'Öksüz Jane\'in bağımsızlık ve aşk mücadelesi.'],
  ['Büyük Umutlar', 'Charles Dickens', 'Roman', 1861, 544, 4.5, 'Pip\'in centilmen olma hayalinin bedeli.'],
  ['İki Şehrin Hikayesi', 'Charles Dickens', 'Tarih', 1859, 448, 4.4, 'Fransız Devrimi\'nde Londra ve Paris.'],
  ['Moby Dick', 'Herman Melville', 'Macera', 1851, 720, 4.3, 'Kaptan Ahab\'ın beyaz balinaya saplantılı avı.'],
  ['Define Adası', 'Robert Louis Stevenson', 'Macera', 1883, 292, 4.3, 'Genç Jim Hawkins\'in korsan hazinesi macerası.'],
  ['Robinson Crusoe', 'Daniel Defoe', 'Macera', 1719, 320, 4.2, 'Issız adada 28 yıl hayatta kalma mücadelesi.'],
  ['Denizler Altında Yirmi Bin Fersah', 'Jules Verne', 'Macera', 1870, 432, 4.3, 'Kaptan Nemo\'nun Nautilus\'uyla okyanus yolculuğu.'],
  ['Seksen Günde Devri Alem', 'Jules Verne', 'Macera', 1872, 256, 4.3, 'Phileas Fogg\'un zamana karşı dünya turu.'],
  ['Sherlock Holmes: Baskerville Tazısı', 'Arthur Conan Doyle', 'Polisiye', 1902, 256, 4.5, 'Bataklıktaki lanetli tazının gizemi.'],
  ['Doğu Ekspresinde Cinayet', 'Agatha Christie', 'Polisiye', 1934, 256, 4.6, 'Poirot\'nun karda mahsur trende çözdüğü cinayet.'],
  ['On Küçük Zenci', 'Agatha Christie', 'Polisiye', 1939, 272, 4.6, 'Issız adada birer birer ölen on davetli.'],
  ['Gülün Adı', 'Umberto Eco', 'Polisiye', 1980, 560, 4.5, 'Ortaçağ manastırında bir dizi esrarengiz cinayet.'],
  ['Ejderha Dövmeli Kız', 'Stieg Larsson', 'Polisiye', 2005, 590, 4.4, 'Kayıp bir kızın kırk yıllık sırrının peşinde.'],
  ['Da Vinci Şifresi', 'Dan Brown', 'Polisiye', 2003, 489, 4.0, 'Louvre\'daki cinayetle başlayan sembol avı.'],
  ['Nutuk', 'Mustafa Kemal Atatürk', 'Tarih', 1927, 1196, 4.9, 'Kurtuluş Savaşı ve Cumhuriyet\'in kuruluşunun anlatımı.'],
  ['Sapiens: İnsan Türünün Kısa Bir Tarihi', 'Yuval Noah Harari', 'Tarih', 2011, 512, 4.6, 'İnsanlığın taş devrinden bugüne serüveni.'],
  ['Tüfek, Mikrop ve Çelik', 'Jared Diamond', 'Tarih', 1997, 528, 4.4, 'Medeniyetler arası eşitsizliğin coğrafi kökenleri.'],
  ['İnsanın Anlam Arayışı', 'Viktor E. Frankl', 'Kişisel Gelişim', 1946, 176, 4.7, 'Toplama kampından çıkan logoterapinin kurucusunun tanıklığı.'],
  ['Atomik Alışkanlıklar', 'James Clear', 'Kişisel Gelişim', 2018, 320, 4.5, 'Küçük değişikliklerle büyük sonuçlar elde etme sanatı.'],
  ['Hızlı ve Yavaş Düşünme', 'Daniel Kahneman', 'Kişisel Gelişim', 2011, 624, 4.5, 'Karar verme mekanizmalarımızın iki sistemi.'],
  ['Beden Kayıt Tutar', 'Bessel van der Kolk', 'Kişisel Gelişim', 2014, 464, 4.6, 'Travmanın beden ve zihin üzerindeki izleri.'],
];

// Mevcut veritabanlarına sonradan eklenen kolonlar (yeni kurulumlarda da çalışır)
const bookColumns = db.pragma('table_info(books)').map((c) => c.name);
if (!bookColumns.includes('title_en')) {
  db.exec('ALTER TABLE books ADD COLUMN title_en TEXT');
}
if (!bookColumns.includes('copies')) {
  db.exec('ALTER TABLE books ADD COLUMN copies INTEGER NOT NULL DEFAULT 3');
}
if (!bookColumns.includes('cover_url')) {
  db.exec('ALTER TABLE books ADD COLUMN cover_url TEXT');
}

// Seed kitaplarının yayımlanmış İngilizce başlıkları.
// Yalnızca gerçekten İngilizce baskısı/çevirisi olan eserler listede;
// çevrilmemiş Türkçe eserler EN modda da Türkçe adıyla görünür.
const TITLE_EN = {
  'Tutunamayanlar': 'The Disconnected',
  'Kürk Mantolu Madonna': 'Madonna in a Fur Coat',
  'İnce Memed': 'Memed, My Hawk',
  'Saatleri Ayarlama Enstitüsü': 'The Time Regulation Institute',
  'Beyaz Kale': 'The White Castle',
  'Benim Adım Kırmızı': 'My Name Is Red',
  'Masumiyet Müzesi': 'The Museum of Innocence',
  'Huzur': 'A Mind at Peace',
  'Çalıkuşu': 'The Autobiography of a Turkish Girl',
  'Sinekli Bakkal': 'The Clown and His Daughter',
  'Anayurt Oteli': 'Motherland Hotel',
  'Sevgili Arsız Ölüm': 'Dear Shameless Death',
  'Memleketimden İnsan Manzaraları': 'Human Landscapes from My Country',
  'Suç ve Ceza': 'Crime and Punishment',
  'Karamazov Kardeşler': 'The Brothers Karamazov',
  'Budala': 'The Idiot',
  'Yeraltından Notlar': 'Notes from Underground',
  'Savaş ve Barış': 'War and Peace',
  'İvan İlyiç\'in Ölümü': 'The Death of Ivan Ilyich',
  'Babalar ve Oğullar': 'Fathers and Sons',
  'Ölü Canlar': 'Dead Souls',
  'Usta ile Margarita': 'The Master and Margarita',
  'Hayvan Çiftliği': 'Animal Farm',
  'Cesur Yeni Dünya': 'Brave New World',
  'Vakıf': 'Foundation',
  'Ben, Robot': 'I, Robot',
  'Otostopçunun Galaksi Rehberi': 'The Hitchhiker\'s Guide to the Galaxy',
  'Karanlığın Sol Eli': 'The Left Hand of Darkness',
  'Mülksüzler': 'The Dispossessed',
  'Yüzüklerin Efendisi': 'The Lord of the Rings',
  'Hobbit': 'The Hobbit',
  'Harry Potter ve Felsefe Taşı': 'Harry Potter and the Philosopher\'s Stone',
  'Taht Oyunları': 'A Game of Thrones',
  'Rüzgarın Adı': 'The Name of the Wind',
  'Amerikan Tanrıları': 'American Gods',
  'Yerdeniz Büyücüsü': 'A Wizard of Earthsea',
  'Simyacı': 'The Alchemist',
  'Yüzyıllık Yalnızlık': 'One Hundred Years of Solitude',
  'Kolera Günlerinde Aşk': 'Love in the Time of Cholera',
  'Dönüşüm': 'The Metamorphosis',
  'Dava': 'The Trial',
  'Şato': 'The Castle',
  'Yabancı': 'The Stranger',
  'Veba': 'The Plague',
  'Sisifos Söyleni': 'The Myth of Sisyphus',
  'Bulantı': 'Nausea',
  'Böyle Buyurdu Zerdüşt': 'Thus Spoke Zarathustra',
  'Sokrates\'in Savunması': 'The Apology of Socrates',
  'Devlet': 'The Republic',
  'Nikomakhos\'a Etik': 'Nicomachean Ethics',
  'Hükümdar': 'The Prince',
  'Denemeler': 'The Essays',
  'Küçük Prens': 'The Little Prince',
  'Sefiller': 'Les Misérables',
  'Notre Dame\'ın Kamburu': 'The Hunchback of Notre-Dame',
  'Monte Kristo Kontu': 'The Count of Monte Cristo',
  'Üç Silahşörler': 'The Three Musketeers',
  'Kırmızı ve Siyah': 'The Red and the Black',
  'Gurur ve Önyargı': 'Pride and Prejudice',
  'Uğultulu Tepeler': 'Wuthering Heights',
  'Büyük Umutlar': 'Great Expectations',
  'İki Şehrin Hikayesi': 'A Tale of Two Cities',
  'Moby Dick': 'Moby-Dick',
  'Define Adası': 'Treasure Island',
  'Denizler Altında Yirmi Bin Fersah': 'Twenty Thousand Leagues Under the Seas',
  'Seksen Günde Devri Alem': 'Around the World in Eighty Days',
  'Sherlock Holmes: Baskerville Tazısı': 'The Hound of the Baskervilles',
  'Doğu Ekspresinde Cinayet': 'Murder on the Orient Express',
  'On Küçük Zenci': 'And Then There Were None',
  'Gülün Adı': 'The Name of the Rose',
  'Ejderha Dövmeli Kız': 'The Girl with the Dragon Tattoo',
  'Da Vinci Şifresi': 'The Da Vinci Code',
  'Nutuk': 'The Great Speech',
  'Sapiens: İnsan Türünün Kısa Bir Tarihi': 'Sapiens: A Brief History of Humankind',
  'Tüfek, Mikrop ve Çelik': 'Guns, Germs, and Steel',
  'İnsanın Anlam Arayışı': 'Man\'s Search for Meaning',
  'Atomik Alışkanlıklar': 'Atomic Habits',
  'Hızlı ve Yavaş Düşünme': 'Thinking, Fast and Slow',
  'Beden Kayıt Tutar': 'The Body Keeps the Score',
};

const backfillEnglishTitles = () => {
  const update = db.prepare(`UPDATE books SET title_en = ? WHERE title = ? AND (title_en IS NULL OR title_en = '')`);
  const run = db.transaction(() => {
    for (const [tr, en] of Object.entries(TITLE_EN)) update.run(en, tr);
  });
  run();
};

const seedIfEmpty = () => {
  const count = db.prepare('SELECT COUNT(*) AS c FROM books').get().c;
  if (count > 0) return;
  const insert = db.prepare(`
    INSERT INTO books (title, author, genre, year, pages, rating, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction((books) => {
    for (const b of books) insert.run(...b);
  });
  insertAll(seedBooks);
  console.log(`${seedBooks.length} kitap veritabanına eklendi.`);
};

seedIfEmpty();
backfillEnglishTitles();

module.exports = db;
