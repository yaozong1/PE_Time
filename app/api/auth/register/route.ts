import { NextResponse } from "next/server";
import { createSession, createUser, getCurrentUser, usersExist } from "@/lib/auth";
import { isStorageConfigured } from "@/lib/upstash";

export async function POST(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "还没有配置 Upstash，无法注册用户。" }, { status: 500 });
  }

  const payload = (await request.json()) as { username?: string; password?: string };

  try {
    const hasUsers = await usersExist();
    const currentUser = await getCurrentUser();

    if (hasUsers && !currentUser?.isAdmin) {
      return NextResponse.json({ error: "只有管理员可以注册新用户。" }, { status: 403 });
    }

    const createdUser = await createUser(payload.username ?? "", payload.password ?? "", hasUsers ? "user" : "admin");

    if (!hasUsers) {
      await createSession(createdUser);
      return NextResponse.json({ user: createdUser, signedIn: true }, { status: 201 });
    }

    return NextResponse.json({ user: createdUser, signedIn: false }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "注册失败。" }, { status: 400 });
  }
}
