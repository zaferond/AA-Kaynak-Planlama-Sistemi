# M6 — Native MSSQL ve aynı commit için CI kabulü

13 Ekim 2026. Başlangıç kaynak commit'i: `ee4ebbd3d014454fadf7dbfaba40892028fea1f0`. M1–M5 düzeltmeleri bu incelemede çalışma ağacındaydı; M6 bunların bütünleşik güncel kaynağını doğrular.

## Bulgu ve doğrulanan fark

13 Ekim mimari/güvenlik incelemesindeki **M6 (Orta — kabul eksikliği)**, önceki N4/Y5 kabul alanıyla ilişkilidir. Depodaki önceki native arşiv şema 32 için; güncel katalog 35. GitHub API sorgusunda 12 Ekim tarihli başarılı native koşu da bulundu (`38196324153`, kaynak `5fcad2730f767c40a01fd4d5c02cc1b165e83eeb`); bu, bugünkü M1–M5 değişikliklerini kapsamaz. Eski başarılı koşu güncel kaynak kabulü olarak kullanılmadı.

## Yapılan değişiklikler

- `Quality checks` her push/PR için native reusable workflow'u çağırır. `Release acceptance`, Ubuntu kalite, Windows ve native işlerin aynı commit'te başarılı olmasını gerektirir; atlanan/iptal edilen/başarısız iş kabulü geçiremez.
- Native artifact; commit, katalog şeması, kilit dosyasına karşı kurulu MSSQL/Tedious sürümleri, uygulama/test/workflow SHA-256 envanteri, güncel beş kabul kontrolü ve DB temizliği açısından doğrulanır. Yanlış/eski/eksik kanıt başarısız olur. Artifact süresi 7 → 90 gün.
- Native suite'e güncel şema/hiyerarşi ve Leader/Product Owner çatışmalarının atomik reddi; kişisel gün/aylık toplam ayrımı; dar raporların tam snapshot ile eşitliği; iki bağımsız havuzda sentetik AD oturum iptali ve geçici kesinti; SQL Server tarafından bildirilen bağlantı şifrelemesi eklendi.
- Dondurulmuş eski validator değiştirilmedi. Eski şema karşılaştırması açıkça legacy projeksiyonla sınırlı; güncel model ayrıca tam doğrulanır. Leader/PO verisi sessizce eski oracle'a sokulamaz.
- Windows açık test listesine M3, M5 ve M6 regresyonları eklendi. Yerel SQL.js karşılığı TLS/native havuz kontrolünü doğrulamış sayılmaz.

## Yerel kontroller

Kaynak dosyaları geçici dizine kopyalandı; gerçek `.env`, DB, kullanıcı/AD ve çalışan servis kullanılmadı. Mevcut bağımlılıklar yalnız okundu.

| Komut | Sonuç |
|---|---|
| `npm run verify` (kaynak kopyası) | **811/811**; fail/skipped 0; biçim, domain, TypeScript ve build başarılı |
| `node --test tests/native-evidence.test.mjs tests/native-release.test.mjs` (kaynak kopyası) | **9/9**; fail/skipped 0 |
| `node --test tests/native-release.test.mjs` (legacy projeksiyon ek kontrolünden sonra) | **6/6**; fail/skipped 0 |
| `git diff --check` | Başarılı |

## Güncel uzak kabul durumu

**Bekleniyor:** güncel kaynak commit'i push edildikten sonra Windows, Ubuntu ve geçici SQL Server koşusunun sonucu arşivlenecek. Yerel sonuçlar native başarı iddiası değildir.

GitHub `main` branch protection ve ruleset durumu ayrıca kontrol edilir. CI iş akışı tek başına kurumun manuel dağıtımını engellemez; zorunlu yayın prosedürü/branch kuralı ayrı işletim kontrolüdür.

## Kapsam sınırları

Geçici SQL Server 2022 Developer, SQL kimlik doğrulaması ve şifreli/self-signed test bağlantısı; sentetik LDAP adapter'ı ve sentetik veri. Kurum CA/hostname, gerçek AD/NTLM, en az yetkili kurum SQL hesabı, Windows servis/ACL, proxy, kurumsal backup/restore, atomik dağıtım ve gerçek yük/SLA kabulü bu koşularla doğrulanmaz. Hash eşitliği tüm işlevlerin native test edildiği anlamına gelmez. Üretim/çalışan DB'sine yazılmadı.
