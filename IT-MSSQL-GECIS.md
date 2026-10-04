# IT için MSSQL kurulumu ve geçiş

## Mimari ve hedef

Node.js 24+, Express, `mssql` (Tedious) ve yerel test için `sql.js` kullanılır. Arayüz/API/iş kuralları ortaktır; SQLite ve SQL Server için ayrı SQL bağlantı katmanları ve şemalar bulunur. SQL Server'a geçişte Node.js kodunu yeniden yazmak gerekmez. `.env` değişir; uygulama yeniden başlatılır. `sql.js` dosyası SQL Server tarafından doğrudan açılamaz.

MSSQL tarafı SQL Server 2016+ / veritabanı compatibility level **130+** gerektirir (`OPENJSON` kullanılır). Kurumun desteklenen güncel SQL Server sürümünde test edilmelidir. Mevcut kurumsal tabloları kullanmaz; uygulamaya ayrılmış veritabanında `dbo.kp_*` tablolarını kullanır. Veritabanı hesabının varsayılan şeması dbo olmalıdır.

Uygulama bir SQL Server veritabanı/sunucusu oluşturmaz, uzak veritabanına kendiliğinden yayın yapmaz. Yerel modda Docker/SQL Server gerekmez. Gerçek MSSQL testi için IT'nin test sunucusu veya ayrı SQL Server kurulumu gerekir. SQL Server Linux container'ları için x86-64 desteği vardır; Apple Silicon üzerinde emülasyonu desteklenen kurulum olarak varsaymayın.

## 1. IT'den gereken bilgiler

- SQL Server FQDN/hostname ve TCP portu veya named instance adı.
- Uygulamaya ayrılmış boş veritabanı ve ayrı boş test veritabanı.
- Giriş yöntemi: SQL login veya domain kullanıcı/parolasıyla NTLM.
- Şema kurabilen geçici migration hesabı; çalışma zamanı için yalnızca uygulama tablolarına erişen ayrı hesap.
- Uygulama sunucusundan MSSQL'e ağ/VPN/firewall erişimi.
- SQL Server sertifikası için geçerli sunucu adı ve güvenilen sertifika zinciri.
- Portalın HTTPS adresi ve ters proxy/servis ortamı.

Varsayılan Tedious sürücüsü SQL login ve yapılandırılmış NTLM kullanıcı/parolasını destekler. Mevcut Windows oturumunu otomatik kullanma, Kerberos/gMSA/Entra gibi farklı kurum yöntemleri bu pakette yapılandırılmış değildir; IT yöntemi doğrulanmadan yalnızca kullanıcı/parola alanlarının yeterli olduğu varsayılmamalıdır.

## 2. Ortam ayarları

Uygulamayı durdurun. Yerel `.env` dosyasını özel bir yerde saklayın; `.env.mssql.example` dosyasından yeni `.env` oluşturup IT bilgileriyle doldurun:

```dotenv
DB_PROVIDER=mssql
DB_SERVER=sqlserver.sirketiniz.local
DB_PORT=1433
DB_DATABASE=AA_KaynakPlanlama
DB_AUTH=sql
DB_USER=aa_planlama_app
DB_PASSWORD='size-verilen-parola'
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false
DB_AUTO_MIGRATE=false
APP_ORIGIN=https://planlama.sirketiniz.com
TRUST_PROXY=loopback
HOST=127.0.0.1
PORT=3000
NODE_ENV=production
ADMIN_USERNAME=portal.admin
ADMIN_PASSWORD='yalnizca-ilk-kurulumda-gereken-portal-sifresi'
```

DB_USER/DB_PASSWORD SQL Server servis hesabıdır; ADMIN_USERNAME/ADMIN_PASSWORD portalın ilk yönetici hesabıdır. İkisi farklıdır. İlk yönetici yalnızca hesap yoksa oluşturulur; sonraki açılışta ADMIN_PASSWORD değiştirmek var olan şifreyi değiştirmez. İlk kurulumdan sonra ADMIN_PASSWORD satırını kaldırabilirsiniz.

