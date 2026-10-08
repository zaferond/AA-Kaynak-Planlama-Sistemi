# N3 — Büyük MSSQL kaynak haritalarında akışla okuma

## Başlangıç ve kapsam

8 Ekim 2026; başlangıç `f2f35ac95b57acf2526746ccbb7f64735827bb78`. Önceki metadata batch ve dar planlama taslağı/delta davranışı korunur. **N3 kısmen giderildi**; tam snapshot, tam doğrulama/diff ve global Shared/Exclusive kilit devam eder.

## Değişiklik

- Native transaction context artık `scan` sağlar. Tahsis, gerçekleşen tahsis, çalışma saati, gerçekleşen yüzde ve revision olmak üzere **beş büyük sayısal tablo** mevcut `readRecordMap` üzerinden doğrudan haritaya işlenir. MSSQL Request `stream=true`, `arrayRowMode=true` kullanır; SELECT sütun sırası korunur. Ara driver recordset listesi biriktirilmez. Nihai haritalar ve tam doğrulama kopyaları hâlâ bellektedir.
- SQL/parametre/scope, kilit, revision, audit, generation ve yetki kontrolleri değiştirilmez. Ordinary query ve scan parametre bağlama kodunu paylaşır. SQL.js ve scan sağlamayan context'ler mevcut davranışı korur. Metadata batch hâlâ kendi on küçük sonucunu buffer eder; bu aşama onu değiştirmez.
- Akış hatası ilk hata kimliğiyle saklanır. Mapper/sütun/satır hatası sorguyu iptal eder; sonraki satırlar tüketilmez. `mssql 12.7.2` akışında SQL hatası event üzerinden gelir ve query promise'i yine resolve olabilir: adapter bu hatayı ayrıca reddeder. Query tamamlanıp bağlantı bırakılmadan hata döndürülmez; rollback/sonraki sorguyla yarış önlenir. Kendi listener'ları finally'de kaldırılır. Eksik completion, yanlış/multiple recordset veya beklenmedik buffered sonuç reddedilir.
- Mevcut 45 saniye driver request timeout korunur; ayrı sonsuz bekleyen uygulama promise'i eklenmez. Raw adapter kullanıcı SQL arayüzü değildir; SELECT'ler sunucunun sabit sorgularından gelir. Başlangıç/tek statement kontrolü SQL parser veya kullanıcı SQL yetkilendirmesi olarak sunulmaz.
- Native ölçüm aracı scan çağrılarını SQL çağrı/satır toplamına bir kere dahil eder; yalnız sayı/zaman kaydeder, satır değerini/parametreyi tutmaz. Mevcut 16 senaryo/640 işlem yük profilinde her snapshot için 5 scan assert'i eklenir. Kaynak ve JSON eşitliği native testte ayrıca sınanır.

## Güvenli yerel doğrulama

HEAD Git arşivinden geçici dizin; kilit dosyalarından geçici `npm ci` ve temiz npm config/cache. Gerçek `.env`, DB, hesap veya çalışan servis kullanılmadı. SQL.js fixture'ları geçici ve sentetiktir. Driver unit testleri `_query`/transaction girişini bağlantıdan önce stub eder; gerçek Request promise/event davranışı çalışır, network açılmaz.

| Komut | Sonuç |
|---|---|
| `node --test tests/mssql-scan.test.mjs tests/mssql-batch.test.mjs tests/transaction-profile.test.mjs tests/read-records.test.mjs tests/planning-snapshot.test.mjs tests/planning-read-scope.test.mjs tests/snapshot-metadata.test.mjs tests/concurrency.test.mjs tests/store-persistence.test.mjs` | Son temiz kurulumda **84/84**; fail/cancelled/skipped 0 |
| `npm run format:check` | Başarılı |
| `npm run check:domain` | 35 shared kaynak için başarılı |
| `npm run build` | TypeScript/site derlemesi başarılı |
| `npm run deploy:verify` | Geçici kaynak/artifact hash'leri eşit |

İlk yerel denemelerde ölçüm hook'unun yanlış fonksiyona eklenmesi ve tekrar kurulan test mock'larının birbirine sızması bulundu; hook doğru scope'a taşındı, her test mock'u açıkça geri alındı. Yeni testler fail-closed scan/mapper/SQL/timeout/connection/cleanup/rollback davranışını kapsar. Mevcut üretim DB veya kodda bir hata olduğu iddiası değildir. İlk npm kontrolünde config çakışması ve eksik yerel TypeScript nedeniyle geçici ortam temiz kuruldu; bu sonuçlar başarılı test gibi sayılmadı.

## Native kabul ve kalan işler

Güncel commit için geçici SQL Server CI sonucu henüz bu ilk kayda eklenmedi; aşağıdaki native doğrulama tamamlanmadan yerel driver stubları gerçek MSSQL kanıtı sayılmaz. Native suite aynı transaction'da buffered/streamed snapshot + JSON, beş tablo satır sayısı, parametre/null/Unicode, gerçek iptal sonrası sorgu, SQL conversion hatasında mutation'ın başlamaması ve bağımsız havuzdan veri/audit korunmasını sınar. Windows kapısına scan testi eklenmiştir.

Ara listelerin kaldırılması kod ve driver contract üzerinden gözlemlenebilir; kesin heap/RSS azalması, istek başına tahsis veya üretim hızında yüzde kazanç iddiası yapılmaz. Native profildeki farklı CI runner süreleri kontrollü A/B değildir. Tam satır hacmi/validasyon/global lock, kullanıcı başına eşzamanlılık, N5 ağ süre sınırı/uzlaştırma, N6 eski asset yaşam döngüsü ve N2 backend Orta bağımlılık uyarısı ayrıca kalır. Kurum CA/proxy/TLS, asgari SQL yetkileri, Windows servis/ACL, kurum yedek kurtarma ve gerçek HTTP/WAN yük kabulü bu sentetik testlerle doğrulanmaz.
