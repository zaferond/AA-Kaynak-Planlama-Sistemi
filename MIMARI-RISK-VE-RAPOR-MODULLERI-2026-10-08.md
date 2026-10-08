# Mimari iyileştirme — Risk işlemleri ve rapor kompozisyonu

## Başlangıç ve sonuç

Başlangıç commit'i **`8832e12af51b1520b641d2f7b492fa9840bed7e7`**, temiz Git çalışma ağacı. 7 Ekim incelemesindeki App/operation sorumluluklarını küçük modüllere ayırma önerisinin ilk bölümü uygulandı. Bu bir bakım ve test edilebilirlik çalışmasıdır; yeni güvenlik açığı tespit edildiği veya mimarinin tamamının bitirildiği iddia edilmez.

- `backend/operations.mjs`: **763 → 708 satır**. Risk kayıtları ve sistem/alt sistem kataloğunun taslak güncelleme davranışı `backend/risk-commands.mjs` içinde toplandı. Oluşturan kişi/tarih metadata'sı, kullanılan sistemin silinmesini engelleme, ad değişikliğinin bağlı risklere yansıması ve bağlı risk revision artışları aynı modülde yer alır.
- `frontend/src/App.tsx`: **1.013 → 952 satır**. Liderlik/takım tabloları ve kaynak grafiklerinin kompozisyonu `features/workspace/WorkspaceReports.tsx` bileşenine alındı. Rapor tablolarının ref'leri ve birlikte kaydırma etkisinin kurulması/temizlenmesi de rapor bileşeninde tutulur. İki tabloda ortak sunum parametreleri bir kez tanımlanır.

Satır sayısı güvenlik veya performans ölçümü değildir. Yeni modüllerle toplam kod sayısı artabilir; amaç sorumlulukların ve değişiklik sınırlarının belirginleşmesidir.

## Çağrı zinciri ve korunan sözleşmeler

`/api/changes → changeAndView → Store.mutate → stageChanges → stageParsedChanges → risk-commands → final validate/persist/audit`.

Risk handler'ları yalnız yetki ve güncel revision kontrolünden geçmiş komutun taslağını değiştirir. `operations.mjs` komut sırasını, yinelenen komut reddini, yetki/revision kontrollerini, ortak revision artışını ve son toplu doğrulamayı yönetmeye devam eder. Store aktif hesabı yeniden kontrol eder; kilit/transaction, audit, generation ve kalıcılık aynı yerde kalır. Yeni modül SQL, HTTP route, dosya/ortam veya veritabanı bağlantısı açmaz. `existingRisk` istemciden alınmaz; orchestrator'ın ilgili komut için okuduğu sunucu kaydıdır. API'nin schema/yetki sözleşmesi değiştirilmedi.

`App → useWorkspaceView/shared selectors → WorkspaceReports → existing tables/charts`.

Kapasite ve tahsis hesapları ortak selector/metric fonksiyonlarında kalır. Yeni bileşen hesapları tekrar uygulamaz. Seçilen takım kimlikleri ile yetki/filtre sonrası çözülen takım kimlikleri ayrı parametrelerdir; önceki filtre etiketi ve hesap kapsamı korunur. Rapor erişimi App'teki admin/manager kontrolü altında kalır. Excel/export akışı, üstteki sabit filtre alanı, tablo/grafik sırası, CSS/DOM sınıfları ve hesaplanan değerler korunur. Fragment kullanıldığı için yeni bir DOM sarmalayıcı eklenmedi.

Yeni bağımlılık yönleri `backend operations → backend risk commands → shared` ve `frontend App → frontend report composition → existing UI/shared` şeklindedir. Shared'den frontend/backend'e bağımlılık eklenmedi; yeni paket veya migration yoktur.

## Doğrulama yöntemi ve sonuçlar

Git'ten yeni geçici kaynak kopyası oluşturuldu. Gerçek `.env`, çalışan veritabanı, gerçek kullanıcı hesabı veya sunucu süreci kullanılmadı. Kilit hash'leri aynı olan önceki izole kurulumun bağımlılıkları yeniden kullanıldı; npm kurulumu yapılmadı. Test DB'leri açıkça geçici SQL.js dosyalarına bağlanır; HTTP/tarayıcı testleri loopback'te sentetik hesaplar kullanır. Derleme ve paket kabulü yalnız geçici kopyada yazma yaptı.

