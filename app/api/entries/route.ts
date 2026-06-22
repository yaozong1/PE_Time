import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addEntry, deleteEntry, isStorageConfigured, listEntries, updateEntry } from "@/lib/upstash";
import type { EntryInput, WorkEntry } from "@/lib/types";

const people = ["Leila", "yaozong"];
const projects = ["PE internal", "Burn", "Roam", "Epsilon", "CleanMotion"];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validate(payload: Partial<EntryInput>) {
  const date = cleanText(payload.date);
  const person = cleanText(payload.person);
  const project = cleanText(payload.project);
  const notes = cleanText(payload.notes);
  const hours = Number(payload.hours);

  if (!date || !person || !project) {
    return { error: "请填写日期、人员和项目。" };
  }

  if (!people.includes(person)) {
    return { error: "请选择有效人员。" };
  }

  if (!projects.includes(project)) {
    return { error: "请选择有效项目。" };
  }

  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    return { error: "工时需要是 0 到 24 之间的数字。" };
  }

  return {
    value: {
      date,
      person,
      project,
      hours: Math.round(hours * 100) / 100,
      notes
    }
  };
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  return null;
}

export async function GET() {
  if (!isStorageConfigured()) {
    return NextResponse.json({ entries: [], configured: false });
  }

  const unauthorized = await requireUser();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const entries = await listEntries();
    return NextResponse.json({ entries, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取记录失败。", entries: [], configured: true },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "还没有配置 Upstash。请先设置 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN。" },
      { status: 500 }
    );
  }

  const unauthorized = await requireUser();
  if (unauthorized) {
    return unauthorized;
  }

  const payload = (await request.json()) as Partial<EntryInput>;
  const result = validate(payload);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const entry: WorkEntry = {
    ...result.value,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };

  try {
    await addEntry(entry);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存记录失败。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "还没有配置 Upstash。" }, { status: 500 });
  }

  const unauthorized = await requireUser();
  if (unauthorized) {
    return unauthorized;
  }

  const payload = (await request.json()) as Partial<WorkEntry>;
  const id = cleanText(payload.id);
  const createdAt = cleanText(payload.createdAt);
  const result = validate(payload);

  if (!id || !createdAt) {
    return NextResponse.json({ error: "缺少记录 ID。" }, { status: 400 });
  }

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const entry: WorkEntry = {
    ...result.value,
    id,
    createdAt
  };

  try {
    await updateEntry(entry);
    return NextResponse.json({ entry });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "更新记录失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "还没有配置 Upstash。" }, { status: 500 });
  }

  const unauthorized = await requireUser();
  if (unauthorized) {
    return unauthorized;
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "缺少记录 ID。" }, { status: 400 });
  }

  try {
    await deleteEntry(id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "删除记录失败。" }, { status: 500 });
  }
}
