# Giriş koruması ve proxy kurulumu

## Sayaç seçimi

| Kurulum | Sayaç | Sunucu yeniden başladığında | Birden fazla uygulama sunucusu |
|---|---|---|---|
| Yerel SQL.js | Süreç belleği | Sayaç sıfırlanır | Desteklenmez; SQL.js dosyası tek süreç kilidiyle korunur |
| MSSQL | Aynı veritabanındaki `kp_rate_limits` | Süresi dolmamış sayaç korunur | Aynı DB ve aynı uygulama sürümüyle ortak sayaç kullanılır |

MSSQL'de ortak sayaç otomatik seçilir; Redis veya ek servis gerekmez. Yerel `.env` dosyasını değiştirmek gerekmez. Kurumun kaç uygulama sunucusu kullanacağı ve gerçek proxy adresleri henüz doğrulanmadı; mevcut yerel uygulama tek süreç olarak kalır.

## Kurallar

- 15 dakikalık sabit pencere: istemci IP grubu başına **60**, normalize edilmiş kullanıcı adı başına **15** giriş denemesi. Parola kontrolü devam ederken deneme ayrılır; doğru parola ve aktif hesapta yalnız o deneme iade edilir. Önceki başarısız denemeler silinmez. Pasif/olmayan kullanıcı ve yanlış parola aynı hata yanıtını verir.
- Bozuk JSON, geçersiz alanlar ve 4 KB üzerindeki giriş gövdeleri de IP kotasına dahildir. Origin/Host kontrolü bunlardan önce yapılır. Kullanıcı adı boşluklardan arındırılır ve küçük harfe çevrilir.
- IPv4 ve IPv4-mapped IPv6 aynı adres sayılır. IPv6'daki aynı `/64` içindeki adresler ortak IP kotası kullanır; farklı metin gösterimleri ve geçici adresler yeni kota yaratmaz. Kurumda aynı IPv6 `/64`'ünü veya NAT IP'sini paylaşan çalışanlar IP kotasını da paylaşır; başarılı girişler kotayı tüketmez.
- Kullanıcı yetkisi değiştirme ucu aynı altyapıyla admin kimliği başına 60 işlem / 15 dakika sınırını korur.
- Sınırda **429** ve pencerenin kalan saniyesini belirten `Retry-After` döner. Ortak sayaç sorgusu/iadeleri çalışmıyorsa **503** ve `Retry-After: 30` döner; yerel belleğe geçerek yeni kota açılmaz. Bu durumda yeni oturum verilmez.
- MSSQL pencere zamanı SQL Server'ın UTC saatinden hesaplanır. Her sayaç kendi transaction kilidini alır; kaynak verilerinin `aa_kaynak_data` kilidini almaz. Sayaç kilidi bekleme süresi 2 saniyedir. Asıl kaynak işlemlerinin mevcut genel kilit/rollback davranışı korunur.
- Yerel bellek 10.000 sayaçla sınırlıdır; dolu ve süresi dolmamış depoda yeni sayaç yerine 503 döner. Her dakika süresi dolmuş sayaçlar temizlenir. MSSQL temizliği her uygulama sürecinde en çok 1.000 eski satır siler; aktif pencereyi silmez. Çok yoğun kullanımda eski satır sayısı ve 503 yanıtları izlenmelidir; bu sürüm için native kapasite ölçümü henüz yoktur.
- DB'de anahtarın SHA-256 özeti, pencere kimliği, deneme sayısı ve bitiş zamanı saklanır. Ham IP/kullanıcı adı/parola/oturum token'ı saklanmaz. Hash anonimleştirme veya şifreleme garantisi değildir. Sayaç tablosu işlem geçmişi değildir; 5 yıllık audit politikası bu geçici sayaçlara uygulanmaz. Tam DB yedeği bu tabloyu da içerir; ekranın JSON yedeği içermez.

## Şema 29'a geçiş

Yerel SQL.js başlangıçta boş sayaç tablosunu ekler; mevcut kaynak/proje/kullanıcı/geçmiş/generation verilerini değiştirmez. Tablo yerel modda giriş sayacı olarak kullanılmaz; şema ve tam yedek uyumu için bulunur.

