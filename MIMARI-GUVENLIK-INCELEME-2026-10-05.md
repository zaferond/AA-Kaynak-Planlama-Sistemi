# Mimari ve güvenlik incelemesi — 5 Ekim 2026

**7 Ekim güncellemesi:** Y4 yerel kaynak/API/tarayıcı testleriyle düzeltildi; [kanıt ve güncel iş sırası](MIMARI-GUVENLIK-DUZELTMELER-2026-10-07.md). Y5 ve Y6 açık.

Önceki inceleme sonrası güncelleme: **Y1, Y2 ve Y3 yerel hedefli testlerle düzeltildi**. Değişiklik, kanıt ve kalan işler [5 Ekim düzeltme kaydında](MIMARI-GUVENLIK-DUZELTMELER-2026-10-05.md). Aşağıdaki bulgular ilk incelemenin tarihsel durumunu anlatır; Y4–Y6 bu güncellemeyle kapanmış sayılmaz.

## Yönetici özeti ve incelenen sürüm

Başlangıç bağlamı `MIMARI-GUVENLIK-YENIDEN-INCELEME-2026-10-02.md`; devamındaki 3 Ekim düzeltme raporu, CI kanıt arşivi ve 4 Ekim kurtarma kabul raporu da karşılaştırıldı. “Tamamlandı” etiketleri tek başına kanıt sayılmadı.

İncelenen Git HEAD: **`05b99e5556aaa7e472e99923f492fc37eab3487f`**, `main`. İnceleme başında çalışma ağacı temizdi. Sonradan kullanıcının istediği seçim kutusu düzeltmeleri şu beş dosyada yapıldı: `frontend/components/ui/popover.tsx`, `frontend/src/App.tsx`, `frontend/src/components/FilterPicker.tsx`, `frontend/src/styles/shared/controls.css`, `scripts/browser-checks/directory-management.mjs`. Bu rapor ayrıca yeni bir dokümandır. Commit veya push oluşturulmadı.

**Sonuç:** İncelenen akışlarda yeni, kanıtlanmış KRİTİK/YÜKSEK bir açık tespit edilmedi. Bu sonuç uygulamanın bütünüyle güvenli olduğunun kanıtı değildir. Yeni liderlik/takım işlemlerinin sunucu yetki kontrolleri, bağlı kayıt korumaları ve yeni rapor menüsünün açılış revision kontrolü doğrulandı. En önemli kalan hata, zaman çizelgesindeki bazı işlemlerin eşzamanlı güncelleme sırasında yanlış tarih aralığına uygulanabilmesidir. Bir Excel geçerlilik hatası ve iki daha düşük öncelikli kalite/kullanılabilirlik konusu da kanıtlandı.

İnceleme senaryolarında **13 hedefli kaynak testi ve 24 farklı tarayıcı kontrol grubu** geçti. Bunların dışında üç hata yeniden üretildi: yanlış bara renk yapıştırma, yanlış barı sürükleme ve geçersiz XML karakteri içeren Excel çıktısı. Yeniden üretimler beklenen başarısız davranışı kanıtlar; geçen regresyon testlerine dahil edilmedi.

Gerçek hesapla giriş, çalışan DB üzerinde test/migration/restore veya gerçek veri okuma yapılmadı. Uygulama düzeltmelerinin yayın kontrolünde yalnız herkese açık HTML/statik varlıklar okundu; backend yeniden başlatılmadı.

## Bulgular

Satır numaraları yukarıdaki HEAD ve belirtilen çalışma ağacı düzeltmelerine göredir. ORTA/DÜŞÜK kayıtlar doğrulanmış bulgu; BİLGİ kayıtları kabul kapsamı veya operasyonel sınırdır.