| Komut / kontrol | Sonuç |
|---|---|
| `node --test tests/risk-management.test.mjs tests/risk-systems.test.mjs tests/record-access-http.test.mjs tests/concurrency.test.mjs tests/mutation-snapshot.test.mjs` | **40/40**, fail/skipped/cancelled 0 |
| Geçici runner: `checkRiskSystems`, `checkRisks`, `checkRiskConcurrency`, `checkWorkspaceFilters`, `checkResourceReports` | **31 tarayıcı grubu**, sayfa hatası yok; macOS Chrome headless |
| `npm run check:domain` | **35 shared kaynak**, recursive AST bağımlılık sınırı geçti |
| `npm run build` | TypeScript/Vite başarılı; yalnız geçici kopyada |
| `node scripts/check-deployment-package.mjs` | **389 kaynak / 7 güncel çıktı**, 402 tarihsel çıktı yeni paketten hariç; hash/referans/gzip kontrolü geçti |
| `npm run format:check`, `git diff --check` | Başarılı |

Yeni kalıcı HTTP regresyonu `tests/risk-systems.test.mjs` içinde üç önemli davranışı sınar:

1. Önce sistem adı değişip ardından eski risk revision'ı kullanılırsa **409**: ilk değişiklik, audit, generation ve tüm veri geri alınır.
2. Normal kullanıcının kendi riskini değiştiren ilk komutundan sonra yetkisiz katalog komutu gelirse **403**: ilk değişiklik dahil hiçbir şey saklanmaz.
3. Güncel risk düzenlemesi ardından sistem adı değişikliği admin tarafından yapılırsa **200**: risk revision'ı iki, sistem revision'ı bir artar; generation yalnız bir artar. İstemcinin sahte oluşturucu/tarih metadata'sı mevcut sunucu değerlerini değiştiremez; yeniden açılışta sonuç korunur.

Mevcut tarayıcı kontrolleri risk sahipliği, kataloğu yönetme yetkisi, eski taslak, kaydetme hataları ve gezinme engeli yanında rapor tablolara birlikte kaydırmayı ilk açılış/sekme değişimi/dönem değişimi/yeniden yükleme sonrasında kontrol eder. Filtreye göre kaynak hesapları, grafik sırası, seri seçimi, Excel draft kaydı ve sabit filtre alanı da sınanmıştır.

## Kalan çalışmalar ve kanıt sınırları

- `operations.mjs` içindeki liderlik/takım güncellemesi ve bağlı kayıt değişiklikleri sonraki uygun modül ayrımıdır. Yetki, katalog revision'ı, transaction ve audit sırası korunarak mevcut HTTP davranış testleri kullanılmalıdır.
- Gerçekleşen dağılım/takvim komutları ve proje/kaynak silme zincirleri hâlâ merkezî komut döngüsündedir. Bunlar toplu işlem sırası ve final-monthly-limit davranışına bağlı olduğundan ayrı adımlarla incelenmelidir.
- App'teki kalan sekme/gezinme/bağlam menüsü koordinasyonu sürdürülebilir küçük parçalara ayrılabilir. Salt dosya kısaltmak amacıyla yeni soyutlamalar eklenmemelidir.
- N3 tam snapshot/global lock maliyeti, N2 backend Orta bağımlılık uyarısı ve N6 canlı sürüm geçişi/eski varlık saklama işleri bu çalışmayla kapanmaz.
- Native MSSQL bu kaynak değişikliği için yerelde test edilmedi. Kurum Windows servis/ACL, CA/proxy/TLS, gerçek yedek/restore ve hedef yük kabulü doğrulanmadı. Çalışan süreç yeniden başlatılmadı; disk manifesti doğrulaması açık sürecin yeni backend'i yüklediğinin kanıtı değildir.

CI doğrulaması ve test edilen kaynak commit'i sonuç tamamlandığında ayrı kayıtla eklenecektir.
