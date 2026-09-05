export type PostType = "practice" | "member" | "event";

export function normalizeType(value: unknown): PostType | null {
  return value === "practice" || value === "member" || value === "event" ? value : null;
}

export function required(body: Record<string, unknown>, key: string) {
  const raw = body[key];
  const value = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
  if (!value) throw new Error(`${key} は必須です`);
  return value;
}

export function count(body: Record<string, unknown>, key: string, allowZero = false) {
  const value = Number(body[key]);
  if (!Number.isFinite(value) || value < (allowZero ? 0 : 1))
    throw new Error(`${key} が正しくありません`);
  return Math.round(value);
}

export const tableFor = {
  practice: "practice_posts",
  member: "member_posts",
  event: "event_posts",
} as const;
