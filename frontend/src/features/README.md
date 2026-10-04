# Ön yüz sorumlulukları

`App.tsx` oturumu ve ekranlar arasındaki bağlantıları koordine eder. Snapshot, filtre/seçim ve türetilmiş görünüm kendi hook/modüllerinde yönetilir. API'ye yazma ve snapshot yenileme mevcut `save` / `batch` yolunda kalır.

## Düzenleme akışı

| Dosya | Sorumluluk |
|---|---|
| `usePortalEditor.ts` | Taslak, form hatası, açma, kaydetme, silme ve kaynak statüsü geçişleri |
| `editor-state.ts` | Düzenleyicinin türlere ayrılmış veri sözleşmesi |
| `editor-commands.ts` | Taslağın doğrulanması ve revision içeren kayıt komutlarının hazırlanması |
| `editor-revisions.ts` | Açılış revision'larını yakalama; yenilenen snapshot'tan revision devralmama |
| `PortalEditorDialog.tsx` | Ortak pencere, başlık, hata alanı ve işlem düğmeleri |
| `editors/*EditorFields.tsx` | İlgili formun alanları ve taslak değişiklikleri |

Alan bileşenleri React fragment döndürür. Ek DOM sarmalayıcıları formun doğrudan çocuklarını hedefleyen CSS kurallarını değiştirebilir. İş kuralları form görünümüne kopyalanmamalıdır. Kayıt hatasında taslak ve hata açık kalır; başarılı kayıt tamamlanınca pencere kapanır.

Her `PortalEditor`, değerlerin alındığı snapshot'ın `baseRevisions` sözlüğünü taşır. Kaydetme ve açık editörden silme bu sözlüğü kullanır; arka plandaki yeni veriler revision'ı değiştirmez. 409 durumunda otomatik tekrar/üzerine yazma yapılmaz. Kullanıcı taslağı koruyabilir veya pencereyi kapatıp güncel kaydı yeniden açabilir. Aynı oturumda geçici okuma hatası taslağı kapatmaz; oturum değişimi önceki kullanıcının taslağını temizler.

İşbaşı kuralları `shared/resource-policy.ts`, gerçekleşen tablonun/Excel'in görünürlük kuralı `shared/actual-visibility.ts`, risk seçenekleri `shared/risk-policy.ts` içindedir. Görünürlük yardımcısı API yetkisi vermez; sunucu kapsam/yazma kontrolleri ayrı kalır.

## Proje zaman çizelgesi

| Dosya | Sorumluluk |
|---|---|
| `../ProjectTimelineRows.tsx` | Proje/aşama satırları, detayları açma ve başlıkların sıralanması |
| `../MilestoneTrack.tsx` | Aylık bar, haftalık detay, milestone, yerleşim ve önizleme çizimi |
| `useMilestoneDrag.ts` | Pointer capture, uzun basma, günlük taşıma, iki uçtan boyutlandırma ve iptal |
| `project-timeline-types.ts` | Satır ve zaman çizelgesi callback sözleşmeleri |
| `project-timeline-commands.ts` | Tarih/sıralama değişikliklerinden kayıt komutu hazırlanması |
| `position-pointer-tooltip.ts` | Fare konumu, viewport sınırı ve uygulama zoom'una göre tooltip konumu |
| `timeline-labels.ts` | Çizelgedeki ay ve gün metinlerinin biçimi |

Tarih doğrulaması ve alt notların etkisi `shared/milestone-ranges.ts` içinde kalır. Sürükleme hook'u önizlemede bu kuralları kullanır; gerçek kayıt mevcut komut ve batch yoluyla yapılır. Fareyle taşıma için 350 ms uzun basma, erken hareketin iptali, geçersiz tarihin kaydedilmemesi ve sürükleme sonrasındaki tıklamanın bastırılması korunur.

## Stil ve doğrulama

Stil yükleme sırası `../styles/manifest.json` ile belirlenir. Aynı seçicinin birden fazla dosyada olması tek başına tekrar sayılmaz: sonraki kurallar önceki görünümü tamamlayabilir. Ayrıntılar [stil kılavuzunda](../styles/README.md).

`npm run verify` biçim, mevcut testler, TypeScript ve üretim derlemesini denetler. Bileşen/CSS ayrıştırmasında ayrıca geçici veritabanıyla tarayıcıda form, seçim, sürükleme ve ekran görüntüsü karşılaştırması yapılmalıdır. Bir dosyanın kısalması performans artışı veya tüm uygulamanın mimari temizliğinin tamamlanması anlamına gelmez.

