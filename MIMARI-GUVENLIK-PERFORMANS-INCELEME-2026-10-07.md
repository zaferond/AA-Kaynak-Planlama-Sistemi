# Güvenlik, mimari ve performans incelemesi — 7 Ekim 2026

## Yönetici özeti ve sürüm

İncelenen taban: `main`, `05b99e5556aaa7e472e99923f492fc37eab3487f`. İnceleme yalnız bu commit'e değil, başlangıçta **137 değişmiş/yeni girdisi bulunan güncel çalışma ağacına** uygulanmıştır. Kaynak kökü `AA Kaynak Planlama Sistemi` adlı iç Git klasörüdür. Başlangıç raporları: 2 Ekim yeniden incelemesi, 3 Ekim düzeltme kaydı, 5 Ekim incelemesi/düzeltmeleri ve 7 Ekim Y4/Y6 kayıtları. Tarihsel “açık/tamamlandı” etiketleri yerine kod ve hedefli kontroller kullanıldı.

**İncelenen akışlarda doğrudan istismar edilebilen Kritik/Yüksek uygulama açığı doğrulanmadı.** Buna karşılık bir silme doğrulama hatası yeniden üretildi; bağımlılık taramasında biri sağlayıcı tarafından Yüksek derecelendirilmiş iki kök uyarı bulundu. Bunların uygulamadaki erişilebilirliği aşağıda ayrılmıştır. Kaynak, test veya kilit dosyası değiştirilmedi; yalnız bu rapor eklendi. Kullanıcının sonraki isteği doğrultusunda mevcut geliştirmeler ve rapor commit/push kapsamındadır.

**119/119 hedefli kaynak/API testi ve 36/36 tarayıcı grubu başarılıdır.** Bu sayı tüm süit veya kurum ortamı kabulü değildir. Yeni silme hatasının yeniden üretimi geçen regresyon sayısına dahil değildir. SQL.js üzerinde küçük, ardışık yük ölçümü de yapıldı. Gerçek kullanıcı hesabı, çalışan veritabanı, gerçek migration/restore veya gerçek yedek açılmadı. Uygulama yeniden başlatılmadı.

## Önem sırasıyla bulgular

Aşağıdaki önem uygulamadaki doğrulanan kapsamı ifade eder; bağımlılık sağlayıcısının derecesi ayrıca yazılmıştır. “Açık” uygulama kodunda düzeltilmedi anlamındadır; her açık kayıt bir yetki aşımı değildir.

