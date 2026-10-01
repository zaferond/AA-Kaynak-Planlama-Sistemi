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

## Devam ölçümü — planlanan hücre kaydında ikinci okumanın kaldırılması

On beşinci adımda, yalnız `allocation` kayıtlarından oluşan `/api/changes` paketleri için yanıt aynı yazma işleminde hazırlanıyor. Bu seçim yeni bir yetki yolu değildir; aynı `applyChanges` şeması, yetki, revision, son veri doğrulaması ve audit kuralları çalışıyor. Karışık paketler ve diğer işlem türleri mevcut kayıt + yeniden okuma yolunda kalıyor.

`backend/change-service.mjs` yanıt yolunu seçiyor. `Store.projectView` hem normal okuma hem kayıt yanıtında aynı görünürlük kurallarını ve admin kullanıcı listesini kullanıyor. Admin olmayan kullanıcıya hesap listesi/arşiv veya yetki kapsamı dışındaki çalışan/takvim verileri eklenmiyor. Kullanıcı işlem kilidi altında veritabanından yeniden doğrulanıyor; generation yanıtı aynı commit'in numarası oluyor.

Değişmeyen proje/takım/çalışan verileri ilk SQL okumasının biçimiyle korunuyor; yalnız tahsis ve revision haritaları doğrulanmış sonuçtan alınıyor. Doğrulama eski metadata'yı normalize ettiyse aynı transaction içinde SQL'den tekrar okunuyor. Böylece veritabanına yansıyan varsayılanlar ile yanıtın farklılaşması önleniyor. Yanıt, adapter commit ve SQL.js dosya kaydı başarıyla bittikten sonra HTTP'ye veriliyor. Paylaşılan veri önbelleği veya istemci API değişikliği eklenmedi.

Yeni betikle eski ve yeni yanıt yolları sırayla, aynı veri boyutlarında tekrar ölçüldü. Varsayılan `--response=separate` önceki kayıt + ayrı view yolunu korur; yeni yol için `--response=planning` kullanılır:

```sh
npm run bench:store -- --response=separate --output=/tmp/aa-separate-new.json
npm run bench:store -- --response=planning --output=/tmp/aa-planning-new.json
```

Node 24.21.0, beş örnek, bir ısınma kaydı, 200 çalışan / 1.000 izin kaydı / sıfır başlangıç audit geçmişi. Ölçüm: 16:08 UTC (19:08 İstanbul). İki yol da aynı Store kaynak hash'iyle ölçüldü: `ad937539159ce091ada2c89b2a0e17a99fef37ce14ad69bebc5d1c1874ad438e`. Süreler yerel milisaniye medyanlarıdır; HTTP/ağ/MSSQL dahil değildir.

| Planlanan hücre | Ayrı view | İşlem içinde yanıt | Tam okuma süresi önce / sonra | Okunan SQL satırı önce / sonra | Yanıt boyutu, iki yolda aynı |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1.000 | 44,67 | 32,86 | 16,35 / 9,00 | 4.929 / 2.465 | 191.203 bayt |
| 10.000 | 165,60 | 117,46 | 98,54 / 49,36 | 40.937 / 20.469 | 764.447 bayt |
| 50.000 | 761,04 | 548,62 | 452,84 / 229,49 | 200.977 / 100.489 | 3.371.253 bayt |

Her veri boyutunda tam veri okuma **2'den 1'e** indi; yazılan satır sayısı **4**, yazma parametre boyutu **334 bayt** olarak kaldı. 50.000 hücrede bu deneyde toplam medyan yaklaşık **%27,9 azaldı**. Bu oran üretim/MSSQL hız garantisi değildir. Beş örneğin p95 değerleri sırasıyla 47,68 / 36,14; 180,05 / 123,17; 774,70 / 558,01 ms; üretim p95 tahmini olarak kullanılmamalı. Yanıt JSON serileştirme süresi bu tabloda toplam süreye dahil değil; 50.000 hücrede yaklaşık 18–19 ms ve ayrıca ölçülüyor.

