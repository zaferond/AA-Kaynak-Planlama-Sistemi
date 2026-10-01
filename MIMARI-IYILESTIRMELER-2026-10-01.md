# Mimari ve Güvenlik İyileştirmeleri

Tarih: 1 Ekim 2026  
Referans: 30 Eylül 2026 tarihli mimari ve güvenlik incelemesi; başlangıç Git sürümü `4c60665`.

## Özet

İnceleme raporundaki doğrulanmış davranış hataları düzeltildi. İş kuralları ortak `shared/` katmanına taşındı, değişiklik geçmişi eklendi ve kalite kontrolleri otomatikleştirildi. Ana ekranın modülerleştirilmesi ilerledi; büyük stil dosyası kural sırası korunarak bölündü. Veritabanının tüm veri kümesini işleyen yapısı, kalan ekran modülleri ve stil tekrarlarının sadeleştirilmesi açık çalışmalardır.

## Bulguların durumu

| No | Bulgu | Yapılan işlem | Durum |
|---|---|---|---|
| 1 | İzin/eğitim ve takvim sonrası %100 aşımı | Etkilenen kişi/ayların toplamı toplu işlemin sonunda denetleniyor. Mevcut proje saatleri korunuyor; aşım kaynak ve ay belirtilerek reddediliyor. | Düzeltildi |
| 2 | Proxy arkasında ortak giriş sınırı | Güvenilen proxy adresleri açıkça tanımlanıyor. Başarılı girişler kotayı tüketmiyor. Sahte yönlendirme başlığına güvenilmiyor. | Kod düzeltildi; şirket proxy ayarı ayrıca gerekli |
| 3 | Eski ağ yanıtının yeni veriyi geri alması | Veri sürümü ve oturum nesli kontrolü; eski yanıtın kullanıcı/veri/oturum durumunu geriye çevirmesi engellendi. | Düzeltildi |
| 4 | Üst not tarihinin ekranlara göre değişmesi | Düzenleyici, rapor ve detay sürükleme aynı genişletme kuralını kullanıyor; elle genişletilmiş üst tarihler korunuyor. | Düzeltildi |
| 5 | İzin/eğitim model farkı | Ortak yarım saat şeması, aynı güne ayrı izin/eğitim kaydı, eski kimliklerle uyumluluk ve günlük toplam kontrolü. | Düzeltildi |
| 6 | Vite açığı / eski bağımlılıklarla başlama | Vite 8.0.16; başlatıcılar paket/kilit dosyası değişiminde yeniden kurulum yapıyor. | Düzeltildi |
| 7 | Çok sorumluluk taşıyan App | Tablo seçimi/pano hook'u, düzenleme diyaloğu, rapor tablosu, filtre/hücre/kişi bileşenleri ayrıldı. Düzenleyici ve değişiklik komutları tipli hale getirildi. | Kısmen tamamlandı |
| 8 | Sunucu domain'inin frontend çıktısına bağlı olması | Kaynak modeller/şemalar/hesaplamalar `shared/` altında. Node 24 aynı kaynakları doğrudan çalıştırıyor; eski derlenmiş kopya bağımlılığı kaldırıldı. | Tamamlandı |
| 9 | Her kayıtta tüm veri kümesinin işlenmesi | Alt kayıt temizleme sorguları ilgili kayıt kimliklerine yöneltildi; tüm alt tablo okunmuyor. Snapshot okuma, tüm veri doğrulaması ve global MSSQL kilidi devam ediyor. | Kısmen tamamlandı |
| 10 | Tekrarlanan iş kuralları ve sabitler | Kaynak kapasitesi, risk bantları/Excel renkleri, organizasyon kataloğu, saat şeması, tarih sınırları ve XML yardımcıları ortaklaştırıldı. | Listelenen örnekler tamamlandı; yeni tekrarlar için kod incelemesi sürmeli |
| 11 | Değişiklik geçmişi yokluğu | Şema 25; işlemle aynı transaction'da alan farkları, kişi ve zaman kaydı. Yöneticiye özel sayfalı görüntüleme. | Tamamlandı |
| 12 | Büyük JSON isteklerinin erken ayrıştırılması | Origin kontrolü önce; giriş 4 KB; oturum kontrolü sonrası normal uçlar 2 MB. Toplu değişiklik/içe aktarma/yedek uçları 20 MB. | Kısmen tamamlandı; toplu işlem yük limiti ölçülmeli |
| 13 | CSS/otomasyon düzeni | Prettier, zorunlu TypeScript kontrolü, kaynak bağımlılık kontrolü, test/build/audit CI iş akışı eklendi. | Otomasyon ve CSS dosyalarının ayrılması tamamlandı; stil sadeleştirme ve tarayıcı otomasyonu açık |

