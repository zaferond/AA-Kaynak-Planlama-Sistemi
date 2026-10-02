import assert from "node:assert/strict";
import { fixture } from "./browser-checks/fixture.mjs";
import { checkRisks } from "./browser-checks/risk.mjs";
import { checkCalendar } from "./browser-checks/calendar.mjs";
import { checkAccess } from "./browser-checks/access.mjs";
import { checkImportRestore } from "./browser-checks/import-restore.mjs";

const f = await fixture();
try {
  await checkRisks(f);
  await checkCalendar(f);
  await checkImportRestore(f);
  await checkAccess(f);
  assert.deepEqual(f.errors, []);
  await f.report("passed");
  console.log(
    JSON.stringify({
      status: "passed",
      checks: f.checks.length,
      artifacts: f.dir,
    }),
  );
} catch (error) {
  await f.report("failed", error);
  console.error("Browser checks failed; artifacts:", f.dir);
  throw error;
} finally {
  await f.close();
}