### Doğrulama ve kalan maliyet

- Beş yeni regresyon testi: oluşturma/0/aynı değer/toplu kayıt/silme yanıtının fresh SQL view ile eşitliği ve bir okuma; manager kapsamı/yetkisiz/eski revision/kapalı hesap; karışık paketlerde SQL varsayılanları/geçersiz paketin atomikliği; eski metadata normalizasyonunda güvenli yeniden okuma; yanıt hazırlanmışken dosya commit hatasında yanıtın reddedilmesi ve yeniden açılışta tüm verinin korunması.
- SQL.js ve MSSQL için ortak HTTP eşzamanlılık suite'inde 24 kayıt yanıtının her biri kendi commit'inin generation/tahsis/revision görüntüsü olarak kontrol ediliyor. Native MSSQL ortamı yok; bu geliştirilmiş senaryo SQL.js üzerinde çalıştı.
- Mevcut istemci testleri eski yanıtların yeni görüntü/yetkileri geri almamasını, oturum değişimini ve kayıt/okuma sırasını doğrulamaya devam ediyor. İstemci sözleşmesi ve ön yüz değişmedi.
- `npm run verify`: **186/186** test; biçim, TypeScript ve üretim derlemesi başarılı.
- Tek tam veri okuması, tam veri kopyalama/doğrulama/diff ve tam JSON yanıt hâlâ mevcut. İlk sorguyu da daraltmak daha kapsamlı bir kayıt/yanıt sözleşmesi gerektiriyor. Sıradaki inceleme bu kalan maliyetleri ve özellikle iki katmanlı doğrulamanın sorumluluğunu ayırmak; yetki, FK, toplu işlem ve audit doğrulaması korunmalı.

## Devam ölçümü — API kayıtlarında tek son model doğrulaması

On altıncı adımda `applyChanges` iki sorumluluğa ayrıldı. `stageChanges` komut şemasını, yetkiyi, revision'ı ve aylık limitleri kontrol edip son taslağı ve türetilmiş yüzdeleri hazırlar. `/api/changes` bu işlevi yalnız `Store.mutate` içinde çalıştırır; Store son modelin tamamını **kaydetmeden önce bir kez** doğrular ve normalize eder. Veri bütünlüğü kontrolü kaldırılmadı, istemciden gelen bir doğrulama-atlama seçeneği eklenmedi.

`applyChanges` doğrudan çağrıldığında staging + tam doğrulama/normalizasyon yapmaya devam eder. Böylece transaction dışında bu fonksiyonu kullanan domain çağrıları aynı sözleşmeyi korur. Liderlik, import, restore gibi diğer endpoint'lerin akışları bu adımda değiştirilmedi. Planlanan hücreler aynı commit'ten yanıt almaya, diğer değişiklik paketleri mevcut SQL view yolunu kullanmaya devam ediyor.

Betik artık `--validation=double|single` ile eski ve yeni yolları aynı Store üzerinde ölçer. Varsayılan `single`, güncel API akışıdır. Önceki bölümlerin iki doğrulamalı sonuçlarını yeniden üretirken `--validation=double` seçilmeli. JSON çıktısına operations/service kaynak hash'leri ve global `structuredClone` çağrı sayısı/süresi eklendi; bu süre Zod'un şema parse sırasında yaptığı kopyalamaları kapsamaz.

```sh
npm run bench:store -- --response=planning --validation=double --output=/tmp/aa-double-new.json
npm run bench:store -- --response=planning --validation=single --output=/tmp/aa-single-new.json
```

