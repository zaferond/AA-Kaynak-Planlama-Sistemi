import { ROOT_ADMIN_ID } from "../shared/access.ts";
import express from "express";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hashPassword,
  verifyPassword,
  token,
  digest,
  publicUser,
  admin,
  fail,
} from "./auth.mjs";
import {
  applyLeaderChange,
  reset,
  importRows,
  restore,
} from "./operations.mjs";
import { changeAndView } from "./change-service.mjs";
import { sendDataSnapshot } from "./data-response.mjs";
import { applicationAddress } from "./http-config.mjs";
import {
  createAttemptLimiter,
  clientAddressKey,
  ATTEMPT_LIMITS,
} from "./rate-limits.mjs";
export function createApp(
  store,
  {
    origin = "http://localhost:3000",
    trustedProxies = [],
    attemptLimiter = createAttemptLimiter(store),
  } = {},
) {
  const address = applicationAddress(origin);
  origin = address.origin;
  const secure = address.secure;
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustedProxies);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    if (secure) res.set("Strict-Transport-Security", "max-age=31536000");
    // req.secure consults forwarding headers only for a trusted socket peer.
    // Network restrictions and the proxy's header overwrite are still required.
    if (secure && !req.secure)
      return res.set("Cache-Control", "no-store").status(403).json({
        error: "HTTPS bağlantısı doğrulanamadı. Proxy ayarlarını kontrol edin.",
      });
    if (req.headers.host !== address.authority)
      return res.status(403).json({ error: "APP_ORIGIN adresini kullanın." });
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD"].includes(req.method) &&
      (req.headers.origin !== origin ||
        req.headers["x-requested-with"] !== "KaynakPortal")
    )
      return res.status(403).json({ error: "İstek kaynağı doğrulanamadı." });
    next();
  });
  const timer = setInterval(() => {
    attemptLimiter
      .cleanup()
      .catch(() => console.error("Giriş sayacı temizliği tamamlanamadı."));
  }, 60000);
  timer.unref();
  const cleanup = setInterval(
    () =>
      store
        .cleanupSessions()
        .catch(() => console.error("Oturum temizliği tamamlanamadı.")),
    3600000,
  );
  cleanup.unref();
  app.locals.close = () => {
    clearInterval(timer);
    clearInterval(cleanup);
  };
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
  };
  // This opaque marker is not the cookie/session ID and cannot authenticate.
  const sessionIdentity = (id) => digest("aa-session-view-v1:" + id);
  const cookie = (req) => {
    const m = (req.headers.cookie || "").match(
      /(?:^|;\s*)kp_session=([a-zA-Z0-9_-]+)/,
    );
    return m?.[1];
  };
  const dummy = hashPassword(token());
  app.post(
    "/api/auth/login",
    async (req, _res, next) => {
      req.releaseIpAttempt = await attemptLimiter.reserve(
        "ip",
        clientAddressKey(req.ip),
        ATTEMPT_LIMITS.ip,
      );
      next();
    },
    express.json({ limit: "4kb" }),
    async (req, res) => {
      const body = z
        .object({
          username: z.string().trim().toLowerCase().min(3).max(100),
          password: z.string().max(256),
          remember: z.boolean().default(false),
        })
        .parse(req.body);
      const username = body.username;
      const releaseName = await attemptLimiter.reserve(
        "account",
        username,
        ATTEMPT_LIMITS.account,
      );
      const u = await store.findUser({ username });
      if (
        !(await verifyPassword(body.password, u?.password || (await dummy))) ||
        !u?.active
      )
        fail(401, "Kullanıcı adı veya şifre hatalı ya da hesap pasif.");
      await req.releaseIpAttempt();
      await releaseName();
      const raw = token(),
        csrf = token(),
        age = (body.remember ? 30 * 24 : 12) * 3600000;
      await store.createSession({
        _id: digest(raw),
        userId: u._id,
        userVersion: u.version,
        csrf,
        expiresAt: new Date(Date.now() + age),
      });
      res.cookie("kp_session", raw, {
        ...cookieOptions,
        ...(body.remember ? { maxAge: age } : {}),
      });
      const identity = sessionIdentity(digest(raw));
      res.set("X-Session-Identity", identity);
      res.json({ user: publicUser(u), csrf, sessionIdentity: identity });
    },
  );
  app.use("/api", async (req, res, next) => {
    const raw = cookie(req);
    if (!raw) fail(401, "Giriş yapın.");
    const s = await store.session(digest(raw));
    const u = s && (await store.findUser({ id: s.userId }));
    if (!u?.active || u.version !== s.userVersion)
      fail(401, "Oturum sona erdi. Yeniden giriş yapın.");
    req.user = u;
    req.session = s;
    req.sessionIdentity = sessionIdentity(s._id);
    res.set("X-Session-Identity", req.sessionIdentity);
    if (
      !["GET", "HEAD"].includes(req.method) &&
      req.headers["x-csrf-token"] !== s.csrf
    )
      fail(403, "Oturum doğrulaması başarısız.");
    next();
  });
  // Large imports/backups keep their existing allowance, after authentication.
  const normalJson = express.json({ limit: "2mb" });
  const bulkJson = express.json({ limit: "20mb" });
  app.use("/api", (req, res, next) => {
    const parser = [
      "/changes",
      "/resources/import",
      "/restore",
      "/allocations/reset",
    ].includes(req.path)
      ? bulkJson
      : normalJson;
    parser(req, res, next);
  });
  app.get("/api/auth/me", (req, res) =>
    res.json({
      user: publicUser(req.user),
      csrf: req.session.csrf,
      sessionIdentity: req.sessionIdentity,
    }),
  );
  app.post("/api/auth/logout", async (req, res) => {
    await store.deleteSession(req.session._id);
    res.clearCookie("kp_session", cookieOptions);
    res.json({ ok: true });
  });
  app.get("/api/data", async (req, res) =>
    sendDataSnapshot(req, res, await store.view(req.user)),
  );
  app.get("/api/version", async (req, res) => {
    res.json({
      generation: await store.generation(),
      sessionIdentity: req.sessionIdentity,
    });
  });
  app.post("/api/changes", async (req, res) => {
    res.json(await changeAndView(store, req.user, req.body.changes, req.body));
  });
  app.post("/api/leaders/change", async (req, res) => {
    admin(req.user);
    res.json(
      await store.mutate(
        req.user,
        (d, u, c, generation) =>
          applyLeaderChange(d, u, req.body, c, generation),
        { auditUsers: true, returnView: true },
      ),
    );
  });
  app.post("/api/allocations/reset", async (req, res) => {
    admin(req.user);
    res.json(
      await store.mutate(req.user, (d, u) => reset(d, u, req.body.revisions), {
        returnView: true,
      }),
    );
  });
  app.post("/api/resources/import", async (req, res) => {
    admin(req.user);
    const { view, result } = await store.mutate(
      req.user,
      (d, u) => importRows(d, u, req.body.rows),
      { returnView: true, returnResult: true },
    );
    res.json({ ...view, ...result });
  });
  app.get("/api/audit", async (req, res) => {
    admin(req.user);
    const page = z
      .object({
        offset: z.coerce.number().int().min(0).max(1000000).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(50),
      })
      .parse(req.query);
    res.json(await store.auditLog(req.user, page));
  });
  app.get("/api/backup", async (req, res) => {
    admin(req.user);
    const { data } = await store.view(req.user);
    delete data.users;
    data.revisions = Object.fromEntries(
      Object.entries(data.revisions).filter(([k]) => !k.startsWith("user:")),
    );
    res.json({
      format: "aa-planning-data-v1",
      createdAt: new Date().toISOString(),
      data,
    });
  });
  app.post("/api/restore", async (req, res) => {
    admin(req.user);
    res.json(
      await store.mutate(
        req.user,
        (d, u, _s, generation) => {
          if (req.body.generation !== generation)
            fail(409, "Veriler değişti. Yenileyip yedeği tekrar yükleyin.");
          return restore(d, u, req.body.data);
        },
        { returnView: true },
      ),
    );
  });
  const permissionInput = z
    .object({
      id: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/),
      role: z.enum(["admin", "manager", "normal"]),
      leaders: z.array(z.string()).max(100),
      resourceId: z.string().max(120).default(""),
      revision: z.number().int().nonnegative(),
    })
    .strict();
  app.post("/api/users", async (req, res) => {
    admin(req.user);
    await attemptLimiter.reserve(
      "user-edit",
      req.user._id,
      ATTEMPT_LIMITS.userEdit,
    );
    const input = permissionInput.parse(req.body);
    if (input.id === ROOT_ADMIN_ID)
      fail(403, "Ana yönetici yetkileri değiştirilemez.");
    const view = await store.mutate(
      req.user,
      async (d, u, session) => {
        admin(u);
        const old = await store.findUser({ id: input.id }, session);
        if (!old)
          fail(
            404,
            "Kullanıcı bulunamadı. Hesaplar kimlik dizininden sağlanır.",
          );
        if (old.revision !== input.revision)
          fail(
            409,
            "Yetkiler başka kullanıcı tarafından değiştirildi. Yenileyin.",
          );
        if (input.leaders.some((leader) => !d.leaders.includes(leader)))
          fail(400, "Geçersiz liderlik seçimi.");
        const resourceId = input.role === "normal" ? input.resourceId : "";
        if (
          resourceId &&
          !d.resources.some((resource) => resource.id === resourceId)
        )
          fail(400, "Çalışan kaydı bulunamadı.");
        if (resourceId) {
          const linked = (
            await session.query(
              "SELECT id FROM kp_users WHERE resource_id=@p0 AND id<>@p1",
              [resourceId, input.id],
            )
          ).rows;
          if (linked.length)
            fail(409, "Bu çalışan kaydı başka bir kullanıcıya bağlı.");
        }
        await store.saveUser(
          {
            ...old,
            role: input.role,
            leaders: input.role === "admin" ? [] : input.leaders,
            resourceId,
            revision: old.revision + 1,
            version: old.version + 1,
          },
          session,
        );
        await store.revokeUser(input.id, session);
      },
      { auditUsers: true, returnView: input.id !== req.user._id },
    );
    // Editing your own permissions invalidates your session. Commit the change
    // first, then return the existing reauthentication response without a snapshot.
    if (input.id === req.user._id) fail(401, "Oturum yenilenmeli.");
    res.json(view);
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API bulunamadı." }),
  );
  const site = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../site",
  );
  app.use(
    express.static(site, {
      index: "index.html",
      dotfiles: "deny",
      setHeaders: (res, p) =>
        res.setHeader(
          "Cache-Control",
          p.endsWith(".html")
            ? "no-cache"
            : "public, max-age=31536000, immutable",
        ),
    }),
  );
  app.use((err, req, res, _next) => {
    const status =
      err.status ||
      (err instanceof z.ZodError
        ? 400
        : [2601, 2627, 547, 2628, 8152, 515].includes(err.number) ||
            err.code?.startsWith("SQLITE_CONSTRAINT") ||
            err.message?.includes("constraint failed")
          ? 409
          : 500);
    if (status === 500)
      console.error("Request failed", req.method, req.path, err.name);
    if (err.retryAfter) res.set("Retry-After", String(err.retryAfter));
    res.status(status).json({
      error:
        err instanceof z.ZodError
          ? "Veri biçimi geçersiz: " + err.issues[0]?.path.join(".")
          : [2601, 2627, 547, 2628, 8152, 515].includes(err.number) ||
              err.code?.startsWith("SQLITE_CONSTRAINT") ||
              err.message?.includes("constraint failed")
            ? "Kayıt benzersizlik, ilişki veya değer kuralına uymuyor. Bağlı kayıtları kontrol edin."
            : status === 500
              ? "İşlem tamamlanamadı. Sunucu bağlantısını ve günlüklerini kontrol edin."
              : err.message,
    });
  });
  return app;
}
