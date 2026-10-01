import fs from "node:fs/promises";
import { validate } from "../shared/server-domain.ts";
for (const name of await fs.readdir(new URL("../shared/", import.meta.url))) {
  if (!name.endsWith(".ts")) continue;
  const source = await fs.readFile(
    new URL("../shared/" + name, import.meta.url),
    "utf8",
  );
  if (/from\s+['"][^'"]*(?:frontend|backend|react)[^'"]*['"]/.test(source))
    throw Error("Shared domain depends on an application layer: " + name);
}
if (typeof validate !== "function")
  throw Error("Domain validation unavailable");
console.log(
  "Shared domain loaded directly; application-layer dependency check passed.",
);
