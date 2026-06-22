import type { MonthSummary, SummaryBucket, WorkEntry } from "@/lib/types";

function monthOf(date: string) {
  return date.slice(0, 7);
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function bucketBy(entries: WorkEntry[], field: keyof Pick<WorkEntry, "person" | "project">) {
  const map = new Map<string, SummaryBucket>();

  for (const entry of entries) {
    const name = String(entry[field]);
    const current = map.get(name) ?? { name, hours: 0, count: 0 };
    current.hours = roundHours(current.hours + entry.hours);
    current.count += 1;
    map.set(name, current);
  }

  return Array.from(map.values()).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name, "zh-CN"));
}

export function filterEntries(entries: WorkEntry[], month: string, person = "全部") {
  return entries.filter((entry) => monthOf(entry.date) === month && (person === "全部" || entry.person === person));
}

export function summarize(entries: WorkEntry[]): MonthSummary {
  return {
    totalHours: roundHours(entries.reduce((sum, entry) => sum + entry.hours, 0)),
    entryCount: entries.length,
    people: bucketBy(entries, "person"),
    projects: bucketBy(entries, "project")
  };
}
