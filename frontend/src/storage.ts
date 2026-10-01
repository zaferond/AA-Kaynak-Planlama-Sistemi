import type { Change, ChangeKind, ChangeValues } from "../../shared/commands";
export type { Change, ChangeKind, ChangeValues } from "../../shared/commands";
import type { Data } from "./model";
import type { Principal } from "./access";
import type { ImportRow } from "./resource-import";
let principal: Principal | null = null,
  csrf = "",
  generation = -1;
let writeTail: Promise<unknown> = Promise.resolve();
let sessionEpoch = 0;
let latestView: { data: Data; generation: number; user?: Principal } | null =
  null;
export class StaleSessionError extends Error {
  constructor() {
    super("Oturum değişti. Verileri yenileyip tekrar deneyin.");
    this.name = "StaleSessionError";
  }
}
function clearSession() {
  sessionEpoch++;
  principal = null;
  csrf = "";
  generation = -1;
  latestView = null;
}
function expireSession() {
  clearSession();
  window.dispatchEvent(new Event("session-expired"));
}
export const currentUser = () =>
  principal ? structuredClone(principal) : null;
async function api(path: string, body?: unknown) {
  const epoch = sessionEpoch;
  const response = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "X-Requested-With": "KaynakPortal",
            "X-CSRF-Token": csrf,
          },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (epoch !== sessionEpoch) throw new StaleSessionError();
  if (!response.ok) {
    if (response.status === 401) {
      expireSession();
    }
    throw Error(result.error || "Sunucu hatası.");
  }
  // Reads and writes can complete out of order. All consumers receive the newest
  // accepted view; an old response must never replace newer data or permissions.
  if (
    result.data &&
    typeof result.generation === "number" &&
    latestView &&
    result.generation < latestView.generation
  ) {
    return { ...result, ...latestView };
  }
  if (result.user) principal = result.user;
  if (result.csrf) csrf = result.csrf;
  if (result.generation !== undefined) generation = result.generation;
  if (result.data && typeof result.generation === "number") {
    latestView = {
      data: result.data,
      generation: result.generation,
      user: result.user,
    };
  }
  return result;
}
export async function login(
  username: string,
  password: string,
  remember = false,
) {
  clearSession();
  await api("/auth/login", {
    username: username.trim().toLowerCase(),
    password,
    remember,
  });
}
export async function resumeRemembered() {
  try {
    await api("/auth/me");
    return true;
  } catch {
    return false;
  }
}
export async function logout() {
  sessionEpoch++;
  latestView = null;
  generation = -1;
  await api("/auth/logout", {});
  clearSession();
}
export async function readLocal(): Promise<Data> {
  return (await api("/data")).data;
}
export async function checkUpdates() {
  const epoch = sessionEpoch;
  const response = await fetch("/api/version", { credentials: "same-origin" });
  if (epoch !== sessionEpoch) return false;
  if (response.status === 401) {
    expireSession();
    return false;
  }
  if (!response.ok) return false;
  const r = await response.json();
  return epoch === sessionEpoch && r.generation > generation;
}
export async function writeBatch(changes: Change[]): Promise<Data> {
  // Each response contains the complete data snapshot. Preserve request order so
  // quick edits in separate cells cannot replace a newer snapshot with an older one.
  const epoch = sessionEpoch;
  const request = writeTail.then(() => {
    if (epoch !== sessionEpoch) throw new StaleSessionError();
    return api("/changes", { changes });
  });
  writeTail = request.then(
    () => undefined,
    () => undefined,
  );
  return (await request).data;
}
export async function writeLocal<K extends ChangeKind>(
  kind: K,
  id: string,
  value: ChangeValues[K] | null,
  revision: number,
) {
  return writeBatch([{ kind, id, value, revision }]);
}
export async function changeLeader(input: {
  action: "rename" | "update" | "delete";
  name: string;
  newName?: string;
  managerName?: string;
}): Promise<Data> {
  return (await api("/leaders/change", { ...input, generation })).data;
}
export async function resetAllocations(d: Data): Promise<Data> {
  return (
    await api("/allocations/reset", {
      revisions: Object.fromEntries(
        Object.entries(d.revisions).filter(([k]) =>
          k.startsWith("allocation:"),
        ),
      ),
    })
  ).data;
}
export type UserInput = {
  id: string;
  role: "admin" | "manager" | "normal";
  leaders: string[];
  resourceId: string;
  revision: number;
};
export async function saveUser(input: UserInput): Promise<Data> {
  return (await api("/users", input)).data;
}
export async function importResources(
  rows: ImportRow[],
): Promise<{ data: Data; imported: number; skipped: number }> {
  return api("/resources/import", { rows });
}
export async function exportBackup() {
  const result = await api("/backup");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(result)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download =
    "aa-planlama-veri-yedegi-" +
    new Date().toISOString().slice(0, 10) +
    ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function restoreBackup(file: File, _includeUsers = false) {
  if (file.size > 20 * 1024 * 1024)
    throw Error("Yedek en fazla 20 MB olabilir.");
  const input = JSON.parse(await file.text());
  if (input.format === "kaynak-planlama-encrypted-v1")
    throw Error(
      "Eski şifreli yedeği önce kılavuzdaki convert-legacy komutuyla dönüştürün.",
    );
  if (input.format !== "aa-planning-data-v1")
    throw Error("Geçerli bir veri yedeği seçin.");
  return api("/restore", { data: input.data, generation });
}

export async function readAuditLog(
  offset = 0,
  limit = 30,
): Promise<import("../../shared/audit-types").AuditPage> {
  return api("/audit?offset=" + offset + "&limit=" + limit);
}
