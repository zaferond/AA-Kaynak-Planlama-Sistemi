# Üst açıklama tarihleri ve tablodan ana sayfaya kaydırma

8 Ekim 2026; başlangıç `63301011492d5ed2f51a13318819a8fb8ae4f33f`. N5'in ağ/taslak koruma değişiklikleri korunur.

- Başlık Düzenle ekranındaki **Tarih Aralığı** başlangıç/bitiş alanları salt okunurdur. Alanlar okunabilir/kopyalanabilir; elle tarih değiştiren handler'lar kaldırıldı, açıklama metni güncellendi. Alt not tarihi değişince mevcut ortak `rangeWithNoteDates` kuralı üst aralığı en erken/en geç dolu not tarihlerinden hesaplar. Hem genişleme hem daralma desteklenir. Tarih aralığının milestone'a dönüştürülmesi ve tek tarihli milestone tarihi düzenlenebilir kalır.
- Daha önce saklanan manuel üst aralıklar açılışta topluca değiştirilmez; ilgili alt not düzenlendiğinde hesaplanır. Takvim sınırı, geçersiz/eksik tarih ve diğer barlarla çakışma kontrolleri korunur. Backend/shared iş kuralı, migration veya veritabanı dönüşümü değiştirilmedi.
- Proje/planlanan ana tablosu ve özet tablosundaki `overscroll-behavior-y: contain`, `auto` oldu; gerçekleşen tabloda da `auto` açıkça tanımlandı. Tablo üst sınırındayken yukarı mouse wheel ana sayfada devam eder. Yeni wheel handler, global preventDefault veya yapay scroll eklenmedi. Alt sayfa sınırı, iç tablo kaydırması, yatay kaydırma ve frozen sütunlar korunur.

## Yerel doğrulama

Gerçek `.env`, hesap, veritabanı veya çalışan servis kullanılmadı. Önceki temiz bağımlılıklı geçici kaynak kopyasında sınırlı ortam ile derleme yapıldı. Browser testleri yalnız sentetik SQL.js, rastgele loopback port ve Chrome kullanır.

| Kontrol | Sonuç |
|---|---|
| `node --test tests/milestone-note-dates.test.mjs tests/milestone-point.test.mjs` | **16/16**, fail/cancelled/skipped 0 |
| Hedefli browser çalıştırıcısı: `checkMilestoneParentDates` + `checkViewportScroll` | **10** grup başarılı; üst alan klavye ile değişmez, alt tarihlerin iki yönlü etkisi HTTP kaydında ve yeniden açılışta korunur; milestone tarihi düzenlenebilir; üç tablodan ana sayfaya yukarı wheel geçer |
| `npm run build` | TypeScript/site başarılı |
| `npm run format:check`, `npm run deploy:verify`, `git diff --check` | Başarılı |

Plan/proje kaydırma kontrolü 1800×1050 ve 1000×720 viewport'larda, aylık/haftalık görünüm ve mevcut özet/grup kontrolleriyle çalışır. Gerçekleşen kontrolü ayrı sentetik çalışan bağlamında çalışır. Dokunmatik cihaz ve kurum tarayıcısı davranışı ayrıca doğrulanmadı. Son kalite CI sonucu ayrı kanıt olarak eklenecektir; hedefli sonuç bütün süitin sonucu olarak sunulmaz.
