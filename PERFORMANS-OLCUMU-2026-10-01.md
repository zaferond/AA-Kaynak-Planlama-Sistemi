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


## Devam ölçümü — persist ve audit için tek kayıt farkı

On yedinci adımda `dataChanges` doğrulanmış tam görüntülerin eski/yeni kayıt farkını üretir. Persist bu sonucu SQL işlemlerine dönüştürür ve aynı sonucu audit'e verir. Sayısal hücreler aynıysa JSON serileştirme yapılmaz; audit yalnız aday değişikliklerin temizlenmiş alanlarını inceler. Kişisel açıklamalar/notlar audit'ten çıkarılmaya devam eder. Revision-only değişiklikler bu kayıt farkına dahil değildir; mevcut revision/generation yazımı devam eder.

Ölçüm, önce `998526d` kaynaklarıyla 16:37 UTC (19:37 İstanbul), sonra yeni kaynaklarla 16:56 UTC (19:56 İstanbul) yapıldı. Aynı bilgisayar, Node 24.21.0, geçici SQL.js, 200 çalışan, 48 ay, 1.000 izin kaydı, sıfır başlangıç audit geçmişi, beş örnek ve bir ısınma kaydı. Zaman ve çalışma ortamı değişkenliği sonuçları etkileyebilir. Ölçümler HTTP/ağ/native MSSQL içermez.

```sh
npm run bench:store -- --response=planning --validation=single --output=/tmp/aa-shared-diff-new.json
```

| Planlanan hücre | Önce kayıt + yanıt | Ortak fark ile | Tam okuma önce / sonra | Tam kopya önce / sonra | Yanıt boyutu, aynı |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1.000 | 28,21 ms | 29,90 ms | 8,28 / 8,76 ms | 1,14 / 1,14 ms | 191.203 bayt |
| 10.000 | 109,57 ms | 100,89 ms | 52,12 / 54,68 ms | 7,65 / 7,80 ms | 764.447 bayt |
| 50.000 | 462,44 ms | 418,41 ms | 233,57 / 229,08 ms | 44,48 / 41,83 ms | 3.371.253 bayt |

50.000 hücrede bu deneyde yaklaşık **%9,5 azalma**; küçük veri setinde belirgin iyileşme yok. Önce/sonra p95 örnekleri 1.000'de 32,83 / 32,61; 10.000'de 126,25 / 105,24; 50.000'de 468,92 / 426,35 ms. Beş örnek üretim p95/kapasite hesabına yeterli değildir. JSON yanıt serileştirmesi toplam zincirden ayrı ölçülür; büyük durumda yaklaşık 19 ms.

Her boyutta tam okuma ve `structuredClone` sayısı bir; okunan SQL satırları sırasıyla 2.465 / 20.469 / 100.489. Tahsis/revision/audit/settings satırlarının her birinden bir yazılıyor (toplam dört), yazma parametrelerinin JSON boyutu 334 bayt. Yeni betik yalnız fark sayısını raporlar: bu senaryoda `allocation: 1`, diğer kayıt türleri `0`. Ham farktaki kimlikler, açıklamalar veya özel metinler ölçüm çıktısına konmaz.

Persist süresi önce 1,66 / 8,28 / 40,49 ms, sonra 3,05 / 7,19 / 31,94 ms. **Faz kapsamı değişti:** yeni persist takvim/kişisel gün farkını da üretir; önceden bu audit sırasında taranıyordu. Bu değerler saf SQL süresi değildir; iç içe medyanları toplayarak toplam hesaplanmamalı. Yeni betiğin fark sayısı ölçümünün de küçük ek maliyeti var.

### Kaynak izlenebilirliği ve doğrulama

