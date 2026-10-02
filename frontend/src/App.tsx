import { usePortalEditor } from "./features/usePortalEditor";
import { ownValue } from "../../shared/records";
import WorkspaceHeader, { FullPlanHeader } from "./features/WorkspaceHeader";
import WorkspaceNavigation from "./features/WorkspaceNavigation";
import WorkspaceFilters from "./features/WorkspaceFilters";
import PlannedAllocationPanel from "./features/PlannedAllocationPanel";
import { useProjectMenus } from "./features/useProjectMenus";
import ProjectContextMenus from "./features/ProjectContextMenus";
import {
  prepareTimelineChange,
  prepareMilestoneReorder,
} from "./features/project-timeline-commands";
import {
  PLANNING_PERIODS,
  validPlanningMonth,
  clampFilterStart,
} from "../../shared/planning-dates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ClipboardPaste, Copy, Info } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeKind, ChangeValues } from "../../shared/commands";
import AbsenceReport from "./AbsenceReport";
import AccessPanel from "./AccessPanel";
import {
  downloadActualAllocations,
  downloadPlannedAllocations,
} from "./allocation-export";
import { capacityStatus } from "./capacity-status";
import PortalEditorDialog from "./features/PortalEditorDialog";
import RemainingResourceTable, {
  type ReportGroup,
} from "./features/RemainingResourceTable";
import { usePlannedGrid } from "./features/usePlannedGrid";
import { fmt, monthLabel } from "./format";
import HeadcountTrend from "./HeadcountTrend";
import { buildCapacityIndex, groupPage, projectTotalIndex } from "./metrics";
import {
  Data,
  Milestone,
  Project,
  activeTeamMembers,
  actualTeamTotalIndex,
  fold,
  isWorkingStatus,
  monthsFrom,
  phaseStyle,
  versionAt,
  visibleActualVersion,
} from "./model";
import MonthlyShortageTrend from "./MonthlyShortageTrend";
import {
  allowedDefaultTabs,
  defaultTabKey,
  readDefaultTab,
} from "./navigation";
import PersonAllocationPanel from "./PersonAllocationPanel";
import { downloadProjects } from "./project-export";
import ProjectInfoReport from "./ProjectInfoReport";
import ProjectResponsible from "./ProjectResponsible";
import ProjectTimelinePanel from "./features/ProjectTimelinePanel";
import { currentPlanningDate, resourceMonthFraction } from "./resource-dates";
import {
  downloadResourceReport,
  type ResourceReportGroup,
} from "./resource-report-export";
import ResourcesPanel from "./features/ResourcesPanel";
import RiskManagement from "./RiskManagement";
import type { RiskLeaveGuard } from "./RiskTable";
import { DEFAULT_FILTERS, TAB_LABELS } from "./settings";
import {
  Change,
  StaleSessionError,
  checkUpdates,
  currentUser,
  exportBackup,
  logout,
  readLocal,
  resetAllocations,
  restoreBackup,
  writeBatch,
  writeLocal,
} from "./storage";
import TeamDirectory from "./TeamDirectory";
("use client");
const periods = PLANNING_PERIODS;
const workspaceQuery = new URLSearchParams(window.location.search);
const fullPlan = workspaceQuery.get("allocation") === "full";
const queryStart = workspaceQuery.get("start");
const initialStart =
  queryStart && validPlanningMonth(queryStart)
    ? clampFilterStart(queryStart)
    : DEFAULT_FILTERS.start;
const queryCount = Number(workspaceQuery.get("count"));
const initialCount = periods.includes(queryCount)
  ? queryCount
  : DEFAULT_FILTERS.count;
const queryDensity = workspaceQuery.get("density");
const initialDensity =
  queryDensity === "compact" || queryDensity === "overview"
    ? queryDensity
    : "detail";
