# Yedek, kurtarma ve migration kabul kontrolleri — 4 Ekim 2026

## Sonuç ve kapsam

Başlangıç commit'i: `c7843aae5a45f4b92ca0910a782cf0f31cc8a2a3` (`main`). Başlangıç çalışma ağacı temizdi. Bu çalışma uygulamanın üretim davranışını değiştirmedi; kurtarma kabul testi, Windows CI kapsamı ve işletim dokümanı eklendi/güncellendi.

**Yerel sentetik doğrulama: 28/28 test başarılı; başarısız, atlanan veya iptal edilen test yok.** Bu sayı bütün proje testleri değildir; kurtarma ve migration ile ilgili seçilmiş dört dosyanın toplamıdır. İlk yeni-test koşusunda da 2/2 senaryo başarılıydı. İncelenen koşullarda yeni bir uygulama hatası yeniden üretilmedi. Bu sonuç genel güvenlik veya kurumda sorunsuz geri dönüş garantisi değildir.

## Kapatılan otomatik kontrol eksikliği

Mevcut bakım testleri paket hash'i, şema/model doğrulaması, tablo ve hesapların korunması ile oturumların silinmesini sınamaktaydı. Yeni `tests/recovery-acceptance.test.mjs`, bu kontrolleri bakım CLI'sinden gerçek HTTP giriş/yetki/güncelleme akışına bağlar. Yeni bir giriş ekranı, kurtarma düğmesi veya canlı veritabanına otomatik restore eklenmedi.

| Kontrol | Sentetik kanıt |
|---|---|
| Tam yedek alma/doğrulama | Gerçek `backup` ve `verify` CLI komutları, açık dosya yollarıyla çalıştırıldı; kaynak baytları korunuyor. |
| Yedek anının korunması | Yedekten sonra kaynakta proje değiştirildi; kurtarılan görünüm yedek anındaki görünümle aynı, kaynak sonraki haliyle korunuyor. |
| Paketlerin korunması | Hazırlanan paket uygulamanın çalışma dosyası yapılmıyor; ayrı bir deployment kopyası kullanılıyor. İlk yedek ve hazırlanmış paket işlem sonunda yeniden doğrulanıyor. |
| Oturum yaşam döngüsü | Admin, yönetici ve normal kullanıcının üç eski oturumu kaldırılıyor; eski cookie ile HTTP isteği 401, parola ile yeni giriş başarılı. |
| Veri ve yetki görünümü | Üç hesabın rol/liderlik/çalışan eşleştirmesi ve API veri görünümü yedek öncesiyle birebir karşılaştırılıyor. Proje, aşama, not, detay tarihleri, tamamlandı durumu, kilometre taşı, risk, planlanan/gerçekleşen dağılım, takvim, revision/generation ve geçmiş kapsanıyor. |
| Kurtarma sonrası erişim | Yönetici kendi takımına tahsis yazabiliyor; diğer takıma yazma 403. Normal kullanıcı kendi risk ve eğitim kaydını güncelleyebiliyor; başka çalışanın takvimine ve proje tanımına yazma 403. Yönetici/normal kullanıcının hesap yönetimi, geçmiş ve yedek API erişimi 403. |
| Eski revizyon ve kalıcılık | Admin güncellemesinden sonra aynı eski revizyonla yazma 409. Kurtarılan veritabanı kapatılıp yeniden açıldığında yeni kayıtlar, revizyon/generation ve geçmiş korunuyor. |
| Migration transaction geri dönüşü | Gerçek v2 şeması ve 0,5 + 0,25 kişi tahsisleri oluşturuldu. Gerçek son v30 DDL çalıştıktan ve dönüşümün 0,75'e ulaştığı gözlendikten sonra yalnız o adapter örneğinde kontrollü hata üretildi. |
| Migration yeniden denemesi | Hatalı başlangıçtan sonra v2 dosyası baytları birebir aynı ve kilit kaldırılmış. Hatasız yeniden denemede tahsis 0,75, eski kişi tahsis tablosu boş; sonraki açılışta veri/generation değişmiyor. |

## Çalıştırılan kontroller

Node.js `v24.21.0`, macOS. Kaynaklar başlangıç commit'inin Git arşivinden alınan ayrı geçici dizinde çalıştırıldı; yeni dosya bu arşive eklendi. Paket manifest ve lock dosyalarının birebir eşleşmesi kontrol edilerek mevcut geçici bağımlılık kurulumu kullanıldı; paket kurulumu veya dış veri aktarımı yapılmadı.

