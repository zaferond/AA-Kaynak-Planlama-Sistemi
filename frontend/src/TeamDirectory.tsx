import { ownValue } from "../../shared/records";
import React, { useState } from "react";
import { Building2, Users } from "lucide-react";
import type { Data, Team } from "./model";
import { fold } from "./model";
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
  const [query, setQuery] = useState("");
  const editor = useDirectoryEditor({ data, onSaved, onEditingChange });
  const leaders = [
    ...new Set([
      ...(data.leaders || []),
      ...data.teams.map((team) => team.lead),
    ]),
  ];
  const matches = (lead: string, team: Team) =>
    fold(
      lead +
        " " +
        (ownValue(data.leaderManagers, lead) || "") +
        " " +
        team.name +
        " " +
        (team.managerName || ""),
    ).includes(fold(query));
  const groups = leaders
    .map((lead) => ({
      lead,
      teams: data.teams.filter(
        (team) => team.lead === lead && matches(lead, team),
      ),
    }))
    .filter(
      (group) =>
        !query ||
        group.teams.length ||
        fold(
          group.lead + " " + (ownValue(data.leaderManagers, group.lead) || ""),
        ).includes(fold(query)),
    );
  return (
    <section className="panel team-directory">
      <div className="panelhead">
        <div>
          <h2>Liderlik ve Takımlar</h2>
          <p className="directory-summary">
            {data.leaders?.length || 0} liderlik · {data.teams.length} takım
          </p>
        </div>
        <div className="directory-toolbar">
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
          {groups.map(({ lead, teams }) => (
            <React.Fragment key={lead}>
              <TableRow className="directory-group">
                <TableCell>
                  <strong>{lead || "Liderlik Eşleştirilmemiş"}</strong>
                  <small>{teams.length} takım</small>
                </TableCell>
                <TableCell>Liderlik</TableCell>
                <TableCell>
                  {ownValue(data.leaderManagers, lead) || "—"}
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
                <TableRow key={team.id} className="directory-team">
                  <TableCell>{lead || "—"}</TableCell>
                  <TableCell>
                    <strong>{team.name}</strong>
                  </TableCell>
                  <TableCell>{team.managerName || "—"}</TableCell>
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
