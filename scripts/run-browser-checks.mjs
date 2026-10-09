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
import { checkMilestoneOverlap } from "./browser-checks/milestone-overlap.mjs";
import { checkSessionConsistency } from "./browser-checks/session-consistency.mjs";
import { checkEntityEditors } from "./browser-checks/entity-editors.mjs";
import { checkTableStyles } from "./browser-checks/table-styles.mjs";
import { checkDirectoryManagement } from "./browser-checks/directory-management.mjs";
import { checkMilestoneReportMenu } from "./browser-checks/milestone-report-menu.mjs";
import { checkTimelineConcurrency } from "./browser-checks/timeline-concurrency.mjs";
import { checkHeadcountForecast } from "./browser-checks/headcount-forecast.mjs";
import { checkRiskSaveConfirmation } from "./browser-checks/risk-save-confirmation.mjs";
import { checkExcelXmlCharacters } from "./browser-checks/excel-xml-characters.mjs";
import { checkRiskSystems } from "./browser-checks/risk-systems.mjs";
import { checkResourceReports } from "./browser-checks/resource-reports.mjs";
import { checkViewportScroll } from "./browser-checks/viewport-scroll.mjs";
import { checkTransportRecovery } from "./browser-checks/transport-recovery.mjs";
import { checkMilestoneParentDates } from "./browser-checks/milestone-parent-dates.mjs";
import { checkWorkspaceNavigation } from "./browser-checks/workspace-navigation.mjs";

const f = await fixture();
try {
  await checkTransportRecovery(f);
  await checkMilestoneParentDates(f);
  await checkTableStyles(f);
  await checkSessionConsistency(f);
  await checkWorkspaceNavigation(f);
  await checkEntityEditors(f);
  await checkDirectoryManagement(f);
  await checkRiskSystems(f);
  await checkHeadcountForecast(f);
  await checkMilestoneReportMenu(f);
  await checkTimelineConcurrency(f);
  await checkRiskSaveConfirmation(f);
  await checkExcelXmlCharacters(f);
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
  await checkMilestoneOverlap(f);
  await checkTimelineLayers(f);
  await checkResourceReports(f);
  await checkViewportScroll(f);
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
