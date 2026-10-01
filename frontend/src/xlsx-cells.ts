export const spreadsheetNamespace =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
export function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
export function columnName(index: number): string {
  if (!Number.isInteger(index) || index < 0)
    throw Error("Geçersiz Excel sütunu.");
  let label = "";
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26))
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  return label;
}
