import {
  PLANNING_PERIODS,
  MIN_PLANNING_MONTH,
  MAX_FILTER_START,
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownToLine,
  CalendarDays,
  ChevronDown,
  ClipboardPaste,
  Copy,
  FolderKanban,
  Info,
  Layers3,
  Maximize2,
  Minimize2,
  PaintBucket,
  Palette,
  Plus,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeKind, ChangeValues } from "../../shared/commands";
import AbsenceReport from "./AbsenceReport";
import AccessPanel from "./AccessPanel";
import {
  downloadActualAllocations,
  downloadPlannedAllocations,
} from "./allocation-export";
import { capacityStatus } from "./capacity-status";
import Cell from "./components/AllocationCell";
import { Picker } from "./components/FilterPicker";
import MemberBadge from "./components/MemberBadge";
import type { PortalEditor } from "./features/editor-state";
import PortalEditorDialog from "./features/PortalEditorDialog";
import RemainingResourceTable, {
  type ReportGroup,
} from "./features/RemainingResourceTable";
import { usePlannedGrid } from "./features/usePlannedGrid";
import { fmt, fullDateLabel, monthLabel, shortDateFormat } from "./format";
import HeadcountTrend from "./HeadcountTrend";
import { buildCapacityIndex, groupPage, projectTotalIndex } from "./metrics";
import {
  assertMilestoneDateRanges,
  changeMilestoneNoteDates,
  cleanMilestoneRanges,
  milestoneRanges,
  resizeMilestoneRange,
  shiftMilestoneRange,
  visibleMilestoneBarStyle,
  withMilestoneRanges,
  withoutCriticalTopics,
} from "./milestone-ranges";
import {
  Data,
  Milestone,
  Project,
  Resource,
  Team,
  activeTeamMembers,
  actualTeamTotalIndex,
  fold,
  isWorkingStatus,
  monthsFrom,
  phasePalette,
  phaseStyle,
  versionAt,
  visibleActualVersion,
  withVersion,
} from "./model";
import MonthlyShortageTrend from "./MonthlyShortageTrend";
import {
  allowedDefaultTabs,
  defaultTabKey,
  readDefaultTab,
} from "./navigation";
import Pager from "./Pager";
import PersonAllocationPanel from "./PersonAllocationPanel";
import { downloadProjects } from "./project-export";
import ProjectInfoReport from "./ProjectInfoReport";
import ProjectResponsible from "./ProjectResponsible";
import ProjectTimelineRows from "./ProjectTimelineRows";
import {
  currentPlanningDate,
  currentYearStartDate,
  resourceMonthFraction,
} from "./resource-dates";
import {
  downloadResourceReport,
  type ResourceReportGroup,
} from "./resource-report-export";
import {
  resourceVersionForEdit,
  resourceVersionForSave,
} from "./resource-version-edit";
import ResourceImportPanel from "./ResourceImportPanel";
import RiskManagement from "./RiskManagement";
import { DEFAULT_FILTERS, SYSTEM_NAME, TAB_LABELS } from "./settings";
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
import { projectTimelinePeriods } from "./timeline-periods";
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
  const pendingExternal = useRef(false),
    menuRef = useRef<HTMLDivElement>(null),
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
  const [phaseMenu, setPhaseMenu] = useState<{
      projectId: string;
      month: string;
      x: number;
      y: number;
    } | null>(null),
    [copiedPhase, setCopiedPhase] = useState<string | null>(null),
    [copiedPhaseColor, setCopiedPhaseColor] = useState<string | null>(null),
    [copiedPhaseBundle, setCopiedPhaseBundle] = useState<{
      text: string;
      color: string;
    } | null>(null),
    [milestoneMenu, setMilestoneMenu] = useState<{
      projectId: string;
      milestoneId: string;
      rangeIndex: number;
      x: number;
      y: number;
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
  const [editor, setEditor] = useState<PortalEditor | null>(null),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState("");
  const [cells, setCells] = useState<string[]>([]),
    [resourceIds, setResourceIds] = useState<string[]>([]),
    [personIds, setPersonIds] = useState<string[]>([]),
    [showAllActual, setShowAllActual] = useState(false),
    [expandedActualTeams, setExpandedActualTeams] = useState<string[]>([]);
  const leaderReportTableRef = useRef<HTMLTableElement>(null);
  const teamReportTableRef = useRef<HTMLTableElement>(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [projectWeekly, setProjectWeekly] = useState(false);
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
    if (!phaseMenu) return;
    menuRef.current?.focus();
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhaseMenu(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [phaseMenu]);
  useEffect(() => {
    if (!milestoneMenu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMilestoneMenu(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [milestoneMenu]);
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
  const projectPeriods = useMemo(
    () => projectTimelinePeriods(months, projectWeekly),
    [months, projectWeekly],
  );
  const projectYearBands = useMemo(
    () => [...new Set(projectPeriods.map((period) => period.year))],
    [projectPeriods],
  );
  const projectPeriodWidth = monthWidth;
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
  const visibleResources =
    data?.resources.filter((r) => {
      const v = versionAt(r, start) || r.versions[0];
      return (
        (ids.includes(v.team) || (!v.team && !teamIds.length)) &&
        (!leads.length ||
          leads.includes(
            v.lead || data.teams.find((t) => t.id === v.team)?.lead || "",
          )) &&
        fold(r.name + " " + v.status + " " + (v.lead || "")).includes(
          fold(search),
        )
      );
    }) || [];
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
  const effectiveResourcePage = Math.min(
    resourcePage,
    Math.max(0, Math.ceil(visibleResources.length / 50) - 1),
  );
  const visiblePlanRows = planGroups.flatMap((group) =>
    group.inners.map((index) =>
      view === "team"
        ? teams[group.outer].id + "|" + projects[index].id
        : teams[index].id + "|" + projects[group.outer].id,
    ),
  );
  const {
    planMenu,
    setPlanMenu,
    planMenuRef,
    copiedPlan,
    firstSelectedPlanCell,
    planCellWritable,
    startPlanDrag,
    openPlanMenu,
    copyPlanSelection,
    pastePlanSelection,
    fillSelectedPlanCells,
    clearPlanSelection,
  } = usePlannedGrid({
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
  function openProject(p?: Project, m?: string) {
    if (!isAdmin) return;
    setFormError("");
    if (p && m)
      setEditor({
        kind: "projectPhase",
        value: structuredClone(p),
        phaseMonth: m,
      });
    else
      setEditor({
        kind: "project",
        isNew: !p,
        value: p
          ? structuredClone(p)
          : {
              id: crypto.randomUUID(),
              name: "",
              responsibleName: "",
              start,
              end: monthsFrom(start, count)[count - 1],
              phases: {},
              phaseColors: {},
              milestones: [],
            },
      });
  }
  async function deleteProject() {
    if (
      !data ||
      !isAdmin ||
      saving ||
      editor?.kind !== "project" ||
      editor.isNew
    )
      return;
    const project = data.projects.find((p) => p.id === editor.value.id);
    if (!project) {
      setFormError("Proje bulunamadı. Verileri yenileyip tekrar deneyin.");
      return;
    }
    const planned = Object.keys(data.allocations).filter(
      (key) => key.split("|")[1] === project.id,
    ).length;
    const actual = Object.keys(data.actualAllocations || {}).filter(
      (key) => key.split("|")[1] === project.id,
    ).length;
    if (
      !confirm(
        `“${project.name}” projesi silinsin mi?\n\nBu projeye bağlı ${planned} planlanan ve ${actual} gerçekleşen kaynak dağılımı kaydı, yüzde girişleri, aşamalar ve kritik proje konuları da kalıcı olarak silinecek.\n\nDiğer projelerin kayıtları korunur. İşlemi geri almak için silme öncesi veri yedeği gerekir.`,
      )
    )
      return;
    setFormError("");
    try {
      await batch([
        { ...change("project", project.id, null), operation: "delete" },
      ]);
      setEditor(null);
      setProjectIds((ids) => ids.filter((id) => id !== project.id));
      setCells((keys) =>
        keys.filter((key) => key.split("|")[1] !== project.id),
      );
      setNotice(
        `“${project.name}” projesi ve bağlı kaynak dağılımları silindi.`,
      );
    } catch (e) {
      setFormError((e as Error).message);
    }
  }
  function openMilestone(project: Project, milestone?: Milestone) {
    if (!isAdmin) return;
    setFormError("");
    const first =
      months.find((month) => month >= project.start && month <= project.end) ||
      project.start;
    setEditor({
      kind: "milestone",
      projectId: project.id,
      isNew: !milestone,
      draftEmpty: !milestone || milestone.hasCriticalTopics === false,
      value: milestone
        ? {
            ...structuredClone(milestone),
            barStyle: visibleMilestoneBarStyle(milestone.barStyle),
          }
        : {
            id: crypto.randomUUID(),
            name: "",
            start: first + "-01",
            end: first + "-01",
            barColor: "red",
            barStyle: "outline",
            barText: "",
          },
    });
  }
  async function deleteMilestone(project: Project, milestone: Milestone) {
    if (!data || !isAdmin || saving) return;
    const current = data.projects.find((item) => item.id === project.id);
    if (!current?.milestones?.some((item) => item.id === milestone.id)) {
      const message =
        "Kritik konu bulunamadı. Verileri yenileyip tekrar deneyin.";
      if (editor?.kind === "milestone" && editor.value?.id === milestone.id)
        setFormError(message);
      else setError(message);
      return;
    }
    if (
      !confirm(
        "“" +
          milestone.name +
          "” kritik konusu tüm tarih aralıkları ve açıklamalarıyla silinsin mi?",
      )
    )
      return;
    try {
      await batch([
        change("project", current.id, {
          ...current,
          milestones: current.milestones.filter(
            (item) => item.id !== milestone.id,
          ),
        }),
      ]);
      setEditor((active: PortalEditor | null) =>
        active?.kind === "milestone" && active.value?.id === milestone.id
          ? null
          : active,
      );
      setNotice("Kritik konu ve bağlı açıklamaları silindi.");
    } catch (e) {
      if (editor?.kind === "milestone" && editor.value?.id === milestone.id)
        setFormError((e as Error).message);
      else setError((e as Error).message);
    }
  }
  function deleteEditedMilestone() {
    if (!data || editor?.kind !== "milestone" || editor.isNew) return;
    const project = data.projects.find((item) => item.id === editor.projectId);
    const milestone = project?.milestones?.find(
      (item) => item.id === editor.value.id,
    );
    if (!project || !milestone) {
      setFormError(
        "Kritik konu bulunamadı. Verileri yenileyip tekrar deneyin.",
      );
      return;
    }
    void deleteMilestone(project, milestone);
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
      const current = data.projects.find((item) => item.id === project.id);
      const selected = current?.milestones?.find(
        (item) => item.id === milestone.id,
      );
      if (!current || !selected)
        throw Error(
          "Kritik konu bulunamadı. Verileri yenileyip tekrar deneyin.",
        );
      const changed =
        mode === "move"
          ? shiftMilestoneRange(current, selected, rangeIndex, days)
          : resizeMilestoneRange(current, selected, rangeIndex, mode, days);
      const ordered = withMilestoneRanges(
        changed,
        milestoneRanges(changed).sort(
          (a, b) =>
            a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
        ),
      );
      await batch([
        change("project", current.id, {
          ...current,
          milestones: current.milestones?.map((item) =>
            item.id === selected.id ? ordered : item,
          ),
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
      const current = data.projects.find((item) => item.id === project.id);
      const selected = current?.milestones?.find(
        (item) => item.id === milestone.id,
      );
      if (!current || !selected)
        throw Error(
          "Kritik konu bulunamadı. Verileri yenileyip tekrar deneyin.",
        );
      const changed = changeMilestoneNoteDates(
        current,
        selected,
        rangeIndex,
        noteIndex,
        mode,
        days,
      );
      const ordered = withMilestoneRanges(
        changed,
        milestoneRanges(changed).sort(
          (a, b) =>
            a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
        ),
      );
      await batch([
        change("project", current.id, {
          ...current,
          milestones: current.milestones?.map((item) =>
            item.id === selected.id ? ordered : item,
          ),
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
  function openResource(r?: Resource) {
    setFormError("");
    const v = r
      ? resourceVersionForEdit(r, start)
      : {
          effective: start,
          team: "",
          lead: leads.length === 1 ? leads[0] : "",
          status: "Aktif Çalışan",
          included: true,
          start: currentYearStartDate(),
          end: "",
          amount: 1,
        };
    const workStart =
      !v.start && isWorkingStatus(v.status) ? currentYearStartDate() : v.start;
    setEditor({
      kind: "resource",
      isNew: !r,
      value: r
        ? structuredClone(r)
        : { id: crypto.randomUUID(), name: "", note: "", versions: [] },
      version: {
        ...v,
        start: workStart,
        lead: v.lead || data?.teams.find((t) => t.id === v.team)?.lead || "",
      },
    });
  }
  function chooseResourceStatus(status: string) {
    if (
      editor?.kind !== "resource" ||
      !status ||
      status === editor.version.status
    )
      return;
    const posting = status === "Aktif İlan" || status === "Pasif İlan";
    const previousPosting =
      editor.version.status === "Aktif İlan" ||
      editor.version.status === "Pasif İlan";
    setEditor({
      ...editor,
      version: {
        ...editor.version,
        status,
        included: !posting,
        start: posting
          ? ""
          : previousPosting || !editor.version.start
            ? currentYearStartDate()
            : editor.version.start,
        end:
          editor.version.status === "İşten Ayrıldı" ? "" : editor.version.end,
      },
    });
  }
  function openBulk() {
    setFormError("");
    setEditor({
      kind: "bulkResources",
      effective: start,
      team: "",
      lead: "",
      status: "",
      included: "keep",
    });
  }
  async function submit() {
    if (!data || !editor) return;
    setFormError("");
    try {
      const changes: Change[] = [];
      if (editor.kind === "milestone") {
        const project = data.projects.find((p) => p.id === editor.projectId);
        if (!project) throw Error("Proje bulunamadı.");
        const draft: Milestone = {
          ...editor.value,
          name: String(editor.value.name).trim(),
          barText: String(editor.value.barText || "").trim(),
        };
        if (!draft.name) throw Error("Kritik konu adı girin.");
        if (draft.name.length > 200)
          throw Error("Kritik konu adı 200 karakteri geçemez.");
        let milestone: Milestone;
        if (editor.draftEmpty) milestone = withoutCriticalTopics(draft);
        else {
          const ranges = milestoneRanges(draft).sort(
            (a, b) =>
              a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
          );
          assertMilestoneDateRanges(project, ranges);
          milestone = withMilestoneRanges(draft, cleanMilestoneRanges(ranges));
        }
        const milestones = [
          ...(project.milestones || []).filter((m) => m.id !== milestone.id),
          milestone,
        ].sort(
          (a, b) =>
            a.start.localeCompare(b.start) || a.end.localeCompare(b.end),
        );
        changes.push(change("project", project.id, { ...project, milestones }));
      } else if (editor.kind === "project" || editor.kind === "projectPhase") {
        if (
          editor.kind === "projectPhase" &&
          (editor.phaseMonth < editor.value.start ||
            editor.phaseMonth > editor.value.end)
        )
          throw Error("Aşama ayı proje dönemi içinde olmalı.");
        changes.push(change("project", editor.value.id, editor.value));
      } else if (editor.kind === "resource") {
        const { resource: resourceForSave, version: v } =
          resourceVersionForSave(
            editor.value,
            editor.version,
            editor.isNew,
            start,
          );
        if (
          (isWorkingStatus(v.status) ||
            (v.included && v.status === "Aktif İlan")) &&
          !v.start
        )
          throw Error("Bu statü için İşbaşı Tarihi girin.");
        if (v.status === "İşten Ayrıldı" && (!v.start || !v.end))
          throw Error(
            "İşten Ayrıldı için işbaşı ve işten ayrılış tarihlerini girin.",
          );
        if (v.start && v.end && v.end < v.start)
          throw Error("İşten Ayrılış Tarihi, İşbaşı Tarihi’nden önce olamaz.");
        if (!v.lead || !v.team) throw Error("Liderlik ve takım seçin.");
        const t = data.teams.find((t) => t.id === v.team)!;
        if (t.lead && t.lead !== v.lead)
          throw Error("Seçilen takım bu liderliğe bağlı değil.");
        if (!t.lead) changes.push(change("team", t.id, { ...t, lead: v.lead }));
        changes.push(
          change("resource", editor.value.id, withVersion(resourceForSave, v)),
        );
      } else if (editor.kind === "bulkResources") {
        if (!resourceIds.length) throw Error("En az bir kayıt seçin.");
        if (!editor.team && !editor.status && editor.included === "keep")
          throw Error("Değiştirilecek en az bir alan seçin.");
        const t = editor.team
          ? data.teams.find((t) => t.id === editor.team)
          : null;
        const leader = t ? t.lead || editor.lead : "";
        if (t && !leader) throw Error("Bu takım için liderlik seçin.");
        if (t && !t.lead)
          changes.push(change("team", t.id, { ...t, lead: leader }));
        for (const id of resourceIds) {
          const r = data.resources.find((x) => x.id === id)!;
          const old = resourceVersionForEdit(r, editor.effective);
          const v = {
            ...old,
            ...(t ? { team: t.id, lead: leader } : {}),
            ...(editor.status ? { status: editor.status } : {}),
            ...(editor.included !== "keep"
              ? { included: editor.included === "yes" }
              : {}),
          };
          if (editor.status && isWorkingStatus(v.status) && !v.start)
            throw Error(
              r.name +
                ": İşbaşı Tarihi girilmeden çalışan statüsüne geçirilemez.",
            );
          if (editor.status === "İşten Ayrıldı" && (!v.start || !v.end))
            throw Error(
              r.name +
                ": İşten Ayrıldı statüsü için iki tarihi de bireysel düzenlemede girin.",
            );
          changes.push(change("resource", id, withVersion(r, v)));
        }
      }
      await batch(changes);
      setEditor(null);
      setResourceIds([]);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }
  function summary(ts: Team[], mths = months, selectedReport = false) {
    const teamIds = ts.map((t) => t.id);
    const rows: [number, string][] = [
      [0, "Aktif Kaynak"],
      [2, selectedReport ? "Dağıtılan Kaynak" : "Tüm Projelere Tahsis"],
      [3, "Kalan Kaynak"],
    ];
    return rows.map(([kind, title]) => (
      <TableRow key={title} className={"summary s" + kind}>
        <TableCell>{title}</TableCell>
        {mths.map((m) => {
          const c = metric(teamIds, m);
          const allocated =
            selectedReport && projectIds.length
              ? projects.reduce(
                  (total, p) => total + (projectTotals[p.id + "|" + m] || 0),
                  0,
                )
              : c.total;
          const value =
            kind === 0
              ? c.current
              : kind === 2
                ? allocated
                : c.current - allocated;
          return (
            <TableCell
              key={m}
              className={
                kind >= 2 ? capacityStatus(c.current, allocated).className : ""
              }
              title={
                monthLabel(m) +
                " · " +
                title +
                ": " +
                fmt(value) +
                (kind >= 2
                  ? " · " + capacityStatus(c.current, allocated).label
                  : "")
              }
            >
              {fmt(value)}
            </TableCell>
          );
        })}
      </TableRow>
    ));
  }
  function phaseText(p: Project, m: string) {
    return m < p.start || m > p.end
      ? "Proje dönemi dışında"
      : p.phases[m] || "Çalışma bilgisi girilmemiş";
  }
  function openPhaseMenu(
    e: React.MouseEvent<HTMLButtonElement>,
    p: Project,
    m: string,
  ) {
    e.preventDefault();
    if (m < p.start || m > p.end) return;
    const rect = e.currentTarget.getBoundingClientRect(),
      x = e.clientX || rect.left,
      y = e.clientY || rect.bottom;
    setPhaseMenu({
      projectId: p.id,
      month: m,
      x: Math.max(8, Math.min(x, window.innerWidth - 220)),
      y: Math.max(8, Math.min(y, window.innerHeight - 320)),
    });
  }
  function copyPhase() {
    if (!phaseMenu || !data) return;
    const value = data.projects.find((p) => p.id === phaseMenu.projectId)
      ?.phases[phaseMenu.month];
    if (!value) return;
    setCopiedPhase(value);
    setPhaseMenu(null);
    setNotice("Aşama metni kopyalandı");
    if (navigator.clipboard && window.isSecureContext)
      void navigator.clipboard.writeText(value).catch(() => {});
  }
  async function pastePhase() {
    if (!phaseMenu || copiedPhase === null || !data || !isAdmin || saving)
      return;
    const { projectId, month } = phaseMenu,
      p = data.projects.find((x) => x.id === projectId);
    if (!p || month < p.start || month > p.end) return;
    setPhaseMenu(null);
    setSaving(true);
    try {
      const next = { ...p, phases: { ...p.phases, [month]: copiedPhase } };
      setData(
        await writeLocal(
          "project",
          projectId,
          next,
          data.revisions["project:" + projectId] || 0,
        ),
      );
      setNotice(
        "Aşama metni " +
          p.name +
          " / " +
          monthLabel(month) +
          " hücresine yapıştırıldı",
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function copyPhaseColor() {
    if (!phaseMenu || !data) return;
    const p = data.projects.find((x) => x.id === phaseMenu.projectId);
    if (!p) return;
    const color =
      p.phaseColors?.[phaseMenu.month] ||
      (!p.phases[phaseMenu.month]?.trim() ||
      p.phases[phaseMenu.month] === "ÇALIŞMA YOK"
        ? "gray"
        : "blue");
    setCopiedPhaseColor(color);
    setPhaseMenu(null);
    setNotice("Aşama rengi kopyalandı");
  }
  async function pastePhaseColor() {
    if (!phaseMenu || copiedPhaseColor === null || !data || !isAdmin || saving)
      return;
    const { projectId, month } = phaseMenu,
      p = data.projects.find((x) => x.id === projectId);
    if (!p || month < p.start || month > p.end) return;
    setPhaseMenu(null);
    setSaving(true);
    try {
      const next = {
        ...p,
        phaseColors: { ...p.phaseColors, [month]: copiedPhaseColor },
      };
      setData(
        await writeLocal(
          "project",
          projectId,
          next,
          data.revisions["project:" + projectId] || 0,
        ),
      );
      setNotice(
        "Aşama rengi " +
          p.name +
          " / " +
          monthLabel(month) +
          " hücresine yapıştırıldı",
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function copyPhaseBundle() {
    if (!phaseMenu || !data) return;
    const p = data.projects.find(
      (project) => project.id === phaseMenu.projectId,
    );
    if (!p) return;
    const text = p.phases[phaseMenu.month] || "";
    const color =
      p.phaseColors?.[phaseMenu.month] ||
      (!text.trim() || text === "ÇALIŞMA YOK" ? "gray" : "blue");
    setCopiedPhaseBundle({ text, color });
    setPhaseMenu(null);
    setNotice("Aşama metni ve rengi birlikte kopyalandı");
    if (navigator.clipboard && window.isSecureContext)
      void navigator.clipboard.writeText(text).catch(() => {});
  }
  async function pastePhaseBundle() {
    if (!phaseMenu || !copiedPhaseBundle || !data || !isAdmin || saving) return;
    const { projectId, month } = phaseMenu,
      p = data.projects.find((project) => project.id === projectId);
    if (!p || month < p.start || month > p.end) return;
    setPhaseMenu(null);
    setSaving(true);
    try {
      const next = {
        ...p,
        phases: { ...p.phases, [month]: copiedPhaseBundle.text },
        phaseColors: { ...p.phaseColors, [month]: copiedPhaseBundle.color },
      };
      setData(
        await writeLocal(
          "project",
          projectId,
          next,
          data.revisions["project:" + projectId] || 0,
        ),
      );
      setNotice(
        "Aşama metni ve rengi " +
          p.name +
          " / " +
          monthLabel(month) +
          " hücresine yapıştırıldı",
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function openMilestoneMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    project: Project,
    milestone: Milestone,
    rangeIndex: number,
  ) {
    event.preventDefault();
    setPhaseMenu(null);
    const rect = event.currentTarget.getBoundingClientRect(),
      x = event.clientX || rect.left,
      y = event.clientY || rect.bottom;
    setMilestoneMenu({
      projectId: project.id,
      milestoneId: milestone.id,
      rangeIndex,
      x: Math.max(8, Math.min(x, window.innerWidth - 220)),
      y: Math.max(8, Math.min(y, window.innerHeight - 170)),
    });
  }
  function copyMilestoneColor() {
    if (!milestoneMenu || !data) return;
    const milestone = data.projects
      .find((p) => p.id === milestoneMenu.projectId)
      ?.milestones?.find((m) => m.id === milestoneMenu.milestoneId);
    const range =
      milestone && milestoneRanges(milestone)[milestoneMenu.rangeIndex];
    if (!range) return;
    setCopiedPhaseColor(range.color || "red");
    setMilestoneMenu(null);
    setNotice("Bar rengi kopyalandı");
  }
  async function pasteMilestoneColor() {
    if (
      !milestoneMenu ||
      copiedPhaseColor === null ||
      !data ||
      !isAdmin ||
      saving
    )
      return;
    const p = data.projects.find((x) => x.id === milestoneMenu.projectId);
    if (!p || !p.milestones?.some((m) => m.id === milestoneMenu.milestoneId))
      return;
    setMilestoneMenu(null);
    setSaving(true);
    try {
      const next = {
        ...p,
        milestones: p.milestones.map((m) => {
          if (m.id !== milestoneMenu.milestoneId) return m;
          const ranges = milestoneRanges(m).map((range, index) =>
            index === milestoneMenu.rangeIndex
              ? { ...range, color: copiedPhaseColor }
              : range,
          );
          return withMilestoneRanges(m, ranges);
        }),
      };
      setData(
        await writeLocal(
          "project",
          p.id,
          next,
          data.revisions["project:" + p.id] || 0,
        ),
      );
      setNotice("Bar rengi yapıştırıldı");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function phase(p: Project, m: string) {
    const text = phaseText(p, m);
    return (
      <button
        className="month-work"
        style={phaseStyle(p, m)}
        title={p.name + " / " + monthLabel(m) + "\n" + text}
        aria-label={p.name + " / " + monthLabel(m) + " planlanan çalışma"}
        onContextMenu={(e) => openPhaseMenu(e, p, m)}
        onClick={() =>
          isAdmin ? openProject(p, m) : setPhaseDetail({ project: p, month: m })
        }
        disabled={m < p.start || m > p.end}
      >
        <span className="phasepreview">
          {density === "overview" ? (p.phases[m] ? "●" : "·") : text}
        </span>
      </button>
    );
  }
  function monthColumns(first = labelWidth, second = 0, width = monthWidth) {
    return (
      <colgroup>
        <col style={{ width: first }} />
        {!!second && <col style={{ width: second }} />}
        {months.map((m) => (
          <col key={m} style={{ width }} />
        ))}
      </colgroup>
    );
  }
  function yearRow(
    labels = 1,
    periodYears = months.map((month) => month.slice(0, 4)),
  ) {
    const years: { year: string; count: number }[] = [];
    for (const y of periodYears) {
      if (years.at(-1)?.year === y) years.at(-1)!.count++;
      else years.push({ year: y, count: 1 });
    }
    return (
      <TableRow className="yearrow">
        <TableHead colSpan={labels}>Yıl</TableHead>
        {years.map((y, index) => (
          <TableHead
            key={y.year}
            colSpan={y.count}
            className={"year-band-" + (index % 6)}
          >
            {y.year}
          </TableHead>
        ))}
      </TableRow>
    );
  }
  function monthHead(m: string) {
    const years = [...new Set(months.map((month) => month.slice(0, 4)))];
    return (
      <TableHead
        key={m}
        data-month={m}
        className={"monthhead year-band-" + (years.indexOf(m.slice(0, 4)) % 6)}
        title={monthLabel(m)}
      >
        <span>{shortDateFormat.format(new Date(m + "-01T12:00:00"))}</span>
      </TableHead>
    );
  }
  function toggleActual(teamId: string) {
    setExpandedActualTeams((old) =>
      old.includes(teamId)
        ? old.filter((id) => id !== teamId)
        : [...old, teamId],
    );
  }
  function actualVisible(teamId: string) {
    return showAllActual
      ? !expandedActualTeams.includes(teamId)
      : expandedActualTeams.includes(teamId);
  }
  function actualRow(t: Team, p: Project) {
    return (
      <TableRow key={"actual-" + t.id + "-" + p.id} className="actual-row">
        <TableCell className="rowname">Gerçekleşen Kaynak Dağılımı</TableCell>
        {months.map((m) => {
          const k = t.id + "|" + p.id + "|" + m,
            actual = actualTotals[k] || 0,
            planned = data?.allocations[k] || 0;
          return (
            <TableCell
              key={m}
              className={
                [
                  actual > 0 ? "has-entry" : "",
                  actual > planned + 0.000001 ? "actual-exceeds-plan" : "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              title={
                monthLabel(m) +
                " gerçekleşen: " +
                fmt(actual) +
                " / öngörülen: " +
                fmt(planned)
              }
            >
              {fmt(actual)}
            </TableCell>
          );
        })}
      </TableRow>
    );
  }
  function memberBadge(label: string, members: string[]) {
    return (
      <MemberBadge
        label={label}
        members={members}
        currentMonth={currentMonth}
      />
    );
  }
  function teamMemberBadge(t: Team) {
    return memberBadge(t.name, currentTeamMembers[t.id] || []);
  }
  function allocationRow(t: Team, p: Project) {
    return (
      <Fragment key={t.id + p.id}>
        <TableRow>
          <TableCell className="rowname">
            {view === "project" && (
              <button
                className="actual-expand"
                type="button"
                aria-label={
                  t.name +
                  " gerçekleşen dağılımı " +
                  (actualVisible(t.id) ? "gizle" : "göster")
                }
                aria-expanded={actualVisible(t.id)}
                onClick={() => toggleActual(t.id)}
              >
                {actualVisible(t.id) ? "−" : "+"}
              </button>
            )}
            {view === "team" && <span className="indent">↳</span>}
            {view === "team" ? (
              <span className="project-row-label">
                <span>{p.name}</span>
                <ProjectResponsible project={p} />
              </span>
            ) : (
              <span className="team-row-block">
                <span className="team-row-title">
                  <span>{t.name}</span>
                  {teamMemberBadge(t)}
                </span>
                <span className="team-manager">
                  Yönetici: {t.managerName || "Atanmamış"}
                </span>
              </span>
            )}
          </TableCell>
          {months.map((m) => {
            const k = t.id + "|" + p.id + "|" + m,
              disabled = m < p.start || m > p.end,
              editable = planCellWritable(k);
            return (
              <TableCell
                key={m}
                data-plan-cell={k}
                onPointerDown={(e) => startPlanDrag(e, k)}
                onContextMenu={(e) => openPlanMenu(e, k)}
                className={
                  (view === "team" ? "allocation-with-work " : "") +
                  ((data?.allocations[k] || 0) > 0 ? "has-entry " : "") +
                  (cellSet.has(k) ? "selectedcell" : "")
                }
              >
                {view === "team" && phase(p, m)}
                <Cell
                  value={data?.allocations[k] || 0}
                  label={t.name + " / " + p.name + " / " + monthLabel(m)}
                  disabled={disabled || !editable}
                  save={(v) => save("allocation", k, v)}
                  onFillSelection={
                    cells.length > 1 && firstSelectedPlanCell === k
                      ? fillSelectedPlanCells
                      : undefined
                  }
                />
              </TableCell>
            );
          })}
        </TableRow>
        {actualVisible(t.id) && actualRow(t, p)}
      </Fragment>
    );
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
          : data.leaderManagers?.[group.leader || ""] || "—",
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
      <header className="mast">
        <div className="mastbrandrow">
          <div className="brand">
            <div className="mark">
              <Layers3 size={20} />
            </div>
            <h1 className="systembrand">{SYSTEM_NAME}</h1>
          </div>
          <div className="masttopright">
            <div className="mastuser">
              <Users size={15} />
              <span>
                {user?.username} ·{" "}
                {isAdmin
                  ? "Admin"
                  : isManager
                    ? "Yönetici"
                    : "Normal Kullanıcı"}
              </span>
            </div>
            <label
              className="default-tab-control"
              title="Bu tarayıcıda sonraki girişte açılacak sekme"
            >
              <span>Varsayılan Sekme</span>
              <select
                aria-label="Varsayılan Sekme"
                value={defaultTab}
                onChange={(e) => setOpeningTab(e.target.value)}
              >
                {allowedDefaultTabs(user).map((id) => (
                  <option key={id} value={id}>
                    {TAB_LABELS[id as keyof typeof TAB_LABELS]}
                  </option>
                ))}
              </select>
            </label>
            <div className="mastglobalactions">
              {isAdmin && (
                <>
                  <button
                    className="button"
                    onClick={() =>
                      exportBackup().catch((e) => setError(e.message))
                    }
                  >
                    Veri Yedeği İndir
                  </button>
                  <label className="button">
                    Yedek Yükle
                    <input
                      hidden
                      type="file"
                      accept=".json"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (
                          !confirm(
                            "Sunucudaki mevcut planlama verileri yedekteki verilerle değiştirilecek. Devam edilsin mi?",
                          )
                        )
                          return;
                        try {
                          await restoreBackup(f);
                          await load();
                          setNotice("Yedek yüklendi");
                          setCells([]);
                          setResourceIds([]);
                        } catch (err) {
                          setError((err as Error).message);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </>
              )}
              <button
                className="button"
                onClick={async () => {
                  try {
                    await logout();
                    location.reload();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Çıkış
              </button>
            </div>
          </div>
        </div>
      </header>
      <main>
        {fullPlan && (
          <div className="full-plan-header">
            <div>
              <strong>AA Planlanan Kaynak Dağılımı</strong>
              <span>Geniş Çalışma Alanı</span>
            </div>
            <div className="full-plan-header-actions">
              <button
                type="button"
                className="button"
                onClick={toggleBrowserFullscreen}
              >
                {browserFullScreen ? (
                  <Minimize2 size={15} />
                ) : (
                  <Maximize2 size={15} />
                )}{" "}
                {browserFullScreen ? "Ekran görünümünden çık" : "Ekranı kapla"}
              </button>
              <a className="button" href="/">
                Normal Görünüme Dön
              </a>
            </div>
          </div>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
            <button onClick={() => setError("")}>Kapat</button>
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <div className="workspace-nav">
            <TabsList
              ref={mainTabsRef}
              className="navtabs"
              variant="line"
              aria-label="Ana sekmeler"
            >
              {(isAdmin || isManager || user?.role === "normal") && (
                <TabsTrigger value="actual">
                  <CalendarDays />
                  {TAB_LABELS.actual}
                </TabsTrigger>
              )}
              {(isAdmin || isManager) && (
                <TabsTrigger value="plan">
                  <CalendarDays />
                  {TAB_LABELS.plan}
                </TabsTrigger>
              )}
              <TabsTrigger value="projects">
                <FolderKanban />
                {TAB_LABELS.projects}
              </TabsTrigger>
              <TabsTrigger value="risk">
                <ShieldAlert />
                {TAB_LABELS.risk}
              </TabsTrigger>
              {(isAdmin || isManager) && (
                <TabsTrigger value="critical">
                  <FolderKanban />
                  {TAB_LABELS.critical}
                </TabsTrigger>
              )}
              {(isAdmin || isManager) && (
                <TabsTrigger value="overview">
                  <Layers3 />
                  {TAB_LABELS.overview}
                </TabsTrigger>
              )}
              {isAdmin && (
                <>
                  <TabsTrigger value="teams">
                    <Users />
                    {TAB_LABELS.teams}
                  </TabsTrigger>
                  <TabsTrigger value="resources">
                    <Users />
                    {TAB_LABELS.resources}
                  </TabsTrigger>
                  <TabsTrigger value="access">
                    <Users />
                    {TAB_LABELS.access}
                  </TabsTrigger>
                </>
              )}
            </TabsList>
            {!["access", "teams", "critical", "risk"].includes(tab) && (
              <div className="workspace-nav-actions">
                {["plan", "actual", "projects", "overview"].includes(tab) && (
                  <label className="densitycontrol">
                    Görünüm
                    <select
                      aria-label="Takvim yoğunluğu"
                      value={density}
                      onChange={(e) => {
                        const mode = e.target.value as typeof density;
                        setDensity(mode);
                        if (mode === "overview") setCount(60);
                      }}
                    >
                      <option value="detail">Ayrıntılı</option>
                      <option value="compact">Kompakt</option>
                      <option value="overview">5 Yıllık Genel Bakış</option>
                    </select>
                  </label>
                )}
                {tab === "plan" && (
                  <Tabs value={view} onValueChange={setView}>
                    <TabsList
                      className="plan-view-switch"
                      aria-label="Dağılım görünümü"
                    >
                      <TabsTrigger value="team">Takım → Projeler</TabsTrigger>
                      <TabsTrigger value="project">
                        Proje → Takımlar
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
                {tab === "projects" && isAdmin && (
                  <button
                    className="button project-create"
                    onClick={() => openProject()}
                  >
                    <Plus size={17} />
                    Yeni Proje Ekle
                  </button>
                )}
                <button
                  className="button"
                  onClick={() => {
                    try {
                      if (tab === "projects")
                        downloadProjects(
                          projects,
                          months,
                          density,
                          projectWeekly,
                        );
                      else if (tab === "overview") exportResourceReport();
                      else if (tab === "plan" && data)
                        downloadPlannedAllocations(
                          data,
                          teams,
                          projects,
                          months,
                        );
                      else if (tab === "actual" && data)
                        downloadActualAllocations(
                          data,
                          teams,
                          projects,
                          months,
                          currentMonth,
                          isAdmin || isManager
                            ? personIds
                            : [user?.resourceId || ""],
                        );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                  disabled={
                    !data ||
                    (tab === "overview" && !teams.length) ||
                    (tab === "projects" && !projects.length)
                  }
                >
                  <ArrowDownToLine size={17} />
                  {tab === "projects"
                    ? "Proje Raporunu İndir"
                    : tab === "overview"
                      ? "Kaynak Raporu İndir"
                      : "Excel'e Aktar"}
                </button>
              </div>
            )}
          </div>
          {!data ? (
            <div className="loading">
              Kaynak planınız açılıyor…{" "}
              <button onClick={load}>Tekrar Dene</button>
            </div>
          ) : (
            <>
              {!["access", "teams", "critical", "risk"].includes(tab) && (
                <>
                  <div
                    className="planning-filterbar"
                    role="group"
                    aria-label="Planlama filtreleri"
                  >
                    <div className="filterbar-title">
                      <SlidersHorizontal size={16} aria-hidden="true" />
                      <span>Filtreler</span>
                    </div>
                    <div className="filters" key={filterResetKey}>
                      {tab !== "projects" && (
                        <Picker
                          label="Liderlik"
                          value={leads}
                          onChange={(v) => {
                            setLeads(v);
                            setTeamIds((old) =>
                              old.filter(
                                (id) =>
                                  !v.length ||
                                  v.includes(
                                    data.teams.find((t) => t.id === id)?.lead ||
                                      "",
                                  ),
                              ),
                            );
                          }}
                          items={leaderItems}
                        />
                      )}
                      {tab !== "projects" && (
                        <Picker
                          label="Takım / Birim"
                          value={teamIds}
                          onChange={setTeamIds}
                          items={availableTeams.map((t) => ({
                            ...t,
                            name: t.name,
                          }))}
                        />
                      )}
                      {tab !== "resources" && tab !== "overview" && (
                        <Picker
                          label="Proje"
                          value={projectIds}
                          onChange={setProjectIds}
                          items={data.projects}
                        />
                      )}
                      {tab === "actual" && (isAdmin || isManager) && (
                        <Picker
                          label="Kişi"
                          value={personIds}
                          onChange={setPersonIds}
                          items={availablePeople}
                        />
                      )}
                      <label className="pick">
                        <span>Başlangıç Ayı</span>
                        <input
                          type="month"
                          min={MIN_PLANNING_MONTH}
                          max={MAX_FILTER_START}
                          value={start}
                          onChange={(e) => {
                            if (
                              validPlanningMonth(e.target.value) &&
                              e.target.value >= MIN_PLANNING_MONTH &&
                              e.target.value <= MAX_FILTER_START
                            )
                              setStart(e.target.value);
                          }}
                        />
                      </label>
                      {tab !== "resources" && (
                        <label className="pick period">
                          <span>Görünür Dönem</span>
                          <select
                            value={count}
                            onChange={(e) => {
                              setCount(Number(e.target.value));
                              if (
                                Number(e.target.value) !== 60 &&
                                density === "overview"
                              )
                                setDensity("detail");
                            }}
                          >
                            {periods.map((n) => (
                              <option key={n} value={n}>
                                {n < 12
                                  ? "6 ay"
                                  : n / 12 + " yıl (" + n + " ay)"}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className="filteractions">
                      <button
                        className="button resetfilters"
                        title="Tüm seçimleri ve aramaları temizler; varsayılan döneme döner."
                        onClick={resetFilters}
                      >
                        Filtreleri Sıfırla
                      </button>
                      {tab === "plan" && isAdmin && (
                        <button
                          className="button deletebutton"
                          disabled={
                            saving ||
                            !Object.values(data.allocations).some(
                              (v) => v !== 0,
                            )
                          }
                          onClick={resetAll}
                        >
                          Tüm Dağılımları Sıfırla
                        </button>
                      )}
                    </div>
                  </div>
                  {tab === "plan" && (
                    <div className="filteractions plan-filter-options">
                      <label className="bulk-toggle">
                        <Switch
                          checked={showAllActual}
                          onCheckedChange={(v) => {
                            setShowAllActual(v);
                            setExpandedActualTeams([]);
                          }}
                        />
                        Gerçekleşen Dağılım Göster
                      </label>
                    </div>
                  )}
                  {tab === "projects" && (
                    <div className="project-details-toolbar">
                      <label className="project-details-toggle">
                        <Switch
                          checked={showProjectDetails}
                          onCheckedChange={setShowProjectDetails}
                        />
                        Detayları Göster
                      </label>
                      <label className="project-details-toggle project-week-toggle">
                        <Switch
                          checked={projectWeekly}
                          onCheckedChange={setProjectWeekly}
                          aria-label="Haftalık proje görünümü"
                        />
                        Haftalık Görünüm
                      </label>
                      {projectWeekly && (
                        <span className="project-week-hint">
                          {isAdmin
                            ? "Detay kutusunu basılı tutup taşıyın; uçlarından günlük adımlarla genişletip daraltın."
                            : "Detay açıklamalar kendi haftalarında gösterilir; gerçek tarihleri kutularda görünür."}
                        </span>
                      )}
                    </div>
                  )}
                  {notice && (
                    <div className="filterline">
                      <span role="status">{notice}</span>
                    </div>
                  )}
                </>
              )}
              {(isAdmin || isManager) && tab === "plan" && (
                <TabsContent value="plan">
                  <section className="panel">
                    {view === "project" && (
                      <details
                        className="capacitystrip"
                        open={showCapacity}
                        onToggle={(e) => setShowCapacity(e.currentTarget.open)}
                      >
                        <summary>
                          <span
                            className="capacitystrip-icon"
                            aria-hidden="true"
                          >
                            <Layers3 size={18} />
                          </span>
                          <span className="capacitystrip-copy">
                            <strong>
                              Filtrelenen Takımlar Özet Kaynak Raporu
                            </strong>
                            <span
                              className="capacity-filter-list"
                              aria-label="Özet kaynak raporunda uygulanan filtreler"
                            >
                              {capacityFilters.map(
                                ({ label, values, active }) => (
                                  <span
                                    key={label}
                                    className={
                                      "capacity-filter-chip" +
                                      (active ? " is-active" : "")
                                    }
                                    title={
                                      label +
                                      ": " +
                                      (values.length
                                        ? values.join(", ")
                                        : "Tümü")
                                    }
                                  >
                                    <span>{label}</span>
                                    <strong>
                                      {values.length
                                        ? values.join(", ")
                                        : "Tümü"}
                                    </strong>
                                  </span>
                                ),
                              )}
                            </span>
                          </span>
                          <span
                            className="capacitystrip-action"
                            aria-hidden="true"
                          >
                            {showCapacity ? "Detayı Gizle" : "Detayı Göster"}
                            <ChevronDown size={17} />
                          </span>
                        </summary>
                        {showCapacity && (
                          <Table
                            ref={capacityTableRef}
                            todayDate={todayDate}
                            todayMonthsKey={months.join("|")}
                            className="matrix planning-grid allocation-grid"
                            style={{
                              width:
                                planningLabelWidth +
                                months.length * planMonthWidth,
                              minWidth: "100%",
                            }}
                          >
                            {monthColumns(
                              planningLabelWidth,
                              0,
                              planMonthWidth,
                            )}
                            <TableHeader>
                              {yearRow()}
                              <TableRow>
                                <TableHead>Kaynak</TableHead>
                                {months.map(monthHead)}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {summary(teams, months, true)}
                            </TableBody>
                          </Table>
                        )}
                      </details>
                    )}
                    <Pager
                      total={teams.length * projects.length}
                      page={effectivePlanPage}
                      size={planPageSize}
                      onChange={setPlanPage}
                      label="Takım / proje satırı"
                    />
                    <Table
                      ref={planTableRef}
                      todayDate={todayDate}
                      todayMonthsKey={months.join("|")}
                      className={
                        "matrix planning-grid allocation-grid" +
                        (view === "project" ? " project-team-view" : "")
                      }
                      style={{
                        width:
                          planningLabelWidth + months.length * planMonthWidth,
                        minWidth: "100%",
                      }}
                    >
                      {monthColumns(planningLabelWidth, 0, planMonthWidth)}
                      <TableHeader>
                        {yearRow()}
                        <TableRow>
                          <TableHead>
                            {view === "team"
                              ? "Takım / Proje"
                              : "Proje / Takım"}
                          </TableHead>
                          {months.map(monthHead)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {view === "team"
                          ? planGroups.map((g) => {
                              const t = teams[g.outer];
                              return (
                                <Fragment key={t.id}>
                                  <TableRow className="group">
                                    <TableCell colSpan={months.length + 1}>
                                      <div className="team-group-label">
                                        <button
                                          className="actual-expand"
                                          type="button"
                                          aria-label={
                                            t.name +
                                            " gerçekleşen dağılımı " +
                                            (actualVisible(t.id)
                                              ? "gizle"
                                              : "göster")
                                          }
                                          aria-expanded={actualVisible(t.id)}
                                          onClick={() => toggleActual(t.id)}
                                        >
                                          {actualVisible(t.id) ? "−" : "+"}
                                        </button>
                                        <div>
                                          <div className="team-heading">
                                            <strong
                                              title={
                                                t.lead ||
                                                "Liderlik eşleştirilmemiş"
                                              }
                                            >
                                              {t.name}
                                            </strong>
                                            {teamMemberBadge(t)}
                                          </div>
                                          <span>
                                            Yönetici:{" "}
                                            {t.managerName || "Atanmamış"}
                                          </span>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  {g.inners.map((i) =>
                                    allocationRow(t, projects[i]),
                                  )}
                                  {summary([t])}
                                </Fragment>
                              );
                            })
                          : planGroups.map((g) => {
                              const p = projects[g.outer];
                              return (
                                <Fragment key={p.id}>
                                  <TableRow className="group project-phase-group">
                                    <TableCell className="project-group-name">
                                      <strong>{p.name}</strong>
                                      <ProjectResponsible project={p} />
                                      <span>
                                        {p.start} — {p.end}
                                      </span>
                                    </TableCell>
                                    {months.map((m) => (
                                      <TableCell key={m}>
                                        {phase(p, m)}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                  {g.inners.map((i) =>
                                    allocationRow(teams[i], p),
                                  )}
                                  <TableRow className="summary s2">
                                    <TableCell>
                                      Bu projeye tahsis · seçili takımlar
                                    </TableCell>
                                    {months.map((m) => (
                                      <TableCell
                                        key={m}
                                        title={
                                          monthLabel(m) +
                                          ": " +
                                          fmt(
                                            projectTotals[p.id + "|" + m] || 0,
                                          )
                                        }
                                      >
                                        {fmt(
                                          projectTotals[p.id + "|" + m] || 0,
                                        )}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                </Fragment>
                              );
                            })}
                      </TableBody>
                    </Table>
                    {(!teams.length || !projects.length) && (
                      <p className="emptymsg">
                        Bu filtrelere uygun takım veya proje yok.
                      </p>
                    )}
                    <footer className="tablefoot">
                      <span>
                        Birim: aylık kişi eşdeğeri · Ondalık giriş: 0,5
                      </span>
                      <span>
                        Fareyle sürükleyerek aralık seçin; sağ tıkla kopyalayıp
                        yapıştırın. Proje dönemi dışına giriş yapılamaz.
                      </span>
                    </footer>
                  </section>
                </TabsContent>
              )}
              {tab === "projects" && (
                <TabsContent value="projects">
                  <section className="panel">
                    <Pager
                      total={projects.length}
                      page={effectiveProjectPage}
                      size={20}
                      onChange={setProjectPage}
                      label="Proje"
                    />
                    <Table
                      todayDate={todayDate}
                      todayMonthsKey={projectPeriods
                        .map((period) => period.key)
                        .join("|")}
                      className={
                        "matrix projectmatrix planning-grid" +
                        (projectWeekly ? " weekly-projectmatrix" : "")
                      }
                      style={{
                        width:
                          projectLabelWidth +
                          projectPeriods.length * projectPeriodWidth,
                        minWidth: "100%",
                      }}
                    >
                      <colgroup>
                        <col style={{ width: projectLabelWidth }} />
                        {projectPeriods.map((period) => (
                          <col
                            key={period.key}
                            style={{ width: projectPeriodWidth }}
                          />
                        ))}
                      </colgroup>
                      <TableHeader>
                        {yearRow(
                          1,
                          projectPeriods.map((period) => period.year),
                        )}
                        <TableRow>
                          <TableHead>Proje</TableHead>
                          {projectPeriods.map((period) =>
                            period.kind === "month" ? (
                              monthHead(period.month)
                            ) : (
                              <TableHead
                                key={period.key}
                                data-date-start={period.start}
                                data-date-end={period.end}
                                className={
                                  "monthhead weekhead year-band-" +
                                  (projectYearBands.indexOf(period.year) % 6)
                                }
                                title={period.fullLabel}
                              >
                                <span className="week-number">
                                  W{period.weekNumber}
                                </span>
                                <span className="week-range">
                                  {period.label}
                                </span>
                              </TableHead>
                            ),
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects
                          .slice(
                            effectiveProjectPage * 20,
                            (effectiveProjectPage + 1) * 20,
                          )
                          .map((p) => (
                            <ProjectTimelineRows
                              key={p.id}
                              project={p}
                              periods={projectPeriods}
                              density={density}
                              expandAllDetails={showProjectDetails}
                              isAdmin={!!isAdmin}
                              saving={saving}
                              onProjectInfo={() => openProject(p)}
                              onPhaseClick={(m) =>
                                isAdmin
                                  ? openProject(p, m)
                                  : setPhaseDetail({ project: p, month: m })
                              }
                              onPhaseContextMenu={(event, m) =>
                                openPhaseMenu(event, p, m)
                              }
                              onAddMilestone={() => openMilestone(p)}
                              onEditMilestone={(milestone) =>
                                openMilestone(p, milestone)
                              }
                              onDeleteMilestone={(milestone) =>
                                void deleteMilestone(p, milestone)
                              }
                              onMilestoneContextMenu={(
                                event,
                                milestone,
                                rangeIndex,
                              ) =>
                                openMilestoneMenu(
                                  event,
                                  p,
                                  milestone,
                                  rangeIndex,
                                )
                              }
                              onChangeMilestoneRange={(
                                milestone,
                                rangeIndex,
                                mode,
                                days,
                              ) =>
                                changeMilestoneRange(
                                  p,
                                  milestone,
                                  rangeIndex,
                                  mode,
                                  days,
                                )
                              }
                              onChangeMilestoneNote={(
                                milestone,
                                rangeIndex,
                                noteIndex,
                                mode,
                                days,
                              ) =>
                                changeMilestoneNote(
                                  p,
                                  milestone,
                                  rangeIndex,
                                  noteIndex,
                                  mode,
                                  days,
                                )
                              }
                            />
                          ))}
                      </TableBody>
                    </Table>
                    {!projects.length && (
                      <p className="emptymsg">
                        Seçili filtrelere uygun proje bulunamadı.
                      </p>
                    )}
                  </section>
                </TabsContent>
              )}
              {tab === "risk" && (
                <TabsContent value="risk">
                  <RiskManagement
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
                  <section className="panel">
                    <div className="panelhead">
                      <div>
                        <h2>{TAB_LABELS.resources}</h2>
                      </div>
                      <div className="actions resource-toolbar">
                        <input
                          placeholder="İsim, statü veya liderlik ara…"
                          aria-label="Kaynak ara"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                        <button
                          className="button"
                          onClick={() => setShowImport((v) => !v)}
                        >
                          Excel İçe Aktar
                        </button>
                        <button
                          className="button primary"
                          onClick={() => openResource()}
                        >
                          <Plus size={17} />
                          Kaynak Ekle
                        </button>
                      </div>
                    </div>
                    {data.resources.some(
                      (r) => !(versionAt(r, start) || r.versions[0]).team,
                    ) && (
                      <div className="infonote">
                        <Info size={16} />
                        <span>
                          {
                            data.resources.filter(
                              (r) =>
                                !(versionAt(r, start) || r.versions[0]).team,
                            ).length
                          }{" "}
                          kaynak takım ataması bekliyor. Bu kayıtlar takım
                          atanıncaya kadar kapasiteye dahil edilmez. Düzenle
                          veya toplu düzenleme ile güncel takımları atayın.
                        </span>
                      </div>
                    )}
                    {showImport && (
                      <ResourceImportPanel
                        data={data}
                        onClose={() => setShowImport(false)}
                        onSaved={(d, message) => {
                          setData(d);
                          setNotice(message);
                          setError("");
                          setResourceIds([]);
                        }}
                      />
                    )}
                    <div className="bulkbar resource-bulkbar">
                      <label>
                        <input
                          type="checkbox"
                          aria-label="Filtredeki tüm kaynakları seç"
                          checked={
                            visibleResources.length > 0 &&
                            visibleResources.every((r) =>
                              resourceIds.includes(r.id),
                            )
                          }
                          onChange={(e) =>
                            setResourceIds(
                              e.target.checked
                                ? visibleResources.map((r) => r.id)
                                : [],
                            )
                          }
                        />
                        Filtredeki Tüm Kayıtları Seç
                      </label>
                      <span>{resourceIds.length} kayıt seçildi</span>
                      <button
                        className="button primary"
                        disabled={saving || !resourceIds.length}
                        onClick={openBulk}
                      >
                        Seçilenleri Toplu Düzenle
                      </button>
                      <button
                        className="button deletebutton"
                        disabled={saving || !resourceIds.length}
                        onClick={() => deleteResources(resourceIds)}
                      >
                        Seçilenleri Sil
                      </button>
                      <button
                        className="textbutton"
                        onClick={() => setResourceIds([])}
                      >
                        Seçimi Temizle
                      </button>
                    </div>
                    <Table className="resource-table">
                      <TableHeader>
                        <TableRow>
                          {[
                            "Seç",
                            "Ad Soyad",
                            "Liderlik",
                            "Takım",
                            "Statü",
                            "Dahil",
                            "İşbaşı Tarihi",
                            "İşten Ayrılış Tarihi",
                            "",
                          ].map((h, i) => (
                            <TableHead key={i}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleResources
                          .slice(
                            effectiveResourcePage * 50,
                            (effectiveResourcePage + 1) * 50,
                          )
                          .map((r) => {
                            const v = versionAt(r, start) || r.versions[0];
                            return (
                              <TableRow key={r.id}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    aria-label={r.name + " seç"}
                                    checked={resourceIds.includes(r.id)}
                                    onChange={(e) =>
                                      setResourceIds((old) =>
                                        e.target.checked
                                          ? [...old, r.id]
                                          : old.filter((id) => id !== r.id),
                                      )
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <strong>{r.name}</strong>
                                  {!versionAt(r, start) && (
                                    <small className="subline">
                                      İlk kayıt ayı: {v.effective}
                                    </small>
                                  )}
                                </TableCell>
                                <TableCell className="resourceteam">
                                  {v.lead ||
                                    data.teams.find((t) => t.id === v.team)
                                      ?.lead ||
                                    "Eşleştirilmemiş"}
                                </TableCell>
                                <TableCell className="resourceteam">
                                  {data.teams.find((t) => t.id === v.team)
                                    ?.name || "Takım ataması bekliyor"}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={
                                      "badge " +
                                      (v.status.includes("İlan") ? "amber" : "")
                                    }
                                  >
                                    {v.status}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {v.included ? "Evet" : "Hayır"}
                                </TableCell>
                                <TableCell>{fullDateLabel(v.start)}</TableCell>
                                <TableCell>{fullDateLabel(v.end)}</TableCell>
                                <TableCell>
                                  <div className="resourceactions">
                                    <button
                                      className="textbutton"
                                      disabled={saving}
                                      onClick={() => openResource(r)}
                                    >
                                      Düzenle
                                    </button>
                                    <button
                                      className="textbutton deletebutton"
                                      disabled={saving}
                                      aria-label={r.name + " kaydını sil"}
                                      onClick={() => deleteResources([r.id])}
                                    >
                                      Sil
                                    </button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                    <Pager
                      total={visibleResources.length}
                      page={effectiveResourcePage}
                      size={50}
                      onChange={setResourcePage}
                      label="Kaynak"
                    />
                    {!visibleResources.length && (
                      <p className="emptymsg">
                        Bu filtrelere uygun kaynak yok.
                      </p>
                    )}
                  </section>
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
      <>
        {phaseMenu && (
          <>
            <div
              className="phase-menu-backdrop"
              aria-hidden="true"
              onClick={() => setPhaseMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setPhaseMenu(null);
              }}
            />
            <div
              className="phase-menu"
              role="menu"
              aria-label="Aşama metni ve renk işlemleri"
              tabIndex={-1}
              ref={menuRef}
              style={{ left: phaseMenu.x, top: phaseMenu.y }}
            >
              <div className="phase-menu-title">
                {data?.projects.find((p) => p.id === phaseMenu.projectId)?.name}{" "}
                · {monthLabel(phaseMenu.month)}
              </div>
              <button
                type="button"
                role="menuitem"
                disabled={
                  !data?.projects.find((p) => p.id === phaseMenu.projectId)
                    ?.phases[phaseMenu.month]
                }
                onClick={copyPhase}
              >
                <Copy size={15} />
                Metni Kopyala
              </button>
              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={copiedPhase === null || saving}
                  onClick={pastePhase}
                >
                  <ClipboardPaste size={15} />
                  Metni Yapıştır
                </button>
              )}
              <div className="phase-menu-divider" role="separator" />
              <button type="button" role="menuitem" onClick={copyPhaseColor}>
                <Palette size={15} />
                Rengi Kopyala
              </button>
              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={copiedPhaseColor === null || saving}
                  onClick={pastePhaseColor}
                >
                  <PaintBucket size={15} />
                  Rengi Yapıştır
                  {copiedPhaseColor && (
                    <span
                      className="phase-color-swatch"
                      style={{
                        background: phasePalette.find(
                          (c) => c.id === copiedPhaseColor,
                        )?.bg,
                        borderColor: phasePalette.find(
                          (c) => c.id === copiedPhaseColor,
                        )?.border,
                      }}
                    />
                  )}
                </button>
              )}
              <div className="phase-menu-divider" role="separator" />
              <button type="button" role="menuitem" onClick={copyPhaseBundle}>
                <Copy size={15} />
                Metin ve Rengi Kopyala
              </button>
              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={copiedPhaseBundle === null || saving}
                  onClick={pastePhaseBundle}
                >
                  <ClipboardPaste size={15} />
                  Metin ve Rengi Yapıştır
                  {copiedPhaseBundle && (
                    <span
                      className="phase-color-swatch"
                      style={{
                        background: phasePalette.find(
                          (c) => c.id === copiedPhaseBundle.color,
                        )?.bg,
                        borderColor: phasePalette.find(
                          (c) => c.id === copiedPhaseBundle.color,
                        )?.border,
                      }}
                    />
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </>
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
      <>
        {milestoneMenu && (
          <>
            <div
              className="phase-menu-backdrop"
              aria-hidden="true"
              onClick={() => setMilestoneMenu(null)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMilestoneMenu(null);
              }}
            />
            <div
              className="phase-menu"
              role="menu"
              aria-label="Kilometre taşı renk işlemleri"
              tabIndex={-1}
              style={{ left: milestoneMenu.x, top: milestoneMenu.y }}
            >
              <div className="phase-menu-title">
                {
                  data?.projects
                    .find((p) => p.id === milestoneMenu.projectId)
                    ?.milestones?.find(
                      (m) => m.id === milestoneMenu.milestoneId,
                    )?.name
                }
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={copyMilestoneColor}
              >
                <Palette size={15} />
                Rengi Kopyala
              </button>
              {isAdmin && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={copiedPhaseColor === null || saving}
                  onClick={pasteMilestoneColor}
                >
                  <PaintBucket size={15} />
                  Rengi Yapıştır
                  {copiedPhaseColor && (
                    <span
                      className="phase-color-swatch"
                      style={{
                        background: phasePalette.find(
                          (c) => c.id === copiedPhaseColor,
                        )?.bg,
                        borderColor: phasePalette.find(
                          (c) => c.id === copiedPhaseColor,
                        )?.border,
                      }}
                    />
                  )}
                </button>
              )}
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
