import { createWorkspaceDataActions } from "./features/workspace/workspace-data-actions";
import { createProjectActions } from "./features/workspace/project-actions";
import { createWorkspaceExports } from "./features/workspace/workspace-exports";
import {
  readWorkspaceOptions,
  planWorkspacePath,
} from "./features/workspace/workspace-options";
import { useWorkspaceFilters } from "./features/workspace/useWorkspaceFilters";
import { useWorkspaceView } from "./features/workspace/useWorkspaceView";
import { useSynchronizedTableScroll } from "./features/workspace/useSynchronizedTableScroll";
import { usePortalData } from "./features/usePortalData";
import { usePortalRefresh } from "./features/usePortalRefresh";
import { usePortalEditor } from "./features/usePortalEditor";
import WorkspaceHeader, { FullPlanHeader } from "./features/WorkspaceHeader";
import WorkspaceNavigation from "./features/WorkspaceNavigation";
import WorkspaceFilters from "./features/WorkspaceFilters";
import PlannedAllocationPanel from "./features/PlannedAllocationPanel";
import { useProjectMenus } from "./features/useProjectMenus";
import ProjectContextMenus from "./features/ProjectContextMenus";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ClipboardPaste, Copy, Info } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import AbsenceReport from "./AbsenceReport";
import AccessPanel from "./AccessPanel";
import PortalEditorDialog from "./features/PortalEditorDialog";
import RemainingResourceTable, {
  type ReportGroup,
} from "./features/RemainingResourceTable";
import { usePlannedGrid } from "./features/usePlannedGrid";
import { fmt, monthLabel } from "./format";
import HeadcountTrend from "./HeadcountTrend";
import { Project, phaseStyle } from "./model";
import MonthlyShortageTrend from "./MonthlyShortageTrend";
import {
  allowedDefaultTabs,
  defaultTabKey,
  readDefaultTab,
} from "./navigation";
import PersonAllocationPanel from "./PersonAllocationPanel";
import ProjectInfoReport from "./ProjectInfoReport";
import ProjectResponsible from "./ProjectResponsible";
import ProjectTimelinePanel from "./features/ProjectTimelinePanel";
import ResourcesPanel from "./features/ResourcesPanel";
import RiskManagement from "./RiskManagement";
import type { RiskLeaveGuard } from "./RiskTable";
import { DEFAULT_FILTERS, TAB_LABELS } from "./settings";
import { captureSessionGuard, currentUser, logout, readLocal } from "./storage";
import TeamDirectory from "./TeamDirectory";
("use client");
const openingOptions = readWorkspaceOptions(
  window.location.search,
  DEFAULT_FILTERS,
);
const fullPlan = openingOptions.fullPlan;
export default function Portal() {
  const assertSessionRef = useRef(captureSessionGuard());
  const riskLeaveGuard = useRef<RiskLeaveGuard | null>(null);
  const riskEditingRef = useRef(false);
  const [riskEditing, setRiskEditing] = useState(false);
  const [directoryEditing, setDirectoryEditing] = useState(false);
  const onRiskEditingChange = useCallback((editing: boolean) => {
    riskEditingRef.current = editing;
    setRiskEditing(editing);
  }, []);
  const tabRequest = useRef(0);
  const mainTabsRef = useRef<HTMLDivElement>(null),
    capacityTableRef = useRef<HTMLTableElement>(null),
    planTableRef = useRef<HTMLTableElement>(null);
  const [phaseDetail, setPhaseDetail] = useState<{
    project: Project;
    month: string;
  } | null>(null);
  const projectLabelWidth = 180;
  const planningLabelWidth = 220;
  const [browserFullScreen, setBrowserFullScreen] = useState(
    !!document.fullscreenElement,
  );
  const [showImport, setShowImport] = useState(false);
  const {
    data,
    setData,
    user,
    setUser,
    error,
    setError,
    notice,
    setNotice,
    saving,
    setSaving,
    reload,
    save,
    batch,
    change,
  } = usePortalData(assertSessionRef);
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const readOnlyAllLeaders = !isAdmin && !(isManager && !!user?.leaders.length);
  const [defaultTab, setDefaultTab] = useState(() =>
      readDefaultTab(currentUser()),
    ),
    [tab, setTab] = useState(() =>
      fullPlan ? "plan" : readDefaultTab(currentUser()),
    );
  const leaderReportTableRef = useRef<HTMLTableElement>(null);
  const teamReportTableRef = useRef<HTMLTableElement>(null);
  const {
    leads,
    setLeads,
    teamIds,
    setTeamIds,
    projectIds,
    setProjectIds,
    start,
    setStart,
    count,
    setCount,
    search,
    setSearch,
    view,
    setView,
    density,
    setDensity,
    cells,
    setCells,
    cellSet,
    resourceIds,
    setResourceIds,
    personIds,
    setPersonIds,
    planPage,
    setPlanPage,
    projectPage,
    setProjectPage,
    resourcePage,
    setResourcePage,
    showAllActual,
    setShowAllActual,
    expandedActualTeams,
    setExpandedActualTeams,
    showCapacity,
    setShowCapacity,
    showProjectDetails,
    setShowProjectDetails,
    projectWeekly,
    setProjectWeekly,
    filterResetKey,
    resetFilters,
    todayDate,
    currentMonth,
    months,
  } = useWorkspaceFilters(openingOptions, tab, setNotice);
  const monthWidth =
    density === "overview" ? 24 : density === "compact" ? 68 : 150;
  const planMonthWidth =
    density === "overview" ? 23 : density === "compact" ? 65 : 144;
  const labelWidth = density === "overview" ? 210 : 240;
  const {
    editor,
    setEditor,
    formError,
    setFormError,
    openProject,
    deleteProject,
    openMilestone,
    deleteMilestone,
    deleteEditedMilestone,
    openResource,
    chooseResourceStatus,
    openBulk,
    submit,
  } = usePortalEditor({
    data,
    isAdmin: !!isAdmin,
    saving,
    start,
    count,
    leads,
    resourceIds,
    batch,
    setError,
    setNotice,
    onProjectDeleted: (id) => {
      setProjectIds((ids) => ids.filter((item) => item !== id));
      setCells((keys) => keys.filter((key) => key.split("|")[1] !== id));
    },
    onSubmitted: () => setResourceIds([]),
  });
  function load() {
    return reload(() => setEditor(null));
  }
  usePortalRefresh({
    load,
    editing: !!editor || directoryEditing,
    saving,
    riskEditing,
    riskEditingRef,
  });
  useEffect(() => {
    setPlanMenu(null);
  }, [leads, teamIds, projectIds, start, count, search, view]);
  useEffect(() => {
    if (!allowedDefaultTabs(user).includes(tab))
      setTab(allowedDefaultTabs(user)[0]);
    if (!isAdmin) setEditor(null);
  }, [isAdmin, user?.role, tab]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const list = mainTabsRef.current;
      const active = list?.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"]',
      );
      if (!list || !active) return;
      const listBox = list.getBoundingClientRect(),
        tabBox = active.getBoundingClientRect();
      if (tabBox.left < listBox.left)
        list.scrollLeft -= listBox.left - tabBox.left + 6;
      else if (tabBox.right > listBox.right)
        list.scrollLeft += tabBox.right - listBox.right + 6;
    });
    return () => cancelAnimationFrame(frame);
  }, [tab]);
  useEffect(() => {
    setDefaultTab(readDefaultTab(user));
  }, [user?.id, user?.role]);
  useEffect(() => {
    if (!fullPlan) return;
    const sync = () => setBrowserFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (fullPlan) history.replaceState(null, "", planWorkspaceUrl());
  }, [view, start, count, density, leads, teamIds, projectIds]);
  function setOpeningTab(nextTab: string) {
    if (!user || !allowedDefaultTabs(user).includes(nextTab)) return;
    try {
      localStorage.setItem(defaultTabKey(user.id), nextTab);
      setDefaultTab(nextTab);
      setNotice(
        "Varsayılan Sekme ayarlandı: " +
          TAB_LABELS[nextTab as keyof typeof TAB_LABELS] +
          ". Sonraki açılışta bu sekme gösterilir.",
      );
    } catch {
      setError("Varsayılan Sekme bu tarayıcıda kaydedilemedi.");
    }
  }
  useSynchronizedTableScroll({
    enabled: !!data && tab === "plan" && view === "project" && showCapacity,
    primaryRef: planTableRef,
    secondaryRef: capacityTableRef,
    layoutKey: months.join("|") + ":" + planMonthWidth,
  });
  useSynchronizedTableScroll({
    enabled: !!data && tab === "overview",
    primaryRef: leaderReportTableRef,
    secondaryRef: teamReportTableRef,
    layoutKey: months.join("|") + ":" + monthWidth,
  });
  const {
    leaderItems,
    availableTeams,
    teams,
    projects,
    ids,
    leaderReportGroups,
    teamReportGroups,
    availablePeople,
    capacityFilters,
    currentTeamMembers,
    cache,
    projectTotals,
    actualTotals,
    metric,
    planPageSize,
    effectivePlanPage,
    planGroups,
    effectiveProjectPage,
    visiblePlanRows,
  } = useWorkspaceView(data, user, {
    leads,
    teamIds,
    projectIds,
    start,
    count,
    view,
    density,
    months,
    currentMonth,
    planPage,
    projectPage,
  });
  const plannedGrid = usePlannedGrid({
    visiblePlanRows,
    months,
    cells,
    setCells,
    planTableRef,
    data,
    saving,
    user,
    active: tab === "plan" && !editor && !phaseDetail,
    batch,
    setNotice,
    setError,
  });
  const {
    planMenu,
    setPlanMenu,
    planMenuRef,
    copiedPlan,
    planCellWritable,
    copyPlanSelection,
    pastePlanSelection,
  } = plannedGrid;
  const projectMenus = useProjectMenus({
    data,
    months,
    visibleProjects: projects.slice(
      effectiveProjectPage * 20,
      (effectiveProjectPage + 1) * 20,
    ),
    active: tab === "projects" && !editor && !phaseDetail,
    selectionKey: JSON.stringify([
      effectiveProjectPage,
      leads,
      teamIds,
      projectIds,
      start,
      count,
      search,
      projectWeekly,
    ]),
    isAdmin: !!isAdmin,
    saving,
    batch,
    setNotice,
    setError,
  });
  const { openPhaseMenu, openMilestoneMenu } = projectMenus;
  const { resetAll, deleteResources, downloadBackup, restoreBackupFile } =
    createWorkspaceDataActions({
      data,
      saving,
      setSaving,
      setData,
      setError,
      setNotice,
      batch,
      change,
      isAdmin: !!isAdmin,
      setCells,
      setResourceIds,
      flushRiskDraft,
      assertSession: () => assertSessionRef.current(),
      load,
    });
  const {
    reorderProject,
    reorderMilestone,
    changeMilestoneRange,
    changeMilestoneNote,
  } = createProjectActions({
    data,
    saving,
    batch,
    setNotice,
    setError,
    isAdmin: !!isAdmin,
  });
  const { exportCurrentTab } = createWorkspaceExports({
    data,
    user,
    tab,
    teams,
    projects,
    months,
    density,
    projectWeekly,
    currentMonth,
    start,
    personIds,
    leads,
    teamIds,
    leaderReportGroups,
    teamReportGroups,
    metric,
    setError,
  });
  function phaseText(p: Project, m: string) {
    return m < p.start || m > p.end
      ? "Proje dönemi dışında"
      : p.phases[m] || "Çalışma bilgisi girilmemiş";
  }
  function reportRows(groups: ReportGroup[], teamReport = false) {
    return (
      <RemainingResourceTable
        groups={groups}
        teamReport={teamReport}
        data={data}
        teams={teams}
        months={months}
        monthWidth={monthWidth}
        todayDate={todayDate}
        currentMonth={currentMonth}
        currentTeamMembers={currentTeamMembers}
        metric={metric}
        tableRef={teamReport ? teamReportTableRef : leaderReportTableRef}
      />
    );
  }
  function planWorkspaceUrl() {
    return planWorkspacePath(window.location.href, {
      view,
      start,
      count,
      density,
      leads,
      teamIds,
      projectIds,
    });
  }
  async function toggleBrowserFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice(
        "Tarayıcı ekranı kaplamaya izin vermedi; geniş sekme görünümü açık kalır.",
      );
    }
  }
  async function flushRiskDraft() {
    return (
      tab !== "risk" ||
      !riskLeaveGuard.current ||
      (await riskLeaveGuard.current())
    );
  }
  async function changeTab(nextTab: string) {
    const request = ++tabRequest.current;
    if (!(await flushRiskDraft()) || request !== tabRequest.current) return;
    setTab(nextTab);
  }
  async function signOut() {
    if (!(await flushRiskDraft())) return;
    try {
      assertSessionRef.current();
      await logout();
      location.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const editTeams =
    data?.teams.filter(
      (t) =>
        t.catalog ||
        (editor?.kind === "resource" && t.id === editor.version.team),
    ) || [];
  return (
    <div
      className={
        "app dense-" + density + " tab-" + tab + (fullPlan ? " full-plan" : "")
      }
      style={
        {
          "--month-width":
            (tab === "plan" ? planMonthWidth : monthWidth) + "px",
          "--label-width":
            (tab === "projects"
              ? projectLabelWidth
              : tab === "plan"
                ? planningLabelWidth
                : tab === "actual"
                  ? 200
                  : labelWidth) + "px",
        } as React.CSSProperties
      }
    >
      <WorkspaceHeader
        user={user}
        defaultTab={defaultTab}
        setOpeningTab={setOpeningTab}
        onExportBackup={downloadBackup}
        onRestoreBackup={restoreBackupFile}
        onLogout={signOut}
      />
      <main>
        {fullPlan && (
          <FullPlanHeader
            browserFullScreen={browserFullScreen}
            toggleBrowserFullscreen={toggleBrowserFullscreen}
          />
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
            <button onClick={() => setError("")}>Kapat</button>
          </div>
        )}
        <Tabs value={tab} onValueChange={changeTab}>
          <WorkspaceNavigation
            user={user}
            tab={tab}
            mainTabsRef={mainTabsRef}
            density={density}
            setDensity={setDensity}
            setCount={setCount}
            view={view}
            setView={setView}
            openProject={() => openProject()}
            onExport={exportCurrentTab}
            dataLoaded={!!data}
            hasTeams={!!teams.length}
            hasProjects={!!projects.length}
          />
          {!data ? (
            <div className="loading">
              Kaynak planınız açılıyor…{" "}
              <button onClick={load}>Tekrar Dene</button>
            </div>
          ) : (
            <>
              <WorkspaceFilters
                data={data}
                user={user}
                tab={tab}
                leads={leads}
                setLeads={setLeads}
                teamIds={teamIds}
                setTeamIds={setTeamIds}
                projectIds={projectIds}
                setProjectIds={setProjectIds}
                personIds={personIds}
                setPersonIds={setPersonIds}
                leaderItems={leaderItems}
                availableTeams={availableTeams}
                availablePeople={availablePeople}
                start={start}
                setStart={setStart}
                count={count}
                setCount={setCount}
                density={density}
                setDensity={setDensity}
                filterResetKey={filterResetKey}
                resetFilters={resetFilters}
                saving={saving}
                resetAll={resetAll}
                showAllActual={showAllActual}
                setShowAllActual={setShowAllActual}
                setExpandedActualTeams={setExpandedActualTeams}
                showProjectDetails={showProjectDetails}
                setShowProjectDetails={setShowProjectDetails}
                projectWeekly={projectWeekly}
                setProjectWeekly={setProjectWeekly}
                notice={notice}
              />
              {(isAdmin || isManager) && tab === "plan" && (
                <TabsContent value="plan">
                  <PlannedAllocationPanel
                    data={data}
                    teams={teams}
                    projects={projects}
                    months={months}
                    view={view}
                    density={density}
                    todayDate={todayDate}
                    currentMonth={currentMonth}
                    labelWidth={planningLabelWidth}
                    monthWidth={planMonthWidth}
                    page={effectivePlanPage}
                    pageSize={planPageSize}
                    groups={planGroups}
                    onPageChange={setPlanPage}
                    showCapacity={showCapacity}
                    onCapacityChange={setShowCapacity}
                    capacityFilters={capacityFilters}
                    metric={metric}
                    projectIds={projectIds}
                    projectTotals={projectTotals}
                    actualTotals={actualTotals}
                    showAllActual={showAllActual}
                    expandedActualTeams={expandedActualTeams}
                    onExpandedTeamsChange={setExpandedActualTeams}
                    currentTeamMembers={currentTeamMembers}
                    cells={cells}
                    grid={plannedGrid}
                    planTableRef={planTableRef}
                    capacityTableRef={capacityTableRef}
                    onSaveAllocation={(id, value) =>
                      save("allocation", id, value)
                    }
                    onPhaseClick={(project, month) =>
                      isAdmin
                        ? openProject(project, month)
                        : setPhaseDetail({ project, month })
                    }
                    onPhaseContextMenu={openPhaseMenu}
                  />
                </TabsContent>
              )}
              {tab === "projects" && (
                <TabsContent value="projects">
                  <ProjectTimelinePanel
                    selection={projectMenus.phaseGrid}
                    projects={projects}
                    months={months}
                    weekly={projectWeekly}
                    todayDate={todayDate}
                    labelWidth={projectLabelWidth}
                    monthWidth={monthWidth}
                    density={density}
                    expandAllDetails={showProjectDetails}
                    isAdmin={!!isAdmin}
                    saving={saving}
                    page={effectiveProjectPage}
                    onPageChange={setProjectPage}
                    actions={{
                      onReorderProject: reorderProject,
                      onProjectInfo: openProject,
                      onPhaseClick: (project, month) =>
                        isAdmin
                          ? openProject(project, month)
                          : setPhaseDetail({ project, month }),
                      onPhaseContextMenu: openPhaseMenu,
                      onAddMilestone: openMilestone,
                      onEditMilestone: openMilestone,
                      onDeleteMilestone: deleteMilestone,
                      onReorderMilestone: reorderMilestone,
                      onMilestoneContextMenu: openMilestoneMenu,
                      onChangeMilestoneRange: changeMilestoneRange,
                      onChangeMilestoneNote: changeMilestoneNote,
                    }}
                  />
                </TabsContent>
              )}
              {tab === "risk" && (
                <TabsContent value="risk">
                  <RiskManagement
                    leaveGuardRef={riskLeaveGuard}
                    data={data}
                    user={user!}
                    onEditingChange={onRiskEditingChange}
                    onReload={async () => {
                      const latest = await readLocal();
                      setData(latest);
                      setUser(currentUser());
                      return latest;
                    }}
                    onSave={(risk, revision) =>
                      batch([
                        { kind: "risk", id: risk.id, value: risk, revision },
                      ])
                    }
                    onDelete={async (risk, revision) => {
                      await batch([
                        {
                          kind: "risk",
                          id: risk.id,
                          value: null,
                          revision,
                          operation: "delete",
                        },
                      ]);
                    }}
                  />
                </TabsContent>
              )}
              {isAdmin && tab === "teams" && (
                <TabsContent value="teams">
                  <TeamDirectory
                    data={data}
                    canEdit={!!isAdmin}
                    onEditingChange={setDirectoryEditing}
                    onSaved={(next, message) => {
                      setData(next);
                      setLeads((old) =>
                        old.filter((lead) => next.leaders?.includes(lead)),
                      );
                      setTeamIds((old) =>
                        old.filter((id) =>
                          next.teams.some((team) => team.id === id),
                        ),
                      );
                      setNotice(message);
                    }}
                  />
                </TabsContent>
              )}
              {tab === "actual" && (
                <TabsContent value="actual">
                  {isAdmin ||
                  (isManager && !!user?.leaders.length) ||
                  user?.resourceId ? (
                    <PersonAllocationPanel
                      data={data}
                      teams={teams}
                      projects={projects}
                      months={months}
                      currentMonth={currentMonth}
                      todayDate={todayDate}
                      selectedPersonIds={
                        isAdmin || isManager
                          ? personIds
                          : [user?.resourceId || ""]
                      }
                      canEditCalendar={!!isAdmin}
                      ownResourceId={
                        user?.role === "normal" ? user.resourceId : undefined
                      }
                      onSaved={(next) => {
                        setData(next);
                        setNotice("Gerçekleşen kişi dağılımı kaydedildi.");
                      }}
                    />
                  ) : (
                    <section className="panel access-unlinked">
                      <h2>
                        {isManager
                          ? "Liderlik Yetkisi Atanmadı"
                          : "Çalışan Kaydı Eşleştirilmedi"}
                      </h2>
                      <p>
                        {isManager
                          ? "Gerçekleşen kaynak dağılımı girebilmek için yetkili olduğunuz liderliklerin atanması gerekir."
                          : "Gerçekleşen kaynak dağılımı girebilmek için yöneticinizden kullanıcı hesabınızı çalışan kaydınızla eşleştirmesini isteyin."}
                      </p>
                    </section>
                  )}
                </TabsContent>
              )}
              {isAdmin && tab === "resources" && (
                <TabsContent value="resources">
                  <ResourcesPanel
                    data={data}
                    start={start}
                    ids={ids}
                    teamIds={teamIds}
                    leads={leads}
                    search={search}
                    onSearchChange={setSearch}
                    page={resourcePage}
                    onPageChange={setResourcePage}
                    resourceIds={resourceIds}
                    onSelectionChange={setResourceIds}
                    showImport={showImport}
                    onImportVisibilityChange={setShowImport}
                    saving={saving}
                    onEdit={openResource}
                    onBulkEdit={openBulk}
                    onDelete={deleteResources}
                    onImported={(d, message) => {
                      setData(d);
                      setNotice(message);
                      setError("");
                      setResourceIds([]);
                    }}
                  />
                </TabsContent>
              )}
              {(isAdmin || isManager) && tab === "critical" && (
                <TabsContent value="critical">
                  <ProjectInfoReport
                    projects={data.projects}
                    canEdit={!!isAdmin}
                    onSave={(project) => save("project", project.id, project)}
                    onAddInfo={(project) => openMilestone(project)}
                    onEditInfo={(project, infoId) => {
                      const milestone = project.milestones?.find(
                        (item) => item.id === infoId,
                      );
                      if (milestone) openMilestone(project, milestone);
                    }}
                  />
                </TabsContent>
              )}
              {(isAdmin || isManager) && tab === "overview" && (
                <TabsContent value="overview">
                  <section className="panel">
                    <div className="panelhead">
                      <div>
                        <h2>Liderlik Bazında Kalan Kaynak</h2>
                      </div>
                    </div>
                    {reportRows(leaderReportGroups)}
                  </section>
                  <section className="panel report">
                    <div className="panelhead">
                      <div>
                        <h2>Takım Bazında Kalan Kaynak</h2>
                      </div>
                    </div>
                    {reportRows(teamReportGroups, true)}
                  </section>
                  <MonthlyShortageTrend
                    capacity={cache}
                    teamIds={ids}
                    months={months}
                    filterLabel={
                      "Liderlik: " +
                      (leads.length === 1
                        ? leads[0]
                        : leads.length
                          ? leads.length + " seçili"
                          : "Tümü") +
                      " · Takım: " +
                      (teamIds.length === 1
                        ? teams[0]?.name || "Seçili takım"
                        : teamIds.length
                          ? teamIds.length + " seçili"
                          : "Tümü")
                    }
                  />
                  <HeadcountTrend
                    data={data}
                    teamIds={ids}
                    leads={leads}
                    months={months}
                  />
                  <AbsenceReport data={data} teamIds={ids} months={months} />
                </TabsContent>
              )}
              {isAdmin && tab === "access" && (
                <TabsContent value="access">
                  <AccessPanel
                    data={data}
                    onSaved={(d) => {
                      setData(d);
                      setUser(currentUser());
                    }}
                  />
                </TabsContent>
              )}
              <div className="bottomnote">
                <Info size={15} />
                Veriler sunucuya kaydedilir. Düzenli yedek alın; JSON veri
                yedeği şifreli değildir.
                <span>Veritabanı · Değişiklikler sunucuya kaydedilir</span>
              </div>
            </>
          )}
        </Tabs>
      </main>
      <ProjectContextMenus
        menus={projectMenus}
        data={data}
        isAdmin={!!isAdmin}
        saving={saving}
      />
      <>
        {planMenu && (
          <>
            <div
              className="phase-menu-backdrop"
              aria-hidden="true"
              onClick={() => setPlanMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setPlanMenu(null);
              }}
            />
            <div
              className="phase-menu plan-cell-menu"
              role="menu"
              aria-label="Kaynak dağılımı hücre işlemleri"
              tabIndex={-1}
              ref={planMenuRef}
              style={{ left: planMenu.x, top: planMenu.y }}
            >
              <div className="phase-menu-title">
                {monthLabel(planMenu.key.split("|")[2])} ·{" "}
                {cellSet.has(planMenu.key) ? cells.length : 1} hücre seçili
              </div>
              <button type="button" role="menuitem" onClick={copyPlanSelection}>
                <Copy size={15} />
                Değerleri Kopyala
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!copiedPlan || !planCellWritable(planMenu.key)}
                onClick={() => void pastePlanSelection()}
              >
                <ClipboardPaste size={15} />
                Değerleri Yapıştır
                {copiedPlan && (
                  <small>
                    {copiedPlan.rowCount} × {copiedPlan.columnCount}
                  </small>
                )}
              </button>
            </div>
          </>
        )}
      </>
      <Dialog
        open={!!phaseDetail}
        onOpenChange={(v) => {
          if (!v) setPhaseDetail(null);
        }}
      >
        <DialogContent className="editor phasedetail">
          <DialogHeader>
            <DialogTitle>
              {phaseDetail?.project.name}
              <ProjectResponsible project={phaseDetail?.project} />
            </DialogTitle>
            <DialogDescription>
              {phaseDetail && monthLabel(phaseDetail.month)} · Planlanan çalışma
            </DialogDescription>
          </DialogHeader>
          {phaseDetail && (
            <>
              <div
                className="phasedetailtext"
                style={phaseStyle(phaseDetail.project, phaseDetail.month)}
              >
                {phaseText(phaseDetail.project, phaseDetail.month)}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <PortalEditorDialog
        editor={editor}
        setEditor={setEditor}
        saving={saving}
        data={data}
        setFormError={setFormError}
        leaderItems={leaderItems}
        editTeams={editTeams}
        chooseResourceStatus={chooseResourceStatus}
        resourceIds={resourceIds}
        formError={formError}
        deleteEditedMilestone={deleteEditedMilestone}
        submit={submit}
        deleteProject={deleteProject}
      />
    </div>
  );
}