## Kullanıcıya yansıyan davranışlar

- Aynı güne izin ve eğitim ayrı kayıt olarak girilebilir. İzin çalışma saatini azaltır; eğitim kalan çalışma saatindeki dağıtım hesabına katılır. Eski kişisel takvim kayıtları korunur.
- Takvim, izin veya eğitim değişikliği mevcut tahsisi %100 üstüne çıkarıyorsa kayıt reddedilir. Aynı toplu işlemde tahsis de düzeltilmişse son durum üzerinden karar verilir.
- Yönetici, **Yetki Kontrol Ekranı → Değişiklik Geçmişi** üzerinden alan değişikliklerini görebilir. Normal kullanıcı ve yönetici olmayan liderler bu geçmişi okuyamaz.
- Parola/oturum bilgileri, kaynağın özel notu ve kişisel izin açıklaması geçmişe yazılmaz. Geçmişteki kayıtlar silme işleminden sonra da izlenebilir.
- Tarih kabul aralığı 2000–2199 olarak ortaklaştırıldı. Filtre başlangıcı en uzun görünümün son yılı aşmasını önler. Excel tarih girişleri de aynı kuralı kullanır.

## Doğrulama

- `npm run verify`: **119 test başarılı**; biçim kontrolü, ortak kaynak kontrolü, TypeScript kontrolü ve üretim derlemesi başarılı.
- Kök ve frontend `npm audit`: 1 Ekim 2026 kontrolünde **0 bildirilen açık**. Bu sonuç kapsamlı sızma testi anlamına gelmez.
- Eklenen senaryolar: işlem sırası ve toplu düzeltme, eski ağ yanıtı/eski oturum, proxy ve sahte başlık, gövde limitleri, aynı gün izin/eğitim, tarih sınırları, denetim geçmişi yetkisi/sayfalama/kalıcılık/transaction geri alma.
- Aynı gün eski kimlikli eğitim ve yeni kimlikli izin kaydının birlikte yeniden başlatma sonrası korunması doğrulandı.
- Gerçek MSSQL sunucusunda eşzamanlılık/yük testi ve Windows başlatma testi çalıştırılmadı. CI dosyası hazır; GitHub üzerinde henüz çalıştırılmadı.
- Canlı tarayıcı kontrolü için bilgisayar erişimi denendi; Accessibility/Screen Recording izinleri beklediğinden görsel ve fare/klavye akışları tamamlanamadı. Çoklu seçim hesaplama testleri, gerçek tarayıcı etkileşim testlerinin yerini tutmaz.

## Kurulum ve veri güvenliği

