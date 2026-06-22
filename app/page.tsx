"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { EntryInput, MonthSummary, SummaryBucket, WorkEntry } from "@/lib/types";
import { filterEntries, summarize } from "@/lib/summary";

const peopleOptions = ["Leila", "yaozong"];
const projectOptions = ["PE internal", "Burn", "Roam", "Epsilon", "CleanMotion"];

const today = new Date().toISOString().slice(0, 10);
const thisMonth = today.slice(0, 7);

const emptyForm: EntryInput = {
  date: today,
  person: "Leila",
  project: "PE internal",
  hours: 1,
  notes: ""
};

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
  const [activeTab, setActiveTab] = useState<"entry" | "summary">("entry");
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
      setForm({ ...emptyForm, date: form.date, person: form.person, project: form.project });
      setMonth(form.date.slice(0, 7));
      setStatus("已保存到 Upstash");
      setStatusKind("ready");
      setActiveTab("summary");
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
            <h1>项目工作报时</h1>
            <p className="lede">按人员记录项目工作投入，月底自动汇总人员和项目工时。</p>
          </div>
          <div className={`status-pill ${statusKind}`}>{status}</div>
        </header>

        <div className="tabbar" role="tablist" aria-label="工作记录视图">
          <button
            aria-controls="entry-panel"
            aria-selected={activeTab === "entry"}
            className="tab-button"
            id="entry-tab"
            role="tab"
            type="button"
            onClick={() => setActiveTab("entry")}
          >
            报时
          </button>
          <button
            aria-controls="summary-panel"
            aria-selected={activeTab === "summary"}
            className="tab-button"
            id="summary-tab"
            role="tab"
            type="button"
            onClick={() => setActiveTab("summary")}
          >
            月度汇总
          </button>
        </div>

        <div className="workspace">
          {activeTab === "entry" ? (
            <section aria-labelledby="entry-tab" className="panel tab-panel" id="entry-panel" role="tabpanel">
              <div className="panel-header">
                <h2 id="entry-title">新增记录</h2>
                <p>适合手机快速填写，人员和项目使用固定选项。</p>
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
                  <select
                    required
                    value={form.person}
                    onChange={(event) => setForm({ ...form, person: event.target.value })}
                  >
                    {peopleOptions.map((person) => (
                      <option key={person} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>项目</span>
                  <select
                    required
                    value={form.project}
                    onChange={(event) => setForm({ ...form, project: event.target.value })}
                  >
                    {projectOptions.map((project) => (
                      <option key={project} value={project}>
                        {project}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>工作备注</span>
                  <textarea
                    rows={3}
                    placeholder="记录本次工作的主要内容或产出"
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  />
                </label>

                <button className="primary-btn" disabled={isSaving} type="submit">
                  {isSaving ? "保存中" : "保存记录"}
                </button>
              </form>
            </section>
          ) : null}

          {activeTab === "summary" ? (
            <section aria-labelledby="summary-tab" className="panel tab-panel" id="summary-panel" role="tabpanel">
              <div className="panel-header">
                <h2 id="summary-title">月度汇总</h2>
                <p>月底查看总投入，并按人员或项目拆分。</p>
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
                    {peopleOptions.map((person) => (
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
                      </div>
                      {entry.notes ? <p className="entry-note">{entry.notes}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
