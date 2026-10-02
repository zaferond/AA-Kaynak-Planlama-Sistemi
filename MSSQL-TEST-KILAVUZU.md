# Native MSSQL doğrulaması — 31. adım

Bu paket gerçek SQL Server üzerinde çalışacak kontrolleri hazırlar. 2 Ekim 2026'da bu bilgisayarda SQL Server/Docker veya ayrılmış test bağlantısı bulunmadığından **native test ve native performans sonucu henüz yoktur**. Yerel güvenlik testleri gerçek MSSQL çalıştırması değildir.

## Ayrı test sunucusunda çalıştırma

Node.js 24 ve `npm ci` gerekir. IT boş, ayrı ve adı `_test` ile biten bir veritabanı ayırır. Test hesabının varsayılan şeması `dbo`; yetkileri veritabanında `VIEW DEFINITION`, `CREATE TABLE` ve `dbo` şemasında `ALTER`, `SELECT`, `INSERT`, `UPDATE`, `DELETE` olmalıdır. Bu yetkiler yalnız ayrı test veritabanı içindir. Veritabanı uyumluluk seviyesi en az 130 olmalıdır; [OPENJSON gereksinimi](https://learn.microsoft.com/en-us/sql/t-sql/functions/openjson-transact-sql) bunu gerektirir.

`.env.mssql.test.example` dosyasını `.env.mssql.test` olarak kopyalayıp yalnız test hesabı bilgileriyle doldurun. Bu dosya Git'e dahil edilmez; uygulamanın `.env` dosyası okunmaz ve `DB_*` alanlarına geri dönülmez. SQL veya NTLM bağlantısı kullanılabilir; NTLM için ayrıca `TEST_DB_DOMAIN` gerekir. Şifreyi sohbet veya rapora eklemeyin.

```sh
npm run test:db -- --env-file .env.mssql.test --report native-mssql-report.json
```

Mevcut rapor dosyasının üzerine yazılmaz. Tekrar çalıştırmada farklı rapor adı verin. Ortam değişkenleriyle çalıştırılacaksa bütün bağlantı alanları `TEST_DB_*` olmalıdır. Normal uygulama başlatma ve `db:migrate` komutları değişmedi.

## Korunan sınırlar

- Bağlanılan veritabanı adı, `dbo`, metadata erişimi ve uyumluluk seviyesi ilk aşamada kontrol edilir. Herhangi bir kullanıcı tablosu, görünüm, yordam, fonksiyon, synonym, sequence veya trigger bulunan veritabanı reddedilir.
- Ayrı transaction'a ait `aa_kaynak_native_test` kilidi boşluk kontrolünden temizliğe kadar tutulur. İkinci test çalıştırıcısı aynı veritabanını kullanamaz. Bu kilit uygulamanın `aa_kaynak_data` kilidinden ayrıdır. [MSSQL application lock sözleşmesi](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql) kullanılır.
- Yalnız boşluğu doğrulandıktan sonra sahiplenilen test şemasında temizlik yapılır. Temizlikte sabit uygulama tablo listesi ve `dbo` kullanılır; beklenmeyen nesne oluşursa silme başlamadan işlem durur.
- Başarı raporu ancak bütün kontroller, havuz kapatma, tablo temizliği ve test kilidinin bırakılması tamamlandıktan sonra yazılır. Alt test hatası sonraki aşamaya veya başarı raporuna geçmez.
- Uygulamanın veritabanı, hesapları, `.env` dosyası veya 3000 portundaki çalışan sunucu kullanılmaz. Native HTTP senaryoları ayrı geçici localhost portu açar.

## Native senaryolar

1. Eski v2 kişi dağılımlarının şema 29'a taşınması, Türkçe veri ve toplamların korunması, yeniden bağlantıda dönüşümün tekrarlanmaması.
2. Ortak HTTP suite: CRUD, yetki/CSRF/oturum iptali, FK/CHECK, toplu geri alma, içe aktarma sayaçları, generation/revision, restore ve liderlik işlemleri.
3. Ortak eşzamanlılık suite: aynı hücrede tek kazanan, 24 bağımsız kayıt, çakışan batch, aylık sınır/takvim/izin/eğitim ve tutarlı okuyucular.
4. **İki bağımsız native bağlantı havuzu:** aynı revision yarışı; ortak okuma kilitlerinin birlikte çalışması; yazmanın okuyucuya yarım veri göstermemesi; kilitlerin sıfır timeout ile doğrudan sınanması.
5. Yanıt hazırlama hatasında reset'in verileri, sürümleri, generation ve audit ile geri alınması.
6. OPENJSON üzerinden uzun Türkçe not, tamamlandı bilgisi, karma aralık/Milestone ve içi boş baklavanın korunması; yanlış display/diamond değerlerinin native CHECK tarafından reddedilmesi.
7. BIN2 karşılaştırmalı revision kapsamı: büyük/küçük harf, Türkçe, wildcard karakterleri, özel/tombstone sürümler, 900 parametre ve 901/legacy fallback.
8. Rol bazlı filtreli snapshot'ın bağımsız tam okuma referansıyla eşitliği; 24 bağımsız yazmanın kendi commit yanıtı; bağlantı yeniden açıldığında veri/şema eşitliği.
9. İki bağımsız MSSQL havuzunda 40 eşzamanlı sayaç rezervasyonundan yalnız 15'inin kabulü; yeni hizmette kotanın korunması; iki HTTP hizmetinde ortak IP/kullanıcı adı sınırı. Kaynak verilerinin genel kilidi tutulurken sayaç kilidinin bağımsız çalışması. Bu testler eklenmiştir, henüz native ortamda koşulmamıştır.

## Ölçüm ve rapor

Varsayılan: 1.000 planlanan kayıt, 80 çalışan, 200 gerçekleşen/yüzde kaydı, 20 kişisel gün; bir ısınma ve üç ölçüm. HTTP suite ve havuz suite'leri bittiğinde ölçüm için şema yeniden oluşturulur; önceki fixture/audit taşınmaz. Admin/yönetici/normal görünüm için medyan/en uzun süre, SQL'den dönen allocation/revision satırları ve JSON boyutu raporlanır. 24 yazma iki havuza dağıtılır; toplam süre global kilidi de içerir.

```sh
npm run test:db -- --env-file .env.mssql.test --size 10000 --samples 5 --report native-mssql-10000.json
```

`size`: 24–100.000; `samples`: 1–10. Rapor sürücü/Store/SQL kaynak hash'leri, Node ve SQL Server sürümü, şema ve uyumluluk seviyesi içerir. Kullanıcı verileri, bağlantı adresi, kullanıcı adı ve şifre içermez. SQL satırı sayısı dönen satırdır; SQL Server'ın fiziksel tarama/IO/sorgu planı ölçümü değildir. Store ölçümü HTTP/tarayıcı/WAN, üretim p95 veya kapasite garantisi değildir.

Global uygulama kilidi bu pakette korunur. Kaldırılması veya repository kapsamının değiştirilmesi ancak native sonuçlar incelendikten sonra değerlendirilebilir.

## GitHub üzerinde isteğe bağlı test ortamı

`Native MSSQL verification` workflow'u **yalnız elle çalıştırılır**. Ubuntu x64 üzerinde geçici SQL Server 2022 Developer container'ı ve boş test veritabanı oluşturur; her çalıştırmada ayrı rastgele şifre üretir, loglarda maskeler ve sonuç JSON'unu artifact olarak saklar. Çalışma sonunda container silinir. Push bu testi otomatik başlatmaz.

Bu workflow'un container'ında şifreleme açık, self-signed sertifika için trust açıktır. Bu koşu kurumun CA/hostname doğrulamasını, NTLM/domain bağlantısını, şirket proxy'sini veya Windows servis kurulumunu doğrulamaz. Kurum bağlantısı bunlar için ayrı test gerektirir. [Microsoft container desteği](https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-deployment) x86-64 Linux içindir; bu bilgisayar ARM64 olduğundan yerel bir koşu yapılmış sayılmaz.

Workflow henüz çalıştırılmadı. Gerçek koşu başarılı olmadan 31. adımın native doğrulaması tamamlandı olarak işaretlenmemelidir.