Aynı sentetik boyutlar, beş örnek ve bir ısınma kaydı; Node 24.21.0 / SQL.js. Ölçümler 16:24–16:25 UTC (19:24–19:25 İstanbul). Store hash'i önceki bölümle aynı; operations hash'i `0343f1106bdc24afc2fa029179073105ba57cd8e78c076ee4e74cd03cb20b669`, service hash'i `5539af3b6309ed379284cbe4867b4bed6c1480adbe28ce5677258cb2fe3f80b1`. Süreler yerel milisaniye medyanlarıdır; HTTP/ağ/MSSQL dahil değildir.

| Planlanan hücre | Çift doğrulamalı kayıt + yanıt | Tek son doğrulama | Tam okuma önce / sonra | `structuredClone` önce / sonra |
| ---: | ---: | ---: | ---: | ---: |
| 1.000 | 36,54 | 28,67 | 8,93 / 8,07 | 1,08 / 1,06 |
| 10.000 | 117,72 | 100,52 | 48,35 / 49,72 | 6,99 / 7,07 |
| 50.000 | 545,02 | 459,66 | 228,13 / 234,71 | 42,58 / 38,69 |

50.000 hücrede bu deneyde toplam medyan yaklaşık **%15,7 azaldı**. Tam okuma ve `structuredClone` sayısı iki yolda da bir; yazılan satır dört, yazma parametre boyutu 334 bayt ve yanıt boyutu 3.371.253 bayt olarak kaldı. Önceki/yeni p95 örnek değerleri 1.000 hücrede 40,50 / 31,02; 10.000'de 119,97 / 111,72; 50.000'de 565,48 / 466,69 ms. Beş örnek üretim p95 veya MSSQL hız garantisi sağlamaz.

Eski komut fonksiyonu staging + tam doğrulama, yenisi yalnız staging yaptığı için `domainMs` farklı kapsamlar ölçüyor. Yeni 50.000 hücre ölçümündeki 0,08 ms **tam veri doğrulamasının süresi değildir**; Store'un tam son doğrulaması transaction süresinde kalıyor. İç içe ölçülen medyanlar toplanarak toplam hesaplanmamalı.

### Kopyalama ve doğrulama güvenliği

- Önceki görüntünün tam kopyası korundu. Takım liderliği değişince çalışan sürümleri yerinde güncelleniyor; audit ve persist'in eski iç içe değerleri görmesi gerekiyor. Sığ kopya bu değerleri de değiştirebilir. Yeni testte takım değişikliği çalışan revision'ını ilerletti ve audit'te eski/yeni `versions[0].lead` değerleri doğru çıktı. Yaklaşık 39 ms'lik kopyalama maliyeti, genel mutasyon sözleşmesi yeniden tasarlanmadan kaldırılmadı.
- Negatif/sınır üstü tahsis, proje dönemi dışı kaynak, boş proje adı, olmayan takım bağlantısı ve çakışan kritik tarih içeren altı paket reddedildi. Aynı paketin geçerli ilk hücresi de kaydedilmedi; persist hiç çağrılmadı, veri/generation/revision/audit korundu. Hatalar model/400 doğrulama hataları; SQL constraint'e bırakılmadı.
- Tek son doğrulama proje/sorumlu metnini temizledi, ay biçimindeki işbaşı/ayrılış tarihlerini güne çevirdi ve geçmiş çalışma dönemlerinin ayrılış bitişini eşitledi. Gelen komutlar değişmedi; dönen yanıt fresh SQL view ile aynı.
- Üç yeni regresyon testi ile `npm run verify`: **189/189** test; biçim, TypeScript ve üretim derlemesi başarılı. Gerçek SQL.js HTTP CRUD/eşzamanlılık suite'leri güncel service yolunu kullandı. Native MSSQL ortamı hâlâ gerekli.
- Kalan maliyet: tam okuma, bir tam kopya/son doğrulama, persist ve audit'in değişiklikleri ayrı taraması, tam JSON yanıt. Sıradaki inceleme persist/audit için değişiklik tespitini ortaklaştırmak. Yetki, normalizasyonun türettiği değişiklikler, revision ve atomiklik korunmalı.
