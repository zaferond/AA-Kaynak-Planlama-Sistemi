# Kullanıcı Manueli - düzenlenebilir kaynak

Türkçe manuel, 13.10.2026 tarihli kaynak kod/çalışma ağacı incelemesine dayanır. Güncel PDF ve Markdown kaynak birlikte tutulur. Görseller yalnız sentetik test ortamına aittir. Gerçek kullanıcı, parola veya kurum yapılandırması içermez.

## Güncelleme ve yeniden üretme

1. Markdown dosyasını düzenleyin. Arayüz etiketlerini güncel kaynak koddan doğrulayın. Belge sürümü/tarihi değişirse Markdown üst bilgisini ve Python dosyasındaki kapak/üstbilgi sabitlerini birlikte güncelleyin.
2. Python 3.9 veya üzeriyle ayrı bir sanal ortam oluşturun: `python -m venv .venv`.
3. Ortamı etkinleştirip `python -m pip install -r requirements.txt` çalıştırın.
4. Bu klasörde `python build_manual.py` çalıştırın. Aynı adlı PDF burada yeniden üretilir; veritabanına veya uygulama servislerine erişilmez.
5. PDF'yi açın, içindekiler sayfa numaralarını ve tüm sayfaları görsel olarak kontrol edin. Font değişikliği sayfa sayısını değiştirebilir.

macOS'ta sistem Arial; Windows'ta sistem Arial; Linux'ta DejaVu Sans otomatik bulunur. Özel font dizini için `AA_MANUAL_FONT_DIR` kullanılabilir; beklenen dosyalar Arial.ttf, Arial Bold.ttf, Arial Italic.ttf, Arial Bold Italic.ttf'dir. Font dosyaları lisansları nedeniyle pakete eklenmez.

Markdown içindeki `---page---` işaretleri bölüm sonudur. Standart Markdown görüntüleyici bunları sayfa sonu yapmayabilir; PDF üreticisi uygular. `assets/` görselleri metinle birlikte korunmalıdır. Çıktı kurumsal onaylı belge/sürüm kabulü yerine geçmez; teyit listesi manuelin 25. bölümündedir.

## Doğrulama kapsamı

- İncelenen uygulama kaynak commit: ed022668186fb864e44394fcafc60919133a59b4. AD Admin rolü, liderlik raporu alt kırılımı ve AD çalışan adının korunması bu commit'e dahildir.
- Kaynak/derleme eşleşmesi, tip kontrolü, biçim ve ortak modül bağımlılık denetimi geçti.
- Seçili dört dosyada 77 sentetik test; üç hedefli tarayıcı akışında 16 kontrol geçti.
- Altı sentetik ekran kesiti üretildi. PDF yeniden açıldı ve tüm sayfalar render edilerek kontrol edildi.
- Gerçek AD/MSSQL/Windows servisi, kurum TLS/proxy, gerçek yük ve geri yükleme kabulü bu çalışmada yapılmadı.
