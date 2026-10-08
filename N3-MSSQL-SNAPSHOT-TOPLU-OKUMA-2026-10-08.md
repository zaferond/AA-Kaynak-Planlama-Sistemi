# N3 — MSSQL snapshot okumalarında gidiş geliş sayısını azaltma

## Başlangıç ve karar

8 Ekim 2026; başlangıç **`369bd6d0dcbf42e4f78b748bb3a4286d52976c75`**. Önceki [dar taslak ve delta aşaması](N3-PLANLANAN-YAZMA-TASLAK-VE-DELTA-2026-10-08.md) korunur. **N3 kısmen giderildi.**

Tek hücre için yalnız tahsis/izin/proje tarihlerini okumak, mevcut tam doğrulamanın ilgisiz bozuk veriyi de reddetme davranışını korumuyor. Güvenilir bir snapshot geçerlilik işareti veya DB genelinde yeterli kısıtlar olmadan satırları atlayan hedefli yazmaya geçilmedi. Bu aşama tam snapshot'ın içerdiği satırları azaltmaz; SQL'e yapılan ayrı isteklerin sayısını azaltır. Global kilit ve tam doğrulama korunur.

## Dar değişiklik ve sınırlar

- `backend/snapshot-metadata.mjs`: ayarlar, liderlik, risk sistemi, takım, proje, risk, aşama, bar, çalışan ve çalışan sürümü için **10 sabit SELECT** tek katalogdadır. SQL.js/ordinary ve native batch aynı sorguları kullanır; sütun/sıra kuralları değiştirilmez.
- `backend/adapters/mssql.mjs`: transaction context'e `queryMany` eklendi. Aynı SQL transaction sahibinde tek driver `query` ile metadata okunur. Array/sonuç sayısı ve her recordset doğrulanır; eksik set veya SQL hatası kabul edilmiş snapshot oluşturamaz. Olağan `query`, yazma, SQL parametreleri, kilit modu/süresi ve commit/rollback kuralları korunur. Raw adapter bir kullanıcı SQL arabirimi değildir; batch yalnız sunucunun sabit kataloğundan üretilir.
- `backend/planning-reader.mjs`: yalnız `mssql` ve `viewUser` verilmeyen tam snapshot okumasında, context bu özelliği sağlıyorsa toplu okur. SQL.js ve kullanıcı kapsamlı view okumaları eski sırayla ilerler. Tahsis/actual/saat/yüzde/revision tabloları tam okunur; scoped okumalarda mevcut dar SQL filtresi devam eder.
- Snapshot başına 10 metadata SQL isteği **1** olur. Beş sayısal tabloyla tam snapshot okuması teorik **15 → 6** SQL isteğine iner; native eşdeğerlik ve ölçümde ayrıca doğrulanacaktır. Büyük sayısal tablolar batch'e alınmaz. Metadata satırları o snapshot içinde tüketilir; işlem/hesap/generation arasında cache yoktur.
- Metadata batch'i tüm metadata setlerini driver'dan birlikte alır; yüksek risk/bar/çalışan hacminde buffer bellek maliyeti dikkate alınmalıdır. Bu çalışma bellek azalması, SQL fiziksel IO veya üretim kapasitesi garantisi değildir.

## Güvenli doğrulama

Git HEAD'den geçici kaynak dizini, önceden temiz kurulmuş bağımlılıklar ve sentetik SQL.js verileri kullanıldı. Gerçek `.env`, çalışan DB/hesap ve servis kullanılmadı. MSSQL driver unit testinde `Request.query`/transaction metotları çağrıdan önce stub edilir; bağlantı açılmaz. Yerel fixture'ın takvimi değiştirilirken yüzdeler mevcut komutla yeniden hesaplanır; gerçek iş kuralı gevşetilmedi. SQL.js testleri gerçek MSSQL sonucu gibi sunulmaz.

| Komut | Sonuç |
|---|---|
| `node --test tests/snapshot-metadata.test.mjs tests/mssql-batch.test.mjs tests/transaction-profile.test.mjs tests/planning-snapshot.test.mjs tests/planning-read-scope.test.mjs tests/read-records.test.mjs tests/concurrency.test.mjs tests/store-persistence.test.mjs` | **75/75**, hata/atlama/iptal 0 |
| `npm run check:domain` | 35 shared kaynakta AST sınır kontrolü başarılı |
| `npm run build` | TypeScript/site derlemesi başarılı; son kaynak hash'leri tekrar doğrulanacak |
| `npm run deploy:verify` | Geçici build kaynak/artifact kontrolü başarılı |

Yeni testler tek batch/tek transaction sahibi, null/zero/Unicode, eksik recordset ve SQL hatası, tekrar/unknown sorgu, yeni snapshot'ta güncel değer, sırayla query fallback, tüm veri ve JSON eşitliği, rol kapsamları ve başarısız okumada komutun çalışmaması/audit/generation'ın korunmasını sınar. Windows kalite kapısına iki yeni test modülü eklendi. Profiler native request'in bütün seçeneklerini korur; metadata'nın tüm setlerini sayar, bir batch'i 10 ayrı roundtrip gibi raporlamaz.

Native suite'te gerçek iki havuzla ordinary ve batch snapshot/JSON eşitliği, sorgu içerik/sırası ve **15/6** sayıları kontrol edilecek; SQL conversion hatası ile mutation'ın hiç başlamadığı ve verinin/audit'in korunduğu sınanacak. Mevcut 16 senaryolu profil **640 işlem / 340 yazma** kalır. Planlanan/actual yazmada tek metadata batch, scoped okumada sıfır batch assert'i eklendi.

**Güncel native/kalite CI henüz bekleniyor.** Başarı yalnız ilgili commit, tüm kaynak hash'leri ve gerçek koşu sonucu üzerinden kaydedilecek. Önceki native/kalite başarısı yeni adapter davranışının kanıtı sayılmaz.

## Kalan işler

Tam satır hacmi, doğrulama/diff ve global lock maliyeti sürer. Sonraki N3 adımı ayrı geçerlilik/kısıt tasarımı veya büyük haritalarda native streaming olmalıdır; kullanıcı başına eşzamanlılık ve kurum gerçek yük ölçümü ayrıca değerlendirilir. N5 ağ süre sınırı/taslak uzlaştırma, N6 asset yaşam döngüsü ve N2 backend Orta bağımlılık uyarıları ayrı konulardır. Asgari SQL yetkileri, kurum CA/proxy/TLS/Windows servis, kurum yedek/restore ve gerçek yük bu sentetik çalışmayla kapanmaz.
