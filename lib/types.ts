export type WorkCategory =
  | "客户沟通"
  | "市场调研"
  | "方案撰写"
  | "数据分析"
  | "项目管理"
  | "其他";

export type WorkEntry = {
  id: string;
  date: string;
  person: string;
  project: string;
  market: string;
  category: WorkCategory;
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
  markets: SummaryBucket[];
  categories: SummaryBucket[];
};
