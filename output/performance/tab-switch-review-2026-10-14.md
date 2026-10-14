# Sekme geçişi ve bugün çizgisi kontrolü — 14 Ekim 2026

## Yöntem

- 16 proje, 61 kaynak birimi, 120 sentetik çalışan, 12 aylık dönem; 1800 × 1050 tarayıcı alanı ve %90 uygulama ölçeği.
- Gerçek hesap veya çalışan verisi kullanılmadı. Geçici SQL.js veritabanı ve headless Chrome kullanıldı.
- Önceki derleme (`8f93a0f` kaynakları) ve güncel çalışma ağacı aynı sentetik sunucu/veri üzerinde karşılaştırıldı. Önceki JavaScript/CSS tarayıcı isteğine eski yerel derlemeden verildi; kaynak dosyalar geri alınmadı.
- Süre: sekme tıklaması ile hedef içerik oluşup iki çizim karesi geçmesi arasındaki süre. İki tur ortalaması; cihaz yükünden etkilenir, üretim için süre garantisi değildir.
- Aktif aylık aktivite raporu kendi API isteğini yapar. Diğer ölçülen sekmeler geçişte tam veri snapshot isteği yapmadı.

## Ölçüm özeti

| Sekme | Önce (ms, ortalama) | Sonra (ms, ortalama) | İlk ekrandaki giriş kutuları (önce → sonra) |
|---|---:|---:|---:|
| AA Planlanan Kaynak Dağılımı | 157.5 | 102.5 | 732 → 384 |
| AA Mühendislik Liderliği Projeler | 69.5 | 69.0 | 0 → 0 |
| AA Gerçekleşen Kaynak Dağılımı | 272.5 | 130.5 | 1200 → 384 |
| AA Aylık Aktivite Raporu | 183.5 | 170.0 | 0 → 0 |
| AA Kritik Proje Konuları | 41.0 | 32.5 | 0 → 0 |
| AA Kaynak Planlama Raporları | 75.5 | 80.5 | 0 → 0 |
| Çalışan & Yetki Tanımlama | 89.0 | 98.5 | 49 → 49 |
| Organizasyon Yapısı | 85.0 | 78.5 | 0 → 0 |

## Değişiklikler

- Planlanan tabloda proje altındaki kaynak satırları küçük parçalara ayrıldı. Az sayıda proje varken bütün satırları birden oluşturan istisna kaldırıldı.
- Gerçekleşen tabloda mevcut sayfalama korundu; sayfa içindeki satırlar ekrana yakın olduklarında oluşturuluyor. Odak, bekleyen/hatalı girişler ve proje başlıkları korunuyor.
- Planlama hücrelerinde takım/proje aramaları ve takım bazlı düzenleme kontrolü her hücrede tekrarlanmak yerine güncel snapshot ve kullanıcı için bir kez hazırlanıyor. Sunucu yetkilendirmesi değişmedi.
- Proje ekranındaki bugün çizgisi opak proje satırlarının üzerinde, takvim başlıklarının altında gösteriliyor. Proje adı/kodu sütunlarının arkasına geldiğinde gizleniyor; yatay kaydırmada konum ölçümü yapılmıyor.

## Doğrulama

44 tarayıcı kontrolü geçti: bütün görünür sekmelerin yüklenmesi, son takım/satırın erişilebilirliği, kayıt, hata sonrası taslağın korunması, tekli/toplu seçim ve kopyalama, ekip yetkileri, sabit proje başlıkları, aylık/haftalık bugün çizgisi, yatay kaydırma ve ana sayfaya devam eden dikey kaydırma.

## Sınırlar

- Yerel sentetik ölçüm; kurumun MSSQL/proxy/ağ gecikmesi ve eşzamanlı kullanıcı yükünü kanıtlamaz.
- Kritik proje konuları ölçümünde konu kaydı yoktur; yoğun not/bar içeriğinin performansı bu ölçümden çıkarılamaz.
- Diğer sekmelerdeki küçük süre farkları iki örnekten alınmıştır; kesin hızlanma/yavaşlama bulgusu olarak kullanılmamalıdır.