| # | Öncelik | Dosya ve satırlar | Kanıt ve olası etki | Güven | Önerilen dar düzeltme | Önceki rapor / durum |
|---|---|---|---|---|---|---|
| N1 | **Orta** | `backend/operations.mjs:35–58,151–181,247–252,447`; `shared/server-domain.ts:222,434–445`; `backend/planning-writer.mjs:246–275` | Normal kullanıcının kendi çalışan kimliğiyle gönderdiği, hiç var olmamış actual kayıtlarını silme isteği kabul ediliyor. Geçersiz bileşik anahtarlar da silindikleri için son veri doğrulamasına girmiyor; revision yine artırılıp saklanıyor. Sentetik HTTP isteği 32 hayali kayıtta **200**, DB'de **32 yeni revision**, generation **+1** üretti. İş tahsisleri değişmedi. Tekrarlı kötü/bozuk istemci istekleri kalıcı metadata büyümesine ve gereksiz genel yenilemeye yol açabilir. | **Yüksek:** HTTP → Store → SQL.js kalıcı tablo sorgusu ile yeniden üretildi. Native MSSQL ve yüksek hacimli hizmet kesintisi doğrulanmadı. | Actual/allocation anahtarını komut uygulanmadan ortak ayrıştırıcıyla doğrula. Mevcut kaydı veya gerçek tombstone'u olmayan silmeyi reddet ya da revision üretmeyen açık bir no-op yap. Gerçek tombstone'ların stale-draft korumasını koru. | **Yeni; Açık.** B5'in girdi doğrulama alanıyla ilişkili, önceki zorunlu başlangıç tarihi bulgusunun tekrarı değil. |
| N2 | **Orta** | `frontend/package-lock.json:2374–2397,2626–2634`; `package-lock.json:1621–1626,1660–1675`; `.github/workflows/quality.yml:27–28`; `frontend/build.mjs:3,22–38` | Frontend kilidinde `source-map-js 1.2.1`: sağlayıcı **Yüksek** DoS uyarısı; geliştirme bağımlılığı/PostCSS zinciri. Sunucu kilidinde `sprintf-js 1.1.3`: **Orta** uyarı; `tedious` ve `mssql` aynı kök nedeniyle etkilenmiş işaretleniyor. Frontend audit'in Yüksek kapısı bu kilit ve mevcut bildirimle geçmez. Üretim API'sinden saldırgan source map veya sprintf biçim metni verilmesine ilişkin yol doğrulanmadı. İncelenen Tedious çağrılarının biçim metinleri sabittir. | **Yüksek:** kilit, npm kayıtları ve duyurular. **Uygulamada istismar edilebilirlik doğrulanmadı.** | Frontend kilidini uyumlu `source-map-js >=1.2.2` ile kontrollü yenile. MSSQL zincirinde düzeltilmiş upstream sürümünü/uyumlu transitif çözümü değerlendir; npm'in önerdiği `mssql 4.2.0` düşürmesini veya `audit fix --force` işlemini körlemesine uygulama. Derleme ve MSSQL regresyonlarını doğrula. | **Yeni; Açık.** Önceki rapordaki “0 bağımlılık uyarısı” güncel sonuç değildir. |
| N3 | **Orta** | `backend/store.mjs:173–181,196–224`; `backend/planning-reader.mjs:61–63,105–175`; `backend/adapters/mssql.mjs:87–93,106–125`; `backend/app.mjs:177–189,203–214` | Küçük bir yazma da tam snapshot okuma/kopyalama/doğrulamasından geçiyor. MSSQL iş verisi işlemleri ortak Shared/Exclusive uygulama kilidini kullanıyor. Normal kullanıcı okumasında bile tüm gerçekleşen kayıtlar sunucuda okunup sonra kişisel kapsam ve anonim toplam üretiliyor. Sentetik ölçümde normal kullanıcı için 1.800 actual ve 1.800 yüzde satırının tamamı okundu. Bu kapsamda veri sızıntısı saptanmadı; maliyet veri büyüklüğüne bağlı. Uç noktalarda login/yetki düzenleme dışı genel işlem kotası veya kuyruk sınırı yok. | **Yüksek:** çağrı zinciri ve SQL satır sayıları. **Gerçek yükte yavaşlama/kesinti sınırı doğrulanmadı.** | Önce native ortamda yazma kilidi bekleme süresi, p95/p99 süre ve bellek ölç. Sonuca göre sık actual/allocation işlemlerini dar sorgu/validasyon sınırına taşı; revizyon, aylık toplam ve transaction bütünlüğünü koru. Gerekli uçlara kullanıcı başına eşzamanlılık sınırı ekle. | Önceki Store/performance ve **Y5** kapsamının devamı; **Kısmen giderildi**. Plan okuma kapsamı, delta yanıt ve değişen satır persistence iyileştirmeleri mevcut; tam snapshot bağımlılığı sürüyor. |
| N4 | **Orta — kabul eksikliği** | `ci-evidence/native-mssql-63780fc.json:1`; `backend/migration-catalog.mjs:7–20`; `.github/workflows/mssql-native.yml:2–10,50–66`; `.github/workflows/quality.yml:29–47` | Arşivlenmiş native kanıt şema **30** için; güncel katalog **31**. Arşivdeki 48 kaynak hash'inin **11'i** güncel kodla farklı. Native workflow push'ta otomatik başlamıyor; schedule/manual tetikleniyor. Windows işi mevcut ama bu çalışma ağacı için başarılı çalışması bu incelemede doğrulanmadı. | **Yüksek:** katalog/hash/workflow karşılaştırması. Güncel native/kurumsal sonuç **doğrulanmadı**. | Push edilen aynı commit için Native MSSQL ve Windows işlerini çalıştırıp yeni kaynak hash'li kanıt sakla. Ardından kurum proxy/TLS, servis hesabı/ACL, ayrı hedefe kurtarma ve temsili eşzamanlı yük kabulünü tamamla. | **Y5; Açık / güncel ortam sonucu Doğrulanamadı.** SQL Server'da hata bulunduğu anlamına gelmez. |
| N5 | **Düşük** | `frontend/src/storage.ts:68–95,199–220`; `frontend/src/features/risk-table/useRiskDraft.ts:111–128` | Ortak fetch yolunda uygulamanın belirlediği süre sınırı veya AbortSignal yok. Yazmalar tek promise kuyruğuna bağlı. Yanıtı tamamlanmayan ağ/proxy isteğinde kaydetme durumu ve sonraki yazmalar tarayıcının/ağın kendi sonlandırmasına kadar bekleyebilir. 409/503 testleri tamamlanan hata yanıtını kapsıyor; açık kalan bağlantıyı kapsamıyor. | **Yüksek:** kontrolün yokluğu koddan doğrulandı. Süresiz bağlantı senaryosu ayrıca yeniden üretilmedi; pratik bekleme süresi **doğrulanmadı**. | Ortak taşıma katmanına süre sınırı, bağlantı durumu ve kontrollü yeniden yükleme ekle. Süresi dolan yazmanın sunucuda tamamlanmış olabileceğini hesaba kat; otomatik tekrar yazmadan önce generation/revision ile sonucu uzlaştır, taslağı koru. | **Yeni; Açık.** B1/B6'nın mevcut taslak/oturum düzeltmelerini geçersiz kılmaz. |
| N6 | **Düşük** | `frontend/build.mjs:17,41–49,71–74`; `scripts/deployment-manifest.mjs:116–127`; `scripts/deployment-package.mjs:33–44` | Derleme yeni hash'li varlıkları ekliyor; eski site varlıklarını saklama sınırı yok. Manifest/paketleme tümünü içeriyor. Yerel manifestte **395 dosya, 129.222.152 bayt (~123,2 MiB), 127 JS dosyası** bulunuyor. Fazladan disk/paket/başlangıç hash okuma maliyeti ve gereksiz eski public çıktılar oluşuyor. Ana sayfa bunların tamamını indirmiyor. | **Yüksek:** dosya envanteri ve derleme/paket çağrı zinciri. Eski varlıklarda gizli bilgi bulunduğu iddia edilmiyor. | Temiz staging klasöründe build ve atomik yayın kullan; gerekiyorsa açık sekmeler için önceki bir sürümü süreli tut. Aktif kurulumu doğrudan silen bir temizleme ekleme. | **Yeni; Açık.** Y6'nın kaynak/çıktı tutarlılığı çözülmüş; varlık yaşam döngüsü ayrı bakım konusu. |