Bu örnek, HTTPS proxy'nin **Node ile aynı sunucuda** olduğu kurulum içindir. Ayrı sunucudaki proxy için `loopback` kullanmayın; `TRUST_PROXY` yalnız IT'nin belirlediği proxy IP'lerini/dar CIDR aralıklarını içermelidir. Dinleme adresi ve firewall birlikte ayarlanır; Node portu yalnız bu proxy'lere açılır. Aşağıdaki HTTPS koşulları sağlanmadan servis başlatma kabulü tamamlanmış sayılmaz.

Named instance için `DB_INSTANCE=INSTANCE_ADI` tanımlayın; bu durumda DB_PORT kullanılmaz. SQL Browser ve ilgili ağ erişimi gerekir; IT sabit TCP portu sağlıyorsa port üzerinden bağlantı daha nettir. DB_SERVER alanına `sunucu\\instance` yerine yalnızca sunucu adı girin.

Domain hesabı gerekiyorsa `DB_AUTH=ntlm`, `DB_DOMAIN=DOMAIN`, `DB_USER=kullanici`, `DB_PASSWORD=...` kullanın. Bu, mevcut Windows oturumunu parolasız devralmak değildir.

Kurum CA'sı Node.js tarafından güvenilmiyorsa IT, Node sürecini başlatmadan önce `NODE_EXTRA_CA_CERTS` ortam değişkeniyle CA PEM dosyasını sağlamalıdır. Sertifika hatasını canlıda `DB_TRUST_SERVER_CERTIFICATE=true` yaparak geçmeyin; uygulama production modunda bunu reddeder. Yerel bir SQL Server testinin self-signed sertifikası için development modunda kullanılabilir; canlıya taşımayın.

MSSQL'i yerel bilgisayarda test ederken portal ayarları `APP_ORIGIN=http://localhost:3000`, `HOST=127.0.0.1`, `NODE_ENV=development` kalabilir. Veritabanı uzakta olsa da web uygulaması yerelde çalışır.

## 3. Şema ve başlangıç listeleri

Paket kurulumundan sonra:

```powershell
npm.cmd ci --omit=dev
npm.cmd run db:check
```

Bağlantı sağlandıysa IT, şema oluşturma yetkili hesapla **bir defa** şu komutu çalıştırır:

```powershell
npm.cmd run db:migrate
```

Komut yeni kurulumda `backend/migrations/001_mssql.sql` şemasını, başlangıçtaki 54 takım/7 liderliği ve güncel şema sürümünü hazırlar. Daha önce kişi bazlı sürüm 2 kurulmuşsa kişi tahsisleri ilgili ayın takımına toplanarak `kp_allocations` tablosuna aktarılır. Var olan takım tahsisleri korunur. Şema dosyaları IT incelemesi için düz T-SQL olarak bulunur; scriptler GO ayıracı içermez.

Ardından `.env` dosyasında çalışma zamanı hesabına dönün. Bu hesaba uygulamanın `dbo.kp_*` tablolarında SELECT/INSERT/UPDATE/DELETE ve şema sürüm tablosunda SELECT yeterlidir; CREATE TABLE/db_owner çalışma zamanı için gerekmez. Başlangıçta migration hesabını kalıcı olarak kullanmayın. Veritabanında `sp_getapplock` kullanımının kurum politikasıyla uyumunu kontrol edin.

Production modunda otomatik DDL kapalıdır. `DB_AUTO_MIGRATE=false` korunsun; açık migration komutu yönetici/IT operasyonudur. `.env` ve parolalar kaynak kod deposuna veya tarayıcıya gönderilmez.

## 4. Başlatma ve veri aktarımı

```powershell
npm.cmd start
```

