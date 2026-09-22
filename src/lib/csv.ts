/**
 * Minimal RFC 4180 CSV writer.
 *
 * Exports are meant as an off-site backup of financial records, so the
 * escaping matters: a borrower called O'Brien, a note containing a comma, or
 * a reason spanning two lines must all survive a round trip into a spreadsheet.
 */

export type CsvValue = string | number | null | undefined;

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
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
