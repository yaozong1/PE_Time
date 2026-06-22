import { NextResponse } from "next/server";
import { getCurrentUser, usersExist } from "@/lib/auth";
import { isStorageConfigured } from "@/lib/upstash";

export async function GET() {
  if (!isStorageConfigured()) {
    return NextResponse.json({ user: null, configured: false, canBootstrapAdmin: false });
  }

  const user = await getCurrentUser();
  const hasUsers = await usersExist();
  return NextResponse.json({ user, configured: true, canBootstrapAdmin: !hasUsers });
}
