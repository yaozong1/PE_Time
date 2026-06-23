import { cookies } from "next/headers";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { upstash } from "@/lib/upstash";

const usersKey = process.env.UPSTASH_USERS_KEY ?? "consulting:users";
const sessionPrefix = process.env.UPSTASH_SESSION_PREFIX ?? "consulting:sessions";
const sessionCookie = "pe_time_session";
const sessionMaxAge = 60 * 60 * 24 * 30;
const useSecureCookies = process.env.AUTH_COOKIE_SECURE === "true";
const adminUsernames = (process.env.ADMIN_USERNAMES ?? "")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

type UserRole = "admin" | "user";

export type CurrentUser = {
  username: string;
  createdAt: string;
  isAdmin: boolean;
};

type StoredUser = {
  username: string;
  createdAt: string;
  role?: UserRole;
  passwordHash: string;
};

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }

  const candidate = hashPassword(password, salt).split(":")[1];
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

function sessionKey(token: string) {
  return `${sessionPrefix}:${token}`;
}

function publicUser(user: StoredUser): CurrentUser {
  return {
    username: user.username,
    createdAt: user.createdAt,
    isAdmin: user.role === "admin" || adminUsernames.includes(user.username)
  };
}

export async function usersExist() {
  const count = await upstash<number>(["HLEN", usersKey]);
  return count > 0;
}

export async function findUser(username: string) {
  const normalized = normalizeUsername(username);
  const value = await upstash<string | null>(["HGET", usersKey, normalized]);
  return value ? (JSON.parse(value) as StoredUser) : null;
}

export async function createUser(username: string, password: string, role: UserRole = "user") {
  const normalized = normalizeUsername(username);

  if (normalized.length < 2) {
    throw new Error("用户名至少需要 2 个字符。");
  }

  if (password.length < 6) {
    throw new Error("密码至少需要 6 个字符。");
  }

  const existing = await findUser(normalized);
  if (existing) {
    throw new Error("这个用户名已经注册。");
  }

  const user: StoredUser = {
    username: normalized,
    role,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };

  await upstash<number>(["HSET", usersKey, normalized, JSON.stringify(user)]);
  return publicUser(user);
}

export async function authenticateUser(username: string, password: string) {
  const user = await findUser(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("用户名或密码不正确。");
  }

  return publicUser(user);
}

export async function updateUserProfile(
  currentUser: CurrentUser,
  input: { username?: string; currentPassword?: string; newPassword?: string }
) {
  const storedUser = await findUser(currentUser.username);
  if (!storedUser) {
    throw new Error("当前账号不存在，请重新登录。");
  }

  const currentPassword = input.currentPassword ?? "";
  if (!verifyPassword(currentPassword, storedUser.passwordHash)) {
    throw new Error("当前密码不正确。");
  }

  const nextUsername = normalizeUsername(input.username ?? storedUser.username);
  if (nextUsername.length < 2) {
    throw new Error("用户名至少需要 2 个字符。");
  }

  if (nextUsername !== storedUser.username) {
    const existing = await findUser(nextUsername);
    if (existing) {
      throw new Error("这个用户名已经被占用。");
    }
  }

  const newPassword = input.newPassword?.trim() ?? "";
  if (newPassword && newPassword.length < 6) {
    throw new Error("新密码至少需要 6 个字符。");
  }

  const nextUser: StoredUser = {
    ...storedUser,
    username: nextUsername,
    role: currentUser.isAdmin ? "admin" : storedUser.role,
    passwordHash: newPassword ? hashPassword(newPassword) : storedUser.passwordHash
  };

  await upstash<number>(["HSET", usersKey, nextUsername, JSON.stringify(nextUser)]);

  if (nextUsername !== storedUser.username) {
    await upstash<number>(["HDEL", usersKey, storedUser.username]);
  }

  return publicUser(nextUser);
}

export async function createSession(user: CurrentUser) {
  const token = randomBytes(32).toString("hex");
  await upstash<string>(["SET", sessionKey(token), JSON.stringify(user), "EX", sessionMaxAge]);

  const cookieStore = await cookies();
  cookieStore.set(sessionCookie, token, {
    httpOnly: true,
    maxAge: sessionMaxAge,
    path: "/",
    sameSite: "lax",
    secure: useSecureCookies
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;

  if (!token) {
    return null;
  }

  const value = await upstash<string | null>(["GET", sessionKey(token)]);
  if (!value) {
    return null;
  }

  const sessionUser = JSON.parse(value) as CurrentUser;
  const storedUser = await findUser(sessionUser.username);
  return storedUser ? publicUser(storedUser) : sessionUser;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookie)?.value;

  if (token) {
    await upstash<number>(["DEL", sessionKey(token)]);
  }

  cookieStore.delete(sessionCookie);
}
