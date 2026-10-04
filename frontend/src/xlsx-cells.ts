export const spreadsheetNamespace =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
export const EXCEL_MAX_CELL_CHARACTERS = 32767;
export const EXCEL_MAX_CELL_LINE_BREAKS = 253;
export const EXCEL_MAX_ROWS = 1048576;

export function assertExcelRowCount(rows: number): void {
  if (!Number.isSafeInteger(rows) || rows < 1 || rows > EXCEL_MAX_ROWS)
    throw Error(
      "Excel satır sınırı aşıldı. Daha az proje veya çalışan seçerek tekrar aktarın.",
    );
}

/** Validate only cell contents, never XML markup or formula definitions. */
export function excelCellText(value: unknown): string {
  const text = String(value ?? "");
  if (
    text.length > EXCEL_MAX_CELL_CHARACTERS ||
    (text.match(/\r\n?|\n/g) || []).length > EXCEL_MAX_CELL_LINE_BREAKS
  )
    throw Error(
      "Excel hücre sınırı aşıldı. Metni daha kısa satırlara ayırarak tekrar aktarın.",
    );
  return escapeXml(text);
}

export function excelTextLines(text: string, width = 65): number {
  return text
    .split(/\r\n?|\n/)
    .reduce(
      (total, line) => total + Math.max(1, Math.ceil(line.length / width)),
      0,
    );
}

/** Lossless continuation rows; no inserted newlines and no split surrogate pairs. */
export function splitExcelText(
  text: string,
  width = 65,
  maxLines = 25,
): string[] {
  if (
    !Number.isInteger(width) ||
    width < 1 ||
    !Number.isInteger(maxLines) ||
    maxLines < 2 ||
    maxLines > 25
  )
    throw Error("Geçersiz Excel metin yerleşimi.");
  const chunks: string[] = [];
  let chunk = "",
    lines = 1,
    column = 0;
  for (const character of text) {
    const lineBreak = character === "\n" || character === "\r";
    const nextColumn = lineBreak ? 0 : column + character.length;
    const nextLines = lines + (lineBreak || nextColumn > width ? 1 : 0);
    if (
      chunk &&
      (nextLines > maxLines ||
        chunk.length + character.length > EXCEL_MAX_CELL_CHARACTERS)
    ) {
      chunks.push(chunk);
      chunk = "";
      lines = 1;
      column = 0;
    }
    chunk += character;
    if (lineBreak) {
      lines++;
      column = 0;
    } else if (column + character.length > width) {
      lines++;
      column = character.length;
    } else column += character.length;
  }
  if (chunk || !chunks.length) chunks.push(chunk);
  return chunks;
}
export function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("\r", "&#13;");
}
export function columnName(index: number): string {
  if (!Number.isInteger(index) || index < 0)
    throw Error("Geçersiz Excel sütunu.");
  let label = "";
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26))
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  return label;
}
