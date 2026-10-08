import { Building2, Plus, RefreshCw, Save, Trash2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { fold, type Data } from "../../model";
import { ownValue } from "../../../../shared/records";
import type { useDirectoryEditor } from "./useDirectoryEditor";

export default function DirectoryManagementDialog({
  data,
  editor,
}: {
  data: Data;
  editor: ReturnType<typeof useDirectoryEditor>;
}) {
  const { kind, draft, selectedId, dirty, busy, error, conflict } = editor;
  const [query, setQuery] = useState("");
  useEffect(() => setQuery(""), [kind]);
  const leaderMode = kind === "leader";
  const label = leaderMode ? "liderlik" : "takım";
  const rows = (
    leaderMode
      ? (data.leaders || []).map((name) => ({
          id: name,
          name,
          detail:
            ownValue(data.leaderManagers, name) || "Yönetici belirtilmedi",
        }))
      : data.teams.map((team) => ({
          id: team.id,
          name: team.name,
          detail: team.lead || "Liderlik eşleştirilmemiş",
        }))
  )
    .filter((row) => fold(row.name + " " + row.detail).includes(fold(query)))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  const isNew =
    draft?.kind === "leader" ? draft.originalName === null : !draft?.original;
  const name = draft?.kind === "leader" ? draft.name : draft?.value.name || "";
  const manager =
    draft?.kind === "leader"
      ? draft.managerName
      : draft?.kind === "team"
        ? draft.value.managerName || ""
        : "";
  return (
    <Dialog
      open={!!kind}
      onOpenChange={(open) => {
        if (!open) editor.close();
      }}
    >
      <DialogContent className="directory-dialog" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>
            {leaderMode ? <Building2 size={20} /> : <Users size={20} />}
            {leaderMode ? "Liderlik Yönetimi" : "Takım Yönetimi"}
          </DialogTitle>
          <DialogDescription>
            Listeden bir kayıt seçin veya yeni {label} ekleyin. Kaydedilen
            tanımlar seçim listelerinde kullanılacaktır.
          </DialogDescription>
        </DialogHeader>
        <div className="directory-manager-body">
          <aside className="directory-manager-list">
            <div className="directory-manager-list-header">
              <strong>{leaderMode ? "Liderlikler" : "Takımlar"}</strong>
              <span>{rows.length}</span>
            </div>
            <input
              type="search"
              aria-label={
                leaderMode ? "Liderlik listesinde ara" : "Takım listesinde ara"
              }
              placeholder={leaderMode ? "Liderlik ara…" : "Takım ara…"}
              value={query}
              disabled={busy}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="button primary directory-new-button"
              disabled={busy}
              onClick={() => editor.choose()}
            >
              <Plus size={15} />{" "}
              {leaderMode ? "Yeni Liderlik Ekle" : "Yeni Takım Ekle"}
            </button>
            <div
              className="directory-manager-records"
              aria-label={leaderMode ? "Liderlik listesi" : "Takım listesi"}
            >
              {rows.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  disabled={busy}
                  className={
                    "directory-record" +
                    (selectedId === row.id ? " selected" : "")
                  }
                  aria-label={
                    (leaderMode ? "Liderlik: " : "Takım: ") + row.name
                  }
                  aria-pressed={selectedId === row.id}
                  onClick={() => editor.choose(row.id)}
                >
                  <strong>{row.name}</strong>
                  <small>{row.detail}</small>
                </button>
              ))}
              {!rows.length && (
                <p className="directory-manager-empty">Kayıt bulunamadı.</p>
              )}
            </div>
          </aside>
          <div className="directory-manager-details">
            {draft ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void editor.save();
                }}
              >
                <fieldset disabled={busy}>
                  <legend>
                    {isNew ? "Yeni " : "Seçili "}
                    {leaderMode ? "Liderlik" : "Takım"}
                  </legend>
                  <label htmlFor="directory-name">
                    {leaderMode ? "Liderlik Adı" : "Takım Adı"}
                  </label>
                  <input
                    id="directory-name"
                    value={name}
                    maxLength={200}
                    required
                    placeholder={
                      leaderMode ? "Liderlik adını yazın" : "Takım adını yazın"
                    }
                    onChange={(event) =>
                      editor.update("name", event.target.value)
                    }
                  />
                  {draft.kind === "team" && (
                    <>
                      <label htmlFor="directory-leader">Liderlik</label>
                      <select
                        id="directory-leader"
                        value={draft.value.lead}
                        onChange={(event) =>
                          editor.update("lead", event.target.value)
                        }
                      >
                        <option value="">Liderlik Eşleştirilmemiş</option>
                        {(data.leaders || []).map((leader) => (
                          <option key={leader} value={leader}>
                            {leader}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <label htmlFor="directory-manager">
                    {leaderMode ? "Liderlik Yöneticisi" : "Takım Yöneticisi"}
                  </label>
                  <input
                    id="directory-manager"
                    value={manager}
                    maxLength={200}
                    placeholder="Yönetici adı (isteğe bağlı)"
                    onChange={(event) =>
                      editor.update("managerName", event.target.value)
                    }
                  />
                  <div className="directory-manager-form-actions">
                    {!isNew && (
                      <button
                        type="button"
                        className="button directory-remove"
                        onClick={() => void editor.remove()}
                      >
                        <Trash2 size={15} />{" "}
                        {leaderMode ? "Liderliği Sil" : "Takımı Sil"}
                      </button>
                    )}
                    <button
                      type="submit"
                      className="button primary"
                      disabled={!name.trim() || (!isNew && !dirty)}
                    >
                      <Save size={15} />{" "}
                      {busy
                        ? "Kaydediliyor…"
                        : isNew
                          ? "Ekle"
                          : "Değişiklikleri Kaydet"}
                    </button>
                  </div>
                </fieldset>
              </form>
            ) : (
              <div className="directory-manager-placeholder">
                {leaderMode ? <Building2 size={32} /> : <Users size={32} />}
                <strong>
                  {leaderMode ? "Bir liderlik seçin" : "Bir takım seçin"}
                </strong>
                <span>Düzenlemek için soldaki listeden seçim yapın.</span>
              </div>
            )}
            {error && (
              <p className="alert directory-manager-error" role="alert">
                {error}
              </p>
            )}
            {conflict && (
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => void editor.reload()}
              >
                <RefreshCw size={14} /> Güncel Listeyi Yükle
              </button>
            )}
          </div>
        </div>
        <div className="directory-manager-footer">
          <span>
            Bağlı çalışan, dağılım veya yetki bulunan kayıtlar silinemez.
          </span>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={editor.close}
          >
            Kapat
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
