import { directoryEmployeeName } from "../access/employee-access-draft";
import {
  resourceRole,
  resourceRoleLabels,
} from "../../../../shared/resource-roles";
import { ownValue } from "../../../../shared/records";
import { Switch } from "@/components/ui/switch";
import { Single } from "../../components/FilterPicker";
import {
  statuses,
  type Data,
  type Team,
  type Version,
  type ResourceRole,
} from "../../model";
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
  const directoryName = directoryEmployeeName(data, editor.account?.form);
  const directoryManaged = directoryName !== undefined;
  const assignmentKind =
    editor.assignmentKind ||
    resourceRole({ teams: data?.teams || [] }, editor.version);
  const startDateLabel =
    editor.version.status === "Aktif İlan" ||
    editor.version.status === "Pasif İlan"
      ? "Tahmini İşbaşı Tarihi"
      : "İşbaşı Tarihi";
  return (
    <>
      <label>
        Ad Soyad
        <input
          maxLength={200}
          autoFocus
          value={directoryName ?? editor.value.name}
          readOnly={directoryManaged}
          aria-readonly={directoryManaged || undefined}
          placeholder={directoryManaged ? "AD kullanıcısı seçin" : undefined}
          title={
            directoryManaged
              ? "Ad Soyad Active Directory tarafından yönetilir."
              : undefined
          }
          onChange={(e) =>
            !directoryManaged &&
            setEditor({
              ...editor,
              value: { ...editor.value, name: e.target.value },
            })
          }
        />
      </label>
      <label>
        Kaynak Rolü
        <select
          aria-label="Kaynak Rolü"
          value={assignmentKind}
          onChange={(event) => {
            const next = event.target.value as ResourceRole;
            setEditor({
              ...editor,
              assignmentKind: next,
              version: {
                ...editor.version,
                assignmentRole: next,
                team:
                  next === "leader"
                    ? ownValue(
                        data?.leadershipUnits,
                        editor.version.lead || "",
                      ) || ""
                    : assignmentKind === "leader"
                      ? ""
                      : editor.version.team,
              },
            });
          }}
        >
          {Object.entries(resourceRoleLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="resource-form-grid">
        <Single
          label="Liderlik"
          compact
          empty={assignmentKind === "leader" ? "Seçin" : "İsteğe bağlı"}
          value={editor.version.lead || ""}
          onChange={(l) =>
            setEditor({
              ...editor,
              version: {
                ...editor.version,
                lead: l,
                team:
                  assignmentKind === "leader"
                    ? ownValue(data?.leadershipUnits, l) || ""
                    : "",
              },
            })
          }
          items={leaderItems}
        />
        {assignmentKind !== "leader" && (
          <Single
            label="Takım"
            compact
            value={editor.version.team}
            onChange={(t) =>
              setEditor({
                ...editor,
                version: {
                  ...editor.version,
                  team: t,
                  lead:
                    data?.teams.find((x) => x.id === t)?.lead ||
                    editor.version.lead ||
                    "",
                },
              })
            }
            items={editTeams
              .filter(
                (t) =>
                  t.kind !== "leadership" &&
                  (!editor.version.lead || t.lead === editor.version.lead),
              )
              .map((t) => ({
                ...t,
                name: t.name + (!t.lead ? " (Bağımsız takım)" : ""),
              }))}
          />
        )}
      </div>
      {assignmentKind === "leader" && (
        <small>
          Takım seçilmez. Bu kaynak seçilen liderliğin doğrudan kaynak satırında
          hesaplanır. Kullanıcı yetkisi ayrıca tanımlanır.
        </small>
      )}
      {editor.version.team &&
        !data?.teams.find((t) => t.id === editor.version.team)?.lead && (
          <small>
            {editor.version.lead
              ? "Bu takım seçtiğiniz liderliğe bağlanacak."
              : "Bu kaynak bağımsız takıma kaydedilecek; liderlik seçimi zorunlu değildir."}
          </small>
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
          {startDateLabel}
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
        İlanlarda Tahmini İşbaşı Tarihi boş başlar; diğer statülerde bu yılın 1
        Ocak günü önerilir. Tarihi değiştirebilirsiniz. İşten Ayrıldı için iki
        tarih, dahil edilen Aktif İlan için Tahmini İşbaşı Tarihi zorunludur.
        İşbaşı ve ayrılış ayları gün oranıyla hesaplanır.
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