```sh
node --test tests/recovery-acceptance.test.mjs
# 2/2 başarılı

node --test tests/recovery-acceptance.test.mjs tests/data-maintenance.test.mjs tests/restore.test.mjs tests/migration-policy.test.mjs
# 28/28 başarılı; 0 başarısız / atlanan / iptal
```

İkinci koşunun toplam süresi yaklaşık 8,74 saniyedir; **RTO ölçümü değildir**. Testler yalnız kendilerinin oluşturduğu geçici SQL.js veritabanlarına yazdı. HTTP sunucuları `127.0.0.1` üzerinde işletim sisteminin seçtiği geçici portları kullandı. Gerçek `.env` okunmadı; CLI alt süreçlerine veritabanı veya kimlik bilgisi içeren ortam değişkenleri aktarılmadı. Gerçek kullanıcıyla giriş, çalışan uygulamayı yeniden başlatma, canlı DB değişikliği, gerçek migration/restore veya servis/ACL düzenlemesi yapılmadı.

Yeni testin `prettier --check tests/recovery-acceptance.test.mjs` kontrolü ve `git diff --check` başarılıdır. Uygulama kaynakları değişmediği için yerelde frontend build veya ilgisiz bütün testler tekrar çalıştırılmadı; CI'nin mevcut kalite kapıları korunuyor.

Yerel komut/sonuç kayıtları geçici `aa-recovery-check-2026-10-04-sidoopvi` dizinindeki `context.json`, `recovery-test-result.json` ve `targeted-test-result.json` dosyalarındadır; bu geçici kayıtlar kalıcı kurum yedek kanıtı değildir. Raporda kişisel veri, gerçek parola, token veya ham veritabanı bulunmaz.

## CI kapsamı

Ubuntu kalite kapısı `tests/*.test.mjs` üzerinden yeni testi çalıştırır. Windows kalite kapısının açık dosya listesine de `recovery-acceptance.test.mjs` eklendi.

Test commit'i `73eb7caf8a0b652a8da267d54c8d1c3c91b1934a`, [GitHub kalite koşusu 37217903934](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37217903934) ile doğrulandı:

- Ubuntu: **435/435** test; **69 başarılı Chromium kontrolü**.
- Windows: **86/86** sentetik test; yeni iki kurtarma/migration senaryosu bu sayıya dahil.
- Başarısız, atlanan veya iptal edilen test: **0**. TypeScript/build/dağıtım doğrulama ve Ubuntu audit adımları başarılı.

Windows ve Ubuntu sayıları kısmen örtüşen test kümeleridir; toplamları bağımsız senaryo sayısı olarak toplanmaz. API iş/adım durumları, loglardan çıkarılan sayılar ve log SHA-256 değerleri [kalıcı CI kaydında](ci-evidence/quality-73eb7ca-receipt.json) saklanır; ham loglar veya hesap bilgileri arşivlenmez. Ayrıntılı kapsam sınırları [CI kanıt arşivinde](CI-KANIT-ARSIVI.md) bulunur. Bu kayıt belirli test commit'ine aittir; kurum ortamı kabulü veya çalışan sürecin o commit'i yüklediği iddiası içermez.

## Kurum kabulü için açık kalanlar

1. Native MSSQL `.bak` dosyasından ayrı test DB'sine gerçek geri yükleme, `DBCC CHECKDB` ve uygulama ile giriş/veri/yetki kontrolü. Önceki native SQL CI sonuçları bu senaryoyu kanıtlamaz; bu yeni test SQL.js içindir.
2. Kurumun şifreli yedek deposu, Windows NTFS izinleri, yedek görevleri ve başarısızlık uyarılarının gerçek ortam doğrulaması. POSIX izinleri Windows ACL kabulü değildir.
3. Uygun uygulama sürümü, ayrı korunan yapılandırma ve varsa yedek şifreleme sertifika/anahtarlarının kurtarmada kullanılabildiğinin kanıtı.
4. Kurumun RPO (en fazla veri kaybı süresi) ve RTO (en fazla kesinti süresi) hedefleri. Hedefler bu çalışma sırasında kullanıcıya soruldu; henüz belirlenmiş değer rapora yazılmadı. Hedef seçilmesi, hedefin ölçülerek sağlandığı anlamına gelmez.
5. Kurum MSSQL bağlantısı, CA/TLS/proxy ve en az yetkili çalışma hesabı; Windows servisinin açılış/crash/yeniden başlatma ve gerçek yük kabulü. Bunlar yerel kurtarma testiyle doğrulanmadı.

Sentetik SQL.js kurtarma ve migration hata kontrolü tamamlandı. Kurumun yedek/geri dönüş kabulü açık kalıyor. Gerçek ortam işlemleri için ayrılmış test ortamı ve ilgili operasyon yetkilendirmesi gerekir.
