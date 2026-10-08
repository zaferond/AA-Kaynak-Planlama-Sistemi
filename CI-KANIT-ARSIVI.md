# CI kanıt arşivi

## 8 Ekim 2026 — N3 ölçümü ve kişisel sorgu kapsamı

Kaynak başlangıcı **`f084a34174e85735c337ff946a1e48e4c19eb1c1`**, dar kişisel okuma düzeltmesi **`ce5c2f007e70b029b6132873d7f3e795c6c87ea5`**. Önceki kanıtların üzerine yazılmadı. [N3 değişiklikler, ölçüm ve kalan işler](N3-SNAPSHOT-KILIT-OLCUM-VE-OKUMA-KAPSAMI-2026-10-08.md).

| Kaynak / kayıt | Sonuç | Koşu |
|---|---|---|
| `f084a34` kalite | 519/519 Ubuntu, 153/153 Windows, 133 Chromium kontrolü ve tüm kapılar başarılı | [37767837466](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37767837466) |
| `f084a34` native | 21/21; 10.000 planlanan / 4.000 actual; ek 600 işlem / 300 değişiklik; iki havuz, şema 31, temizlik başarılı | [37768092380](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37768092380) |
| `ce5c2f0` native | Aynı senaryo/sayılar başarılı; normal yüzde sorgusu ilk senaryoda 4.000 yerine 50 satır döndürüyor | [37770061188](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37770061188) |
| `ce5c2f0` kalite, deneme 1 ve 2 | **Başarısız**; kaynak testi 524/524, Windows 153/153; risk onay browser kontrolünde response timeout; audit adımları atlandı | [37770060613](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37770060613) |
| `f3b6383` kalite, risk onay test harness düzeltmesi sonrası | **Başarılı**: 524/524 Ubuntu, 153/153 Windows, 133 Chromium kontrolü, biçim/domain/TypeScript/build/manifest ve iki audit kapısı | [37771685013](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37771685013) |
| `f3b6383` native | 21/21, aynı 600 işlem / 300 değişiklik; 466 hash eşit, şema 31 ve temizlik başarılı | [37771735208](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37771735208) |

- [Başlangıç kalite kaydı](ci-evidence/quality-f084a34-receipt.json), [başlangıç native kaydı](ci-evidence/native-mssql-f084a34-receipt.json), [başlangıç native JSON](ci-evidence/native-mssql-f084a34.json).
- [Dar okuma native kaydı](ci-evidence/native-mssql-ce5c2f0-receipt.json), [dar okuma native JSON](ci-evidence/native-mssql-ce5c2f0.json), [başarısız kalite deneme 1](ci-evidence/quality-ce5c2f0-attempt1-receipt.json), [başarısız kalite deneme 2](ci-evidence/quality-ce5c2f0-attempt2-receipt.json).
- Son test edilen paket **`f3b63835c05830c85847f1c3c0ef04f0b82e7d12`**: [kalite kaydı](ci-evidence/quality-f3b6383-receipt.json), [native kaydı](ci-evidence/native-mssql-f3b6383-receipt.json), [native JSON](ci-evidence/native-mssql-f3b6383.json). Native JSON SHA-256: `1c012af10bb2a72b016c01df56e7a23318131364d3305ccf2db6e21870c53b83`. 466 dosya ilgili commit ile eşit; başarısız önceki kalite denemeleri korunur. Test harness düzeltmesi olay döngüsünü ve promise hatalarını ele alır; üretim risk kaydetme kuralları değiştirilmedi. Sonraki arşiv/dokümantasyon commit'i yeni bir native test iddiası değildir.
- Native JSON SHA-256 sırasıyla `936c0bb6bb457c2d36c8152cf09f09fab94da88743a51d8a8cb20761c503d8fb` ve `9ad730e59ee58827fea1707d6104fca1236e398b42616c2aec1ec79213cd0588`. JSON baytları korunur; ZIP digest'i ayrı girdidir.
- Üç native sonuçta **466 dosyanın tamamı** ilgili Git commit'iyle eşleşti; `.cmd` CRLF checkout kuralı uygulandı. Kaynak kimliği tüm işlevlerin native test edildiği anlamına gelmez. Raporlar SQL/parametre/bağlantı değerlerini içermez; ham loglar depoya eklenmedi. Son başarılı test toplamlarında hata/atlama/iptal yok; Windows genel suite ile örtüşür.
- Profiller örnek p95/p99 ve örneklenen süreç belleğini içerir; fiziksel IO, saf DMV lock wait, istek başı bellek, HTTP/WAN veya üretim kapasitesi ölçümü değildir. Ayrı runner süreleri kontrollü A/B gibi yorumlanmaz. N3'ün global yazma snapshot/kilit maliyeti hâlâ açık; N2 backend Orta uyarısı da sürüyor.

## 8 Ekim 2026 — N4 / Y5 yenilemesi

Test edilen kaynak: **`731f5281f123f324628de7d0085508d2aaf54e48`**. Sonraki arşiv/dokümantasyon commit'i test edilen kaynakla aynı değildir; kaynak kimliği ayrıca hash'lerden kontrol edilir. Önceki kayıtların üzerine yazılmadı.

