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

type CurrentUser = {
  username: string;
  createdAt: string;
  isAdmin: boolean;
};

type AuthResponse = {
  user?: CurrentUser;
  error?: string;
  signedIn?: boolean;
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

function personForUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  return peopleOptions.find((person) => person.toLowerCase() === normalized) ?? null;
}

export default function Home() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [canBootstrapAdmin, setCanBootstrapAdmin] = useState(false);
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [newUserForm, setNewUserForm] = useState({ username: "", password: "" });
  const [settingsForm, setSettingsForm] = useState({ username: "", currentPassword: "", newPassword: "" });
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [form, setForm] = useState<EntryInput>(emptyForm);
  const [month, setMonth] = useState(thisMonth);
  const [personFilter, setPersonFilter] = useState("全部");
  const [activeTab, setActiveTab] = useState<"entry" | "summary" | "users" | "settings">("entry");
  const [status, setStatus] = useState("正在检查登录状态...");
  const [statusKind, setStatusKind] = useState<"ready" | "error" | "idle">("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<WorkEntry | null>(null);
  const [isUpdatingEntry, setIsUpdatingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

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

  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await response.json()) as {
        user: CurrentUser | null;
        configured?: boolean;
        canBootstrapAdmin?: boolean;
      };

      setCanBootstrapAdmin(Boolean(data.canBootstrapAdmin));

      if (data.configured === false) {
        setStatus("请配置 Upstash 后创建管理员");
        setStatusKind("error");
        return;
      }

      if (data.user) {
        setUser(data.user);
        syncUserFormDefaults(data.user);
        await loadEntries();
      } else {
        setStatus(data.canBootstrapAdmin ? "请先创建管理员账号" : "请登录后开始报时");
        setStatusKind("idle");
      }
    } catch {
      setStatus("登录状态检查失败");
      setStatusKind("error");
    }
  }

  useEffect(() => {
    void loadCurrentUser();
  }, []);

  const visibleEntries = useMemo(() => filterEntries(entries, month, personFilter), [entries, month, personFilter]);
  const summary: MonthSummary = useMemo(() => summarize(visibleEntries), [visibleEntries]);

  function syncUserFormDefaults(nextUser: CurrentUser) {
    setSettingsForm({ username: nextUser.username, currentPassword: "", newPassword: "" });
    const defaultPerson = personForUsername(nextUser.username);

    if (defaultPerson) {
      setForm((current) => ({ ...current, person: defaultPerson }));
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthenticating(true);
    setStatus(canBootstrapAdmin ? "正在创建管理员..." : "正在登录...");
    setStatusKind("idle");

    try {
      const response = await fetch(canBootstrapAdmin ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm)
      });
      const data = (await response.json()) as AuthResponse;

      if (!response.ok || !data.user) {
        throw new Error(data.error ?? (canBootstrapAdmin ? "创建管理员失败" : "登录失败"));
      }

      setUser(data.user);
      syncUserFormDefaults(data.user);
      setCanBootstrapAdmin(false);
      setAuthForm({ username: "", password: "" });
      setStatus(canBootstrapAdmin ? "管理员账号已创建" : "登录成功");
      setStatusKind("ready");
      await loadEntries();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "认证失败");
      setStatusKind("error");
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function createRegularUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingUser(true);
    setStatus("正在创建用户...");
    setStatusKind("idle");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUserForm)
      });
      const data = (await response.json()) as AuthResponse;

      if (!response.ok || !data.user) {
        throw new Error(data.error ?? "创建用户失败");
      }

      setNewUserForm({ username: "", password: "" });
      setStatus(`已创建用户 ${data.user.username}`);
      setStatusKind("ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "创建用户失败");
      setStatusKind("error");
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsUpdatingProfile(true);
    setStatus("正在更新账号...");
    setStatusKind("idle");

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm)
      });
      const data = (await response.json()) as AuthResponse;

      if (!response.ok || !data.user) {
        throw new Error(data.error ?? "更新账号失败");
      }

      setUser(data.user);
      syncUserFormDefaults(data.user);
      setStatus("账号设置已更新");
      setStatusKind("ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "更新账号失败");
      setStatusKind("error");
    } finally {
      setIsUpdatingProfile(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setEntries([]);
    setActiveTab("entry");
    setStatus("已退出登录");
    setStatusKind("idle");
    await loadCurrentUser();
  }

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

  function startEditEntry(entry: WorkEntry) {
    setEditingEntryId(entry.id);
    setEditForm({ ...entry });
  }

  function cancelEditEntry() {
    setEditingEntryId(null);
    setEditForm(null);
  }

  async function submitEditEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm) {
      return;
    }

    setIsUpdatingEntry(true);
    setStatus("正在更新记录...");
    setStatusKind("idle");

    try {
      const response = await fetch("/api/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      const data = (await response.json()) as { entry?: WorkEntry; error?: string };

      if (!response.ok || !data.entry) {
        throw new Error(data.error ?? "更新记录失败");
      }

      setEntries((current) => current.map((entry) => (entry.id === data.entry?.id ? (data.entry as WorkEntry) : entry)));
      cancelEditEntry();
      setStatus("记录已更新");
      setStatusKind("ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "更新记录失败");
      setStatusKind("error");
    } finally {
      setIsUpdatingEntry(false);
    }
  }

  async function deleteWorkEntry(entry: WorkEntry) {
    const ok = window.confirm(`确定删除 ${entry.date} ${entry.project} 的 ${entry.hours}h 记录吗？`);
    if (!ok) {
      return;
    }

    setDeletingEntryId(entry.id);
    setStatus("正在删除记录...");
    setStatusKind("idle");

    try {
      const response = await fetch(`/api/entries?id=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "删除记录失败");
      }

      setEntries((current) => current.filter((item) => item.id !== entry.id));
      if (editingEntryId === entry.id) {
        cancelEditEntry();
      }
      setStatus("记录已删除");
      setStatusKind("ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "删除记录失败");
      setStatusKind("error");
    } finally {
      setDeletingEntryId(null);
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
          <div className="user-actions">
            {user ? <span className="status-pill ready">{user.isAdmin ? `${user.username} · 管理员` : user.username}</span> : null}
            <div className={`status-pill ${statusKind}`}>{status}</div>
            {user ? (
              <button className="secondary-btn" type="button" onClick={logout}>
                退出
              </button>
            ) : null}
          </div>
        </header>

        {!user ? (
          <section className="panel auth-panel" aria-labelledby="auth-title">
            <div className="panel-header">
              <h2 id="auth-title">{canBootstrapAdmin ? "创建管理员" : "登录"}</h2>
              <p>{canBootstrapAdmin ? "这是系统的第一个账号，创建后将拥有新增用户权限。" : "登录后进入报时和月度汇总。"}</p>
            </div>

            <form className="entry-form" onSubmit={submitAuth}>
              <label className="field">
                <span>用户名</span>
                <input
                  required
                  autoComplete="username"
                  minLength={2}
                  placeholder={canBootstrapAdmin ? "请输入管理员用户名" : "请输入用户名"}
                  value={authForm.username}
                  onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })}
                />
              </label>
              <label className="field">
                <span>密码</span>
                <input
                  required
                  autoComplete={canBootstrapAdmin ? "new-password" : "current-password"}
                  minLength={6}
                  placeholder="至少 6 个字符"
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                />
              </label>
              <button className="primary-btn" disabled={isAuthenticating} type="submit">
                {isAuthenticating ? "处理中" : canBootstrapAdmin ? "创建管理员" : "登录"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className={`tabbar ${user.isAdmin ? "admin-tabs" : "account-tabs"}`} role="tablist" aria-label="工作记录视图">
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
              <button
                aria-controls="settings-panel"
                aria-selected={activeTab === "settings"}
                className="tab-button"
                id="settings-tab"
                role="tab"
                type="button"
                onClick={() => setActiveTab("settings")}
              >
                设置
              </button>
              {user.isAdmin ? (
                <button
                  aria-controls="users-panel"
                  aria-selected={activeTab === "users"}
                  className="tab-button"
                  id="users-tab"
                  role="tab"
                  type="button"
                  onClick={() => setActiveTab("users")}
                >
                  用户
                </button>
              ) : null}
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
                        <input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
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
                      <select required value={form.person} onChange={(event) => setForm({ ...form, person: event.target.value })}>
                        {peopleOptions.map((person) => (
                          <option key={person} value={person}>
                            {person}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>项目</span>
                      <select required value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })}>
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
                      {visibleEntries.map((entry) => {
                        const isEditing = editingEntryId === entry.id && editForm;

                        return (
                          <article className="entry-card" key={entry.id}>
                            {isEditing ? (
                              <form className="inline-edit-form" onSubmit={submitEditEntry}>
                                <div className="two-col">
                                  <label className="field">
                                    <span>日期</span>
                                    <input
                                      required
                                      type="date"
                                      value={editForm.date}
                                      onChange={(event) => setEditForm({ ...editForm, date: event.target.value })}
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
                                      value={editForm.hours}
                                      onChange={(event) => setEditForm({ ...editForm, hours: Number(event.target.value) })}
                                    />
                                  </label>
                                </div>
                                <label className="field">
                                  <span>人员</span>
                                  <select
                                    required
                                    value={editForm.person}
                                    onChange={(event) => setEditForm({ ...editForm, person: event.target.value })}
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
                                    value={editForm.project}
                                    onChange={(event) => setEditForm({ ...editForm, project: event.target.value })}
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
                                    value={editForm.notes}
                                    onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                                  />
                                </label>
                                <div className="entry-actions">
                                  <button className="primary-btn compact-btn" disabled={isUpdatingEntry} type="submit">
                                    {isUpdatingEntry ? "保存中" : "保存"}
                                  </button>
                                  <button className="secondary-btn compact-btn" type="button" onClick={cancelEditEntry}>
                                    取消
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <>
                                <div className="entry-title">
                                  <span>{entry.project}</span>
                                  <span>{entry.hours}h</span>
                                </div>
                                <div className="entry-meta">
                                  <span className="tag">{entry.date}</span>
                                  <span className="tag">{entry.person}</span>
                                </div>
                                {entry.notes ? <p className="entry-note">{entry.notes}</p> : null}
                                <div className="entry-actions">
                                  <button className="secondary-btn compact-btn" type="button" onClick={() => startEditEntry(entry)}>
                                    编辑
                                  </button>
                                  <button
                                    className="danger-btn compact-btn"
                                    disabled={deletingEntryId === entry.id}
                                    type="button"
                                    onClick={() => deleteWorkEntry(entry)}
                                  >
                                    {deletingEntryId === entry.id ? "删除中" : "删除"}
                                  </button>
                                </div>
                              </>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : null}

              {activeTab === "settings" ? (
                <section aria-labelledby="settings-tab" className="panel tab-panel" id="settings-panel" role="tabpanel">
                  <div className="panel-header">
                    <h2 id="settings-title">账号设置</h2>
                    <p>修改用户名或密码时，需要输入当前密码确认。</p>
                  </div>
                  <form className="entry-form" onSubmit={submitSettings}>
                    <label className="field">
                      <span>用户名</span>
                      <input
                        required
                        autoComplete="username"
                        minLength={2}
                        value={settingsForm.username}
                        onChange={(event) => setSettingsForm({ ...settingsForm, username: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>新密码</span>
                      <input
                        autoComplete="new-password"
                        minLength={6}
                        placeholder="不修改密码可留空"
                        type="password"
                        value={settingsForm.newPassword}
                        onChange={(event) => setSettingsForm({ ...settingsForm, newPassword: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>当前密码</span>
                      <input
                        required
                        autoComplete="current-password"
                        minLength={6}
                        placeholder="请输入当前密码确认修改"
                        type="password"
                        value={settingsForm.currentPassword}
                        onChange={(event) => setSettingsForm({ ...settingsForm, currentPassword: event.target.value })}
                      />
                    </label>
                    <button className="primary-btn" disabled={isUpdatingProfile} type="submit">
                      {isUpdatingProfile ? "更新中" : "保存设置"}
                    </button>
                  </form>
                </section>
              ) : null}

              {activeTab === "users" && user.isAdmin ? (
                <section aria-labelledby="users-tab" className="panel tab-panel" id="users-panel" role="tabpanel">
                  <div className="panel-header">
                    <h2 id="users-title">新增用户</h2>
                    <p>只有管理员账号可以创建新用户。新用户创建后可直接登录报时。</p>
                  </div>
                  <form className="entry-form" onSubmit={createRegularUser}>
                    <label className="field">
                      <span>用户名</span>
                      <input
                        required
                        autoComplete="off"
                        minLength={2}
                        placeholder="请输入新用户名"
                        value={newUserForm.username}
                        onChange={(event) => setNewUserForm({ ...newUserForm, username: event.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>初始密码</span>
                      <input
                        required
                        autoComplete="new-password"
                        minLength={6}
                        placeholder="至少 6 个字符"
                        type="password"
                        value={newUserForm.password}
                        onChange={(event) => setNewUserForm({ ...newUserForm, password: event.target.value })}
                      />
                    </label>
                    <button className="primary-btn" disabled={isCreatingUser} type="submit">
                      {isCreatingUser ? "创建中" : "创建用户"}
                    </button>
                  </form>
                </section>
              ) : null}
            </div>
          </>
        )}
      </div>
    </main>
  );
}








