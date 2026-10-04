# Migration kaynakları

`migration-catalog.mjs` sürümleri, isteğe bağlı legacy v2 kaydını, SQL dosyalarının adlarını ve kaynak fingerprint'lerini tanımlar. `schema-migrations.mjs` bu SQL'leri ve kodla çalışan dönüşümleri Store'un tek transaction'ı içinde uygular. Tarihsel 24→23 sırası ve 5/6 GO ayrımı korunur.

Yeni sürüm eklerken katalog kaydı, iki provider'ın SQL dosyaları ve gerekiyorsa migration kodu birlikte güncellenir. Katalog/SQL dosyası eşitsizliği uygulama başlangıcını ve yedek araçlarını başarısız yapar. Yeni SQL.js DDL, yedeklerin beklenen sütun/kısıt sözleşmesini otomatik günceller.

Yedek doğrulamasında bütün zorunlu kayıtlar bulunmalıdır; kod migration'ları 3/12 dosya taramasından kaybolmaz. Doğrulama kaynak dosyaya Store.connect çağırmaz. `scripts/schema-contract.mjs` boş özel görüntüden şema sözleşmesini üretir; `scripts/snapshot-model.mjs` gerçek uygulama projeksiyonunu salt okunur görüntüde kullanır. Veri dönüşümleri doğrulama sırasında tekrar çalıştırılmaz.

`npm run verify` ve `npm run test:ui` sentetik verilerle çalışır. Bakım regresyonları `tests/data-maintenance.test.mjs` içindedir. MSSQL migration davranışı için ayrıca native test ortamı gerekir.


## 3 Ekim 2026 doğrulama ekleri

Başlangıç, uygulanmış her sürümü katalogla karşılaştırır. Bilinmeyen sürümde yükseltme veya katalog seed işlemi başlamaz. Transaction bitmeden zorunlu migration geçmişi yeniden doğrulanır. İsteğe bağlı v2 ve tarihsel 24→23 sırası korunur.

Kod kontrolünün eklenmesi tam kaynak fingerprint'ini değiştirir. DDL/veri dönüşümü aynı olan önceki schema-30 fingerprint'i `compatible-migration-fingerprints.json` içinde yalnız bilinen SQL.js/provider/sürüm üçlüsüyle izinlidir. Rastgele hash kabul edilmez. Kaynak fingerprint'inin uyumlu olması şema, model, migration geçmişi ve parola kaydı kontrollerini atlatmaz. Yeni uyumluluk girdisi ancak ilgili DDL/veri dönüşümleri incelenerek eklenmelidir.

Tam SQL.js yedeklerinde parola salt/hash kayıt biçimi ayrıca denetlenir. Bu kontrol doğru parolayı bilmeden salt ile hash'in birbirine ait olduğunu kanıtlayamaz. Eski tarihsiz çalışma dönemleri tam yedekte korunur; bu işlem yeni kaynağa boş tarih girme izni vermez.


## Store sınırı

`Store.connect` katalog/runner'ı transaction içinde çağırır. Kullanıcı/oturum SQL mapping'i `identity-repository.mjs`, planlama snapshot okuması `planning-reader.mjs`, diff yazması `planning-writer.mjs` içindedir. Repository'ler verilen bağlantıyı kullanır; Store'un transaction/yetki/revision/audit/generation sınırını devralmaz veya ayrı bir commit oluşturmaz. Bu ayrıştırma DDL/veri dönüşümünü değiştirmediği için yeni migration ve yeni uyumlu şema fingerprint'i eklenmez.