| # | Önem | Dosya ve satırlar | Bulgu | Etki/yeniden üretim | Güven |
|---|---|---|---|---|---|
| Y1 | ORTA | `frontend/src/features/useProjectMenus.ts:123–128,192–200,234–240`; `project-clipboard.ts:152–187`; `useMilestoneDrag.ts:16–27,184–198,241–247`; `project-timeline-commands.ts:107–136`; `usePortalRefresh.ts:23–38` | Açık menü/sürükleme, eski aralık indeksini güncel proje ve revision ile kullanıyor. | Başka admin araya aralık ekleyince yanlış barın rengi veya tarihleri HTTP 200 ile değişti. B1 ile aynı eşzamanlılık ilkesi; yeni rapor işaretleme yolu etkilenmedi. | Yüksek: çağrı zinciri + iki tarayıcı/HTTP yeniden üretimi. |
| Y2 | DÜŞÜK | `frontend/src/xlsx-cells.ts:15–24,80–88`; `risk-export.ts:24–26`; `shared/server-domain.ts:132–146` | Ortak Excel metin yazarı bazı XML içinde geçersiz karakterleri doğrudan yazıyor. | Normal sentetik kullanıcı U+FFFE içeren riski HTTP 200 ile kaydetti; üretilen XLSX içindeki `sheet1.xml` XML ayrıştırıcısında hata verdi. | Yüksek: gerçek API → saklanan sentetik risk → XLSX → XML ayrıştırması. |
| Y3 | DÜŞÜK | `scripts/check-domain.mjs:3–10`; `.github/workflows/quality.yml:22,43–44` | Mimari kapısı yalnız üst seviyedeki `.ts` dosyalarını ve belirli `from` kalıbını tarıyor. | Geçici `shared/audit-nested-probe/reverse.ts` dosyasının backend import'u kapıdan geçti. Güncel uygulamada böyle bir import saptanmadı. | Yüksek: güvenli sentetik kapı testi + AST incelemesi. |
| Y4 | DÜŞÜK | `frontend/src/features/team-directory/useDirectoryEditor.ts:34–43,162–167`; `backend/operations.mjs:421–428`; `backend/store.mjs:172–187` | Liderlik taslağı bütün uygulamanın generation değerine bağlı; ilgisiz değişiklikler de çakışma sayılıyor. | Yalnız proje sorumlusu değiştiğinde liderlik düzenlemesi 409 verdi; yerel taslak korundu. “Liderlik listesi değişti” mesajı bu durumda tam nedenini açıklamıyor. | Yüksek: mevcut tarayıcı senaryosuyla yeniden doğrulandı. |
| Y5 | BİLGİ | `ci-evidence/native-mssql-63780fc.json:1–61`; `.github/workflows/mssql-native.yml:2–5,50–63`; `.github/workflows/quality.yml:46–47` | Arşivlenmiş Native MSSQL kanıtı yeni dizin yönetimi değişikliklerini kapsamıyor; Windows testi de bu yeni HTTP dosyasını çalıştırmıyor. | Arşivin 48 kaynak hash'inden `backend/operations.mjs` ve `shared/server-domain.ts` değişmiş; `shared/directory-policy.ts` arşivde yok. SQL hatası bulunduğu anlamına gelmez. | Yüksek: hash/workflow farkı. Yeni native koşu sonucu doğrulanmadı. |
| Y6 | BİLGİ | Git kökündeki `baslat-mac.sh:7–10`, `baslat-windows.cmd:18–24`, `frontend/build.mjs`; çalışan üst klasörde aynı isimli dosyalar | Çalıştırma klasörü ile Git dağıtım kökü ayrı; başlatıcı/derleyici/paket dosyaları aynı değil. | Git başlatıcısı build çalıştırıyor; çalışan üst klasör başlatıcısı bu adımı içermiyor. Bugünkü dört uygulama dosyası ve aktif HTML/JS/CSS eşitliği ayrıca doğrulandı. | Yüksek: dosya karşılaştırması. Normal başlatmanın uçtan uca sonucu bu incelemede doğrulanmadı. |

### Y1 — Zaman çizelgesinde hedef ve açılış sürümü birlikte korunmuyor

**Önkoşul:** Proje düzenleme yetkili bir kullanıcı renk menüsünü açık tutar veya barı basılı tutarak sürüklemeye başlar. Diğer yetkili kullanıcı aynı başlıktaki aralıkları değiştirir; ilk sekme bu değişikliği alır. Yetkisiz erişim kanıtı değildir; eşzamanlı veri bütünlüğü hatasıdır.

