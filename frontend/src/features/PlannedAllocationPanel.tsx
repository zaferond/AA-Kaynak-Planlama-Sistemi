import Pager from "../Pager";
import PlannedCapacitySummary from "./planned-allocation/PlannedCapacitySummary";
import PlannedAllocationTable from "./planned-allocation/PlannedAllocationTable";
import type { PlannedAllocationProps } from "./planned-allocation/types";
export default function PlannedAllocationPanel(props: PlannedAllocationProps) {
  const { view, teams, projects, page, pageSize, onPageChange } = props;
  return (
    <section className="panel">
      {view === "project" && <PlannedCapacitySummary {...props} />}
      <Pager
        total={teams.length * projects.length}
        page={page}
        size={pageSize}
        onChange={onPageChange}
        label="Takım / proje satırı"
      />
      <PlannedAllocationTable {...props} />
      {(!teams.length || !projects.length) && (
        <p className="emptymsg">Bu filtrelere uygun takım veya proje yok.</p>
      )}
      <footer className="tablefoot">
        <span>Birim: aylık kişi eşdeğeri · Ondalık giriş: 0,5</span>
        <span>
          Fareyle sürükleyerek aralık seçin; sağ tıkla kopyalayıp yapıştırın.
          Proje dönemi dışına giriş yapılamaz.
        </span>
      </footer>
    </section>
  );
}
