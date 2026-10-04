# Tarayıcı akış testleri

## Çalıştırma

Node.js 24 veya üzeri ve kurulu paketler gerekir. Depo kökünde:

```sh
npm ci
npm --prefix frontend ci
npm run test:ui
```

`test:ui` önce TypeScript kontrolü ve üretim derlemesi yapar. macOS'ta kurulu Google Chrome'u kullanır. Diğer sistemlerde Playwright Chromium'u kurun:

```sh
npx playwright install chromium
```

Linux ortamında eksik sistem kütüphaneleri varsa `npx playwright install --with-deps chromium` kullanılabilir. Başka bir Chromium/Chrome çalıştırılabilir dosyası için `UI_BROWSER_EXECUTABLE` ortam değişkenine dosyanın tam yolunu verin. Eksik tarayıcı otomatik olarak uygulamanın canlı adresine geçiş yapmaz; test başarısız olur.

## İzolasyon

- Çalıştırıcı `.env`, `DB_*`, canlı uygulama adresi veya kullanıcı veritabanı yolunu okumaz. İşletim sisteminin geçici dizininde yeni bir SQL.js veritabanı, rastgele yerel port ve altı sentetik hesap oluşturur.
- Uygulamanın gerçek backend'i ve derlenmiş arayüzü kullanılır. Ağ gecikmesi, 503 ve eski sürüm cevapları yalnız test tarayıcısında taklit edilir.
- Tarayıcıdaki tarih 2 Ekim 2026 olarak sabitlenir; gerçek zamanlayıcılar çalışmaya devam eder. Ocak 2026 hesapları kullanılan örnek veriye göredir.
- Test sonunda tarayıcı, HTTP sunucusu, veritabanı bağlantısı ve zamanlayıcılar kapatılır; sentetik veritabanı silinir. Ekran görüntüleri, sentetik indirme dosyaları ve `result.json` geçici kanıt dizininde kalır. Yol terminalde yazdırılır; işletim sistemi bu dizini sonradan temizleyebilir.
- Derleme `site/` dizinini günceller. Testler gerçek planlama verisine, gerçek kullanıcı hesaplarına veya canlı 3000 portuna kayıt göndermez.

## Kapsam

3 Ekim 2026'da macOS/Chrome üzerinde **69 kontrol grubu** başarılı:

