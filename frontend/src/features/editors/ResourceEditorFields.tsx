import { Switch } from "@/components/ui/switch";
import { Single } from "../../components/FilterPicker";
import { fullDateLabel } from "../../format";
import { statuses, type Data, type Team, type Version } from "../../model";
import type { EditorFieldProps } from "./editor-field-props";
type Props = EditorFieldProps<"resource"> & {
  data: Data | null;
  leaderItems: { id: string; name: string }[];
  editTeams: Team[];
  chooseResourceStatus: (status: string) => void;
};
export default function ResourceEditorFields({
  editor,
  setEditor,
  data,
  leaderItems,
  editTeams,
  chooseResourceStatus,
}: Props) {
  return (
    <>
      <label>
        Ad Soyad
        <input
          maxLength={200}
          autoFocus
          value={editor.value.name}
          onChange={(e) =>
            setEditor({
              ...editor,
              value: { ...editor.value, name: e.target.value },
            })
          }
        />
      </label>
      <div className="resource-form-grid">
        <Single
          label="Liderlik"
          value={editor.version.lead || ""}
          onChange={(l) =>
            setEditor({
              ...editor,
              version: { ...editor.version, lead: l, team: "" },
            })
          }
          items={leaderItems}
        />
        <Single
          label="Takım"
          value={editor.version.team}
          onChange={(t) =>
            setEditor({
              ...editor,
              version: {
                ...editor.version,
                team: t,
                lead:
                  data?.teams.find((x) => x.id === t)?.lead ||
                  editor.version.lead,
              },
            })
          }
          items={editTeams
            .filter(
              (t) =>
                !editor.version.lead ||
                !t.lead ||
                t.lead === editor.version.lead,
            )
            .map((t) => ({
              ...t,
              name: t.name + (!t.lead ? " (liderlik atanacak)" : ""),
            }))}
        />
      </div>
      {editor.version.team &&
        !data?.teams.find((t) => t.id === editor.version.team)?.lead && (
          <small>Bu takım seçtiğiniz liderliğe bağlanacak.</small>
        )}
      <div className="resource-form-grid">
        <Single
          label="Statü"
          value={editor.version.status}
          onChange={chooseResourceStatus}
          items={statuses.map((s) => ({ id: s, name: s }))}
        />
        <label>
          Kişi Eşdeğeri
          <input
            type="number"
            min="0"
            max="100"
            step="0.05"
            value={editor.version.amount}
            onChange={(e) =>
              setEditor({
                ...editor,
                version: {
                  ...editor.version,
                  amount: Number(e.target.value),
                },
              })
            }
          />
        </label>
      </div>
      <div className="resource-date-grid">
        <label>
          İşbaşı Tarihi
          <input
            type="date"
            value={editor.version.start}
            onChange={(e) =>
              setEditor({
                ...editor,
                version: {
                  ...editor.version,
                  start: e.target.value,
                },
              })
            }
          />
        </label>
        {editor.version.status === "İşten Ayrıldı" && (
          <label>
            İşten Ayrılış Tarihi
            <input
              type="date"
              value={editor.version.end}
              onChange={(e) =>
                setEditor({
                  ...editor,
                  version: {
                    ...editor.version,
                    end: e.target.value,
                  },
                })
              }
            />
          </label>
        )}
      </div>
      <small>
        İlanlarda İşbaşı Tarihi boş başlar; diğer statülerde bu yılın 1 Ocak
        günü önerilir. Tarihi değiştirebilirsiniz. İşten Ayrıldı için iki tarih,
        dahil edilen Aktif İlan için İşbaşı Tarihi zorunludur. İşbaşı ve ayrılış
        ayları gün oranıyla hesaplanır.
      </small>
      <label className="switchrow">
        <Switch
          checked={editor.version.included}
          onCheckedChange={(v) =>
            setEditor({
              ...editor,
              version: { ...editor.version, included: v },
            })
          }
        />
        Kaynak Planlamasına Dahil
      </label>
      <label>
        İK Notu
        <textarea
          rows={3}
          value={editor.value.note}
          onChange={(e) =>
            setEditor({
              ...editor,
              value: { ...editor.value, note: e.target.value },
            })
          }
        />
      </label>
      <small>
        Değişiklik geçmişi (ay):{" "}
        {editor.value.versions.map((v: Version) => v.effective).join(", ") ||
          "Yeni Kayıt"}
      </small>
    </>
  );
}
