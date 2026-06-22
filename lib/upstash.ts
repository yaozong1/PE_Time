import type { WorkEntry } from "@/lib/types";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const key = process.env.UPSTASH_REDIS_KEY ?? "consulting:work-entries";

type UpstashResponse<T> = {
  result?: T;
  error?: string;
};

function assertConfigured() {
  if (!redisUrl || !redisToken) {
    throw new Error("Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
  }
}

export async function upstash<T>(command: unknown[]): Promise<T> {
  assertConfigured();

  const response = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([command]),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Upstash request failed with ${response.status}`);
  }

  const data = (await response.json()) as UpstashResponse<T>[];
  const first = data[0];

  if (first?.error) {
    throw new Error(first.error);
  }

  return first?.result as T;
}

export function isStorageConfigured() {
  return Boolean(redisUrl && redisToken);
}

export async function listEntries(): Promise<WorkEntry[]> {
  const values = await upstash<string[]>(["LRANGE", key, 0, -1]);
  return values
    .map((value) => JSON.parse(value) as WorkEntry)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function addEntry(entry: WorkEntry) {
  await upstash<number>(["LPUSH", key, JSON.stringify(entry)]);
}
