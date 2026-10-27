// CSV for Excel on a Kazakh or Russian locale.
//
// Three details that are easy to get wrong, and each one costs a teacher a
// confusing afternoon:
//   • the separator is `;`, because Excel on those locales uses `,` as the
//     decimal mark and therefore will not split a comma-separated file;
//   • numbers are written with a `,` decimal mark for the same reason — `0.75`
//     arrives as text there, `0,75` as a number;
//   • a leading BOM, without which the Cyrillic headers open as mojibake.
//
// Names come from user-entered profile fields, so a cell that begins with `=`,
// `+`, `-` or `@` is prefixed with an apostrophe: otherwise a student who
// registered as `=HYPERLINK(...)` would turn the teacher's export into a
// formula (CSV injection).

export type Cell = string | number | null | undefined;

const SEPARATOR = ";";

function cell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    text = String(value).replace(".", ",");
  } else {
    text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  }
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows to the text of a CSV file (no BOM — see downloadCsv). */
export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(cell).join(SEPARATOR)).join("\r\n");
}

/** Saves `rows` as a file the browser downloads. Browser only. */
export function downloadCsv(filename: string, rows: Cell[][]): void {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
