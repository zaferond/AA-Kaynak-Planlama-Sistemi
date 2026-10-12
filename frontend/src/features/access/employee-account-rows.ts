import { selectedLeadershipScope } from "../../../../shared/leadership-planning.ts";
import type { Data, Resource } from "../../model.ts";
import { fold, versionAt } from "../../model.ts";
import type { Account } from "../../access.ts";
import { ROOT_ADMIN_ID } from "../../access.ts";
export const accountRoleLabels = {
  admin: "Admin",
  manager: "Yönetici",
  normal: "Normal Kullanıcı",
} as const;
export type EmployeeAccountRow = {
  key: string;
  resource?: Resource;
  account?: Account;
};
/** Join by resource ID, never by name. Orphan/unlinked accounts remain visible;
 * organisational filters apply to employee rows, not accounts with no assignment. */
export function employeeAccountRows(
  data: Data,
  filters: {
    start: string;
    ids: string[];
    teamIds: string[];
    leads: string[];
    search: string;
  },
): EmployeeAccountRow[] {
  const { start, ids, teamIds, leads, search } = filters;
  const query = fold(search);
  const selectedLeaders = selectedLeadershipScope(data, leads, true);
  const accounts = new Map<string, Account[]>();
  const resourceIds = new Set(data.resources.map((r) => r.id));
  for (const account of data.users || []) {
    if (!account.resourceId || !resourceIds.has(account.resourceId)) continue;
    const existing = accounts.get(account.resourceId) || [];
    existing.push(account);
    accounts.set(account.resourceId, existing);
  }
  const accountText = (a?: Account) =>
    a
      ? [
          a.name,
          a.username,
          a.email || "",
          accountRoleLabels[a.role],
          a.id === ROOT_ADMIN_ID ? "Ana yönetici Sistem Yöneticisi" : "",
        ].join(" ")
      : "";
  const rows: EmployeeAccountRow[] = [];
  for (const resource of data.resources) {
    const v = versionAt(resource, start) || resource.versions[0];
    const linked = accounts.get(resource.id) || [];
    const inScope =
      (ids.includes(v.team) || (!v.team && !teamIds.length)) &&
      (!leads.length ||
        selectedLeaders.has(
          v.lead || data.teams.find((t) => t.id === v.team)?.lead || "",
        ));
    for (const account of linked.length ? linked : [undefined]) {
      if (!inScope && account?.id !== ROOT_ADMIN_ID) continue;
      if (
        !fold(
          [resource.name, v.status, v.lead || "", accountText(account)].join(
            " ",
          ),
        ).includes(query)
      )
        continue;
      rows.push({
        key: account ? "account:" + account.id : "resource:" + resource.id,
        resource,
        account,
      });
    }
  }
  for (const account of data.users || []) {
    if (account.resourceId && resourceIds.has(account.resourceId)) continue;
    if (fold(accountText(account)).includes(query))
      rows.push({ key: "account:" + account.id, account });
  }
  // Keep the protected system account easy to find, without fabricating a resource.
  return rows.sort(
    (a, b) =>
      Number(b.account?.id === ROOT_ADMIN_ID) -
      Number(a.account?.id === ROOT_ADMIN_ID),
  );
}
