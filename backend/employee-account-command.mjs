import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { admin, fail, hashPassword, token } from "./auth.mjs";
import { stageChanges } from "./operations.mjs";
import {
  accountInput,
  permissionInput,
  revokePermissionInput,
  createEmployeeAccount,
  updatePermissions,
  revokePermissions,
} from "./user-commands.mjs";
const permission = z.discriminatedUnion("action", [
  accountInput.extend({ action: z.literal("create") }).strict(),
  permissionInput
    .extend({
      action: z.literal("update"),
      role: z.enum(["normal", "manager"]),
      resourceId: z.string().min(1).max(120),
    })
    .strict(),
  revokePermissionInput.extend({ action: z.literal("revoke") }).strict(),
]);
const change = z
  .object({
    kind: z.enum(["resource", "team"]),
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/),
    value: z.unknown(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
const inputSchema = z
  .object({ changes: z.array(change).min(1).max(2), permission })
  .strict();
/** One transaction owns employee edits, identity linkage, session revocation and audit.
 * Resolve AD before taking the SQL lock; recheck identity/employee revisions inside it.
 */
export async function saveEmployeeRecord(store, actor, body, directory) {
  admin(actor);
  const input = inputSchema.parse(body),
    account = input.permission;
  const resources = input.changes.filter((c) => c.kind === "resource");
  if (resources.length !== 1 || !resources[0].value)
    fail(400, "Tek bir çalışan kaydı seçin.");
  const resourceId = resources[0].id;
  if (account.action !== "revoke" && account.resourceId !== resourceId)
    fail(400, "Hesap ve çalışan kaydı eşleşmiyor.");
  let person, password;
  if (account.action === "create") {
    person = await directory.getUser(account.directoryId);
    if (!person)
      fail(
        400,
        "AD kullanıcısı bulunamadı, pasif veya izin verilen kapsam dışında.",
      );
    password = await hashPassword(token());
  }
  const { action, ...payload } = account;
  const view = await store.mutate(
    actor,
    async (data, active, session) => {
      admin(active);
      if (action !== "create") {
        const old = await store.findUser({ id: payload.id }, session);
        if (!old) fail(404, "Kullanıcı bulunamadı.");
        if (
          old.role === "admin" ||
          (old.resourceId && old.resourceId !== resourceId) ||
          (action === "revoke" && old.resourceId !== resourceId)
        )
          fail(403, "Bu hesap seçilen çalışan üzerinden yönetilemez.");
      }
      const teamChange = input.changes.find((c) => c.kind === "team");
      if (teamChange) {
        const old = data.teams.find((t) => t.id === teamChange.id);
        const next = teamChange.value;
        if (
          !old ||
          old.lead ||
          !next?.lead ||
          !isDeepStrictEqual(next, { ...old, lead: next.lead }) ||
          !resources[0].value.versions?.some(
            (v) => v.team === old.id && v.lead === next.lead,
          )
        )
          fail(
            400,
            "Yalnız çalışanın eşleştirilmemiş takımına liderlik atanabilir.",
          );
      }
      stageChanges(data, active, input.changes);
    },
    {
      auditUsers: true,
      returnView: true,
      afterPersist: async (data, active, session) => {
        if (action === "create")
          await createEmployeeAccount(
            store,
            data,
            active,
            session,
            payload,
            person,
            password,
          );
        else if (action === "update")
          await updatePermissions(store, data, active, session, payload);
        else await revokePermissions(store, active, session, payload);
      },
    },
  );
  return view;
}
