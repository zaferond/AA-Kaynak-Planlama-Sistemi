import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { Single } from "../components/FilterPicker";
import { fullDateLabel, monthLabel } from "../format";
import {
  milestoneRanges,
  rangeNotes,
  visibleMilestoneBarStyle,
} from "../milestone-ranges";
import MilestoneDateEditor from "../MilestoneDateEditor";
import {
  phasePalette,
  phaseStyle,
  statuses,
  type Data,
  type Team,
  type Version,
} from "../model";
import ProjectResponsible from "../ProjectResponsible";
import type { PortalEditor } from "./editor-state";
type Props = {
  editor: PortalEditor | null;
  setEditor: Dispatch<SetStateAction<PortalEditor | null>>;
  saving: boolean;
  data: Data | null;
  setFormError: Dispatch<SetStateAction<string>>;
  leaderItems: { id: string; name: string }[];
  editTeams: Team[];
  chooseResourceStatus: (status: string) => void;
  resourceIds: string[];
  formError: string;
  deleteEditedMilestone: () => void;
  submit: () => Promise<void>;
  deleteProject: () => Promise<void>;
};
export default function PortalEditorDialog({
  editor,
  setEditor,
  saving,
  data,
  setFormError,
  leaderItems,
  editTeams,
  chooseResourceStatus,
  resourceIds,
  formError,
  deleteEditedMilestone,
  submit,
  deleteProject,
}: Props) {
  return (
    <Dialog
      open={!!editor}
      onOpenChange={(v) => {
        if (!v && !saving) setEditor(null);
      }}
    >
      <DialogContent
        className={
          "editor" +
          (editor?.kind === "projectPhase" || editor?.kind === "milestone"
            ? " timeline-editor"
            : "") +
          (editor?.kind === "bulkResources" ? " bulk-resource-editor" : "")
        }
      >
        <DialogHeader>
          <DialogTitle>
            {editor?.kind === "project"
              ? editor.isNew
                ? "Proje Ekle"
                : "Proje Bilgilerini Düzenle"
              : editor?.kind === "projectPhase"
                ? "Aşamayı Düzenle"
                : editor?.kind === "milestone"
                  ? editor.isNew
                    ? "Kritik Konu Ekle"
                    : "Kritik Konu Düzenle"
                  : editor?.kind === "resource"
                    ? editor.isNew
                      ? "Kaynak Ekle"
                      : "Kaynağı Düzenle"
                    : "Seçilen Kaynakları Toplu Düzenle"}
          </DialogTitle>
          <DialogDescription>
            {editor?.kind === "project"
              ? "Proje adını, sorumlusunu ve çalışma dönemini belirleyin."
              : editor?.kind === "projectPhase"
                ? "Aşama metnini ve takvim rengini güncelleyin."
                : editor?.kind === "milestone"
                  ? "Kritik detay konulara tarih aralığı veya tek tarihli Milestone ekleyin."
                  : editor?.kind === "resource"
                    ? "Çalışan bilgilerini ve işbaşı / ayrılış tarihlerini gün bazında girin."
                    : editor?.kind === "bulkResources"
                      ? "Seçili kayıtların takımını, statüsünü ve planlama durumunu birlikte güncelleyin."
                      : "Düzenlemeler seçili planlama ayından itibaren uygulanır."}
          </DialogDescription>
        </DialogHeader>
        {editor && (
          <div
            className={
              "form" +
              (editor.kind === "resource" ? " resource-editor-form" : "") +
              (editor.kind === "bulkResources" ? " bulk-resource-form" : "") +
              (editor.kind === "projectPhase" || editor.kind === "milestone"
                ? " timeline-editor-form"
                : "")
            }
          >
            {editor.kind === "project" && (
              <>
                <label>
                  Proje Adı
                  <input
                    value={editor.value.name}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        value: { ...editor.value, name: e.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  Proje Sorumlusu
                  <input
                    maxLength={200}
                    value={editor.value.responsibleName || ""}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        value: {
                          ...editor.value,
                          responsibleName: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <div className="formrow">
                  {(["start", "end"] as const).map((k) => (
                    <label key={k}>
                      {k === "start" ? "Başlangıç Ayı" : "Bitiş Ayı"}
                      <input
                        type="month"
                        value={editor.value[k]}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            value: { ...editor.value, [k]: e.target.value },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </>
            )}
            {editor.kind === "projectPhase" && (
              <>
                <div className="phasecontext">
                  <div>
                    <small>PROJE</small>
                    <strong>{editor.value.name}</strong>
                    <ProjectResponsible project={editor.value} />
                  </div>
                  <span>{monthLabel(editor.phaseMonth)}</span>
                </div>
                <label>
                  Aşama Metni
                  <textarea
                    rows={4}
                    autoFocus
                    placeholder="Bu ayın proje aşamasını yazın"
                    value={editor.value.phases[editor.phaseMonth] || ""}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        value: {
                          ...editor.value,
                          phases: {
                            ...editor.value.phases,
                            [editor.phaseMonth]: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </label>
                <fieldset className="timeline-fieldset">
                  <legend>Aşama Rengi</legend>
                  <div className="palette">
                    {phasePalette.map((c) => (
                      <label
                        key={c.id}
                        style={{
                          background: c.bg,
                          color: c.ink,
                          borderColor: c.border,
                        }}
                      >
                        <input
                          type="radio"
                          name="phasecolor"
                          checked={
                            (editor.value.phaseColors?.[editor.phaseMonth] ||
                              (editor.value.phases[editor.phaseMonth]?.trim()
                                ? "blue"
                                : "gray")) === c.id
                          }
                          onChange={() =>
                            setEditor({
                              ...editor,
                              value: {
                                ...editor.value,
                                phaseColors: {
                                  ...editor.value.phaseColors,
                                  [editor.phaseMonth]: c.id,
                                },
                              },
                            })
                          }
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="timeline-live-preview">
                  <span>TAKVİM ÖNİZLEMESİ</span>
                  <div
                    className="timeline-phase-preview"
                    style={phaseStyle(editor.value, editor.phaseMonth)}
                  >
                    {editor.value.phases[editor.phaseMonth] ||
                      "Aşama metni burada görünecek"}
                  </div>
                </div>
              </>
            )}
            {editor.kind === "milestone" && (
              <>
                <div className="phasecontext">
                  <div>
                    <small>PROJE</small>
                    <strong>
                      {
                        data?.projects.find((p) => p.id === editor.projectId)
                          ?.name
                      }
                    </strong>
                    <ProjectResponsible
                      project={data?.projects.find(
                        (p) => p.id === editor.projectId,
                      )}
                    />
                  </div>
                  <span>
                    {
                      data?.projects.find((p) => p.id === editor.projectId)
                        ?.start
                    }{" "}
                    –{" "}
                    {data?.projects.find((p) => p.id === editor.projectId)?.end}
                  </span>
                </div>
                <label>
                  Kritik Konu
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
                <MilestoneDateEditor
                  value={editor.value}
                  isEmpty={!!editor.draftEmpty}
                  projectStart={
                    data!.projects.find((p) => p.id === editor.projectId)!.start
                  }
                  projectEnd={
                    data!.projects.find((p) => p.id === editor.projectId)!.end
                  }
                  onChange={(value, draftEmpty = false) => {
                    setFormError("");
                    setEditor({ ...editor, value, draftEmpty });
                  }}
                />
                <fieldset className="milestone-style">
                  <legend>Bar Görünümü</legend>
                  <div className="milestone-bar-options">
                    {(
                      [
                        ["solid", "Düz"],
                        ["outline", "Çerçeveli"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        type="button"
                        key={id}
                        className={
                          visibleMilestoneBarStyle(editor.value.barStyle) === id
                            ? "selected"
                            : ""
                        }
                        aria-pressed={
                          visibleMilestoneBarStyle(editor.value.barStyle) === id
                        }
                        onClick={() =>
                          setEditor({
                            ...editor,
                            value: { ...editor.value, barStyle: id },
                          })
                        }
                      >
                        <span className={"sample " + id} />
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="timeline-live-preview">
                  <span>TAKVİM ÖNİZLEMESİ</span>
                  <div className="milestone-preview-list">
                    {editor.draftEmpty && (
                      <p className="milestone-preview-empty">
                        Kritik detay konu eklenmedi. Kritik konuyu bu haliyle
                        kaydedebilirsiniz.
                      </p>
                    )}
                    {(editor.draftEmpty
                      ? []
                      : milestoneRanges(editor.value)
                    ).map((range, index) => {
                      const color =
                        phasePalette.find((c) => c.id === range.color) ||
                        phasePalette[3];
                      return (
                        <div key={index}>
                          <small>
                            {index + 1}.{" "}
                            {range.displayKind === "milestone"
                              ? "Milestone"
                              : "Tarih Aralığı"}
                          </small>
                          {range.displayKind === "milestone" ? (
                            <div className="milestone-point-preview">
                              <span
                                className="milestone-diamond"
                                style={{ background: color.border }}
                              />
                              <strong>
                                {rangeNotes(range)[0]?.text ||
                                  editor.value.name}
                              </strong>
                              <small>{fullDateLabel(range.start)}</small>
                            </div>
                          ) : (
                            <div
                              className={
                                "timeline-milestone-preview " +
                                visibleMilestoneBarStyle(editor.value.barStyle)
                              }
                              style={
                                {
                                  "--preview-color": color.border,
                                  "--preview-soft": color.bg,
                                  "--preview-ink": color.ink,
                                } as CSSProperties
                              }
                            >
                              <ul className="milestone-preview-notes">
                                {(rangeNotes(range).filter((note) =>
                                  note.text.trim(),
                                ).length
                                  ? rangeNotes(range)
                                      .filter((note) => note.text.trim())
                                      .map((note) => note.text)
                                  : [editor.value.name || "Kritik Konu"]
                                ).map((text, noteIndex) => (
                                  <li key={noteIndex}>{text}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <small>
                    Her açıklama ve renk kendi tarih aralığının barında
                    gösterilir.
                  </small>
                </div>
              </>
            )}
            {editor.kind === "resource" && (
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
                  !data?.teams.find((t) => t.id === editor.version.team)
                    ?.lead && (
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
                  İlanlarda İşbaşı Tarihi boş başlar; diğer statülerde bu yılın
                  1 Ocak günü önerilir. Tarihi değiştirebilirsiniz. İşten
                  Ayrıldı için iki tarih, dahil edilen Aktif İlan için İşbaşı
                  Tarihi zorunludur. İşbaşı ve ayrılış ayları gün oranıyla
                  hesaplanır.
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
                  {editor.value.versions
                    .map((v: Version) => v.effective)
                    .join(", ") || "Yeni Kayıt"}
                </small>
              </>
            )}
            {editor.kind === "bulkResources" && (
              <>
                <div className="bulk-edit-context">
                  <strong>{resourceIds.length} kayıt seçildi</strong>
                  <span>{monthLabel(editor.effective)} ayından itibaren</span>
                </div>
                <div className="bulk-edit-grid">
                  <Single
                    label="Liderlik filtresi"
                    value={editor.lead}
                    onChange={(l) =>
                      setEditor({ ...editor, lead: l, team: "" })
                    }
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
                        lead:
                          data?.teams.find((x) => x.id === t)?.lead ||
                          editor.lead,
                      })
                    }
                    items={editTeams
                      .filter(
                        (t) =>
                          !editor.lead || !t.lead || t.lead === editor.lead,
                      )
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
                  Değiştirmediğiniz alanlar korunur. Aktif İlanı plana dahil
                  etmek için İşbaşı Tarihi gerekir.
                </p>
              </>
            )}
            {formError && editor.kind !== "milestone" && (
              <p role="alert" className="negative">
                {formError}
              </p>
            )}
            {editor.kind === "projectPhase" ||
            editor.kind === "milestone" ||
            editor.kind === "bulkResources" ? (
              <div
                className={
                  editor.kind === "bulkResources"
                    ? "bulk-edit-actions"
                    : "timeline-editor-actions"
                }
              >
                {editor.kind === "milestone" && formError && (
                  <p role="alert" className="negative timeline-save-error">
                    {formError}
                  </p>
                )}
                {editor.kind === "milestone" && !editor.isNew && (
                  <button
                    type="button"
                    className="button deletebutton milestone-delete-button"
                    disabled={saving}
                    onClick={deleteEditedMilestone}
                  >
                    Kritik Konuyu Sil
                  </button>
                )}
                <button
                  type="button"
                  className="button"
                  disabled={saving}
                  onClick={() => setEditor(null)}
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={saving}
                  onClick={submit}
                >
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            ) : editor.kind === "project" && !editor.isNew ? (
              <div className="project-editor-actions">
                <button
                  type="button"
                  className="button deletebutton"
                  disabled={saving}
                  onClick={deleteProject}
                >
                  Projeyi Sil
                </button>
                <button
                  type="button"
                  className="button primary"
                  disabled={saving}
                  onClick={submit}
                >
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            ) : (
              <button
                className="button primary"
                disabled={saving}
                onClick={submit}
              >
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