**Çağrı zinciri:** `openMilestoneMenu` proje kopyasını ve revision'ı saklıyor. Yeni `toggleMilestoneReport` bunları kullanıyor. Eski `pasteMilestoneColor` ise `prepareMilestoneColorPaste(data, target, color)` çağrısına güncel `data` veriyor. Hazırlayıcı eski `rangeIndex` ile güncel aralığı seçip güncel revision gönderiyor. Sunucu bu isteği haklı olarak güncel sürüm sayıyor. `usePortalRefresh` açık menüyü veya sürüklemeyi editör saymıyor. Sürükleme state'i de açılış proje/revision çiftini taşımıyor; hareket ve kayıt sırasında güncel indeksli aralık kullanılıyor.

**Güvenli yeniden üretim A:** Sentetik proje içinde 1–5 Mart mavi ve 1–5 Nisan kırmızı bar oluşturuldu. Mavi renk kopyalandı, Nisan barının menüsü açıldı. Diğer işlem 12–20 Mart yeşil aralığını Nisan'ın önüne ekledi. İlk sekme yenilendikten sonra menüde Rengi Yapıştır seçildi. Açılış revision **2**, uzak güncelleme **3**, gönderilen revision **3**, HTTP **200**. Yeni Mart aralığı mavi oldu; hedeflenen Nisan barı kırmızı kaldı.

**Güvenli yeniden üretim B:** Nisan barına basılı tutulurken aynı uzak ekleme yapıldı. Fare 18 piksel sağa taşınıp bırakıldı. HTTP **200**, gönderilen revision **3**. Nisan barı değişmeden kaldı; araya eklenen 12–20 Mart barı **16–24 Mart** oldu. Tarihli alt notlar da bu yanlış hedefle birlikte taşındı.

**Önceki rapor:** B1'in risk ve genel form editörleri için düzeltmeleri bu incelemede geri alınmış değildir. Bu, aynı açılış sürümü ilkesinin menü ve drag işlemlerindeki ek kapsamıdır. Haftalık not/resize yolu da aynı indeks ve güncel snapshot yöntemini kullanıyor; bu iki özel hareket ayrıca tarayıcıda yeniden üretilmedi.

**En dar öneri:** Renk ve drag işlemleri de etkileşimin başlangıcındaki proje/revision çiftini kullansın. Proje bu sırada değişirse işlem açık bir çakışmayla iptal edilsin veya sunucu 409 versin; güncel revision otomatik devralınmasın. İlk düzeltme için DB migration gerekmiyor. Kalıcı aralık/not kimlikleri daha sonra yapılabilir. İki yeniden üretim CI regresyonuna eklenmeli.

### Y2 — Excel metnindeki geçersiz XML karakteri

**Önkoşul:** Risk ekleyebilen kullanıcı, API veya metin yapıştırma yoluyla U+FFFE içeren kısa açıklama kaydeder. Normal rolün kendi riskini ekleme yetkisi beklenen davranıştır.

**Doğrudan kanıt:** Metin şeması boyut kontrolü yapıyor; ortak yazıcı `&`, `<`, `>` ve bazı kontrol karakterlerini işliyor ama U+FFFE'yi geçerli metin gibi yazıyor. Sentetik normal kullanıcı riski HTTP **200** ile kaydetti. Saklanan metin aynen `riskWorkbook` fonksiyonuna verildi. Python `zipfile` + `xml.etree.ElementTree` ile tüm XML parçaları açıldı; `xl/worksheets/sheet1.xml` için **“not well-formed (invalid token)”** sonucu alındı. Native Excel'in onarma veya reddetme davranışı burada test edilmedi.

**Etki:** İlgili kaydı içeren dışa aktarım geçersiz çalışma sayfası üretir. Veritabanı bozulması, formül çalıştırma veya yetki aşımı kanıtlanmadı. Aynı ortak yazıcı diğer aktarımlarda da kullanılıyor; her aktarım ayrı yeniden üretilmedi.

**Önceki rapor:** B3'ün hücre boyutu/uzun not düzeltmeleri testten geçti. Bu, B3 altında daha önce doğrulanmamış farklı bir çıktı geçerlilik sınırıdır.

**En dar öneri:** Ortak metin yazarı XML'de temsil edilemeyen karakterleri, kullanıcıya alanı düzeltmesini söyleyen açık hata ile reddetsin. Kayıt sessizce değiştirilmesin veya metin kaybedilmesin. Geçerli Unicode çiftleri ve CR/LF davranışı korunsun; üretilen XML'in ayrıştırıldığı küçük bir regresyon eklensin.

