# Uygulama stilleri

Önceki `src/upgrade.css` içeriği ekran ve bileşen sorumluluklarına göre bu dizine ayrıldı. **Kuralların cascade sırası `manifest.json` ile belirlenir.** Dosya adlarını alfabetik sıralamak yükleme sırasını değiştirmemelidir.

## Derleme sırası

1. `assets/base.css` — mevcut temel stiller
2. `styles/manifest.json` içindeki dosyalar — listedeki sırayla
3. `src/login.css`
4. Vite tarafından birleştirilen bileşen stilleri — mevcut risk ve değişiklik geçmişi stilleri dahil

`frontend/styles.mjs` listedeki dosyaları bu sırayla okur. Eksik, yinelenmiş, dizin dışına çıkan veya listeye eklenmemiş CSS dosyası derlemeyi durdurur. Sonuç tarayıcıya yine tek CSS dosyası olarak sunulur; ilave ağ isteği oluşmaz.

## Dosya seçimi

| Dizin | Kapsam |
|---|---|
| `workspace/` | Ana yerleşim, menü, filtreler ve ortak aksiyonlar |
| `projects/` | Proje tablosu, aşama menüsü, Gantt/haftalık barlar, düzenleyiciler |
| `planning/` | Planlanan kaynak tablosu, kapasite özeti, görünüm seçimleri |
| `allocation/` | Dağılım kontrolleri, ortak tablo ve sabit sütun kuralları |
| `resources/` | Çalışan araçları, düzenleme ve içe aktarma |
| `reports/` | Kritik konular, grafikler ve rapor başlıkları |
| `administration/` | Yetki ve takım yönetimi |
| `calendar/` | Ortak çalışma ve kişisel izin/eğitim takvimi |
| `shared/` | Ortak kontroller, kişi sayısı rozetleri, bugün çizgisi, dolu hücreler |

Bazı ortak seçiciler ilgili ekran dosyalarında hâlâ birbirini tamamlar. Bu ilk ayrıştırma adımında seçiciler, değerler, media query sınırları ve `!important` kullanımları korunmuştur. `*-theme` ve `*-layout` dosyaları mevcut kuralların sonraki düzenlemelerini içerir; yerlerini değiştirmeden önce etkilenen ekranlar görsel olarak doğrulanmalıdır.

Yeni bir stil için önce mevcut ilgili dosyayı düzenleyin. Yeni dosya gerekiyorsa `manifest.json` listesine uygun sırada ekleyin. `npm run verify` biçim, test, TypeScript ve derleme kontrollerini birlikte çalıştırır. Bu kontroller tarayıcı görsel doğrulamasının yerini tutmaz.