| Akış | Kontroller |
|---|---|
| Çalışma alanı eylemleri | Dört sekmede filtreli Excel çıktısı ve OOXML; normal kişinin yalnız kendi kaynağı; global sıfırlamada iptal/503/retry ve filtre dışı takım/proje/ay, diğer verilerin korunması; toplu kaynak silmede iptal/409/seçim koruma, başarıda yalnız seçili kaynak/gerçekleşen kayıt silme ve plan/proje koruma |
| Çalışma alanı filtre/görünümü | Geniş plan URL başlangıcı, dönem/gruplama değişiminde seçim temizliği, mevcut yıl/12 ay/aylık görünüm sıfırlama ve reload; seçili proje tahsisiyle özet değişirken aktif kapasite ve tüm-proje raporlarının korunması; doğrudan açılış, özet yeniden açma, sekme/dönem değişimi ve varsayılan Raporlar reload sonrası iki yönlü gerçek yatay scroll |
| Planlanan kaynak girişi | Gerçek fareyle ters sürükleme, Ctrl ile ek seçim, sol üst odak, Ctrl+Enter ile toplu kayıt, Enter/dış tıklama/Escape temizliği; sıfır içeren 2×2 Ctrl+C/V ve sağ tık kopyalama/yapıştırma; 503 sonrası taslak/seçim korunması, bekleyen retry alan kilidi ve tek istek |
| Ortak tablo stilleri | Üretilen CSS üzerinde altı yıl paleti, dağılım kenarlık önceliği, dolu/boş/odak hücreleri, bugün çizgisinin genişlik/renk/katmanı ve ortak proje başlık ölçüsü; %80 yakınlaştırmadaki ölçü yuvarlaması hesaba katılır |
| Oturum tutarlılığı | Aynı tarayıcı bağlamında iki sekme, açık taslakta çıkış/giriş, storage/BroadcastChannel yedekleri, iki kanal kapalıyken değişmeyen generation ile kimlik kontrolü, odak kontrolünde 503/taslağın korunması, gecikmiş admin yanıtını reddetme, aynı hesaba yeniden girişte yeni CSRF/taslak; sinyalde yetki veya kimlik taşınmaması |
| Genel editör ve kendi kaynak görünümü | Proje taslağı açıkken gelen güncel snapshot; açılış revision’ıyla kaydet/sil ve 409; uzaktaki kaydı/taslağı koruma; 503 sonrası açık taslak/retry; eski hesap liderliği dışında kendi gerçekleşen satırını gösterme, başka çalışanı göstermeme |
| Risk | Yeni satır/iptal/sıra, ilk ve kalan puan, strateji, diğer satıra geçiş, Enter/Shift+Enter/Escape, Tab/Shift+Tab odak sırası, IME Enter ve silme düğmesinde Enter ile yanlışlıkla kayıt yapılmaması, tab/filtre değiştirme, hata sonrası taslak/retry, geciken kayıtta alan kilidi ve tek istek, Excel/JSON aktarımında güncel taslak, başarısız kayıtta çıkışı engelleme, çoklu proje/matris, silme onayı ve sahiplik/rol yetkisi |
| Risk eşzamanlılığı | Düzenleme başlamadan açılan okumanın sonradan güncel veri döndürmesi, açılış revision'ıyla kaydet/sil, çakışmada taslağı ve diğer kullanıcının verisini koruma, iptal/hatalı/başarılı yeniden yükleme, değiştirilmemiş eski taslağı yazmama, gerçek version polling ve select/blur sırasında yenilemeyi bekletme, okuma hatası/retry, uzaktan silinen kaydı yeniden oluşturmama |
| Gerçekleşen giriş/bağlam | Hücre ve toplam satırından kişi/ay seçimi, dış tıklama/Escape/Enter ile seçim temizleme, yüzde/gün/saat dönüşümleri, manuel saati değiştirip otomatik takvime dönme, tam kapasitede boş projenin kilitlenmesi, gelecek ayın kapalı kalması, uyarı sonrası girişe odak dönüşü, 503 sonrası kaynak/saat taslağını koruma ve tekrar kaydetme |
| Takvim | Ortak tam/yarım gün, hafta sonunu iki kez düşmeme, kişisel/ortak takvim yetkileri, aynı gün saatlik izin ve eğitim, hata/retry ve kayıt sırasında alan kilidi, aylık saat/yüzde hesabı, %100 ve çalışma saati sınırları, rapor kayıtları |
| Ortak takvim taslağı | Ortak kayıtta 503 sonrası eklenen tarihleri koruma, geciken retry sırasında alan/yıl/kapatma kilidi, Escape/X ile pencereyi kapatmama ve tek kayıt isteği; yeni snapshot geldikten sonra açılış revision'ıyla 409, yerel taslak ve uzaktaki kaydı koruma, yeniden açınca güncel takvimi yükleme |
| İçe aktarma | Şablon indirme, geçersiz/büyük dosya, satır hatasında hiç yazmama, hata filtresi ve sheet değiştirme, sunucu hatasından sonra retry, dosya/mevcut kayıttaki tekrarların atlanması |
| Yedek | Hesap/parola içermeyen JSON, iptalde dosya seçimini temizleme, bozuk/büyük dosya/503/eski generation reddi, başarılı restore'da modelin yerine konması ve hesapların korunması |
| Proje tabloları | Üç ekranda proje başlığının yıl/ay altında sabit kalması ve sonraki projede değişmesi, yatay kaydırmada proje adının korunması, fare ve Alt+ok ile kayıtlı proje sıralaması, reload sonrası sıra, kaynak/not verisinin korunması, başarısız sıralamada geri alma |
| Zaman çizelgesi katmanları | Aylık bar/haftalık detay/baklavaların sabit sol sütunun arkasından geçmesi; sürükleme ve tutamakların yüksek yerel katmanları dahil gerçek `elementFromPoint` kontrolü; açık alanda etkileşimin korunması |
| Yetki ve geçmiş | Giriş hatası/parola görünürlüğü/hatırla/reload/çıkış, ana admin koruması, rol-kaynak değişikliği ve oturum iptali, iki admin revision çatışması, kendi rol değişikliğinden sonra yeniden giriş, geçmiş sayfalama/alan farkı/özel veri maskesi/okuma hatası retry |

Testler uygulama davranışını ve veritabanındaki sonucu birlikte denetler; yakalanmamış tarayıcı hataları koşuyu başarısız yapar. Excel dosyalarının ZIP/OOXML yapısı, XML ayrıştırılması ve beklenen hücre değerleri kontrol edilir. Microsoft Excel uygulamasında dosya açma, Windows kurulumu, native MSSQL ve tüm ekran boyutlarının görsel doğrulaması bu komutun kapsamı değildir.

`npm run verify` içindeki birim/entegrasyon testleri ile bu 69 tarayıcı grubu ayrı sayılır. Kalite CI push/PR koşusunda bu tarayıcı çalıştırıcısı da yer alır; Chromium kurulumu sonrasında sentetik SQL.js kullanır. Native MSSQL iş akışı haftalık ve manuel çalışacak şekilde tanımlanmıştır. Bu turda GitHub runner ve native ortam sonuçları alınmadı.


Windows push/PR kalite işi ayrıca domain/TypeScript/build ve sentetik SQL.js oturum, dosya kilidi, rollback/restart, eşzamanlılık ve Excel paket kontrollerini çalıştırır. Gerçek Windows servis hesabı/ACL ve native MSSQL bağlantısı için ayrı kurum testi gerekir. `npm test` içindeki HTTPS/proxy testi OpenSSL kullanarak geçici test sertifikası üretir; global TLS ayarını veya gerçek sertifikaları değiştirmez.
