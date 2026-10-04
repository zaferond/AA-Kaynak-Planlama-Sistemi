# CI kanıt arşivi

## 4 Ekim 2026 kayıtları

Bu arşiv belirli commit'lerin sentetik CI sonuçlarını saklar. Daha sonraki commit'ler, çalışan uygulama ve kurum ortamı için otomatik başarı iddiası oluşturmaz. Windows testleri genel testlerle kısmen örtüşür; sayıları bağımsız kapsam olarak toplamamak gerekir.

| Kayıt | Test edilen commit | Sonuç | Koşu |
|---|---|---|---|
| Ubuntu kalite | `9c5a378d0cba3d99f26c3669d0dcc3d062450092` | 433/433 test, 69 başarılı Chromium kontrolü; TypeScript/build/dağıtım doğrulama ve iki audit adımı başarılı | [37212096003](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37212096003) |
| Windows kalite | `9c5a378d0cba3d99f26c3669d0dcc3d062450092` | 84/84 sentetik test; TypeScript/build/dağıtım doğrulama başarılı | Aynı kalite koşusu |
| Native MSSQL | `63780fc4538829c16c7b14739f882a9851629f59` | 19/19 test; SQL Server 2022 Developer, şema 30, iki havuz, temizlik doğrulandı | [37186385433](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37186385433) |

Her üç test toplamında fail/skipped/cancelled sayısı sıfırdır. Ubuntu'nun backend/frontend audit adımları bu koşuda bilinen açık bildirmedi; bu sonuç güvenlik garantisi değildir. Windows başlatıcı testindeki npm/build/start stub'ları gerçek kurum servisi veya DB başlatmaz. Chromium kontrolleri geçici SQL.js ve sentetik hesaplar kullanır.

## Saklanan dosyalar ve kaynak doğrulaması

- [Kalite CI kaydı](ci-evidence/quality-9c5a378-receipt.json): GitHub API'den alınan commit/koşu/iş/adım durumları, loglardan çıkarılan test toplamları ve indirilen logların SHA-256 değerleri. Ham loglar, geçici dosya yolları, bağlantı bilgileri veya hesap verileri arşivlenmez.
- [Native CI kaydı](ci-evidence/native-mssql-63780fc-receipt.json): aynı metadata ve test toplamları, artifact kimliği/süresi, sonuç JSON'unun SHA-256 değeri ve 48 kaynak dosyasının karşılaştırması.
- [Native sonuç JSON'u](ci-evidence/native-mssql-63780fc.json): CI artifact'indeki JSON **byte olarak korunmuştur**. Sentetik rol ölçümleri, Node/SQL sürümleri, şema ve kaynak hash'lerini içerir; gerçek kullanıcı verisi veya bağlantı bilgisi içermez.

Native JSON SHA-256:

```text
c4eca2bf19d8fa041f9f484589827a8bbcb98b61f28552b69e65410bcdfb9ac3
```

GitHub artifact'inin kaydedilen sona erme tarihi **11 Ekim 2026 07:39 UTC** olduğundan sonuç ayrıca Git deposunda tutulur. Artifact metadata'sındaki digest ZIP arşivine aittir; yukarıdaki JSON hash'i ile karıştırılmamalıdır. Log hash'leri kayıt parmak izidir; ham loglar yeniden elde edilemiyorsa tek başına test içeriğini kanıtlamaz.

4 Ekim'de native JSON'un kapsadığı **48 dosyanın tamamı**, kalite koşusunun `9c5a378` commit'indeki aynı dosyalarla eşleşti. Bu karşılaştırma yalnız listelenen dosyaları kapsar. Sonraki HTTP/proxy/başlatıcı/dağıtım değişiklikleri veya frontend'in tamamı eski native koşuda test edilmiş sayılmaz. Yeni native kapsamı için yeni bir koşu ve ayrı kayıt gerekir.

JSON dosyasının bütünlüğü PowerShell'de veri tabanına bağlanmadan kontrol edilebilir:

```powershell
(Get-FileHash -Algorithm SHA256 -LiteralPath .\ci-evidence\native-mssql-63780fc.json).Hash
```

Bu dosyalar imzalı bağımsız sertifika değildir. Depoyu değiştirebilen biri kayıtları da değiştirebilir; kurumun kabul kanıtları erişimi sınırlı ayrı bir konumda korunmalıdır. İlerideki kayıtlar eski koşunun üzerine yazılmadan yeni commit/koşu adıyla eklenir; loglar gizli bilgi/kişisel veri açısından gözden geçirilmeden arşivlenmez.

## Bu kanıtlarla kapanmayan kurum kabul işleri

1. Sentetik kopyada kurum yedek/restore/migration geri dönüşü, hesap/oturum temizliği, RPO/RTO ve geri kazanılan verinin doğrulanması.
2. Asgari yetkili SQL hesabı, kurum CA/hostname/NTLM, firewall, gerçek HTTPS proxy adresleri ve çoklu proxy zinciri.
3. Windows servis hesabı/NTFS ACL, gerçek ilk kurulum TTY/Explorer, SCM stop, crash/boot/restart davranışları.
4. Hedef veri hacmi ve kullanıcı eşzamanlılığında HTTP/tarayıcı/WAN p95, bellek/GC, SQL sorgu planı ve fiziksel IO.

Native container koşusunda test kimliği ve self-signed sertifikaya trust kullanılmıştır. Sentetik Store medyan/en uzun süre ölçümleri üretim kapasitesi veya p95 değildir. Açık sürecin güncel kodu yüklediği, disk paketinin `deploy:verify` kontrolünden ayrıca kabul edilir.

Bu kurum işlemleri yalnız ayrılmış test ortamı ve sentetik veriyle yürütülür. Çalışan/üretim ortamındaki hesap, DB, migration/restore, servis, sertifika veya ağ işlemi için ayrıca açık yetki ve kabul planı gerekir. Bu arşivleme sırasında bunların hiçbiri çalıştırılmadı.