export default function Portal() {
  const riskLeaveGuard = useRef<RiskLeaveGuard | null>(null);
  const tabRequest = useRef(0);
  const pendingExternal = useRef(false),
    mainTabsRef = useRef<HTMLDivElement>(null),
    capacityTableRef = useRef<HTMLTableElement>(null),
    planTableRef = useRef<HTMLTableElement>(null);
  const [planPage, setPlanPage] = useState(0),
    [projectPage, setProjectPage] = useState(0),
    [resourcePage, setResourcePage] = useState(0);
  const [showCapacity, setShowCapacity] = useState(true);
  const [density, setDensity] = useState<"detail" | "compact" | "overview">(
    fullPlan ? initialDensity : "detail",
  );
  const [phaseDetail, setPhaseDetail] = useState<{
    project: Project;
    month: string;
  } | null>(null);
  const monthWidth =
    density === "overview" ? 24 : density === "compact" ? 68 : 150;
  const planMonthWidth =
    density === "overview" ? 23 : density === "compact" ? 65 : 144;
  const labelWidth = density === "overview" ? 210 : 240;
  const projectLabelWidth = 180;
  const planningLabelWidth = 220;
  const [browserFullScreen, setBrowserFullScreen] = useState(
    !!document.fullscreenElement,
  );
  const [showImport, setShowImport] = useState(false);
  const [user, setUser] = useState(currentUser);
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const readOnlyAllLeaders = !isAdmin && !(isManager && !!user?.leaders.length);
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [defaultTab, setDefaultTab] = useState(() => readDefaultTab(currentUser())),
    [tab, setTab] = useState(() =>
      fullPlan ? "plan" : readDefaultTab(currentUser()),
    ),
    [view, setView] = useState(
      fullPlan && workspaceQuery.get("view") === "team" ? "team" : "project",
    );
  const [leads, setLeads] = useState<string[]>(
      fullPlan ? workspaceQuery.getAll("lead") : [],
    ),
    [teamIds, setTeamIds] = useState<string[]>(
      fullPlan ? workspaceQuery.getAll("team") : [],
    ),
    [projectIds, setProjectIds] = useState<string[]>(
      fullPlan ? workspaceQuery.getAll("project") : [],
    ),
    [start, setStart] = useState(
      fullPlan ? initialStart : DEFAULT_FILTERS.start,
    ),
    [count, setCount] = useState(
      fullPlan ? initialCount : DEFAULT_FILTERS.count,
    ),
    [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [cells, setCells] = useState<string[]>([]),
    [resourceIds, setResourceIds] = useState<string[]>([]),
    [personIds, setPersonIds] = useState<string[]>([]),
    [showAllActual, setShowAllActual] = useState(false),
    [expandedActualTeams, setExpandedActualTeams] = useState<string[]>([]);
  const leaderReportTableRef = useRef<HTMLTableElement>(null);
  const teamReportTableRef = useRef<HTMLTableElement>(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [projectWeekly, setProjectWeekly] = useState(false);
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
    change,
    setError,
    setNotice,
    onProjectDeleted: (id) => {
      setProjectIds((ids) => ids.filter((item) => item !== id));
      setCells((keys) => keys.filter((key) => key.split("|")[1] !== id));
    },
    onSubmitted: () => setResourceIds([]),
  });
  async function load() {
    try {
      setData(await readLocal());
      setUser(currentUser());
      setError("");
    } catch (e) {
      if (e instanceof StaleSessionError) return;
      setData(null);
      setUser(currentUser());
      setEditor(null);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const refresh = () => {
      if (
        pendingExternal.current &&
        !editor &&
        !saving &&
        !document.querySelector("input:focus,textarea:focus")
      ) {
        pendingExternal.current = false;
        void load();
      }
    };
    const changed = (e: StorageEvent) => {
      if (e.key === "kaynak-planlama-offline-v1") {
        pendingExternal.current = true;
        refresh();
      }
    };
    const afterBlur = () => {
      setTimeout(refresh, 0);
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        void checkUpdates()
          .then((changed) => {
            if (changed) {
              pendingExternal.current = true;
              refresh();
            }
          })
          .catch(() => {});
    }, 15000);
    window.addEventListener("storage", changed);
    document.addEventListener("focusout", afterBlur);
    refresh();
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", changed);
      document.removeEventListener("focusout", afterBlur);
    };
  }, [editor, saving]);
  useEffect(() => {
    setCells([]);
    setPlanMenu(null);
    setResourceIds([]);
    setPlanPage(0);
    setProjectPage(0);
    setResourcePage(0);
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
  const [todayDate, setTodayDate] = useState(currentPlanningDate);
  const currentMonth = todayDate.slice(0, 7);
  useEffect(() => {
    const timer = window.setInterval(
      () => setTodayDate(currentPlanningDate()),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const defaultYearRef = useRef(currentMonth.slice(0, 4));
  useEffect(() => {
    const year = currentMonth.slice(0, 4);
    if (year === defaultYearRef.current) return;
    const previousDefault = defaultYearRef.current + "-01";
    setStart((old) => (old === previousDefault ? year + "-01" : old));
    defaultYearRef.current = year;
  }, [currentMonth]);
  const [filterResetKey, setFilterResetKey] = useState(0);
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
  function resetFilters() {
    const firstMonth = currentMonth.slice(0, 4) + "-01";
    setDensity("detail");
    setProjectWeekly(false);
    setLeads([]);
    setTeamIds([]);
    setProjectIds([]);
    setStart(firstMonth);
    setCount(DEFAULT_FILTERS.count);
    setSearch("");
    setCells([]);
    setResourceIds([]);
    setPersonIds([]);
    setFilterResetKey((k) => k + 1);
    setNotice(
      tab === "actual"
        ? "Filtreler sıfırlandı: " + monthLabel(firstMonth) + " · 12 ay."
        : tab === "resources"
          ? "Filtreler sıfırlandı: tüm liderlikler ve takımlar · " +
            monthLabel(firstMonth) +
            "."
          : tab === "overview"
            ? "Filtreler sıfırlandı: tüm liderlikler ve takımlar · " +
              monthLabel(firstMonth) +
              " · 12 ay."
            : tab === "projects"
              ? "Filtreler sıfırlandı: tüm projeler · " +
                monthLabel(firstMonth) +
                " · 12 ay."
              : "Filtreler sıfırlandı: tüm liderlikler, takımlar ve projeler · " +
                monthLabel(firstMonth) +
                " · 12 ay.",
    );
  }
  const cellSet = useMemo(() => new Set(cells), [cells]);
  const months = useMemo(() => monthsFrom(start, count), [start, count]);
  useEffect(() => {
    if (tab !== "plan" || view !== "project" || !showCapacity) return;
    const capacity = capacityTableRef.current?.parentElement;
    const plan = planTableRef.current?.parentElement;
    if (!capacity || !plan) return;
    const sync = (source: HTMLElement, target: HTMLElement) => {
      if (Math.abs(target.scrollLeft - source.scrollLeft) > 0.5)
        target.scrollLeft = source.scrollLeft;
    };
    const fromCapacity = () => sync(capacity, plan);
    const fromPlan = () => sync(plan, capacity);
    capacity.scrollLeft = plan.scrollLeft;
    capacity.addEventListener("scroll", fromCapacity);
    plan.addEventListener("scroll", fromPlan);
    return () => {
      capacity.removeEventListener("scroll", fromCapacity);
      plan.removeEventListener("scroll", fromPlan);
    };
  }, [tab, view, showCapacity, months, planMonthWidth]);
  useEffect(() => {
    if (tab !== "overview") return;
    const leader = leaderReportTableRef.current?.parentElement;
    const team = teamReportTableRef.current?.parentElement;
    if (!leader || !team) return;
    const sync = (source: HTMLElement, target: HTMLElement) => {
      if (Math.abs(target.scrollLeft - source.scrollLeft) > 0.5)
        target.scrollLeft = source.scrollLeft;
    };
    const fromLeader = () => sync(leader, team);
    const fromTeam = () => sync(team, leader);
    team.scrollLeft = leader.scrollLeft;
    leader.addEventListener("scroll", fromLeader);
    team.addEventListener("scroll", fromTeam);
    return () => {
      leader.removeEventListener("scroll", fromLeader);
      team.removeEventListener("scroll", fromTeam);
    };
  }, [tab, months, monthWidth]);
  const allLeads = data?.leaders || [];
  const availableTeams =
    data?.teams.filter((t) => !leads.length || leads.includes(t.lead)) || [];
  const teams = availableTeams.filter(
    (t) => !teamIds.length || teamIds.includes(t.id),
  );
  const projects =
    data?.projects.filter(
      (p) => !projectIds.length || projectIds.includes(p.id),
    ) || [];
  const ids = teams.map((t) => t.id);
  const leaderReportGroups = [...new Set(teams.map((t) => t.lead))].map(
    (lead) => ({
      name: lead || "Liderlik eşleştirilmemiş",
      leader: lead,
      ids: teams.filter((t) => t.lead === lead).map((t) => t.id),
    }),
  );
  const teamReportGroups = teams.map((t) => ({ name: t.name, ids: [t.id] }));
  const availablePeople =
    data?.resources
      .filter((r) =>
        months.some((m) => {
          if (m > currentMonth) return false;
          const v = visibleActualVersion(r, m, currentMonth);
          return !!v && ids.includes(v.team);
        }),
      )
      .map((r) => ({ id: r.id, name: r.name })) || [];
  const capacityFilters = [
    { label: "Liderlik", values: leads, active: leads.length > 0 },
    {
      label: "Takım",
      values: teamIds.map(
        (id) => data?.teams.find((t) => t.id === id)?.name || id,
      ),
      active: teamIds.length > 0,
    },
    {
      label: "Proje",
      values: projectIds.map(
        (id) => data?.projects.find((p) => p.id === id)?.name || id,
      ),
      active: projectIds.length > 0,
    },
    { label: "Başlangıç Ayı", values: [monthLabel(start)], active: true },
  ];
  const currentTeamMembers = useMemo(
    () => (data ? activeTeamMembers(data, currentMonth) : {}),
    [data, currentMonth],
  );
  const cache = useMemo(
    () => (data ? buildCapacityIndex(data, months) : {}),
    [data, months],
  );
  const projectTotals = useMemo(
    () => (data ? projectTotalIndex(data, ids, months) : {}),
    [data, leads, teamIds, months],
  );
  const actualTotals = useMemo(
    () => (data ? data.actualTeamTotals || actualTeamTotalIndex(data) : {}),
    [data],
  );
  function metric(tids: string[], m: string) {
    return tids.reduce(
      (s, id) => {
        const c = cache[id + "|" + m] || { current: 0, total: 0 };
        return { current: s.current + c.current, total: s.total + c.total };
      },
      { current: 0, total: 0 },
    );
  }
  const planPageSize = Math.max(20, Math.min(100, Math.floor(1200 / count)));
  const effectivePlanPage = Math.min(
    planPage,
    Math.max(0, Math.ceil((teams.length * projects.length) / planPageSize) - 1),
  );
  const planGroups = groupPage(
    view === "team" ? teams.length : projects.length,
    view === "team" ? projects.length : teams.length,
    effectivePlanPage,
    planPageSize,
  );
  const effectiveProjectPage = Math.min(
    projectPage,
    Math.max(0, Math.ceil(projects.length / 20) - 1),
  );
  const visiblePlanRows = planGroups.flatMap((group) =>
    group.inners.map((index) =>
      view === "team"
        ? teams[group.outer].id + "|" + projects[index].id
        : teams[index].id + "|" + projects[group.outer].id,
    ),
  );
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
  async function save<K extends ChangeKind>(
    kind: K,
    id: string,
    value: ChangeValues[K] | null,
  ) {
    if (!data) throw Error("Veriler yüklenmedi");
    setData(
      await writeLocal(kind, id, value, data.revisions[kind + ":" + id] || 0),
    );
    setNotice("Veritabanına kaydedildi");
  }
  async function batch(changes: Change[]) {
    setSaving(true);
    try {
      setData(await writeBatch(changes));
      setNotice(changes.length + " kayıt birlikte kaydedildi");
      setError("");
    } finally {
      setSaving(false);
    }
  }
  function change<K extends ChangeKind>(
    kind: K,
    id: string,
    value: ChangeValues[K] | null,
  ): Change<K> {
    return { kind, id, value, revision: data?.revisions[kind + ":" + id] || 0 };
  }
  async function resetAll() {
    if (!data || !isAdmin || saving) return;
    const n = Object.values(data.allocations).filter((v) => v !== 0).length;
    if (!n) {
      setNotice("Sıfırlanacak kaynak dağılımı yok.");
      return;
    }
    if (
      !confirm(
        "Tüm liderliklerdeki, tüm projelerdeki ve tüm aylardaki " +
          n +
          " dağıtım hücresi sıfırlanacak.\n\nEkrandaki filtreler ve görünür dönem bu işlemi sınırlamaz. Çalışan kayıtları, kapasite bilgileri ve proje planları korunur.\n\nGeri almak için işlem öncesi veri yedeği gerekir. Tüm dağılımlar sıfırlansın mı?",
      )
    )
      return;
    setSaving(true);
    try {
      setData(await resetAllocations(data));
      setCells([]);
      setError("");
      setNotice("Tüm dönemlerdeki kaynak dağılımları sıfırlandı.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function deleteResources(selected: string[]) {
    if (!data || saving || !selected.length) return;
    const unique = [...new Set(selected)];
    const names = unique.map(
      (id) =>
        data.resources.find((r) => r.id === id)?.name || "Bulunamayan kayıt",
    );
    const message =
      unique.length === 1
        ? "“" + names[0] + "” kaydı silinsin mi?"
        : unique.length +
          " seçili kayıt silinsin mi?\n\n" +
          names.slice(0, 8).join("\n") +
          (names.length > 8
            ? "\n… ve " + (names.length - 8) + " kayıt daha"
            : "");
    if (
      !confirm(
        message +
          "\n\nKayıtlar ve bu kişilere ait gerçekleşen dağılımlar silinir; aylık kaynaklar yeniden hesaplanır. Takımların planlanan proje tahsisleri korunur. Geri almak için silme öncesi yedeği yüklemeniz gerekir.",
      )
    )
      return;
    try {
      await batch(
        unique.map((id) => ({
          ...change("resource", id, null),
          operation: "delete" as const,
        })),
      );
      setResourceIds((old) => old.filter((id) => !unique.includes(id)));
      setNotice(
        unique.length + " kaynak kaydı silindi; kapasiteler güncellendi.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function reorderMilestone(
    project: Project,
    sourceId: string,
    targetId: string,
    after: boolean,
  ) {
    if (!data || !isAdmin || saving) return;
    try {
      const command = prepareMilestoneReorder(
        data,
        project.id,
        sourceId,
        targetId,
        after,
        (project.milestones || []).map((m) => m.id),
      );
      if (!command) return;
      await batch([command]);
      setNotice("Kritik konu sıralaması kaydedildi.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function changeMilestoneRange(
    project: Project,
    milestone: Milestone,
    rangeIndex: number,
    mode: "move" | "start" | "end",
    days: number,
  ) {
    if (!data || !isAdmin || saving || days === 0) return;
    try {
      await batch([
        prepareTimelineChange(data, project.id, milestone.id, {
          target: "range",
          rangeIndex,
          mode,
          days,
        }),
      ]);
      setNotice(
        mode === "move"
          ? "Kritik konu barı ve açıklama tarihleri " +
              Math.abs(days) +
              " gün " +
              (days > 0 ? "sağa" : "sola") +
              " taşındı."
          : "Kritik konu barının " +
              (mode === "start" ? "başlangıç" : "bitiş") +
              " tarihi ve bağlı detay açıklama tarihleri güncellendi.",
      );
    } catch (error) {
      setError((error as Error).message);
    }
  }
  async function changeMilestoneNote(
    project: Project,
    milestone: Milestone,
    rangeIndex: number,
    noteIndex: number,
    mode: "move" | "start" | "end",
    days: number,
  ) {
    if (!data || !isAdmin || saving || days === 0) return;
    try {
      await batch([
        prepareTimelineChange(data, project.id, milestone.id, {
          target: "note",
          rangeIndex,
          noteIndex,
          mode,
          days,
        }),
      ]);
      setNotice(
        mode === "move"
          ? "Detay açıklama ve kritik konu tarihleri güncellendi."
          : "Detay açıklamanın ve kritik konunun tarihleri güncellendi.",
      );
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function phaseText(p: Project, m: string) {
    return m < p.start || m > p.end
      ? "Proje dönemi dışında"
      : p.phases[m] || "Çalışma bilgisi girilmemiş";
  }
  function personCount(teamIds: string[]) {
    return (
      data?.resources.filter((r) => {
        const v = versionAt(r, start);
        return (
          !!v &&
          teamIds.includes(v.team) &&
          v.included &&
          isWorkingStatus(v.status) &&
          resourceMonthFraction(v, start) > 0
        );
      }).length || 0
    );
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
  function reportFilterSummary() {
    return [
      "Liderlik: " + (leads.length ? leads.length + " seçili" : "Tümü"),
      "Takım: " + (teamIds.length ? teamIds.length + " seçili" : "Tümü"),
    ].join(" · ");
  }
  function exportResourceReport() {
    if (!data) return;
    const rows = (
      groups: { name: string; ids: string[]; leader?: string }[],
      teamReport: boolean,
    ): ResourceReportGroup[] =>
      groups.map((group) => ({
        name: group.name,
        manager: teamReport
          ? teams.find((t) => t.id === group.ids[0])?.managerName || "—"
          : ownValue(data.leaderManagers, group.leader || "") || "—",
        personnel: personCount(group.ids),
        months: months.map((month) => {
          const value = metric(group.ids, month);
          return {
            remaining: value.current - value.total,
            status: capacityStatus(value.current, value.total).className,
          };
        }),
      }));
    downloadResourceReport(
      months,
      rows(leaderReportGroups, false),
      rows(teamReportGroups, true),
      reportFilterSummary(),
    );
  }
  function planWorkspaceUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("allocation", "full");
    url.searchParams.set("view", view);
    url.searchParams.set("start", start);
    url.searchParams.set("count", String(count));
    url.searchParams.set("density", density);
    for (const l of leads) url.searchParams.append("lead", l);
    for (const t of teamIds) url.searchParams.append("team", t);
    for (const p of projectIds) url.searchParams.append("project", p);
    return url.pathname + url.search;
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
  function exportCurrentTab() {
    try {
      if (tab === "projects")
        downloadProjects(projects, months, density, projectWeekly);
      else if (tab === "overview") exportResourceReport();
      else if (tab === "plan" && data)
        downloadPlannedAllocations(data, teams, projects, months);
      else if (tab === "actual" && data)
        downloadActualAllocations(
          data,
          teams,
          projects,
          months,
          currentMonth,
          isAdmin || isManager ? personIds : [user?.resourceId || ""],
        );
    } catch (e) {
      setError((e as Error).message);
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
  async function downloadBackup() {
    if (!(await flushRiskDraft())) return;
    try {
      await exportBackup();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function restoreBackupFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (!(await flushRiskDraft())) return;
      if (
        !confirm(
          "Sunucudaki mevcut planlama verileri yedekteki verilerle değiştirilecek. Devam edilsin mi?",
        )
      )
        return;
      await restoreBackup(file);
      await load();
      setNotice("Yedek yüklendi");
      setCells([]);
      setResourceIds([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      input.value = "";
    }
  }
  async function signOut() {
    if (!(await flushRiskDraft())) return;
    try {
      await logout();
      location.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const leaderItems = allLeads.map((l) => ({ id: l, name: l }));
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
                    onSave={(risk) => save("risk", risk.id, risk)}
                    onDelete={async (risk) => {
                      await batch([
                        {
                          ...change("risk", risk.id, null),
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
                      ownResourceId={user?.resourceId}
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
