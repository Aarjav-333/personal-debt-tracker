/**
 * Minimal RFC 4180 CSV writer.
 *
 * Exports are meant as an off-site backup of financial records, so the
 * escaping matters: a borrower called O'Brien, a note containing a comma, or
 * a reason spanning two lines must all survive a round trip into a spreadsheet.
 */

export type CsvValue = string | number | null | undefined;

/** Plain decimal numbers, which must reach the spreadsheet untouched. */
const NUMERIC = /^-?\d+(\.\d+)?$/;

/** Characters that make Excel, LibreOffice and Sheets treat a cell as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  /*
   * A borrower named `=HYPERLINK("http://...","Click")` is a valid name, and
   * these files exist to be opened in a spreadsheet - which would evaluate it.
   * Prefixing an apostrophe forces the cell to text. Real numbers are exempt so
   * amounts still import as numbers.
   */
  if (!NUMERIC.test(text) && FORMULA_START.test(text)) text = `'${text}`;

  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  // CRLF and a UTF-8 BOM keep Excel happy with both line breaks and rupee signs.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvFilename(kind: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `debt-ledger-${kind}-${stamp}.csv`;
}