Risk, takvim, yetki/geçmiş ve içe aktarma/yedek akışları için depo kökünde `npm run test:ui` çalıştırılabilir. İzolasyon, tarayıcı kurulumu ve kapsam [tarayıcı test kılavuzunda](../../../BROWSER-TEST-KILAVUZU.md) açıklanır. Bu koşu `.env` veya gerçek veritabanını kullanmaz.

## Proje sırası ve sabit başlıklar

`useProjectRowOrder.ts` proje tutamacını, bırakma işaretini ve Alt + ↑/↓ kısayolunu yönetir. `project-order-commands.ts` filtre dışındaki projeleri koruyarak revision'lı komutlar hazırlar. Sıra `Project.sortOrder` / `kp_projects.sort_order` içinde saklanır; yalnız admin değiştirir. İlk sıralamaya kadar eski kayıtların mevcut sırası korunur; sıralanmış listeye yeni proje en alttan eklenir. İçerik güncellemeleri sıra alanını korur.

Her proje ayrı `TableBody` grubudur. Ortak `Table` içindeki `stickyProjectRows`, gerçek header yüksekliğini ve grubun bitişini ölçer; başlık yıl/ay altında kalır ve grubun sonunda yukarı çıkar. Yalnız CSS `sticky` kullanmak Chrome'da eski proje başlıklarının üst üste kalmasına yol açtığından grup sınırı ayrıca uygulanır. Projeler/gerçekleşen tabloda ve planlanan ekranın **Proje → Takımlar** görünümünde aktiftir. Normal/yönetici için yeni sıralama yetkisi eklenmez.

`test:ui` bu üç tabloyu ve kayıtlı sıralamayı da doğrular. Yatay sabitleme kontrolü, tablo alanı daraltılıp gerçekten yatay scroll oluştuğu denetlenerek yapılır.

Zaman çizelgesi hücresi kendi stacking context'ini oluşturur (`z-index: 0`, `isolation: isolate`). Bar, haftalık detay, baklava ve uç tutamaklarının hover/drag katmanları sabit sol etiketin üstüne çıkamaz. Body portal'ındaki açıklama ve sürükleme tooltip'leri bu sınırdan bağımsızdır.

## Risk düzenleme sürümü

`../RiskTable.tsx` tabloyu ve hata/çakışma alanını oluşturur; risk düzenleme akışı `risk-table/` altında ayrılır:

| Dosya | Sorumluluk |
|---|---|
| `risk-table/types.ts` | Tablo, taslak güncelleme ve ekranı terk etme sözleşmeleri |
| `risk-table/columns.ts` | Tür güvenli sütun/alan tanımları, başlık grupları, görünür sütunlar ve başlangıç odağı |
| `risk-table/RiskValue.tsx` | Kaydedilmiş değerlerin ve hesaplanan risk seviyelerinin görünümü |
| `risk-table/RiskCellEditor.tsx` | Sütun türüne göre düzenlenebilir alanlar ve silme düğmesi |
| `risk-table/useRiskDraft.ts` | Açılış değer/revision çifti, taslak, tek kayıt isteği, doğrulama, iptal, silme ve çakışma çözümü |
| `risk-table/useRiskTableInteraction.ts` | Odak, yeni satırı görünür yapma, satır dışına tıklama ve klavye etkileşimleri |

`useRiskDraft` açılış değerini ve revision'ı birlikte tutar; props yenilenince temel sürüm değişmez. Risk `onSave`/`onDelete` sözleşmesi açık revision parametresi alır. `onEditingChange` arka plan yenilemesini bekletir; önce başlamış okumalar için açılış sürümü kontrolü ayrıca gerekir. `ApiError.status === 409` taslağı koruyan çözüm ekranını açar. Kullanıcı onaylı yeniden yükleme yeni değer/revision çiftini kurar; otomatik yeniden bazlama veya üzerine yazma yapılmaz. Değiştirilmemiş taslak açılış değerine karşılaştırılarak yazmadan kapanır.