MSSQL için uygulama örneklerini durdurun, güncel tam yedek alın, migration hesabıyla `npm run db:migrate` çalıştırın ve çalışma zamanı hesabına dönerek tüm örnekleri aynı sürümle başlatın. Şema hazır değilse sunucu başlamaz; production modunda otomatik DDL açılmaz. Çalışma zamanı hesabının `kp_rate_limits` üzerinde SELECT/INSERT/UPDATE/DELETE ve mevcut transaction application lock erişimi gerekir; DDL yetkisi gerekmez.

## Güvenilen proxy

| Bağlantı | `TRUST_PROXY` |
|---|---|
| Tarayıcı → yerel Node | Boş |
| HTTPS proxy → aynı sunucudaki Node | `loopback` |
| HTTPS proxy → farklı uygulama sunucusu | IT'nin bildirdiği proxy IP'leri / dar CIDR aralıkları, virgülle ayrılır |

`true`, hop sayısı, DNS adı ve `/0` reddedilir. Adres ayarı veritabanı bağlantısı/bootstrap başlamadan doğrulanır. `loopback` yalnız gerçekten aynı makinedeki proxy için kullanılmalıdır.

Express zinciri sağdan sola inceler ve en yakın güvenilmeyen adresi istemci sayar. Bu nedenle dışarıdan uydurulan soldaki bir IP, güvenilmeyen aracı üzerinden yeni kota açamaz. Bunun güvenilir olması kurumun ağ topolojisine bağlıdır. [Express proxy açıklaması](https://expressjs.com/en/guide/behind-proxies/) bu davranışı ve header kontrolünü açıklar.

Kurum kurulumunda:

1. İnternet/kurum sınırındaki proxy dışarıdan gelen `X-Forwarded-For`, `X-Forwarded-Host`, `X-Forwarded-Proto` başlıklarını silip doğrulanmış bağlantı bilgisiyle oluşturur. Ek iç proxy varsa yalnız bu doğrulanmış zincire gerçek önceki adresi ekler.
2. Node portuna sadece belirlenen proxy'ler erişebilir; doğrudan erişim ağ kuralıyla kapatılır. Aynı makinedeki proxy için `HOST=127.0.0.1` korunur. Ayrı proxy varsa dinleme adresi ve firewall IT tarafından birlikte ayarlanır.
3. Proxy `Host` ve tarayıcının `Origin` başlığını `APP_ORIGIN` ile tutarlı geçirir; production `APP_ORIGIN=https://...` kullanır. Host/Origin koruması forwarded-host üzerinden gevşetilmez.
4. Aynı ve farklı istemci IP'leri, sahte soldaki IP, iki proxy zinciri ve tüm uygulama örneklerine dönüşümlü başarısız giriş ayrı test hesabıyla doğrulanır. Gerçek kullanıcı hesapları bloke edilmez.

Transaction kilidi aynı veritabanı/principal/resource kapsamında ortaktır ve commit/rollback sonunda bırakılır. [Microsoft `sp_getapplock` belgesi](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql) bu kapsamı tanımlar. Aynı DB'ye bağlı farklı sunucular tek pencereyi kullanacak şekilde uygulanmıştır; farklı DB'ler veya farklı uygulama sürümleri ortak sayaç kurulumu sayılmaz.

## Doğrulama sınırı

Yerel testler: bellek sınırı/temizliği, pencere bitişi, eşzamanlı ve geç iade, SQL.js kalıcılığı/migration, iki HTTP hizmetinin aynı depoyu kullanması, kullanıcı/IP kotası, bozuk/büyük gövde, IPv4/IPv6 ve proxy zinciri, depo hatasında girişin durması.

`npm run test:db` paketine **iki bağımsız native MSSQL havuzunda** eşzamanlı kota ve iki HTTP hizmeti testi, genel kaynak kilidi tutulurken bağımsız sayaç testi eklendi. Native MSSQL bağlantısı, Windows/NTLM/TLS ve kurum proxy'si bu makinede çalıştırılarak doğrulanmadı. Yerel ortak SQL.js testi bu doğrulamanın yerine geçmez; [native test kılavuzundaki](MSSQL-TEST-KILAVUZU.md) ayrı ortam koşusu 31. adımda bekliyor.