### Y3 — Mimari kontrol kapsamı

**Önkoşul:** Gelecekte bir geliştirme ortak domain alt klasörüne uygulama katmanına bağlı modül ekler. Güncel kodda kanıtlanmış ters bağımlılık değildir.

**Yeniden üretim:** Yalnız geçici kaynak kopyasında `shared/audit-nested-probe/reverse.ts` oluşturuldu; `../../backend/app.mjs` import'u kondu. `node scripts/check-domain.mjs` **exit 0** verdi. Dosya import edilip çalıştırılmadı ve testten sonra kaldırıldı. Üst seviyedeki regex ayrıca side-effect/dinamik import biçimlerinin hepsini kapsamaz.

**Önceki rapor:** B1–B6'dan farklı, yeni kalite kapısı bulgusudur.

**En dar öneri:** Mevcut kapıya recursive dosya gezme ve TypeScript AST tabanlı import/export/ literal dinamik import kontrolü ekle. Uygulamanın işlevini değiştirme; nested/side-effect import negatif fixture'ları ekle.

### Y4 — Liderlik düzenlemesinde gereksiz çakışmalar

**Önkoşul:** Liderlik formu açıkken başka kullanıcı herhangi bir kaydı yazar. Veri kaybı veya yetki açığı değildir; güvenli fakat geniş bir çakışma sınırıdır.

**Kanıt:** Açılışta `currentGeneration()` saklanır. `Store.mutate` her başarılı iş verisi yazımında generation artırır. Liderlik komutu bu değerin birebir eşitliğini ister. Tarayıcı testindeki uzak işlem yalnız proje sorumlusunu değiştirdi; liderlik formu 409 verdi ve taslağı korudu. Testin geçmesi, davranışın kullanıcı açısından ideal olduğu anlamına gelmez.

**Önceki rapor:** Yeni manuel yönetim akışındaki kullanılabilirlik konusu. B1 koruması gerekli; kaldırılması önerilmiyor.

**En dar öneri:** Önce çakışma mesajı uygulama verisinin değiştiğini doğru anlatsın. Daha sonra liderlik kataloğu için ayrı atomik revision kullanılarak ilgisiz risk/tahsis yazımlarının formu bloke etmesi önlensin. Takım/liderlik bağlantıları ve stale-draft reddi korunmalı.

## Önceki B1–B6 ile karşılaştırma

| Önceki bulgu | Güncel doğrulama | Durum ve sınır |
|---|---|---|
| B1 — Taslak sessiz ezilmesi | `editor-revisions.ts` açılış revision'ları; genel editörlerde uzak değişiklik sonrası kayıt ve silme 409; 503 sonrasında taslak/retry korundu. Risk hook'unun açılış değer/revision saklaması koddan izlendi. | Bu formlar için koruma mevcut. Risk concurrency senaryolarının tamamı bu tur yeniden çalıştırılmadı. Y1 ek etkileşim kapsamı açık. |
| B2 — Yedek/migration eksikleri | Katalog inline 3/12'yi kapsıyor; bilinmeyen sürüm yazmadan reddediliyor; schema-contract kolon/tür/default/key/CHECK denetliyor; parola kaydı public projeksiyondan önce doğrulanıyor. Seçili negatif yedek ve migration testleri geçti. | İncelenen SQL.js kapsamındaki eski bulgu yeniden üretilemedi. Kurum MSSQL backup/restore kabulü ayrı. |
| B3 — Uzun Excel notu | `splitExcelText` sınır/Unicode/devam satırı testleri geçti; ortak `excelCellText` aşırı hücreyi açık hatayla reddediyor. | Uzunluk koruması mevcut; Y2 XML geçerliliği ek bulgu. |
| B4 — Liderlik değişiminde kendi kaynağı kaybolması | `scopeData` normal kullanıcının kendi resource geçmişini ayrıca tutuyor; transfer sonrası kendi gerçekleşen girdisi tarayıcıda korunuyor, diğer çalışan açılmıyor. | Seçili sentetik transfer senaryosu geçti. |
| B5 — Başlangıç tarihinin API'den atlanması | Sunucu `validate` ile ortak resource policy'yi çağırıyor; yeni/dahil ilan ve çalışan tarihleri, eski tarihsiz geçmiş istisnası ve JSON restore testleri geçti. | İncelenen ortak komut/validation kapsamındaki düzeltme mevcut. Tüm status/HTTP kombinasyonları bu tur yeniden koşulmadı. |
| B6 — Sekmeler arası eski oturum | BroadcastChannel, storage fallback, değişmeyen generation ile kimlik değişimi, geciken admin yanıtı ve aynı hesaba tekrar giriş dahil yedi tarayıcı senaryosu geçti. | Seçili tarayıcı/oturum kapsamındaki düzeltme mevcut. Kurum SSO/gerçek proxy burada yok. |