Sütun genişliği, grup başlığı kapsamı, alan sayısı ve düzenlenebilir alan seçimi aynı katalogdan gelir. Risk seçenekleri, puanlama ve doğrulama mevcut ortak politika/hesap modüllerinde kalır. Hücre bileşenleri ek DOM sarmalayıcısı oluşturmaz; CSS sınıfları ve satır davranışı korunur. Tab/Shift+Tab tarayıcının doğal odak sırasını kullanır; IME sırasında Enter kayıt tetiklemez, silme düğmesindeki Enter otomatik kayda dönüşmez. Tarayıcı testleri bu davranışların yanında 409/503, bekleyen kayıt ve uzaktan silinen taslağı denetler.


## Gerçekleşen kaynak dağılımı

`../PersonAllocationPanel.tsx` ekran state'ini ve mevcut `writeBatch` kayıt yolunu koordine eder. Görünüm ve etkileşim sorumlulukları `actual-allocation/` altında ayrılır:

| Dosya | Sorumluluk |
|---|---|
| `actual-allocation/types.ts` | Ekran, hücre seçimi, takvim/aşama state'i ve kayıt callback sözleşmeleri |
| `actual-allocation/useActualAllocationView.ts` | Görünür kişiler/hücreler, sayfalama ve snapshot'ın aylık toplamları |
| `actual-allocation/useActualCellSelection.ts` | Seçili kişi/ay bağlamı; dış tıklama, odak, Escape, kapsam/sayfa değişiminde temizleme |
| `actual-allocation/useActualCapacityDialog.ts` | Kapasite uyarısının state'i ve kapanışta giriş alanına odak dönüşü |
| `actual-allocation/ActualAllocationControls.tsx` | Başlık, seçili çalışan/ay, çalışma saati ve birim kontrolleri |
| `actual-allocation/ActualAllocationTable.tsx` | Yıl/ay başlıkları, sabit proje grupları, kişi girdileri ve dağıtım toplamı |
| `actual-allocation/ActualAllocationDialogs.tsx` | Takvim, kapasite uyarısı ve aşama pencerelerinin görünümü |
| `actual-allocation/format.ts` | Ekranın ortak Türkçe ay/sayı biçimleri |

Hesaplamalar `shared/actual-months.ts`, `shared/actual-units.ts` ve takvim kurallarında kalır. Aylık indeks tüm snapshot'tan oluşturulur; proje filtresi toplam tahsisi veya eğitim katkısını azaltmaz. `shared/actual-visibility.ts` yalnız görünümü belirler; yazma yetkileri sunucuda denetlenir. `actual-allocation-commands.ts` revision içeren komutları hazırlar; ayrı kayıt transport'u eklenmez.

`ActualAllocationInputs.tsx` mevcut taslak/validasyon/kayıt davranışını korur. Enter girdiyi kaydeder ve kaynak hücresi seçimini temizler; saat alanını boşaltmak otomatik takvime döner. Hatalı kayıt taslağı korur. Kapasite uyarısı açıkken dış odak hücre bağlamını temizlemez; kapanışta bağlı ve etkin giriş alanına odak geri verilir. Görünürlük/statü değişimi gerçekleşen kaydı silmez. Bileşen ayrımı tabloya ek DOM sarmalayıcısı getirmez; sabit proje başlığı ve CSS sınıfları korunur.

Tarayıcı kontrolleri yüzde/gün/saat dönüşümü, manuel/otomatik saat, dış tıklama/Escape/Enter seçimi, tam kapasite ve gelecek ay kilidi, uyarıdan odak dönüşü ve 503 sonrası açık taslak/retry akışlarını denetler. Ortak tatil, kişisel izin/eğitim, rol kapsamı ve sabit başlık kontrolleri aynı koşudadır.

## Çalışma takvimi

`../WorkCalendarDialog.tsx` pencere, yıl seçimi ve bölüm yerleşimini oluşturur. Takvim sorumlulukları `work-calendar/` altında ayrılır:

| Dosya | Sorumluluk |
|---|---|
| `work-calendar/types.ts` | Pencere sözleşmesi; komut hazırlayıcılarından türetilen ortak/kişisel form türleri |
| `work-calendar/useWorkCalendarEditor.ts` | Form state'i, açılış snapshot/revision'ı, yerel ortak taslak ve mevcut kayıt/silme akışı |
| `work-calendar/useWorkCalendarView.ts` | Seçili yılın ortak/kişisel kayıtları ve shared kurallardan aylık saat önizlemesi |
| `work-calendar/SharedCalendarSection.tsx` | Ortak tarih aralığı formu ve çalışma dışı tarih listesi |
| `work-calendar/PersonalCalendarSection.tsx` | Kişisel izin/eğitim formu ve kayıt listesi |
| `work-calendar/CalendarHoursSummary.tsx` | Önceden hesaplanmış aylık önizleme satırlarının görünümü |
| `work-calendar/format.ts` | Takvimin ay/tarih biçimleri |

