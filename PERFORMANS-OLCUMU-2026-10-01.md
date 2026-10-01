# Veri kayıt katmanı ölçümü — 1 Ekim 2026

## Kapsam ve yöntem

Ölçüm, mevcut hücre kayıt yolundaki `Store.mutate` ve ardından gelen `Store.view` çağrılarını kullanır. Her veri boyutunda bir ısınma kaydı ve beş ölçülen kayıt çalıştırıldı. Tek planlanan kaynak hücresi 0,25 / 0,50 arasında değiştirildi. Yanıtın `JSON.stringify` süresi ayrıca ölçüldü; aşağıdaki kayıt + yanıt hazırlığı süresine dahil değildir.

- Node: **24.21.0**, yerel SQL.js. HTTP, ağ ve tarayıcı süreleri ölçülmedi.
- Sentetik 200 çalışan, mevcut katalog takımları, 48 ay ve 1.000 kişisel izin kaydı. Proje sayısı hedef dağıtım sayısına göre oluşturuldu. Başlangıç audit geçmişi sıfır; her hücre kaydı bir olay ekledi.
- 1.000, 10.000 ve 50.000 planlanan dağıtım hücresi; her hücrenin revision kaydı mevcut.
- Veritabanları sistemin geçici dizininde oluşturulup temizlendi. Betik `.env` yüklemez ve veritabanı yolu/provider seçeneği almaz. Gerçek kullanıcı verileri ölçümlere dahil edilmedi.
- Önceki kod: `c97f021`, `backend/store.mjs` SHA-256: `51dcf7339d668d18641b29fd479c65211ac26d5b4709d8d135a976b0011a161a`.
- Güncellenen Store SHA-256: `afe7b7df5a6e04cc9bb3285cd6095d277a6dabdf62848757b9c48f0879452439`.
- Ölçüm zamanı: önce 13:40 UTC, sonra 13:44 UTC. Her iki seri aynı bilgisayarda ve aynı sentetik veri boyutlarında çalıştı.

Tekrar çalıştırmak için:

```sh
npm run bench:store -- --sizes=1000,10000,50000 --samples=5 --calendar-days=1000 --audit-events=0 --output=/tmp/aa-store-new-result.json
```

Çıktı yolu mevcut bir dosyayı ezmez. JSON çıktısı ham örnekleri, kaynak dosyanın hash değerini, SQL satır/yazma sayaçlarını ve aşama sürelerini içerir. İsteğe bağlı `--audit-events` büyük geçmişle ayrı bir deney için kullanılabilir; aşağıdaki sonuçlar böyle bir deneyi kapsamaz.

## Sonuçlar

Süreler milisaniye cinsinden medyandır.

| Planlanan hücre | Kayıt + yanıt önce | Kayıt + yanıt sonra | İki veri okuma önce | İki veri okuma sonra | DB boyutu |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1.000 | 53,26 | 44,19 | 17,49 | 16,49 | 569.344 bayt |
| 10.000 | 168,81 | 168,97 | 101,68 | 99,64 | 2.179.072 bayt |
| 50.000 | 796,78 | 792,26 | 460,76 | 460,17 | 9.601.024 bayt |

**Büyük veri setinde toplam kayıt süresi belirgin biçimde iyileşmedi.** Gereksiz yazmalar kaldırıldı; tam veri okuma maliyeti devam ediyor. Beş örnek, güvenilir üretim p95 veya kapasite hesabı için yeterli değildir. Örneğin 50.000 hücrede örnek p95 önce 816,82 ms, sonra 871,56 ms; bu sonuçlardan gecikme iyileşme yüzdesi çıkarılmamalı.

| Tek hücre kaydı | Önce | Sonra |
| --- | ---: | ---: |
| `Store.read` çağrısı | 2 | 2 |
| Okunan SQL satırı, 50.000 hücre | 200.977 | 200.977 |
| Yazılan liderlik satırı | 7 | 0 |
| Yazılan tahsis / revision / audit / settings satırı | 1 / 1 / 1 / 1 | 1 / 1 / 1 / 1 |
| Toplam değiştirilen satır | 11 | 4 |
| Yazma SQL parametrelerinin JSON byte uzunluğu | 82.103 | 334 |

