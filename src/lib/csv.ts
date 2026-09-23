// Robust CSV: one parser and one writer used by every CSV import/export in
// the app — a receipt review table, a recipe's ingredients, a grocery list —
// so they all round-trip through the same rules instead of several
// near-identical regexes each getting the edge cases slightly wrong.
//
// Follows RFC 4180 with the relaxations real-world spreadsheet exports rely
// on: any of \r\n, \n or \r as a line break — including one embedded inside a
// quoted field, which a single-line splitter can never handle — a leading
// UTF-8 BOM stripped automatically, and ragged rows tolerated rather than
// thrown out.

export type CsvRow = string[];

/**
 * Parse CSV text into rows of cells. Never throws — a malformed file still
 * comes back as whatever rows could be made of it, because a review screen
 * should show a person their mistake, not a stack trace.
 */
export function parseCsv(text: string): CsvRow[] {
  if (!text) return [];
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  const rows: CsvRow[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  // True once any real content (a char, a comma, a quote) has landed in the
  // current row — lets a lone trailing newline at EOF not become an empty row.
  let started = false;

  const endCell = () => { row.push(cell); cell = ""; };
  const endRow = () => { endCell(); rows.push(row); row = []; started = false; };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") { quoted = true; started = true; continue; }
    if (ch === ",") { endCell(); started = true; continue; }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && s[i + 1] === "\n") i++; // treat \r\n as one break
      if (started || cell !== "" || row.length > 0) endRow();
      continue;
    }
    cell += ch;
    started = true;
  }
  if (started || cell !== "" || row.length > 0) endRow();
  return rows;
}

/** Quote a cell only when it needs it (contains a comma, quote, or line
 *  break), so the output stays readable in a plain-text diff. */
function escapeCell(raw: unknown): string {
  if (raw == null) return "";
  const cell = String(raw);
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Rows of cells → CSV text. The inverse of `parseCsv` for any input it can
 *  produce — round-tripping through both is the standard this file is held to. */
export function stringifyCsv(rows: CsvRow[]): string {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\n");
}

/** Lower-case, alphanumeric-only header text, so "Calories / Unit", "cal per
 *  unit" and "CaloriesPerUnit" all match the same alias. */
export function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Map parsed CSV rows onto named fields by a tolerant header lookup, rather
 * than a fixed column order — so a file re-exported from Excel with columns
 * reordered, or missing an optional one, still reads correctly.
 *
 * `headerAliases` gives each canonical field the (already-normalized) header
 * spellings that count as it. The first row is always treated as the header.
 * A short row is padded with "" rather than dropped, so one missing trailing
 * cell doesn't lose the rest of the row.
 */
export function csvToRecords<K extends string>(
  rows: CsvRow[],
  headerAliases: Record<K, readonly string[]>,
): { header: Partial<Record<K, number>>; records: Record<K, string>[] } {
  if (rows.length === 0) return { header: {}, records: [] };
  const headerCells = rows[0].map(normalizeHeader);
  const header: Partial<Record<K, number>> = {};
  for (const key of Object.keys(headerAliases) as K[]) {
    const aliases = headerAliases[key];
    const idx = headerCells.findIndex((h) => aliases.includes(h));
    if (idx !== -1) header[key] = idx;
  }
  const records: Record<K, string>[] = [];
  for (const row of rows.slice(1)) {
    if (row.every((c) => c.trim() === "")) continue; // a blank line between blocks
    const rec = {} as Record<K, string>;
    for (const key of Object.keys(headerAliases) as K[]) {
      const idx = header[key];
      rec[key] = idx !== undefined ? (row[idx] ?? "").trim() : "";
    }
    records.push(rec);
  }
  return { header, records };
}