Önce dağıtım yöneticisi bağımlılıkları ve `site/` derlemesini hazırlamalı, hedefte `npm.cmd run deploy:verify` başarılı olmalıdır. Komut yalnız paket dosyalarını okur; çalışan sürecin sürümünü veya SQL bağlantısını doğrulamaz. Hazırlama ve sınırlar [dağıtım doğrulama kılavuzunda](DAGITIM-DOGRULAMA-KILAVUZU.md), servis hesabı/çalışma dizini/ACL kabulü [Windows servis kılavuzunda](WINDOWS-BASLATMA-VE-SERVIS-KILAVUZU.md) bulunur. Servis açılışında paket kurulumu, build veya etkileşimli ilk kurulum çalıştırılmaz.

### HTTPS proxy koşulları

1. `APP_ORIGIN`, tarayıcıdan açılan HTTPS origin'i olmalıdır; yol, sorgu, fragment veya kullanıcı/parola içeremez. Production modunda HTTP origin reddedilir.
2. Node'a bağlanan gerçek proxy adresi `TRUST_PROXY` kapsamında olmalıdır. Aynı sunucuda `HOST=127.0.0.1` korunur; farklı sunucuda Node portuna erişim yalnız belirlenen proxy'lere verilir. Proxy–Node trafiğinin korunması ayrıca IT tarafından sağlanır.
3. Sınırdaki proxy, istemcinin gönderdiği `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto` başlıklarını silip doğruladığı bağlantı bilgisiyle yeniden oluşturur. HTTPS bağlantısı için Node'a `X-Forwarded-Proto: https` gönderir. Ek proxy'ler yalnız doğrulanmış zinciri sürdürür.
4. Proxy gerçek `Host` başlığını ve tarayıcının `Origin` başlığını normalize edilen `APP_ORIGIN` ile tutarlı geçirir. `X-Forwarded-Host`, Host denetiminin yerine kullanılmaz.

HTTPS origin'de eksik/HTTP protokol bilgisi veya güvenilmeyen bağlantının sahte HTTPS başlığı **403** ile, JSON ayrıştırma, giriş sayacı ve oturum/veri erişiminden önce reddedilir. Sağlık kontrolü de doğru proxy yolu üzerinden yapılmalıdır. Güvenilen IP'den erişen bir süreç başlığı taklit edebilir; `loopback` aynı makinedeki süreçleri ayırmaz. Header kontrolü ağ izolasyonu değildir. Tam kurallar ve sentetik/kurumsal test ayrımı [giriş koruması kılavuzunda](GIRIS-KORUMASI-VE-PROXY.md) bulunur.

Şirket ortamında Node.js'i servis olarak çalıştırın; kontrollü restart, yedekleme ve izleme için IT kabul kaydı oluşturun.

Yerel sql.js verilerini taşımak için:

1. Yerel portalda admin olarak **Veri yedeği indir**.
2. Yerel portalı durdurun; MSSQL ayarları ve şema hazır olsun.
3. MSSQL modunda portalı açın, **Yedek yükle** ile JSON dosyasını seçin.
4. Proje/çalışan/takım/dağılım sonuçlarını kontrol edin; kullanıcıları Yetkilendirme sekmesinden yeniden oluşturun.

Bu işlem hedefteki planlama verisini değiştirir; birleştirme değildir. Hedefte mevcut veri varsa önce yedek alın. JSON yedeği kullanıcı parolalarını/hesaplarını taşımaz. JSON şifrelenmiş değildir ve personel verisi içerir; erişimini sınırlayın. Yerel SQLite dosyasını MSSQL'e kopyalamak bu aktarımın yerine geçmez.

Önceki PostgreSQL/MongoDB sürümünün `aa-planning-data-v1` yedeği de yüklenebilir. Çok eski tek HTML sürümünün şifreli yedeğini dönüştürmek için `.env` içine geçici `LEGACY_PASSWORD='eski-ana-yonetici-parolasi'` ekleyin:

```powershell
node --env-file=.env backend/convert-legacy.mjs eski-yedek.json aktarim.json
```