## 1. Kontrol edilen alanlar ve yöntemler

- **Yeni dizin yönetimi:** UI → `useDirectoryEditor` → storage → `/api/leaders/change` veya `/api/changes` → `Store.mutate` → `applyLeaderChange/applyChanges` → validation/persist/audit izlendi. Sunucudaki admin kontrolü, normal/manager reddi, boş/tekrar ad, stale revision/generation, kullanılan takım/liderliği silme koruması ve yeniden açıldığında kayıtların kalması sentetik HTTP/tarayıcı testlerinde kontrol edildi. Liderlik rename işleminin kullanıcı scope bağlantılarını ve resource revision'larını güncellemesi koddan izlendi.
- **Rapor sağ tık işlemleri:** Bar/haftalık not/baklava → menu snapshot → `prepareMilestoneReportChange` → proje revision → HTTP kaydı izlendi. Rapor flag'i dışında tarih/renk/tamamlanma alanlarının korunması, read-only rol ve stale-menu 409 testleri geçti. Eski renk ve drag yolları ayrıca izlendi; Y1 bulundu.
- **Kimlik ve erişim:** Scrypt parola kayıtları, oturum token hash'i, expiry/user-version/revoke, Origin + CSRF, sunucuda role/own-resource/manager takım sınırı, session identity ve stale-response kontrolleri incelendi. Risklerin bütün kullanıcılara görünmesi ve normal kullanıcının yalnız kendi riskini değiştirmesi mevcut ürün politikasına göre değerlendirildi.
- **API/SQL/hata/log:** Zod ve işlem içindeki son validation, body sınırlarından önce origin/auth, parametreli SQL değerleri ve sabit tablo/kolon kataloğu izlendi. 500 yanıtının sanitizasyonu ve logda yalnız yöntem/yol/hata adı; audit'te parola public projeksiyonu ve İK notunun çıkarılması incelendi. Audit'in actor/iş kayıt isimleri ve değişiklik geçmişi içerdiği, tam yedeğin kişisel veri/parola hash'leri taşıdığı kabul edildi; anonim sayılmadı.
- **Rate limit:** Login IP/account ve kullanıcı yetki değişikliği sayacı incelendi. Diğer yazma/okuma uçları için genel bir throughput limiti bulunmuyor. Bu eksiklikten tek başına istismar veya DoS kapasitesi sonucu çıkarılmadı; gerçek yük kontrolü açık.
- **Dosyalar ve çıktı:** XLSX yalnız tarayıcıda açılıyor; 10 MB dosya, açılmış entry/toplam boyut, satır/sütun, DTD/entity ve dış sheet ilişki kontrolleri incelendi. İşlenmiş satırlar serverda tekrar doğrulanıyor. Export metni inline string olarak yazılıyor; kullanıcı metninden formül üretme yolu incelenen yazıcılarda saptanmadı. Y2 ayrı çıktı geçerlilik hatasıdır.
- **Yedek/restore/migration:** Katalog → fingerprint → şema/model/parola doğrulama, staging/özel çıktı ve ayrı recovery kopyası, oturum temizleme, generation ile portal restore ve transaction sınırı incelendi. Bu tur gerçek yedek/DB açılmadı.
- **Mimari:** Geçici kopyada TypeScript AST ile **204 modül/796 import-export bildirimi** incelendi; shared → uygulama, frontend → backend ve backend → frontend statik import ihlali çıkmadı. Named function gövdelerinde ≥160 karakterlik birebir tekrar bulunmadı; arrow fonksiyon/JSX/benzer fakat farklı kod tekrarlarını bu sayım kanıtlamaz. AST taraması bütün dinamik runtime bağımlılıklarının kanıtı değildir.