- Node.js 24 veya üzeri gerekir; `shared/` klasörü dağıtıma dahil edilmelidir.
- Yerel SQL.js veritabanı şema 25'e otomatik yükseltilir. MSSQL'de yedek sonrası migration hesabıyla `npm run db:migrate` gerekir.
- Proxy varsa `TRUST_PROXY` kurumun gerçek proxy IP/CIDR adresleriyle ayarlanmalıdır; doğrudan yerel kullanımda boş kalabilir.
- Değişiklik geçmişi bu sürüm sonrasında başlar. Geçmiş hareketler geriye dönük oluşturulmaz. Uygulamanın JSON yedeği audit kayıtlarını içermez; tam veritabanı yedeği gerekir.
- Yerel uygulama `http://localhost:3000` adresinde güncel derlemeyle başlatıldı. Ana sayfa ve JS/CSS dosyaları HTTP 200 döndü; sunulan HTML güncel derlemeyle eşleşti.
- Güncelleme öncesi kaynak kodu, derlenmiş site ve veritabanı yedeklendi: `../AA Kaynak Yedekleri/mimari-20261001-080857` (ana uygulama klasörüne göre).
- Şema güncellemesi sonrası mevcut 18 tablonun içerikleri yedekle karşılaştırıldı; fark yok. Şema sürümü 25 olarak doğrulandı.
- Git deposundaki 119 testin yanında yerel çalışma kopyasının 118 testi de başarılı. Yerel kopyanın önceden farklı olan not tarihi test dosyası ve başlatma betiklerinin davranışı korundu.
- İlk iyileştirme paketi `241c66a` commit’i ile `origin/main` dalına push edildi. Uzak dalın aynı commit’i gösterdiği doğrulandı.

## Sonraki çalışma sırası

1. Tarayıcı erişimiyle planlama seçim/sürükleme, Ctrl+Enter, kopyala/yapıştır, risk satırı otomatik kayıt, not tarihleri ve geçmiş ekranının kullanıcı akışlarını doğrulamak.
2. Ayrı MSSQL test veritabanında aynı hücreye çakışan yazmalar, farklı projelere paralel yazmalar, büyük veri ve eşzamanlı takvim değişiklikleri için yük ölçümü yapmak.
3. Ölçüme dayanarak hedefli repository/komut işlemlerine geçmek; global kilidi ancak bütünlük testleriyle birlikte değiştirmek.
4. App'in kalan sekmelerini ve düzenleme komutlarını ayırmak; CSS dosyasını mevcut cascade sırasını ve görsel sonuçları koruyarak özelliklere bölmek.
5. Audit kayıtlarının saklama/arşivleme politikasını ve çok sunuculu kurulumda ortak giriş sınırı deposunu belirlemek.

## İkinci adım — düzenleyici kayıt kurallarının ayrılması

İlk paket push edildikten sonra bilgisayar erişimi tekrar kontrol edildi; izinler verilmediğinden tarayıcı testi hâlâ bekliyor. Bunun yerine ana ekranın modülerleştirmesine devam edildi.

- `features/editor-commands.ts` eklendi. Proje/aşama, kritik konu, kaynak ve toplu kaynak düzenlemesi ayrı fonksiyonlarla kayıt komutlarına dönüştürülüyor.
- Bu fonksiyonlar ağ isteği yapmıyor, React durumunu değiştirmiyor ve verilen veri/draft nesnelerini değiştirmiyor. Ana ekran yalnızca komutları gönderiyor ve kayıt sonucunu gösteriyor. Sunucu yetki, revizyon ve doğrulama kontrolleri korunuyor.
- Seçilen takım veya çalışan arada kaldırılmışsa teknik hata yerine açıklayıcı mesaj veriliyor. Toplu listede aynı çalışan iki kez gelirse tek kayıt hazırlanıyor.
- Sekiz yeni test; tarih çakışması, boş detaylı kritik konu, proje dönemi, takım/liderlik, revizyon çakışması, eski kaynak sürümleri, yinelenen/eksik seçim ve kaynak nesnelerinin değişmemesi senaryolarını kapsıyor. Geçerli komutlar sunucuya uygulanıp domain doğrulamasından da geçiriliyor.
- `npm run verify`: **127/127 test başarılı**, format, TypeScript ve üretim derlemesi başarılı.
- Bu ikinci adım yerel uygulamaya aktarıldı. İkinci paketin değişiklikleri henüz commit/push edilmedi; Git’teki gönderilmiş sürüm `241c66a`.
- Ana ekranın kalan sekmeleri, CSS ayrıştırması ve gerçek MSSQL yük testi henüz tamamlanmadı.