İşlem bitince LEGACY_PASSWORD satırını kaldırın. `aktarim.json` dosyasını portalda yükleyin. Eski ana yönetici şifresi bilinmiyorsa bu araç şifreli yedeği açamaz.

## 5. Tablolar ve tutarlılık

`kp_leaders`, `kp_teams`, `kp_projects`, `kp_project_phases`, `kp_resources`, `kp_resource_versions`, `kp_allocations`, `kp_revisions`, `kp_users`, `kp_user_leaders`, `kp_sessions`, `kp_settings`, `kp_schema_migrations`. Daha önce sürüm 2 kullanıldıysa boşaltılan `kp_person_allocations` tablosu da bulunabilir.

Takım–proje–ay tahsisi benzersizdir. Kaynakların geçerlilik sürümleri ayrı satırlardır. Türkçe metinler NVARCHAR; kimlik/metin karşılaştırmaları BIN2 kolasyonla tanımlıdır. Başlangıç tarihi olmayan dahil aktif ilan reddedilir. Ana kayıtlar ilişkisel tablolarda tutulur; yalnızca eski takım arşivi JSON metnidir. Oturum son kullanma tarihleri iki motor arasında aynı UTC ISO biçiminde tutulur.

SQL girdileri parametrelerle gönderilir. Toplu MSSQL yazmaları parametreli OPENJSON satır kümeleriyle gerçekleştirilir. JSON metni SQL komutu olarak çalıştırılmaz. SQL Server transaction ve `sp_getapplock` ile ortak veri görünümü tutarlı okunur, yazmalar sıralanır. Revizyon kontrolü eski ekranın başka kullanıcının değişikliğinin üstüne yazmasını engeller. Transaction hatasında tamamı geri alınır. Kayıt silinince yalnızca revizyon bilgisi korunur.

sql.js yerel dosyayı geçici dosya + atomik yeniden adlandırma ile kaydeder. Kaydetme başarısızsa bellek içi durum da önceki haline döner. Tek süreç dosya kilidi ikinci kopyanın aynı dosyayı bozmasını önler. Çökmeden sonra kalan `.lock` dosyası, başka süreç olmadığı doğrulandıktan sonra elle kaldırılır. Diskteki dosya şifrelenmez; kişisel bilgisayarda test içindir. Production ortamında sqljs modu reddedilir.

Arayüz performans optimizasyonları, sayfalama, 60 aylık takvim ve filtreleme korunur. Backend kapsam görünümünü toplu okur; yüksek kayıt hacmi/çok yoğun yazma için ayrıca yük testi gerekir. MSSQL'de giriş denemesi sayacı veritabanında ortaktır; aynı DB ve aynı uygulama sürümündeki süreçler kotayı paylaşır. Yerel SQL.js sayacı süreç belleğindedir ve yerel dosya yalnız tek uygulama süreciyle kullanılabilir.

## 6. Testler ve teslim sınırı

```powershell
npm.cmd test
```

Otomatik testler parola, yetki, revizyon, iş kuralları, ortam yapılandırması ve sentetik SQL.js üzerinde HTTP/SQL akışlarını kapsar. Ekleme/silme, FK/CHECK, toplu rollback, eşzamanlı istek, import, yedek, oturum iptali, diskten yeniden açma, çift süreç kilidi ve disk yazma hatası senaryoları vardır. Kalite CI ayrıca TypeScript, frontend build, dağıtım doğrulama ve tarayıcı regresyonlarını çalıştırır. Test sayıları ve başarı iddiası belirli bir commit/koşuya aittir; [CI kanıt arşivine](CI-KANIT-ARSIVI.md) bakın.

**4 Ekim 2026 durumu:** geçici GitHub CI SQL Server 2022 ortamındaki `63780fc` commit koşusu 19/19 native testi geçti; şema 30 ve test temizliği doğrulandı. Rapor ve kaynak hash'leri [CI kanıt arşivinde](CI-KANIT-ARSIVI.md) saklanır. Bu, bu bilgisayarda veya kurum SQL Server'ında çalıştırılmış bir test değildir; sonraki commit'lerin tamamını da kapsamaz. Yerel SQLite testleri native T-SQL davranışını kanıtlamaz; CI'nin test hesabı/self-signed sertifikası kurum kimliği/CA/Windows/proxy kabulü değildir. Canlıya geçmeden önce aşağıdaki kontrolleri IT'nin ayrı test SQL Server'ında uygulayın.