### Temiz kod ve sabit kurallar değerlendirmesi

Hesaplar/politikalar `shared`, SQL/persistence `backend`, görünüm/etkileşim `frontend` sınırlarına büyük ölçüde ayrılmış. Resource/date/risk kuralları, katalog ve takvim hesapları ortak modüllerden geliyor. Manuel liderlik/takım seçenekleri server snapshot'ından türetiliyor; ilk kurulum kataloğu runtime seçim listesi olarak kullanılmıyor.

Bu, katı Clean Architecture'ın eksiksiz uygulandığı anlamına gelmez: frontend hook'ları doğrudan storage/global browser durumuna bağlı, işlem modülü birden fazla domain'i koordine ediyor. `App.tsx` 944, `operations.mjs` 654 satır; bunlar koordinasyon/bakım alanlarıdır, satır sayısı tek başına kusur değildir. İşlemleri özellik bazında ayırmak gelecekte yararlı olabilir; önce Y1 gibi davranış hataları giderilmeli.

180 saatlik FTE, 9 saatlik iş günü, risk ölçeği, şema sürümü ve %90 görünüm gibi değerler ortak politika/sunum yerlerinde tanımlı. Bunların sabit olması otomatik hata değildir. Kurumun başka çalışma düzeni istemesi durumunda yapılandırma ve eski hesapların korunması ayrıca tasarlanmalıdır. Takım liderliği değiştirilince eski resource versiyonlarının liderlik alanının da değişmesi doğrulandı; tarihsel organizasyon raporunun eski liderlikte kalması isteniyorsa bunun için ayrı ürün kuralı gerekir.

## 2. Çalıştırılan test/komutlar ve sonuçları

**Ortam:** Geçici Git arşivi; `.env` ve çalışma veritabanı kopyalanmadı. Kilitli paket sürümleriyle önceden kurulmuş geçici bağımlılıklar kullanıldı. Çocuk süreçlere yalnız PATH/TMPDIR/TEMP/TMP/LANG aktarıldı. Node **v24.21.0**, sentetik SQL.js dosyaları, rastgele loopback HTTP portları, Playwright'ın ayrı headless Chrome context'leri. Gerçek tarayıcı profili kullanılmadı.

Komutlar öncesinde fixture/entry point incelendi. `setup`, gerçek `start`, `db:migrate`, gerçek restore/retention komutları çalıştırılmadı.