N2 için kaynaklar: [source-map-js duyurusu ve düzeltilen sürüm](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [sprintf-js duyurusu](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). Npm audit 3 backend paketini aynı sprintf-js zinciri nedeniyle saymaktadır; bunlar üç bağımsız kök açık değildir. Frontend uyarısı geliştirme bağımlılığıdır; üretim uygulamasında doğrulanmış bir Yüksek açık olarak derecelendirilmedi.

### N1 güvenli yeniden üretim

Geçici SQL.js ve sentetik `employee` hesabı kullanıldı. `/api/changes` içine `kind: actual`, `operation: delete`, `revision: 0` içeren 32 komut gönderildi. Kimlikler çalışanın kendi kaynak kimliğiyle başladı; 30'u var olmayan proje kimliği/geçerli ay, biri eksik ay, biri fazladan bileşen taşıdı. CSRF ve Origin geçerliydi; yetki atlatma yapılmadı. Yanıt 200, `kp_revisions` içinde 32 yeni hayali kayıt ve generation artışı doğrulandı. Gerçekleşen veri önce/sonra aynı kaldı. Test kapanışında geçici DB kaldırıldı. Uygulama koduna test veya düzeltme eklenmedi.

## Önceki güvenlik raporlarının güncel durumu

“Giderildi” yalnız açıklanan kod ve test kapsamı içindir; bütün işletim ortamının kabulü anlamına gelmez.

| Madde | Güncel durum | Güncel kanıt / sınır |
|---|---|---|
| B1 — Eski taslağın uzak değişikliği ezmesi | **Giderildi — incelenen editör yolları** | `useRiskDraft.ts:65–78,113–121,196` açılış değer/revision tutuyor. Risk concurrency 7/7 ve storage sıralama testleri geçti. Y1 menü/sürükleme kapsamı da aşağıda doğrulandı. Her olası editör etkileşiminin eksiksiz tarandığı iddia edilmez. |
| B2 — Yedek/migration doğrulaması | **Giderildi — SQL.js doğrulayıcı** | `migration-catalog.mjs:7–25` inline 3/12 ve yeni 31'i kapsıyor. `maintenance-snapshot.mjs:68–104` şema/sütun/kısıt/geçmiş kontrol ediyor. Eksik migration, bozuk credential, ayrı recovery, rollback ve 5 yıl retention kontrolleri geçen 82 test içinde. Kurum MSSQL kurtarması Y5'te açık. |
| B3 — Excel uzun metin sınırı | **Giderildi** | `xlsx-cells.ts:19–28,40–82`: açık limit hatası ve kayıpsız devam parçaları. Hücre sınırı ve XML testleri geçti. Native Excel'de görünüm/açılış bu tur denenmedi. |
| B4 — Liderlik değişiminde kendi kaynağını kaybetme | **Giderildi** | `shared/access.ts:50–57,101–121`: ownId istisnası ve kişisel ay kapsamı. `scope-index.test.mjs` 6/6; tamamen başka liderliğe transferde kişinin kendi kaydı korunuyor, diğer veriye kapsam açılmıyor. |
| B5 — Başlangıç tarihini API'den atlama | **Giderildi — özgün bulgu** | `shared/server-domain.ts:334–348` ortak tarih politikasını çağırıyor. Resource-policy ve active-resource testleri geçti. N1 farklı bir silme doğrulama eksikliği. |
| B6 — Sekmeler arası eski oturum/veri | **Giderildi — mevcut tarayıcı protokolü** | `storage.ts:31–58,68–125`: epoch/identity/generation; session consistency 7/7. BroadcastChannel, storage fallback, gecikmiş admin yanıtı ve aynı hesaba yeni giriş doğrulandı. Kurum SSO kapsam dışı. |
| Y1 — Eski aralık indeksine güncel revision uygulama | **Giderildi** | `project-snapshot.ts:9–13`; `useMilestoneDrag.ts:109,270–278,436–444`; `useProjectMenus.ts:131`. 3 saf komut testi ve 22 tarayıcı grubu: renk, aylık/haftalık taşıma, resize, milestone ve detay notta uzak ekleme çakışmaları. |
| Y2 — Geçersiz XML karakterli XLSX | **Giderildi** | `xlsx-cells.ts:8–9,84–103`; 4 XML karakter testi. Geçersiz karakter açık hata ile reddediliyor; geçerli Unicode ve kaynak metin korunuyor. |
| Y3 — Domain kapısının nested/dinamik import kaçırması | **Giderildi — tanımlı statik kapsam** | `scripts/check-domain.mjs`, `domain-boundaries.mjs` recursive AST kontrolü; güncel 34 shared modül geçti. Olumsuz fixture'lar koddan incelendi, bu tur tamamı yeniden çalıştırılmadı. Bu kapı tüm runtime/eval davranışlarını kanıtlamaz. |
| Y4 — Liderlik formunda ilgisiz değişikliğe 409 | **Giderildi** | `operations.mjs:458–486`; `store.mjs:181–185`; `useDirectoryEditor.ts:53,195,257`. Ayrı katalog revision'ı ve eski istemci generation fallback'i mevcut. HTTP 7/7: ilgisiz yazma, stale katalog, rollback, restore ve yeniden açılış dahil. |
| Y5 — Güncel native/kurum kabulü | **Açık / Doğrulanamadı** | N4: şema 30 kanıtı şema 31/güncel kaynak için yeterli değil. |
| Y6 — Çalıştırma ve Git paket tutarsızlığı | **Giderildi — yerel paket koruması** | `server.mjs:9–27` Store'dan önce doğrular; deployment testleri 9/9, HTTP startup guard testleri 4/4 ve güncel manifest doğrulaması geçti. Diskte eşleşme, zaten açık sürecin yeni backend'i yüklediğini kanıtlamaz; süreç yeniden başlatılmadı. N6 ayrı varlık birikimi konusu. |

## Kod kalitesi ve mimari değerlendirmesi

Katmanları ayrılmış bir monolit var: iş kuralları shared modüllerde, SQL eşlemesi reader/writer/adaptörlerde, görünüm ve etkileşim frontend'de. Shared bağımlılık kontrolü güncel 34 dosyada geçti. Bu inceleme katı Clean Architecture uyumu veya bütün modüllerin döngüsüzlüğü sertifikası değildir.

En anlamlı tekrar azaltma fırsatı **komut anahtarlarının ayrıştırılması/doğrulanması**: API komutu ve son model ayrı yerlerde kontrol ediliyor; N1 bu ayrımın gerçek sonucudur. Ortak actual/allocation anahtar sözleşmesi, salt satır sayısı azaltmaktan daha önceliklidir. `App.tsx` 1.006, `operations.mjs` 716 satır; çok sayıda alanın koordinasyonunu tutuyor. Alan bazında komut işleyicileri ve rapor kompozisyonunun çıkarılması bakım/test kolaylığı sağlar. Bu büyüklük tek başına güvenlik kusuru değildir. Benzer ama aynı olmayan tüm JSX/CSS/fonksiyonların kapsamlı clone analizi yapılmadı.

180 saat FTE, 9 saat iş günü, risk ölçeği ve %90 görünüm gibi iş/sunum sabitleri merkezi modüllerde bulunuyor; sabit olmaları tek başına kusur sayılmadı. Sistemin başka çalışma düzenlerine uyarlanması istenirse sürümlü politika gerekir. Risk ve rapor hesaplarının yeniden farklı UI katmanlarında kopyalandığına ilişkin kanıt bulunmadı; tüm hesap kombinasyonları bu incelemede yeniden test edilmedi.

Hata yanıtları genel 500 metni ve sınırlı log alanlarıyla sınırlandırılmış. Taslakların 409/503 sonrası korunması test edildi. Arka plan yenilemesinin bazı hataları sessiz yakalaması ve N5'teki bağlantı bekleme davranışı, ileride kullanıcıya bağlantı durumunu gösteren ortak taşıma katmanıyla ele alınabilir.

## Kontrol edilen güvenlik alanları

- **Kimlik/oturum:** `auth.mjs` scrypt, rastgele token, token hash'i, zaman güvenli karşılaştırma; `app.mjs:92–175` HttpOnly/SameSite/Secure, expiry/user version, Origin/custom header/CSRF. Login IP/account bütçeleri ve başarısız counter erişiminde kapalı davranış koddan; seçili login senaryoları testten doğrulandı. Oturum MFA/kurum kimlik entegrasyonu değerlendirmesi yapılmadı.
- **Yetki ve veri ayrımı:** Sunucu `stageChanges` rol/own-resource/manager takım kontrolü ve Store içindeki aktif kullanıcı kontrolü izlendi. Risklerin tüm kullanıcılara görünmesi mevcut ürün isteği olarak değerlendirildi. Normal kullanıcı yalnız kendi riskini düzenleyebilir; katalog yönetimi admin'e bağlıdır. Yalnız arayüz görünürlüğüne güvenilmedi.
- **API/SQL:** Parser sınırlarından önce auth/origin; 4 KB login, 2/20 MB uygulama limitleri; Zod/model doğrulama; parametreli değerler ve sabit SQL tablo kataloğu incelendi. N1 dışında incelenen yollarda SQL injection veya yetki aşımı yeniden üretilemedi. Bu bütün API için yokluk kanıtı değildir.
- **Hassas veri:** API no-store, user public projeksiyonu, audit'te kaynak notu ve kişisel takvim açıklaması çıkarılması (`audit.mjs:27–35,102–108`) incelendi. Audit ve tam yedekler kişisel/kurumsal veri taşımaya devam eder; anonim veya şifreli varsayılmadı. Gerçek `.env`, parola, token veya veritabanı içeriği okunmadı.
- **Sırlar ve push kapsamı:** 497 metin dosyasında sınırlı özel anahtar ve yaygın token örüntüsü taraması yapıldı; bir belge yolunun `risk-…` bölümünü yanlış eşleyen sonuç gerçek sır değildi. `.env.example` türü örnekler dışında tracked/untracked commit adaylarında DB/anahtar dosyası bulunmadı. Bu tüm sır biçimlerini ve geçmiş commit'leri kapsayan secret scan değildir. Eşleşen olası değerler dışarı aktarılmadı.
- **Web/çıktı:** CSP, frame-ancestors, nosniff ve React metin sunumu; incelenen kaynaklarda dinamik HTML/eval yolu araştırıldı. Excel ortak inline metin yazarı, uzunluk/Unicode koruması incelendi; seçili export testleri geçti. Excel import limit/DTD/entity kontrolleri koddan incelendi; import saldırı senaryolarının tamamı tekrar koşulmadı. Native Excel uygulaması kullanılmadı.
- **Yedek ve migration:** SQL.js üzerinde geçici, sentetik yedek/kurtarma/retention testleri; şema kataloğu ve bilinmeyen sürüm reddi incelendi. `auditRetentionYears: 5`, `automaticPurge: false`: beş yıl politikası mevcut; otomatik zamanlayıcının kurulu olduğu çıkarımı yapılmadı.

## Çalıştırılan doğrulamalar

Ortam: macOS, Node 24.21.0, geçici SQL.js veritabanları ve rastgele loopback portları, ayrı headless Chrome bağlamları. Komut girişleri/fixture'lar çalıştırılmadan incelendi. Çocuk süreçlere sınırlı ortam verildi; uygulama `.env` dosyası yüklenmedi. Kurulu paketleri bulmak için mevcut geçici dependency loader kullanıldı; kaynak bağımlılıkları kurulmadı/değiştirilmedi.

| Komut / kontrol | Sonuç |
|---|---|
| `node --import /tmp/aa-domain-loader.mjs --test tests/login-security.test.mjs tests/record-access-http.test.mjs tests/risk-systems.test.mjs tests/project-interaction-concurrency.test.mjs tests/xlsx-xml-characters.test.mjs tests/xlsx-cell-limits.test.mjs tests/resource-policy.test.mjs tests/migration-policy.test.mjs tests/data-maintenance.test.mjs tests/concurrency.test.mjs tests/planning-response.test.mjs tests/storage-order.test.mjs` | **82/82**, hata/atlama yok; ~11,45 saniye. |
| Aynı loader ile `node --test tests/record-access.test.mjs tests/active-resource-scenarios.test.mjs tests/deployment-manifest.test.mjs tests/http-config.test.mjs` | **31/31**, hata/atlama yok. |
| Aynı loader ile `node --test tests/scope-index.test.mjs` | **6/6**, hata/atlama yok. |
| Geçici runner: `checkRiskConcurrency`, `checkTimelineConcurrency`, `checkSessionConsistency` | **7 + 22 + 7 = 36 grup**, tarayıcı hatası yok. Her modülde ayrı sentetik fixture; gerçek hesap yok. |
| Geçici `/tmp/aa-audit-delete-probe.mjs` | **N1 yeniden üretildi:** 200 / 32 yeni DB revision / generation +1 / tahsisler aynı. Başarı testi değil, hata kanıtı. |
| `node --import /tmp/aa-domain-loader.mjs scripts/check-domain.mjs` | 34 shared modülde recursive AST sınır kontrolü geçti. |
| `node frontend/node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json` | Geçti; çıktı üretilmedi. |
| `node scripts/verify-deployment.mjs` | Geçti; kaynak/artifact changed/missing/added listeleri boş. Build çalıştırılmadı. |
| `npm audit --package-lock-only --ignore-scripts --json` — iki kilidin geçici kopyaları | Backend: 3 Orta paket, aynı kök zincir. Frontend: 1 Yüksek, dev bağımlılığı. Npm'e yalnız herkese açık paket metadatası gönderildi; boş npm config ve ayrı cache kullanıldı. |
| `git status`, log/diff, `git diff --check`, sınırlı sır örüntüsü ve manifest envanteri | Çalışma ağacı/başlangıç commit'i belirlendi; whitespace hatası yok. |

Geçici kanıtlar: `aa-review-20261007-bpdnl7ez` (test logları ve load.json), `aa-dependency-audit-rfe7ioyh` (npm çıktıları), `/tmp/aa-browser-checks-Wl44EI`, `/tmp/aa-browser-checks-iIdApF`, `/tmp/aa-browser-checks-LkfDIp`. Geçici dosyaların kalıcı CI arşivi olduğu varsayılmamalıdır.

### Sunucu performansı ölçümünün sınırı

Komut: `node --import /tmp/aa-domain-loader.mjs scripts/benchmark-load.mjs --samples=3 --size=10000 --resources=200 --actuals=1800 --percentages=1800 --calendar-days=200 --roles=admin,manager,normal --output=<geçici dizin>/load.json`.

Yalnız sentetik veri, SQL.js, aynı makinede ardışık ilk veri okuma. Her rol/encoding için 3 örnek; gerçek eşzamanlı kullanıcı kapasitesi, p95/p99, tepe bellek, kurum ağı veya MSSQL sonuçları değildir.

| Rol | Sıkıştırmasız HTTP medyanı | Gzip HTTP medyanı | Sıkıştırmasız / gzip bayt |
|---|---:|---:|---:|
| Admin | 34,55 ms | 33,88 ms | 928.496 / 80.214 |
| Yönetici | 22,22 ms | 21,05 ms | 172.293 / 17.446 |
| Normal | 13,94 ms | 14,10 ms | 67.601 / 7.786 |

Bu veri hacminde okuma sonuçları iyi; N3'teki ölçek/kilit sınırının ortadan kalktığını kanıtlamaz. Dönen snapshot'ların gzip/identity eşitliği, kapsam ve no-store kontrolü geçti. Gerçek uygulama işlemcisinin/belleğinin “sağlıklı” olduğu sonucuna varmak için çalışan süreç/DB yükü ölçülmedi.

## Kalite kapıları ve doğrulanamayan alanlar

Ubuntu CI biçim, kaynak testleri, TypeScript/build, manifest, tarayıcı süiti ve npm audit çalıştırır. Windows CI seçili sentetik API/dosya/recovery/startup testlerini içerir. Native MSSQL ayrı schedule/manual işidir. Yeni N1 ve yanıt vermeyen bağlantı için N5 senaryosu mevcut otomatik testlerde bulunamadı. Npm uyarısı güncellenmeden frontend audit kapısının yeşil olacağı söylenemez.

Güncel commit için native MSSQL transaction/lock/migration 31, Windows servis/ACL ve restart, kurum proxy/TLS/trust zinciri, gerçek yedek şifreleme/erişim kontrolleri ve RPO/RTO, temsili eşzamanlı yük, kurum tarayıcısı/native Excel ve çalışan sürecin diskteki backend sürümünü yüklemiş olması **doğrulanmadı**. Gerçek ortam erişimi yapılmadığı için bunlar kod incelemesinden kapatılamaz.

Kapsam dışı: üretim penetrasyon testi, fuzzing, tüm Git geçmişinde sır taraması, tüm transitif paketlerin kaynak denetimi, her UI/hesap senaryosunun yeniden testi, kurum SSO/MFA ve AQAP uygunluk belgelendirmesi. Paket duyurularından uygulamanın istismar edildiği sonucu çıkarılmadı.

## Önerilen düzeltme sırası

1. **N1:** Ortak komut anahtarı ve silme/tombstone doğrulaması; 32 kayıt senaryosunu negatif regresyona çevir.
2. **N2:** Bağımlılık uyarılarını uyumlu sürüm/kilit değişiklikleriyle ele al; audit ve ilgili derleme/MSSQL kontrollerini geçir.
3. **N4/Y5:** Aynı commit için Native MSSQL/Windows kanıtını ve kurum kabul planını yenile. Üretim kabulünden önce tamamla.
4. **N3:** Native, temsili eşzamanlı yük ölçümüne göre yazma snapshot/kilit kapsamını daralt; gerekirse işlem kotası ekle.
5. **N5:** Yanıt vermeyen bağlantı için süre sınırı, taslak koruması ve belirsiz yazma sonucunu uzlaştırma.
6. **N6:** Temiz staging build ve sınırlı eski varlık saklama. Sonrasında App/operation sorumluluklarını davranış testleriyle küçük modüllere ayır.

Bu inceleme yeni bulguları düzeltmez. Mevcut geliştirmelerle raporun Git'e aktarılması, bulguların giderildiği veya yeni CI işlerinin geçtiği anlamına gelmez.