IT'nin **boş, ayrı ve adı `_test` ile biten** veritabanı için `.env.mssql.test.example` dosyasını `.env.mssql.test` olarak kopyalayıp `TEST_DB_*` bağlantı alanlarını doldurun. Test komutu uygulamanın `.env` dosyasını okumaz ve `DB_*` alanlarına geri dönmez. Bağlantı hesabının varsayılan şeması `dbo`; yetkileri veritabanında `VIEW DEFINITION`, `CREATE TABLE` ve `dbo` üzerinde `ALTER`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` olmalıdır. Sonra:

```powershell
npm.cmd run test:db -- --env-file .env.mssql.test --report native-mssql-report.json
```

Test, veritabanında herhangi bir kullanıcı tablosu/görünüm/yordam gibi nesne varsa çalışmayı reddeder. Ayrı test kilidi ikinci çalıştırıcının aynı ortamı kullanmasını engeller. Yalnızca boşluğu doğrulanan test veritabanında sabit uygulama tablolarını oluşturur ve temizler; beklenmeyen nesne oluşursa otomatik temizlik durur. Native şema geçişi, HTTP, iki bağımsız havuzda paralel yazma/okuma kilidi ve sentetik rol bazlı ölçüm senaryolarının belirtilen CI koşusu başarılıdır; **kurum ortamı kabulü henüz yapılmadı**. Komutlar, ölçüm sınırları ve elle çalıştırılabilen GitHub test ortamı [MSSQL test kılavuzunda](MSSQL-TEST-KILAVUZU.md) açıklanır.

## 7. Kod dosyaları

- `backend/adapters/sqljs.mjs`: yerel SQLite, kalıcı dosya, kilit ve atomik kayıt.
- `backend/adapters/mssql.mjs`: mssql havuzu, TLS/kimlik doğrulama, transaction ve toplu SQL.
- `backend/store.mjs`: ortak ilişkisel veri okuma/yazma, yetki ve revizyon.
- `backend/tables.mjs`: sabit tablo/sütun tanımları.
- `backend/app.mjs`: API uçları, oturum/CSRF ve rol kontrolleri.
- `backend/setup.mjs`: yerel ilk kurulum; mevcut .env'yi değiştirmez.
- `backend/migrate.mjs`, `backend/check-db.mjs`: IT şema ve bağlantı komutları.
- `frontend/src/storage.ts`: mevcut arayüzün API bağlantısı.

Kaynak paketten dağıtım hazırlarken `npm ci --omit=dev`, `npm --prefix frontend ci --include=dev`, `npm --prefix frontend run typecheck`, `npm run build` ve `npm run deploy:verify` kullanılır; PowerShell'de `npm.cmd` yazılabilir. Frontend derleme paketleri production ortamında da gereklidir. Hazır `site/` ile kaynak/manifest birlikte taşınır. Terminal başlatıcıları arayüzü derler; headless servis ise dağıtım sırasında hazırlanıp doğrulanan paketi çalıştırır. Kaynak değiştiğinde eski `site/` kullanılmaz.

Resmî kaynaklar:

- https://github.com/sql-js/sql.js
- https://github.com/tediousjs/node-mssql
- https://learn.microsoft.com/en-us/sql/t-sql/functions/openjson-transact-sql
- https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql
- https://learn.microsoft.com/en-us/sql/linux/quickstart-install-connect-docker

### Giriş sınırı ve güvenilen proxy

