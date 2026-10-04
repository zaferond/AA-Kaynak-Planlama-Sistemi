import assert from "node:assert/strict";
import { fixture } from "./browser-checks/fixture.mjs";
import { checkRisks } from "./browser-checks/risk.mjs";
import { checkCalendar } from "./browser-checks/calendar.mjs";
import { checkCalendarDrafts } from "./browser-checks/calendar-drafts.mjs";
import { checkActualAllocation } from "./browser-checks/actual-allocation.mjs";
import { checkPlannedAllocation } from "./browser-checks/planned-allocation.mjs";
import { checkWorkspaceFilters } from "./browser-checks/workspace-filters.mjs";
import { checkWorkspaceActions } from "./browser-checks/workspace-actions.mjs";
import { checkAccess } from "./browser-checks/access.mjs";
import { checkImportRestore } from "./browser-checks/import-restore.mjs";
import { checkProjectTables } from "./browser-checks/project-tables.mjs";
import { checkRiskConcurrency } from "./browser-checks/risk-concurrency.mjs";
import { checkTimelineLayers } from "./browser-checks/timeline-layers.mjs";
import { checkSessionConsistency } from "./browser-checks/session-consistency.mjs";
import { checkEntityEditors } from "./browser-checks/entity-editors.mjs";
import { checkTableStyles } from "./browser-checks/table-styles.mjs";

const f = await fixture();
try {
  await checkTableStyles(f);
  await checkSessionConsistency(f);
  await checkEntityEditors(f);
  await checkRisks(f);
  await checkRiskConcurrency(f);
  await checkWorkspaceFilters(f);
  await checkWorkspaceActions(f);
  await checkPlannedAllocation(f);
  await checkActualAllocation(f);
  await checkCalendarDrafts(f);
  await checkCalendar(f);
  await checkImportRestore(f);
  await checkAccess(f);
  await checkProjectTables(f);
  await checkTimelineLayers(f);
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
