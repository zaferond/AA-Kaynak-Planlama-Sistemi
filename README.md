# AA Mühendislik Liderliği Kaynak Yönetimi Sistemi

Node.js 24 veya üzeri gerektirir. İlk kurulumda ve sonraki açılışlarda Mac Terminal'de bu klasöre geçip:

```sh
bash baslat-mac.sh
```

Windows'ta `baslat-windows.cmd` dosyasını çalıştırın. Başlatıcı ilk giriş hesabını oluşturur, gerekli paketleri kurar ve arayüzü derler. Sonraki açılışlarda da aynı dosyayı kullanın.

Uygulama varsayılan olarak `http://127.0.0.1:3000` adresinde açılır. Aynı anda başka bir kopyası çalışıyorsa önce onu durdurun. Kurulum ve veritabanı seçenekleri için [başlangıç kılavuzuna](ONCE-BUNU-OKUYUN.md) ve [MSSQL geçiş notlarına](IT-MSSQL-GECIS.md) bakın.

İşlem geçmişi saklama süresi **5 yıl** olarak tanımlıdır; otomatik silme zamanlayıcısı kurulmadı. Tam DB yedeği, doğrulama, geçmiş arşivi, temizleme önizlemesi ve oturumları kaldıran kurtarma kopyası için [veri saklama ve yedekleme kılavuzuna](VERI-SAKLAMA-VE-YEDEKLEME.md) bakın. Ekrandaki JSON yedeği hesapları ve işlem geçmişini içermez.
