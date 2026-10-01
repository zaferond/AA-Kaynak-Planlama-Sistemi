# Mimari ve Güvenlik İyileştirmeleri

Tarih: 1 Ekim 2026  
Referans: 30 Eylül 2026 tarihli mimari ve güvenlik incelemesi; başlangıç Git sürümü `4c60665`.

## Özet

İnceleme raporundaki doğrulanmış davranış hataları düzeltildi. İş kuralları ortak `shared/` katmanına taşındı, değişiklik geçmişi eklendi ve kalite kontrolleri otomatikleştirildi. Ana ekranın modülerleştirilmesi başladı. Veritabanının tüm veri kümesini işleyen yapısı ve büyük stil dosyasının ayrılması hâlâ açık çalışmalardır.

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
| 13 | CSS/otomasyon düzeni | Prettier, zorunlu TypeScript kontrolü, kaynak bağımlılık kontrolü, test/build/audit CI iş akışı eklendi. | Otomasyon tamamlandı; CSS ayrıştırma ve tarayıcı otomasyonu açık |

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
- Bu çalışma sırasında commit/push yapılmadı.

## Sonraki çalışma sırası

1. Tarayıcı erişimiyle planlama seçim/sürükleme, Ctrl+Enter, kopyala/yapıştır, risk satırı otomatik kayıt, not tarihleri ve geçmiş ekranının kullanıcı akışlarını doğrulamak.
2. Ayrı MSSQL test veritabanında aynı hücreye çakışan yazmalar, farklı projelere paralel yazmalar, büyük veri ve eşzamanlı takvim değişiklikleri için yük ölçümü yapmak.
3. Ölçüme dayanarak hedefli repository/komut işlemlerine geçmek; global kilidi ancak bütünlük testleriyle birlikte değiştirmek.
4. App'in kalan sekmelerini ve düzenleme komutlarını ayırmak; CSS dosyasını mevcut cascade sırasını ve görsel sonuçları koruyarak özelliklere bölmek.
5. Audit kayıtlarının saklama/arşivleme politikasını ve çok sunuculu kurulumda ortak giriş sınırı deposunu belirlemek.
