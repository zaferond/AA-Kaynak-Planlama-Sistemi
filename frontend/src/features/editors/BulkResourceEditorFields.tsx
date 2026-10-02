import { Single } from "../../components/FilterPicker";
import { monthLabel } from "../../format";
import { statuses, type Data, type Team } from "../../model";
import type { EditorFieldProps } from "./editor-field-props";
type Props = EditorFieldProps<"bulkResources"> & {
  data: Data | null;
  leaderItems: { id: string; name: string }[];
  editTeams: Team[];
  resourceIds: string[];
};
export default function BulkResourceEditorFields({
  editor,
  setEditor,
  data,
  leaderItems,
  editTeams,
  resourceIds,
}: Props) {
  return (
    <>
      <div className="bulk-edit-context">
        <strong>{resourceIds.length} kayıt seçildi</strong>
        <span>{monthLabel(editor.effective)} ayından itibaren</span>
      </div>
      <div className="bulk-edit-grid">
        <Single
          label="Liderlik filtresi"
          value={editor.lead}
          onChange={(l) => setEditor({ ...editor, lead: l, team: "" })}
          items={leaderItems}
          empty="Tüm liderlikler"
        />
        <Single
          label="Yeni takım"
          value={editor.team}
          onChange={(t) =>
            setEditor({
              ...editor,
              team: t,
              lead: data?.teams.find((x) => x.id === t)?.lead || editor.lead,
            })
          }
          items={editTeams
            .filter((t) => !editor.lead || !t.lead || t.lead === editor.lead)
            .map((t) => ({
              ...t,
              name: t.name + (!t.lead ? " (liderlik seçilmeli)" : ""),
            }))}
          empty="Takımı değiştirme"
        />
        <Single
          label="Yeni statü"
          value={editor.status}
          onChange={(s) =>
            setEditor({
              ...editor,
              status: s,
              included: s
                ? s === "Aktif İlan" || s === "Pasif İlan"
                  ? "no"
                  : "yes"
                : editor.included,
            })
          }
          items={statuses.map((s) => ({ id: s, name: s }))}
          empty="Statüyü değiştirme"
        />
        <label>
          Kaynak planlamasına dahil
          <select
            value={editor.included}
            onChange={(e) =>
              setEditor({
                ...editor,
                included: e.target.value as "keep" | "yes" | "no",
              })
            }
          >
            <option value="keep">Değiştirme</option>
            <option value="yes">Evet</option>
            <option value="no">Hayır</option>
          </select>
        </label>
      </div>
      <p className="bulk-edit-hint">
        Değiştirmediğiniz alanlar korunur. Aktif İlanı plana dahil etmek için
        İşbaşı Tarihi gerekir.
      </p>
    </>
  );
}