## Üçüncü adım — proje tablosu ve zaman çizelgesi işlemleri

- Proje tablosu `ProjectTimelinePanel.tsx` bileşenine taşındı. Aylık/haftalık dönem üretimi, sayfalama, başlıklar ve satır eylemleri artık bu bileşende bir arada.
- `TimelineHeaders.tsx` ile yıl/ay başlıklarının biçimi ve altı renkli yıl bandı ortaklaştırıldı. Planlanan dağılım, proje ve kalan kaynak rapor tabloları aynı bileşenleri kullanıyor. Mevcut CSS kuralları değiştirilmedi.
- Bar taşıma, başlangıç/bitiş uzatma ve detay notu tarih değiştirme işlemleri `project-timeline-commands.ts` içinde ortak bir kayıt hazırlama fonksiyonuna bağlandı. Güncel proje alanları ve revizyonu korunuyor; ağ isteği ve kullanıcı mesajları ana ekranda kalıyor.
- Beş yeni regresyon testi, hazırlanan komutları sunucuya uygulayarak taşıma/uzatma, üst tarih genişlemesi, çakışma, proje sınırları, revizyon ve diğer kayıtların korunmasını doğruluyor.
- `npm run verify`: **132/132 test başarılı**; biçim kontrolü, TypeScript kontrolü ve üretim derlemesi başarılı.
- Yerel uygulama güncel derlemeyle yenilendi. Tarayıcı görsel/etkileşim kontrolü erişim izni olmadığı için hâlâ bekliyor; otomatik testler bu kontrolün yerine geçmez.
- İkinci ve üçüncü adımların değişiklikleri yerelde; gönderilmiş son Git commit’i hâlâ `241c66a`.

### Güncel kalan iş sırası

1. CSS dosyasını mevcut cascade sırasını koruyarak bölmek; ana ekranın kalan sekme/menü işlemlerini aşamalı olarak ayırmayı sürdürmek.
2. Tarayıcı erişimi açılınca seçim, sürükleme, otomatik kayıt, tarih ve yeni değişiklik geçmişi ekranlarını kontrol etmek.
3. Ayrı MSSQL test ortamında eşzamanlılık/yük ölçümü yapmak; sonuçlara göre hedefli veri sorgularına geçmek.
4. Değişiklik geçmişi için saklama/arşivleme, çok sunuculu kullanım için ortak giriş sınırı deposunu hazırlamak.

## Dördüncü adım — CSS dosyalarının ayrılması

- 6.645 satırlık `frontend/src/upgrade.css`, `frontend/src/styles/` altında 28 CSS dosyasına ayrıldı. Çalışma alanı, projeler, planlama, çalışanlar, raporlar, yönetim, takvim ve ortak bileşenler ayrı dizinlerde.
- Cascade sırası `manifest.json` ile açıkça tanımlandı. `frontend/styles.mjs` bu sırayla tek CSS çıktısı oluşturuyor; tarayıcı için CSS isteği sayısı artmadı. Temel CSS → çalışma alanı → giriş ekranı → Vite bileşen stilleri sırası korundu.
- Derleme; listede olmayan, eksik, yinelenmiş veya izin verilen dizinin dışına çıkan stil dosyalarını reddediyor. Üç yeni test bu denetimleri ve alfabetik sıra yerine manifest sırasının kullanılmasını kapsıyor.
- **Doğrulama:** Ayrıştırılmış eski/yeni CSS ağaçları karşılaştırıldı. Hem çalışma alanı kuralları hem de tüm üretilmiş CSS için seçiciler, bildirim değerleri, media query sınırları, yorumlar ve kural sırası aynı. Yalnızca dosya sınırlarındaki biçimsel boşluklar farklı. `!important` sayısı 59 olarak korundu.
- Çalışma alanı CSS ağaç özeti (SHA-256): `28d9d3d61b03aa5f6bcda7052b76b6a66148d89eb018215c609ba853c205aa4c`.
- Tüm üretilmiş CSS ağaç özeti (SHA-256): `569f553c656c7a4e460002d1f65c3e9b9158c3ca1fd315b1dca1131eb020e0f2`.
- `npm run verify`: **135/135 test başarılı**; biçim kontrolü, TypeScript ve üretim derlemesi başarılı. Yerel uygulama yeni derlemeyle güncellendi; kaynak ve site yedeği alındı.
- Bu adım stil dosyalarının sorumluluklara göre ayrılmasıdır. Birbirini tamamlayan/üstüne yazan kurallar ve `!important` kullanımları henüz azaltılmadı. Görsel tarayıcı doğrulaması erişim izni nedeniyle hâlâ bekliyor.
- İkinci, üçüncü ve dördüncü adımlar yerelde; gönderilmiş son Git commit’i `241c66a`.

