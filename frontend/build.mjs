import { build } from "vite";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url)),
  site = path.resolve(root, "../site");
await fs.mkdir(path.join(site, "assets"), { recursive: true });
await fs.copyFile(
  path.join(root, "assets/otokar-logo.svg"),
  path.join(site, "assets/otokar-logo.svg"),
);
await build({
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  esbuild: { jsx: "automatic" },
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    outDir: path.join(root, ".compiled"),
    minify: true,
    lib: {
      entry: path.join(root, "src/main.tsx"),
      name: "KaynakPortal",
      formats: ["iife"],
      fileName: () => "app.js",
    },
  },
});
const hash = (b) =>
  crypto.createHash("sha256").update(b).digest("hex").slice(0, 12);
async function asset(label, ext, bytes) {
  const name = label + "." + hash(bytes) + "." + ext;
  await fs.writeFile(path.join(site, "assets", name), bytes);
  if (ext !== "png")
    await fs.writeFile(
      path.join(site, "assets", name + ".gz"),
      gzipSync(bytes),
    );
  return name;
}
const jsName = await asset(
  "app",
  "js",
  await fs.readFile(path.join(root, ".compiled/app.js")),
);
const bundledCss = (await fs.readdir(path.join(root, ".compiled")))
  .filter((file) => file.endsWith(".css"))
  .sort();
const css = [
  ...(await Promise.all(
    ["assets/base.css", "src/upgrade.css", "src/login.css"].map((file) =>
      fs.readFile(path.join(root, file), "utf8"),
    ),
  )),
  ...(await Promise.all(
    bundledCss.map((file) =>
      fs.readFile(path.join(root, ".compiled", file), "utf8"),
    ),
  )),
].join("\n");
const cssName = await asset("app", "css", Buffer.from(css));

const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Askeri Araçlar Kaynak Yönetimi Sistemi</title><link rel="stylesheet" href="/assets/${cssName}"><script defer src="/assets/${jsName}"></script></head><body><div id="root"></div><noscript>JavaScript etkin olmalıdır.</noscript></body></html>`;
await fs.writeFile(path.join(site, "index.html"), html);
await fs.writeFile(path.join(site, "index.html.gz"), gzipSync(html));
console.log("Local web site built:", site);
