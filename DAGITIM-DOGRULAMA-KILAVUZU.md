# Dağıtım paketi doğrulama

## Hazırlama ve kontrol

Git deposundaki tek bir kaynak kopyasını kullanın. Dağıtım yöneticisi bağımlılıkları kilit dosyalarından kurup `npm run build` çalıştırır. Başarılı build, proje kökünde `deployment-manifest.json` üretir. Manifest kaynak/build girdilerinin ve `site/` çıktılarının SHA-256 değerlerini içerir; `.env`, veri tabanı, kullanıcı dosyaları ve `node_modules` kapsama alınmaz. Manifest web üzerinden sunulan `site/` içinde değildir.

```sh
npm run build
npm run deploy:verify
```

`deploy:verify` yalnız dosya okur. Hesapla giriş yapmaz, veri tabanına bağlanmaz, ayar değiştirmez, dosya yazmaz veya çalışan süreci durdurmaz. Başarılıysa `ok: true`, fark veya eksik/geçersiz manifest varsa exit 1 döner. Kaynak ve derleme farkları ayrı listelenir. Derleme sırasında kaynak değişirse yeni manifest üretilmez.

Paket başka bilgisayara taşınırken kaynak/build girdileri, iki package manifest/lock, başlatıcılar, `site/` ve kökteki manifest birlikte taşınır. Hedefte, kurulumdan sonra ve servisi başlatmadan önce aynı `deploy:verify` komutunu çalıştırın. Windows için komut `npm.cmd run deploy:verify` şeklindedir. Headless servis açılışında build veya paket kurulumu yapılmaz; bunlar dağıtım sırasında hazırlanır.

Manifest yoksa paketi güvenilir kaynak kopyasından yeniden derleyin. Fark varsa önce doğru proje klasörünü seçin; eski ve yeni kopyaları sessizce birleştirmeyin. Doğrulama komutu dosyaları düzeltmez. Geçerli eski manifest başarısız yeni build'de korunur; değişmiş kaynak veya çıktı ile birlikte doğrulamadan geçmez. Manifest Git'e eklenmez; dağıtım paketi ile saklanır.

## Kanıtın sınırları

- Git commit alanı bilgi amaçlıdır; Git bulunmayan paketlerde `null` olabilir. Kaynakta commit edilmemiş değişiklik olabilir; kabul sürümü için temiz Git ağacı ve CI kaydı ayrıca kontrol edilir.
- Bu bir imza sistemi değildir. Manifesti ve dosyaları değiştirme yetkisi olan kişiye karşı bütünlük garantisi vermez. Paket/manifest dağıtım yöneticisi tarafından korunmalı; kurum kabul kayıtlarında manifest hash'i güvenilen ayrı konumda saklanmalıdır.
- Doğrulama kaynak ile build sırasında kaydedilen girdilerin/çıktıların aynı kaldığını kontrol eder. Derleyicinin doğru çalıştığını veya `node_modules` içeriğinin değiştirilmediğini kanıtlamaz; kilitli kurulum ve CI ayrıca gerekir.
- Diskteki paketin doğrulanması, açık Node sürecinin yeni sürümü yüklediğini kanıtlamaz. Kontrollü restart ve süreç/sürüm kabulü IT tarafından ayrı test ortamında yapılır.
- Windows servis/ACL, kurum SQL hesabı/CA/proxy, yedek/restore ve hedef yük kabulü yerine geçmez. Gerçek ortam işlemleri ayrı yetki ve kabul planı gerektirir.

Ubuntu ve Windows kalite iş akışları build sonrası doğrulamayı çalıştırır. Sentetik regresyon testleri yalnız geçici klasörleri kullanır.