### Bundan sonraki işler

1. Ana ekranın kalan menü ve sekme işlemlerini ayırmak; görsel kontroller mümkün olduğunda tekrarlanan stilleri sadeleştirmek.
2. Tarayıcı erişimiyle seçim, sürükleme, otomatik kayıt, tarihler ve değişiklik geçmişi ekranlarını doğrulamak.
3. Ayrı MSSQL test ortamında eşzamanlılık/yük ölçümü ve hedefli veri sorguları.
4. Değişiklik geçmişinin saklama/arşivleme düzeni ve çok sunuculu giriş sınırı deposu.

## Beşinci adım — proje sağ tık menüleri ve pano işlemleri

- Ana ekrandaki aşama/bar sağ tık menüleri `ProjectContextMenus.tsx` bileşenine; açık menü, Escape, odak ve pano durumu `useProjectMenus.ts` hook'una taşındı.
- Metin, renk ve metin+rengi birlikte yapıştırma işlemleri aynı kayıt yolundan geçiyor. Kayıt komutları `project-clipboard.ts` içinde ağ isteği ve React durumundan bağımsız hazırlanıyor.
- Ekranda gösterilen ve kopyalanan varsayılan aşama rengi ortak `phaseColor` fonksiyonundan hesaplanıyor. Boş/ÇALIŞMA YOK aşamaları gri, dolu aşamalar mavi; açıkça seçilmiş renk korunuyor.
- Metin yapıştırırken hedefin rengi, renk yapıştırırken hedefin metni korunuyor. Birlikte yapıştırma boş metinleri de aktarabiliyor. Bar rengi değiştirilirken yalnızca seçilen tarih aralığı etkileniyor; detay tarihleri, rapor/tamamlandı seçimleri ve diğer proje alanları korunuyor.
- Menü açıldıktan sonra kaldırılmış proje/konu/aralık ya da geçersiz renk için açık hata veriliyor. Önceden geçersiz aralıkta değişiklik olmadan başarı mesajı alınabiliyordu; bu durum düzeltildi.
- Yedi yeni test; ayrı/birlikte yapıştırma, varsayılan renk, ilgili aralık, kaynak verinin değişmemesi, proje dönemi, eksik hedef, geçersiz renk, sunucu yetkisi ve revizyon çatışmasını kapsıyor.
- `npm run verify`: **142/142 test başarılı**; biçim kontrolü, TypeScript ve üretim derlemesi başarılı.
- Tarayıcı erişimi tekrar denendi; Accessibility/Screen Recording izinleri beklediğinden görsel ve klavye/fare akışları tamamlanamadı. Bu sınırlama devam ediyor.
- Yerel kaynak ve derleme yedeği alındı; uygulama yeni derlemeyle güncellendi. Son gönderilmiş Git commit’i `241c66a`; sonraki geliştirme paketleri henüz commit/push edilmedi.


## Altıncı adım — planlanan kaynak dağılımı tablosunun ayrılması

