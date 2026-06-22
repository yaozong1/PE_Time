export type WorkEntry = {
  id: string;
  date: string;
  person: string;
  project: string;
  hours: number;
  notes: string;
  createdAt: string;
};

export type EntryInput = Omit<WorkEntry, "id" | "createdAt">;

export type SummaryBucket = {
  name: string;
  hours: number;
  count: number;
};

export type MonthSummary = {
  totalHours: number;
  entryCount: number;
  people: SummaryBucket[];
  projects: SummaryBucket[];
};
