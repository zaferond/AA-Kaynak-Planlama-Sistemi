import type { RefObject } from "react";
import {
  ArrowDownToLine,
  CalendarDays,
  FolderKanban,
  Layers3,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Principal } from "../access";
import { TAB_LABELS } from "../settings";
export type WorkspaceDensity = "detail" | "compact" | "overview";
type Props = {
  user: Principal | null;
  tab: string;
  mainTabsRef: RefObject<HTMLDivElement | null>;
  density: WorkspaceDensity;
  setDensity: (density: WorkspaceDensity) => void;
  setCount: (count: number) => void;
  view: string;
  setView: (view: string) => void;
  openProject: () => void;
  onExport: () => void;
  dataLoaded: boolean;
  hasTeams: boolean;
  hasProjects: boolean;
};
export default function WorkspaceNavigation({
  user,
  tab,
  mainTabsRef,
  density,
  setDensity,
  setCount,
  view,
  setView,
  openProject,
  onExport,
  dataLoaded,
  hasTeams,
  hasProjects,
}: Props) {
  const isAdmin = user?.role === "admin",
    isManager = user?.role === "manager";
  return (
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
        {(isAdmin || isManager || user?.role === "normal") && (
          <TabsTrigger value="activity">
            <CalendarDays />
            {TAB_LABELS.activity}
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
      {!["access", "teams", "critical", "risk", "activity"].includes(tab) && (
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
                <TabsTrigger value="project">Proje → Takımlar</TabsTrigger>
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
            onClick={onExport}
            disabled={
              !dataLoaded ||
              (tab === "overview" && !hasTeams) ||
              (tab === "projects" && !hasProjects)
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
  );
}