- Planlama tablosu, kapasite özeti, takım/proje yönelimleri, dönem başlıkları ve sayfalama `PlannedAllocationPanel.tsx` bileşenine taşındı. Ana ekran filtreleri, kayıt işlemlerini ve seçim kontrolünü yönetmeye devam ediyor.
- Mevcut `usePlannedGrid` kontrolü ve tablo referansları korundu. Çoklu seçim, Ctrl+Enter, kopyalama/yapıştırma, sağ tık, gerçekleşen satırların görünürlüğü ve iki tablonun yatay kaydırma eşleştirmesi aynı durum ve callback akışını kullanıyor.
- Eski ve yeni bileşenin statik HTML çıktıları 24 senaryoda birebir karşılaştırıldı: iki yönelim, üç yoğunluk, kapasite özetinin açık/kapalı olması ve gerçekleşen satırların görünürlüğü. Tüm çıktılar aynı. Bu karşılaştırma tarayıcıda fare/klavye etkileşimi testi değildir.
- `npm run verify`: **142/142 test başarılı**; biçim kontrolü, TypeScript ve üretim derlemesi başarılı. `git diff --check` başarılı.
- Yerel kaynak ve site yedeği alındı; çalışan uygulama yeni derlemeyle güncellendi. CSS çıktısı değişmedi.
- Tarayıcı görsel/etkileşim doğrulaması izinler nedeniyle bekliyor. Ana ekranın diğer sorumlulukları, MSSQL yük testi ve saklama/arşivleme politikası kalan işler arasında.
- Gönderilmiş son Git commit’i `241c66a`; sonraki adımlar yerelde, henüz commit/push edilmedi.


## Yedinci adım — çalışan ve kaynak ekranının ayrılması

- Kaynak arama, tarih/liderlik/takım filtreleme, sayfalama, satır gösterimi ve toplu işlem araçları `features/ResourcesPanel.tsx` bileşenine taşındı. Ana ekran kaynak listesini başka sekmeler açıkken gereksiz yere filtrelemiyor.
- Arama, seçili kayıtlar, sayfa ve içe aktarma panelinin görünürlük durumları ana ekranda kaldı. Sekme değiştirildiğinde önceki durumun korunması devam ediyor. Kaynak düzenleme/silme, toplu düzenleme ve içe aktarma sonrası güncelleme aynı callback yollarını kullanıyor; sunucu yetki/revizyon kontrolleri değiştirilmedi.
- Eski/yeni statik HTML çıktıları 56 durumda birebir aynı: geçmiş/gelecek kayıt tarihleri, atanmış/atanmamış takım, liderlik ve takım filtreleri, Türkçe arama, farklı statüler, seçili/tüm seçili kayıtlar, boş sonuç, sayfalama, kayıt sırasında pasif düğmeler ve Excel içe aktarma paneli açık/kapalı. Bu kontrol tarayıcı etkileşim testi değildir.
- `npm run verify`: **142/142 test başarılı**; biçim kontrolü, TypeScript ve üretim derlemesi başarılı. `git diff --check` başarılı. CSS çıktısı önceki sürümle birebir aynı.
- Kaynak ve site yedeği alındı; yerel uygulama güncellendi. `localhost:3000` HTML ve JavaScript/CSS varlıklarının yeni derlemeyle aynı olduğu doğrulandı.
- Tarayıcı etkileşim kontrolü erişim izinlerini bekliyor. Son gönderilmiş commit hâlâ `241c66a`; sonraki geliştirmeler henüz commit/push edilmedi.

### Güncel sıradaki işler

1. Ana ekranın başlık, filtre ve gezinme sorumluluklarını ayırmak; kayıt komutlarının kalan kısımlarını sadeleştirmek.
2. Tarayıcı erişimiyle çoklu seçim, sürükleme, otomatik kayıt, not tarihleri ve değişiklik geçmişi akışlarını doğrulamak; ardından CSS tekrarlarını azaltmak.
3. Ayrı MSSQL test ortamında eşzamanlılık/yük ölçümleri ve hedefli veri sorguları.
4. Değişiklik geçmişinin saklama/arşivleme düzeni ve çok sunuculu giriş sınırı deposu.


## Sekizinci adım — başlık, filtre ve gezinme alanlarının ayrılması