| Kayıt | Sonuç | Koşu |
|---|---|---|
| Ubuntu kalite | 509/509 kaynak testi, 133 başarılı Chromium kontrolü; biçim/domain/TypeScript/build/manifest ve iki audit kapısı başarılı | [37763521968](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37763521968) |
| Windows kalite | 143/143 sentetik test; TypeScript/build/manifest başarılı | Aynı kalite koşusu |
| Native MSSQL | 20/20, şema 31; SQL Server 16.0.4295.3 Developer, uyumluluk 160, iki havuz; temizlik doğrulandı | [37763546804](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37763546804) |

- [Kalite kaydı](ci-evidence/quality-731f528-receipt.json), [native kaydı](ci-evidence/native-mssql-731f528-receipt.json), [byte olarak korunan native sonuç](ci-evidence/native-mssql-731f528.json).
- Native JSON SHA-256: `cf14ea040122c8599702b4e7c4abbb4de32a21ab61192e3136506792ace4fb9b`. Artifact ZIP digest'i farklı bir girdiye aittir.
- Native raporun **463 dosyası** aynı commit ile eşleşti; `.cmd` başlatıcısında `.gitattributes` CRLF baytları kullanıldı. Bu liste tam uygulama/derleme girdileri, doğrudan test modülleri ve iki workflow'u içerir. Hash eşitliği tüm UI/işlevlerin native test edildiğini kanıtlamaz.
- Test toplamlarında hata/atlama/iptal yok. Windows genel testlerle örtüşür. Audit kapısı Yüksek eşiklidir: frontend uyarısı giderildi, backend'in `sprintf-js` kökünden gelen Orta uyarıları sürüyor.
- [N4 kapsam, test düzeltmeleri ve kurum sınırları](N4-NATIVE-WINDOWS-KANIT-YENILEME-2026-10-08.md). Asgari SQL yetkileri, kurum TLS/proxy/Windows servis/ACL, kurum kurtarma ve gerçek yük bu kayıtlarla kapanmaz.

**Ara koşu korunmuştur:** `56521c3` için native [37734302765](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37734302765) 20/20, Windows 143/143 ve Ubuntu kaynak testi 509/509 geçti. Fakat Ubuntu browser eski seçicinin iki tablo bulması nedeniyle durdu; kalite koşusu **başarısızdır**. [Başarısız kalite kaydı](ci-evidence/quality-56521c3-receipt.json), [native kaydı](ci-evidence/native-mssql-56521c3-receipt.json), [native sonuç](ci-evidence/native-mssql-56521c3.json). Bu koşunun atlanan audit adımları geçmiş gibi gösterilmedi. Sonraki `731f528` iki tablo seçicisini daraltarak tam kalite koşusunu geçirdi.

## 4 Ekim 2026 kayıtları

Bu arşiv belirli commit'lerin sentetik CI sonuçlarını saklar. Daha sonraki commit'ler, çalışan uygulama ve kurum ortamı için otomatik başarı iddiası oluşturmaz. Windows testleri genel testlerle kısmen örtüşür; sayıları bağımsız kapsam olarak toplamamak gerekir.

| Kayıt | Test edilen commit | Sonuç | Koşu |
|---|---|---|---|
| Ubuntu kalite | `9c5a378d0cba3d99f26c3669d0dcc3d062450092` | 433/433 test, 69 başarılı Chromium kontrolü; TypeScript/build/dağıtım doğrulama ve iki audit adımı başarılı | [37212096003](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37212096003) |
| Windows kalite | `9c5a378d0cba3d99f26c3669d0dcc3d062450092` | 84/84 sentetik test; TypeScript/build/dağıtım doğrulama başarılı | Aynı kalite koşusu |
| Windows test temizliği sonrası Ubuntu/Windows kalite | `fdce36ec0f440e3a5452ce2d315e79ef7c5274fa` | 433/433 genel ve 84/84 Windows testi, 69 başarılı Chromium kontrolü; TypeScript/build/dağıtım doğrulama/audit adımları başarılı | [37213183916](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37213183916) |
| SQL.js CLI/HTTP kurtarma ve migration hata kontrolleri sonrası Ubuntu/Windows kalite | `73eb7caf8a0b652a8da267d54c8d1c3c91b1934a` | 435/435 genel ve 86/86 Windows testi, 69 başarılı Chromium kontrolü; TypeScript/build/dağıtım doğrulama/audit adımları başarılı | [37217903934](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37217903934) |
| Native MSSQL | `63780fc4538829c16c7b14739f882a9851629f59` | 19/19 test; SQL Server 2022 Developer, şema 30, iki havuz, temizlik doğrulandı | [37186385433](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37186385433) |

Tablodaki başarılı koşuların test toplamlarında fail/skipped/cancelled sayısı sıfırdır. Ubuntu'nun backend/frontend audit adımları bu koşularda bilinen açık bildirmedi; bu sonuç güvenlik garantisi değildir. Aşağıdaki başarısız ara koşu ayrıca korunmuştur. Windows başlatıcı testindeki npm/build/start stub'ları gerçek kurum servisi veya DB başlatmaz. Chromium kontrolleri geçici SQL.js ve sentetik hesaplar kullanır.

