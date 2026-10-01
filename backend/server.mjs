import { trustedProxyAddresses } from "./trusted-proxies.mjs";
import { Store } from "./store.mjs";
import { createApp } from "./app.mjs";
import { hashPassword } from "./auth.mjs";
const env = process.env,
  origin = env.APP_ORIGIN || "http://localhost:3000";
const secure = origin.startsWith("https://");
if (env.NODE_ENV === "production" && !secure)
  throw Error("Production için HTTPS APP_ORIGIN gerekir.");
const store = new Store();
try {
  await store.connect();
  console.log("Veritabanı modu:", store.provider);
  if (!(await store.findUser({ id: "root-admin" }))) {
    const username = (env.ADMIN_USERNAME || "").trim().toLowerCase();
    if (!/^[a-z0-9._@+-]{3,100}$/.test(username))
      throw Error("Önce npm run setup komutunu çalıştırın.");
    await store.bootstrapUser({
      _id: "root-admin",
      username,
      name: "Sistem Yöneticisi",
      role: "admin",
      leaders: [],
      active: true,
      password: await hashPassword(env.ADMIN_PASSWORD),
      revision: 1,
      version: 1,
    });
  }
  const app = createApp(store, {
    origin,
    secure,
    trustedProxies: trustedProxyAddresses(env.TRUST_PROXY),
  });
  const server = app.listen(
    Number(env.PORT || 3000),
    env.HOST || "127.0.0.1",
    () =>
      console.log(
        "\nSistem hazır: " +
          origin +
          "\nBu pencere açık kalmalı. Durdurmak için Control+C.",
      ),
  );
  server.on("error", async (e) => {
    console.error(
      e.code === "EADDRINUSE"
        ? "3000 portu kullanımda. Önce açık olan eski portalı durdurun."
        : "Sunucu başlatılamadı: " + e.code,
    );
    app.locals.close();
    await store.close();
    process.exitCode = 1;
  });
  for (const sig of ["SIGINT", "SIGTERM"])
    process.once(sig, () =>
      server.close(async () => {
        app.locals.close();
        await store.close();
        process.exit(0);
      }),
    );
} catch (e) {
  console.error("Başlatılamadı:", e.code || e.message);
  console.error(
    "Yerel modda dosya kilidini; MSSQL modunda sunucu, ağ erişimi ve .env ayarlarını kontrol edin.",
  );
  await store.close();
  process.exitCode = 1;
}