- Eski Store SHA-256: `ad937539159ce091ada2c89b2a0e17a99fef37ce14ad69bebc5d1c1874ad438e`; eski audit: `fbdd4b68963de859db3410780e78e870feadbcbb3eb3e60ec18d20ce5d37cf0e` (baseline commit'ten). Önceki JSON'da audit hash alanı yoktu.
- Yeni Store: `970ed8f6733ee3009d3d032a31c44302fb7e6b2437344d559cd0ac42ab6ed880`; audit: `65505c4d3047aee1c845672c1eedd9a6c066ba426d3bf3a6ea44687a4df86905`; change-set: `e9fcecc9129c6d7d4f1526f16e43d4be8e820056c788ffcfb0d54628cb0733fe`.
- Operations/service kodları önceki ölçümle aynı. Ham sentetik sonuçlar yerelde `/tmp/aa-shared-diff-before-20261001.json` ve `/tmp/aa-shared-diff-after-20261001.json` dosyalarında; geçici dosyalar kalıcı raporun parçası değildir.
- Beş yeni regresyon testi ile **194/194** test, biçim, TypeScript ve üretim derlemesi başarılı. Audit'e hazır fark verildiğinde tüm allocation haritasının yeniden taranmadığı, özel metinlerin kaydedilip audit'e alınmadığı, bağlantılı silmelerin ve `constructor` kimlikli proje CRUD işlemlerinin doğruluğu kontrol edildi. Mevcut rollback/eşzamanlılık/snapshot/restore kontrolleri geçti.
- Metadata kayıt isimleri ve hesap audit'i için ayrı indeksler, revision/settings karşılaştırması, tam model doğrulaması/kopyası ve tam JSON yanıt devam ediyor. Tam okuma büyük ölçümün yaklaşık 229 ms'sini oluşturuyor; native MSSQL sonuçları ve daha geniş veri/audit profilleri ayrıca gerekli.


## Devam ölçümü — yoğun gerçekleşen veri ve uzun işlem geçmişi

### Profil ve ölçüm kapsamı

Node 24.21.0 / SQL.js, aynı bilgisayar, her profilde bir ısınma kaydı ve **yedi örnek**. Önceki backend kaynakları `abc9835`; her iki ölçümde de aynı genişletilmiş benchmark betiği kullanıldı. Önce 18:05 UTC (21:05 İstanbul), sonra 18:10–18:11 UTC (21:10–21:11 İstanbul), 1 Ekim 2026. Profiller aynı anda değil, sırayla çalıştırıldı. Canlı veritabanı veya `.env` kullanılmadı.

| Profil | Planlanan hücre | Gerçekleşen hücre | Çalışan | Kişisel izin kaydı | Başlangıç audit kaydı |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 50.000 | 0 | 200 | 1.000 | 0 |
| B | 50.000 | 0 | 200 | 1.000 | 50.000 |
| C | 100.000 | 50.000 | 2.000 | 10.000 | 50.000 |

Planlanan veri 48 aya yayılıyor; gerçekleşen veri Ocak–Eylül 2026'da oluşturuluyor. Sentetik gerçekleşen toplamları sınır altında tutuluyor. Audit UUID'leri rastgele üretildiğinden aynı satır sayısında B-tree/dosya yerleşimi ve dosya boyutu az miktarda farklı olabilir. Sonuçlar gerçek veri şekli, makine yükü, audit metin uzunluğu veya ağ maliyetini temsil etmez.

Yeni profil seçenekleri ile güncel ölçümler tekrar çalıştırılabilir (çıktı dosyaları yeni olmalı; mevcut dosya üzerine yazılmaz):

```sh
npm run bench:store -- --sizes=50000 --samples=7 --resources=200 --actuals=0 --calendar-days=1000 --audit-events=0 --response=planning --validation=single --output=/tmp/aa-profile-a-new.json
npm run bench:store -- --sizes=50000 --samples=7 --resources=200 --actuals=0 --calendar-days=1000 --audit-events=50000 --response=planning --validation=single --output=/tmp/aa-profile-b-new.json
npm run bench:store -- --sizes=100000 --samples=7 --resources=2000 --actuals=50000 --calendar-days=10000 --audit-events=50000 --response=planning --validation=single --output=/tmp/aa-profile-c-new.json
```

Eski sonuçları yeniden üretmek için genişletilmiş betik ayrı `abc9835` çalışma kopyasında kullanılmalı; canlı kaynakları/veritabanını geri almak gerekmez. Betiğin eski commit'teki sürümü yeni çalışan/gerçekleşen seçeneklerini tanımaz. Ölçüm Store zincirini kullanır; HTTP, ağ, tarayıcı çizimi ve native MSSQL içermez.

### Yapılan değişiklikler

1. SQL.js satır çözümlemesinde prepared statement'ın sütun adları bir kez alınıyor. Önce `getAsObject` her satırda sütun adlarını yeniden okuyor/çözümlüyordu (kurulu sql.js kaynağında doğrulandı). Satır değerleri her step'te yeniden okunuyor; auth/veri sonucu önbelleği eklenmedi. SQL, sorgu kapsamı ve seçilen satırlar aynı.
2. Açıkça boş gerçekleşen ay kapsamı için aylık toplam indeksi hazırlanmıyor. Planlanan kayıt bu küme boş olduğu için gereksiz 50.000 gerçekleşen hücre taraması yapıyordu. Restore'un kapsamsız tam kontrolü ve dolu kapsamın hesapları korunuyor; son model doğrulaması Store içinde devam ediyor.
3. Ölçüm betiği SQL tablosu başına raw okuma süresini, satırı ve çağrıyı; geçici veritabanı dosyasının open/write/sync/close/rename toplamını ayrı kaydediyor. Bunlar iç içe fazlar; medyanlar toplanarak toplam hesaplanamaz. Dosya commit ölçümü DB export süresini kapsamaz. Diğer dosyalar bu ölçüme dahil edilmez.

### Yerel sonuçlar

| Profil | Önce kayıt + yanıt | Sonra kayıt + yanıt | Medyan azalma | Tam okuma önce / sonra | Komut hazırlama önce / sonra | JSON serileştirme önce / sonra |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 424,91 ms | 328,41 ms | %22,7 | 232,14 / 128,78 ms | 0,11 / 0,08 ms | 19,26 / 19,70 ms |
| B | 458,82 ms | 346,98 ms | %24,4 | 231,81 / 136,11 ms | 0,12 / 0,08 ms | 19,84 / 19,74 ms |
| C | 1.530,34 ms | 1.151,21 ms | %24,8 | 723,51 / 404,21 ms | 37,88 / 0,09 ms | 74,98 / 75,00 ms |

Bu azalmalar yalnız bu yerel deneyi anlatır. Yedi örneğin p95 değerleri A'da 452,08 / 344,04; B'de 512,80 / 383,53; C'de 1.542,54 / 1.204,54 ms. Bunlar üretim p95 veya kapasite tahmini değildir. JSON serileştirmesi toplam Store zincirinden **ayrı** ölçülüyor; tabloda kayıt+yanıta dahil değil.

| Profil | DB boyutu önce / sonra, bayt | Export süresi önce / sonra | Dosya commit önce / sonra | Tam kopya önce / sonra | Persist önce / sonra |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 9.601.024 / 9.601.024 | 1,70 / 1,78 ms | 18,86 / 13,77 ms | 42,15 / 42,19 ms | 32,15 / 34,55 ms |
| B | 25.780.224 / 25.812.992 | 4,12 / 4,20 ms | 18,41 / 21,85 ms | 43,71 / 45,45 ms | 32,87 / 33,22 ms |
| C | 48.353.280 / 48.345.088 | 8,13 / 7,00 ms | 40,44 / 38,79 ms | 155,22 / 155,02 ms | 124,90 / 133,44 ms |

Her profilde tek tam okuma ve tek structuredClone kaldı. Okunan SQL satırları A/B'de **100.489**, C'de **304.113**; yanıt boyutları sırasıyla **3.371.253 / 3.371.253 / 11.479.658 bayt**. Önce/sonra bu sayılar ve tahsis/revision/audit/settings için dört satırlık yazma, 334 bayt yazma parametresi aynı olarak doğrulandı. Uzun audit geçmişi `/api/changes` snapshot'ına eklenmez; A/B yanıt boyutu aynı.

SQL.js hâlâ işlem başına **iki DB export** yapar: rollback snapshot'ı ve commit dosyası. B/C audit geçmişi veritabanını büyüttüğü için bu export/dosya yolu daha fazla bayt taşır. Bu küçük ölçümden geçmiş büyüklüğüne bağlı doğrusal gecikme veya tüm ek maliyetin tek fazdan kaynaklandığı sonucu çıkarılamaz. Geçmiş silinmedi, fsync/rename veya rollback koruması azaltılmadı.

### İzlenebilirlik, doğrulama ve kalan maliyet

- SQL.js adapter önce `3eb5dbe626def1a3b694eb5a2d9a461ead2f2ade812c62b627ddf4cea89d81dd`, sonra `e7ead29cad3a25a926a52763e5f99a6258c004ac2a85d65703f193f3b7da035d`.
- Ortak aylık sınır kaynağı önce `32d5721b710e922a05cc456c279e93b09319f404ff32a8ec33eafb77073d2df3`, sonra `73b761ddb5550b9231e9cb367617d6e6e124f596c1760213a8a60f84243115c6` (kaynaklardan ayrıca hesaplandı; ham JSON'da bu alan yok).
- Her iki seride betik hash'i `e380f3dddd6dd24c9fcd54c3f703b3b49dc41af3a7153266e3e67d73a14706b4`, Store `970ed8f6733ee3009d3d032a31c44302fb7e6b2437344d559cd0ac42ab6ed880`; operations/service/schema/audit/change-set hash'leri JSON'da mevcut ve iki seride aynı. Ham dosyalar yerelde `/tmp/aa-profile-{plain,history,dense}-{before,after}-20261001.json`; geçici dosyalar Git raporunun kalıcı parçası değildir.
- Üç yeni SQL.js testi: Unicode/falsy/BLOB/parametrelerde aynı satır sonucu; 100 satırda tek metadata hazırlığı ve sonraki şema/alias değişimleri; decode hatasında statement free/transaction rollback ve yeniden okuma. Bir yeni aylık kapsam testi: boş array/Set/generator tarihsel veriyi taramaz; kapsam verilmezse veya ilgili ay seçilirse %100 aşımı yine reddedilir.
- `npm run verify`: **208/208 test**, biçim, TypeScript ve üretim derlemesi başarılı. HTTP yetki/revision/eşzamanlılık, disk commit hatası/rollback, restore ve aylık sınır regresyonları geçti. Native MSSQL üzerinde ölçüm/entegrasyon iddiası yok.
- Yoğun profilde **11,48 MB** tam yanıt, yaklaşık **75 ms** JSON serileştirmesi, **155 ms** kopya, **133 ms** persist ve **404 ms** tam okuma devam ediyor. Son model doğrulaması ve metadata karşılaştırması bu tabloda ayrıca ölçülmüş fazlar değildir. Bunları veya iç içe medyanları toplayarak toplam hesaplamayın.
- Sonraki mimari inceleme hedefli sorgu/yanıt sözleşmesi ve istemcinin büyük snapshot maliyeti. Bu paket yalnız tek kayıt zincirini ölçtü; yüksek eşzamanlı hacim/global işlem kilidi kapasitesi, tarayıcı performansı ve native MSSQL ayrı doğrulama gerektiriyor.


## Planlanan hücre yanıtı — tam görüntü / küçük yanıt karşılaştırması

1 Ekim 2026, 21:33–21:35 Europe/Istanbul; Node 24.21.0; geçici sentetik SQL.js veritabanı. Aynı kaynak koduyla tam yanıt (`--response=planning`) ve küçük yanıt (`--response=delta`) sırasıyla çalıştırıldı; bir ısınma + yedi örnek. Gerçek veri/.env kullanılmadı. Son istemci görüntüsü yeni SQL görüntüsüne tüm alanlarıyla eşit kontrol edildi. Her mod tek tam okuma, tek structuredClone ve aynı dört satırlık yazmayı kullanıyor; audit/generation/revision sonuçları kontrol ediliyor. İstemci simülasyonu Node'da gerçek ortak birleştirme işleviyle yapıldı; tarayıcı/HTTP/ağ gecikmesi ölçümü değildir.

- medium: 50.000 planlanan hücre, 200 çalışan, 0 gerçekleşen hücre, 1.000 izin kaydı, 50.000 audit.
- dense: 100.000 planlanan hücre, 2.000 çalışan, 50.000 gerçekleşen hücre, 10.000 izin kaydı, 50.000 audit.

| Profil / yanıt | Yanıt bayt | Kayıt + görüntü ms | Sunucu JSON ms | İstemci JSON çözme ms | İstemci harita kopyası ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| medium / full | 3,371,253 | 357.04 | 20.93 | 24.90 | 0.00 |
| medium / delta | 277 | 371.98 | 0.01 | 0.01 | 27.75 |
| dense / full | 11,479,658 | 1222.86 | 78.42 | 95.66 | 0.00 |
| dense / delta | 277 | 1225.22 | 0.01 | 0.01 | 97.10 |

Süreler medyandır. Kayıt + görüntü sütunu JSON serileştirmesini, çözmeyi ve istemci birleştirmesini içermez; bunlar ayrı ölçülür. Ayrı medyanların toplamı toplam sürenin medyanı olarak sunulmaz. Sunucu kayıt zinciri hızlandırılmadı: medium 357,04 → 371,98 ms, dense 1.222,86 → 1.225,22 ms; ölçümde küçük yanıtın bu zincire hız kazancı görülmedi. Beklenen kazanç gönderilen bayt ve sunucu serileştirmesidir. JSON çözme yerine harita kopyalama hâlâ O(N) maliyet taşır: medium 24,90 ms tam çözme / 27,76 ms küçük çözme + kopya; dense 95,66 / 97,11 ms. Tarayıcı CPU iyileşmesi iddia edilmiyor.

Tek hücre yanıtı iki profilde de 277 bayt; gerçek toplu yanıtta değişen hücre sayısı ve kullanıcı alanlarıyla büyür. Bu örnekte boyut azalışı %99,99'dan fazla. Sürüm uyuşmazlığı/metadata normalleşmesi/karma kayıt/ilk yüklemede tam görüntü korunur. Sık eşzamanlı değişikliklerde küçük yanıt yerine tam görüntü daha sık dönebilir. Yedi örnek üretim p95 veya kapasite garantisi değildir; native MSSQL performansı ölçülmedi. Sıkıştırma eklenmedi; kimlik/CSRF sözleşmesi değişmedi.

Tekrar üretme: `node scripts/benchmark-store.mjs --sizes=50000 --samples=7 --resources=200 --actuals=0 --calendar-days=1000 --audit-events=50000 --response=planning --output=/tmp/benzersiz-sonuc.json`. Küçük yanıt için `--response=delta` kullanın; her çalıştırmada ayrı çıktı adı seçin. Dense için `--sizes=100000 --resources=2000 --actuals=50000 --calendar-days=10000`. Çıktı yolu daha önce bulunmamalı. Betik geçici veritabanlarını sonunda siler.

Ham çıktılar bu oturumun `/tmp/aa-response-{medium,dense}-{full,delta}-20261001.json` dosyalarında; kaynak kod, ölçüm zamanı, örnekler, SQL/file commit süreleri ve bayt sayıları içerir, kullanıcı verisi içermez. `/tmp` kalıcı arşiv değildir. Ölçülen kaynak hash'leri:

- storeSha256: `bc8249c576f3073b91108d0e432a1da6814fdcd0775f58c31fffa241ffbd1e21`
- operationsSha256: `41b0cd408246881e04f4536fdbec90fdc14eef2ebe3b576c357966f0778f60e9`
- changeServiceSha256: `f618ff658fae7691436ddf012256eef3a3f666c5cadb0d83e11e2e3001daad7a`
- auditSha256: `ae66df2889c7b5560371b840d01c138cc1abcf2ecab2df4b0fcb7f88f9b6e417`
- sqlJsAdapterSha256: `e7ead29cad3a25a926a52763e5f99a6258c004ac2a85d65703f193f3b7da035d`
- schemaSha256: `40774711b6218062d1ada75511d0c4973c5b338e38b6b951b3519b49b7a9e2d7`
- benchmarkSha256: `0b8ae1bed0d8048901d9fcd02f48ed72b28863a76c7e1dad4c6aa80a19204dae`
- changeSetSha256: `6189c27a21044e2ce3150fc275e1964d5da616ce9323c6e80ce6730e76a9dfc8`
- planningResponseSha256: `07371dd7395807708c1dd9a97bafaf4bb285b95775885760477afa7b622a4b53`


## Kayıt öncesi snapshot kopyası — tek geçişli sayısal haritalar

1 Ekim 2026, 21:54–21:57 Europe/Istanbul; Node 24.21.0; sentetik/geçici SQL.js veritabanları. Son yordamın kaynak hash'i tüm karşılaştırmalarda aynı. `--snapshot-copy=full`, Store'un kopyalama yöntemini benchmark içinde önceki `structuredClone(data)` işlemine geçirir. `numeric`, uygulamanın yeni varsayılanıdır. Her çalışma bir ısınma + yedi ölçüm kullanır; medium numeric → full, dense full → numeric sırayla çalıştırıldı. Sonuçları tek bir değişiklikten kaynaklanan üretim hız farkı veya istatistiksel kapasite garantisi olarak yorumlamayın. Diğer kaynaklar ve ölçüm mantığı iki modda da aynı.

- medium: 50.000 planlanan hücre, 200 çalışan, 0 gerçekleşen hücre, 1.000 izin kaydı, 50.000 audit.
- dense: 100.000 planlanan hücre, 2.000 çalışan, 50.000 gerçekleşen hücre, 10.000 izin kaydı, 50.000 audit.
- Küçük yanıt modu (`--response=delta`), tek son model doğrulaması (`--validation=single`) kullanıldı. Son istemci görüntüsü tüm alanlarıyla yeni SQL görüntüsüne eşit; generation, revision ve audit sayısı kontrol edildi. Gerçek veri/.env kullanılmadı, veritabanları sonunda silindi.

| Profil / kopya | Kayıt + görüntü ms | Tam kopyalama ms | structuredClone alt süresi ms | Tam okuma ms | Persist ms | Dosya commit ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| medium / full | 357.96 | 46.66 | 46.65 | 133.12 | 33.87 | 34.31 |
| medium / numeric | 313.32 | 19.43 | 0.87 | 131.18 | 32.30 | 21.91 |
| dense / full | 1193.46 | 156.44 | 156.44 | 413.52 | 121.61 | 35.04 |
| dense / numeric | 1112.50 | 77.16 | 13.28 | 410.16 | 120.37 | 30.73 |

Süreler medyan. **Tam kopyalama** yeni yöntemin sayısal harita kontrolü/kopyası ve metadata derin kopyasının tümünü içerir. Yeni yöntemde structuredClone alt süresi yalnız metadata olduğundan eski toplam kopyalama süresiyle tek başına karşılaştırılmamalıdır. Dosya commit ve diğer süreler kayıt + görüntünün içindedir; alt süreler toplam medyana eklenmez. Kayıt + görüntü, HTTP/ağ/istemci çizimini içermez. JSON çözme ve istemci immutable merge, önceki adımda olduğu gibi ayrı kalır.

Yoğun profilde kopya 156,44 → 77,16 ms (**%50,7 azalma**), kayıt + görüntü 1.193,46 → 1.112,50 ms (**bu deneyde %6,8 azalma**). Medium kopyası 46,66 → 19,43 ms (%58,4); kayıt + görüntü 357,96 → 313,32 ms (%12,5). Medium dosya commit süreleri de değiştiği için tüm toplam kazancını yalnız kopyalamaya atfetmek doğru olmaz. Her profilde bir tam SQL okuması, bir structuredClone çağrısı ve aynı sayıda seçilen satır korundu: medium 100.489, dense 304.113. Değişen dört satır allocation/revision/audit/settings; 334 bayt yazma parametresi ve tek hücre için 277 bayt yanıt aynı.

İlk denenen `Object.values` kontrolü + spread kopyası, ayrı bir keşif ölçümünde medium kopyasını 44,91 → 49,39 ms'ye çıkararak yavaşladı; terk edildi. Yukarıdaki sonuçlar tek geçişli son sürüme aittir. Tek geçişte kendi alanı olmayan kalıtılmış özellik okunmaz; özel `__proto__` alanı veri özelliği olarak kurulur. Sayısal olmayan map değerinde tam kopya kullanılır; iş sınırları model doğrulamasında kalır. Önceki/yeni yordamın veri bağımsızlığı ve SQL/audit/rollback sonuçları testlerle kontrol edildi. Bellek/GC etkisini veya tarayıcı/native MSSQL performansını ölçen bir çalışma değildir.

Tekrar üretme:

`node scripts/benchmark-store.mjs --sizes=50000 --samples=7 --resources=200 --actuals=0 --calendar-days=1000 --audit-events=50000 --response=delta --snapshot-copy=full --output=/tmp/benzersiz-copy-full.json`

Yeni yordam için `--snapshot-copy=numeric` ve farklı çıktı adı kullanın. Dense profil için `--sizes=100000 --resources=2000 --actuals=50000 --calendar-days=10000`. Betik .env yüklemez, mevcut DB yolu/provider kabul etmez; yalnız geçici SQL.js veritabanlarını oluşturup siler. Çıktı yolu önceden bulunmamalıdır.

Ham final çıktıları bu oturumda `/tmp/aa-copy-{medium,dense}-final-{full,numeric}-20261001.json` dosyalarında. İlk deneme sonuçları final karşılaştırmaya karıştırılmadı. `/tmp` kalıcı arşiv değildir. Final karşılaştırmanın kaynak hash'leri:

- mutationSnapshotSha256: `d42c624a010d89315d6b9759f7149731954df64844cdb9fbee89eb4643638306`
- storeSha256: `55a336610d3df6315e74458fa65911b7f15a450a364c2312860e903212653347`
- operationsSha256: `41b0cd408246881e04f4536fdbec90fdc14eef2ebe3b576c357966f0778f60e9`
- changeServiceSha256: `f618ff658fae7691436ddf012256eef3a3f666c5cadb0d83e11e2e3001daad7a`
- auditSha256: `ae66df2889c7b5560371b840d01c138cc1abcf2ecab2df4b0fcb7f88f9b6e417`
- sqlJsAdapterSha256: `e7ead29cad3a25a926a52763e5f99a6258c004ac2a85d65703f193f3b7da035d`
- schemaSha256: `40774711b6218062d1ada75511d0c4973c5b338e38b6b951b3519b49b7a9e2d7`
- benchmarkSha256: `babd577313c54eb16354c6030b07478616150a6fd458b814bc99d5efaa28390f`
- changeSetSha256: `6189c27a21044e2ce3150fc275e1964d5da616ce9323c6e80ce6730e76a9dfc8`