Ortak tarih ekleme/silme yerel taslağı değiştirir; sunucuya yalnız **Takvimi Kaydet** ile yazılır. Açılış değeri ve revision birlikte kalır; props yenilenmesi taslağı yeniden bazlamaz. 409 ve geçici kayıt hatası taslağı açık tutar. Pencereyi kapatıp güncel verilerle yeniden açmak yeni taslak oluşturur. Kişisel kayıtlar mevcut `preparePersonalDayChange`/`preparePersonalDayRemoval` yoluyla tek tek kaydedilir.

Form güncellemeleri tür güvenli ve fonksiyoneldir; ortak tarihin silinmesi en güncel yerel taslaktan yapılır. Başlangıç değiştiğinde bitiş yalnız boşsa doldurulur. Açılış ve kayıt sonrası mevcut alan temizleme davranışı korunur. Busy durumunda alanlar/yıl kontrolleri kilitlenir ve pencere kapanışı engellenir; başarıdan sonra ortak kayıt pencereyi kapatır, kişisel kayıt listede kalır.

`calendar-commands.ts` doğrulama ve revision'lı komut hazırlığını; shared takvim/birim kuralları hafta sonu, tatil, izin ve eğitim hesabını yönetir. Bölüm bileşenleri API çağrısı veya hesaplama kuralı taşımaz. Form görünürlüğü yetki vermez; sunucu yetki ve kapasite denetimleri korunur. Yeni DOM sarmalayıcısı/CSS değişikliği eklenmez.

Tarayıcı testleri ortak tam/yarım gün, hafta sonu, kişisel saatlik izin/eğitim, günlük kapasite, rol kapsamı ve kaydı silmenin yanında ortak taslağın 503/retry ve yenilenen props sonrası 409 davranışını da denetler. Bekleyen ortak kayıtta Escape/X ile kapanış ve ikinci kayıt engeli kontrol edilir.

## Snapshot ve yenileme

`usePortalData.ts` veri/kimlik snapshot'ı, hata/bildirim ve mutation state'ini yönetir. `reload` başarısız okuma sırasında aynı oturumun snapshot/taslağını korur; gerçek kimlik kaybında verilen editör temizleme callback'ini çağırır. Yazma session guard ile başlar. Editor taslaklarının açılış revision'ı bu hook tarafından güncellenmez.

`usePortalRefresh.ts` ilk okumayı, generation polling'ini, storage bildirimini ve focusout yenilemesini koordine eder. Açık editör, risk taslağı, kayıt işlemi veya odaklı input/textarea/select varken dış yenileme bekletilir. Oturum epoch/kimlik doğrulaması `storage.ts` ve session root'ta kalır. `App.tsx` ekran, filtre ve kullanıcı eylemlerini koordine eder.

## Excel

`../xlsx-workbook.ts` workbook paket ilişkilerini ve indirme/URL temizliğini ortaklaştırır. Sheet yazarları metni inline string olarak üretir; risk formülleri yalnız risk yazarı içinde tanımlanır. `xlsx-cells.ts` metin/satır sınırını, kayıpsız devam satırlarını ve XML kaçışını sağlar. Her raporun stilleri, kolonları ve hesapları kendi modülünde kalır.

## Planlanan kaynak dağılımı

`PlannedAllocationPanel.tsx` yalnız kapasite özeti, sayfalama, dağılım tablosu ve alt açıklamayı bir araya getirir. Görünüm sorumlulukları `planned-allocation/` altında ayrılır:

