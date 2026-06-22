import { NextResponse } from "next/server";
import { clearSession, createSession, getCurrentUser, updateUserProfile } from "@/lib/auth";
import { isStorageConfigured } from "@/lib/upstash";

export async function PATCH(request: Request) {
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "还没有配置 Upstash，无法修改账号。" }, { status: 500 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    username?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  try {
    const user = await updateUserProfile(currentUser, payload);
    await clearSession();
    await createSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "修改账号失败。" }, { status: 400 });
  }
}