- Ana başlık, kullanıcı/default sekme ve yedek düğmeleri `WorkspaceHeader.tsx`; tam ekran çalışma başlığı aynı dosyadaki `FullPlanHeader` bileşenine taşındı.
- Ana sekmeler, rol bazlı görünürlük, yoğunluk, takım/proje yönelimi ve dışa aktarma düğmesi `WorkspaceNavigation.tsx` içinde. Ana sekme referansı ve aktif sekmeyi görünür alana kaydıran mevcut effect korundu.
- Liderlik/takım/proje/kişi filtreleri, ay/dönem, filtre sıfırlama ve gerçekleşen/haftalık/detay seçenekleri `WorkspaceFilters.tsx` içinde. Filtre durumları, seçim temizleme ve sayfa sıfırlama effect'i ana ekranda kaldı. Picker sıfırlama anahtarı korunuyor.
- Yedek yükleme, çıkış ve sekmeye göre dışa aktarma işlemleri ana ekranda adlandırılmış fonksiyonlara alındı. Sunucu işlemleri, dosya onayı, hata mesajları, revizyon ve yetki kontrolleri aynı akışta kaldı. Bu çalışmada gerçek yedek yüklenmedi veya veri değiştirilmedi.
- Eski/yeni statik HTML çıktıları **453 karşılaştırmada birebir aynı**: dört oturum/rol durumu, dokuz sekme, üç yoğunluk, filtreli/varsayılan seçimler, tam ekran başlığı, yüklenmekte olan veri ve boş takım/proje sonuçları. CSS çıktısı önceki sürümle birebir aynı.
- Doğrudan callback kontrolleri liderlik değişince uyumsuz takımların çıkarılmasını, liderlik filtresi temizlenince takım seçiminin korunmasını, boş/geçersiz/destek dışı başlangıç aylarının reddedilmesini, geçerli ayı, kısa dönemde genel görünümden ayrıntılı görünüme geçişi ve gerçekleşen satır anahtarında genişletilmiş takımların sıfırlanmasını doğruladı. Eski/yeni callback sonuçları aynı. Bu kontroller gerçek tarayıcı fare/klavye testi değildir.
- `npm run verify`: **142/142 test başarılı**; biçim kontrolü, TypeScript ve üretim derlemesi başarılı. Kullanılmayan iki import kaldırıldıktan sonra biçim, TypeScript ve üretim derlemesi tekrar başarılı. `git diff --check` başarılı.
- Ana ekran bu adımda 1.850 satırdan 1.505 satıra indi. Kaynak/site yedeği alındı; yerel uygulama güncellendi ve HTTP HTML/JS/CSS varlıkları yeni derlemeyle doğrulandı.
- Tarayıcı görsel/etkileşim doğrulaması erişim izni nedeniyle bekliyor. Ayrı MSSQL ortamında yük/çakışma testleri ve audit saklama/arşivleme politikası henüz tamamlanmadı. CSS tekrarı azaltılmadan önce görsel kontrol gerekli.
- Gönderilmiş son commit `241c66a`; devam paketleri yerelde, henüz commit/push edilmedi.


## Dokuzuncu adım — eşzamanlı kayıt ve veri bütünlüğü kontrolleri

### Çalışma kopyasının doğrulanması

- Kullanıcının açık çalışma klasörü `AA Kaynak Planlama Sistemi_1.0.0`; Git deposu bunun içindeki `AA Kaynak Planlama Sistemi` dizini. Ön yüz, UI bileşenleri, ortak kurallar, backend uygulama dosyaları ve derleme betikleri karşılaştırıldı; uygulama kodlarında fark yok. Yerelde yalnızca macOS `.DS_Store` dosyası ek olarak bulunuyor.
- Sunucunun durmuş olduğu görüldü; mevcut `.env` ve veritabanıyla tekrar başlatıldı. Sunulan HTML/JS/CSS dosyaları son kontrol edilen derlemeyle birebir aynı.
- Chrome erişimi tekrar denendi: bilgisayar kullanım izinleri verilmediğinden gerçek tarayıcı kontrolü yapılamadı. Yerelde `DB_PROVIDER=sqljs`; MSSQL sunucusu ve `TEST_DB_DATABASE` tanımlı değil. Canlı/veri içeren bir MSSQL veritabanına bağlanılmadı.