| Dosya | Sorumluluk |
|---|---|
| `types.ts` | Mevcut ekran/etkileşim callback sözleşmesi; `usePlannedGrid`'den türetilen dar grid tipi |
| `PlannedCapacitySummary.tsx` | Açılıp kapanan kapasite özeti, belirgin filtre etiketleri ve özet tablo |
| `PlannedSummaryRows.tsx` | Önceden hesaplanan metric/project totals'tan aktif/tahsis/kalan satırların görünümü |
| `PlannedTableHeaders.tsx` | İki tablonun aynı colgroup, yıl ve ay başlıkları |
| `PlannedAllocationTable.tsx` | Takım/proje grupları, sabit proje başlığı ve proje toplamları |
| `PlannedAllocationRow.tsx` | Tahsis hücreleri, mevcut giriş callback'leri ve isteğe bağlı gerçekleşen satır |
| `PlannedTeamLabels.tsx` | Kişi rozeti, takım gerçekleşen satırını açma/kapama ve ortak görünürlük hesabı |
| `PlannedPhaseButton.tsx` | Döneme ve yoğunluğa göre aşama önizlemesi; mevcut açma/sağ tık callback'leri |

`usePlannedGrid.ts` seçim, otomatik odak, sürükleme, klavye/menü clipboard'u ve revision'lı toplu komutları yönetmeye devam eder. `AllocationCell.tsx` giriş taslağı, blur/Enter/Ctrl+Enter, hata/retry ve kapanış callback'ini korur. API yazma App'in mevcut `save`/`batch` yolundadır. Bu ayrıştırmada transport, iş politikası, revision hazırlığı veya yetki değişikliği yapılmadı. Rol, liderlik ve proje dönemi kontrolleri mevcut grid ve sunucuda kalır.

Seçim Set'i tablo başına bir kez oluşturulur; her satır aynı salt okunur Set'i kullanır. DOM/CSS sınıfları ve sabit proje grupları korunur; yeni HTML sarmalayıcısı eklenmez. Proje filtresi aktif olduğunda üst özetin tahsisi seçili projelerden, takım özetlerinin tüm proje tahsisi ise mevcut metric'ten hesaplanmaya devam eder.

`test:ui` gerçek fareyle ters aralık seçimi, Ctrl ile ek seçim, sol üst odak, Ctrl+Enter ile toplu giriş, Enter/dış tıklama/Escape ile temizleme, sıfır içeren 2×2 klavye ve sağ tık kopyalama/yapıştırma, 503 sonrası taslak/seçim korunması ve bekleyen retry sırasında alan kilidini denetler. Saf dikdörtgen/taşma/dönem kuralları mevcut `plan-cell-grid.test.mjs` içindedir. Bunlar native MSSQL/Windows veya tüm olası etkileşim sıralamalarının doğrulaması değildir.

## Çalışma alanı filtreleri ve görünüm

`workspace/` API çağrısı yapmadan ekran state'ini ve yetkili snapshot'tan türetilen verileri ayırır:

| Dosya | Sorumluluk |
|---|---|
| `workspace-options.ts` | Geniş plan bağlantısındaki filtre/dönem seçeneklerini doğrulama, bağlantıyı üretme ve sıfırlama bildirimi |
| `useWorkspaceFilters.ts` | Filtre, hücre/kaynak/kişi seçimi, sayfa, yoğunluk, açma/kapama state'i ve güncel tarih |
| `workspace-selectors.ts` | Saf takım/proje/kişi kapsamı, rapor grupları, filtre etiketleri, metric toplama ve sayfalama |
| `useWorkspaceView.ts` | Selector sonuçları ve mevcut shared kapasite/tahsis/toplam indekslerinin memo koordinasyonu |
| `useSynchronizedTableScroll.ts` | Plan–özet ve liderlik–takım tablolarının iki yönlü yatay kaydırması; dinleyici kurma/temizleme |

Sunucunun verdiği snapshot erişim sınırıdır; URL veya ekran filtresi yetki vermez. Kişi görünürlüğü `shared/actual-visibility.ts` üzerinden gelir. Kapasite indeksi tüm yetkili snapshot'ı kullanır; proje filtresi onu küçültmez. Üst plan özetindeki seçili proje tahsisi, tüm proje tahsisiyle yapılan takım/kalan kaynak hesabından ayrı tutulur. Shared iş kuralları çoğaltılmaz.

Filtre/dönem/arama/gruplama değişince hücre ve kaynak seçimi ile sayfalar temizlenir. Kişi filtresi mevcut davranış gereği normal filtre değişiminde korunur; **Filtreleri Sıfırla** kişi seçimini de temizler ve içinde bulunulan yılın ocak ayı/12 ay/aylık ayrıntılı görünümüne döner. Yıl değişiminde yalnız önceki yılın varsayılan ocak başlangıcı güncellenir; özel başlangıç korunur. Sekme değişimi tek başına filtreleri sıfırlamaz.

