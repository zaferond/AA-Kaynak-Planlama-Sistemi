# AA Mühendislik Liderliği Kaynak Yönetimi Sistemi

Node.js 24 veya üzeri gerektirir. Yerel kurulum için:

```sh
npm ci
npm --prefix frontend install
cp .env.example .env
npm run build
npm start
```

Uygulama varsayılan olarak `http://127.0.0.1:3000` adresinde açılır. Kurulum ve veritabanı seçenekleri için [başlangıç kılavuzuna](ONCE-BUNU-OKUYUN.md) ve [MSSQL geçiş notlarına](IT-MSSQL-GECIS.md) bakın.
