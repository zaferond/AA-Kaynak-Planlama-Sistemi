import { ownValue } from "../../shared/records";
import React, { useState } from "react";
import type { Data, Team } from "./model";
import { fold } from "./model";
import { changeLeader, writeBatch, writeLocal } from "./storage";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type TeamDraft = {
  id: string;
  name: string;
  lead: string;
  managerName: string;
};

export default function TeamDirectory({
  data,
  onSaved,
  canEdit,
}: {
  data: Data;
  onSaved: (d: Data, message: string) => void;
  canEdit: boolean;
}) {
  const [query, setQuery] = useState("");
  const [teamDraft, setTeamDraft] = useState<TeamDraft | null>(null);
  const [leaderDraft, setLeaderDraft] = useState<{
    name: string;
    newName: string;
    managerName: string;
  } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const leaders = [
    ...new Set([...(data.leaders || []), ...data.teams.map((t) => t.lead)]),
  ];
  const matches = (lead: string, t: Team) =>
    fold(
      lead +
        " " +
        (ownValue(data.leaderManagers, lead) || "") +
        " " +
        t.name +
        " " +
        (t.managerName || ""),
    ).includes(fold(query));
  const groups = leaders
    .map((lead) => ({
      lead,
      teams: data.teams.filter((t) => t.lead === lead && matches(lead, t)),
    }))
    .filter(
      (g) =>
        !query ||
        g.teams.length ||
        fold(
          g.lead + " " + (ownValue(data.leaderManagers, g.lead) || ""),
        ).includes(fold(query)),
    );
  const done = (next: Data, message: string) => {
    setTeamDraft(null);
    setLeaderDraft(null);
    setError("");
    onSaved(next, message);
  };

  async function saveTeam() {
    if (!teamDraft) return;
    const t = data.teams.find((item) => item.id === teamDraft.id);
    if (!t) return;
    const name = teamDraft.name.trim(),
      managerName = teamDraft.managerName.trim();
    if (!name) {
      setError("Takım adı boş olamaz.");
      return;
    }
    setBusy("team:" + t.id);
    setError("");
    try {
      const next = await writeLocal(
        "team",
        t.id,
        { ...t, name, lead: teamDraft.lead, managerName },
        data.revisions["team:" + t.id] || 0,
      );
      done(next, name + " güncellendi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function deleteTeam(t: Team) {
    if (
      !window.confirm(
        t.name +
          " takımını silmek istiyor musunuz? Kullanımda olan takımlar silinemez.",
      )
    )
      return;
    setBusy("team:" + t.id);
    setError("");
    try {
      const next = await writeBatch([
        {
          kind: "team",
          id: t.id,
          value: null,
          operation: "delete",
          revision: data.revisions["team:" + t.id] || 0,
        },
      ]);
      done(next, t.name + " silindi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function saveLeader() {
    if (!leaderDraft) return;
    const { name, newName, managerName } = leaderDraft;
    if (!newName.trim()) {
      setError("Liderlik adı boş olamaz.");
      return;
    }
    setBusy("leader:" + name);
    setError("");
    try {
      const next = await changeLeader({
        action: "update",
        name,
        newName: newName.trim(),
        managerName: managerName.trim(),
      });
      done(next, newName.trim() + " liderliği güncellendi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function deleteLeader(name: string) {
    if (
      !window.confirm(
        name +
          " liderliğini ve kullanımda olmayan bağlı takımları silmek istiyor musunuz?",
      )
    )
      return;
    setBusy("leader:" + name);
    setError("");
    try {
      const next = await changeLeader({ action: "delete", name });
      done(next, name + " liderliği silindi.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="panel team-directory">
      <div className="panelhead">
        <div>
          <h2>Liderlik ve Takımlar</h2>
        </div>
        <input
          type="search"
          aria-label="Liderlik veya takım ara"
          placeholder="Liderlik veya takım ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Liderlik</TableHead>
            <TableHead>Takım / Birim</TableHead>
            <TableHead>Yönetici</TableHead>
            {canEdit && <TableHead>İşlem</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map(({ lead, teams }) => (
            <React.Fragment key={lead}>
              <TableRow className="directory-group">
                <TableCell>
                  {leaderDraft?.name === lead ? (
                    <input
                      aria-label={lead + " yeni liderlik adı"}
                      value={leaderDraft.newName}
                      maxLength={200}
                      onChange={(e) =>
                        setLeaderDraft({
                          ...leaderDraft,
                          newName: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveLeader();
                      }}
                    />
                  ) : (
                    <strong>{lead || "Liderlik Eşleştirilmemiş"}</strong>
                  )}
                  <small>{teams.length} takım</small>
                </TableCell>
                <TableCell>Liderlik</TableCell>
                <TableCell>
                  {leaderDraft?.name === lead ? (
                    <input
                      aria-label={lead + " liderlik yöneticisi"}
                      value={leaderDraft.managerName}
                      maxLength={200}
                      onChange={(e) =>
                        setLeaderDraft({
                          ...leaderDraft,
                          managerName: e.target.value,
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveLeader();
                      }}
                      placeholder="Liderlik yöneticisi adı"
                    />
                  ) : (
                    ownValue(data.leaderManagers, lead) || "—"
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="directory-actions">
                      {leaderDraft?.name === lead ? (
                        <>
                          <button
                            className="button primary"
                            disabled={
                              !!busy ||
                              !leaderDraft.newName.trim() ||
                              (leaderDraft.newName.trim() === lead &&
                                leaderDraft.managerName.trim() ===
                                  (ownValue(data.leaderManagers, lead) || ""))
                            }
                            onClick={() => void saveLeader()}
                          >
                            Kaydet
                          </button>
                          <button
                            className="button"
                            disabled={!!busy}
                            onClick={() => setLeaderDraft(null)}
                          >
                            Vazgeç
                          </button>
                        </>
                      ) : lead ? (
                        <>
                          <button
                            className="button"
                            disabled={!!busy}
                            onClick={() => {
                              setTeamDraft(null);
                              setLeaderDraft({
                                name: lead,
                                newName: lead,
                                managerName:
                                  ownValue(data.leaderManagers, lead) || "",
                              });
                              setError("");
                            }}
                          >
                            Düzelt
                          </button>
                          <button
                            className="button deletebutton"
                            disabled={!!busy}
                            onClick={() => void deleteLeader(lead)}
                          >
                            Sil
                          </button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                )}
              </TableRow>
              {teams.map((t) => {
                const editing = teamDraft?.id === t.id;
                return (
                  <TableRow key={t.id} className="directory-team">
                    <TableCell>
                      {editing ? (
                        <select
                          aria-label={t.name + " liderliği"}
                          value={teamDraft.lead}
                          onChange={(e) =>
                            setTeamDraft({ ...teamDraft, lead: e.target.value })
                          }
                        >
                          <option value="">Liderlik Eşleştirilmemiş</option>
                          {(data.leaders || []).map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        lead || "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <input
                          aria-label={t.name + " takım adı"}
                          value={teamDraft.name}
                          maxLength={200}
                          onChange={(e) =>
                            setTeamDraft({ ...teamDraft, name: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveTeam();
                          }}
                        />
                      ) : (
                        <strong>{t.name}</strong>
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <input
                          aria-label={t.name + " yöneticisi"}
                          value={teamDraft.managerName}
                          maxLength={200}
                          onChange={(e) =>
                            setTeamDraft({
                              ...teamDraft,
                              managerName: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void saveTeam();
                          }}
                          placeholder="Yönetici adı"
                        />
                      ) : (
                        t.managerName || "—"
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="directory-actions">
                          {editing ? (
                            <>
                              <button
                                className="button primary"
                                disabled={!!busy || !teamDraft.name.trim()}
                                onClick={() => void saveTeam()}
                              >
                                Kaydet
                              </button>
                              <button
                                className="button"
                                disabled={!!busy}
                                onClick={() => setTeamDraft(null)}
                              >
                                Vazgeç
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="button"
                                disabled={!!busy}
                                onClick={() => {
                                  setLeaderDraft(null);
                                  setTeamDraft({
                                    id: t.id,
                                    name: t.name,
                                    lead: t.lead,
                                    managerName: t.managerName || "",
                                  });
                                  setError("");
                                }}
                              >
                                Düzelt
                              </button>
                              <button
                                className="button deletebutton"
                                disabled={!!busy}
                                onClick={() => void deleteTeam(t)}
                              >
                                Sil
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      {!groups.length && (
        <p className="emptymsg">Aramanıza uygun liderlik veya takım yok.</p>
      )}
    </section>
  );
}