Kaydırma hook'u tablolar veriyle oluşturulduktan sonra etkinleştirilir. Doğrudan geniş plan bağlantısı veya varsayılan Raporlar sekmesiyle açılışta boş ref nedeniyle dinleyici kurulamaması böyle önlenir. Özet yeniden açılınca, sekme/dönem/ölçü değişince dinleyiciler yeniden kurulur; kapanışta kaldırılır.

`workspace-view.test.mjs` URL sınırları/round-trip, kapsam/sayfalama ve hesap ayrımını saf sentetik veriyle denetler. `workspace-filters.mjs` tarayıcıda seçim temizliği, filtre sıfırlama, özet/rapor hesapları, ilk açılış ve yeniden açılma sonrası gerçek yatay kaydırmayı denetler. Mevcut rol, taslak ve sekmeler arası oturum regresyonları da tam koşuda korunur.


## Çalışma alanı dışa aktarma ve veri eylemleri

`workspace/` altındaki controller fabrikaları her App render'ında o snapshot'ın callback'lerini oluşturur. React hook'u çağırmaz, ayrı state veya transport oluşturmaz; dar state/işlem sözleşmeleri mevcut `usePortalData` dönüş tipinden türetilir.

| Dosya | Sorumluluk |
|---|---|
| `workspace-exports.ts` | Aktif sekmenin filtreli takım/proje/kişi görünümünü mevcut Excel yazarına göndermek; hata mesajını App'e döndürmek |
| `resource-report-data.ts` | Kaynak raporunun saf grup/ay/çalışan sayısı ve filtre metni hazırlığı |
| `workspace-data-actions.ts` | Tüm planlanan tahsisleri sıfırlama, seçili kaynakları silme, JSON yedek indirme/yükleme; onay, hata ve seçim temizliği |
| `project-actions.ts` | Proje/başlık sırası ve bar/not tarih eylemlerini mevcut revision'lı komut hazırlayıcıları ve batch yoluyla koordine etmek |

Kaynak raporunda çalışan sayısı seçili başlangıç ayının versiyonu, dahil bilgisi, çalışma statüsü ve tarih örtüşmesinden gelir. Bu rapor ölçüsü kapasite kişi eşdeğeriyle aynı ölçü değildir. Ayların kalan kaynağı mevcut tüm-proje metric'inden gelir. Excel paket/stil/limit kuralları ve gerçekleşen görünürlük politikası mevcut yazar/shared modüllerinde kalır.

Toplu silme ID'leri tekilleştirir; açık uyarıdan sonra mevcut `change`/`batch` yolunu kullanır. Hata durumunda seçim kalır; başarıda yalnız silinen ID'ler seçimden çıkar. Global sıfırlama tüm snapshot'ın planlanan tahsislerine uygulanır; ekrandaki takım/proje/dönem filtreleri işlemi sınırlamaz. İptalde API çağrısı yapılmaz. Mevcut busy ve hata davranışı korunur.

Yedek işlemleri önce risk taslağı için mevcut `flushRiskDraft` kontrolünü, sonra oturum guard'ını kullanır. Restore dosya input'u asenkron işlemden önce yakalanır; iptal/başarı/hata sonunda temizlenir. Restore ve sıfırlama API/generation/revision denetimlerini storage/backend katmanından devralır. Sunucu yetkileri belirleyicidir; controller UI kontrolleri yeni bir yetki sağlamaz. Sekme geçişi, risk leave guard ve çıkış koordinasyonu App'te kalır.

`resource-report-data.test.mjs` tarih/statü/dahil/transfer, ay-sıra/aşım, yönetici fallback'i, kapsam ve filtre metnini sentetik veriyle denetler. `workspace-actions.mjs` dört sekmenin Excel çıktısını, normal kullanıcının kendi kaynağını, global sıfırlamanın iptal/503/retry ve filtre dışı dönem etkisini, toplu silmenin iptal/409/başarı ve bağlı gerçekleşen kayıt etkisini kontrol eder. Mevcut yedek/restore, risk taslağı, oturum ve zaman çizelgesi kontrolleri tam koşuda da çalışır.