| Komut/işlem | Sonuç ve etkisi |
|---|---|
| `git status --short`, `git rev-parse HEAD`, hedefli log/diff/dosya karşılaştırmaları | Başlangıç sürümü ve beş istenen uygulama/test değişikliği belirlendi. Salt okunur. |
| `node scripts/check-domain.mjs` | Mevcut kodda geçti. Geçici nested reverse-import fixture'ında da geçmesi Y3'ü kanıtladı. |
| `node --test --test-name-pattern '^(manual leadership\|manual team\|server and editor\|unchanged legacy\|JSON restore\|SQL.js and MSSQL startup\|required migration\|backup catalog\|backups reject\|full backup creation\|non-continuation Excel\|continuation rows)' tests/record-access-http.test.mjs tests/resource-policy.test.mjs tests/migration-policy.test.mjs tests/data-maintenance.test.mjs tests/xlsx-cell-limits.test.mjs` | **13/13 geçti**. Yalnız geçici/sentetik DB, yedek dosyaları ve mocked migration bağlantıları. Komuttaki `\|` gösterimi tablodaki Markdown ayırıcı kaçışıdır; regex alternatifleri normal `|` kullanır. |
| Geçici runner: `checkDirectoryManagement` + `checkWorkspaceFilters` | Son sürümde **8/8 grup geçti**. Yeni adların kaynak formunda hemen/reload sonrası seçilmesi; %90 ölçekte 1800/1280 genişlikte popup hizası; gerçek mouse-wheel scroll ve son seçeneğin görünür olması; Escape; 409 ve silme guard'ları dahil. |
| Geçici runner: `checkMilestoneReportMenu` + `checkSessionConsistency` + `checkEntityEditors` | **16/16 grup geçti**. Rapor menu 5, session 7, genel editör/own-resource 4. Popup scroll ek düzeltmesinden önce koşuldu; değişiklik bu testlerin iş kuralını değiştirmedi. |
| Geçici `probe-timeline-concurrency.mjs`, `probe-drag-concurrency.mjs` | Her ikisi Y1'de anlatılan yanlış hedef/HTTP 200 davranışını kanıtladı. |
| Geçici `probe-invalid-xlsx-text.mjs` + Python ZIP/XML ayrıştırması | Y2: normal rol HTTP 200, ardından geçersiz çalışma sayfası XML'i. |
| Geçici `probe-architecture.mjs` | 204 modül AST incelemesi ve sınırlı named-function tekrar kontrolü. |
| `node node_modules/typescript/bin/tsc --noEmit` | İstenen popup/scroll düzeltmelerinin son hali geçti; DB bağlantısı yok. |
| `node frontend/build.mjs` | Geçici kaynakta başarılı; yalnız build çıktısı. Eşleşen kaynak hash'leri kontrol edilerek site çıktısı iki çalıştırma köküne aktarıldı. |
| Hedefli Prettier `--check`, `git diff --check` | Geçti. Prettier `--write` yalnız kullanıcı düzeltmesi kapsamındaki dosyalara uygulandı; audit bulgularına otomatik düzeltme yapılmadı. |
| `node scripts/verify-deployment.mjs` | Git kökündeki güncel kaynak ve build manifest hash'leri eşleşti. Manifest commit etiketi HEAD'i belirtir; temiz çalışma ağacı anlamına gelmez. |
| `http://localhost:3000` HTML ve referanslı JS/CSS/logo bayt karşılaştırması | Çalışan statik varlıkların yeni derlemeyle eşleştiği doğrulandı. API/veri/hesap okunmadı, backend restart yok. |

Geçici kanıt dizini `aa-picker-review-2026-10-05-wc8_ix4k`; kaynak test logu `targeted-audit-tests.log`, AST özeti `architecture-static-result.json`. Son popup kontrollerinin sonucu `aa-browser-checks-PPLcZr/result.json`; oturum/editör kontrolleri `aa-browser-checks-eyEzFJ/result.json`; Y1 renk/drag kanıtları `aa-browser-checks-g9TLuC` / `aa-browser-checks-np6D6x`; Y2 sentetik çıktı `aa-browser-checks-A9gErX`. Bunlar işletim sistemi geçici dizinindedir; kalıcı CI kanıtı olarak değerlendirilmemelidir.

İlk popup denemesinde mevcut konum hatası, scroll denemesinde ise her iki listenin `scrollTop` değerinin mouse wheel sonrasında **0** kalması görüldü. Son düzeltmede leadership scroll değeri yaklaşık **26,7**, team scroll değeri yaklaşık **777,8** oldu. Geometri, liste araması ve yeni kayıt seçenekleri kontrol edildi. İlk bazı inceleme yardımcı komutları yanlış dosya adı/fixture kurulumu nedeniyle başarısız oldu; uygulama testi başarısızlığı sayılmadı. Son başarılı komut ve sonuçlar yukarıdadır.

## 3. Doğrulanamayan riskler ve nedenleri

