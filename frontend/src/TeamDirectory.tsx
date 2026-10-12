import { directoryTree } from "../../shared/directory-tree";
import { directoryResponsibilityIndex } from "../../shared/resource-roles";
import { ownValue } from "../../shared/records";
import React, { useState } from "react";
import { Building2, Users } from "lucide-react";
import type { Data } from "./model";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import DirectoryManagementDialog from "./features/team-directory/DirectoryManagementDialog";
import { useDirectoryEditor } from "./features/team-directory/useDirectoryEditor";

export default function TeamDirectory({
  data,
  onSaved,
  canEdit,
  onEditingChange,
}: {
  data: Data;
  onSaved: (data: Data, message: string) => void;
  canEdit: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const responsibility = directoryResponsibilityIndex(data);
  const [query, setQuery] = useState("");
  const editor = useDirectoryEditor({ data, onSaved, onEditingChange });
  const groups = directoryTree(data, query);
  return (
    <section className="panel team-directory">
      <div className="panelhead">
        <div>
          <h2>Organizasyon Yapısı</h2>
          <p className="directory-summary">
            {data.leaders?.length || 0} liderlik ·{" "}
            {data.teams.filter((team) => team.kind !== "leadership").length}{" "}
            takım
          </p>
        </div>
        <div className="actions resource-toolbar directory-toolbar">
          <input
            type="search"
            aria-label="Liderlik veya takım ara"
            placeholder="Liderlik veya takım ara…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {canEdit && (
            <div className="directory-management-actions">
              <button
                type="button"
                className="button"
                onClick={() => editor.open("leader")}
              >
                <Building2 size={15} /> Liderlikleri Yönet
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => editor.open("team")}
              >
                <Users size={15} /> Takımları Yönet
              </button>
            </div>
          )}
        </div>
      </div>
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
          {groups.map(({ lead, parent, depth, teams }) => (
            <React.Fragment key={lead}>
              <TableRow
                className={
                  "directory-group" +
                  (parent ? " directory-child-leadership" : "")
                }
                data-depth={depth}
              >
                <TableCell>
                  <span
                    className="directory-indent"
                    style={{ paddingLeft: depth * 18 }}
                  >
                    {parent && <span aria-hidden="true">↳ </span>}
                    <strong>{lead || "Liderlik Eşleştirilmemiş"}</strong>
                  </span>
                  <small>{teams.length} takım</small>
                </TableCell>
                <TableCell>
                  {parent ? (
                    <>
                      <strong>Alt Liderlik</strong>
                      <small>Bağlı olduğu liderlik · {parent}</small>
                    </>
                  ) : (
                    "Liderlik"
                  )}
                </TableCell>
                <TableCell>
                  {ownValue(responsibility.leaders, lead) || "—"}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="directory-actions">
                      {lead && (
                        <button
                          type="button"
                          className="button"
                          aria-label={lead + " liderliğini düzenle"}
                          onClick={() => editor.open("leader", lead)}
                        >
                          Düzenle
                        </button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
              {teams.map((team) => (
                <TableRow
                  key={team.id}
                  className={
                    "directory-team" + (parent ? " directory-nested-team" : "")
                  }
                  data-directory-lead={lead}
                  data-depth={depth + 1}
                  style={
                    {
                      "--directory-indent": `${depth * 18}px`,
                    } as React.CSSProperties
                  }
                >
                  <TableCell>{lead || "—"}</TableCell>
                  <TableCell>
                    <span
                      className="directory-indent"
                      style={{ paddingLeft: depth * 18 }}
                    >
                      {parent && <span aria-hidden="true">↳ </span>}
                      <strong>{team.name}</strong>
                    </span>
                  </TableCell>
                  <TableCell>
                    {ownValue(responsibility.teams, team.id) || "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="directory-actions">
                        <button
                          type="button"
                          className="button"
                          aria-label={team.name + " takımını düzenle"}
                          onClick={() => editor.open("team", team.id)}
                        >
                          Düzenle
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      {!groups.length && (
        <p className="emptymsg">Aramanıza uygun liderlik veya takım yok.</p>
      )}
      {canEdit && <DirectoryManagementDialog data={data} editor={editor} />}
    </section>
  );
}
