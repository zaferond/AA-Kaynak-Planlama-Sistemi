import type { Dispatch, SetStateAction } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  PLANNING_PERIODS as periods,
  MIN_PLANNING_MONTH,
  MAX_FILTER_START,
  validPlanningMonth,
} from "../../../shared/planning-dates";
import { Picker } from "../components/FilterPicker";
import type { Data, Team } from "../model";
import type { Principal } from "../access";
import type { WorkspaceDensity } from "./WorkspaceNavigation";
type SelectionSetter = Dispatch<SetStateAction<string[]>>;
type Props = {
  data: Data;
  user: Principal | null;
  tab: string;
  leads: string[];
  setLeads: (values: string[]) => void;
  teamIds: string[];
  setTeamIds: SelectionSetter;
  projectIds: string[];
  setProjectIds: (values: string[]) => void;
  personIds: string[];
  setPersonIds: (values: string[]) => void;
  leaderItems: { id: string; name: string }[];
  availableTeams: Team[];
  availablePeople: { id: string; name: string }[];
  start: string;
  setStart: (start: string) => void;
  count: number;
  setCount: (count: number) => void;
  density: WorkspaceDensity;
  setDensity: (density: WorkspaceDensity) => void;
  filterResetKey: number;
  resetFilters: () => void;
  saving: boolean;
  resetAll: () => Promise<void>;
  showAllActual: boolean;
  setShowAllActual: (show: boolean) => void;
  setExpandedActualTeams: SelectionSetter;
  showProjectDetails: boolean;
  setShowProjectDetails: (show: boolean) => void;
  projectWeekly: boolean;
  setProjectWeekly: (show: boolean) => void;
  notice: string;
};
export default function WorkspaceFilters({
  data,
  user,
  tab,
  leads,
  setLeads,
  teamIds,
  setTeamIds,
  projectIds,
  setProjectIds,
  personIds,
  setPersonIds,
  leaderItems,
  availableTeams,
  availablePeople,
  start,
  setStart,
  count,
  setCount,
  density,
  setDensity,
  filterResetKey,
  resetFilters,
  saving,
  resetAll,
  showAllActual,
  setShowAllActual,
  setExpandedActualTeams,
  showProjectDetails,
  setShowProjectDetails,
  projectWeekly,
  setProjectWeekly,
  notice,
}: Props) {
  const isAdmin = user?.role === "admin",
    isManager = user?.role === "manager";
  return (
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
                            data.teams.find((t) => t.id === id)?.lead || "",
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
                        {n < 12 ? "6 ay" : n / 12 + " yıl (" + n + " ay)"}
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
                    !Object.values(data.allocations).some((v) => v !== 0)
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
    </>
  );
}
