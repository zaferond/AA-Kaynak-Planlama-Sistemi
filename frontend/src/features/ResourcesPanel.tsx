import type { Dispatch, SetStateAction } from "react";
import { Info, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Data, Resource } from "../model";
import { fold, versionAt } from "../model";
import { fullDateLabel } from "../format";
import Pager from "../Pager";
import ResourceImportPanel from "../ResourceImportPanel";
import { TAB_LABELS } from "../settings";

type Props = {
  data: Data;
  start: string;
  ids: string[];
  teamIds: string[];
  leads: string[];
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  onPageChange: (page: number) => void;
  resourceIds: string[];
  onSelectionChange: Dispatch<SetStateAction<string[]>>;
  showImport: boolean;
  onImportVisibilityChange: Dispatch<SetStateAction<boolean>>;
  saving: boolean;
  onEdit: (resource?: Resource) => void;
  onBulkEdit: () => void;
  onDelete: (ids: string[]) => Promise<void>;
  onImported: (data: Data, message: string) => void;
};
export default function ResourcesPanel({
  data,
  start,
  ids,
  teamIds,
  leads,
  search,
  onSearchChange: setSearch,
  page: resourcePage,
  onPageChange: setResourcePage,
  resourceIds,
  onSelectionChange: setResourceIds,
  showImport,
  onImportVisibilityChange: setShowImport,
  saving,
  onEdit: openResource,
  onBulkEdit: openBulk,
  onDelete: deleteResources,
  onImported,
}: Props) {
  const visibleResources = data.resources.filter((r) => {
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
  });
  const effectiveResourcePage = Math.min(
    resourcePage,
    Math.max(0, Math.ceil(visibleResources.length / 50) - 1),
  );
  return (
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
          <button className="button" onClick={() => setShowImport((v) => !v)}>
            Excel İçe Aktar
          </button>
          <button className="button primary" onClick={() => openResource()}>
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
                (r) => !(versionAt(r, start) || r.versions[0]).team,
              ).length
            }{" "}
            kaynak takım ataması bekliyor. Bu kayıtlar takım atanıncaya kadar
            kapasiteye dahil edilmez. Düzenle veya toplu düzenleme ile güncel
            takımları atayın.
          </span>
        </div>
      )}
      {showImport && (
        <ResourceImportPanel
          data={data}
          onClose={() => setShowImport(false)}
          onSaved={onImported}
        />
      )}
      <div className="bulkbar resource-bulkbar">
        <label>
          <input
            type="checkbox"
            aria-label="Filtredeki tüm kaynakları seç"
            checked={
              visibleResources.length > 0 &&
              visibleResources.every((r) => resourceIds.includes(r.id))
            }
            onChange={(e) =>
              setResourceIds(
                e.target.checked ? visibleResources.map((r) => r.id) : [],
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
        <button className="textbutton" onClick={() => setResourceIds([])}>
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
            .slice(effectiveResourcePage * 50, (effectiveResourcePage + 1) * 50)
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
                      data.teams.find((t) => t.id === v.team)?.lead ||
                      "Eşleştirilmemiş"}
                  </TableCell>
                  <TableCell className="resourceteam">
                    {data.teams.find((t) => t.id === v.team)?.name ||
                      "Takım ataması bekliyor"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        "badge " + (v.status.includes("İlan") ? "amber" : "")
                      }
                    >
                      {v.status}
                    </span>
                  </TableCell>
                  <TableCell>{v.included ? "Evet" : "Hayır"}</TableCell>
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
        <p className="emptymsg">Bu filtrelere uygun kaynak yok.</p>
      )}
    </section>
  );
}