Yukarıdaki **HTTPS proxy koşulları** birlikte uygulanır: güvenilen gerçek proxy adresi, yalnız proxy'ye açık Node portu, yeniden oluşturulan forwarded başlıkları, `X-Forwarded-Proto: https` ve doğru Host/Origin. Doğrudan yerel HTTP kullanımında `TRUST_PROXY` boş bırakılır; `true`, hop sayısı, DNS adı veya tüm ağı kapsayan `/0` kullanılamaz.

Giriş limiti proxy arkasında doğrulanan istemci IP adresinden hesaplanır. Başarılı girişler deneme kotasını tüketmez; başarısız denemeler için IP ve kullanıcı adı sınırları korunur. **Şema 29:** MSSQL'de `kp_rate_limits` ortak sayaç deposu otomatik kullanılır; aynı DB'ye bağlı uygulama örnekleri kotayı paylaşır. Yerel SQL.js sayacı süreç belleğinde kalır. IPv4-mapped adresler normalize edilir, IPv6 `/64` grubu ortak kota kullanır; bozuk/büyük login gövdeleri de sayılır. Depo erişimi kesilirse 503 döner, yerel sayaca geri dönülmez.

MSSQL güncellemesinde tüm uygulama örneklerini durdurun, tam yedek alın, IT migration hesabıyla `npm run db:migrate` çalıştırıp çalışma zamanı hesabına dönün. Sayaç tablosu için SELECT/INSERT/UPDATE/DELETE erişimi gerekir. Ayrı sayaç kilidi kaynak verilerinin genel kilidini değiştirmez. Kurulum, header/firewall ve iki sunuculu test ayrıntıları [giriş koruması kılavuzunda](GIRIS-KORUMASI-VE-PROXY.md). İki native havuz/HTTP hizmetinde ortak sayaç belirtilen CI koşusunda doğrulandı; kurum proxy adresleri, ağ topolojisi, asgari yetkili SQL hesabı ve CA kabulü bekliyor.

### 1 Ekim 2026 mimari iyileştirme paketi — şema 25

Aşağıdaki notlar tarihsel değişiklik kaydıdır; 4 Ekim'deki CI durumu ve kurum kabul sınırları yukarıda açıklanmıştır. Bakım/yedek/geri dönüşün gerçek kurum koşusu, native uygulama CI'sinden ayrı kabul işidir.

- Bu sürüm Node.js 24 veya üzerini gerektirir. Sunucu ve arayüz, `shared/` içindeki aynı TypeScript iş kurallarını kullanır; dağıtıma bu klasör de dahil edilmelidir.
- Güncellemeden önce veritabanının yedeğini alın. MSSQL ortamında migration hesabıyla `npm run db:migrate` çalıştırın; ardından çalışma zamanı hesabına dönün. Şema 25, `kp_audit_events` tablosunu ve zaman indeksini ekler. Yerel SQL.js modunda migration başlangıçta otomatik uygulanır.
- Değişiklik geçmişi yönetici yetkisiyle Yetki Kontrol Ekranı → Değişiklik Geçmişi bölümünden görüntülenir. Geçmiş yalnızca bu sürümden sonra yapılan işlemleri kapsar; eski hareketler sonradan üretilemez.
- Uygulama içindeki JSON veri yedeği denetim geçmişini içermez. Geçmişi korumak için tam veritabanı yedeği alın. Saklama süresi ve arşivleme politikası henüz otomatik değildir.
- 2 Ekim 2026 güncellemesi: geçmiş saklama süresi 5 yıl seçildi. SQL.js için doğrulanan bakım araçları ve SQL Server'ın native yedek/geri dönüş prosedürü [veri saklama kılavuzunda](VERI-SAKLAMA-VE-YEDEKLEME.md). Otomatik silme/zamanlayıcı açılmadı; native MSSQL bakım koşusu ayrı test ortamında bekliyor.
- Kilit dosyasına uygun kurulum için `node backend/ensure-dependencies.mjs`; kontrol ve derleme için `npm run verify` kullanın. Windows betiği ve gerçek MSSQL bağlantısı bu pakette yerel olarak çalıştırılarak doğrulanmadı.
