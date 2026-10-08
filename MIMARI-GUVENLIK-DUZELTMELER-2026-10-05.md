# 5 Ekim 2026 — Y1–Y3 düzeltmeleri ve ek özellikler

## Durum

**7 Ekim güncellemesi:** Y4 de yerel hedefli kontrollerle tamamlandı. Güncel kanıt ve kalan sıra: [7 Ekim Y4 kaydı](MIMARI-GUVENLIK-DUZELTMELER-2026-10-07.md). Aşağıdaki Y1–Y3 bölümleri önceki çalışmanın kaydıdır.

Başlangıç raporu: [5 Ekim incelemesi](MIMARI-GUVENLIK-INCELEME-2026-10-05.md). Temel Git HEAD `05b99e5556aaa7e472e99923f492fc37eab3487f`, `main`; düzeltmeler çalışma ağacındadır. Bu çalışmada commit/push yapılmadı. Önceki renk paleti ve seçim kutusu değişiklikleri korundu.

**Y1, Y2 ve Y3 yerel hedefli testlerle düzeltildi ve doğrulandı.** Eşzamanlı veri yenilemesinde eski aralık/not indeksiyle güncel revision kullanılması önlendi. Excel yazıcısı geçersiz XML karakterlerini açık hatayla reddediyor. Mimari kapısı artık alt klasörleri ve farklı import biçimlerini sözdizimi ağacı üzerinden denetliyor. Y4–Y6 bu çalışmayla kapanmış sayılmaz.

## Y1 — Değişiklik ve kanıt

- `frontend/src/features/project-snapshot.ts` etkileşimin başladığı proje kopyası ile revision'ı birlikte tutar.
- `useProjectMenus.ts` ve `project-clipboard.ts` renk kopyalama/yapıştırma için menü açılış değerlerini kullanır. Uzak ekleme sonrası eski menüden kayıt HTTP 409 ile reddedilir; uzak veriler korunur. Güncel hedefin menüsü yeniden açılınca doğru bara HTTP 200 ile kayıt yapılır.
- `useMilestoneDrag.ts` pointer-down anında proje/revision, başlık ve dönemleri yakalar. Aylık bar/baklava ve haftalık not hareketleri ile her iki uçtan boyutlandırma bu kopyadan doğrulanır ve kaydedilir.
- `MilestoneTrack.tsx` hareket sırasında eski indeksli yerleşimi korur. Uzak aralık/not eklemesi önizlemeyi başka hedefe taşımaz. Hareket sırasında bağlam menüsü ve yenileme sonrası eski hedefe tıklama engellenir.
- `project-timeline-types.ts`, `ProjectTimelinePanel.tsx`, `ProjectTimelineRows.tsx`, `App.tsx` ve `workspace/project-actions.ts` açılış çiftini kayıt komutuna kadar taşır. Komut hazırlayıcı son snapshot'tan revision devralmaz; mevcut sunucu optimistic locking kontrolü belirleyicidir.

Yeni kaynak regresyonu `tests/project-interaction-concurrency.test.mjs`, renk/tarih komutlarının eski sürümü koruduğunu ve silinen projenin eski komutla geri getirilemediğini denetler. Yeni `scripts/browser-checks/timeline-concurrency.mjs` iki sentetik admin ile gerçek HTTP üzerinden araya aralık/not ekler; önizleme, gönderilen revision, 409, uzak verilerin korunması ve normal 200 akışını denetler. Tam tarayıcı koşusuna eklendi; **GitHub CI bu tur çalıştırılmadı**.

DB şeması, migration, yetki veya kalıcı aralık/not kimliği değiştirilmedi. Büyük proje kopyasının performansı gerçek yükle ölçülmedi; kopya yalnız etkileşim başlangıcında alınır.

## Kullanıcının ek kaynak talepleri

