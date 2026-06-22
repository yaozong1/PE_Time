import { NextResponse } from "next/server";
import { authenticateUser, createSession } from "@/lib/auth";
import { isStorageConfigured } from "@/lib/upstash";

export async function POST(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "还没有配置 Upstash，无法登录。" }, { status: 500 });
  }

  const payload = (await request.json()) as { username?: string; password?: string };

  try {
    const user = await authenticateUser(payload.username ?? "", payload.password ?? "");
    await createSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "登录失败。" }, { status: 401 });
  }
}
