import { useEffect, useRef, useState } from "react";
import type { Data, Team } from "../../model";
import { ownValue } from "../../../../shared/records";
import {
  assertUniqueLeaderName,
  assertUniqueTeamName,
} from "../../../../shared/directory-policy";
import {
  ApiError,
  changeLeader,
  currentGeneration,
  readLocal,
  writeBatch,
  writeLocal,
} from "../../storage";

export type DirectoryKind = "leader" | "team";
type LeaderDraft = {
  kind: "leader";
  originalName: string | null;
  originalManager: string;
  name: string;
  managerName: string;
  generation: number;
};
type TeamDraft = {
  kind: "team";
  original: Team | null;
  value: Team;
  revision: number;
};
type Draft = LeaderDraft | TeamDraft;

function startDraft(data: Data, kind: DirectoryKind, id?: string): Draft {
  if (kind === "leader") {
    const managerName = id ? ownValue(data.leaderManagers, id) || "" : "";
    return {
      kind,
      originalName: id ?? null,
      originalManager: managerName,
      name: id || "",
      managerName,
      generation: currentGeneration(),
    };
  }
  const team = data.teams.find((team) => team.id === id);
  return {
    kind,
    original: team ? { ...team } : null,
    value: team
      ? { ...team }
      : {
          id: "team_" + crypto.randomUUID(),
          name: "",
          lead: "",
          managerName: "",
          excelCapacity: 0,
          catalog: true,
        },
    revision: team ? data.revisions["team:" + team.id] || 0 : 0,
  };
}

export function useDirectoryEditor({
  data,
  onSaved,
  onEditingChange,
}: {
  data: Data;
  onSaved: (data: Data, message: string) => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [kind, setKind] = useState<DirectoryKind | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const saving = useRef(false);
  const dirty =
    !!draft &&
    (draft.kind === "leader"
      ? draft.name !== (draft.originalName || "") ||
        draft.managerName !== draft.originalManager
      : draft.value.name !== (draft.original?.name || "") ||
        draft.value.lead !== (draft.original?.lead || "") ||
        (draft.value.managerName || "") !==
          (draft.original?.managerName || ""));
  const selectedId =
    draft?.kind === "leader" ? draft.originalName : draft?.original?.id;

  useEffect(() => {
    onEditingChange?.(!!kind);
    return () => onEditingChange?.(false);
  }, [kind, onEditingChange]);

  function mayLeave() {
    return (
      !saving.current &&
      (!dirty ||
        window.confirm(
          "Kaydedilmemiş değişiklikleri bırakmak istiyor musunuz?",
        ))
    );
  }
  function open(nextKind: DirectoryKind, id?: string) {
    if (!mayLeave()) return;
    setKind(nextKind);
    setDraft(id ? startDraft(data, nextKind, id) : null);
    setError("");
    setConflict(false);
  }
  function choose(id?: string) {
    if (!kind || !mayLeave()) return;
    setDraft(startDraft(data, kind, id));
    setError("");
    setConflict(false);
  }
  function close() {
    if (!mayLeave()) return;
    setKind(null);
    setDraft(null);
    setError("");
  }
  function update(field: "name" | "managerName" | "lead", value: string) {
    if (saving.current) return;
    setDraft((previous) => {
      if (!previous) return previous;
      if (previous.kind === "team")
        return { ...previous, value: { ...previous.value, [field]: value } };
      return field === "lead" ? previous : { ...previous, [field]: value };
    });
  }
  async function run(action: () => Promise<void>) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    setConflict(false);
    try {
      await action();
    } catch (cause) {
      setError((cause as Error).message);
      setConflict(cause instanceof ApiError && cause.status === 409);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (!draft) return;
    const current = draft;
    await run(async () => {
      let next: Data, id: string, name: string;
      if (current.kind === "leader") {
        name = current.name.trim();
        if (!name) throw Error("Liderlik adı boş olamaz.");
        assertUniqueLeaderName(
          data.leaders || [],
          name,
          current.originalName ?? undefined,
        );
        next = await changeLeader({
          action: current.originalName === null ? "create" : "update",
          name: current.originalName ?? name,
          newName: current.originalName === null ? undefined : name,
          managerName: current.managerName.trim(),
          generation: current.generation,
        });
        id = name;
      } else {
        const value = {
          ...current.value,
          name: current.value.name.trim(),
          managerName: (current.value.managerName || "").trim(),
        };
        if (!value.name) throw Error("Takım adı boş olamaz.");
        if (value.lead && !data.leaders?.includes(value.lead))
          throw Error("Liderlik bulunamadı. Güncel listeyi yükleyin.");
        assertUniqueTeamName(data.teams, value);
        next = await writeLocal("team", value.id, value, current.revision);
        id = value.id;
        name = value.name;
      }
      onSaved(next, name + " kaydedildi.");
      setDraft(startDraft(next, current.kind, id));
    });
  }
  async function remove() {
    if (!draft || !selectedId || saving.current) return;
    const current = draft;
    const name =
      current.kind === "leader"
        ? current.originalName!
        : current.original!.name;
    const teams =
      current.kind === "leader"
        ? data.teams.filter((team) => team.lead === name).length
        : 0;
    if (
      !window.confirm(
        name +
          " silinsin mi?" +
          (teams ? ` Bağlı ${teams} kullanılmayan takım da silinecek.` : "") +
          " Çalışan, dağılım veya kullanıcı yetkilerinde kullanılan kayıtlar silinemez.",
      )
    )
      return;
    await run(async () => {
      const next =
        current.kind === "leader"
          ? await changeLeader({
              action: "delete",
              name,
              generation: current.generation,
            })
          : await writeBatch([
              {
                kind: "team",
                id: current.value.id,
                value: null,
                operation: "delete",
                revision: current.revision,
              },
            ]);
      onSaved(next, name + " silindi.");
      setDraft(null);
    });
  }
  async function reload() {
    if (!mayLeave()) return;
    await run(async () => {
      const next = await readLocal();
      onSaved(next, "Liderlik ve takım listesi güncellendi.");
      const exists =
        kind === "leader"
          ? next.leaders?.includes(selectedId || "")
          : next.teams.some((team) => team.id === selectedId);
      setDraft(
        kind && selectedId && exists
          ? startDraft(next, kind, selectedId)
          : null,
      );
    });
  }
  return {
    kind,
    draft,
    selectedId,
    dirty,
    busy,
    error,
    conflict,
    open,
    choose,
    close,
    update,
    save,
    remove,
    reload,
  };
}
