// Client-side CSV export for admin tables.

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Guard against spreadsheet formula injection, then quote when needed.
  const guarded = /^[=+\-@\t]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/**
 * Build a CSV from rows and trigger a browser download.
 * `columns` maps header label → field key, preserving order.
 */
export function downloadCsv<T extends Record<string, unknown>>(
  filename: string,
  columns: [label: string, key: keyof T][],
  rows: T[],
): void {
  const header = columns.map(([label]) => escapeCell(label)).join(",");
  const body = rows.map((row) =>
    columns.map(([, key]) => escapeCell(row[key])).join(","),
  );
  const csv = [header, ...body].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