Parametre ölçümü ağ trafiği, SQL günlük dosyası veya disk yazma miktarı değildir. Bu sentetik takvimde yaklaşık %99,6 daha az yazma parametresi taşınıyor; SQL.js veritabanı dosyasının tamamını kaydetmeye devam ediyor. Satır sayısı, yalnızca bu tek hücre senaryosundaki gerçek SQL değişiklik sayısıdır.

## Bulgular ve yapılan değişiklikler

1. **Tam veri iki kez okunuyor.** Mutasyon tüm veri modelini okuyup kopyalıyor; kayıt sonrası yanıt için `view` tekrar okuyor. 50.000 hücrede okumalar yaklaşık 460 ms, tüm zincir yaklaşık 792 ms. Bu süreler iç içe ölçülür; `read`, `persist`, domain ve export medyanları birbirine eklenerek toplam hesaplanamaz.
2. **Değişmeyen liderlikler yeniden yazılıyordu.** Artık yalnızca yeni liderlik veya değişen yönetici adı upsert ediliyor. Yeni liderlikler bağlı takım/çalışan satırlarından önce yazılıyor; hesap bağlantısı kontrolleri ve silme sırası korunuyor.
3. **Değişmeyen takvim ve arşiv JSON alanları yeniden gönderiliyordu.** Artık yalnızca değişen `legacy_archive`, `calendar_days`, `person_calendar` kolonları parametreli UPDATE'e dahil. Kolon listesi sabit; kullanıcı girdisi SQL kolon adı olamaz. `generation` her başarılı mutasyonda ilerlemeye devam ediyor.
4. **Restore sırasında opsiyonel arşiv temizlenmiyordu.** Yedekte arşiv yoksa `Object.assign` mevcut arşivi koruyordu. Geçerli yedek tamamen doğrulandıktan sonra, yedekte bulunmayan arşiv artık temizleniyor. Geçersiz yedek mevcut veriyi değiştirmiyor; eski yedek migrasyonunun ürettiği arşiv korunuyor.
5. **Güvenlik ve atomiklik mekanizmaları korundu.** Yetki/oturum kontrolleri, revision çatışmaları, audit, SQL.js rollback/disk kayıt düzeni ve MSSQL işlem kilidi kaldırılmadı. Şema değişikliği yapılmadı. SQL.js ölçümlerinde işlem başına iki DB export çağrısı mevcut; büyük audit geçmişindeki disk maliyeti ayrıca ölçülmeli.

## Doğrulama

- Dört yeni persistence testi: tek hücre/değişmeyen değer, yalnız değişen JSON kolonları ve restore temizliği, liderlik yazma/FK sırası, settings yazıldıktan sonra yapay hata ve yeniden açılışta tam rollback.
- Bir yeni domain testi: arşivin yokluğu/mevcudiyeti, geçersiz yedekte mevcut arşivin korunması, kaynak yedeğin değişmemesi.
- Hedefli persistence + restore + HTTP eşzamanlılık kontrolleri: **20/20**.
- `npm run verify`: **181/181** test; biçim kontrolü, TypeScript ve üretim derlemesi başarılı.
- Gerçek MSSQL performansı veya native MSSQL entegrasyon sonucu raporlanmıyor; ayrı test sunucusu hâlâ gerekli.

## Sıradaki teknik iş

En büyük maliyet tam veri okuması olduğu için sıradaki inceleme, planlanan hücre kaydının sorgu ve yanıt kapsamını daraltmak. Önce mevcut endpoint sözleşmesi ve istemcinin tam snapshot ihtiyacı belirlenmeli. Hedefli okuma; takım/proje yetkisi, revision, referans bütünlüğü, toplu kayıt atomikliği, audit ve generation kontrollerini korumalı. Gerçekleşen kaynak, takvim ve restore yolları daha geniş ortak kontroller gerektirdiğinden ayrı değerlendirilmelidir.

Global işlem kilidini kaldırmak veya tam snapshot'ı önbelleğe almak bu ölçümün sonucu olarak uygulanmadı. Çok sunuculu tutarlılık ve MSSQL davranışı ayrı ortamda doğrulanmadan bu karar verilemez. Audit saklama/arşivleme politikası da ayrıca açık.
