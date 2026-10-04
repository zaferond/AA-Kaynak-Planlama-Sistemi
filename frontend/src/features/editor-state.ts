import type { Project, Milestone, Resource, Version } from "../model";
export type EditorRevisions = Readonly<Record<string, number>>;
export type PortalEditor = (
  | { kind: "project"; value: Project; isNew: boolean }
  | { kind: "projectPhase"; value: Project; phaseMonth: string }
  | {
      kind: "milestone";
      value: Milestone;
      projectId: string;
      isNew: boolean;
      draftEmpty: boolean;
    }
  | { kind: "resource"; value: Resource; version: Version; isNew: boolean }
  | {
      kind: "bulkResources";
      effective: string;
      team: string;
      lead: string;
      status: string;
      included: "keep" | "yes" | "no";
    }
) & { baseRevisions: EditorRevisions };
