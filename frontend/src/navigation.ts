import { currentUser } from "./storage";
const adminDefaultTabs = [
  "actual",
  "activity",
  "plan",
  "projects",
  "risk",
  "critical",
  "overview",
  "teams",
  "resources",
  "access",
] as const;
const managerDefaultTabs = [
  "actual",
  "activity",
  "plan",
  "projects",
  "risk",
  "critical",
  "overview",
] as const;
const normalDefaultTabs = ["actual", "activity", "projects", "risk"] as const;
export const defaultTabKey = (userId: string) =>
  "aa-kaynak-varsayilan-sekme-v1:" + userId;
export function allowedDefaultTabs(
  user: ReturnType<typeof currentUser>,
): readonly string[] {
  return user?.role === "admin"
    ? adminDefaultTabs
    : user?.role === "manager"
      ? managerDefaultTabs
      : normalDefaultTabs;
}
export function readDefaultTab(user: ReturnType<typeof currentUser>) {
  if (!user) return "plan";
  try {
    const stored = localStorage.getItem(defaultTabKey(user.id));
    return stored && allowedDefaultTabs(user).includes(stored)
      ? stored
      : allowedDefaultTabs(user)[0];
  } catch {
    return allowedDefaultTabs(user)[0];
  }
}
