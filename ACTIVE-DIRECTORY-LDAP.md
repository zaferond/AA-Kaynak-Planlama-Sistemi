# Windows Active Directory / LDAP

## Kullanım

Yetki Kontrol Ekranı → **AD Kullanıcısına Yetki Tanımla** ile kurumsal dizinden kullanıcı seçilir. Kullanıcı adı, ad soyad ve e-posta salt okunurdur. Admin uygulamadaki çalışan kaydını, Normal Kullanıcı/Yönetici rolünü ve liderlik kapsamını eşleştirir. Yöneticinin kendi gerçekleşen dağılımı, izin ve eğitim kayıtları çalışan eşleştirmesiyle korunur. Yeni yetkilendirme yalnız admin tarafından yapılabilir; mevcut yetkiler revision denetimiyle güncellenir.

AD bağlantısı tanımlı değilken kullanıcı listesi ve yeni yetkilendirme kapalıdır. Sahte/örnek dizin kullanıcıları uygulamada gösterilmez. Arama ilk 50 uygun sonucu getirir; daha fazla sonuç varsa ad, kullanıcı adı veya e-posta ile daraltılır. Kontrol karakterleri, geçersiz kimlik/e-posta veya uygulamanın 150 karakterlik ad sınırını aşan AD kayıtları listelenmez. Çalışan kaydı ayrıca seçilir; isim eşitliğiyle otomatik eşleştirme yapılmaz.