## Saklanan dosyalar ve kaynak doğrulaması

- [Kalite CI kaydı](ci-evidence/quality-9c5a378-receipt.json): GitHub API'den alınan commit/koşu/iş/adım durumları, loglardan çıkarılan test toplamları ve indirilen logların SHA-256 değerleri. Ham loglar, geçici dosya yolları, bağlantı bilgileri veya hesap verileri arşivlenmez.
- [Windows temizliği düzeltmesi sonrası kalite kaydı](ci-evidence/quality-fdce36e-receipt.json): aynı metadata/test toplamları ve başarısız önceki koşuyla ilişkisi.
- [Kurtarma kabul kontrolü sonrası kalite kaydı](ci-evidence/quality-73eb7ca-receipt.json): aynı metadata/test toplamları; yeni sentetik SQL.js CLI/HTTP kurtarma ve migration hata testleri Ubuntu ve Windows koşularında başarılı. Yerel 28 hedefli testin sonucu da kapsam notuyla kayıtlıdır.
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

## Sonraki Windows CI temizliği bulgusu

Dokümantasyon/arşiv commit'i `d9619779019ad1a68dd47bcaeef13edc2a7013da` için [37212740025 koşusunda](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37212740025) Ubuntu başarılı, Windows başarısızdır. Windows'ta geçersiz `.env` senaryosunun geçici fixture'ı silinirken kopyalanmış `bin/node.exe` için `EBUSY` oluştu. Önceki başarılı kalite koşusunun üzerine yazılmadı; bu başarısız koşu başarılı kanıt olarak kullanılmaz.

`tests/startup-fixture.mjs` temizliği, yalnız sahip olunan geçici dizinde desteklenen geçici dosya sistemi hatalarını en fazla 5 defa, artan bekleme ile tekrar dener. Başlangıç gecikmesi 100 ms, toplam ek bekleme en çok 1.500 ms'dir; kalıcı hata yine testi başarısız yapar. Uygulama/başlatıcı davranışı, gerçek ayarlar, DB veya servis değiştirilmedi.

Düzeltme `fdce36e` commit'inde uygulanıp [37213183916 koşusunda](https://github.com/zaferond/AA-Kaynak-Planlama-Sistemi/actions/runs/37213183916) Ubuntu ve Windows başarılarıyla doğrulandı: 433/433 genel, 84/84 Windows ve 69 Chromium kontrolü. Yerelde gerçek ayarlar aktarılmayan geçici kopyada `node --test --test-reporter=tap tests/startup-tools.test.mjs` 5/5 geçti; seçili fixture'ın Prettier kontrolü de exit 0 döndü. Yerel Mac testi Windows sonucu yerine kullanılmadı. Bu başarı, olası tüm Windows dosya kilidi koşullarının ortadan kalktığının garantisi değildir.

## Bu kanıtlarla kapanmayan kurum kabul işleri

SQL.js için CLI'den kurtarma kopyasının gerçek HTTP giriş/yetki/güncelleme akışına kadar sentetik kontrol tamamlandı. Eski oturumların kaldırılması, yedek anının korunması, revision ve yeniden açılış kalıcılığı ile son migration DDL'sinden sonra hata/yeniden deneme, `73eb7ca` koşusunda iki işletim sisteminde de sınandı. [Kurtarma kontrolünün kapsam ve sonuçları](KURTARMA-KABUL-KONTROLLERI-2026-10-04.md). Bu başarı aşağıdaki kurum kabul işlerini kapatmaz.

1. Sentetik kopyada kurum yedek/restore/migration geri dönüşü, hesap/oturum temizliği, RPO/RTO ve geri kazanılan verinin doğrulanması.
2. Asgari yetkili SQL hesabı, kurum CA/hostname/NTLM, firewall, gerçek HTTPS proxy adresleri ve çoklu proxy zinciri.
3. Windows servis hesabı/NTFS ACL, gerçek ilk kurulum TTY/Explorer, SCM stop, crash/boot/restart davranışları.
4. Hedef veri hacmi ve kullanıcı eşzamanlılığında HTTP/tarayıcı/WAN p95, bellek/GC, SQL sorgu planı ve fiziksel IO.

Native container koşusunda test kimliği ve self-signed sertifikaya trust kullanılmıştır. Sentetik Store medyan/en uzun süre ölçümleri üretim kapasitesi veya p95 değildir. Açık sürecin güncel kodu yüklediği, disk paketinin `deploy:verify` kontrolünden ayrıca kabul edilir.

Bu kurum işlemleri yalnız ayrılmış test ortamı ve sentetik veriyle yürütülür. Çalışan/üretim ortamındaki hesap, DB, migration/restore, servis, sertifika veya ağ işlemi için ayrıca açık yetki ve kabul planı gerekir. Bu arşivleme sırasında bunların hiçbiri çalıştırılmadı.
