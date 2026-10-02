# Ön yüz sorumlulukları

`App.tsx` oturumu, güncel veri snapshot'ını, filtreleri ve ekranlar arasındaki bağlantıları yönetir. API'ye yazma ve snapshot yenileme mevcut `save` / `batch` yolunda kalır.

## Düzenleme akışı

| Dosya | Sorumluluk |
|---|---|
| `usePortalEditor.ts` | Taslak, form hatası, açma, kaydetme, silme ve kaynak statüsü geçişleri |
| `editor-state.ts` | Düzenleyicinin türlere ayrılmış veri sözleşmesi |
| `editor-commands.ts` | Taslağın doğrulanması ve revision içeren kayıt komutlarının hazırlanması |
| `PortalEditorDialog.tsx` | Ortak pencere, başlık, hata alanı ve işlem düğmeleri |
| `editors/*EditorFields.tsx` | İlgili formun alanları ve taslak değişiklikleri |

Alan bileşenleri React fragment döndürür. Ek DOM sarmalayıcıları formun doğrudan çocuklarını hedefleyen CSS kurallarını değiştirebilir. İş kuralları form görünümüne kopyalanmamalıdır. Kayıt hatasında taslak ve hata açık kalır; başarılı kayıt tamamlanınca pencere kapanır.

## Proje zaman çizelgesi

| Dosya | Sorumluluk |
|---|---|
| `../ProjectTimelineRows.tsx` | Proje/aşama satırları, detayları açma ve başlıkların sıralanması |
| `../MilestoneTrack.tsx` | Aylık bar, haftalık detay, milestone, yerleşim ve önizleme çizimi |
| `useMilestoneDrag.ts` | Pointer capture, uzun basma, günlük taşıma, iki uçtan boyutlandırma ve iptal |
| `project-timeline-types.ts` | Satır ve zaman çizelgesi callback sözleşmeleri |
| `project-timeline-commands.ts` | Tarih/sıralama değişikliklerinden kayıt komutu hazırlanması |
| `position-pointer-tooltip.ts` | Fare konumu, viewport sınırı ve uygulama zoom'una göre tooltip konumu |
| `timeline-labels.ts` | Çizelgedeki ay ve gün metinlerinin biçimi |

Tarih doğrulaması ve alt notların etkisi `shared/milestone-ranges.ts` içinde kalır. Sürükleme hook'u önizlemede bu kuralları kullanır; gerçek kayıt mevcut komut ve batch yoluyla yapılır. Fareyle taşıma için 350 ms uzun basma, erken hareketin iptali, geçersiz tarihin kaydedilmemesi ve sürükleme sonrasındaki tıklamanın bastırılması korunur.

## Stil ve doğrulama

Stil yükleme sırası `../styles/manifest.json` ile belirlenir. Aynı seçicinin birden fazla dosyada olması tek başına tekrar sayılmaz: sonraki kurallar önceki görünümü tamamlayabilir. Ayrıntılar [stil kılavuzunda](../styles/README.md).

`npm run verify` biçim, mevcut testler, TypeScript ve üretim derlemesini denetler. Bileşen/CSS ayrıştırmasında ayrıca geçici veritabanıyla tarayıcıda form, seçim, sürükleme ve ekran görüntüsü karşılaştırması yapılmalıdır. Bir dosyanın kısalması performans artışı veya tüm uygulamanın mimari temizliğinin tamamlanması anlamına gelmez.