### Yeni test kapsamı

- `tests/concurrency-suite.mjs` iki ayrı kullanıcı oturumuyla gerçek HTTP isteklerini uygulama, yetki, domain ve SQL adapter katmanlarından geçiriyor. `NODE_ENV=test` zorunlu; yerel koşucu sistemin geçici dizininde ayrı veritabanı oluşturup test sonunda kaldırıyor.
- Aynı hücre için 12 eşzamanlı kayıt: bir başarı, 11 revizyon çakışması; yalnızca tek değer, tek revizyon, tek generation artışı ve tek audit olayı kaydediliyor.
- Farklı hücreler için 24 paralel kayıt: tüm değerler/revizyonlar ve audit kayıtları korunuyor; generation 24 artıyor.
- Ortak hücresi olan iki toplu işlem: kaybeden işlemin önceki hücre yazması da geri alınıyor. Audit, revizyon ve generation yalnızca başarılı işlemden etkileniyor.
- Aynı çalışana ayrı projelerden iki eşzamanlı %70 gerçekleşen dağılım: bir kayıt kabul, diğeri %100 sınırı nedeniyle red; reddedilen işlem iz bırakmıyor.
- Ortak çalışma takvimi değişikliği ve %100 gerçekleşen giriş eşzamanlı olduğunda, işlem sırasına göre ikinci değişiklik reddediliyor veya yeni çalışma saatleri üzerinden giriş kaydediliyor. Kaydedilen saatler, yüzdeler, takvim, audit ve generation birlikte tutarlı.
- Sekiz iki-hücreli toplu yazma sırasında iki okuyucu toplam 16 HTTP görüntüsü alıyor; hiçbir görüntüde toplu işlemin yarısı görünmüyor. Değerler ve revizyonlar aynı işlem sınırında.
- Yerel veritabanı kapanıp açıldıktan sonra değerler, revizyonlar, generation, kullanıcı verileri ve audit toplamı korunuyor.
- Ortak senaryolar MSSQL entegrasyon koşucusuna da bağlandı. Mevcut HTTP entegrasyon paketinin ardından aynı suite'in çalışabildiği ayrıca sql.js üzerinde doğrulandı. `_test` isimli boş veritabanı kontrolü korunuyor. **MSSQL driver üzerinde henüz çalıştırılmadı.**

### Sonuç ve sınırlar

- `npm run verify`: **150/150 test başarılı**; biçim, TypeScript ve üretim derlemesi başarılı. `git diff --check` başarılı. Yeni senaryolarda uygulama hatası bulunmadı; uygulama davranışını değiştiren düzeltme gerekmedi.
- Yerel ölçümde 24 paralel isteğin medyan/p95 süresi bağımsız çalışmada yaklaşık 195/195 ms; tüm test paketi eşzamanlı çalışırken 437/439 ms. Bunlar sentetik yerel sql.js örnekleri; MSSQL performansı veya canlı kapasite tahmini değildir. Global kilit/tam veri okuma mimarisi bu adımda değiştirilmedi.
- Test kaynakları ve rapor yerel çalışma kopyasına aktarıldı; yedek alındı. Uygulama son doğrulanan derlemeyle çalışıyor. Gerçek kullanıcı verileri üzerinden test kaydı eklenmedi veya silinmedi.
- Kalan kontroller: bilgisayar kullanım izniyle tarayıcı akışları, ayrı MSSQL ortamında aynı çakışma senaryoları ve daha büyük veri/yük ölçümleri. Audit saklama/arşivleme politikası ve çok sunuculu giriş sınırı mekanizması ayrıca açık.
- Gönderilmiş son commit `241c66a`; devam paketleri yerelde, henüz commit/push edilmedi.
