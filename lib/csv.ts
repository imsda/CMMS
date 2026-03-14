export function csvEscape(value: string | number | boolean | null | undefined) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function buildCsvContent(rows: Array<Array<string | number | boolean | null | undefined>>) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export function buildCsvHref(rows: Array<Array<string | number | boolean | null | undefined>>) {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(buildCsvContent(rows))}`;
}

export function slugifyFilenamePart(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-+|-+$/g, "") || "report";
}
