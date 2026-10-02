import fs from "node:fs/promises";
import { parseArgs, parseEnv } from "node:util";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mssqlTestEnvironment } from "./mssql-test-environment.mjs";

const { values } = parseArgs({
  options: {
    "env-file": { type: "string" },
    report: { type: "string" },
    size: { type: "string", default: "1000" },
    samples: { type: "string", default: "3" },
  },
});
try {
  const input = values["env-file"]
    ? parseEnv(await fs.readFile(values["env-file"], "utf8"))
    : process.env;
  const env = mssqlTestEnvironment(input);
  const size = Number(values.size),
    samples = Number(values.samples);
  if (
    !Number.isInteger(size) ||
    size < 24 ||
    size > 100000 ||
    !Number.isInteger(samples) ||
    samples < 1 ||
    samples > 10
  )
    throw Error("size 24–100000, samples 1–10 arasında tam sayı olmalı.");
  const childEnv = { ...process.env };
  for (const key of Object.keys(childEnv))
    if (key.startsWith("DB_") || key.startsWith("TEST_DB_"))
      delete childEnv[key];
  for (const [key, value] of Object.entries(env))
    if (
      key.startsWith("DB_") &&
      !["DB_PROVIDER", "DB_AUTO_MIGRATE"].includes(key)
    )
      childEnv["TEST_" + key] = value;
  childEnv.NODE_ENV = "test";
  childEnv.TEST_DB_LOAD_SIZE = String(size);
  childEnv.TEST_DB_LOAD_SAMPLES = String(samples);
  if (values.report) childEnv.TEST_DB_REPORT = values.report;
  const child = spawn(
    process.execPath,
    [
      "--test",
      fileURLToPath(new URL("../tests/mssql.integration.mjs", import.meta.url)),
    ],
    { env: childEnv, stdio: "inherit" },
  );
  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  process.exitCode = result.signal ? 1 : result.code;
} catch (e) {
  // Configuration errors never print credentials or the connection object.
  console.error(e.message);
  process.exitCode = 1;
}
