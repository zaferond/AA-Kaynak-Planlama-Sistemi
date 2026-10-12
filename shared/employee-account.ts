export type EmployeePermission =
  | {
      action: "create";
      directoryId: string;
      role: "normal" | "manager";
      leaders: string[];
      resourceId: string;
    }
  | {
      action: "update";
      id: string;
      role: "normal" | "manager";
      leaders: string[];
      resourceId: string;
      revision: number;
      reactivate?: boolean;
    }
  | { action: "revoke"; id: string; revision: number };
