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

2 Ekim 2026'da macOS/Chrome üzerinde **28 kontrol grubu** başarılı:

| Akış | Kontroller |
|---|---|
| Risk | Yeni satır/iptal/sıra, ilk ve kalan puan, strateji, diğer satıra geçiş, Enter/Shift+Enter/Escape, tab/filtre değiştirme, hata sonrası taslak/retry, geciken kayıtta alan kilidi ve tek istek, Excel/JSON aktarımında güncel taslak, başarısız kayıtta çıkışı engelleme, çoklu proje/matris, silme onayı ve sahiplik/rol yetkisi |
| Takvim | Ortak tam/yarım gün, hafta sonunu iki kez düşmeme, kişisel/ortak takvim yetkileri, aynı gün saatlik izin ve eğitim, hata/retry ve kayıt sırasında alan kilidi, aylık saat/yüzde hesabı, %100 ve çalışma saati sınırları, rapor kayıtları |
| İçe aktarma | Şablon indirme, geçersiz/büyük dosya, satır hatasında hiç yazmama, hata filtresi ve sheet değiştirme, sunucu hatasından sonra retry, dosya/mevcut kayıttaki tekrarların atlanması |
| Yedek | Hesap/parola içermeyen JSON, iptalde dosya seçimini temizleme, bozuk/büyük dosya/503/eski generation reddi, başarılı restore'da modelin yerine konması ve hesapların korunması |
| Yetki ve geçmiş | Giriş hatası/parola görünürlüğü/hatırla/reload/çıkış, ana admin koruması, rol-kaynak değişikliği ve oturum iptali, iki admin revision çatışması, kendi rol değişikliğinden sonra yeniden giriş, geçmiş sayfalama/alan farkı/özel veri maskesi/okuma hatası retry |

Testler uygulama davranışını ve veritabanındaki sonucu birlikte denetler; yakalanmamış tarayıcı hataları koşuyu başarısız yapar. Excel dosyalarının ZIP/OOXML yapısı, XML ayrıştırılması ve beklenen hücre değerleri kontrol edilir. Microsoft Excel uygulamasında dosya açma, Windows kurulumu, native MSSQL ve tüm ekran boyutlarının görsel doğrulaması bu komutun kapsamı değildir.

`npm run verify` içindeki birim/entegrasyon testleri ile bu 28 tarayıcı grubu ayrı sayılır. Mevcut kalite CI'ına tarayıcı koşusu eklenmedi; bu komut yerelde çalıştırıldı.