- **Güncel Native MSSQL:** Arşivlenmiş 4 Ekim koşusu 19/19, SQL Server 2022 Developer, schema 30, iki pool ve cleanup kanıtı içeriyor. Yeni kaynak farklılıkları Y5'te. Bu tur native SQL veya yeni GitHub CI koşusu başlatılmadı; güncel HEAD'in CI sonucuna yeni bağımsız teyit alınmadı.
- **Windows üretim işletimi:** Servis hesabı/SCM, NTFS ACL, antivirüs dosya kilitleri, domain kimliği, kurum SQL yetkileri ve Chrome/Edge popup davranışı bu Mac/sentetik turla doğrulanmaz. Windows kalite workflow'unda yeni directory HTTP test dosyası yok.
- **Proxy/TLS:** Kod production HTTPS, güvenilen proxy listesi ve SQL sertifika denetimi getiriyor. Gerçek proxy'nin forwarded header overwrite'ı, backend port erişimi ve kurum CA zinciri incelenmedi. Önceki sentetik proxy kanıtı gerçek ağ kabulünün yerine geçmez.
- **Kurum yedek/kurtarma:** Gerçek MSSQL `.bak` restore/CHECKDB, ayrı sunucu, encryption/key escrow, offsite/immutable saklama, NTFS/SQL izinleri, RPO/RTO ve kurumun beş yıllık audit saklama işletimi test edilmedi. SQL.js tam yedekler hassas kayıt içerir; checksum şifreleme veya imzalı bütünlük garantisi değildir.
- **Gerçek yük:** Native Store sentetik profilinin HTTP/browser p95 veya eşzamanlı gerçek kullanıcı kapasitesi sonucu olmadığı arşivde de yazıyor. Global yazma kilidi + bütün model validation'ının temsili veri hacmindeki davranışı ayrıca ölçülmeli. Ağır yük testi çalıştırılmadı.
- **Native Excel:** ZIP/XML geçerliliği ve seçili metin sınırları kontrol edildi. Kurum Office sürümünde onarma uyarısı, baskı, satır yüksekliği ve bütün workbook kombinasyonları elle açılmadı.
- **Başlatma/dependencies:** Çalışan sunucu mevcut temiz dependency cache yolunu kullanıyor; bu, normal başlatıcının sorunsuz yeniden başlatılabildiğini kanıtlamaz. Desktop dependency dosyalarındaki önceki takılmanın işletim sistemi kök nedeni bu tur doğrulanmadı. Y6 ayrı kabul işi.
- **Bağımlılık güvenlik veritabanı:** Lock dosyaları ve CI'deki npm audit kapısı incelendi; bu tur yeni dış advisory sorgusu yapılmadı. Güncel tüm paketlerin açığı olmadığı iddia edilmiyor.

## 4. Önerilen düzeltme sırası

1. **Y1:** Renk menüsü ve bar/not drag/resize için başlangıç hedefi + proje snapshot/revision çiftini koru; eşzamanlı iki yeniden üretimi kalıcı CI'ye koy. Davranış/veri bütünlüğü açısından ilk iş.
2. **Y2:** Ortak Excel yazıcısında geçersiz XML karakterini açık hatayla durdur; valid Unicode ve mevcut uzun metin devam satırlarını koru.
3. **Y3:** Mimari kalite kapısını recursive AST kontrolüne taşı; nested/side-effect negatif fixture ekle. Yeni backend domain değişikliklerini Windows/native test kapsamına al.
4. **Y4:** Önce doğru conflict mesajı; ardından gerekiyorsa ayrı katalog revision'ı. Eski formu otomatik güncel revision ile kaydetmeye dönme.
5. **Y6:** Tek dağıtım/başlatma kökü, lock dosyasından güvenilir kurulum ve kaynak/build doğrulamasını başlangıçta da garanti et. Temiz geçici ortamda launcher yeniden başlatma kabulünü tamamla.
6. **Y5 ve kurum kabulü:** Güncel kodla geçici MSSQL CI; sonra gerçek veri yerine kurum test ortamında minimum yetki, Windows/proxy/TLS, şifreli yedekten kurtarma ve temsili HTTP/browser yük kontrolü.

Yeni özelliklerin bütün iş kurallarını yeniden yazmak veya geniş refactor ilk adım olarak önerilmiyor. Ortak çekirdeğin korunması ve küçük, test edilebilir düzeltmeler daha uygun.

## 5. Kapsam dışında bırakılan hususlar

Üretim penetration testi, ağ/host taraması, kurum hesapları veya çalışan verisi, gerçek restore/migration, gerçek veriye göre hesap mutabakatı, tüm tarayıcı/Office/erişilebilirlik matrisi, tüm bağımlılık advisory'lerinin güncel teyidi ve hukuki saklama uygunluğu bu incelemenin kapsamında değildir.

Y1–Y4 audit bulguları bu tur düzeltilmedi. Yalnız kullanıcının ayrıca istediği picker konumu, seçenek kaynağı ve scroll düzeltmeleri uygulandı. Sonraki uygulama çalışması için önerilen ilk konu Y1'dir.