AD şifresi okunmaz, içeri aktarılmaz veya uygulama veritabanına kaydedilmez. Kullanıcı mevcut giriş ekranına kurumsal kullanıcı adını (`sAMAccountName`) veya UPN'sini ve AD şifresini yazar. Uygulama şifreyi doğrulanmış TLS bağlantısında kullanıcı bind işlemiyle doğrulatır. UPN ile e-posta her kurumda aynı olmayabilir. Microsoft'un [AD parola açıklaması](https://learn.microsoft.com/en-us/troubleshoot/windows-server/active-directory/change-windows-active-directory-user-password) `unicodePwd` alanının okunamadığını belirtir. Uygulama bu alanı istemez.

## IT bağlantı ayarları

Gerçek değerleri sürüm kontrolü dışında, yalnız yetkili servis hesabının okuyabildiği `.env` dosyasında tutun. Mevcut `.env` dosyasının üzerine örnek dosyayı kopyalamayın. Örnek alanlar `.env.example` / `.env.mssql.example` içindedir:

```dotenv
AD_ENABLED=true
AD_LDAP_URL=ldaps://dc.example.internal:636
AD_BASE_DN=OU=Employees,DC=example,DC=internal
AD_BIND_DN=CN=ReadOnlyService,OU=ServiceAccounts,DC=example,DC=internal
AD_BIND_PASSWORD='IT_TARAFINDAN_TANIMLANACAK'
# İsteğe bağlı: yalnız bu gruba doğrudan/dolaylı üye kullanıcılar.
AD_GROUP_DN=CN=AA-Portal-Users,OU=Groups,DC=example,DC=internal
# İsteğe bağlı: işletim sisteminin güvenmediği kurum CA zinciri (PEM).
AD_CA_FILE=C:/Certificates/company-ca.pem
```

Yalnız **LDAPS**, en az TLS 1.2 ve geçerli sertifika/hostname doğrulaması desteklenir. Düz `ldap://`, URL içinde şifre ve sertifika kontrolünü kapatma desteklenmez. Servis hesabına belirtilen OU/grup içindeki gerekli kullanıcı alanlarını okuma izni yeterlidir; uygulama dizine ekleme, silme veya değiştirme yapmaz. Kurum dışından giriş için uygulamanın kendisi de mevcut HTTPS proxy/TLS kurulumuyla sunulmalıdır. DB_AUTH/NTLM veritabanı bağlantısı, AD kullanıcı girişi ayarından bağımsızdır.

Bağlantı başına 5 saniye timeout, süreç başına en fazla dört LDAP bağlantısı; admin başına 15 dakikada 120 dizin araması uygulanır. LDAP araması belirtilen base DN ve isteğe bağlı grup ile sınırlandırılır; referral başka sunucuya izlenmez. [ldapts resmi belgeleri](https://github.com/ldapts/ldapts) kullanılan istemciyi açıklar.

## Kimlik ve oturum davranışı

- Eşleştirme sabit `objectGUID` kimliğiyle tutulur. Kullanıcı adı/ad/e-posta değişiklikleri başarılı AD girişinde güncellenir; rol, liderlik ve çalışan bağlantısı korunur. Önceki oturumlar iptal edilir.
- Uygulamada önceden yetkilendirilmemiş AD kullanıcıları giriş yapamaz. Kullanıcı adının mevcut yerel hesapla çakışması yetkilendirmeyi durdurur; hesaplar isim üzerinden devralınmaz veya otomatik dönüştürülmez.
- Mevcut yerel hesaplar ve ana yönetici hesabı yerel kalır. AD hesaplarında yerel şifreye geri dönüş yoktur. Yerel hesapların kurumsal politikaya göre kapatılması/dönüştürülmesi bu değişiklikte otomatik yapılmaz.
- AD şifresi yerine, mevcut NOT NULL parola/yedek sözleşmesini korumak için açıklanmayan rastgele bir değerin scrypt özeti bulunur; bu özet AD girişinde kullanılmaz. Tam yedeklerde yerel hesapların parola özetleri mevcut güvenli yedek prosedürüne tabidir; AD şifreleri bulunmaz.
- AD oturum süresi “Beni Hatırla” seçilse de en fazla 12 saattir. Her istekte dizin etkinliği denetlenir; olumlu sonuç en fazla 60 saniye önbellekte tutulur. Pasif, kilitli, süresi dolmuş hesaplar veya izin verilen gruptan çıkan hesaplar bu denetimde reddedilir. Bağlantı kesilirse önbellek süresi bittikten sonra istekler 503 ile durdurulur; yerel doğrulamaya geçilmez. Girişte şifre her seferinde AD'ye doğrulatılır. Parola değişikliği tek başına mevcut uygulama oturumunu hemen iptal etmez; en geç 12 saatlik oturum süresi uygulanır.
- AD grup üyeliği uygulama rolünü yükseltmez. Rol/çalışan eşleştirmesini admin yönetir. Yetki değişiklikleri mevcut oturumları iptal eder.

## Dağıtım ve doğrulama

Bu sürüm **şema 32** ile `directory_id`, `email`, `auth_source` ve tekil dizin kimliği kısıtlarını ekler. Mevcut hesaplar `local` kalır; çalışan bağlantıları ve parola özetleri korunur. Çalışan veritabanında bu geliştirme sırasında migration veya hesap oluşturma çalıştırılmamıştır.

IT, mevcut yedek/doğrulama prosedürünü uygulayıp servisi durdurduktan sonra yeni paket ve bağımlılıklarla, doğru test veritabanında `npm run db:migrate` / `npm run db:check` adımlarını doğrulamalıdır. MSSQL'de `DB_AUTO_MIGRATE=false` bırakılır. Eski şema 31 tam yedeği yeni şema 32 olarak kabul edilmez; gerektiğinde eski sürümün doğrulanmış paketiyle izole ortamda geri yüklenip ardından yükseltilir. AD ayarları servis yeniden başlatılınca okunur.

Otomatik testler geçici SQL.js/MSSQL veritabanları ve sentetik dizin kullanır. LDAP istemcisinin sözleşmesi, filtre değerlerinin ayrılması ve ikili GUID/Türkçe karakter kodlaması, parola bind hataları, pasif hesap, timeout/erişilememe davranışı, yetki kapsamı, çakışmalar ve tarayıcı akışı test edilir. Gerçek kurum AD sunucusu, CA zinciri, OU/grup izinleri, ağ/firewall, hesap kilitleme politikası ve gerçek yük IT ortamında ayrıca doğrulanmalıdır. Kurumsal bağlantı bilgileri sağlanmadan gerçek AD bağlantısının çalıştığı iddia edilmez.
