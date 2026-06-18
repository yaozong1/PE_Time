"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { EntryInput, MonthSummary, SummaryBucket, WorkCategory, WorkEntry } from "@/lib/types";
import { filterEntries, summarize } from "@/lib/summary";

const categories: WorkCategory[] = ["客户沟通", "市场调研", "方案撰写", "数据分析", "项目管理", "其他"];

const starterPeople = ["王敏", "陈伟", "李娜"];
const starterProjects = ["增长战略", "区域进入", "投后运营"];
const starterMarkets = ["华东", "华南", "东南亚"];

const today = new Date().toISOString().slice(0, 10);
const thisMonth = today.slice(0, 7);

const emptyForm: EntryInput = {
  date: today,
  person: "",
  project: "",
  market: "",
  category: "市场调研",
  hours: 1,
  notes: ""
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function barWidth(bucket: SummaryBucket, buckets: SummaryBucket[]) {
  const max = Math.max(...buckets.map((item) => item.hours), 1);
  return `${Math.max((bucket.hours / max) * 100, 5)}%`;
}

function SummaryBars({ title, buckets }: { title: string; buckets: SummaryBucket[] }) {
  return (
    <section className="summary-section">
      <h3>{title}</h3>
      {buckets.length === 0 ? (
        <p className="entry-note">本月还没有记录</p>
      ) : (
        <div className="bar-list">
          {buckets.map((bucket) => (
            <div className="bar-row" key={bucket.name}>
              <div className="bar-meta">
                <span>{bucket.name}</span>
                <strong>{bucket.hours} 小时</strong>
              </div>
              <div className="bar-track" aria-hidden="true">
                <div className="bar-fill" style={{ width: barWidth(bucket, buckets) }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [form, setForm] = useState<EntryInput>(emptyForm);
  const [month, setMonth] = useState(thisMonth);
  const [personFilter, setPersonFilter] = useState("全部");
  const [status, setStatus] = useState("正在连接数据源...");
  const [statusKind, setStatusKind] = useState<"ready" | "error" | "idle">("idle");
  const [isSaving, setIsSaving] = useState(false);

  async function loadEntries() {
    try {
      const response = await fetch("/api/entries", { cache: "no-store" });
      const data = (await response.json()) as { entries: WorkEntry[]; configured?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "读取失败");
      }

      setEntries(data.entries);
      if (data.configured === false) {
        setStatus("请配置 Upstash 环境变量后开始记录");
        setStatusKind("error");
      } else {
        setStatus("Upstash 已连接");
        setStatusKind("ready");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "数据源连接失败");
      setStatusKind("error");
    }
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  const people = useMemo(() => unique([...starterPeople, ...entries.map((entry) => entry.person)]), [entries]);
  const projects = useMemo(() => unique([...starterProjects, ...entries.map((entry) => entry.project)]), [entries]);
  const markets = useMemo(() => unique([...starterMarkets, ...entries.map((entry) => entry.market)]), [entries]);
  const visibleEntries = useMemo(() => filterEntries(entries, month, personFilter), [entries, month, personFilter]);
  const summary: MonthSummary = useMemo(() => summarize(visibleEntries), [visibleEntries]);

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus("正在保存...");
    setStatusKind("idle");

    try {
      const response = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = (await response.json()) as { entry?: WorkEntry; error?: string };

      if (!response.ok || !data.entry) {
        throw new Error(data.error ?? "保存失败");
      }

      setEntries((current) => [data.entry as WorkEntry, ...current]);
      setForm({ ...emptyForm, date: form.date, person: form.person });
      setMonth(form.date.slice(0, 7));
      setStatus("已保存到 Upstash");
      setStatusKind("ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
      setStatusKind("error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="page">
      <div className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Consulting Work Log</p>
            <h1>项目市场工作记录</h1>
            <p className="lede">按人员记录不同项目和市场的日常工作，月底自动汇总人员、项目、市场和分类投入。</p>
          </div>
          <div className={`status-pill ${statusKind}`}>{status}</div>
        </header>

        <div className="workspace">
          <section className="panel" aria-labelledby="entry-title">
            <div className="panel-header">
              <h2 id="entry-title">新增记录</h2>
              <p>适合手机快速填写，项目和市场可以直接输入新名称。</p>
            </div>
            <form className="entry-form" onSubmit={submitEntry}>
              <div className="two-col">
                <label className="field">
                  <span>日期</span>
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm({ ...form, date: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>工时</span>
                  <input
                    required
                    min="0.25"
                    max="24"
                    step="0.25"
                    type="number"
                    value={form.hours}
                    onChange={(event) => setForm({ ...form, hours: Number(event.target.value) })}
                  />
                </label>
              </div>

              <label className="field">
                <span>人员</span>
                <input
                  required
                  list="people"
                  placeholder="例如：王敏"
                  value={form.person}
                  onChange={(event) => setForm({ ...form, person: event.target.value })}
                />
                <datalist id="people">
                  {people.map((person) => (
                    <option key={person} value={person} />
                  ))}
                </datalist>
              </label>

              <label className="field">
                <span>项目</span>
                <input
                  required
                  list="projects"
                  placeholder="例如：区域进入研究"
                  value={form.project}
                  onChange={(event) => setForm({ ...form, project: event.target.value })}
                />
                <datalist id="projects">
                  {projects.map((project) => (
                    <option key={project} value={project} />
                  ))}
                </datalist>
              </label>

              <label className="field">
                <span>市场</span>
                <input
                  required
                  list="markets"
                  placeholder="例如：华东 / 日本 / SaaS"
                  value={form.market}
                  onChange={(event) => setForm({ ...form, market: event.target.value })}
                />
                <datalist id="markets">
                  {markets.map((market) => (
                    <option key={market} value={market} />
                  ))}
                </datalist>
              </label>

              <label className="field">
                <span>分类</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value as WorkCategory })}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>备注</span>
                <textarea
                  rows={3}
                  placeholder="可记录客户、会议、产出物或关键进展"
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </label>

              <button className="primary-btn" disabled={isSaving} type="submit">
                {isSaving ? "保存中" : "保存记录"}
              </button>
            </form>
          </section>

          <section className="panel" aria-labelledby="summary-title">
            <div className="panel-header">
              <h2 id="summary-title">月度汇总</h2>
              <p>月底看投入结构，支持按人员单独查看。</p>
            </div>
            <div className="filters">
              <label className="field">
                <span>月份</span>
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              </label>
              <label className="field">
                <span>人员筛选</span>
                <select value={personFilter} onChange={(event) => setPersonFilter(event.target.value)}>
                  <option value="全部">全部</option>
                  {people.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="summary-grid">
              <div className="metric">
                <span className="label">总工时</span>
                <span className="value">{summary.totalHours}</span>
              </div>
              <div className="metric">
                <span className="label">记录数</span>
                <span className="value">{summary.entryCount}</span>
              </div>
            </div>

            <SummaryBars title="按人员" buckets={summary.people} />
            <SummaryBars title="按项目" buckets={summary.projects} />
            <SummaryBars title="按市场" buckets={summary.markets} />
            <SummaryBars title="按分类" buckets={summary.categories} />

            <div className="summary-section">
              <h3>明细</h3>
            </div>
            {visibleEntries.length === 0 ? (
              <p className="empty">当前筛选条件下还没有记录。</p>
            ) : (
              <div className="entries">
                {visibleEntries.map((entry) => (
                  <article className="entry-card" key={entry.id}>
                    <div className="entry-title">
                      <span>{entry.project}</span>
                      <span>{entry.hours}h</span>
                    </div>
                    <div className="entry-meta">
                      <span className="tag">{entry.date}</span>
                      <span className="tag">{entry.person}</span>
                      <span className="tag">{entry.market}</span>
                      <span className="tag">{entry.category}</span>
                    </div>
                    {entry.notes ? <p className="entry-note">{entry.notes}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