1. Takım → Projeler özetindeki **Tüm Projelere Tahsis**, **Dağıtılan Kaynak** oldu. Hesaplama kapsamı değişmedi.
2. Tekil kaynak formunda Aktif İlan/Pasif İlan statülerinin tarih etiketi **Tahmini İşbaşı Tarihi** oldu. Diğer statüler **İşbaşı Tarihi** kullanır; mevcut boş tarih/1 Ocak varsayılanları ve kayıt alanı korunur. Toplu formdaki ilgili açıklama güncellendi.
3. Yalnız **Aylık Ortalama Çalışan Sayısı ve Öngörü** grafiğinde tarihli Aktif İlan, dahil seçeneğinden bağımsız öngörüye katılır. Planlanan kapasite ve Aktif Kaynak tabloları dahil koşulunu korur. Tarihsiz ve Pasif İlan katılmaz. Takım/liderlik, geçerli statü ayı, kısmi ay ve tarih sınırları korunur. Mevcut grafik gibi yalnız gelecek aylar öngörü olarak hesaplanır; geçmiş/bugünkü ayların çalışan ortalamasına ilan eklenmez.

## Çalıştırılan kontroller

Geçici kaynak/dependency kopyası, Node 24.21.0, SQL.js için teste ait geçici dosyalar ve ayrı headless Chrome bağlamları kullanıldı. `.env`, gerçek kullanıcı hesabı ve çalışan DB testlerde kullanılmadı.

| Komut/kapsam | Sonuç |
|---|---|
| `node --test tests/headcount-trend.test.mjs tests/active-resource-scenarios.test.mjs tests/resource-dates.test.mjs tests/project-interaction-concurrency.test.mjs tests/project-timeline-commands.test.mjs tests/project-clipboard.test.mjs tests/milestone-mixed-details.test.mjs tests/milestone-point.test.mjs` | **52/52 geçti**; dahil aç/kapa, gün ağırlığı, statü/filtre sınırları ve revision koruması dahil. |
| `node node_modules/typescript/bin/tsc --noEmit` (`frontend` içinde) | Geçti. |
| `node frontend/build.mjs` | Üretim derlemesi geçti; yalnız geçici çıktı klasörlerini yazar. |
| Geçici runner: `checkTimelineConcurrency` + `checkMilestoneReportMenu` + `checkMilestoneOverlap` | **31/31 tarayıcı kontrol grubu geçti**, page error yok. Aralık ve aynı aralıktaki not eklemeleri dahil. |
| Geçici runner: `checkHeadcountForecast` | **2/2 geçti**, page error yok. Tarih etiketleri, varsayılanlar ve aynı ilanla öngörü/kapasite ayrımı denetlendi. Test verileri koşu sonunda silindi. |
| `git diff --check` | Geçti. |
| `node scripts/verify-deployment.mjs` | Geçti; kaynak/çıktı hash farkları boş. |

Derlenmiş HTML ve aktif JS/CSS varlıkları Git kökü ile çalışan üst klasöre aktarıldı. `http://localhost:3000` üzerinden yalnız herkese açık HTML/statik varlıklar okunup yeni çıktıyla birebir karşılaştırıldı. Backend yeniden başlatılmadı; gerçek DB'ye kayıt, migration veya restore uygulanmadı.

Tarayıcı kanıt dosyaları: `aa-browser-checks-WQHLOI/result.json` (31 grup) ve `aa-browser-checks-Ex3sx1/result.json` (2 grup), işletim sisteminin geçici klasöründe. İş verisi/parola/token rapora konmadı.

## Y2 — Excel XML karakter doğrulaması

**Başlangıç kanıtı:** Düzeltme öncesi yazıcıyla yalnız sentetik U+FFFE metni içeren XLSX üretildi. Python `zipfile` ve `xml.etree.ElementTree` ile paket parçaları ayrıştırıldı; `xl/worksheets/sheet1.xml` için `not well-formed (invalid token)` hatası yeniden görüldü. Bu yeniden üretim veri tabanı veya gerçek kullanıcı kullanmadı.

