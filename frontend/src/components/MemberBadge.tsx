import { monthLabel } from "../format";
export default function MemberBadge({
  label,
  members,
  currentMonth,
}: {
  label: string;
  members: string[];
  currentMonth: string;
}) {
  return (
    <span
      className="team-member-badge"
      tabIndex={0}
      aria-label={label + " · " + members.length + " aktif çalışan"}
      title={members.length ? members.join(", ") : "Bu ay aktif çalışan yok"}
    >
      {members.length}
      <span className="team-member-tooltip" role="tooltip">
        <strong>Aktif Çalışanlar · {monthLabel(currentMonth)}</strong>
        {members.length ? (
          <span className="team-member-names">
            {members.map((name, index) => (
              <span key={index}>{name}</span>
            ))}
          </span>
        ) : (
          <span>Bu ay aktif çalışan yok.</span>
        )}
      </span>
    </span>
  );
}