**Dar değişiklik:** `frontend/src/xlsx-cells.ts` ortak XML yazıcısı, [W3C XML 1.0 §2.2](https://www.w3.org/TR/xml/#charsets) karakter aralığı dışında kalan kontrol karakterlerini, eşleşmemiş UTF-16 surrogate değerlerini ve U+FFFE/U+FFFF'yi reddeder. Önceki sessiz kontrol karakteri silme kaldırıldı. Hata, `Excel'e aktarılamayan karakter (U+....) bulundu. İlgili metni düzeltip tekrar aktarın.` şeklindedir; kaynak metin hata mesajına konmaz. Türkçe, geçerli Unicode çiftleri/emoji, sekme, CR/LF ve XML'de geçerli sınır karakterleri korunur. Hücre/satır sınırları ve inline string ile formül ayrımı değiştirilmedi.

Yedi çıktı yazıcısı ve workbook metadata/sheet adları aynı yardımcıyı kullanır. Geçersiz kayıt çıktı oluşturulmadan hata verir; veritabanındaki metin değiştirilmez. İlgili kayıt kullanıcı tarafından düzeltildikten sonra aktarım yapılabilir. Ham dahili XML/stil dizgileri için genel bir dış XML doğrulayıcısı eklenmedi; bu düzeltme incelenen kullanıcı metni yollarını kapsar.

| Y2 komutu/kapsamı | Sonuç |
|---|---|
| `node --test tests/xlsx-xml-characters.test.mjs tests/xlsx-cell-limits.test.mjs tests/xlsx-workbook.test.mjs tests/risk-export.test.mjs tests/project-info-report.test.mjs` | **21/21 geçti.** Yeni testler 35 yasak karakter sınırını, bozuk çiftleri, hata mesajında içerik bulunmamasını, geçerli Unicode/CR/LF ve kayıpsız devam satırlarını, yedi yazıcı ve metadata yollarını kontrol eder. |
| Geçici runner: `checkExcelXmlCharacters` | **3/3 tarayıcı kontrol grubu geçti**, page error yok. Gerçek DOMParser ile Unicode round-trip ve yedi workbook'un tüm XML parçaları; sentetik normal kullanıcının kayıtlı U+FFFE riskinde görünür hata/indirme ve POST olmaması; düzeltilmiş metnin kayıpsız inline string çıktısı denetlendi. |
| `node node_modules/typescript/bin/tsc --noEmit` (`frontend` içinde) | Geçti. |
| `node frontend/build.mjs` | Geçici kaynak kopyasında üretim derlemesi geçti. |

Testler Node 24.21.0, geçici SQL.js ve ayrı headless Chrome bağlamlarında çalıştı. Gerçek hesap, `.env` veya çalışan veritabanı kullanılmadı. Kanıt dizini `aa-browser-checks-miOImd/result.json`; dosyalar sentetiktir ve işletim sisteminin geçici dizinindedir.

Yeni tarayıcı kontrolü tam koşuya, XML karakter ve hücre sınırı kaynak testleri Windows kalite işine eklendi. **Tam tarayıcı koşusu, GitHub CI/Windows ve Microsoft Excel uygulamasında açma bu tur çalıştırılmadı.** XML'in ayrıştırılabilmesi Native Excel'in tüm görünüm/uyumluluk davranışlarını doğrulamaz.

Y2 derlemesi Git kökü ve çalışan üst klasörün HTML/aktif varlıklarına aktarıldı; yalnız ilgili arayüz kaynakları eşitlendi. `http://localhost:3000` herkese açık HTML/JS/CSS karşılaştırması geçti ve aktif JS içinde yeni hata metni doğrulandı. `node scripts/verify-deployment.mjs` **`ok: true`**, kaynak ve çıktı fark listeleri boş; `git diff --check` geçti. Backend yeniden başlatılmadı; gerçek DB'ye yazma yapılmadı. Açık tarayıcı sekmesinin yenilenmesi gerekir; mevcut kullanıcı taslağını korumak için otomatik yenileme yapılmadı.

## Sıradaki işler

1. **Y6:** Çalıştırma/Git dağıtım köklerini ve başlatıcıları tutarlı kabul akışıyla doğrulama.
2. **Y5:** Güncel Native MSSQL/Windows CI ve kurum TLS, yedek/restore, gerçek yük kabul kanıtı. Bunlar yerel Chrome/SQL.js testlerinden çıkarılamaz.

## Y3 — Domain bağımlılık kapısı

Önceki kontrolün üst klasör dışını kaçırması geçici `shared/y3-nested-probe/reverse.ts` içindeki backend re-export'u ile yeniden üretildi: eski CLI hatalı bağımlılığa rağmen 0 döndü. Geçici dosya silindi; uygulama/DB çalıştırılmadı.

`scripts/domain-boundaries.mjs` TypeScript 5.9.3 ayrıştırıcısıyla `shared/` ağacının TS/TSX/MTS/CTS/JS/JSX/MJS/CJS dosyalarını okur. Statik, type-only ve yan etki import'ları, re-export, import type, import-equals, dinamik import, require/require.resolve/module.require ve triple-slash referansları denetlenir. Shared dışına çıkan göreli yollar, platform/paket/alias bağımlılıkları, hesaplanan import hedefleri, ayrıştırma hataları ve sembolik bağlantılar reddedilir. Yalnız mevcut şema kütüphanesi `zod` açıkça izinlidir; `node_modules` ve `.git` altına erişim kabul edilmez. Yorum/metin içindeki import benzeri ifadeler ihlal sayılmaz.

`scripts/check-domain.mjs` önce bu salt okunur kontrolü çalıştırır; ihlal varsa domain modülünü yüklemeden durur. Kontrol temizse mevcut domain smoke kontrolü çalışır. Ayrıştırıcı root geliştirme bağımlılığıdır; root `npm ci` sonrasında frontend paketleri kurulmadan mimari kontrol yapılabilir. Windows kalite işine yeni regresyon testi eklendi; mevcut Ubuntu test glob'u da testi kapsar.

| Doğrulama | Sonuç |
|---|---|
| `node --test tests/domain-boundaries.test.mjs tests/domain.test.mjs` | **39/39 geçti**: 23 bağımlılık kapısı + 16 domain testi; hatalı CLI fixture'ındaki tripwire çalışmadı. |
| `node scripts/check-domain.mjs` | Yeni risk katalog modülleri dahil **33 kaynak dosyasında geçti**. |
| Risk kataloğu dahil son hedefli kaynak/SQL.js regresyonları | **99/99 geçti**; komut ve kapsam [katalog kaydında](RISK-SISTEM-KATALOGU-2026-10-05.md). |

Testler geçici kaynak kopyasında ve Node 24.21.0 ile çalıştı. Kapı bir kod sandbox'ı değildir: eval, yükleyici alias'larının veri akışı ve tüm global yan etkilerin analizi kapsam dışıdır. Zod'un transitif bağımlılık denetimi de bu kapının görevi değildir. Windows/native CI bu tur çalıştırılmadı; Y5 açık kalır.

## Ek talep — Risk Sistem / Alt Sistem kataloğu

Excel'deki 75 adla başlangıç kataloğu, Risk Ekle yanındaki yönetim düğmesi ve risk hücresindeki seçim listesi eklendi. Ortak `useDirectoryEditor` kullanıldı; admin yetkisi, sabit ID, revision, bağlı risk adını güncelleme, kullanılan tanımı silmeme ve eski metni koruma davranışları hedefli SQL.js/HTTP ve tarayıcı testleriyle doğrulandı. Şema 31 ve çalışan uygulamaya aktarma durumu [ayrı özellik kaydında](RISK-SISTEM-KATALOGU-2026-10-05.md).
